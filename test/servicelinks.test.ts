import { describe, expect, it } from 'vitest'
import { candidatesFor } from '../src/main/servicelinks'
import { PRESETS } from '../src/main/presets'

const acc = (id: string, serviceId: string, order: number, custom?: { name: string; url: string; hosts: string[] }) =>
  ({ id, serviceId, label: id, colour: '#6d5bd0', order, ...(custom ? { custom } : {}) }) as never
const ids = (r: { id: string }[]) => r.map((a) => a.id)

const all = [
  acc('wa', 'whatsapp', 0), acc('ig1', 'instagram', 1), acc('th', 'threads', 2), acc('fb', 'facebook', 3),
  acc('ig2', 'instagram', 4), acc('c1', 'custom', 5, { name: 'Wiki', url: 'http://127.0.0.1:8000/', hosts: ['127.0.0.1'] })
]

describe('home hosts (D40)', () => {
  it('match the decision', () => {
    const h = Object.fromEntries(PRESETS.map((p) => [p.id, p.homeHosts]))
    expect(h).toEqual({
      whatsapp: ['whatsapp.com'], discord: ['discord.com', 'discord.gg'], instagram: ['instagram.com'],
      facebook: ['facebook.com', 'fb.com'], x: ['x.com', 'twitter.com'], threads: ['threads.com', 'threads.net'],
      tiktok: ['tiktok.com']
    })
  })
})

describe('candidatesFor', () => {
  it('an instagram link goes to instagram accounts only, in sidebar order (feeds by order)', () => {
    expect(ids(candidatesFor('https://www.instagram.com/p/abc/', all, []))).toEqual(['ig1', 'ig2'])
  })
  it('threads.net goes to threads', () => {
    expect(ids(candidatesFor('https://www.threads.net/@x', all, []))).toEqual(['th'])
  })
  it('a subdomain matches', () => {
    expect(ids(candidatesFor('https://m.facebook.com/x', all, []))).toEqual(['fb'])
  })
  it('a redirect wrapper is unwrapped', () => {
    expect(ids(candidatesFor('https://l.instagram.com/?u=' + encodeURIComponent('https://www.threads.com/@a'), all, []))).toEqual(['th'])
  })
  it('a disabled service is skipped', () => {
    expect(candidatesFor('https://instagram.com/x', all, ['instagram'])).toEqual([])
  })
  it('a custom account matches its own hosts', () => {
    expect(ids(candidatesFor('http://127.0.0.1:8000/page', all, []))).toEqual(['c1'])
  })
  it('non-http, bad and unknown urls give none', () => {
    expect(candidatesFor('mailto:a@instagram.com', all, [])).toEqual([])
    expect(candidatesFor('file:///etc/passwd', all, [])).toEqual([])
    expect(candidatesFor('not a url', all, [])).toEqual([])
    expect(candidatesFor('https://example.org/', all, [])).toEqual([])
  })
  it('chat accounts come before feeds', () => {
    const a = [acc('x1', 'x', 0), acc('d1', 'discord', 1)]
    expect(ids(candidatesFor('https://discord.gg/abc', a, []))).toEqual(['d1'])
    const m = [acc('f', 'facebook', 0), acc('f2', 'facebook', 1)]
    expect(ids(candidatesFor('https://fb.com/x', m, []))).toEqual(['f', 'f2'])
  })
})
