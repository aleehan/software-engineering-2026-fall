import { describe, expect, it } from 'vitest'
import { ownScoreFromSides, resultFromScore } from './match-result'

describe('ownScoreFromSides', () => {
  it('игрок за CT: свой счёт — CT', () => {
    expect(ownScoreFromSides('CT', 13, 9)).toEqual({ ownScore: 13, oppScore: 9, result: 'win' })
  })

  it('игрок за T: свой счёт — T', () => {
    expect(ownScoreFromSides('T', 13, 9)).toEqual({ ownScore: 9, oppScore: 13, result: 'loss' })
  })

  it('сторона неизвестна — счёт и итог неизвестны', () => {
    expect(ownScoreFromSides(null, 13, 9)).toEqual({ ownScore: null, oppScore: null, result: null })
  })
})

describe('resultFromScore', () => {
  it('ничья', () => {
    expect(resultFromScore(12, 12)).toBe('draw')
  })
})
