import { execFile } from 'child_process'
import { promisify } from 'util'
import { access, readFile } from 'fs/promises'
import { join, normalize } from 'path'
import { parseVdf, vdfObject, vdfString } from './vdf'

// promisify превращает функцию с колбэком (err, result) в функцию, возвращающую Promise.
// Так её можно использовать с await.
const execFileAsync = promisify(execFile)

export const CS2_APP_ID = '730'

/** Где установлена CS2. */
export interface Cs2Install {
  steamPath: string
  /** Корень игры: ...\steamapps\common\Counter-Strike Global Offensive */
  gamePath: string
  /** Папка, куда CS2 смотрит за gamestate_integration_*.cfg */
  cfgPath: string
}

/**
 * Читает одно строковое значение из реестра Windows через встроенную утилиту reg.exe.
 * Так не нужен нативный модуль для реестра. Возвращает null, если ключа нет.
 */
export async function readRegistryString(key: string, valueName: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('reg', ['query', key, '/v', valueName], {
      windowsHide: true
    })
    // Строка вывода выглядит так: "    SteamPath    REG_SZ    c:/program files (x86)/steam"
    // Регулярное выражение: имя, пробелы, REG_SZ/REG_EXPAND_SZ, пробелы, (значение до конца строки).
    const match = new RegExp(`${valueName}\\s+REG_(?:EXPAND_)?SZ\\s+(.+)`, 'i').exec(stdout)
    return match ? match[1].trim() : null
  } catch {
    // reg.exe завершается с ошибкой, если ключа нет. `catch` без переменной — ошибка нам не нужна.
    return null
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Путь к Steam: сначала из HKCU (так пишет сам Steam), затем из HKLM. */
export async function findSteamPath(): Promise<string | null> {
  const candidates = [
    await readRegistryString('HKCU\\Software\\Valve\\Steam', 'SteamPath'),
    await readRegistryString('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
    await readRegistryString('HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath')
  ]

  for (const candidate of candidates) {
    // В реестре путь бывает с прямыми слешами — normalize приводит к виду Windows.
    if (candidate && (await exists(candidate))) return normalize(candidate)
  }
  return null
}

/**
 * Ищет CS2 во всех библиотеках Steam.
 * 1) libraryfolders.vdf — список библиотек и appid, установленных в каждой;
 * 2) appmanifest_730.acf в найденной библиотеке — имя папки игры (installdir).
 */
export async function findCs2Install(steamPath: string): Promise<Cs2Install | null> {
  const libraryFile = join(steamPath, 'steamapps', 'libraryfolders.vdf')

  let libraries: string[] = [steamPath]
  try {
    const root = vdfObject(parseVdf(await readFile(libraryFile, 'utf8')), 'libraryfolders')
    // Object.values даёт массив значений объекта: здесь — записи "0", "1", ...
    const entries = Object.values(root ?? {})
    // Сначала библиотеки, где явно числится appid 730, затем остальные.
    const withCs2: string[] = []
    const others: string[] = []
    for (const entry of entries) {
      if (typeof entry !== 'object') continue
      const path = vdfString(entry, 'path')
      if (!path) continue
      const apps = vdfObject(entry, 'apps')
      ;(apps && CS2_APP_ID in apps ? withCs2 : others).push(path)
    }
    // Set убирает дубликаты (основная библиотека обычно совпадает со steamPath).
    libraries = [...new Set([...withCs2, ...others, steamPath].map((p) => normalize(p)))]
  } catch {
    // Нет файла или он битый — ищем только в основной папке Steam.
  }

  for (const library of libraries) {
    const steamapps = join(library, 'steamapps')
    const manifestFile = join(steamapps, `appmanifest_${CS2_APP_ID}.acf`)
    if (!(await exists(manifestFile))) continue

    let installDir = 'Counter-Strike Global Offensive'
    try {
      const manifest = vdfObject(parseVdf(await readFile(manifestFile, 'utf8')), 'AppState')
      installDir = vdfString(manifest, 'installdir') ?? installDir
    } catch {
      // Оставляем стандартное имя папки.
    }

    const gamePath = join(steamapps, 'common', installDir)
    const cfgPath = join(gamePath, 'game', 'csgo', 'cfg')
    if (await exists(cfgPath)) {
      return { steamPath: normalize(steamPath), gamePath, cfgPath }
    }
  }

  return null
}
