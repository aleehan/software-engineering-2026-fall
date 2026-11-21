import { ipcMain } from 'electron'
import { IpcChannels, type ProtectionState } from '../shared/ipc'
import type { ActionResult } from '../shared/protection'
import { getSettings, type Db } from './core/db'
import type { ProtectionService } from './core/protection'

// Всё, что приходит из renderer, — `unknown`: проверяем тип, прежде чем передать в core.
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number'
const optionalString = (v: unknown): string | undefined => (isString(v) ? v : undefined)

const INVALID: ActionResult = { ok: false, error: 'invalid-value' }

export function registerProtectionIpc(
  db: Db,
  protection: ProtectionService,
  /** Вызывается после любого изменения, которое может повлиять на блокировку. */
  onChanged: () => void
): void {
  ipcMain.handle(IpcChannels.getProtectionState, (): ProtectionState => {
    const settings = getSettings(db)
    return {
      hasPassword: settings.passwordHash !== null,
      matchLimit: settings.matchLimit,
      closeDelaySeconds: settings.closeDelaySeconds,
      pending: protection.listPending().map((c) => ({
        id: c.id,
        kind: c.kind,
        value: c.value,
        faceitNickname: c.kind === 'change_faceit' ? faceitNicknameFromJson(c.textValue) : null,
        applyAt: c.applyAfter.getTime()
      }))
    }
  })

  // Обёртка: выполнить действие и сообщить об изменении (даже если оно не удалось — не страшно).
  async function withChange<T>(action: () => Promise<T> | T): Promise<T> {
    const result = await action()
    onChanged()
    return result
  }

  ipcMain.handle(IpcChannels.setInitialPassword, (_e, password: unknown, limit: unknown) => {
    if (!isString(password) || (limit !== undefined && !isNumber(limit))) return INVALID
    return withChange(() => protection.setInitialPassword(password, limit))
  })

  ipcMain.handle(IpcChannels.changePassword, (_e, current: unknown, next: unknown) =>
    isString(current) && isString(next) ? protection.changePassword(current, next) : INVALID
  )

  ipcMain.handle(IpcChannels.setMatchLimit, (_e, value: unknown, password: unknown) =>
    isNumber(value)
      ? withChange(() => protection.setMatchLimit(value, optionalString(password)))
      : INVALID
  )

  ipcMain.handle(IpcChannels.setCloseDelay, (_e, seconds: unknown, password: unknown) =>
    isNumber(seconds)
      ? withChange(() => protection.setCloseDelay(seconds, optionalString(password)))
      : INVALID
  )

  ipcMain.handle(IpcChannels.requestUnlock, (_e, password: unknown) =>
    withChange(() => protection.requestUnlock(optionalString(password)))
  )

  ipcMain.handle(IpcChannels.requestQuit, (_e, password: unknown) =>
    withChange(() => protection.requestQuit(optionalString(password)))
  )

  ipcMain.handle(IpcChannels.cancelPending, (_e, id: unknown) =>
    withChange(() => {
      if (isNumber(id)) protection.cancel(id)
    })
  )
}

/** Только никнейм из JSON отложенной смены FACEIT — ключ в интерфейс не отдаём. */
function faceitNicknameFromJson(json: string | null): string | null {
  if (!json) return null
  try {
    const value: unknown = JSON.parse(json)
    return typeof value === 'object' &&
      value !== null &&
      'nickname' in value &&
      typeof value.nickname === 'string'
      ? value.nickname
      : null
  } catch {
    return null
  }
}
