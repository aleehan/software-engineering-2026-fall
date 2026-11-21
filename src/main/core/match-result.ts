import type { MatchResult } from './db'

export interface OwnScore {
  ownScore: number | null
  oppScore: number | null
  result: MatchResult | null
}

/** Итог по счёту «свой : соперника». null, если счёта нет. */
export function resultFromScore(own: number | null, opp: number | null): MatchResult | null {
  if (own === null || opp === null) return null
  return own > opp ? 'win' : own < opp ? 'loss' : 'draw'
}

/**
 * Пересчёт счёта CT:T в «свой : соперника» по стороне игрока.
 * Если сторона неизвестна — счёт и итог тоже неизвестны.
 */
export function ownScoreFromSides(
  team: 'CT' | 'T' | null,
  ctScore: number | null,
  tScore: number | null
): OwnScore {
  if (team === null || ctScore === null || tScore === null) {
    return { ownScore: null, oppScore: null, result: null }
  }
  const [ownScore, oppScore] = team === 'CT' ? [ctScore, tScore] : [tScore, ctScore]
  return { ownScore, oppScore, result: resultFromScore(ownScore, oppScore) }
}
