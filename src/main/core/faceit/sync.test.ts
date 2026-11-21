import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'path'
import {
  insertMatch,
  listRecentMatches,
  openDatabase,
  updateSettings,
  type DatabaseHandle
} from '../db'
import { FaceitError, type FaceitApi } from './client'
import type { FaceitHistoryMatch, FaceitMatchStats } from './parse'
import { FaceitSync } from './sync'

const PLAYER = 'player-me'
const T0 = new Date(2026, 10, 20, 18, 0).getTime()

let handle: DatabaseHandle

// Фальшивый API: история и статистика задаются в тесте, вызовы считаются.
class FakeApi implements FaceitApi {
  history: FaceitHistoryMatch[] = []
  stats = new Map<string, FaceitMatchStats>()
  statsCalls = 0
  error: FaceitError | null = null

  async findPlayer(): Promise<never> {
    throw new Error('не используется')
  }
  async getHistory(): Promise<FaceitHistoryMatch[]> {
    if (this.error) throw this.error
    return this.history
  }
  async getMatchStats(matchId: string): Promise<FaceitMatchStats> {
    this.statsCalls++
    const s = this.stats.get(matchId)
    if (!s) throw new FaceitError('not-found', 'нет статистики')
    return s
  }
}

function faceitMatch(
  id: string,
  minutesAfterT0: number,
  result: 'win' | 'loss'
): FaceitHistoryMatch {
  return {
    matchId: id,
    finishedAt: new Date(T0 + minutesAfterT0 * 60_000),
    gameMode: '5v5',
    ownScore: result === 'win' ? 13 : 9,
    oppScore: result === 'win' ? 9 : 13,
    result
  }
}

let api: FakeApi
let sync: FaceitSync

beforeEach(() => {
  handle = openDatabase({ filePath: ':memory:', migrationsFolder: join(process.cwd(), 'drizzle') })
  updateSettings(handle.db, {
    faceitNickname: 'me',
    faceitPlayerId: PLAYER,
    faceitApiKey: 'key'
  })
  api = new FakeApi()
  sync = new FaceitSync({ db: handle.db, createClient: () => api })
})

afterEach(() => handle.close())

describe('FaceitSync', () => {
  it('новый FACEIT-матч без GSI-пары записывается и засчитывается', async () => {
    api.history = [faceitMatch('m1', 0, 'win')]
    api.stats.set('m1', { map: 'de_anubis', kills: 20, deaths: 11 })

    const result = await sync.sync()
    expect(result.added).toHaveLength(1)
    expect(listRecentMatches(handle.db)[0]).toMatchObject({
      source: 'faceit',
      faceitMatchId: 'm1',
      map: 'de_anubis',
      result: 'win',
      ownScore: 13,
      kills: 20
    })
  })

  it('FACEIT-матч, уже засчитанный GSI (та же карта, ±10 мин), не дублируется', async () => {
    insertMatch(handle.db, {
      finishedAt: new Date(T0 - 60_000),
      mode: 'competitive',
      map: 'de_anubis',
      steamId: 'steam',
      source: 'gsi'
    })
    api.history = [faceitMatch('m1', 0, 'loss')]
    api.stats.set('m1', { map: 'de_anubis', kills: 10, deaths: 18 })

    const result = await sync.sync()
    expect(result).toMatchObject({ added: [], linked: 1 })
    const all = listRecentMatches(handle.db)
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ source: 'gsi', faceitMatchId: 'm1', result: 'loss' })
  })

  it('GSI-катка на другой карте не склеивается с FACEIT-матчем', async () => {
    insertMatch(handle.db, {
      finishedAt: new Date(T0),
      mode: 'competitive',
      map: 'de_mirage',
      steamId: 'steam',
      source: 'gsi'
    })
    api.history = [faceitMatch('m1', 2, 'win')]
    api.stats.set('m1', { map: 'de_anubis', kills: 1, deaths: 1 })

    expect((await sync.sync()).added).toHaveLength(1)
    expect(listRecentMatches(handle.db)).toHaveLength(2)
  })

  it('повторная синхронизация ничего не дублирует и не ходит за статистикой снова', async () => {
    api.history = [faceitMatch('m1', 0, 'win'), faceitMatch('m2', 60, 'loss')]
    api.stats.set('m1', { map: 'de_nuke', kills: 1, deaths: 1 })
    api.stats.set('m2', { map: 'de_inferno', kills: 1, deaths: 1 })

    await sync.sync()
    const callsAfterFirst = api.statsCalls
    expect((await sync.sync()).added).toHaveLength(0)
    expect(api.statsCalls).toBe(callsAfterFirst)
    expect(listRecentMatches(handle.db)).toHaveLength(2)
  })

  it('без статистики матч всё равно засчитывается (карта неизвестна)', async () => {
    api.history = [faceitMatch('m1', 0, 'win')]
    expect((await sync.sync()).added[0]).toMatchObject({ map: 'неизвестна', kills: null })
  })

  it('неверный ключ — ошибка в статусе, база не меняется', async () => {
    api.error = new FaceitError('bad-key', 'нет')
    expect(await sync.sync()).toEqual({ added: [], linked: 0 })
    expect(sync.getStatus().lastError).toBe('bad-key')
    expect(listRecentMatches(handle.db)).toHaveLength(0)
  })

  it('без подключённого аккаунта ничего не делает', async () => {
    updateSettings(handle.db, { faceitPlayerId: null, faceitApiKey: null })
    api.history = [faceitMatch('m1', 0, 'win')]
    expect((await sync.sync()).added).toHaveLength(0)
  })
})
