// Log out and Remove for one account (D6). Plain TS: Electron work (sessions, views) is passed in.
import { join } from 'node:path'
import { loadAccounts, saveAccounts } from './accounts'
import { wipeFiles } from './reset'

export interface AccountOpsDeps {
  /** Clear the partition's cookies, storage and cache. */
  clearStorage(id: string): Promise<void>
  /** Destroy the account's live view, if any. */
  closeView(id: string): void
  /** Send the account's live view (if any) back to its start page. */
  reloadView(id: string): void
}

/** Log out: clears that partition's storage, keeps the account. False when the id is unknown. */
export async function logOut(dir: string, id: string, deps: AccountOpsDeps): Promise<boolean> {
  if (!loadAccounts(dir).some((a) => a.id === id)) return false
  await deps.clearStorage(id)
  deps.reloadView(id)
  return true
}

/** Remove: destroys the view, clears storage, deletes the account and its partition dir (only that one, inside dir). */
export async function removeAccount(dir: string, id: string, deps: AccountOpsDeps): Promise<boolean> {
  const accounts = loadAccounts(dir)
  if (!accounts.some((a) => a.id === id)) return false
  // The id becomes a path segment: plain names only, so it can never reach outside Partitions/.
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('refusing an account id that is not a plain name')
  deps.closeView(id)
  await deps.clearStorage(id)
  saveAccounts(dir, accounts.filter((a) => a.id !== id))
  wipeFiles(dir, [join(dir, 'Partitions', id)])
  return true
}
