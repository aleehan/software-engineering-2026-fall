import type { PendingChangeInfo } from '../../../shared/ipc'
import { useNow } from '../hooks/useNow'
import { formatCountdown } from '../lib/format'
import { describePending } from '../lib/labels'

// Props — тип входных параметров компонента. Деструктурируем их прямо в сигнатуре.
interface PendingListProps {
  items: PendingChangeInfo[]
  onCancel: (id: number) => void
}

/** Ожидающие ослабления с обратным отсчётом и кнопкой отмены. */
export function PendingList({ items, onCancel }: PendingListProps): React.JSX.Element | null {
  const now = useNow()
  // Компонент может ничего не рисовать — тогда возвращает null.
  if (items.length === 0) return null

  return (
    <section className="card">
      <h2>Ожидают применения</h2>
      <ul className="rows">
        {items.map((change) => (
          <li key={change.id} className="row-item">
            <span>{describePending(change)}</span>
            <span className="mono muted">{formatCountdown(change.applyAt - now)}</span>
            <button className="button" onClick={() => onCancel(change.id)}>
              Отменить
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
