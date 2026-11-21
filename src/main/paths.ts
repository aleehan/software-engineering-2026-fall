import { app } from 'electron'
import { join } from 'path'

// Здесь собраны все пути, которые зависят от Electron.
// core/ их не вычисляет, а получает готовыми строками.

/** Файл базы: %APPDATA%\gamekeeper\gamekeeper.db */
export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'gamekeeper.db')
}

/**
 * Папка с SQL-миграциями.
 * В dev — drizzle/ в корне проекта.
 * В собранном приложении electron-builder кладёт её в resources/drizzle
 * (см. extraResources в electron-builder.yml).
 */
export function getMigrationsFolder(): string {
  return app.isPackaged ? join(process.resourcesPath, 'drizzle') : join(app.getAppPath(), 'drizzle')
}
