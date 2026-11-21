import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

// Имя обязано начинаться с gamestate_integration_ — иначе CS2 его не подхватит.
export const GSI_CONFIG_FILENAME = 'gamestate_integration_gamekeeper.cfg'

export interface GsiConfigOptions {
  port: number
  token: string
}

/**
 * Текст конфига в формате VDF. CS2 будет слать POST на uri при каждом изменении
 * состояния и раз в heartbeat секунд, даже если ничего не изменилось.
 */
export function buildGsiConfig({ port, token }: GsiConfigOptions): string {
  // Шаблонная строка (обратные кавычки) — многострочная, с подстановкой ${...}.
  return `"Gamekeeper"
{
  "uri"       "http://127.0.0.1:${port}/"
  "timeout"   "5.0"
  "buffer"    "0.1"
  "throttle"  "0.5"
  "heartbeat" "30.0"
  "auth"
  {
    "token"   "${token}"
  }
  "data"
  {
    "provider"  "1"
    "map"       "1"
    "player_id" "1"
  }
}
`
}

// Объединение строковых литералов: функция вернёт ровно одно из трёх значений.
export type InstallResult = 'installed' | 'updated' | 'unchanged'

/**
 * Кладёт конфиг в папку cfg. Перезаписывает, только если содержимое отличается
 * (например, сменился токен или порт), чтобы лишний раз не трогать файл.
 */
export async function installGsiConfig(
  cfgPath: string,
  options: GsiConfigOptions
): Promise<InstallResult> {
  const filePath = join(cfgPath, GSI_CONFIG_FILENAME)
  const content = buildGsiConfig(options)

  let existing: string | null = null
  try {
    existing = await readFile(filePath, 'utf8')
  } catch {
    // Файла нет — будем создавать.
  }

  if (existing === content) return 'unchanged'
  await writeFile(filePath, content, 'utf8')
  return existing === null ? 'installed' : 'updated'
}
