// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { blurCss, parseBlurHint, shouldBlur, watchBlur } from '../src/preload/blur'
import { addAccount, loadAccounts, setBlurMedia } from '../src/main/accounts'
import { PRESETS } from '../src/main/presets'
import AccountSheet from '../src/renderer/src/AccountSheet.vue'

const hint = { container: 'article' }

describe('blurCss and the hint argument', () => {
  it('blurs marked media until hovered, with no per-site media selectors', () => {
    const css = blurCss()
    expect(css).toContain('[data-gd-blur]:not([data-gd-hover])')
    expect(css).toContain('filter: blur(28px)')
    expect(css).not.toContain('cursor: pointer')
  })
  it('parses main argument (container only)', () => {
    expect(parseBlurHint(['--gd-blur=' + JSON.stringify({ container: 'article', media: 'img', skip: 'x' })])).toEqual(hint)
    expect(parseBlurHint(['--gd-service'])).toBeNull()
    expect(parseBlurHint(['--gd-blur=nope'])).toBeNull()
  })
})

describe('shouldBlur', () => {
  it('blurs img, video and background tiles of at least 100x100, never smaller ones or other tags', () => {
    expect(shouldBlur({ w: 224, h: 280 }, 'IMG')).toBe(true)
    expect(shouldBlur({ w: 100, h: 100 }, 'video')).toBe(true)
    expect(shouldBlur({ w: 300, h: 200 }, 'bg')).toBe(true)
    expect(shouldBlur({ w: 40, h: 40 }, 'IMG')).toBe(false)
    expect(shouldBlur({ w: 500, h: 99 }, 'IMG')).toBe(false)
    expect(shouldBlur({ w: 0, h: 0 }, 'PICTURE')).toBe(false)
    expect(shouldBlur({ w: 500, h: 500 }, 'PICTURE')).toBe(false)
  })
})

describe('watchBlur', () => {
  const size = (el: Element, w: number, h: number) => { el.getBoundingClientRect = () => ({ width: w, height: h, left: 0, top: 0, right: w, bottom: h, x: 0, y: 0, toJSON() {} }) }
  const el = (id: string) => document.getElementById(id)!
  const flush = async () => { await Promise.resolve(); vi.advanceTimersByTime(100) }
  let stop: (() => void) | null = null
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = `
      <article>
        <img id="avatar"><picture id="pic"><img id="photo"></picture>
        <video id="vid"></video>
        <div id="tile" style="background-image: url(a.jpg)"></div>
        <span id="text">hello</span>
        <div id="wrap"><img id="ghost"></div>
      </article>
      <img id="outside">`
    size(el('avatar'), 40, 40); size(el('pic'), 0, 0); size(el('photo'), 224, 280); size(el('vid'), 224, 280); size(el('tile'), 300, 200); size(el('outside'), 400, 400); size(el('wrap'), 224, 280); size(el('ghost'), 224, 280)
    el('ghost').style.pointerEvents = 'none'
  })
  afterEach(() => { stop?.(); stop = null; vi.useRealTimers() })
  const marked = () => [...document.querySelectorAll('[data-gd-blur]')].map((e) => e.id).sort()

  it('marks big media inside the container only, not the picture wrapper, avatars or outside media', () => {
    stop = watchBlur(window, hint).stop
    expect(marked()).toEqual(['ghost', 'photo', 'tile', 'vid'])
  })
  it('marks media added later and media that grows, unmarks one that shrinks', async () => {
    stop = watchBlur(window, hint).stop
    const added = document.createElement('img')
    added.id = 'added'
    size(added, 200, 200)
    document.querySelector('article')!.append(added)
    await flush()
    expect(marked()).toContain('added')
    size(el('avatar'), 120, 120)
    document.querySelector('article')!.append(document.createElement('i'))
    await flush()
    expect(marked()).toContain('avatar')
    size(el('avatar'), 30, 30)
    document.querySelector('article')!.append(document.createElement('i'))
    await flush()
    expect(marked()).not.toContain('avatar')
  })
  it('stop() removes every mark and hover', () => {
    const w = watchBlur(window, hint)
    w.stop()
    expect(marked()).toEqual([])
  })
  it('a pointer resting 300 ms over media reveals it (through overlays), leaving blurs again', () => {
    const overlay = document.createElement('div')
    document.body.append(overlay)
    stop = watchBlur(window, hint).stop
    let stack: Element[] = [overlay, el('photo'), el('pic')]
    document.elementsFromPoint = () => stack
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, clientY: 5 }))
    vi.advanceTimersByTime(299)
    expect(el('photo').hasAttribute('data-gd-hover')).toBe(false)
    vi.advanceTimersByTime(2)
    expect(el('photo').hasAttribute('data-gd-hover')).toBe(true)
    expect(el('vid').hasAttribute('data-gd-hover')).toBe(false)
    stack = [overlay]
    vi.advanceTimersByTime(100)
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 900 }))
    expect(el('photo').hasAttribute('data-gd-hover')).toBe(false)
  })
  it('finds media with pointer-events none (Threads) through the box that holds it', () => {
    stop = watchBlur(window, hint).stop
    document.elementsFromPoint = () => [el('wrap')]
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, clientY: 5 }))
    vi.advanceTimersByTime(301)
    expect(el('ghost').hasAttribute('data-gd-hover')).toBe(true)
    expect(el('photo').hasAttribute('data-gd-hover')).toBe(false)
  })
  it('moving away before 300 ms never reveals, and clicks are not intercepted', () => {
    stop = watchBlur(window, hint).stop
    let stack: Element[] = [el('vid')]
    document.elementsFromPoint = () => stack
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, clientY: 5 }))
    vi.advanceTimersByTime(200)
    stack = []
    vi.advanceTimersByTime(100)
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 900 }))
    vi.advanceTimersByTime(1000)
    expect(el('vid').hasAttribute('data-gd-hover')).toBe(false)
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    el('photo').dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
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
