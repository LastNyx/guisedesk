import { describe, expect, it } from 'vitest'
import { countsAsInput } from '../src/preload/touch'

describe('idle touch filter', () => {
  it('a trusted mouse event counts, a script-dispatched one does not', () => {
    expect(countsAsInput({ isTrusted: true })).toBe(true)
    expect(countsAsInput({ isTrusted: false })).toBe(false)
  })
})
