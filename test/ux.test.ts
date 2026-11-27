// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AccountSheet from '../src/renderer/src/AccountSheet.vue'
import AddAccount from '../src/renderer/src/AddAccount.vue'
import Settings from '../src/renderer/src/Settings.vue'
import Sidebar from '../src/renderer/src/Sidebar.vue'
import { clampSide, panelBounds, SIDE_HIDDEN, sideWidth } from '../src/main/layout'

const acc = { id: 'wa1', serviceId: 'whatsapp', label: 'P', colour: '#000', order: 0 }

describe('closing dialogs (D53)', () => {
  it('account sheet: X and a click outside close it', async () => {
    const w = mount(AccountSheet, { props: { account: acc } })
    await w.find('.ib.x').trigger('click')
    await w.find('.veil').trigger('click')
    expect(w.emitted('done')).toHaveLength(2)
  })
  it('add account: X and a click outside cancel', async () => {
    const w = mount(AddAccount, { props: { accounts: [] } })
    await w.find('.ib.x').trigger('click')
    await w.find('.veil').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(2)
  })
  it('settings has a close button', async () => {
    const w = mount(Settings, { props: { accounts: [], disabled: [] }, global: { stubs: { SettingsServices: true } } })
    await w.find('.ib.x.close').trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })
})

describe('sidebar hide and resize (D52)', () => {
  it('widths: saved width clamped 180..420, rail 64, hidden strip 24; the page follows', () => {
    expect(clampSide(100)).toBe(180)
    expect(clampSide(999)).toBe(420)
    expect(clampSide('x')).toBe(232)
    expect(sideWidth(false, 300)).toBe(300)
    expect(sideWidth(true, 300)).toBe(64)
    expect(sideWidth(false, 300, true)).toBe(SIDE_HIDDEN)
    expect(panelBounds(1240, 780, false, 300).x).toBe(316)
    expect(panelBounds(1240, 780, false, 300, true).x).toBe(40)
  })
  it('uses the saved width, has a hide button and a drag grip', async () => {
    ;(window as unknown as { guisedesk: unknown }).guisedesk = { onRowMenuPick: () => {}, rowMenu: () => {} }
    const w = mount(Sidebar, { props: { accounts: [acc], width: 300 } })
    expect(w.find('aside').attributes('style')).toContain('width: 300px')
    await w.find('.foot .hide').trigger('click')
    expect(w.emitted('hide')).toHaveLength(1)
    expect(w.find('.grip').exists()).toBe(true)
    expect(mount(Sidebar, { props: { accounts: [acc], collapsed: true } }).find('.grip').exists()).toBe(false)
  })
})
