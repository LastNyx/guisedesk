// In-app idle tracker (D15, D17). Plain TS, injected clock. Main feeds touch() from input in the app window and every
// service view, and calls check() on a timer; Manual means check() never fires.
export type IdleMinutes = 5 | 10 | 30 | 'manual'

export function createIdle(o: { now: () => number; minutes: IdleMinutes; onIdle: () => void }) {
  let minutes = o.minutes
  let last = o.now()
  return {
    touch(): void {
      last = o.now()
    },
    setMinutes(m: IdleMinutes): void {
      minutes = m
    },
    /** Fires onIdle when the last input is at least the chosen minutes old. */
    check(): void {
      if (minutes === 'manual') return
      if (o.now() - last >= minutes * 60_000) o.onIdle()
    }
  }
}
