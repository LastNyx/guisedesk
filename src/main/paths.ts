import { join } from 'node:path'

export function dataDir(env: Record<string, string | undefined>, home: string): string {
  if (env.GUISEDESK_DATA) return env.GUISEDESK_DATA
  if (env.GUISEDESK_DEV === '1') return join(home, '.config', 'GuiseDesk-dev')
  return join(home, '.config', 'GuiseDesk')
}
