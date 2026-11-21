import { describe, expect, it } from 'vitest'
import { FaceitClient, FaceitError, type FetchFn } from './client'

// Фальшивый fetch: возвращает заданный статус и тело, запоминает запрос.
function fakeFetch(status: number, body: unknown): { fn: FetchFn; calls: Request[] } {
  const calls: Request[] = []
  const fn: FetchFn = async (input, init) => {
    calls.push(new Request(input, init))
    return new Response(JSON.stringify(body), { status })
  }
  return { fn, calls }
}

async function errorCode(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise
    return null
  } catch (error) {
    return error instanceof FaceitError ? error.code : 'not-faceit-error'
  }
}

describe('FaceitClient', () => {
  it('шлёт ключ в заголовке Authorization: Bearer', async () => {
    const { fn, calls } = fakeFetch(200, { player_id: 'p', nickname: 'n' })
    await new FaceitClient('secret', fn).findPlayer('n')
    expect(calls[0].headers.get('Authorization')).toBe('Bearer secret')
    expect(calls[0].url).toBe('https://open.faceit.com/data/v4/players?nickname=n')
  })

  it('400 invalid_token — неверный ключ (так FACEIT отвечает на самом деле)', async () => {
    const { fn } = fakeFetch(400, { error: 'invalid_token', error_description: 'x' })
    expect(await errorCode(new FaceitClient('bad', fn).findPlayer('n'))).toBe('bad-key')
  })

  it('коды ответа превращаются в понятные ошибки', async () => {
    expect(await errorCode(new FaceitClient('k', fakeFetch(401, {}).fn).findPlayer('n'))).toBe(
      'bad-key'
    )
    expect(await errorCode(new FaceitClient('k', fakeFetch(404, {}).fn).findPlayer('n'))).toBe(
      'not-found'
    )
    expect(await errorCode(new FaceitClient('k', fakeFetch(429, {}).fn).findPlayer('n'))).toBe(
      'rate-limited'
    )
    expect(await errorCode(new FaceitClient('k', fakeFetch(500, {}).fn).findPlayer('n'))).toBe(
      'unexpected'
    )
  })

  it('история запрашивается для cs2 с лимитом', async () => {
    const { fn, calls } = fakeFetch(200, { items: [] })
    await new FaceitClient('k', fn).getHistory('p 1', 50)
    expect(calls[0].url).toBe(
      'https://open.faceit.com/data/v4/players/p%201/history?game=cs2&offset=0&limit=50'
    )
  })
})
