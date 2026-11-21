// Risk probes for Assignment #05 (Task #04 evidence).
// These tests describe the CURRENT behaviour of the reviewed version.
// They are kept outside src/ on purpose: they are audit evidence, not product tests.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'path'
import { getSettings, openDatabase, type DatabaseHandle } from '../../src/main/core/db'
import { ProtectionService } from '../../src/main/core/protection'

let handle: DatabaseHandle
let clock: Date
let service: ProtectionService
const MINUTE = 60_000

beforeEach(async () => {
  handle = openDatabase({ filePath: ':memory:', migrationsFolder: join(process.cwd(), 'drizzle') })
  clock = new Date(2026, 10, 20, 18, 0)
  service = new ProtectionService({ db: handle.db, now: () => clock })
  await service.setInitialPassword('1234')
})

afterEach(() => handle.close())

describe('PROBE R-02: password guessing', () => {
  it('30 wrong guesses in a row are all evaluated, the 31st (correct) one is accepted', async () => {
    const results: string[] = []
    for (let i = 0; i < 30; i++) {
      const r = await service.requestUnlock(String(1000 + i)) // never equals '1234'
      results.push(r.ok ? 'ok' : r.error)
    }
    // Every guess is answered with 'wrong-password' — there is no lockout state.
    expect(new Set(results)).toEqual(new Set(['wrong-password']))
    const last = await service.requestUnlock('1234')
    expect(last.ok).toBe(true)
  })
})

describe('PROBE R-01: wall-clock jump skips the 10-minute delay', () => {
  it('moving the system clock forward 10 minutes applies a pending raise immediately', async () => {
    await service.setMatchLimit(10, '1234')
    expect(getSettings(handle.db).matchLimit).toBe(3)
    // Simulates the user changing Windows time; no real time has passed.
    clock = new Date(clock.getTime() + 10 * MINUTE)
    service.applyDue()
    expect(getSettings(handle.db).matchLimit).toBe(10)
  })
})

// ── Probes added while verifying the AI review (C4, C5) ──
import { sql } from 'drizzle-orm'
import { Enforcer } from '../../src/main/core/enforcer'

describe('PROBE C4: FACEIT key copied into pending_changes', () => {
  it('a requested account change stores the API key in plain text', async () => {
    await service.setFaceitAccount({ nickname: 'a', playerId: 'p1', apiKey: 'test-key-1' })
    await service.setFaceitAccount({ nickname: 'b', playerId: 'p2', apiKey: 'test-key-2' }, '1234')
    const rows = handle.db.all<{ text_value: string }>(sql`SELECT text_value FROM pending_changes`)
    expect(rows[0].text_value).toContain('test-key-2')
    expect(getSettings(handle.db).faceitApiKey).toBe('test-key-1')
  })
})

describe('PROBE C5: enforcer when tasklist fails', () => {
  it('a failing isRunning() is only reported to onError, cs2 is never killed', async () => {
    const errors: unknown[] = []
    let killed = 0
    const enforcer = new Enforcer({
      processes: {
        isRunning: async () => {
          throw new Error('tasklist not found')
        },
        kill: async () => {
          killed++
        }
      },
      getRules: () => ({ status: 'blocked' }) as never,
      isInMatch: () => false,
      getMatchKey: () => null,
      onError: (e) => errors.push(e)
    })
    for (let i = 0; i < 3; i++) await enforcer.tick()
    expect(killed).toBe(0)
    expect(errors).toHaveLength(3)
  })
})
