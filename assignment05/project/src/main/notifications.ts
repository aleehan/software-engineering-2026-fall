import { Notification } from 'electron'
import icon from '../../resources/icon.png?asset'
import type { KillReason } from './core/enforcer'
import type { RulesState } from './core/rules-engine'
import type { PendingChange } from './core/db'

function show(title: string, body: string): void {
  // На некоторых системах уведомления отключены — тогда просто молчим.
  if (!Notification.isSupported()) return
  new Notification({ title, body, icon }).show()
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

/** После каждой засчитанной катки: сколько осталось или что лимит исчерпан. */
export function notifyMatchRecorded(rules: RulesState): void {
  if (rules.status === 'allowed') {
    show(
      `Катка засчитана: ${rules.matchesToday} из ${rules.limit}`,
      `Осталось на сегодня: ${rules.remaining}.`
    )
    return
  }

  const when =
    rules.status === 'grace' && rules.closeAt ? `в ${formatTime(rules.closeAt)}` : 'сейчас'
  show(
    'Лимит каток на сегодня исчерпан',
    `CS2 будет закрыта ${when}. Следующая игра — после ${formatTime(rules.nextResetAt)}.`
  )
}

// Record<KillReason, string> — компилятор потребует текст для КАЖДОЙ причины.
const KILL_MESSAGES: Record<KillReason, string> = {
  'limit-reached': 'Лимит каток на сегодня исчерпан.',
  'blocked-launch': 'Сегодня играть уже нельзя.',
  'new-match-after-limit': 'Новый матч после исчерпания лимита не разрешён.'
}

/** Отложенное ослабление вступило в силу. */
export function notifyChangeApplied(change: PendingChange): void {
  switch (change.kind) {
    case 'raise_limit':
      show('Лимит увеличен', `Теперь можно ${change.value} каток в день.`)
      break
    case 'raise_close_delay':
      show('Задержка закрытия увеличена', `CS2 закроется через ${change.value} с после лимита.`)
      break
    case 'unlock':
      show('Блокировка снята', 'Играть можно до 05:00.')
      break
    case 'quit':
      show('Gamekeeper закрывается', 'Ограничения не действуют, пока приложение не запущено.')
      break
  }
}

export function notifyKilled(reason: KillReason, rules: RulesState): void {
  show(
    'CS2 закрыта',
    `${KILL_MESSAGES[reason]} Снова можно после ${formatTime(rules.nextResetAt)}.`
  )
}
