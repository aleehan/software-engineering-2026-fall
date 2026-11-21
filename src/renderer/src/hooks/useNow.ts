import { useEffect, useState } from 'react'

/** Текущее время, обновляемое раз в intervalMs, — для обратных отсчётов. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
