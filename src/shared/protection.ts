// Типы защиты, общие для main и renderer.

/** Задержка перед применением ослабляющих изменений. */
export const LOOSENING_DELAY_MS = 10 * 60 * 1000

export const MATCH_LIMIT_MIN = 1
export const MATCH_LIMIT_MAX = 10
export const CLOSE_DELAY_MAX_SECONDS = 600

export type ProtectionError =
  | 'password-not-set'
  | 'password-already-set'
  | 'wrong-password'
  | 'password-too-short'
  | 'invalid-value'
  | 'unchanged'
  // Ошибки проверки аккаунта FACEIT при подключении:
  | 'faceit-bad-key'
  | 'faceit-not-found'
  | 'faceit-unavailable'

/**
 * Результат действия. Это «размеченное объединение» по полю ok:
 * если ok === true — есть поле applied, если false — есть error.
 * TypeScript не даст прочитать result.error, пока не проверишь result.ok.
 */
export type ActionResult =
  | { ok: true; applied: 'now' }
  | { ok: true; applied: 'pending'; applyAt: number }
  | { ok: false; error: ProtectionError }
