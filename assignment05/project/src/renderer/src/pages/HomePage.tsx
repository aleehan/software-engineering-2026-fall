import { useState } from 'react'
import { Feedback } from '../components/Feedback'
import { PageHeader } from '../components/PageHeader'
import { PendingList } from '../components/PendingList'
import { Tally } from '../components/Tally'
import { YellowCard } from '../components/YellowCard'
import { useAction } from '../hooks/useAction'
import type { AppData } from '../hooks/useAppData'
import { formatClock, formatDateTime, formatDay, MATCH_FORMS, plural } from '../lib/format'
import { cs2ConnectionText, cs2Health, modeText, TODAY_STATUS_TEXT } from '../lib/labels'

const DAY_MS = 24 * 60 * 60 * 1000

/** Пояснение под статусом. Отдельная функция читается проще, чем вложенные тернарники в JSX. */
function subtitle(today: AppData['today']): string {
  if (today.unlockedUntil !== null) {
    return `Блокировка снята, лимит не действует до ${formatClock(today.unlockedUntil)}`
  }
  switch (today.status) {
    case 'allowed':
      return `Осталось ${today.remaining} ${plural(today.remaining, MATCH_FORMS)}, сброс в ${formatClock(today.nextResetAt)}`
    case 'grace':
      return today.closeAt ? `CS2 закроется в ${formatClock(today.closeAt)}` : 'CS2 скоро закроется'
    case 'blocked':
      return `Снова можно играть в ${formatClock(today.nextResetAt)}`
  }
}

interface HomePageProps {
  data: AppData
  reload: () => Promise<void>
}

export function HomePage({ data, reload }: HomePageProps): React.JSX.Element {
  const { today, cs2, protection, matches } = data
  const [password, setPassword] = useState('')
  const { feedback, busy, run } = useAction()

  const unlockPending = protection.pending.some((c) => c.kind === 'unlock')
  const limitReached = today.status !== 'allowed' && today.unlockedUntil === null
  const lastMatch = matches[0] // массив отсортирован: новые сверху

  async function requestUnlock(): Promise<void> {
    const result = await run(() => window.gamekeeper.requestUnlock(password))
    if (result.ok) setPassword('')
    await reload()
  }

  return (
    <main className="page">
      {/* Дата игрового дня (начался в 05:00), а не календарная: ночью это ещё «вчера». */}
      <PageHeader title="Сегодня" meta={formatDay(today.nextResetAt - DAY_MS)} />

      <section className={`card scoreboard${limitReached ? ' reached' : ''}`}>
        <div className="scoreboard-count">
          <Tally
            played={today.matchesToday}
            limit={today.limit}
            label={`${today.matchesToday} из ${today.limit} каток`}
          />
          <p className="figure">
            {today.matchesToday}
            <span className="figure-of">из {today.limit}</span>
          </p>
        </div>
        <div className="scoreboard-status">
          <p className="status-line">
            <span className={`dot ${limitReached ? 'negative' : 'positive'}`} aria-hidden="true" />
            {today.unlockedUntil !== null ? 'Можно играть' : TODAY_STATUS_TEXT[today.status]}
          </p>
          <p className="secondary">{subtitle(today)}</p>
        </div>
        {limitReached && <YellowCard />}
      </section>

      {limitReached && !unlockPending && (
        <section className="card">
          <h2>Снять блокировку</h2>
          <p className="secondary">
            Разрешит играть без лимита до 05:00. Вступит в силу через 10 минут после пароля.
          </p>
          <div className="inline-form">
            <input
              className="input"
              type="password"
              placeholder="Пароль"
              aria-label="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              className="button"
              disabled={busy || !password}
              onClick={() => void requestUnlock()}
            >
              Запросить
            </button>
          </div>
          <Feedback value={feedback} />
        </section>
      )}

      <PendingList
        items={protection.pending}
        onCancel={(id) => void window.gamekeeper.cancelPending(id).then(reload)}
      />

      <section className="card">
        <h2>CS2</h2>
        <p className="status-line">
          <span className={`dot ${cs2Health(cs2)}`} aria-hidden="true" />
          {cs2ConnectionText(cs2)}
        </p>
        {lastMatch && (
          <dl className="facts">
            <dt>Последняя катка</dt>
            <dd>
              {lastMatch.map} · {modeText(lastMatch.mode)} ·{' '}
              <span className="mono">
                {lastMatch.ctScore ?? '–'}:{lastMatch.tScore ?? '–'}
              </span>
            </dd>
            <dt>Закончилась</dt>
            <dd>{formatDateTime(lastMatch.finishedAt)}</dd>
          </dl>
        )}
      </section>
    </main>
  )
}
