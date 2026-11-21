import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

// Тип нашего подключения. Дженерик <typeof schema> сообщает Drizzle все таблицы,
// поэтому db.query.matches и т.п. будут знать типы колонок.
export type Db = BetterSQLite3Database<typeof schema>

export interface OpenDatabaseOptions {
  /** Путь к файлу .db. Специальное значение ':memory:' — база в памяти (для тестов). */
  filePath: string
  /** Папка с SQL-миграциями, сгенерированными drizzle-kit. */
  migrationsFolder: string
}

export interface DatabaseHandle {
  db: Db
  close: () => void
}

/**
 * Открывает базу и приводит её схему к актуальной версии.
 *
 * better-sqlite3 — синхронная библиотека: запросы выполняются сразу,
 * без Promise/await. Для локальной SQLite это быстрее и проще,
 * а наши запросы занимают микросекунды и не блокируют приложение заметно.
 */
export function openDatabase(options: OpenDatabaseOptions): DatabaseHandle {
  const sqlite = new Database(options.filePath)

  // WAL (write-ahead log) — режим журнала, устойчивый к внезапному завершению процесса.
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })

  // Применяет все ещё не применённые миграции из папки.
  // Drizzle хранит список применённых в служебной таблице __drizzle_migrations.
  migrate(db, { migrationsFolder: options.migrationsFolder })

  // Гарантируем, что строка настроек существует.
  // onConflictDoNothing = INSERT OR IGNORE: если строка с id=1 уже есть, ничего не делаем.
  db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing().run()

  return {
    db,
    close: () => sqlite.close()
  }
}
