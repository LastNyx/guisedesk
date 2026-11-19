import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = join(__dirname, '..', 'launchers', 'update.sh')
const git = (cwd: string, ...a: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...a], { cwd, encoding: 'utf8' }).trim()

// A temp origin with v0.1.0 and v0.2.0, and an app checkout detached at v0.1.0. The setup steps are stubbed by env:
// CI appends "ci", BUILD appends "build" (and fails on 0.2.0 when asked), LAUNCH appends "launch". Nothing touches npm or the network.
function fixture(opts: { lockChanges: boolean }) {
  const base = mkdtempSync(join(tmpdir(), 'gd-sh-'))
  const origin = join(base, 'origin')
  const app = join(base, 'app')
  mkdirSync(origin)
  git(origin, 'init', '-q', '-b', 'main')
  writeFileSync(join(origin, '.gitignore'), 'node_modules\n')
  writeFileSync(join(origin, 'package-lock.json'), 'lock-1\n')
  writeFileSync(join(origin, 'VERSION'), '0.1.0\n')
  git(origin, 'add', '.')
  git(origin, 'commit', '-qm', 'one')
  git(origin, 'tag', 'v0.1.0')
  writeFileSync(join(origin, 'VERSION'), '0.2.0\n')
  if (opts.lockChanges) writeFileSync(join(origin, 'package-lock.json'), 'lock-2\n')
  git(origin, 'commit', '-qam', 'two')
  git(origin, 'tag', 'v0.2.0')
  git(base, 'clone', '-q', origin, app)
  git(app, 'checkout', '-q', '--detach', 'v0.1.0')
  mkdirSync(join(app, 'node_modules', 'electron', 'dist'), { recursive: true })
  const steps = join(base, 'steps.log')
  const log = join(base, 'update.log')
  // The copy is what the app runs: checkout rewrites launchers/update.sh under a running script.
  const copy = join(base, 'update-copy.sh')
  copyFileSync(SCRIPT, copy)
  const env = (failNew = false) => ({
    ...process.env,
    GUISEDESK_UPDATE_CI: `echo ci >> '${steps}'`,
    GUISEDESK_UPDATE_BUILD: `${failNew ? `if grep -q 0.2.0 VERSION; then echo build-failed >> '${steps}'; exit 1; fi; ` : ''}echo build-$(cat VERSION) >> '${steps}'`,
    GUISEDESK_UPDATE_LAUNCH: `echo launch-$(cat VERSION) >> '${steps}'`
  })
  const run = (tag: string, e: NodeJS.ProcessEnv) => spawnSync('sh', [copy, tag, '999999999', app, log], { env: e, encoding: 'utf8' })
  const done = async () => {
    for (let i = 0; i < 50 && !(existsSync(steps) && /launch/.test(readFileSync(steps, 'utf8'))); i++) await new Promise((r) => setTimeout(r, 100))
    return existsSync(steps) ? readFileSync(steps, 'utf8').trim().split('\n') : []
  }
  return { app, log, run, env, done }
}

describe('launchers/update.sh', () => {
  it('moves to the tag, skips npm ci when the lock is unchanged, builds and relaunches', async () => {
    const f = fixture({ lockChanges: false })
    const r = f.run('v0.2.0', f.env())
    expect(r.status).toBe(0)
    expect(git(f.app, 'describe', '--tags')).toBe('v0.2.0')
    expect(await f.done()).toEqual(['build-0.2.0', 'launch-0.2.0'])
    expect(readFileSync(f.log, 'utf8')).toContain('v0.2.0')
  })

  it('runs npm ci first when package-lock.json differs between the two commits', async () => {
    const f = fixture({ lockChanges: true })
    expect(f.run('v0.2.0', f.env()).status).toBe(0)
    expect(await f.done()).toEqual(['ci', 'build-0.2.0', 'launch-0.2.0'])
  })

  it('refuses on a dirty tree: nothing moves, the old version is relaunched, exit is non-zero', async () => {
    const f = fixture({ lockChanges: false })
    writeFileSync(join(f.app, 'VERSION'), 'edited\n')
    const r = f.run('v0.2.0', f.env())
    expect(r.status).not.toBe(0)
    expect(git(f.app, 'describe', '--tags')).toBe('v0.1.0')
    expect(readFileSync(join(f.app, 'VERSION'), 'utf8')).toBe('edited\n')
    expect(await f.done()).toEqual(['launch-edited'])
    expect(readFileSync(f.log, 'utf8')).toMatch(/local changes/i)
  })

  it('rolls back to the old commit, rebuilds it and relaunches it when the build fails', async () => {
    const f = fixture({ lockChanges: true })
    const r = f.run('v0.2.0', f.env(true))
    expect(r.status).not.toBe(0)
    expect(git(f.app, 'describe', '--tags')).toBe('v0.1.0')
    expect(await f.done()).toEqual(['ci', 'build-failed', 'ci', 'build-0.1.0', 'launch-0.1.0'])
  })

  it('rejects a tag that is not vX.Y.Z', () => {
    const f = fixture({ lockChanges: false })
    const r = f.run('main', f.env())
    expect(r.status).not.toBe(0)
    expect(git(f.app, 'describe', '--tags')).toBe('v0.1.0')
  })
})
