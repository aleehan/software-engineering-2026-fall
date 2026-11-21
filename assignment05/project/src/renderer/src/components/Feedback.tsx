import type { ActionFeedback } from '../hooks/useAction'

/** Строка с результатом действия: спокойный зелёный при успехе, красный при ошибке. */
export function Feedback({ value }: { value: ActionFeedback | null }): React.JSX.Element | null {
  if (!value) return null
  // role="status" — диктор прочитает сообщение, когда оно появится.
  return (
    <p role="status" className={value.ok ? 'feedback positive' : 'feedback negative'}>
      {value.text}
    </p>
  )
}
