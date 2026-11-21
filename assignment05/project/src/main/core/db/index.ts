// «Бочка» (barrel) — реэкспорт всего модуля из одного места.
// Снаружи можно писать import { openDatabase, getSettings } from './core/db'.
export * from './database'
export * from './schema'
export * from './settings-repo'
export * from './matches-repo'
export * from './pending-changes-repo'
