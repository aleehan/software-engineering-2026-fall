import { app } from 'electron'

// Флаг командной строки, с которым Windows запускает нас при входе в систему.
// Увидев его, приложение стартует сразу в трей, без окна.
export const HIDDEN_FLAG = '--hidden'

/**
 * Имя записи в HKCU\Software\Microsoft\Windows\CurrentVersion\Run.
 * Задано явно, потому что деинсталлятор (build/installer.nsh) удаляет запись по этому имени.
 */
export const AUTOSTART_NAME = 'Gamekeeper'

// Одни и те же параметры для установки и проверки: по ним Electron находит «свою» запись.
const LOGIN_ITEM = { name: AUTOSTART_NAME, args: [HIDDEN_FLAG] }

/**
 * Включает автозапуск с Windows. Вызывается при каждом старте, поэтому
 * запись восстанавливается, даже если её удалили вручную.
 *
 * В режиме разработки (`npm run dev`) ничего не делаем: там исполняемый файл —
 * это голый electron.exe из node_modules, и прописывать его в автозагрузку нельзя.
 */
export function ensureAutostart(): void {
  if (!app.isPackaged) return
  app.setLoginItemSettings({ ...LOGIN_ITEM, openAtLogin: true })
}

export function isAutostartEnabled(): boolean {
  // openAtLogin здесь не годится: Electron на Windows читает аргументы из записи как пустой
  // список и, сравнив их с ['--hidden'], всегда отвечает false. executableWillLaunchAtLogin —
  // «запись для этого exe есть и не отключена в диспетчере задач», это нам и нужно.
  return app.getLoginItemSettings(LOGIN_ITEM).executableWillLaunchAtLogin
}

// `process.argv` — массив строк аргументов запуска. `includes` вернёт boolean.
export function wasLaunchedHidden(argv: string[] = process.argv): boolean {
  return argv.includes(HIDDEN_FLAG)
}
