// @vitest-environment jsdom
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { compareVersions, createExtensionFetcher, enabledFor, extensionsFor, isKnownFor, readyCopy, toggled } from '../src/main/extensions'
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

describe('extension download (D49)', () => {
  const unpack = (root: string, id: string, name: string, manifest = true) => {
    const d = join(root, id, name)
    mkdirSync(d, { recursive: true })
    if (manifest) writeFileSync(join(d, 'manifest.json'), '{}')
    return d
  }
  it('readyCopy picks the newest complete version and removes leftovers of a broken install', () => {
    const root = mkdtempSync(join(tmpdir(), 'gd-ext-'))
    unpack(root, WAWP, '1fa783e5-bcb5-4cfc-b5a6-245578a01099')
    unpack(root, WAWP, '5.2.10_0', false)
    unpack(root, WAWP, '5.2.8_0')
    const best = unpack(root, WAWP, '5.2.9_0')
    expect(readyCopy(root, WAWP)).toBe(best)
    expect(readdirSync(join(root, WAWP)).sort()).toEqual(['5.2.8_0', '5.2.9_0'])
    expect(readyCopy(root, 'none')).toBeNull()
    expect(compareVersions([5, 2, 10], [5, 2, 9])).toBeGreaterThan(0)
  })
  it('the ENOTEMPTY case: an empty version folder left by a failed rename is cleared, then downloaded once', async () => {
    const root = mkdtempSync(join(tmpdir(), 'gd-ext-'))
    unpack(root, WAWP, '1fa783e5-bcb5-4cfc-b5a6-245578a01099')
    unpack(root, WAWP, '5.2.9_0', false)
    const download = vi.fn(async (id: string, dir: string) => {
      expect(existsSync(join(dir, id, '5.2.9_0'))).toBe(false)
      return unpack(dir, id, '5.2.9_0')
    })
    const fetch = createExtensionFetcher(root, download)
    const [a, b, c] = await Promise.all([fetch(WAWP), fetch(WAWP), fetch(WAWP)])
    expect(download).toHaveBeenCalledOnce()
    expect(a).toBe(b); expect(b).toBe(c)
    expect(await fetch(WAWP)).toBe(a)
    expect(download).toHaveBeenCalledOnce()
  })
})
