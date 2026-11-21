import { eq } from 'drizzle-orm'
import type { Db } from './database'
import { settings, type Settings } from './schema'

// Omit<Settings, 'id'> — тип Settings без поля id.
// Partial<...> — делает все поля необязательными.
// Итого: «любой набор полей настроек, кроме id» — удобно для частичного обновления.
export type SettingsPatch = Partial<Omit<Settings, 'id'>>

export function getSettings(db: Db): Settings {
  const row = db.select().from(settings).where(eq(settings.id, 1)).get()
  // openDatabase всегда создаёт строку, так что её отсутствие — ошибка программы.
  if (!row) throw new Error('Строка настроек не найдена')
  return row
}

export function updateSettings(db: Db, patch: SettingsPatch): Settings {
  // .returning() возвращает строку уже после обновления.
  const row = db.update(settings).set(patch).where(eq(settings.id, 1)).returning().get()
  if (!row) throw new Error('Строка настроек не найдена')
  return row
}
