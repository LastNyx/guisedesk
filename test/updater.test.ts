import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkForUpdate, newer, parseTags } from '../src/main/updater'

const LS = [
  'aaa111\trefs/tags/v0.1.0',
  'bbb222\trefs/tags/v0.1.0^{}',
  'ccc333\trefs/tags/v0.1.9',
  'ddd444\trefs/tags/v0.1.10',
  'eee555\trefs/tags/v0.1.10^{}',
  'fff666\trefs/tags/nightly',
  'abc777\trefs/tags/v1.2',
  'abc888\trefs/tags/v1.2.3-rc1',
  'abc999\trefs/heads/v9.9.9'
].join('\n')

describe('parseTags / newer', () => {
  it('keeps vX.Y.Z tags once each, ignoring peeled lines, junk tags and branches', () => {
    expect(parseTags(LS)).toEqual(['v0.1.0', 'v0.1.9', 'v0.1.10'])
  })

  it('newer picks the highest tag above current by number, not by string', () => {
    expect(newer('0.1.1', ['v0.1.0', 'v0.1.9', 'v0.1.10'])).toBe('v0.1.10')
    expect(newer('v0.1.10', ['v0.1.9', 'v0.1.10'])).toBeNull()
    expect(newer('0.2.0', ['v0.1.10'])).toBeNull()
    expect(newer('0.1.0', [])).toBeNull()
  })
})

describe('checkForUpdate', () => {
  const root = mkdtempSync(join(tmpdir(), 'gd-upd-'))
  mkdirSync(join(root, '.git'))
  const calls: unknown[][] = []
  const ok = async (...a: unknown[]) => {
    calls.push(a)
    return { code: 0, stdout: LS }
  }

  it('is disabled in dev, test-data and shot runs, and when the root has no .git', async () => {
    for (const env of [{ GUISEDESK_DEV: '1' }, { GUISEDESK_DATA: '/x' }, { GUISEDESK_SHOT: '/x.png' }]) {
      expect(await checkForUpdate({ root, current: '0.1.1', env, run: ok })).toEqual({ state: 'disabled' })
    }
    const bare = mkdtempSync(join(tmpdir(), 'gd-upd-'))
    expect(await checkForUpdate({ root: bare, current: '0.1.1', env: {}, run: ok })).toEqual({ state: 'disabled' })
    expect(calls).toHaveLength(0)
  })

  it('a .git file (worktree) counts as a checkout', async () => {
    const wt = mkdtempSync(join(tmpdir(), 'gd-upd-'))
    writeFileSync(join(wt, '.git'), 'gitdir: /elsewhere\n')
    expect((await checkForUpdate({ root: wt, current: '0.1.1', env: {}, run: ok })).state).toBe('available')
  })

  it('available with the newest tag, or none when current is the newest; asks origin without a prompt', async () => {
    expect(await checkForUpdate({ root, current: '0.1.1', env: {}, run: ok })).toEqual({ state: 'available', latest: 'v0.1.10' })
    expect(await checkForUpdate({ root, current: '0.1.10', env: {}, run: ok })).toEqual({ state: 'none' })
    const last = calls.at(-1)!
    expect(last.slice(0, 3)).toEqual(['git', ['ls-remote', '--tags', 'origin'], root])
    expect(last[3]).toMatchObject({ env: { GIT_TERMINAL_PROMPT: '0' }, timeoutMs: expect.any(Number) })
  })

  it('error state with a message when git fails or throws', async () => {
    const bad = async () => ({ code: 128, stdout: 'fatal: could not read from remote' })
    const r = await checkForUpdate({ root, current: '0.1.1', env: {}, run: bad })
    expect(r.state).toBe('error')
    expect(r.message).toContain('could not read from remote')
    const boom = async () => {
      throw new Error('timed out')
    }
    expect(await checkForUpdate({ root, current: '0.1.1', env: {}, run: boom })).toEqual({ state: 'error', message: 'timed out' })
  })
})
