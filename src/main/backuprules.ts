// Backup rules shared by main and the renderer (D61). Plain TS, no node import, so the UI can use them.
export const MIN_BACKUP_PASSWORD = 8

/** Why an export password is not usable, or null when it is (at least 8 characters and typed the same twice). */
export function passwordProblem(password: unknown, repeat: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_BACKUP_PASSWORD) return `Use at least ${MIN_BACKUP_PASSWORD} characters.`
  if (password !== repeat) return 'The two passwords do not match.'
  return null
}

/** The one backup file name: guisedesk-backup-YYYY-MM-DD.gdbackup (UTC date, like the event log). */
export function backupFileName(now: Date = new Date()): string {
  return `guisedesk-backup-${now.toISOString().slice(0, 10)}.gdbackup`
}

/** The date part of a backup's created timestamp, for the details list. */
export function backupDate(created: unknown): string {
  return typeof created === 'string' ? created.slice(0, 10) : ''
}
