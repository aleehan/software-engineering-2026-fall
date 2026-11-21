import { useState, type FormEvent } from 'react'
import { Feedback } from '../components/Feedback'
import { LimitPicker } from '../components/LimitPicker'
import { Tally } from '../components/Tally'
import { useAction } from '../hooks/useAction'
import { MATCH_FORMS, plural } from '../lib/format'

/** Первый запуск: лимит и пароль. Пока пароль не задан, остальные экраны недоступны. */
export function OnboardingPage({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [limit, setLimit] = useState(3)
  const [localError, setLocalError] = useState<string | null>(null)
  const { feedback, busy, run } = useAction()

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (password !== confirm) {
      setLocalError('Пароли не совпадают')
      return
    }
    setLocalError(null)
    const result = await run(() => window.gamekeeper.setInitialPassword(password, limit))
    if (result.ok) onDone()
  }

  return (
    <div className="onboarding">
      <form className="onboarding-form" onSubmit={(e) => void submit(e)}>
        <p className="wordmark">Gamekeeper</p>
        <h1>Сколько каток в день</h1>
        <p className="lead">
          Gamekeeper считает соревновательные катки в CS2 и закрывает игру, когда лимит исчерпан.
          Счёт обнуляется каждый день в 05:00.
        </p>

        <div className="field">
          <span className="label">Каток в день</span>
          <LimitPicker value={limit} onChange={setLimit} />
        </div>

        <label className="field">
          <span className="label">Пароль</span>
          <input
            className="input"
            type="password"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="label">Пароль ещё раз</span>
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>

        <p className="secondary small">
          Пароль нужен, чтобы увеличить лимит, снять блокировку или выйти из приложения. Даже с
          паролем такие изменения вступают в силу через 10 минут. Уменьшить лимит можно в любой
          момент. Восстановить пароль нельзя.
        </p>

        <div className="actions">
          <button type="submit" className="button primary" disabled={busy || password.length === 0}>
            Начать
          </button>
        </div>
        {localError && <p className="feedback negative">{localError}</p>}
        <Feedback value={feedback} />
      </form>

      {/* Превью табло: показывает, как будет выглядеть день с выбранным лимитом. */}
      <aside className="onboarding-preview" aria-hidden="true">
        <div className="card scoreboard preview">
          <div className="scoreboard-count">
            <Tally played={0} limit={limit} label="" />
            <p className="figure">
              0<span className="figure-of">из {limit}</span>
            </p>
          </div>
          <div className="scoreboard-status">
            <p className="status-line">
              <span className="dot positive" />
              Можно играть
            </p>
            <p className="secondary">
              {limit} {plural(limit, MATCH_FORMS)} до 05:00
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}
