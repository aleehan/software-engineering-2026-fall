import type { ProcessController } from './process-controller'
import type { RulesState, RulesStatus } from './rules-engine'

export const CS2_PROCESS = 'cs2.exe'

/** Почему игра была закрыта — для текста уведомления. */
export type KillReason = 'limit-reached' | 'blocked-launch' | 'new-match-after-limit'

export interface EnforcerDeps {
  processes: ProcessController
  /** Текущее состояние правил (лимит, статус). */
  getRules: () => RulesState
  /** Идёт ли сейчас матч по свежим данным GSI. */
  isInMatch: () => boolean
  /** Ключ текущего матча (MatchCounter.currentMatchKey). */
  getMatchKey: () => number | null
  onKilled?: (reason: KillReason) => void
  onError?: (error: unknown) => void
}

/**
 * Следит за cs2.exe и закрывает её по правилам:
 *
 *  allowed  → ничего не делаем;
 *  grace    → ждём closeAt, но если начался НОВЫЙ матч — закрываем сразу
 *             (иначе за время ожидания можно найти ещё одну игру);
 *  blocked  → закрываем при любом запуске.
 *
 * Исключение «посреди матча не закрывать» действует только для матча, который
 * уже шёл в момент, когда статус сменился с allowed (лимит ужесточили вручную).
 */
export class Enforcer {
  private timer: NodeJS.Timeout | null = null
  private previousStatus: RulesStatus | null = null
  /** Матч, который разрешено доиграть. null — такого нет. */
  private protectedMatchKey: number | null = null
  /** Защита от параллельных tick: пока идёт проверка, новую не начинаем. */
  private ticking = false

  constructor(private readonly deps: EnforcerDeps) {}

  start(intervalMs = 3000): void {
    void this.tick()
    this.timer = setInterval(() => void this.tick(), intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Одна проверка. Публичная — чтобы вызвать сразу после засчитанной катки и в тестах. */
  async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      await this.check()
    } catch (error) {
      this.deps.onError?.(error)
    } finally {
      // finally выполняется всегда — и после return, и после исключения.
      this.ticking = false
    }
  }

  private async check(): Promise<void> {
    const rules = this.deps.getRules()
    const inMatch = this.deps.isInMatch()
    const matchKey = inMatch ? this.deps.getMatchKey() : null

    // Переход allowed → (grace | blocked): запоминаем матч, который шёл в этот момент.
    if (rules.status !== 'allowed' && this.previousStatus === 'allowed') {
      this.protectedMatchKey = matchKey
    }
    if (rules.status === 'allowed') this.protectedMatchKey = null
    const wasStatus = this.previousStatus
    this.previousStatus = rules.status

    if (rules.status === 'allowed') return

    const playingProtectedMatch =
      inMatch && matchKey !== null && matchKey === this.protectedMatchKey
    if (playingProtectedMatch) return

    let reason: KillReason
    if (rules.status === 'grace') {
      // В grace закрываем только если начался новый матч.
      if (!inMatch) return
      reason = 'new-match-after-limit'
    } else {
      // Только что перешли в blocked из allowed/grace — значит, лимит исчерпан прямо сейчас.
      // Иначе (уже были в blocked или приложение только запустилось) — это запуск во время блокировки.
      reason = wasStatus === 'allowed' || wasStatus === 'grace' ? 'limit-reached' : 'blocked-launch'
    }

    if (!(await this.deps.processes.isRunning(CS2_PROCESS))) return
    await this.deps.processes.kill(CS2_PROCESS)
    this.deps.onKilled?.(reason)
  }
}
