// Запускает Vitest внутри Electron в режиме Node (ELECTRON_RUN_AS_NODE=1).
// Зачем: better-sqlite3 собран под Node из Electron, обычный Node его не загрузит.
// Так тесты могут работать с настоящей SQLite (в памяти).
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
// Пакет electron при импорте из Node возвращает путь к electron.exe.
const electronPath = require('electron')
// Путь к CLI vitest берём из поля "bin" его package.json (сам файл не экспортируется).
const vitestPkgPath = require.resolve('vitest/package.json')
const vitestPkg = require(vitestPkgPath)
const vitestBin = typeof vitestPkg.bin === 'string' ? vitestPkg.bin : vitestPkg.bin.vitest
const vitestEntry = join(dirname(vitestPkgPath), vitestBin)

const child = spawn(electronPath, [vitestEntry, 'run', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
child.on('exit', (code) => process.exit(code ?? 1))
