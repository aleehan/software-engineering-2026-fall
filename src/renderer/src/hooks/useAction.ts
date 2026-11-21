import { useState } from 'react'
import type { ActionResult } from '../../../shared/protection'
import { resultText } from '../lib/labels'

export interface ActionFeedback {
  text: string
  ok: boolean
}

/**
 * Запускает действие, возвращающее ActionResult, и запоминает текст результата.
 * `busy` — пока идёт запрос (проверка пароля через scrypt занимает ~0.1 с), кнопку блокируем.
 */
export function useAction(): {
  feedback: ActionFeedback | null
  busy: boolean
  run: (action: () => Promise<ActionResult>) => Promise<ActionResult>
} {
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<ActionResult>): Promise<ActionResult> {
    setBusy(true)
    try {
      const result = await action()
      setFeedback({ text: resultText(result), ok: result.ok })
      return result
    } finally {
      setBusy(false)
    }
  }

  return { feedback, busy, run }
}
