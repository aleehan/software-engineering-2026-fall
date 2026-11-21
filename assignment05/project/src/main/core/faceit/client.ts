import {
  parseHistory,
  parseMatchStats,
  parsePlayer,
  type FaceitHistoryMatch,
  type FaceitMatchStats,
  type FaceitPlayer
} from './parse'

const BASE_URL = 'https://open.faceit.com/data/v4'
const TIMEOUT_MS = 15_000

/** Понятные причины ошибок — интерфейс показывает по ним текст. */
export type FaceitErrorCode = 'bad-key' | 'not-found' | 'rate-limited' | 'network' | 'unexpected'

export class FaceitError extends Error {
  // `extends Error` — свой класс ошибки; `code` позволяет различать причины без разбора текста.
  constructor(
    readonly code: FaceitErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'FaceitError'
  }
}

/** Тип функции fetch — чтобы в тестах подставить фальшивую. */
export type FetchFn = typeof fetch

/**
 * Что синхронизации нужно от клиента. Интерфейс, а не класс: у класса есть private-поля,
 * и TypeScript не дал бы подставить в тестах объект той же формы (сравнение «по имени»
 * для private), а интерфейс сравнивается только по форме.
 */
export interface FaceitApi {
  findPlayer(nickname: string): Promise<FaceitPlayer>
  getHistory(playerId: string, limit?: number): Promise<FaceitHistoryMatch[]>
  getMatchStats(matchId: string, playerId: string): Promise<FaceitMatchStats>
}

export class FaceitClient implements FaceitApi {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchFn = fetch
  ) {}

  async findPlayer(nickname: string): Promise<FaceitPlayer> {
    const raw = await this.get(`/players?nickname=${encodeURIComponent(nickname)}`)
    const player = parsePlayer(raw)
    if (!player) throw new FaceitError('unexpected', 'Неожиданный ответ FACEIT о игроке')
    return player
  }

  /** Последние завершённые матчи CS2 (до 100), новые сверху. */
  async getHistory(playerId: string, limit = 100): Promise<FaceitHistoryMatch[]> {
    const raw = await this.get(
      `/players/${encodeURIComponent(playerId)}/history?game=cs2&offset=0&limit=${limit}`
    )
    return parseHistory(raw, playerId)
  }

  async getMatchStats(matchId: string, playerId: string): Promise<FaceitMatchStats> {
    const raw = await this.get(`/matches/${encodeURIComponent(matchId)}/stats`)
    return parseMatchStats(raw, playerId)
  }

  private async get(path: string): Promise<unknown> {
    let response: Response
    try {
      response = await this.fetchFn(BASE_URL + path, {
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
        // AbortSignal.timeout — запрос сам оборвётся, если FACEIT не ответил за 15 с.
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
    } catch (error) {
      throw new FaceitError('network', error instanceof Error ? error.message : String(error))
    }

    if (response.status === 401 || response.status === 403) {
      throw new FaceitError('bad-key', 'FACEIT отклонил API-ключ')
    }
    // На неизвестный ключ FACEIT отвечает 400 {"error":"invalid_token"} (проверено вживую).
    if (response.status === 400) {
      const body: unknown = await response.json().catch(() => null)
      if (
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        body.error === 'invalid_token'
      ) {
        throw new FaceitError('bad-key', 'FACEIT не распознал API-ключ')
      }
    }
    if (response.status === 404) throw new FaceitError('not-found', 'Не найдено на FACEIT')
    if (response.status === 429) throw new FaceitError('rate-limited', 'Слишком много запросов')
    if (!response.ok) throw new FaceitError('unexpected', `FACEIT ответил ${response.status}`)

    try {
      return await response.json()
    } catch {
      throw new FaceitError('unexpected', 'FACEIT прислал не JSON')
    }
  }
}
