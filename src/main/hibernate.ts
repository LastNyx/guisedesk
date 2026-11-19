// Hibernation scheduler (D7). Plain TS: no electron import, clock injected.
import { kindOf } from './presets'

interface Sleeper {
  id: string
  serviceId: string
  idlePolicy?: string
}

/** Minutes unused before the account sleeps, or null to stay awake. idlePolicy: default | always | 10 | 30 | 60. */
export function limitMinutes(a: Sleeper): number | null {
  const p = String(a.idlePolicy ?? 'default')
  if (p === 'always') return null
  if (p === '10' || p === '30' || p === '60') return Number(p)
  return kindOf(a.serviceId) === 'feed' ? 30 : null
}

export function createHibernator(now: () => number) {
  const lastUsed = new Map<string, number>()
  const asleep = new Set<string>()
  return {
    /** Selected or typed into: restart the clock. */
    touch(id: string): void {
      lastUsed.set(id, now())
    },
    isAsleep: (id: string): boolean => asleep.has(id),
    /** Accounts that just fell asleep; the caller destroys their views. The selected account never sleeps. */
    sweep(accounts: Sleeper[], selectedId?: string): string[] {
      const t = now()
      if (selectedId) lastUsed.set(selectedId, t)
      const out: string[] = []
      for (const a of accounts) {
        if (!lastUsed.has(a.id)) lastUsed.set(a.id, t)
        if (asleep.has(a.id) || a.id === selectedId) continue
        const limit = limitMinutes(a)
        if (limit !== null && t - lastUsed.get(a.id)! >= limit * 60_000) {
          asleep.add(a.id)
          out.push(a.id)
        }
      }
      return out
    },
    /** Dev start (GUISEDESK_FAKE_ASLEEP): treat as asleep without waiting. */
    sleep(id: string): void {
      asleep.add(id)
    },
    wake(id: string): void {
      asleep.delete(id)
      lastUsed.set(id, now())
    }
  }
}
