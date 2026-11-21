// «Игровой день» начинается не в полночь, а в RESET_HOUR по местному времени.
// Катка в 02:00 ночи относится к вчерашнему дню — счётчик сбросится только в 05:00.

export const RESET_HOUR = 5

/** Начало игрового дня, в который попадает момент `now`. */
export function getGameDayStart(now: Date, resetHour = RESET_HOUR): Date {
  // new Date(год, месяц, день, час) — конструктор в МЕСТНОМ часовом поясе.
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), resetHour)
  // Если сейчас раньше 05:00 — день начался вчера в 05:00.
  // setDate(getDate() - 1) корректно переходит через границу месяца/года.
  if (now < start) start.setDate(start.getDate() - 1)
  return start
}

/** Момент следующего сброса счётчика. */
export function getNextReset(now: Date, resetHour = RESET_HOUR): Date {
  const next = getGameDayStart(now, resetHour)
  next.setDate(next.getDate() + 1)
  return next
}
