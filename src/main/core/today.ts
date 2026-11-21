import { getSettings, listMatchTimesSince, type Db } from './db'
import { getGameDayStart } from './game-day'
import { evaluateRules, type RulesState } from './rules-engine'

/** Читает из базы всё нужное и вычисляет состояние лимита на текущий игровой день. */
export function evaluateToday(db: Db, now: Date = new Date()): RulesState {
  const settings = getSettings(db)
  return evaluateRules({
    now,
    limit: settings.matchLimit,
    closeDelayMs: settings.closeDelaySeconds * 1000,
    matchTimesToday: listMatchTimesSince(db, getGameDayStart(now)),
    unlockedUntil: settings.unlockedUntil
  })
}
