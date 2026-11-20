// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { pickPostLink, parseHint } from '../src/preload/postlink'
import { acceptPopupRequest } from '../src/main/popups'
import { PRESETS } from '../src/main/presets'
import type { Account } from '../src/main/accounts'

const hint = { container: '[data-pressable-container]', link: 'a[href*="/post/"]' }

describe('pickPostLink', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-pressable-container id="outer">
        <a href="/@zuck">zuck</a>
        <a href="/@zuck/post/AAA">1h</a>
        <span id="body">post text</span>
        <div data-pressable-container id="quoted"><a href="/@other/post/BBB">2h</a><span id="qbody">quoted</span></div>
      </div>
      <div data-pressable-container id="nolink"><span id="nl">no link</span></div>
      <p id="outside">outside</p>`
  })
  const el = (id: string) => document.getElementById(id)!

  it('inside a container returns the first post link as an absolute href', () => {
    expect(pickPostLink(el('body'), hint)).toBe(new URL('/@zuck/post/AAA', location.href).href)
  })
  it('outside any container returns null', () => {
    expect(pickPostLink(el('outside'), hint)).toBeNull()
  })
  it('a container without a post link returns null', () => {
    expect(pickPostLink(el('nl'), hint)).toBeNull()
  })
  it('a click in the quoted post still picks its own container link', () => {
    expect(pickPostLink(el('qbody'), hint)).toBe(new URL('/@other/post/BBB', location.href).href)
  })
  it('the outer post link wins over a quoted one that comes later', () => {
    expect(pickPostLink(el('outer'), hint)).toBe(new URL('/@zuck/post/AAA', location.href).href)
  })
})

describe('parseHint', () => {
  it('reads the --gd-postlink argument, ignores junk', () => {
    expect(parseHint(['x', '--gd-postlink=' + JSON.stringify(hint)])).toEqual(hint)
    expect(parseHint(['x'])).toBeNull()
    expect(parseHint(['--gd-postlink={bad'])).toBeNull()
  })
})

describe('threads preset', () => {
  it('carries the post link hint, other services none', () => {
    expect(PRESETS.find((x) => x.id === 'threads')?.postLink).toEqual(hint)
    expect(PRESETS.filter((x) => x.id !== 'threads' && x.postLink)).toEqual([])
  })
})

describe('acceptPopupRequest', () => {
  const acc = { id: 'a', serviceId: 'threads' } as Account
  it('an in-app url is accepted', () => {
    expect(acceptPopupRequest('https://www.threads.com/@zuck/post/AAA', acc)).toBe('https://www.threads.com/@zuck/post/AAA')
  })
  it('an external url is dropped', () => {
    expect(acceptPopupRequest('https://example.com/post/1', acc)).toBeNull()
  })
  it('a denied or junk url is dropped', () => {
    expect(acceptPopupRequest('javascript:alert(1)', acc)).toBeNull()
    expect(acceptPopupRequest('nope', acc)).toBeNull()
    expect(acceptPopupRequest(42 as unknown as string, acc)).toBeNull()
  })
})
