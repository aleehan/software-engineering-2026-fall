import { ipcMain } from 'electron'
import { IpcChannels, type FaceitState } from '../shared/ipc'
import type { ActionResult } from '../shared/protection'
import { getSettings, type Db } from './core/db'
import { FaceitClient, FaceitError } from './core/faceit/client'
import type { FaceitSync } from './core/faceit/sync'
import type { ProtectionService } from './core/protection'

const isString = (v: unknown): v is string => typeof v === 'string'
const INVALID: ActionResult = { ok: false, error: 'invalid-value' }

export interface FaceitIpcDeps {
  db: Db
  protection: ProtectionService
  sync: FaceitSync
  /** Запустить синхронизацию и обработать её результат (уведомления, enforcer). */
  runSync: () => Promise<void>
  onChanged: () => void
}

export function registerFaceitIpc({
  db,
  protection,
  sync,
  runSync,
  onChanged
}: FaceitIpcDeps): void {
  ipcMain.handle(IpcChannels.getFaceitState, (): FaceitState => {
    const settings = getSettings(db)
    const status = sync.getStatus()
    return {
      connected: settings.faceitPlayerId !== null,
      nickname: settings.faceitNickname,
      syncedAt: settings.faceitSyncedAt?.getTime() ?? null,
      syncing: status.syncing,
      lastError: status.lastError
    }
  })

  ipcMain.handle(
    IpcChannels.connectFaceit,
    async (_e, nickname: unknown, apiKey: unknown, password: unknown): Promise<ActionResult> => {
      if (!isString(nickname) || !isString(apiKey)) return INVALID
      const nick = nickname.trim()
      const key = apiKey.trim()
      if (!nick || !key) return INVALID

      // Проверяем ник и ключ настоящим запросом: заодно узнаём player_id.
      let playerId: string
      let canonicalNickname: string
      try {
        const player = await new FaceitClient(key).findPlayer(nick)
        playerId = player.playerId
        canonicalNickname = player.nickname
      } catch (error) {
        const code = error instanceof FaceitError ? error.code : 'unexpected'
        return {
          ok: false,
          error:
            code === 'bad-key'
              ? 'faceit-bad-key'
              : code === 'not-found'
                ? 'faceit-not-found'
                : 'faceit-unavailable'
        }
      }

      const result = await protection.setFaceitAccount(
        { nickname: canonicalNickname, playerId, apiKey: key },
        isString(password) ? password : undefined
      )
      onChanged()
      // Подключили сразу — подтягиваем историю, не дожидаясь таймера.
      if (result.ok && result.applied === 'now') void runSync()
      return result
    }
  )

  ipcMain.handle(IpcChannels.disconnectFaceit, async (_e, password: unknown) => {
    const result = await protection.setFaceitAccount(
      null,
      isString(password) ? password : undefined
    )
    onChanged()
    return result
  })

  ipcMain.handle(IpcChannels.syncFaceit, () => runSync())
}
