import { MATCH_LIMIT_MAX, MATCH_LIMIT_MIN } from '../../../shared/protection'

const OPTIONS = Array.from(
  { length: MATCH_LIMIT_MAX - MATCH_LIMIT_MIN + 1 },
  (_, i) => MATCH_LIMIT_MIN + i
)

interface LimitPickerProps {
  value: number
  onChange: (value: number) => void
  /** Текущий сохранённый лимит — помечается тонкой чертой снизу. */
  current?: number
}

/** Выбор лимита 1–10 рядом кнопок: все варианты видны сразу, без выпадающего списка. */
export function LimitPicker({ value, onChange, current }: LimitPickerProps): React.JSX.Element {
  return (
    <div className="limit-picker" role="radiogroup" aria-label="Каток в день">
      {OPTIONS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          className={[
            'limit-option',
            n === value ? 'selected' : '',
            n === current ? 'current' : ''
          ].join(' ')}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
