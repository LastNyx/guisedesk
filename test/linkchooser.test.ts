// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import LinkChooser from '../src/renderer/src/LinkChooser.vue'
import App from '../src/renderer/src/App.vue'

const candidates = [
  { id: 'ig1', label: 'Shop', colour: '#b04c7a', serviceId: 'instagram' },
  { id: 'ig2', label: 'Personal Me', colour: '#2f7fb6', serviceId: 'instagram' }
]
const url = 'https://www.instagram.com/p/' + 'a'.repeat(120)

describe('LinkChooser', () => {
  it('lists the title, a shortened url, one row per candidate and Open in browser', () => {
    const w = mount(LinkChooser, { props: { url, candidates } })
    expect(w.find('h3').text()).toBe('Open link in')
    expect(w.find('.url').text().length).toBeLessThan(url.length)
    expect(w.find('.url').text().startsWith('https://www.instagram.com/')).toBe(true)
    const rows = w.findAll('.row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Shop')
    expect(rows[0].text()).toContain('Instagram')
    expect(rows[0].find('.av').text()).toContain('SH')
    expect(rows[1].find('.av').text()).toContain('PM')
    expect(w.findAll('.btn').some((b) => b.text() === 'Open in browser')).toBe(true)
  })
  it('emits the picked account, browser, or null for Esc and backdrop', async () => {
    const w = mount(LinkChooser, { props: { url, candidates } })
    await w.findAll('.row')[1].trigger('click')
    await w.findAll('.btn').find((b) => b.text() === 'Open in browser')!.trigger('click')
    await w.find('.veil').trigger('keydown', { key: 'Escape' })
    await w.find('.veil').trigger('click')
    await w.find('.glass').trigger('click')
    expect(w.emitted('choose')).toEqual([['ig2'], ['browser'], [null], [null]])
  })
})

describe('App link chooser', () => {
  it('shows the chooser when main asks, answers with the main id, detaches the view and clears', async () => {
    let ask: (r: unknown) => void = () => {}
    const bridge = {
      lockState: async () => ({ state: 'unlocked' }), onLock: () => {},
      state: async () => ({ accounts: [], selectedId: undefined, disabledServices: [] }),
      unread: async () => ({}), onUnread: () => {}, onSelected: () => {}, onOpenSettings: () => {},
      sleep: async () => ({}), onSleep: () => {}, onSidebar: () => {}, onZoom: () => {}, onUpdate: () => {},
      updateState: async () => ({ state: 'none' }), dialog: vi.fn(), chooseLink: vi.fn(),
      onLinkChoose: (cb: (r: unknown) => void) => (ask = cb)
    }
    ;(window as unknown as { guisedesk: unknown }).guisedesk = bridge
    const w = mount(App)
    await flushPromises()
    expect(w.find('.veil').exists()).toBe(false)
    ask({ id: 7, url, candidates })
    await flushPromises()
    expect(bridge.dialog).toHaveBeenCalledWith(true)
    await w.findAll('.row')[0].trigger('click')
    expect(bridge.chooseLink).toHaveBeenCalledWith(7, 'ig1')
    expect(bridge.dialog).toHaveBeenLastCalledWith(false)
    expect(w.find('.veil').exists()).toBe(false)
  })
})
