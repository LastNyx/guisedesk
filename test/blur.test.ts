// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { blurCss, parseBlurHint, revealTarget } from '../src/preload/blur'
import { addAccount, loadAccounts, setBlurMedia } from '../src/main/accounts'
import { PRESETS } from '../src/main/presets'
import AccountSheet from '../src/renderer/src/AccountSheet.vue'

const hint = { container: 'article', media: 'picture, img, video', skip: 'img[alt*="profile picture"]' }

describe('blurCss', () => {
  it('blurs media inside the container, minus shown and skipped ones', () => {
    const css = blurCss(hint)
    expect(css).toContain('article :is(picture, img, video)')
    expect(css).toContain(':not([data-gd-shown], [data-gd-shown] *)')
    expect(css).toContain(':not(:is(img[alt*="profile picture"]))')
    expect(css).toContain('filter: blur(28px)')
    expect(css).toContain('cursor: pointer')
    expect(blurCss({ container: 'article', media: 'img' })).not.toContain('profile')
  })
  it('parses main argument', () => {
    expect(parseBlurHint(['--gd-blur=' + JSON.stringify(hint)])).toEqual(hint)
    expect(parseBlurHint(['--gd-service'])).toBeNull()
    expect(parseBlurHint(['--gd-blur=nope'])).toBeNull()
  })
})

describe('revealTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <article>
        <img id="avatar" alt="zuck's profile picture">
        <span id="text">hello</span>
        <picture id="pic"><img id="inner"></picture>
        <video id="vid"></video>
      </article>
      <img id="outside">`
  })
  const el = (id: string) => document.getElementById(id)!
  it('returns the outermost unrevealed media, null for text, avatars and media outside a container', () => {
    expect(revealTarget(el('inner'), hint)).toBe(el('pic'))
    expect(revealTarget(el('vid'), hint)).toBe(el('vid'))
    expect(revealTarget(el('text'), hint)).toBeNull()
    expect(revealTarget(el('avatar'), hint)).toBeNull()
    expect(revealTarget(el('outside'), hint)).toBeNull()
  })
  it('returns null once shown', () => {
    el('pic').setAttribute('data-gd-shown', '')
    expect(revealTarget(el('inner'), hint)).toBeNull()
  })
})

describe('presets and the stored flag', () => {
  it('only x, threads, instagram and facebook have a hint', () => {
    expect(PRESETS.filter((p) => p.blurMedia).map((p) => p.id).sort()).toEqual(['facebook', 'instagram', 'threads', 'x'])
  })
  it('setBlurMedia stores the flag per account, default off', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-blur-'))
    const a = addAccount(dir, { serviceId: 'x', label: 'a', colour: '#6d5bd0' })
    const b = addAccount(dir, { serviceId: 'threads', label: 'b', colour: '#6d5bd0' })
    expect(loadAccounts(dir).every((x) => !x.blurMedia)).toBe(true)
    setBlurMedia(dir, a.id, true)
    expect(loadAccounts(dir).find((x) => x.id === a.id)?.blurMedia).toBe(true)
    expect(loadAccounts(dir).find((x) => x.id === b.id)?.blurMedia).toBeFalsy()
  })
})

describe('AccountSheet blur toggle', () => {
  const acc = (serviceId: string, blurMedia?: boolean) => ({ id: 'a1', serviceId, label: 'L', colour: '#6d5bd0', blurMedia })
  it('is shown only for services with a hint and emits the flipped value', async () => {
    for (const s of ['x', 'threads', 'instagram', 'facebook']) expect(mount(AccountSheet, { props: { account: acc(s) } }).find('[aria-label="Blur media until clicked"]').exists()).toBe(true)
    for (const s of ['whatsapp', 'discord', 'tiktok']) expect(mount(AccountSheet, { props: { account: acc(s) } }).find('[aria-label="Blur media until clicked"]').exists()).toBe(false)
    const w = mount(AccountSheet, { props: { account: acc('x') } })
    const t = w.find('[aria-label="Blur media until clicked"]')
    expect(t.attributes('aria-checked')).toBe('false')
    await t.trigger('click')
    expect(w.emitted('blur')![0]).toEqual([true])
    expect(mount(AccountSheet, { props: { account: acc('x', true) } }).find('[aria-label="Blur media until clicked"]').attributes('aria-checked')).toBe('true')
  })
})
