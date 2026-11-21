import {
  findMatchByFaceitId,
  findUnlinkedGsiMatchesNear,
  getSettings,
  insertMatch,
  updateMatch,
  updateSettings,
  type Db,
  type Match
} from '../db'
import { FaceitClient, FaceitError, type FaceitApi, type FaceitErrorCode } from './client'
import type { FaceitMatchStats } from './parse'

/** GSI-катка и FACEIT-матч считаются одной каткой, если закончились в пределах этого окна. */
export const MERGE_WINDOW_MS = 10 * 60 * 1000

export interface FaceitSyncStatus {
  syncing: boolean
  lastError: FaceitErrorCode | null
}

export interface SyncResult {
  /** Новые записи (матчи, которые GSI не засчитал) — они только что попали в лимит. */
  added: Match[]
  /** Сколько GSI-записей получили данные FACEIT. */
  linked: number
}

export interface FaceitSyncOptions {
  db: Db
  /** Фабрика клиента — в тестах подставляется фальшивый. */
  createClient?: (apiKey: string) => FaceitApi
  log?: (message: string) => void
  now?: () => Date
}

/**
 * Подтягивает историю FACEIT и сводит её с катками, засчитанными через GSI:
 *  - матч уже есть по faceit_match_id → пропускаем;
 *  - есть GSI-катка на той же карте ±10 минут → дописываем к ней данные FACEIT;
 *  - иначе → новая запись (source 'faceit'), она тоже идёт в лимит.
 */
export class FaceitSync {
  private status: FaceitSyncStatus = { syncing: false, lastError: null }
  private readonly createClient: (apiKey: string) => FaceitApi
  private readonly log: (message: string) => void
  private readonly now: () => Date

  constructor(private readonly options: FaceitSyncOptions) {
    this.createClient = options.createClient ?? ((key) => new FaceitClient(key))
    this.log = options.log ?? (() => {})
    this.now = options.now ?? (() => new Date())
  }

  getStatus(): FaceitSyncStatus {
    return { ...this.status }
  }

  async sync(): Promise<SyncResult> {
    const empty: SyncResult = { added: [], linked: 0 }
    const { db } = this.options
    const settings = getSettings(db)
    if (!settings.faceitApiKey || !settings.faceitPlayerId) return empty
    if (this.status.syncing) return empty // предыдущая синхронизация ещё идёт

    this.status.syncing = true
    try {
      const client = this.createClient(settings.faceitApiKey)
      const playerId = settings.faceitPlayerId
      const history = await client.getHistory(playerId)

      const result: SyncResult = { added: [], linked: 0 }
      // История приходит новыми сверху; обрабатываем от старых к новым,
      // чтобы id записей шли в хронологическом порядке. [...arr] — копия, reverse её меняет.
      for (const item of [...history].reverse()) {
        if (findMatchByFaceitId(db, item.matchId)) continue

        const stats = await this.statsOrEmpty(client, item.matchId, playerId)
        const faceitFields = {
          faceitMatchId: item.matchId,
          ownScore: item.ownScore,
          oppScore: item.oppScore,
          result: item.result,
          kills: stats.kills,
          deaths: stats.deaths
        }

        const gsiTwin = findUnlinkedGsiMatchesNear(db, item.finishedAt, MERGE_WINDOW_MS).find(
          (m) => stats.map === null || m.map === stats.map
        )
        if (gsiTwin) {
          updateMatch(db, gsiTwin.id, faceitFields)
          result.linked++
          continue
        }

        result.added.push(
          insertMatch(db, {
            ...faceitFields,
            finishedAt: item.finishedAt,
            mode: 'faceit',
            map: stats.map ?? 'неизвестна',
            steamId: `faceit:${playerId}`,
            source: 'faceit'
          })
        )
      }

      updateSettings(db, { faceitSyncedAt: this.now() })
      this.status.lastError = null
      if (result.added.length || result.linked) {
        this.log(`FACEIT: новых ${result.added.length}, привязано к GSI ${result.linked}`)
      }
      return result
    } catch (error) {
      this.status.lastError = error instanceof FaceitError ? error.code : 'unexpected'
      this.log(`FACEIT: ошибка синхронизации — ${error instanceof Error ? error.message : error}`)
      return empty
    } finally {
      this.status.syncing = false
    }
  }

  /** Статистика (карта, K/D) не обязательна: если запрос не удался, запишем матч без неё. */
  private async statsOrEmpty(
    client: FaceitApi,
    matchId: string,
    playerId: string
  ): Promise<FaceitMatchStats> {
    try {
      return await client.getMatchStats(matchId, playerId)
    } catch (error) {
      // Неверный ключ или лимит запросов — общая проблема, пусть прервёт синхронизацию.
      if (
        error instanceof FaceitError &&
        (error.code === 'bad-key' || error.code === 'rate-limited')
      ) {
        throw error
      }
      return { map: null, kills: null, deaths: null }
    }
  }
}
