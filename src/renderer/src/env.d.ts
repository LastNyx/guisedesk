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
  custom?: { name: string; url: string; icon?: string }
}

interface Window {
  guisedesk: {
    state(): Promise<{ accounts: AccountRow[]; selectedId?: string }>
    unread(): Promise<Record<string, number>>
    onUnread(cb: (counts: Record<string, number>) => void): void
    select(id: string): void
    /** Dialog open: main detaches the service view so the dialog is not hidden behind it. */
    dialog(open: boolean): void
    add(input: {
      serviceId: string
      label: string
      colour: string
      custom?: { name: string; url: string }
    }): Promise<{ accounts: AccountRow[]; selectedId?: string } | { error: string }>
  }
}
