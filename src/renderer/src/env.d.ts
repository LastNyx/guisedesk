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
  idlePolicy?: string
  custom?: { name: string; url: string; icon?: string }
}

interface Snapshot {
  accounts: AccountRow[]
  selectedId?: string
  /** Service ids switched off in Settings: their accounts are hidden from the sidebar. */
  disabledServices: string[]
  /** Sidebar shown as the 64px rail (D24). */
  sidebarCollapsed?: boolean
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
    /** Settings that act at once: idle lock minutes, Do Not Disturb, start on login (autostart entry present). */
    prefs(): Promise<{ idleLock: 5 | 10 | 30 | 'manual'; dnd: boolean; startOnLogin: boolean }>
    setIdle(minutes: 5 | 10 | 30 | 'manual'): Promise<boolean>
    setDnd(on: boolean): Promise<boolean>
    /** The tray checkbox changed Do Not Disturb. */
    onDnd(cb: (on: boolean) => void): void
    setStartOnLogin(on: boolean): Promise<boolean>
    /** Needs the current PIN or password; main applies the setup rules to the new one. */
    changeLock(current: string, kind: 'pin' | 'password', secret: string, repeat: string): Promise<{ ok: true } | { error: string; waitUntil?: number }>
    /** Wipes every account and session, after RESET is typed; main re-checks the word. */
    reset(typed: string): Promise<{ ok: true } | { error: string }>
    state(): Promise<Snapshot>
    unread(): Promise<Record<string, number>>
    onUnread(cb: (counts: Record<string, number>) => void): void
    select(id: string): void
    sleep(): Promise<Record<string, { minutes: number; waking: boolean }>>
    onSleep(cb: (s: Record<string, { minutes: number; waking: boolean }>) => void): void
    /** Main selected an account (notification click). */
    onSelected(cb: (id: string) => void): void
    /** Collapse or expand the sidebar; main saves it and resizes the service view. */
    setSidebar(collapsed: boolean): void
    /** Main changed the sidebar (Ctrl+B). */
    onSidebar(cb: (collapsed: boolean) => void): void
    /** Dialog open: main detaches the service view so the dialog is not hidden behind it. */
    dialog(open: boolean): void
    /** Top bar Reload: reloads the account's view, or wakes it when asleep. */
    reload(id: string): void
    /** Sleep now (D27): unloads the account's view; it wakes on Wake up, Reload or reselect. */
    sleepNow(id: string): void
    /** Mute or unmute an account (D19). */
    mute(id: string, muted: boolean): Promise<Snapshot>
    /** Settings was opened from the tray. */
    onOpenSettings(cb: () => void): void
    /** Switch a whole service on or off (D6); sessions stay. */
    setServiceEnabled(serviceId: string, enabled: boolean): Promise<Snapshot>
    /** Hibernation override for one account (D7): default | always | 10 | 30 | 60. */
    setPolicy(id: string, policy: string): Promise<Snapshot>
    /** Clears the account's saved login; the account stays. */
    logout(id: string): Promise<Snapshot>
    /** Deletes the account and its saved data. */
    remove(id: string): Promise<Snapshot>
    add(input: {
      serviceId: string
      label: string
      colour: string
      custom?: { name: string; url: string }
    }): Promise<Snapshot | { error: string }>
  }
}
