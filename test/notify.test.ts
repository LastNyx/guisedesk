import { describe, expect, it } from 'vitest'
import { decideNotification } from '../src/main/notify'

const event = {
  accountId: 'a1',
  serviceName: 'WhatsApp',
  label: 'Personal',
  title: 'Alice',
  body: 'Lunch at 12?',
  icon: 'https://example.com/a.png'
}

describe('decideNotification', () => {
  it('returns full with sender, body and service line for a normal account', () => {
    expect(decideNotification(event, {})).toEqual({
      action: 'full',
      accountId: 'a1',
      title: 'Alice',
      body: 'Lunch at 12?',
      subtitle: 'WhatsApp - Personal',
      icon: 'https://example.com/a.png'
    })
  })
  it('takes muted, dnd, asleep and locked flags (all false is the normal path)', () => {
    const off = { muted: false, dnd: false, asleep: false, locked: false }
    expect(decideNotification(event, off).action).toBe('full')
  })
  it('drops a muted account notification', () => {
    expect(decideNotification(event, { muted: true })).toEqual({ action: 'drop' })
  })
  it('drops everything while Do Not Disturb is on, and is normal again when off', () => {
    expect(decideNotification(event, { dnd: true })).toEqual({ action: 'drop' })
    expect(decideNotification(event, { dnd: true, muted: false }).action).toBe('drop')
    expect(decideNotification(event, { dnd: false }).action).toBe('full')
  })
})
