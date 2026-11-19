import { describe, expect, it } from 'vitest'
import { dataDir, devUnlocked } from '../src/main/paths'

describe('dataDir', () => {
  it('GUISEDESK_DATA wins over dev and default', () => {
    expect(dataDir({ GUISEDESK_DATA: '/tmp/x', GUISEDESK_DEV: '1' }, '/home/u')).toBe('/tmp/x')
  })
  it('GUISEDESK_DEV=1 uses the dev dir', () => {
    expect(dataDir({ GUISEDESK_DEV: '1' }, '/home/u')).toBe('/home/u/.config/GuiseDesk-dev')
  })
  it('otherwise uses the daily dir', () => {
    expect(dataDir({}, '/home/u')).toBe('/home/u/.config/GuiseDesk')
  })
})

describe('devUnlocked', () => {
  const base = { GUISEDESK_DEV_UNLOCKED: '1', GUISEDESK_DATA: '/tmp/x' }
  it('needs DEV_UNLOCKED, DATA and (DEV or SHOT)', () => {
    expect(devUnlocked({ ...base, GUISEDESK_DEV: '1' }, '/tmp/x', '/home/u')).toBe(true)
    expect(devUnlocked({ ...base, GUISEDESK_SHOT: '/tmp/s.png' }, '/tmp/x', '/home/u')).toBe(true)
  })
  it('is false for DEV_UNLOCKED + DATA alone, and with any one missing', () => {
    expect(devUnlocked(base, '/tmp/x', '/home/u')).toBe(false)
    expect(devUnlocked({ GUISEDESK_DEV_UNLOCKED: '1', GUISEDESK_DEV: '1' }, '/tmp/x', '/home/u')).toBe(false)
    expect(devUnlocked({ GUISEDESK_DATA: '/tmp/x', GUISEDESK_DEV: '1' }, '/tmp/x', '/home/u')).toBe(false)
  })
  it('is false when the data dir is the daily dir, whatever the env', () => {
    const env = { ...base, GUISEDESK_DATA: '/home/u/.config/GuiseDesk', GUISEDESK_DEV: '1', GUISEDESK_SHOT: '/tmp/s.png' }
    expect(devUnlocked(env, '/home/u/.config/GuiseDesk', '/home/u')).toBe(false)
    expect(devUnlocked(env, '/home/u/.config/GuiseDesk/', '/home/u')).toBe(false)
    expect(devUnlocked(env, '/home/u/.config/../.config/GuiseDesk', '/home/u')).toBe(false)
  })
})
