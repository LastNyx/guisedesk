import { describe, expect, it } from 'vitest'
import { nextZoom, zoomKey, zoomPercent } from '../src/main/shortcuts'

const k = (key: string, over: Record<string, unknown> = {}) => ({ type: 'keyDown', key, control: true, shift: false, alt: false, meta: false, ...over })

describe('zoomKey', () => {
  it('maps Ctrl+= Ctrl++ Ctrl+- Ctrl+0 and numpad keys', () => {
    expect(zoomKey(k('='))).toBe('in')
    expect(zoomKey(k('+', { shift: true }))).toBe('in')
    expect(zoomKey(k('+', { code: 'NumpadAdd' }))).toBe('in')
    expect(zoomKey(k('-'))).toBe('out')
    expect(zoomKey(k('-', { code: 'NumpadSubtract' }))).toBe('out')
    expect(zoomKey(k('0'))).toBe('reset')
    expect(zoomKey(k('0', { code: 'Numpad0' }))).toBe('reset')
  })
  it('ignores other keys, missing Ctrl, alt, meta and key-up', () => {
    expect(zoomKey(k('a'))).toBeNull()
    expect(zoomKey(k('=', { control: false }))).toBeNull()
    expect(zoomKey(k('=', { alt: true }))).toBeNull()
    expect(zoomKey(k('=', { meta: true }))).toBeNull()
    expect(zoomKey(k('=', { type: 'keyUp' }))).toBeNull()
  })
})

describe('nextZoom', () => {
  it('steps by 0.5 and clamps to -3..5', () => {
    expect(nextZoom(0, 'in')).toBe(0.5)
    expect(nextZoom(0, 'out')).toBe(-0.5)
    expect(nextZoom(5, 'in')).toBe(5)
    expect(nextZoom(-3, 'out')).toBe(-3)
    expect(nextZoom(2, 'reset')).toBe(0)
  })
  it('zoomPercent is round(100 * 1.2^level)', () => {
    expect(zoomPercent(0)).toBe(100)
    expect(zoomPercent(1)).toBe(120)
    expect(zoomPercent(-1)).toBe(83)
    expect(zoomPercent(0.5)).toBe(110)
  })
})
