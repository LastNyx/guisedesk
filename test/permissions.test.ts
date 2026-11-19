import { describe, expect, it } from 'vitest'
import { permissionAllowed } from '../src/main/permissions'

describe('permissionAllowed', () => {
  it('grants notifications', () => {
    expect(permissionAllowed('notifications')).toBe(true)
  })
  it('denies camera, mic and geolocation by default', () => {
    for (const p of ['media', 'camera', 'microphone', 'geolocation', 'midi', 'clipboard-read'])
      expect(permissionAllowed(p)).toBe(false)
  })
})
