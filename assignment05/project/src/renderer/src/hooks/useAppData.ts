import { useCallback, useEffect, useState } from 'react'
import type {
  AppInfo,
  Cs2Status,
  FaceitState,
  MatchRecord,
  ProtectionState,
  TodayStatus
} from '../../../shared/ipc'

/** Всё, что показывают экраны, одним объектом. */
export interface AppData {
  info: AppInfo
  today: TodayStatus
  cs2: Cs2Status
  protection: ProtectionState
  matches: MatchRecord[]
  faceit: FaceitState
}

async function fetchAll(): Promise<AppData> {
  const api = window.gamekeeper
  // Деструктуризация результата Promise.all: порядок совпадает с порядком запросов.
  const [info, today, cs2, protection, matches, faceit] = await Promise.all([
    api.getAppInfo(),
    api.getTodayStatus(),
    api.getCs2Status(),
    api.getProtectionState(),
    api.getRecentMatches(200),
    api.getFaceitState()
  ])
  return { info, today, cs2, protection, matches, faceit }
}

/**
 * Собственный хук: загружает данные при монтировании и перезагружает,
 * когда main присылает событие stateChanged. Возвращает данные и функцию reload.
 */
export function useAppData(): { data: AppData | null; reload: () => Promise<void> } {
  const [data, setData] = useState<AppData | null>(null)

  const reload = useCallback(async () => {
    setData(await fetchAll())
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      const next = await fetchAll()
      if (!cancelled) setData(next)
    }
    void load()
    // onStateChanged возвращает функцию отписки — отдаём её React как «уборку».
    const unsubscribe = window.gamekeeper.onStateChanged(() => void load())
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return { data, reload }
}
