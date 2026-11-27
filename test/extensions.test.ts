// @vitest-environment jsdom
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { actionClick, compareVersions, createExtensionFetcher, enabledFor, listInstalled, parseExtensionId, readManifest, readyCopy, toggled } from '../src/main/extensions'
import { appendEvent, lostLogins } from '../src/main/events'
import SettingsExtensions from '../src/renderer/src/SettingsExtensions.vue'

const WAWP = 'ekcgkejcjdcmonfpmnljobemcbpnkamh'

describe('extensions (D49)', () => {
  it('parses store links (new and old) and bare ids; rejects others', () => {
    expect(parseExtensionId('https://chromewebstore.google.com/detail/wa-web-plus-by-elbruz-tec/ekcgkejcjdcmonfpmnljobemcbpnkamh?hl=en')).toBe(WAWP)
    expect(parseExtensionId('https://chrome.google.com/webstore/detail/x/ekcgkejcjdcmonfpmnljobemcbpnkamh')).toBe(WAWP)
    expect(parseExtensionId(' ' + WAWP + ' ')).toBe(WAWP)
    expect(parseExtensionId('https://evil.example/detail/x/ekcgkejcjdcmonfpmnljobemcbpnkamh')).toBeNull()
    expect(parseExtensionId('hello')).toBeNull()
  })
  it('enabledFor keeps only installed ids; toggled adds and removes once', () => {
    expect(enabledFor({ extensions: [WAWP, 'zzz'] }, [WAWP])).toEqual([WAWP])
    expect(enabledFor({}, [WAWP])).toEqual([])
    expect(toggled(undefined, WAWP, true)).toEqual([WAWP])
    expect(toggled([WAWP], WAWP, true)).toEqual([WAWP])
    expect(toggled([WAWP], WAWP, false)).toEqual([])
  })
  it('listInstalled reads names (with __MSG_ locales) and versions', () => {
    const root = mkdtempSync(join(tmpdir(), 'gd-ext-'))
    const d = join(root, WAWP, '5.2.9_0')
    mkdirSync(join(d, '_locales', 'en'), { recursive: true })
    writeFileSync(join(d, 'manifest.json'), JSON.stringify({ name: '__MSG_appName__', default_locale: 'en' }))
    writeFileSync(join(d, '_locales', 'en', 'messages.json'), JSON.stringify({ appName: { message: 'WA Web Plus' } }))
    mkdirSync(join(root, 'not-an-id'))
    expect(listInstalled(root).map(({ id, name, version }) => ({ id, name, version }))).toEqual([{ id: WAWP, name: 'WA Web Plus', version: '5.2.9' }])
  })
})

describe('toolbar click target (D54)', () => {
  it('opens the popup of an MV3 action or MV2 browser_action that declares default_popup', () => {
    expect(actionClick({ manifest_version: 3, action: { default_popup: 'popup.html' } })).toEqual({ kind: 'popup', popup: 'popup.html' })
    expect(actionClick({ manifest_version: 2, browser_action: { default_popup: ' ui.html ' } })).toEqual({ kind: 'popup', popup: 'ui.html' })
  })
  it('dispatches onClicked when there is no popup, a blank one, or no declarative action at all', () => {
    expect(actionClick({ manifest_version: 3, action: {} })).toEqual({ kind: 'onClicked' })
    expect(actionClick({ manifest_version: 3, action: { default_popup: '  ' } })).toEqual({ kind: 'onClicked' })
    expect(actionClick({ manifest_version: 3, action: 'x' })).toEqual({ kind: 'onClicked' })
    expect(actionClick({ manifest_version: 2, action: { default_popup: 'wrong-key.html' } })).toEqual({ kind: 'onClicked' })
    expect(actionClick({ manifest_version: 3, browser_action: { default_popup: 'wrong-key.html' } })).toEqual({ kind: 'onClicked' })
    expect(actionClick(null)).toEqual({ kind: 'onClicked' })
  })
  it('readManifest reads a real folder and survives a missing manifest', () => {
    const root = mkdtempSync(join(tmpdir(), 'gd-ext-'))
    writeFileSync(join(root, 'manifest.json'), JSON.stringify({ name: 'WA Web Plus', manifest_version: 3 }))
    expect(readManifest(root)).toMatchObject({ name: 'WA Web Plus', manifest_version: 3 })
    expect(readManifest(join(root, 'nope'))).toEqual({})
  })
})

describe('Settings > Extensions', () => {
  it('adds from a link, toggles per account and removes', async () => {
    const row = { id: WAWP, name: 'WA Web Plus', version: '5.2.9' }
    const acc = { id: 'wa1', serviceId: 'whatsapp', label: 'Personal', colour: '#000', order: 0 }
    const setExtension = vi.fn(async () => ({ accounts: [{ ...acc, extensions: [WAWP] }], disabledServices: [] }))
    ;(window as unknown as { guisedesk: unknown }).guisedesk = {
      extensions: async () => [],
      installExtension: vi.fn(async () => ({ ok: true, list: [row] })),
      removeExtension: vi.fn(async () => []),
      setExtension
    }
    const w = mount(SettingsExtensions, { props: { accounts: [acc] } })
    await flushPromises()
    expect(w.text()).toContain('No extensions yet')
    await w.find('input').setValue('https://chromewebstore.google.com/detail/x/' + WAWP)
    await w.find('.btn.pri').trigger('click')
    await flushPromises()
    const card = w.find(`[data-ext="${WAWP}"]`)
    expect(card.text()).toContain('WA Web Plus')
    await card.find('.tg').trigger('click')
    await flushPromises()
    expect(setExtension).toHaveBeenCalledWith('wa1', WAWP, true)
    expect(w.find(`[data-ext="${WAWP}"] .tg`).classes()).toContain('on')
    await w.find(`[data-ext="${WAWP}"] .btn`).trigger('click')
    await flushPromises()
    expect(w.find(`[data-ext="${WAWP}"]`).exists()).toBe(false)
  })
  it('a bad link shows the error from main', async () => {
    ;(window as unknown as { guisedesk: unknown }).guisedesk = {
      extensions: async () => [],
      installExtension: async () => ({ error: 'Paste a Chrome Web Store link' })
    }
    const w = mount(SettingsExtensions, { props: { accounts: [] } })
    await flushPromises()
    await w.find('input').setValue('nope')
    await w.find('.btn.pri').trigger('click')
    await flushPromises()
    expect(w.find('.hint.warn').text()).toBe('Paste a Chrome Web Store link')
  })
})

describe('events log (D50)', () => {
  it('lostLogins reports only logins present before and gone now', () => {
    expect(lostLogins({ a: true, b: true, c: false }, { a: false, b: true, c: false, d: false })).toEqual(['a'])
  })
  it('appendEvent writes timestamped lines', () => {
    const d = mkdtempSync(join(tmpdir(), 'gd-ev-'))
    appendEvent(d, 'start v1', new Date('2026-11-27T01:00:00Z'))
    appendEvent(d, 'quit\nx', new Date('2026-11-27T01:00:05Z'))
    expect(readFileSync(join(d, 'events.log'), 'utf8')).toBe('2026-11-27T01:00:00.000Z start v1\n2026-11-27T01:00:05.000Z quit x\n')
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

describe('TopBar puzzle chip', () => {
  it('shows while awake and emits extensions', async () => {
    const { default: TopBar } = await import('../src/renderer/src/TopBar.vue')
    const acc = { id: 'wa1', serviceId: 'whatsapp', label: 'P', colour: '#000', order: 0 }
    const w = mount(TopBar, { props: { account: acc, asleep: false } })
    await w.find('.extbtn').trigger('click')
    expect(w.emitted('extensions')).toHaveLength(1)
    expect(mount(TopBar, { props: { account: acc, asleep: true } }).find('.extbtn').exists()).toBe(false)
  })
})
