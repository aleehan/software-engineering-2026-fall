import { getGameDayStart, getNextReset } from './game-day'

/**
 * allowed — играть можно;
 * grace   — лимит исчерпан, но ещё идёт задержка перед закрытием (если она > 0);
 * blocked — лимит исчерпан, CS2 закрывается при любом запуске до 05:00.
 */
export type RulesStatus = 'allowed' | 'grace' | 'blocked'

export interface RulesInput {
  now: Date
  limit: number
  closeDelayMs: number
  /** Время окончания каток за текущий игровой день, по возрастанию. */
  matchTimesToday: Date[]
  /** Блокировка снята до этого момента (после подтверждённого запроса). null — не снята. */
  unlockedUntil?: Date | null
}

export interface RulesState {
  status: RulesStatus
  matchesToday: number
  limit: number
  remaining: number
  /** Когда CS2 будет закрыта (для grace) или была закрыта (для blocked). */
  closeAt: Date | null
  dayStartedAt: Date
  nextResetAt: Date
  /** Блокировка снята вручную (через пароль) — до какого момента. null — не снята. */
  unlockedUntil: Date | null
}

/**
 * Чистая функция: никакого состояния, базы или часов внутри — всё приходит параметрами.
 * Один и тот же вход всегда даёт один и тот же выход, поэтому её легко тестировать.
 */
export function evaluateRules(input: RulesInput): RulesState {
  const { now, limit, closeDelayMs, matchTimesToday } = input
  const matchesToday = matchTimesToday.length
  // Устаревшую отметку (из прошлого) не учитываем вовсе.
  const unlockedUntil =
    input.unlockedUntil && now < input.unlockedUntil ? input.unlockedUntil : null

  const base = {
    matchesToday,
    limit,
    // Math.max(0, ...) — если лимит ужесточили ниже уже сыгранного, остаток не уходит в минус.
    remaining: Math.max(0, limit - matchesToday),
    dayStartedAt: getGameDayStart(now),
    nextResetAt: getNextReset(now),
    unlockedUntil
  }

  // Снятая блокировка разрешает играть сверх лимита до unlockedUntil.
  if (matchesToday < limit || unlockedUntil !== null) {
    return { ...base, status: 'allowed', closeAt: null }
  }

  // Отсчёт идёт от катки, которая исчерпала лимит (limit-я по счёту, индекс limit - 1).
  // Если лимит понизили ниже числа сыгранных, эта катка уже давно в прошлом → сразу blocked.
  const limitReachedAt = matchTimesToday[limit - 1]
  const closeAt = new Date(limitReachedAt.getTime() + closeDelayMs)

  return { ...base, status: now < closeAt ? 'grace' : 'blocked', closeAt }
}
