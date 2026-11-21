import { describe, expect, it } from 'vitest'
import { evaluateRules } from './rules-engine'

const now = new Date(2026, 10, 20, 20, 0)
const minutesAgo = (n: number): Date => new Date(now.getTime() - n * 60_000)

describe('evaluateRules', () => {
  it('allowed, пока каток меньше лимита', () => {
    const state = evaluateRules({
      now,
      limit: 3,
      closeDelayMs: 0,
      matchTimesToday: [minutesAgo(90), minutesAgo(45)]
    })
    expect(state).toMatchObject({ status: 'allowed', matchesToday: 2, remaining: 1, closeAt: null })
  })

  it('blocked сразу после последней катки при задержке 0', () => {
    const state = evaluateRules({
      now,
      limit: 2,
      closeDelayMs: 0,
      matchTimesToday: [minutesAgo(45), now]
    })
    expect(state.status).toBe('blocked')
    expect(state.remaining).toBe(0)
  })

  it('grace до истечения задержки, потом blocked', () => {
    const input = { limit: 1, closeDelayMs: 2 * 60_000, matchTimesToday: [minutesAgo(1)] }
    expect(evaluateRules({ ...input, now }).status).toBe('grace')
    expect(evaluateRules({ ...input, now }).closeAt).toEqual(new Date(now.getTime() + 60_000))

    const later = new Date(now.getTime() + 61_000)
    expect(evaluateRules({ ...input, now: later }).status).toBe('blocked')
  })

  it('снятая блокировка разрешает играть сверх лимита до unlockedUntil', () => {
    const input = {
      limit: 1,
      closeDelayMs: 0,
      matchTimesToday: [minutesAgo(30), minutesAgo(5)],
      unlockedUntil: new Date(now.getTime() + 60 * 60_000)
    }
    expect(evaluateRules({ ...input, now }).status).toBe('allowed')
    const afterUnlock = new Date(now.getTime() + 61 * 60_000)
    expect(evaluateRules({ ...input, now: afterUnlock }).status).toBe('blocked')
    expect(evaluateRules({ ...input, now: afterUnlock }).unlockedUntil).toBeNull()
  })

  it('задержка считается от катки, исчерпавшей лимит, а не от последней', () => {
    // Лимит понизили с 3 до 1, когда сыграно уже 2: блокировка сразу, без задержки.
    const state = evaluateRules({
      now,
      limit: 1,
      closeDelayMs: 2 * 60_000,
      matchTimesToday: [minutesAgo(90), minutesAgo(1)]
    })
    expect(state.status).toBe('blocked')
    expect(state.remaining).toBe(0)
  })
})
