import { describe, expect, it } from 'vitest'
import { dataDir } from '../src/main/paths'

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
