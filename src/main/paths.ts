import { join, resolve } from 'node:path'

export function dataDir(env: Record<string, string | undefined>, home: string): string {
  if (env.GUISEDESK_DATA) return env.GUISEDESK_DATA
  if (env.GUISEDESK_DEV === '1') return join(home, '.config', 'GuiseDesk-dev')
  return join(home, '.config', 'GuiseDesk')
}

/** Dev lock bypass (screenshot runs): needs a dev marker and an explicit data dir, and never applies to the daily dir. */
export function devUnlocked(env: Record<string, string | undefined>, dir: string, home: string): boolean {
  if (env.GUISEDESK_DEV_UNLOCKED !== '1' || !env.GUISEDESK_DATA) return false
  if (env.GUISEDESK_DEV !== '1' && !env.GUISEDESK_SHOT) return false
  return resolve(dir) !== resolve(join(home, '.config', 'GuiseDesk'))
}
