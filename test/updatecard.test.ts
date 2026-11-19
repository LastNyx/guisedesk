// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { version } from '../package.json'
import App from '../src/renderer/src/App.vue'
import SettingsGeneral from '../src/renderer/src/SettingsGeneral.vue'
import Sidebar from '../src/renderer/src/Sidebar.vue'

const accounts = [{ id: 'wa1', serviceId: 'whatsapp', label: 'Personal', colour: '#6d5bd0', order: 0 }]

describe('Settings > General Updates card', () => {
  beforeEach(() => {
    ;(window as unknown as { guisedesk: unknown }).guisedesk = {
      prefs: async () => ({ idleLock: 10, dnd: false, startOnLogin: false }),
      downloads: async () => ({ dir: '/dl', ask: false })
    }
  })
  const card = async (update: UpdateInfo) => {
    const w = mount(SettingsGeneral, { props: { update } })
    await flushPromises()
    return w.findAll('.card').find((c) => c.find('h4').text() === 'Updates')!
  }

  it('shows the version and one status line per state', async () => {
    const status = async (u: UpdateInfo) => (await card(u)).find('.t span').text()
    expect((await card({ state: 'none' })).find('.t b').text()).toBe(`GuiseDesk v${version}`)
    expect(await status({ state: 'none' })).toBe('Up to date')
    expect(await status({ state: 'available', latest: 'v9.9.9' })).toBe('v9.9.9 available')
    expect(await status({ state: 'error', message: 'timed out' })).toBe('Could not check: timed out')
    expect(await status({ state: 'disabled' })).toBe('Not available in this install')
    expect(await status({ state: 'checking' })).toBe('Checking...')
  })

  it('Check for updates emits check; Update and restart exists only when available and emits apply', async () => {
    const none = await card({ state: 'none' })
    expect(none.findAll('.btn').map((b) => b.text())).toEqual(['Check for updates'])
    const w = mount(SettingsGeneral, { props: { update: { state: 'available', latest: 'v9.9.9' } } })
    await flushPromises()
    expect(w.findAll('.btn').slice(1).map((b) => b.text())).toEqual(['Check for updates', 'Update and restart'])
    await w.findAll('.btn')[1].trigger('click')
    await w.find('.btn.pri').trigger('click')
    expect(w.emitted('check')).toHaveLength(1)
    expect(w.emitted('apply')).toHaveLength(1)
  })
})

describe('Sidebar update pill', () => {
  it('shows only when an update is available, next to the version, and emits update on click', async () => {
    expect(mount(Sidebar, { props: { accounts } }).find('.foot .upd').exists()).toBe(false)
    const w = mount(Sidebar, { props: { accounts, update: true } })
    expect(w.find('.foot .upd').text()).toBe('Update')
    await w.find('.foot .upd').trigger('click')
    expect(w.emitted('update')).toHaveLength(1)
  })

  it('in the rail it is a dot on the toggle area', () => {
    const w = mount(Sidebar, { props: { accounts, update: true, collapsed: true } })
    expect(w.find('.foot .upd').exists()).toBe(true)
    expect(w.find('.foot .upd').text()).toBe('')
  })
})

describe('Update in the app', () => {
  let push: (u: unknown) => void
  let bridge: Record<string, ReturnType<typeof vi.fn>>
  beforeEach(() => {
    bridge = {
      lockState: vi.fn(async () => ({ state: 'unlocked' })),
      onLock: vi.fn(),
      state: vi.fn(async () => ({ accounts, selectedId: 'wa1', disabledServices: [] })),
      unread: vi.fn(async () => ({})),
      onUnread: vi.fn(),
      onSelected: vi.fn(),
      sleep: vi.fn(async () => ({})),
      onSleep: vi.fn(),
      onSidebar: vi.fn(),
      onOpenSettings: vi.fn(),
      select: vi.fn(),
      dialog: vi.fn(),
      prefs: vi.fn(async () => ({ idleLock: 10, dnd: false, startOnLogin: false })),
      downloads: vi.fn(async () => ({ dir: '/dl', ask: false })),
      updateState: vi.fn(async () => ({ state: 'available', latest: 'v9.9.9' })),
      updateCheck: vi.fn(async () => ({ state: 'none' })),
      updateApply: vi.fn(async () => true),
      onUpdate: vi.fn((cb) => (push = cb))
    }
    ;(window as unknown as { guisedesk: unknown }).guisedesk = bridge
  })

  it('the pill opens Settings on General; Check and Update and restart call main; main pushes change the pill', async () => {
    const w = mount(App)
    await flushPromises()
    await w.find('.foot .upd').trigger('click')
    expect(w.find('.tabs .sel').text()).toBe('General')
    const btn = (t: string) => w.findAll('.btn').find((b) => b.text() === t)!
    await btn('Check for updates').trigger('click')
    await flushPromises()
    expect(bridge.updateCheck).toHaveBeenCalled()
    expect(w.find('.foot .upd').exists()).toBe(false)
    push({ state: 'available', latest: 'v9.9.10' })
    await flushPromises()
    expect(w.find('.foot .upd').exists()).toBe(true)
    await btn('Update and restart').trigger('click')
    expect(bridge.updateApply).toHaveBeenCalled()
  })
})
