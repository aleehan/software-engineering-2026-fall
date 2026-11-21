// Типы и разбор JSON, который CS2 присылает через Game State Integration.
// Описываем только поля, которые нам нужны. Пример (сокращённо):
//
// {
//   "provider": { "appid": 730, "steamid": "7656119...", "timestamp": 1700000000 },
//   "map": { "mode": "competitive", "name": "de_dust2", "phase": "live",
//            "team_ct": { "score": 7 }, "team_t": { "score": 5 } },
//   "player": { "steamid": "7656119...", "team": "CT", "activity": "playing" },
//   "auth": { "token": "..." }
// }

/** Фазы карты. `(string & {})` — трюк: подсказки для известных значений, но допускаются и другие строки. */
export type MapPhase = 'warmup' | 'live' | 'intermission' | 'gameover' | (string & {})

export interface GsiPayload {
  provider?: { appid: number; steamid: string }
  map?: {
    mode: string
    name: string
    phase: MapPhase
    ctScore: number | null
    tScore: number | null
  }
  player?: { steamid: string; team: string | null; activity: string | null }
  token: string | null
}

// ── Помощники для разбора `unknown` ──────────────────────────────────
// JSON.parse возвращает `any`, но честнее считать его `unknown`:
// TS не даст обратиться к полям, пока мы не проверим тип. Функции ниже
// — «type guards» (сужение типа): после `if (isRecord(x))` TS знает, что x — объект.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Превращает сырой JSON в типизированный GsiPayload.
 * Возвращает null, если это вообще не похоже на сообщение GSI.
 */
export function parseGsiPayload(raw: unknown): GsiPayload | null {
  if (!isRecord(raw)) return null

  const payload: GsiPayload = {
    token: isRecord(raw.auth) ? asString(raw.auth.token) : null
  }

  if (isRecord(raw.provider)) {
    const appid = asNumber(raw.provider.appid)
    const steamid = asString(raw.provider.steamid)
    if (appid !== null && steamid !== null) payload.provider = { appid, steamid }
  }

  if (isRecord(raw.map)) {
    const mode = asString(raw.map.mode)
    const name = asString(raw.map.name)
    const phase = asString(raw.map.phase)
    if (mode !== null && name !== null && phase !== null) {
      payload.map = {
        mode,
        name,
        phase,
        ctScore: isRecord(raw.map.team_ct) ? asNumber(raw.map.team_ct.score) : null,
        tScore: isRecord(raw.map.team_t) ? asNumber(raw.map.team_t.score) : null
      }
    }
  }

  if (isRecord(raw.player)) {
    const steamid = asString(raw.player.steamid)
    if (steamid !== null) {
      payload.player = {
        steamid,
        team: asString(raw.player.team),
        activity: asString(raw.player.activity)
      }
    }
  }

  return payload
}
