// Схема базы данных на Drizzle ORM.
// Из этого файла получаются и SQL-миграции (через drizzle-kit),
// и TS-типы строк — одна точка правды, типы никогда не разойдутся со схемой.

import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// ── settings ──────────────────────────────────────────────────────────
// Всегда ровно одна строка с id = 1 (это гарантирует CHECK-ограничение).
export const settings = sqliteTable(
  'settings',
  {
    id: integer('id').primaryKey(),
    // Сколько каток в день разрешено (1–10).
    matchLimit: integer('match_limit').notNull().default(3),
    // Через сколько секунд после последней катки закрыть cs2.exe.
    // 0 — сразу на экране итогов (иначе за время ожидания можно найти ещё одну игру).
    closeDelaySeconds: integer('close_delay_seconds').notNull().default(0),
    // Хеш пароля (этап 5). null — пароль ещё не задан.
    passwordHash: text('password_hash'),
    // Секретный токен, который CS2 присылает в каждом GSI-запросе (этап 3).
    gsiToken: text('gsi_token'),
    // До какого момента блокировка снята (после подтверждённого «Снять блокировку»).
    unlockedUntil: integer('unlocked_until', { mode: 'timestamp_ms' }),
    // FACEIT: никнейм, id игрока (из API) и ключ Data API. null — не подключено.
    faceitNickname: text('faceit_nickname'),
    faceitPlayerId: text('faceit_player_id'),
    faceitApiKey: text('faceit_api_key'),
    // Когда последний раз успешно сходили в FACEIT API.
    faceitSyncedAt: integer('faceit_synced_at', { mode: 'timestamp_ms' })
  },
  // Третий аргумент — ограничения таблицы. `table` — уже описанные колонки.
  (table) => [
    check('settings_singleton', sql`${table.id} = 1`),
    check('settings_limit_range', sql`${table.matchLimit} BETWEEN 1 AND 10`),
    check('settings_delay_positive', sql`${table.closeDelaySeconds} >= 0`)
  ]
)

// ── matches ───────────────────────────────────────────────────────────
export const matchSources = ['gsi', 'faceit'] as const
export type MatchSource = (typeof matchSources)[number]
export const matchResults = ['win', 'loss', 'draw'] as const
export type MatchResult = (typeof matchResults)[number]

// Одна строка = одна засчитанная соревновательная катка.
export const matches = sqliteTable(
  'matches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // mode: 'timestamp_ms' — в базе лежит число (миллисекунды),
    // а в TS-коде мы работаем с обычным объектом Date. Drizzle конвертирует сам.
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }).notNull(),
    // Режим из GSI: 'competitive', 'premier', 'scrimcomp2v2' (напарники)…
    mode: text('mode').notNull(),
    map: text('map').notNull(),
    steamId: text('steam_id').notNull(),
    ctScore: integer('ct_score'),
    tScore: integer('t_score'),
    // Откуда запись: 'gsi' — засчитал GSI в момент окончания, 'faceit' — пришла из FACEIT API.
    source: text('source', { enum: matchSources }).notNull().default('gsi'),
    // Id матча на FACEIT. Есть и у GSI-записи, если FACEIT потом подтвердил, что это его матч.
    faceitMatchId: text('faceit_match_id').unique(),
    // Сторона игрока в конце матча ('CT' | 'T') — чтобы показать счёт «свой : соперника».
    playerTeam: text('player_team'),
    ownScore: integer('own_score'),
    oppScore: integer('opp_score'),
    result: text('result', { enum: matchResults }),
    kills: integer('kills'),
    deaths: integer('deaths')
  },
  // Индекс ускоряет главный запрос: «сколько каток с 05:00 сегодняшнего дня».
  (table) => [index('matches_finished_at_idx').on(table.finishedAt)]
)

// ── pending_changes ──────────────────────────────────────────────────
// Ослабляющие изменения (поднять лимит, снять блокировку, выйти),
// которые вступают в силу только после задержки.

// Список допустимых видов изменения. `as const` + `[number]` ниже дают
// тип-объединение 'raise_limit' | 'unlock' | ... вместо просто string.
export const pendingChangeKinds = [
  'raise_limit',
  'raise_close_delay',
  'unlock',
  'quit',
  // Смена или отключение аккаунта FACEIT: иначе можно было бы подставить чужой ник
  // и перестать засчитывать свои FACEIT-катки.
  'change_faceit'
] as const
export type PendingChangeKind = (typeof pendingChangeKinds)[number]

export const pendingChangeStatuses = ['pending', 'applied', 'cancelled'] as const
export type PendingChangeStatus = (typeof pendingChangeStatuses)[number]

export const pendingChanges = sqliteTable(
  'pending_changes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // `enum` в Drizzle — только подсказка для TS: колонка в TS будет иметь
    // тип PendingChangeKind, а не string. В самой SQLite это обычный text.
    kind: text('kind', { enum: pendingChangeKinds }).notNull(),
    // Новое значение, например лимит 5. Для 'unlock'/'quit' — null.
    value: integer('value'),
    // Текстовое значение (JSON) — для 'change_faceit'.
    textValue: text('text_value'),
    requestedAt: integer('requested_at', { mode: 'timestamp_ms' }).notNull(),
    applyAfter: integer('apply_after', { mode: 'timestamp_ms' }).notNull(),
    status: text('status', { enum: pendingChangeStatuses }).notNull().default('pending')
  },
  (table) => [index('pending_changes_status_idx').on(table.status, table.applyAfter)]
)

// ── Типы строк ────────────────────────────────────────────────────────
// $inferSelect — тип строки, которую возвращает SELECT.
// $inferInsert — тип объекта для INSERT (поля с default/autoincrement необязательны).
export type Settings = typeof settings.$inferSelect
export type Match = typeof matches.$inferSelect
export type NewMatch = typeof matches.$inferInsert
export type PendingChange = typeof pendingChanges.$inferSelect
