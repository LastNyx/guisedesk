import { describe, expect, it } from 'vitest'
import { permissionAllowed } from '../src/main/permissions'

describe('permissionAllowed', () => {
  it('grants notifications', () => {
    expect(permissionAllowed('notifications')).toBe(true)
  })
  it('grants clipboard writes so site Copy buttons work, but not reads', () => {
    expect(permissionAllowed('clipboard-sanitized-write')).toBe(true)
    expect(permissionAllowed('clipboard-read')).toBe(false)
  })
  it('denies camera, mic and geolocation by default', () => {
    for (const p of ['media', 'camera', 'microphone', 'geolocation', 'midi', 'clipboard-read'])
      expect(permissionAllowed(p)).toBe(false)
  })
})
