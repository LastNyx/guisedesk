import { describe, expect, it } from 'vitest'
import { decide, route } from '../src/main/links'
import type { Account } from '../src/main/accounts'

const acc = (serviceId: string, custom?: Account['custom']): Account => ({
  id: 'a1', serviceId, label: 'x', colour: '#000000', order: 0, custom
})
const custom = acc('custom', { name: 'Wiki', url: 'https://wiki.example.com/', hosts: ['wiki.example.com'] })

describe('links decide', () => {
  const table: [string, string, 'in-app' | 'external'][] = [
    ['whatsapp', 'https://web.whatsapp.com/', 'in-app'],
    ['whatsapp', 'https://static.whatsapp.net/x', 'in-app'],
    ['whatsapp', 'https://whatsapp.com/', 'in-app'],
    ['whatsapp', 'https://example.org/', 'external'],
    ['discord', 'https://discord.com/login', 'in-app'],
    ['discord', 'https://cdn.discordapp.com/a.png', 'in-app'],
    ['discord', 'https://discord.gg/abc', 'in-app'],
    ['instagram', 'https://www.instagram.com/p/1', 'in-app'],
    ['instagram', 'https://scontent.cdninstagram.com/a.jpg', 'in-app'],
    ['instagram', 'https://instagram.com.evil.io/', 'external'],
    ['instagram', 'https://evilinstagram.com/', 'external'],
    ['facebook', 'https://www.facebook.com/', 'in-app'],
    ['facebook', 'https://static.xx.fbcdn.net/a.js', 'in-app'],
    ['facebook', 'https://m.facebook.com/login', 'in-app'],
    ['x', 'https://x.com/home', 'in-app'],
    ['x', 'https://twitter.com/i/flow', 'in-app'],
    ['x', 'https://pbs.twimg.com/a.jpg', 'in-app'],
    ['x', 'https://t.co/abc', 'external'],
    ['threads', 'https://www.threads.net/', 'in-app'],
    ['threads', 'https://www.threads.com/', 'in-app'],
    ['threads', 'https://www.instagram.com/accounts/login', 'in-app'],
    ['tiktok', 'https://www.tiktok.com/', 'in-app'],
    ['tiktok', 'https://p16.tiktokcdn.com/a', 'in-app'],
    ['tiktok', 'https://example.org/', 'external'],
    ['whatsapp', 'mailto:a@b.co', 'external'],
    ['whatsapp', 'javascript:alert(1)', 'external'],
    ['whatsapp', 'not a url', 'external']
  ]
  it.each(table)('%s %s -> %s', (svc, url, want) => {
    expect(decide(url, acc(svc))).toBe(want)
  })

  it('custom account uses its own hosts', () => {
    expect(decide('https://wiki.example.com/a', custom)).toBe('in-app')
    expect(decide('https://sub.wiki.example.com/a', custom)).toBe('in-app')
    expect(decide('https://web.whatsapp.com/', custom)).toBe('external')
  })

  it('route: only mailto opens outside, other schemes are denied', () => {
    expect(route('mailto:a@b.co', acc('whatsapp'))).toEqual({ action: 'external', url: 'mailto:a@b.co' })
    expect(route('javascript:alert(1)', acc('whatsapp')).action).toBe('deny')
    expect(route('file:///etc/passwd', acc('whatsapp')).action).toBe('deny')
    expect(route('data:text/html,hi', custom).action).toBe('deny')
  })

  it('unwraps facebook l.php redirect to the target, opened externally', () => {
    const u = 'https://l.facebook.com/l.php?u=' + encodeURIComponent('https://example.org/page?a=1') + '&h=xyz'
    expect(route(u, acc('facebook'))).toEqual({ action: 'external', url: 'https://example.org/page?a=1' })
    expect(decide(u, acc('facebook'))).toBe('external')
  })

  it('unwraps instagram and threads wrappers; same-service targets stay in-app', () => {
    const t = encodeURIComponent('https://example.org/x')
    expect(route(`https://l.instagram.com/?u=${t}&e=1`, acc('instagram')).url).toBe('https://example.org/x')
    expect(route(`https://l.threads.net/?u=${t}`, acc('threads'))).toEqual({ action: 'external', url: 'https://example.org/x' })
    const same = encodeURIComponent('https://www.facebook.com/groups/1')
    expect(route(`https://l.facebook.com/l.php?u=${same}`, acc('facebook')).action).toBe('in-app')
  })

  it('a wrapper whose target is not http(s) is denied', () => {
    const u = 'https://l.facebook.com/l.php?u=' + encodeURIComponent('javascript:alert(1)')
    expect(route(u, acc('facebook')).action).toBe('deny')
  })
})
