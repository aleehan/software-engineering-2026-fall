/* eslint-disable @typescript-eslint/explicit-function-return-type -- обычный JS-скрипт, типов нет */
// Разведка FACEIT Data API: печатает структуру настоящих ответов, чтобы код
// разбирал их по фактам, а не по догадкам. Ключ в вывод не попадает.
//
// Запуск: node scripts/faceit-probe.mjs <никнейм>
// Ключ берётся из файла .faceit-key в корне проекта (он в .gitignore).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const nickname = process.argv[2]
if (!nickname) {
  console.error('Укажи никнейм: node scripts/faceit-probe.mjs <nickname>')
  process.exit(1)
}
const key = readFileSync(join(import.meta.dirname, '..', '.faceit-key'), 'utf8').trim()
const BASE = 'https://open.faceit.com/data/v4'

async function get(path) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${key}` } })
  const text = await res.text()
  console.log(`\n=== GET ${path} → ${res.status}`)
  try {
    return { status: res.status, body: JSON.parse(text) }
  } catch {
    console.log(text.slice(0, 300))
    return { status: res.status, body: null }
  }
}

// Короткий вывод: длинные массивы обрезаются до двух элементов.
const show = (value) =>
  console.log(
    JSON.stringify(
      value,
      (_k, v) => (Array.isArray(v) && v.length > 2 ? [...v.slice(0, 2), `…+${v.length - 2}`] : v),
      2
    )
  )

const player = await get(`/players?nickname=${encodeURIComponent(nickname)}`)
if (!player.body?.player_id) process.exit(1)
console.log('player_id:', player.body.player_id)
console.log('games keys:', Object.keys(player.body.games ?? {}))
show(player.body.games)

for (const game of ['cs2', 'csgo']) {
  const history = await get(`/players/${player.body.player_id}/history?game=${game}&limit=3`)
  if (!history.body?.items?.length) continue
  console.log(
    'top-level keys:',
    Object.keys(history.body),
    'from/to:',
    history.body.from,
    history.body.to
  )
  show(history.body.items[0])

  const matchId = history.body.items[0].match_id
  const stats = await get(`/matches/${matchId}/stats`)
  const round = stats.body?.rounds?.[0]
  if (round) {
    console.log('round keys:', Object.keys(round))
    show(round.round_stats)
    for (const team of round.teams ?? []) {
      console.log('team_id:', team.team_id)
      show(team.team_stats)
      console.log('player_stats keys:', Object.keys(team.players?.[0]?.player_stats ?? {}))
    }
  }
  break
}
