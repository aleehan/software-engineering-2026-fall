import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { findCs2Install } from './steam-locator'

// Строим во временной папке фальшивую структуру Steam:
// главная библиотека без CS2 и вторая библиотека, где CS2 установлена.
let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'gk-steam-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

// VDF экранирует обратные слеши: C:\x записывается как "C:\\x".
const vdfPath = (p: string): string => p.replace(/\\/g, '\\\\')

describe('findCs2Install', () => {
  it('находит CS2 во второй библиотеке по libraryfolders.vdf и appmanifest', async () => {
    const steam = join(root, 'Steam')
    const library = join(root, 'SteamLibrary')
    await mkdir(join(steam, 'steamapps'), { recursive: true })
    await mkdir(join(library, 'steamapps', 'common', 'CS2Folder', 'game', 'csgo', 'cfg'), {
      recursive: true
    })

    await writeFile(
      join(steam, 'steamapps', 'libraryfolders.vdf'),
      `"libraryfolders" {
        "0" { "path" "${vdfPath(steam)}" "apps" { } }
        "1" { "path" "${vdfPath(library)}" "apps" { "730" "1" } }
      }`
    )
    await writeFile(
      join(library, 'steamapps', 'appmanifest_730.acf'),
      `"AppState" { "appid" "730" "installdir" "CS2Folder" }`
    )

    const install = await findCs2Install(steam)
    expect(install?.gamePath).toBe(join(library, 'steamapps', 'common', 'CS2Folder'))
    expect(install?.cfgPath).toBe(
      join(library, 'steamapps', 'common', 'CS2Folder', 'game', 'csgo', 'cfg')
    )
  })

  it('возвращает null, если CS2 нигде нет', async () => {
    const steam = join(root, 'Steam')
    await mkdir(join(steam, 'steamapps'), { recursive: true })
    expect(await findCs2Install(steam)).toBeNull()
  })
})
