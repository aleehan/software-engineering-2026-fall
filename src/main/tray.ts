import { Menu, Tray, nativeImage } from 'electron'
// ?asset — electron-vite подставит путь к файлу в папке resources (она не упаковывается в asar).
// Рядом лежит tray@2x.png: Electron сам возьмёт его на экранах с масштабом 200%.
import trayIcon from '../../resources/tray.png?asset'

// Описываем, что трею нужно от внешнего мира, через интерфейс колбэков.
// Так tray.ts не знает про окно напрямую — его можно переиспользовать и тестировать.
export interface TrayActions {
  onShow: () => void
  onQuit: () => void
}

export function createTray(actions: TrayActions): Tray {
  // Отдельная картинка 16×16 (и 32×32 для @2x), нарисованная под маленький размер:
  // уменьшенная иконка приложения в трее превращается в кашу.
  const tray = new Tray(nativeImage.createFromPath(trayIcon))

  tray.setToolTip('Gamekeeper')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Открыть Gamekeeper', click: actions.onShow },
      { type: 'separator' },
      // Выход — только по паролю через 10 минут; пункт открывает окно с запросом.
      { label: 'Выход…', click: actions.onQuit }
    ])
  )

  // Одиночный клик по иконке открывает окно (привычное поведение на Windows).
  tray.on('click', actions.onShow)

  return tray
}
