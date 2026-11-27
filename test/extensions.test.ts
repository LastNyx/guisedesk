// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { enabledFor, extensionsFor, isKnownFor, toggled } from '../src/main/extensions'
import AccountSheet from '../src/renderer/src/AccountSheet.vue'

const WAWP = 'ekcgkejcjdcmonfpmnljobemcbpnkamh'

describe('extensions (D49)', () => {
  it('WA Web Plus is offered only for WhatsApp', () => {
    expect(extensionsFor('whatsapp').map((x) => x.id)).toEqual([WAWP])
    expect(extensionsFor('instagram')).toEqual([])
    expect(isKnownFor(WAWP, 'discord')).toBe(false)
  })
  it('enabledFor drops ids not allowed for the service; toggled adds and removes once', () => {
    expect(enabledFor({ serviceId: 'whatsapp', extensions: [WAWP, 'zzz'] })).toEqual([WAWP])
    expect(enabledFor({ serviceId: 'x', extensions: [WAWP] })).toEqual([])
    expect(toggled(undefined, WAWP, true)).toEqual([WAWP])
    expect(toggled([WAWP], WAWP, true)).toEqual([WAWP])
    expect(toggled([WAWP], WAWP, false)).toEqual([])
  })
  it('the account sheet shows the switch for WhatsApp and emits extension', async () => {
    const w = mount(AccountSheet, { props: { account: { id: 'wa1', serviceId: 'whatsapp', label: 'P', colour: '#000' } } })
    const sw = w.find(`[data-ext="${WAWP}"]`)
    expect(sw.exists()).toBe(true)
    expect(sw.classes()).not.toContain('on')
    await sw.trigger('click')
    expect(w.emitted('extension')).toEqual([[WAWP, true]])
    const on = mount(AccountSheet, { props: { account: { id: 'wa1', serviceId: 'whatsapp', label: 'P', colour: '#000', extensions: [WAWP], extError: 'offline' } } })
    expect(on.find(`[data-ext="${WAWP}"]`).classes()).toContain('on')
    expect(on.text()).toContain('Extension could not be installed: offline')
    expect(mount(AccountSheet, { props: { account: { id: 'i1', serviceId: 'instagram', label: 'I', colour: '#000' } } }).find('[data-ext]').exists()).toBe(false)
  })
})
