import { describe, expect, it } from 'vitest'
import { createHibernator, launchAsleep, limitMinutes } from '../src/main/hibernate'
import { decideNotification } from '../src/main/notify'

const acc = (id: string, serviceId: string, idlePolicy?: string) => ({
  id, serviceId, label: id, colour: '#000', order: 0, idlePolicy
})
const MIN = 60_000

describe('hibernation scheduler', () => {
  it('limits: feed 30, chat never, override always|10|30|60, default and unknown fall back to the kind', () => {
    expect(limitMinutes(acc('a', 'instagram', 'default'))).toBe(30)
    expect(limitMinutes(acc('a', 'instagram'))).toBe(30)
    expect(limitMinutes(acc('a', 'whatsapp', 'default'))).toBeNull()
    expect(limitMinutes(acc('a', 'instagram', '10'))).toBe(10)
    expect(limitMinutes(acc('a', 'instagram', 'always'))).toBeNull()
    expect(limitMinutes(acc('a', 'whatsapp', '60'))).toBe(60)
    expect(limitMinutes(acc('a', 'x', 'bogus'))).toBe(30)
  })

  it('feed sleeps at 30 min, chat never, selected never, override 10 min works', () => {
    let t = 0
    const h = createHibernator(() => t)
    const accounts = [acc('ig', 'instagram'), acc('wa', 'whatsapp'), acc('x', 'x', '10'), acc('sel', 'tiktok')]
    h.sweep(accounts, 'sel') // first sight starts every clock
    t = 9 * MIN
    expect(h.sweep(accounts, 'sel')).toEqual([])
    t = 10 * MIN
    expect(h.sweep(accounts, 'sel')).toEqual(['x'])
    expect(h.isAsleep('x')).toBe(true)
    t = 29 * MIN
    expect(h.sweep(accounts, 'sel')).toEqual([])
    t = 30 * MIN
    expect(h.sweep(accounts, 'sel')).toEqual(['ig'])
    t = 500 * MIN
    expect(h.sweep(accounts, 'sel')).toEqual([])
    expect(h.isAsleep('wa')).toBe(false)
    expect(h.isAsleep('sel')).toBe(false)
  })

  it('input and selection restart the clock; deselecting starts it from then', () => {
    let t = 0
    const h = createHibernator(() => t)
    const accounts = [acc('ig', 'instagram'), acc('th', 'threads')]
    h.sweep(accounts, 'th')
    t = 25 * MIN
    h.touch('ig')
    t = 40 * MIN
    expect(h.sweep(accounts, 'th')).toEqual([]) // ig used at 25
    t = 50 * MIN
    expect(h.sweep(accounts, 'ig')).toEqual([]) // th last selected at 40
    t = 69 * MIN
    expect(h.sweep(accounts, 'ig')).toEqual([])
    t = 70 * MIN
    expect(h.sweep(accounts, 'ig')).toEqual(['th'])
  })

  it('wake clears asleep and restarts the clock', () => {
    let t = 0
    const h = createHibernator(() => t)
    const accounts = [acc('ig', 'instagram'), acc('th', 'threads')]
    h.sweep(accounts, 'th')
    t = 30 * MIN
    expect(h.sweep(accounts, 'th')).toEqual(['ig'])
    h.wake('ig')
    expect(h.isAsleep('ig')).toBe(false)
    t = 59 * MIN
    expect(h.sweep(accounts, 'th')).toEqual([])
    t = 60 * MIN
    expect(h.sweep(accounts, 'th')).toEqual(['ig'])
  })

  it('manual sleep marks any account asleep, selected and chat included, the sweep leaves it, and wake clears it', () => {
    let t = 0
    const h = createHibernator(() => t)
    const accounts = [acc('wa', 'whatsapp'), acc('ig', 'instagram')]
    h.sweep(accounts, 'wa')
    h.sleep('wa')
    expect(h.isAsleep('wa')).toBe(true)
    t = 90 * MIN
    expect(h.sweep(accounts, 'wa')).toEqual(['ig'])
    expect(h.isAsleep('wa')).toBe(true)
    h.wake('wa')
    expect(h.isAsleep('wa')).toBe(false)
  })

  it('an asleep account is dropped by decideNotification', () => {
    let t = 0
    const h = createHibernator(() => t)
    const accounts = [acc('ig', 'instagram')]
    h.sweep(accounts, 'none')
    const ev = { accountId: 'ig', serviceName: 'Instagram', label: 'ig', title: 'Hi' }
    expect(decideNotification(ev, { asleep: h.isAsleep('ig') }).action).toBe('full')
    t = 30 * MIN
    h.sweep(accounts, 'none')
    expect(decideNotification(ev, { asleep: h.isAsleep('ig') }).action).toBe('drop')
  })
})

describe('sleep on launch (D39)', () => {
  const list = [acc('a', 'whatsapp'), acc('b', 'instagram'), acc('c', 'threads')]
  it('every account but the selected one', () => {
    expect(launchAsleep(list, 'b')).toEqual(['a', 'c'])
  })
  it('all of them when nothing or an unknown account is selected', () => {
    expect(launchAsleep(list, undefined)).toEqual(['a', 'b', 'c'])
    expect(launchAsleep(list, 'zzz')).toEqual(['a', 'b', 'c'])
  })
  it('empty list gives none', () => {
    expect(launchAsleep([], 'a')).toEqual([])
  })
})
