import { describe, expect, it } from 'vitest'
import { getGameDayStart, getNextReset } from './game-day'

// Все даты — в местном времени (так же работает и само приложение).
const at = (y: number, m: number, d: number, h: number, min = 0): Date =>
  new Date(y, m - 1, d, h, min)

describe('getGameDayStart', () => {
  it('днём — сегодня в 05:00', () => {
    expect(getGameDayStart(at(2026, 11, 20, 18))).toEqual(at(2026, 11, 20, 5))
  })

  it('ночью до 05:00 — вчера в 05:00', () => {
    expect(getGameDayStart(at(2026, 11, 21, 2, 30))).toEqual(at(2026, 11, 20, 5))
  })

  it('ровно в 05:00 — уже новый день', () => {
    expect(getGameDayStart(at(2026, 11, 21, 5))).toEqual(at(2026, 11, 21, 5))
  })

  it('переход через границу года', () => {
    expect(getGameDayStart(at(2027, 1, 1, 3))).toEqual(at(2026, 12, 31, 5))
  })
})

describe('getNextReset', () => {
  it('днём — завтра в 05:00', () => {
    expect(getNextReset(at(2026, 11, 20, 18))).toEqual(at(2026, 11, 21, 5))
  })

  it('ночью — сегодня в 05:00', () => {
    expect(getNextReset(at(2026, 11, 21, 2))).toEqual(at(2026, 11, 21, 5))
  })
})
