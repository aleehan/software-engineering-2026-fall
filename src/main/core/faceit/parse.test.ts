import { describe, expect, it } from 'vitest'
import { parseHistory, parseHistoryItem, parseMatchStats, parsePlayer } from './parse'

// Фрагменты настоящих ответов FACEIT (scripts/faceit-probe.mjs), сокращённые.
const ME = 'player-me'

const historyItem = {
  match_id: '1-f4438eca',
  game_id: 'cs2',
  game_mode: '5v5',
  teams: {
    faction1: { team_id: 't1', players: [{ player_id: ME }, { player_id: 'mate' }] },
    faction2: { team_id: 't2', players: [{ player_id: 'enemy' }] }
  },
  status: 'finished',
  started_at: 1795186371,
  finished_at: 1795188742,
  results: { winner: 'faction2', score: { faction2: 13, faction1: 10 } }
}

const stats = {
  rounds: [
    {
      round_stats: { Winner: 't2', Map: 'de_anubis', Rounds: '23', Score: '10 / 13' },
      teams: [
        {
          team_id: 't1',
          team_stats: { 'Final Score': '10' },
          players: [
            { player_id: ME, player_stats: { Kills: '18', Deaths: '15', ADR: '80.1' } },
            { player_id: 'mate', player_stats: { Kills: '9', Deaths: '20' } }
          ]
        },
        { team_id: 't2', players: [{ player_id: 'enemy', player_stats: { Kills: '25' } }] }
      ]
    }
  ]
}

describe('parsePlayer', () => {
  it('достаёт player_id, ник и SteamID из games.cs2', () => {
    expect(
      parsePlayer({
        player_id: 'cfceb917',
        nickname: '_aleehan',
        games: { cs2: { game_player_id: '76561199527644464', faceit_elo: 629 } }
      })
    ).toEqual({ playerId: 'cfceb917', nickname: '_aleehan', steamId64: '76561199527644464' })
  })

  it('null для ответа без player_id', () => {
    expect(parsePlayer({ errors: [] })).toBeNull()
  })
})

describe('parseHistoryItem', () => {
  it('поражение 10:13: счёт со стороны игрока, время из секунд в Date', () => {
    expect(parseHistoryItem(historyItem, ME)).toEqual({
      matchId: '1-f4438eca',
      finishedAt: new Date(1795188742 * 1000),
      gameMode: '5v5',
      ownScore: 10,
      oppScore: 13,
      result: 'loss'
    })
  })

  it('та же игра глазами соперника — победа 13:10', () => {
    expect(parseHistoryItem(historyItem, 'enemy')).toMatchObject({
      ownScore: 13,
      oppScore: 10,
      result: 'win'
    })
  })

  it('незавершённый матч и чужой матч отбрасываются', () => {
    expect(parseHistoryItem({ ...historyItem, status: 'cancelled' }, ME)).toBeNull()
    expect(parseHistoryItem(historyItem, 'stranger')).toBeNull()
  })

  it('parseHistory пропускает мусор в items', () => {
    expect(parseHistory({ items: [historyItem, null, { match_id: 1 }] }, ME)).toHaveLength(1)
    expect(parseHistory({ nope: true }, ME)).toEqual([])
  })
})

describe('parseMatchStats', () => {
  it('карта из round_stats.Map, K/D игрока из строк в числа', () => {
    expect(parseMatchStats(stats, ME)).toEqual({ map: 'de_anubis', kills: 18, deaths: 15 })
  })

  it('пустая статистика — все поля null', () => {
    expect(parseMatchStats({ rounds: [] }, ME)).toEqual({ map: null, kills: null, deaths: null })
  })
})
