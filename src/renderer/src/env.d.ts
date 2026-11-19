declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface Window {
  guisedesk: {
    state(): Promise<{
      accounts: { id: string; serviceId: string; label: string; colour: string; order: number }[]
      selectedId?: string
    }>
    select(id: string): void
  }
}
