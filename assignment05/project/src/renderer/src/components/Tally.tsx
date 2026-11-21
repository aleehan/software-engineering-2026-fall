// Засечки — фирменная деталь Gamekeeper: каждая катка дня = одна черта,
// как счёт на судейском табло. Используются только там, где считаются катки.

interface TallyProps {
  /** Сколько каток сыграно. */
  played: number
  /** Лимит: столько черт рисуется всегда (пустые — ещё не сыграны). null — без лимита (история). */
  limit: number | null
  size?: 'lg' | 'sm'
  /** Подпись для экранного диктора, например «2 из 5 каток». */
  label: string
}

type Mark = 'played' | 'empty' | 'over'

export function Tally({ played, limit, size = 'lg', label }: TallyProps): React.JSX.Element {
  const total = limit === null ? played : Math.max(played, limit)

  // Array.from({ length }, fn) — массив нужной длины, заполненный результатом fn.
  const marks: Mark[] = Array.from({ length: total }, (_, i) => {
    if (i >= played) return 'empty'
    return limit !== null && i >= limit ? 'over' : 'played'
  })

  return (
    // role="img" + aria-label: для диктора это одна картинка с подписью, а не 10 пустых span.
    <div className={`tally tally-${size}`} role="img" aria-label={label}>
      {marks.map((mark, i) => (
        // После каждой пятой черты — увеличенный промежуток (класс group-end).
        <span
          key={i}
          className={`tally-mark ${mark}${(i + 1) % 5 === 0 && i + 1 < total ? ' group-end' : ''}`}
        />
      ))}
    </div>
  )
}
