declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface AccountRow {
  id: string
  serviceId: string
  label: string
  colour: string
  order: number
  muted?: boolean
  custom?: { name: string; url: string; icon?: string }
}

interface LockInfo {
  state: 'setup' | 'locked' | 'unlocked'
  kind?: 'pin' | 'password'
  pinLength?: number
  waitUntil?: number
}

interface Window {
  guisedesk: {
    /** Lock state from main (the source of truth). Account data is only available while 'unlocked'. */
    lockState(): Promise<LockInfo>
    onLock(cb: (info: LockInfo) => void): void
    /** The entry goes to main once and is checked there; the answer is ok, wrong or a wait. */
    unlock(entry: string): Promise<{ result: 'ok' } | { result: 'wrong' } | { result: 'wait'; until: number }>
    setupLock(kind: 'pin' | 'password', secret: string, repeat: string): Promise<{ ok: true } | { error: string }>
    lock(): void
    /** Wipes every account and session, after RESET is typed; main re-checks the word. */
    reset(typed: string): Promise<{ ok: true } | { error: string }>
    state(): Promise<{ accounts: AccountRow[]; selectedId?: string }>
    unread(): Promise<Record<string, number>>
    onUnread(cb: (counts: Record<string, number>) => void): void
    select(id: string): void
    sleep(): Promise<Record<string, { minutes: number; waking: boolean }>>
    onSleep(cb: (s: Record<string, { minutes: number; waking: boolean }>) => void): void
    /** Main selected an account (notification click). */
    onSelected(cb: (id: string) => void): void
    /** Dialog open: main detaches the service view so the dialog is not hidden behind it. */
    dialog(open: boolean): void
    /** Mute or unmute an account (D19). */
    mute(id: string, muted: boolean): Promise<{ accounts: AccountRow[]; selectedId?: string }>
    add(input: {
      serviceId: string
      label: string
      colour: string
      custom?: { name: string; url: string }
    }): Promise<{ accounts: AccountRow[]; selectedId?: string } | { error: string }>
  }
}
