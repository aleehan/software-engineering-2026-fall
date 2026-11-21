import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { GSI_CONFIG_FILENAME, installGsiConfig } from './gsi-config'
import { parseVdf } from './vdf'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'gk-cfg-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('installGsiConfig', () => {
  it('создаёт, не трогает без изменений и обновляет при смене токена', async () => {
    expect(await installGsiConfig(dir, { port: 1234, token: 'abc' })).toBe('installed')
    expect(await installGsiConfig(dir, { port: 1234, token: 'abc' })).toBe('unchanged')
    expect(await installGsiConfig(dir, { port: 1234, token: 'xyz' })).toBe('updated')
  })

  it('пишет валидный VDF с uri, токеном и нужными блоками данных', async () => {
    await installGsiConfig(dir, { port: 47815, token: 'secret' })
    const cfg = parseVdf(await readFile(join(dir, GSI_CONFIG_FILENAME), 'utf8'))
    expect(cfg).toMatchObject({
      Gamekeeper: {
        uri: 'http://127.0.0.1:47815/',
        auth: { token: 'secret' },
        data: { provider: '1', map: '1', player_id: '1' }
      }
    })
  })
})
