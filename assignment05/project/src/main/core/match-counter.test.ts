import { describe, expect, it } from 'vitest'
import { MatchCounter } from './match-counter'
import type { GsiPayload } from './games/cs2/gsi-payload'

const ME = '76561190000000001'
const TEAMMATE = '76561190000000002'

// Фабрика сообщений: задаём только то, что важно в конкретном тесте.
// Параметр со значением по умолчанию `= {}` и деструктуризацией.
function payload({
  phase = 'live',
  mode = 'competitive',
  map = 'de_dust2',
  player = ME,
  team = 'CT' as string | null,
  inMenu = false
} = {}): GsiPayload {
  return {
    token: 'x',
    provider: { appid: 730, steamid: ME },
    map: inMenu ? undefined : { name: map, mode, phase, ctScore: 13, tScore: 7 },
    player: { steamid: player, team, activity: 'playing' }
  }
}

describe('MatchCounter', () => {
  it('засчитывает катку на переходе live → gameover', () => {
    const counter = new MatchCounter()
    expect(counter.update(payload({ phase: 'warmup' }))).toBeNull()
    expect(counter.update(payload({ phase: 'live' }))).toBeNull()

    const result = counter.update(payload({ phase: 'gameover' }))
    expect(result).toMatchObject({ map: 'de_dust2', mode: 'competitive', steamId: ME, ctScore: 13 })
  })

  it('не засчитывает повторный gameover (heartbeat)', () => {
    const counter = new MatchCounter()
    counter.update(payload({ phase: 'live' }))
    expect(counter.update(payload({ phase: 'gameover' }))).not.toBeNull()
    expect(counter.update(payload({ phase: 'gameover' }))).toBeNull()
    expect(counter.update(payload({ phase: 'gameover' }))).toBeNull()
  })

  it('не засчитывает, если приложение запустилось уже на экране gameover', () => {
    const counter = new MatchCounter()
    expect(counter.update(payload({ phase: 'gameover' }))).toBeNull()
  })

  it('засчитывает, даже если в момент gameover игрок наблюдает за тиммейтом', () => {
    const counter = new MatchCounter()
    counter.update(payload({ phase: 'live' }))
    counter.update(payload({ phase: 'live', player: TEAMMATE }))
    expect(counter.update(payload({ phase: 'gameover', player: TEAMMATE }))).not.toBeNull()
  })

  it('не засчитывает просмотр чужого матча (игрок ни разу не был собой)', () => {
    const counter = new MatchCounter()
    counter.update(payload({ phase: 'live', player: TEAMMATE }))
    expect(counter.update(payload({ phase: 'gameover', player: TEAMMATE }))).toBeNull()
  })

  it('не засчитывает, если игрок был без команды (наблюдатель)', () => {
    const counter = new MatchCounter()
    counter.update(payload({ phase: 'live', team: null }))
    expect(counter.update(payload({ phase: 'gameover', team: null }))).toBeNull()
  })

  // it.each прогоняет один тест для каждого значения из массива.
  it.each(['casual', 'deathmatch', 'gungameprogressive', 'custom'])(
    'не засчитывает режим %s',
    (mode) => {
      const counter = new MatchCounter()
      counter.update(payload({ phase: 'live', mode }))
      expect(counter.update(payload({ phase: 'gameover', mode }))).toBeNull()
    }
  )

  it.each(['competitive', 'premier', 'scrimcomp2v2'])('засчитывает режим %s', (mode) => {
    const counter = new MatchCounter()
    counter.update(payload({ phase: 'live', mode }))
    expect(counter.update(payload({ phase: 'gameover', mode }))).not.toBeNull()
  })

  it('выход в меню сбрасывает матч', () => {
    const counter = new MatchCounter()
    counter.update(payload({ phase: 'live' }))
    counter.update(payload({ inMenu: true }))
    // Без промежуточной live-фазы после меню gameover не засчитывается.
    expect(counter.update(payload({ phase: 'gameover' }))).toBeNull()
  })

  it('смена карты начинает новый матч', () => {
    const counter = new MatchCounter()
    counter.update(payload({ phase: 'live', map: 'de_dust2' }))
    expect(counter.update(payload({ phase: 'gameover', map: 'de_mirage' }))).toBeNull()
  })

  it('две катки подряд — две записи', () => {
    const counter = new MatchCounter()
    counter.update(payload({ phase: 'live' }))
    expect(counter.update(payload({ phase: 'gameover' }))).not.toBeNull()
    counter.update(payload({ inMenu: true }))
    counter.update(payload({ phase: 'warmup' }))
    counter.update(payload({ phase: 'live' }))
    expect(counter.update(payload({ phase: 'gameover' }))).not.toBeNull()
  })

  it('новый матч на той же карте после gameover засчитывается отдельно', () => {
    const counter = new MatchCounter()
    counter.update(payload({ phase: 'live' }))
    expect(counter.update(payload({ phase: 'gameover' }))).not.toBeNull()
    const firstKey = counter.currentMatchKey
    counter.update(payload({ phase: 'warmup' }))
    expect(counter.currentMatchKey).not.toBe(firstKey)
    counter.update(payload({ phase: 'live' }))
    expect(counter.update(payload({ phase: 'gameover' }))).not.toBeNull()
  })

  it('currentMatchKey: null в меню, одинаковый в пределах матча', () => {
    const counter = new MatchCounter()
    expect(counter.currentMatchKey).toBeNull()
    counter.update(payload({ phase: 'warmup' }))
    const key = counter.currentMatchKey
    counter.update(payload({ phase: 'live' }))
    expect(counter.currentMatchKey).toBe(key)
    counter.update(payload({ inMenu: true }))
    expect(counter.currentMatchKey).toBeNull()
  })

  it('playerTeam — сторона игрока после смены сторон, а не в начале матча', () => {
    const counter = new MatchCounter()
    counter.update(payload({ phase: 'live', team: 'CT' }))
    counter.update(payload({ phase: 'live', team: 'T' })) // вторая половина
    counter.update(payload({ phase: 'live', player: TEAMMATE, team: 'T' })) // умер, смотрит тиммейта
    expect(counter.update(payload({ phase: 'gameover', team: 'T' }))?.playerTeam).toBe('T')
  })

  it('isInMatch: true в warmup/live/intermission, false в gameover и меню', () => {
    const counter = new MatchCounter()
    expect(counter.isInMatch()).toBe(false)
    counter.update(payload({ phase: 'warmup' }))
    expect(counter.isInMatch()).toBe(true)
    counter.update(payload({ phase: 'intermission' }))
    expect(counter.isInMatch()).toBe(true)
    counter.update(payload({ phase: 'gameover' }))
    expect(counter.isInMatch()).toBe(false)
    counter.update(payload({ inMenu: true }))
    expect(counter.isInMatch()).toBe(false)
  })
})
