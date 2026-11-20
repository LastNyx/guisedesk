import { describe, expect, it } from 'vitest'
import { secondLaunch } from '../src/main/singleinstance'

describe('secondLaunch', () => {
  it('shows the window for a normal second launch', () => {
    expect(secondLaunch(['electron', 'app'])).toBe('show')
  })
  it('ignores a second launch started with --hidden', () => {
    expect(secondLaunch(['electron', 'app', '--hidden'])).toBe('ignore')
  })
})
