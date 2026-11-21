import { describe, expect, it } from 'vitest'
import { parseGsiPayload } from './gsi-payload'

describe('parseGsiPayload', () => {
  it('разбирает типичное сообщение CS2', () => {
    const result = parseGsiPayload({
      provider: { name: 'Counter-Strike 2', appid: 730, steamid: '7656', timestamp: 1 },
      map: {
        mode: 'competitive',
        name: 'de_inferno',
        phase: 'live',
        team_ct: { score: 4 },
        team_t: { score: 6 }
      },
      player: { steamid: '7656', team: 'T', activity: 'playing' },
      auth: { token: 'tok' }
    })
    expect(result).toEqual({
      token: 'tok',
      provider: { appid: 730, steamid: '7656' },
      map: { mode: 'competitive', name: 'de_inferno', phase: 'live', ctScore: 4, tScore: 6 },
      player: { steamid: '7656', team: 'T', activity: 'playing' }
    })
  })

  it('сообщение из главного меню — без map', () => {
    const result = parseGsiPayload({
      provider: { appid: 730, steamid: '7656' },
      player: { steamid: '7656', activity: 'menu' },
      auth: { token: 'tok' }
    })
    expect(result?.map).toBeUndefined()
    expect(result?.player?.team).toBeNull()
  })

  it.each([null, 42, 'str', [1, 2]])('возвращает null для %j', (raw) => {
    expect(parseGsiPayload(raw)).toBeNull()
  })

  it('игнорирует поля неверного типа', () => {
    const result = parseGsiPayload({ map: { mode: 1, name: 'x', phase: 'live' }, auth: {} })
    expect(result).toEqual({ token: null })
  })
})
