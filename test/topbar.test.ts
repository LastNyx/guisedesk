// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TopBar from '../src/renderer/src/TopBar.vue'
import { panelBounds, TOP_BAR_H, TOP_BAR_GAP, PAD_TOP } from '../src/main/layout'

const wa = { id: 'wa1', serviceId: 'whatsapp', label: 'Personal', colour: '#2f9e6e', order: 1 }
const ig = { id: 'ig1', serviceId: 'instagram', label: 'Shop', colour: '#b04c7a', order: 2 }

describe('TopBar', () => {
  it('shows bold label, muted service and the chip for live chat / asleep / muted / live feed', () => {
    const w = mount(TopBar, { props: { account: wa, asleep: false } })
    expect(w.find('.title').text()).toBe('Personal · WhatsApp')
    expect(w.find('.title').element.childNodes[0].textContent).toBe('Personal ')
    expect(w.find('.title span').text()).toBe('· WhatsApp')
    expect(w.find('.chip').text()).toBe('Always on')
    expect(w.find('.chip').classes()).toContain('live')
    const asleep = mount(TopBar, { props: { account: ig, asleep: true } })
    expect(asleep.find('.chip').text()).toBe('Asleep')
    expect(asleep.find('.chip').classes()).not.toContain('live')
    const muted = mount(TopBar, { props: { account: { ...wa, muted: true }, asleep: false } })
    expect(muted.find('.chip').text()).toBe('Muted')
    expect(muted.find('.chip').classes()).not.toContain('live')
    expect(mount(TopBar, { props: { account: ig, asleep: false } }).find('.chip').exists()).toBe(false)
    // an always-on override on a feed account counts
    expect(mount(TopBar, { props: { account: { ...ig, idlePolicy: 'always' }, asleep: false } }).find('.chip').text()).toBe('Always on')
  })

  it('Reload, Mute, Lock and Settings buttons emit their actions; bell-off when muted', async () => {
    const w = mount(TopBar, { props: { account: wa, asleep: false } })
    const b = w.findAll('.actions .ib')
    expect(b).toHaveLength(5)
    for (const x of b) await x.trigger('click')
    expect(w.emitted('reload')).toHaveLength(1)
    expect(w.emitted('mute')).toEqual([[true]])
    expect(w.emitted('lock')).toHaveLength(1)
    expect(w.emitted('settings')).toHaveLength(1)
    const m = mount(TopBar, { props: { account: { ...wa, muted: true }, asleep: false } })
    expect(m.find('[aria-label="Unmute"]').exists()).toBe(true)
    await m.find('[aria-label="Unmute"]').trigger('click')
    expect(m.emitted('mute')).toEqual([[false]])
  })
})

describe('TopBar Sleep now', () => {
  it('shows a Sleep now button left of Lock only when awake, and emits sleep', async () => {
    const w = mount(TopBar, { props: { account: wa, asleep: false } })
    const labels = w.findAll('.actions .ib').map((b) => b.attributes('aria-label'))
    expect(labels.indexOf('Sleep now')).toBe(labels.indexOf('Lock now') - 1)
    expect(w.find('[aria-label="Sleep now"]').attributes('title')).toBe('Sleep now')
    await w.find('[aria-label="Sleep now"]').trigger('click')
    expect(w.emitted('sleep')).toHaveLength(1)
    expect(mount(TopBar, { props: { account: wa, asleep: true } }).find('[aria-label="Sleep now"]').exists()).toBe(false)
  })
})

describe('layout with the bar', () => {
  it('panel bounds move down by the bar height in both sidebar modes', () => {
    expect([TOP_BAR_H, TOP_BAR_GAP]).toEqual([34, 12])
    expect(panelBounds(1240, 780, false)).toEqual({ x: 248, y: PAD_TOP + 46, width: 976, height: 780 - 12 - 46 - 16 })
    expect(panelBounds(1240, 780, true)).toEqual({ x: 80, y: 58, width: 1144, height: 706 })
  })
})

async function app(over: Record<string, unknown> = {}, lock = 'unlocked') {
  const App = (await import('../src/renderer/src/App.vue')).default
  const g = {
    lockState: async () => ({ state: lock }),
    onLock: () => {},
    state: async () => ({ accounts: [wa, ig], selectedId: 'wa1', disabledServices: [] }),
    unread: async () => ({}),
    onUnread: () => {},
    onSelected: () => {},
    onOpenSettings: () => {},
    sleep: async () => ({}),
    onSleep: () => {},
    onSidebar: () => {},
    onZoom: () => {},
    onLinkChoose: () => {},
    onUpdate: () => {},
    updateState: async () => ({ state: 'none' }),
    select: vi.fn(),
    dialog: vi.fn(),
    lock: vi.fn(),
    reload: vi.fn(),
    sleepNow: vi.fn(),
    mute: vi.fn(async () => ({ accounts: [{ ...wa, muted: true }, ig], selectedId: 'wa1', disabledServices: [] })),
    ...over
  }
  ;(window as unknown as { guisedesk: unknown }).guisedesk = g
  const w = mount(App)
  await flushPromises()
  return { w, g }
}

describe('App top bar', () => {
  it('buttons call the bridge: reload, mute flips the shared flag, lock, Settings opens the sheet', async () => {
    const { w, g } = await app()
    expect(w.find('.top .title').text()).toBe('Personal · WhatsApp')
    const b = w.findAll('.top .actions .ib')
    await b[0].trigger('click')
    expect(g.reload).toHaveBeenCalledWith('wa1')
    await b[1].trigger('click')
    await flushPromises()
    expect(g.mute).toHaveBeenCalledWith('wa1', true)
    expect(w.find('.top .chip').text()).toBe('Muted')
    await b[2].trigger('click')
    expect(g.sleepNow).toHaveBeenCalledWith('wa1')
    await b[3].trigger('click')
    expect(g.lock).toHaveBeenCalled()
    await b[4].trigger('click')
    expect(w.find('.top .actions').exists()).toBe(false)
    expect(w.findComponent({ name: 'AccountSheet' }).exists()).toBe(true)
  })

  it('is not rendered while locked or in Settings, and shows Asleep for a sleeping account', async () => {
    expect((await app({}, 'locked')).w.find('.top .actions').exists()).toBe(false)
    const { w } = await app({ sleep: async () => ({ wa1: { minutes: 30, waking: false } }) })
    expect(w.find('.top .chip').text()).toBe('Asleep')
  })
})

describe('TopBar zoom chip', () => {
  it('shows NNN% only when zoomed, and a click emits reset-zoom', async () => {
    expect(mount(TopBar, { props: { account: wa, asleep: false } }).find('.zoom').exists()).toBe(false)
    expect(mount(TopBar, { props: { account: { ...wa, zoom: 0 }, asleep: false } }).find('.zoom').exists()).toBe(false)
    const w = mount(TopBar, { props: { account: { ...wa, zoom: 1 }, asleep: false } })
    expect(w.find('.zoom').text()).toBe('120%')
    expect(w.find('.zoom').attributes('title')).toBe('Reset zoom')
    await w.find('.zoom').trigger('click')
    expect(w.emitted('reset-zoom')).toHaveLength(1)
  })
})
