// Разбор ответов FACEIT Data API v4. Формат сверен с настоящими ответами
// (scripts/faceit-probe.mjs): время — в секундах, команды — faction1/faction2,
// карта и K/D — только в /matches/{id}/stats.

import type { MatchResult } from '../db'

export interface FaceitPlayer {
  playerId: string
  nickname: string
  /** SteamID64 из профиля CS2 на FACEIT (games.cs2.game_player_id). */
  steamId64: string | null
}

export interface FaceitHistoryMatch {
  matchId: string
  finishedAt: Date
  /** Например '5v5' — для подписи режима. */
  gameMode: string
  ownScore: number | null
  oppScore: number | null
  result: MatchResult | null
}

export interface FaceitMatchStats {
  map: string | null
  kills: number | null
  deaths: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const asNumber = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null
/** В stats все числа приходят строками: "13", "6.6". */
const numberFromString = (v: unknown): number | null => {
  if (typeof v !== 'string' || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function parsePlayer(raw: unknown): FaceitPlayer | null {
  if (!isRecord(raw)) return null
  const playerId = asString(raw.player_id)
  const nickname = asString(raw.nickname)
  if (!playerId || !nickname) return null
  const cs2 = isRecord(raw.games) && isRecord(raw.games.cs2) ? raw.games.cs2 : null
  return { playerId, nickname, steamId64: cs2 ? asString(cs2.game_player_id) : null }
}

/**
 * Один матч из истории. Возвращает null для незавершённых/отменённых матчей
 * и матчей, где игрока нет ни в одной команде.
 */
export function parseHistoryItem(raw: unknown, playerId: string): FaceitHistoryMatch | null {
  if (!isRecord(raw)) return null
  const matchId = asString(raw.match_id)
  const finishedAtSec = asNumber(raw.finished_at)
  if (!matchId || finishedAtSec === null || raw.status !== 'finished') return null
  if (!isRecord(raw.teams) || !isRecord(raw.results)) return null

  // Ищем ключ команды (faction1/faction2), в которой есть наш игрок.
  // Object.entries даёт пары [ключ, значение]; find — первую подходящую.
  const own = Object.entries(raw.teams).find(
    ([, team]) =>
      isRecord(team) &&
      Array.isArray(team.players) &&
      team.players.some((p) => isRecord(p) && p.player_id === playerId)
  )
  if (!own) return null
  const ownKey = own[0]
  const oppKey = Object.keys(raw.teams).find((key) => key !== ownKey) ?? null

  const score = isRecord(raw.results.score) ? raw.results.score : {}
  const ownScore = asNumber(score[ownKey])
  const oppScore = oppKey ? asNumber(score[oppKey]) : null
  const winner = asString(raw.results.winner)

  return {
    matchId,
    finishedAt: new Date(finishedAtSec * 1000), // секунды → миллисекунды
    gameMode: asString(raw.game_mode) ?? '5v5',
    ownScore,
    oppScore,
    result: winner === null ? null : winner === ownKey ? 'win' : 'loss'
  }
}

export function parseHistory(raw: unknown, playerId: string): FaceitHistoryMatch[] {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return []
  return raw.items
    .map((item) => parseHistoryItem(item, playerId))
    .filter((m): m is FaceitHistoryMatch => m !== null)
  // filter с «type predicate» (m is ...) — после него TS знает, что null в массиве нет.
}

export function parseMatchStats(raw: unknown, playerId: string): FaceitMatchStats {
  const empty: FaceitMatchStats = { map: null, kills: null, deaths: null }
  if (!isRecord(raw) || !Array.isArray(raw.rounds)) return empty
  const round: unknown = raw.rounds[0]
  if (!isRecord(round)) return empty

  const map = isRecord(round.round_stats) ? asString(round.round_stats.Map) : null

  let kills: number | null = null
  let deaths: number | null = null
  for (const team of Array.isArray(round.teams) ? round.teams : []) {
    if (!isRecord(team) || !Array.isArray(team.players)) continue
    const me = team.players.find((p) => isRecord(p) && p.player_id === playerId)
    if (isRecord(me) && isRecord(me.player_stats)) {
      kills = numberFromString(me.player_stats.Kills)
      deaths = numberFromString(me.player_stats.Deaths)
    }
  }
  return { map, kills, deaths }
}
