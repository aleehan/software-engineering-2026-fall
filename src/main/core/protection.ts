import {
  CLOSE_DELAY_MAX_SECONDS,
  LOOSENING_DELAY_MS,
  MATCH_LIMIT_MAX,
  MATCH_LIMIT_MIN,
  type ActionResult,
  type ProtectionError
} from '../../shared/protection'
import {
  cancelPendingOfKind,
  getSettings,
  listDueChanges,
  listPendingChanges,
  requestChange,
  setChangeStatus,
  updateSettings,
  type Db,
  type PendingChange,
  type PendingChangeKind
} from './db'
import { getNextReset } from './game-day'
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from './password'

/** Аккаунт FACEIT, как он хранится в настройках. */
export interface FaceitAccount {
  nickname: string
  playerId: string
  apiKey: string
}

export interface ProtectionOptions {
  db: Db
  delayMs?: number
  /** Источник времени. В тестах подменяем, чтобы «перематывать» часы. */
  now?: () => Date
}

// Маленький помощник: короче писать return fail('wrong-password').
const fail = (error: ProtectionError): ActionResult => ({ ok: false, error })

/**
 * Правила защиты:
 *  - ужесточение (меньше каток, меньше задержка, отмена ожидающего) — сразу и без пароля;
 *  - ослабление (больше каток, больше задержка, снятие блокировки, выход) — по паролю
 *    и только через delayMs (10 минут).
 */
export class ProtectionService {
  private readonly db: Db
  private readonly delayMs: number
  private readonly now: () => Date

  constructor(options: ProtectionOptions) {
    this.db = options.db
    this.delayMs = options.delayMs ?? LOOSENING_DELAY_MS
    this.now = options.now ?? (() => new Date())
  }

  hasPassword(): boolean {
    return getSettings(this.db).passwordHash !== null
  }

  /**
   * Первая настройка: пароль и (необязательно) лимит каток.
   * Лимит здесь применяется сразу в любую сторону — пока пароля нет, защищать нечего.
   * Если пароль уже есть — только через changePassword.
   */
  async setInitialPassword(password: string, matchLimit?: number): Promise<ActionResult> {
    if (this.hasPassword()) return fail('password-already-set')
    if (password.length < MIN_PASSWORD_LENGTH) return fail('password-too-short')
    if (
      matchLimit !== undefined &&
      (!Number.isInteger(matchLimit) ||
        matchLimit < MATCH_LIMIT_MIN ||
        matchLimit > MATCH_LIMIT_MAX)
    ) {
      return fail('invalid-value')
    }
    updateSettings(this.db, {
      passwordHash: await hashPassword(password),
      // Spread с условием: поле matchLimit добавится, только если лимит передан.
      ...(matchLimit !== undefined ? { matchLimit } : {})
    })
    return { ok: true, applied: 'now' }
  }

  async changePassword(current: string, next: string): Promise<ActionResult> {
    const check = await this.checkPassword(current)
    if (check) return check
    if (next.length < MIN_PASSWORD_LENGTH) return fail('password-too-short')
    updateSettings(this.db, { passwordHash: await hashPassword(next) })
    return { ok: true, applied: 'now' }
  }

  /** Лимит каток: меньше — сразу, больше — по паролю через задержку. */
  async setMatchLimit(value: number, password?: string): Promise<ActionResult> {
    if (!Number.isInteger(value) || value < MATCH_LIMIT_MIN || value > MATCH_LIMIT_MAX) {
      return fail('invalid-value')
    }
    const current = getSettings(this.db).matchLimit
    if (value === current) return fail('unchanged')

    if (value < current) {
      updateSettings(this.db, { matchLimit: value })
      // Передумал ослаблять — ожидающее повышение больше не нужно.
      cancelPendingOfKind(this.db, 'raise_limit')
      return { ok: true, applied: 'now' }
    }
    return this.requestLoosening('raise_limit', value, password)
  }

  /** Задержка закрытия (секунды): меньше — сразу, больше — по паролю через задержку. */
  async setCloseDelay(seconds: number, password?: string): Promise<ActionResult> {
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > CLOSE_DELAY_MAX_SECONDS) {
      return fail('invalid-value')
    }
    const current = getSettings(this.db).closeDelaySeconds
    if (seconds === current) return fail('unchanged')

    if (seconds < current) {
      updateSettings(this.db, { closeDelaySeconds: seconds })
      cancelPendingOfKind(this.db, 'raise_close_delay')
      return { ok: true, applied: 'now' }
    }
    return this.requestLoosening('raise_close_delay', seconds, password)
  }

  requestUnlock(password?: string): Promise<ActionResult> {
    return this.requestLoosening('unlock', null, password)
  }

  requestQuit(password?: string): Promise<ActionResult> {
    return this.requestLoosening('quit', null, password)
  }

  /**
   * Подключение FACEIT. Первое подключение — сразу (катки начинают считаться и из API,
   * это ужесточение). Смена аккаунта/ключа и отключение (account = null) — ослабление:
   * по паролю и через задержку, иначе можно подставить чужой ник и перестать считать свои матчи.
   * Аккаунт уже проверен через API вызывающим кодом (core не ходит в сеть сам по себе).
   */
  async setFaceitAccount(account: FaceitAccount | null, password?: string): Promise<ActionResult> {
    const current = getSettings(this.db)
    const connected = current.faceitPlayerId !== null
    if (!connected && account === null) return fail('unchanged')
    if (!connected && account !== null) {
      applyFaceitAccount(this.db, account)
      return { ok: true, applied: 'now' }
    }
    return this.requestLoosening('change_faceit', null, password, JSON.stringify(account))
  }

  /** Отмена ожидающего изменения — это ужесточение, пароль не нужен. */
  cancel(id: number): void {
    const change = listPendingChanges(this.db).find((c) => c.id === id)
    if (change) setChangeStatus(this.db, id, 'cancelled')
  }

  listPending(): PendingChange[] {
    return listPendingChanges(this.db)
  }

  /**
   * Вызывается при старте: запрос на выход из прошлого запуска уже не актуален
   * (приложение и так перезапустилось). Без этого после убийства процесса через
   * диспетчер задач автозапуск сразу закрыл бы приложение.
   */
  discardStaleQuitRequests(): void {
    cancelPendingOfKind(this.db, 'quit')
  }

  /**
   * Применяет изменения, у которых истекла задержка. Возвращает применённые —
   * вызывающий код сам решает, что делать с 'quit' (core не умеет закрывать приложение).
   */
  applyDue(): PendingChange[] {
    const now = this.now()
    const due = listDueChanges(this.db, now)

    for (const change of due) {
      // switch по полю-литералу: TS проверяет, что каждый case — допустимый вид.
      switch (change.kind) {
        case 'raise_limit':
          if (change.value !== null) updateSettings(this.db, { matchLimit: change.value })
          break
        case 'raise_close_delay':
          if (change.value !== null) updateSettings(this.db, { closeDelaySeconds: change.value })
          break
        case 'unlock':
          // Блокировка снята до ближайшего сброса в 05:00 — дальше обычные правила.
          updateSettings(this.db, { unlockedUntil: getNextReset(now) })
          break
        case 'quit':
          break // в базе менять нечего
        case 'change_faceit':
          applyFaceitAccount(this.db, parseFaceitAccount(change.textValue))
          break
      }
      setChangeStatus(this.db, change.id, 'applied')
    }
    return due
  }

  private async requestLoosening(
    kind: PendingChangeKind,
    value: number | null,
    password: string | undefined,
    textValue: string | null = null
  ): Promise<ActionResult> {
    const check = await this.checkPassword(password)
    if (check) return check

    // Новый запрос того же вида заменяет старый (и перезапускает отсчёт).
    cancelPendingOfKind(this.db, kind)
    const change = requestChange(this.db, {
      kind,
      value,
      textValue,
      requestedAt: this.now(),
      delayMs: this.delayMs
    })
    return { ok: true, applied: 'pending', applyAt: change.applyAfter.getTime() }
  }

  /** null — пароль верный; иначе — готовый результат с ошибкой. */
  private async checkPassword(password: string | undefined): Promise<ActionResult | null> {
    const hash = getSettings(this.db).passwordHash
    if (hash === null) return fail('password-not-set')
    if (!password || !(await verifyPassword(password, hash))) return fail('wrong-password')
    return null
  }
}

function applyFaceitAccount(db: Db, account: FaceitAccount | null): void {
  updateSettings(db, {
    faceitNickname: account?.nickname ?? null,
    faceitPlayerId: account?.playerId ?? null,
    faceitApiKey: account?.apiKey ?? null,
    faceitSyncedAt: null
  })
}

/** JSON из pending_changes.text_value → аккаунт (или null = отключить). */
function parseFaceitAccount(json: string | null): FaceitAccount | null {
  if (!json) return null
  try {
    const value: unknown = JSON.parse(json)
    if (
      typeof value === 'object' &&
      value !== null &&
      'nickname' in value &&
      'playerId' in value &&
      'apiKey' in value &&
      typeof value.nickname === 'string' &&
      typeof value.playerId === 'string' &&
      typeof value.apiKey === 'string'
    ) {
      return { nickname: value.nickname, playerId: value.playerId, apiKey: value.apiKey }
    }
  } catch {
    // битый JSON — считаем отключением
  }
  return null
}
