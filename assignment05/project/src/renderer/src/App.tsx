import { useState } from 'react'
import { History, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react'
import { useAppData } from './hooks/useAppData'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { OnboardingPage } from './pages/OnboardingPage'
import { SettingsPage } from './pages/SettingsPage'

// Объединение строк вместо enum: проще и так же безопасно.
type Page = 'home' | 'history' | 'settings'

// LucideIcon — тип компонента-иконки из библиотеки: храним сам компонент, а не элемент.
const NAV: { page: Page; label: string; icon: LucideIcon }[] = [
  { page: 'home', label: 'Сегодня', icon: LayoutDashboard },
  { page: 'history', label: 'История', icon: History },
  { page: 'settings', label: 'Настройки', icon: Settings }
]

function App(): React.JSX.Element {
  const { data, reload } = useAppData()
  const [page, setPage] = useState<Page>('home')

  if (data === null) {
    return <div className="boot muted">Загрузка</div>
  }

  // Пока пароль не задан — только экран первой настройки.
  if (!data.protection.hasPassword) {
    return <OnboardingPage onDone={() => void reload()} />
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="wordmark">Gamekeeper</div>
        <nav className="nav">
          {/* Переименование при деструктуризации: icon → Icon, чтобы использовать как <Icon />. */}
          {NAV.map(({ page: target, label, icon: Icon }) => (
            <button
              key={target}
              className={target === page ? 'nav-item active' : 'nav-item'}
              aria-current={target === page ? 'page' : undefined}
              onClick={() => setPage(target)}
            >
              <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <p className="sidebar-foot mono">v{data.info.version}</p>
      </aside>

      {/* key={page}: при смене страницы React пересоздаёт <main>, и проигрывается короткое появление. */}
      <div className="content" key={page}>
        {page === 'home' && <HomePage data={data} reload={reload} />}
        {page === 'history' && <HistoryPage data={data} />}
        {page === 'settings' && <SettingsPage data={data} reload={reload} />}
      </div>
    </div>
  )
}

export default App
