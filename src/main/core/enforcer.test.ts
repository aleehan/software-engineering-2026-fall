import { beforeEach, describe, expect, it } from 'vitest'
import { Enforcer, type KillReason } from './enforcer'
import type { ProcessController } from './process-controller'
import type { RulesState, RulesStatus } from './rules-engine'

// Фальшивый контроллер процессов: «процесс» — просто флаг в памяти.
class FakeProcesses implements ProcessController {
  running = false
  kills = 0
  async isRunning(): Promise<boolean> {
    return this.running
  }
  async kill(): Promise<void> {
    this.kills++
    this.running = false
  }
}

function rules(status: RulesStatus): RulesState {
  return {
    status,
    matchesToday: 0,
    limit: 1,
    remaining: 0,
    closeAt: null,
    dayStartedAt: new Date(),
    nextResetAt: new Date(),
    unlockedUntil: null
  }
}

// Изменяемое «окружение», которое enforcer читает через колбэки.
let processes: FakeProcesses
let status: RulesStatus
let inMatch: boolean
let matchKey: number | null
let killed: KillReason[]
let enforcer: Enforcer

beforeEach(() => {
  processes = new FakeProcesses()
  status = 'allowed'
  inMatch = false
  matchKey = null
  killed = []
  enforcer = new Enforcer({
    processes,
    getRules: () => rules(status),
    isInMatch: () => inMatch,
    getMatchKey: () => matchKey,
    onKilled: (reason) => killed.push(reason)
  })
})

describe('Enforcer', () => {
  it('ничего не трогает, пока игра разрешена', async () => {
    processes.running = true
    inMatch = true
    matchKey = 1
    await enforcer.tick()
    expect(processes.kills).toBe(0)
  })

  it('закрывает CS2 на экране итогов, когда лимит исчерпан', async () => {
    processes.running = true
    inMatch = true
    matchKey = 1
    await enforcer.tick() // allowed, идёт матч

    inMatch = false // gameover
    status = 'blocked'
    await enforcer.tick()
    expect(killed).toEqual(['limit-reached'])
  })

  it('закрывает CS2 при запуске во время блокировки', async () => {
    status = 'blocked'
    await enforcer.tick() // игра не запущена — ничего
    expect(processes.kills).toBe(0)

    processes.running = true
    await enforcer.tick()
    expect(killed).toEqual(['blocked-launch'])
  })

  it('в grace закрывает, если начался новый матч', async () => {
    processes.running = true
    await enforcer.tick() // allowed, в меню
    status = 'grace'
    await enforcer.tick() // ждём closeAt, в меню — не закрываем
    expect(processes.kills).toBe(0)

    inMatch = true
    matchKey = 2
    await enforcer.tick()
    expect(killed).toEqual(['new-match-after-limit'])
  })

  it('даёт доиграть матч, шедший в момент ужесточения лимита, и закрывает после', async () => {
    processes.running = true
    inMatch = true
    matchKey = 5
    await enforcer.tick() // allowed

    status = 'blocked' // лимит понизили посреди матча
    await enforcer.tick()
    await enforcer.tick()
    expect(processes.kills).toBe(0)

    inMatch = false // матч закончился
    await enforcer.tick()
    expect(processes.kills).toBe(1)
  })

  it('защита не распространяется на следующий матч', async () => {
    processes.running = true
    inMatch = true
    matchKey = 5
    await enforcer.tick()
    status = 'blocked'
    await enforcer.tick()
    expect(processes.kills).toBe(0)

    matchKey = 6 // сразу новый матч
    await enforcer.tick()
    expect(processes.kills).toBe(1)
  })

  it('при старте приложения во время блокировки матч не защищён', async () => {
    status = 'blocked'
    processes.running = true
    inMatch = true
    matchKey = 1
    await enforcer.tick()
    expect(killed).toEqual(['blocked-launch'])
  })
})
