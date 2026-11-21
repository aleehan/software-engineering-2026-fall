import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Модульная переменная: живёт, пока жив процесс. `let` — потому что значение меняется.
// Тип `boolean` TS выведет сам из `false`, явно писать не нужно.
let isQuitting = false

/** Вызывается перед настоящим выходом, чтобы окно не перехватило закрытие. */
export function markQuitting(): void {
  isQuitting = true
}

export function createMainWindow(options: { showOnReady: boolean }): BrowserWindow {
  const win = new BrowserWindow({
    // Пропорции настольного приложения: боковая панель 240 + содержимое.
    width: 1080,
    height: 720,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: '#141415', // цвет фона страницы — без белой вспышки при открытии
    show: false, // показываем сами в 'ready-to-show', чтобы не мигало белым
    autoHideMenuBar: true,
    icon,
    title: 'Gamekeeper',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Песочница + изоляция контекста: код страницы не имеет доступа к Node.js,
      // общаться с main можно только через то, что preload явно выставил.
      sandbox: true,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => {
    if (options.showOnReady) win.show()
  })

  // Крестик окна не завершает приложение, а прячет его в трей.
  // `event.preventDefault()` отменяет стандартное закрытие.
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  // Выключение / выход из Windows: не мешаем системе завершить работу,
  // иначе перехват 'close' выше заблокировал бы выключение компьютера.
  win.on('session-end', () => {
    isQuitting = true
  })

  // Внешние ссылки открываем в браузере, а не внутри приложения.
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // В dev electron-vite поднимает сервер с горячей перезагрузкой,
  // в собранном приложении грузим готовый HTML из папки out/.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/** Показать окно и вывести на передний план (из трея или при повторном запуске). */
export function showWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}
