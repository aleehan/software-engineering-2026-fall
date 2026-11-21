// Рисует PNG-иконки из SVG силами самого Electron (без внешних инструментов).
// Запуск: npm run icons
//
//   scripts/icons/icon.svg → build/icon.png (512) — из него electron-builder сделает .ico
//                          → resources/icon.png (256) — иконка окна и уведомлений
//   scripts/icons/tray.svg → resources/tray.png (16) и resources/tray@2x.png (32)
//     Суффикс @2x Electron подхватывает сам на экранах с масштабом 200%.
//
// Все картинки рисуются в одном окне рядом друг с другом, затем вырезаются по координатам.
import { app, BrowserWindow } from 'electron'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// В ES-модулях нет __dirname — берём папку текущего файла из import.meta.
const here = import.meta.dirname
const root = join(here, '..', '..')

// Масштаб 1: один CSS-пиксель = один пиксель картинки, независимо от настроек Windows.
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.disableHardwareAcceleration()

const jobs = [
  { svg: 'icon.svg', size: 512, out: 'build/icon.png' },
  { svg: 'icon.svg', size: 256, out: 'resources/icon.png' },
  { svg: 'tray.svg', size: 16, out: 'resources/tray.png' },
  { svg: 'tray.svg', size: 32, out: 'resources/tray@2x.png' }
]

app.whenReady().then(async () => {
  try {
    // Раскладываем картинки по горизонтали: у каждой своя координата x.
    let x = 0
    const placed = jobs.map((job) => {
      const item = { ...job, x }
      x += job.size
      return item
    })
    const width = x
    const height = Math.max(...jobs.map((j) => j.size))

    const imgs = placed
      .map(({ svg, size, x: left }) => {
        const data = Buffer.from(readFileSync(join(here, svg), 'utf8')).toString('base64')
        return `<img src="data:image/svg+xml;base64,${data}" width="${size}" height="${size}"
          style="position:absolute;left:${left}px;top:0">`
      })
      .join('')
    const tmp = join(tmpdir(), 'gamekeeper-icons.html')
    writeFileSync(tmp, `<html><body style="margin:0;background:transparent">${imgs}</body></html>`)

    const win = new BrowserWindow({
      width,
      height,
      show: false,
      transparent: true,
      frame: false,
      webPreferences: { offscreen: true }
    })
    await win.loadFile(tmp)
    await new Promise((r) => setTimeout(r, 500)) // дать картинкам отрисоваться
    rmSync(tmp)

    for (const { size, x: left, out } of placed) {
      const image = await win.capturePage({ x: left, y: 0, width: size, height: size })
      writeFileSync(join(root, out), image.resize({ width: size, height: size }).toPNG())
      console.log(`${out} ${size}x${size}`)
    }
    win.destroy()
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
  app.quit()
})
