import { useState } from 'react'
import { Feedback } from '../components/Feedback'
import { LimitPicker } from '../components/LimitPicker'
import { PageHeader } from '../components/PageHeader'
import { PendingList } from '../components/PendingList'
import { useAction } from '../hooks/useAction'
import type { AppData } from '../hooks/useAppData'
import type { FaceitState } from '../../../shared/ipc'
import { formatDateTime } from '../lib/format'
import { CONFIG_TEXT, FACEIT_ERROR_TEXT, SERVER_TEXT } from '../lib/labels'

interface SettingsPageProps {
  data: AppData
  reload: () => Promise<void>
}

const DELAY_OPTIONS = [0, 30, 60, 120, 300]

function delayText(seconds: number): string {
  if (seconds === 0) return 'Сразу'
  return seconds < 60 ? `Через ${seconds} с` : `Через ${seconds / 60} мин`
}

export function SettingsPage({ data, reload }: SettingsPageProps): React.JSX.Element {
  const { protection, info, cs2 } = data

  return (
    <main className="page">
      <PageHeader
        title="Настройки"
        meta="Ужесточить можно сразу, ослабить — по паролю и через 10 минут"
      />

      <section className="card settings">
        {/* key: когда значение в базе меняется, React пересоздаёт строку,
            и её внутреннее состояние (выбранное значение) берётся заново из current. */}
        <LimitRow key={protection.matchLimit} current={protection.matchLimit} reload={reload} />
        <DelayRow
          key={protection.closeDelaySeconds}
          current={protection.closeDelaySeconds}
          reload={reload}
        />
      </section>

      <FaceitSection state={data.faceit} reload={reload} />

      <PendingList
        items={protection.pending}
        onCancel={(id) => void window.gamekeeper.cancelPending(id).then(reload)}
      />

      <PasswordSection />
      <QuitSection reload={reload} />

      <section className="card">
        <h2>Диагностика</h2>
        <dl className="facts">
          <dt>CS2</dt>
          <dd className="mono small">{cs2.gamePath ?? 'не найдена'}</dd>
          <dt>GSI-конфиг</dt>
          <dd>{CONFIG_TEXT[cs2.config]}</dd>
          <dt>GSI-сервер</dt>
          <dd>
            {SERVER_TEXT[cs2.server]}, порт <span className="mono">{cs2.port}</span>
          </dd>
          {cs2.error && (
            <>
              <dt>Ошибка</dt>
              <dd className="negative">{cs2.error}</dd>
            </>
          )}
          <dt>Автозапуск</dt>
          <dd>
            {info.autostartEnabled ? 'включён' : 'выключен, работает только в установленной версии'}
          </dd>
          <dt>База данных</dt>
          <dd className="mono small">{info.databasePath}</dd>
        </dl>
      </section>
    </main>
  )
}

// Ниже — части страницы. Они не экспортируются: используются только здесь.

function LimitRow({
  current,
  reload
}: {
  current: number
  reload: () => Promise<void>
}): React.JSX.Element {
  const [value, setValue] = useState(current)
  const [password, setPassword] = useState('')
  const { feedback, busy, run } = useAction()
  const loosening = value > current

  async function save(): Promise<void> {
    const result = await run(() =>
      window.gamekeeper.setMatchLimit(value, loosening ? password : undefined)
    )
    if (result.ok) setPassword('')
    await reload()
  }

  return (
    <div className="setting">
      <div className="setting-text">
        <h2>Каток в день</h2>
        <p className="secondary">
          Сейчас {current}. Засчитываются соревновательный, Premier и напарники.
        </p>
      </div>
      <div className="setting-control">
        <LimitPicker value={value} current={current} onChange={setValue} />
        {value !== current && (
          <div className="inline-form">
            {loosening && (
              <input
                className="input"
                type="password"
                placeholder="Пароль"
                aria-label="Пароль для увеличения лимита"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            <button
              className="button primary"
              disabled={busy || (loosening && !password)}
              onClick={() => void save()}
            >
              {loosening ? `Увеличить до ${value} через 10 минут` : `Сохранить ${value}`}
            </button>
          </div>
        )}
        <Feedback value={feedback} />
      </div>
    </div>
  )
}

function DelayRow({
  current,
  reload
}: {
  current: number
  reload: () => Promise<void>
}): React.JSX.Element {
  const [value, setValue] = useState(current)
  const [password, setPassword] = useState('')
  const { feedback, busy, run } = useAction()
  const loosening = value > current
  // Текущее значение может не входить в список (например, задано раньше) — добавляем его.
  const options = DELAY_OPTIONS.includes(current)
    ? DELAY_OPTIONS
    : [...DELAY_OPTIONS, current].sort((a, b) => a - b)

  async function save(): Promise<void> {
    const result = await run(() =>
      window.gamekeeper.setCloseDelay(value, loosening ? password : undefined)
    )
    if (result.ok) setPassword('')
    await reload()
  }

  return (
    <div className="setting">
      <div className="setting-text">
        <h2>Закрыть CS2 после последней катки</h2>
        <p className="secondary">Если за это время начнётся новый матч, игра закроется сразу.</p>
      </div>
      <div className="setting-control">
        <select
          className="input"
          aria-label="Когда закрыть CS2"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {delayText(s)}
            </option>
          ))}
        </select>
        {value !== current && (
          <div className="inline-form">
            {loosening && (
              <input
                className="input"
                type="password"
                placeholder="Пароль"
                aria-label="Пароль для увеличения задержки"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            <button
              className="button primary"
              disabled={busy || (loosening && !password)}
              onClick={() => void save()}
            >
              {loosening ? 'Изменить через 10 минут' : 'Сохранить'}
            </button>
          </div>
        )}
        <Feedback value={feedback} />
      </div>
    </div>
  )
}

function PasswordSection(): React.JSX.Element {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const { feedback, busy, run } = useAction()

  async function save(): Promise<void> {
    if (next !== confirm) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    const result = await run(() => window.gamekeeper.changePassword(current, next))
    if (result.ok) {
      setCurrent('')
      setNext('')
      setConfirm('')
    }
  }

  return (
    <section className="card">
      <h2>Пароль</h2>
      <div className="stack">
        <input
          className="input"
          type="password"
          placeholder="Текущий пароль"
          aria-label="Текущий пароль"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Новый пароль"
          aria-label="Новый пароль"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Новый пароль ещё раз"
          aria-label="Новый пароль ещё раз"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <div className="actions">
        <button className="button" disabled={busy || !current || !next} onClick={() => void save()}>
          Сменить пароль
        </button>
      </div>
      {mismatch && <p className="feedback negative">Новые пароли не совпадают</p>}
      <Feedback value={feedback} />
    </section>
  )
}

function QuitSection({ reload }: { reload: () => Promise<void> }): React.JSX.Element {
  const [password, setPassword] = useState('')
  const { feedback, busy, run } = useAction()

  async function quit(): Promise<void> {
    const result = await run(() => window.gamekeeper.requestQuit(password))
    if (result.ok) setPassword('')
    await reload()
  }

  return (
    <section className="card">
      <h2>Выйти из Gamekeeper</h2>
      <p className="secondary">
        Приложение закроется через 10 минут после пароля. Пока оно не запущено, лимит не действует.
        При следующем входе в Windows оно запустится снова.
      </p>
      <div className="inline-form">
        <input
          className="input"
          type="password"
          placeholder="Пароль"
          aria-label="Пароль для выхода"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="button" disabled={busy || !password} onClick={() => void quit()}>
          Запросить выход
        </button>
      </div>
      <Feedback value={feedback} />
    </section>
  )
}

function FaceitSection({
  state,
  reload
}: {
  state: FaceitState
  reload: () => Promise<void>
}): React.JSX.Element {
  const [nickname, setNickname] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [password, setPassword] = useState('')
  const [editing, setEditing] = useState(false)
  const { feedback, busy, run } = useAction()

  async function connect(): Promise<void> {
    const result = await run(() =>
      window.gamekeeper.connectFaceit(nickname, apiKey, state.connected ? password : undefined)
    )
    if (result.ok) {
      setApiKey('')
      setPassword('')
      setEditing(false)
    }
    await reload()
  }

  async function disconnect(): Promise<void> {
    const result = await run(() => window.gamekeeper.disconnectFaceit(password))
    if (result.ok) setPassword('')
    await reload()
  }

  const form = (
    <div className="stack">
      <input
        className="input"
        placeholder="Никнейм на FACEIT"
        aria-label="Никнейм на FACEIT"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />
      <input
        className="input"
        type="password"
        placeholder="API-ключ"
        aria-label="API-ключ FACEIT"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      {state.connected && (
        <input
          className="input"
          type="password"
          placeholder="Пароль Gamekeeper"
          aria-label="Пароль Gamekeeper"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
    </div>
  )

  return (
    <section className="card">
      <h2>FACEIT</h2>
      {state.connected ? (
        <>
          <p className="status-line">
            <span
              className={`dot ${state.lastError ? 'negative' : 'positive'}`}
              aria-hidden="true"
            />
            {state.nickname}
          </p>
          <p className="secondary">
            {state.syncing
              ? 'Обновляется'
              : state.lastError
                ? FACEIT_ERROR_TEXT[state.lastError]
                : state.syncedAt
                  ? `Обновлено ${formatDateTime(state.syncedAt)}. Матчи FACEIT засчитываются в лимит и видны в истории.`
                  : 'Ещё не обновлялось'}
          </p>
          <div className="actions">
            <button
              className="button"
              disabled={state.syncing}
              onClick={() => void window.gamekeeper.syncFaceit().then(reload)}
            >
              Обновить сейчас
            </button>
            {!editing && (
              <button className="button" onClick={() => setEditing(true)}>
                Сменить или отключить
              </button>
            )}
          </div>
          {editing && (
            <>
              <p className="secondary small form-note">
                Смена аккаунта и отключение вступают в силу через 10 минут после пароля.
              </p>
              {form}
              <div className="actions">
                <button
                  className="button primary"
                  disabled={busy || !nickname || !apiKey || !password}
                  onClick={() => void connect()}
                >
                  Сменить аккаунт
                </button>
                <button
                  className="button"
                  disabled={busy || !password}
                  onClick={() => void disconnect()}
                >
                  Отключить FACEIT
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="secondary">
            Матчи FACEIT будут засчитываться в лимит и появятся в истории с итогом, счётом и K–D.
            Нужен API-ключ: создай приложение в{' '}
            <a href="https://developers.faceit.com" target="_blank" rel="noreferrer">
              developers.faceit.com
            </a>{' '}
            и ключ типа Server side.
          </p>
          <div className="form-note">{form}</div>
          <div className="actions">
            <button
              className="button primary"
              disabled={busy || !nickname || !apiKey}
              onClick={() => void connect()}
            >
              Подключить
            </button>
          </div>
        </>
      )}
      <Feedback value={feedback} />
    </section>
  )
}
