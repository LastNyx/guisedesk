// Setup rules for the app lock (D14). No node imports: the setup screen and main share it.
export type LockKind = 'pin' | 'password'

export const PIN_MIN = 6
export const PIN_MAX = 12
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

export function validateNewSecret(kind: LockKind, secret: string, repeat: string): { ok: true } | { ok: false; error: string } {
  if (typeof secret !== 'string' || typeof repeat !== 'string') return { ok: false, error: 'Invalid entry' }
  if (kind === 'pin') {
    if (!/^\d+$/.test(secret)) return { ok: false, error: 'A PIN is digits only' }
    if (secret.length < PIN_MIN) return { ok: false, error: `A PIN needs at least ${PIN_MIN} digits` }
    if (secret.length > PIN_MAX) return { ok: false, error: `A PIN has at most ${PIN_MAX} digits` }
  } else if (kind === 'password') {
    if (secret.length < PASSWORD_MIN) return { ok: false, error: `A password needs at least ${PASSWORD_MIN} characters` }
    if (secret.length > PASSWORD_MAX) return { ok: false, error: `A password has at most ${PASSWORD_MAX} characters` }
  } else return { ok: false, error: 'Invalid entry' }
  if (secret !== repeat) return { ok: false, error: 'The two entries do not match' }
  return { ok: true }
}
