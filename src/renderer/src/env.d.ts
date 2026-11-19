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

interface Window {
  guisedesk: {
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
