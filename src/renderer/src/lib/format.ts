// Форматирование дат и времени для интерфейса. Все входы — миллисекунды с 1970 г.

/** «21:40» */
export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

/** «20 ноября, 21:40» */
export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** «пятница, 20 ноября» */
export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
}

/** Обратный отсчёт «9:05». Отрицательное время показывается как 0:00. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  // padStart(2, '0') дополняет строку нулями слева: 5 → "05".
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Склонение по числу: plural(3, ['катка', 'катки', 'каток']) → «катки». */
export function plural(n: number, forms: [one: string, few: string, many: string]): string {
  // [one: string, ...] — «именованный кортеж»: массив фиксированной длины с подписями элементов.
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

export const MATCH_FORMS: [string, string, string] = ['катка', 'катки', 'каток']
