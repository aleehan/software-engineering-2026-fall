import type { MatchRecord } from '../../../shared/ipc'
import { PageHeader } from '../components/PageHeader'
import { Tally } from '../components/Tally'
import type { AppData } from '../hooks/useAppData'
import { formatClock, formatDay, MATCH_FORMS, plural } from '../lib/format'
import { modeText, RESULT_TEXT } from '../lib/labels'

/** Счёт «свой : соперника»; для старых записей без стороны игрока — CT:T. */
function scoreText(m: MatchRecord): string {
  if (m.ownScore !== null && m.oppScore !== null) return `${m.ownScore}:${m.oppScore}`
  return `${m.ctScore ?? '–'}:${m.tScore ?? '–'}`
}

interface DayGroup {
  gameDay: number
  matches: MatchRecord[]
}

/** Группирует катки по игровому дню. Вход отсортирован по убыванию времени — порядок сохраняется. */
function groupByDay(matches: MatchRecord[]): DayGroup[] {
  // Map сохраняет порядок вставки ключей, поэтому дни останутся от новых к старым.
  const groups = new Map<number, MatchRecord[]>()
  for (const match of matches) {
    const list = groups.get(match.gameDay)
    if (list) list.push(match)
    else groups.set(match.gameDay, [match])
  }
  // Array.from(map, fn) превращает пары [ключ, значение] в массив объектов.
  return Array.from(groups, ([gameDay, list]) => ({ gameDay, matches: list }))
}

export function HistoryPage({ data }: { data: AppData }): React.JSX.Element {
  const groups = groupByDay(data.matches)
  const total = data.matches.length

  return (
    <main className="page">
      <PageHeader
        title="История"
        meta={
          total === 0
            ? 'Игровой день начинается в 05:00'
            : `${total} ${plural(total, MATCH_FORMS)} за ${groups.length} ${plural(groups.length, ['день', 'дня', 'дней'])}, день начинается в 05:00`
        }
      />

      {groups.length === 0 && (
        <section className="card">
          <p className="secondary">
            Здесь появятся засчитанные катки: соревновательный режим, Premier, напарники и FACEIT.
          </p>
        </section>
      )}

      {groups.map((group) => (
        <section className="card day" key={group.gameDay}>
          <header className="day-header">
            <h2>{formatDay(group.gameDay)}</h2>
            <Tally
              played={group.matches.length}
              limit={null}
              size="sm"
              label={`${group.matches.length} ${plural(group.matches.length, MATCH_FORMS)}`}
            />
            <span className="mono muted day-count">{group.matches.length}</span>
          </header>
          <table className="matches">
            {/* colgroup задаёт ширину колонок один раз для всей таблицы. */}
            <colgroup>
              <col className="col-time" />
              <col className="col-map" />
              <col />
              <col className="col-result" />
              <col className="col-score" />
              <col className="col-kd" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Время</th>
                <th scope="col">Карта</th>
                <th scope="col">Режим</th>
                <th scope="col">Итог</th>
                <th scope="col" className="num">
                  Счёт
                </th>
                <th scope="col" className="num">
                  K–D
                </th>
              </tr>
            </thead>
            <tbody>
              {group.matches.map((m) => (
                <tr key={m.id}>
                  <td className="mono muted">{formatClock(m.finishedAt)}</td>
                  <td>{m.map}</td>
                  <td className="secondary">
                    {/* FACEIT-матч, засчитанный через GSI, хранит режим из игры — помечаем отдельно. */}
                    {m.faceit && m.mode !== 'faceit'
                      ? `${modeText(m.mode)} · FACEIT`
                      : modeText(m.mode)}
                  </td>
                  <td className={m.result ? `result-${m.result}` : 'muted'}>
                    {m.result ? RESULT_TEXT[m.result] : '–'}
                  </td>
                  <td className="mono num">{scoreText(m)}</td>
                  <td className="mono num muted">
                    {m.kills !== null && m.deaths !== null ? `${m.kills}–${m.deaths}` : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  )
}
