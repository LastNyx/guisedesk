// Update check (D29): newest vX.Y.Z tag on origin above the running version. No electron import; the git runner is injected.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface RunOpts {
  env?: Record<string, string | undefined>
  timeoutMs?: number
}
export type Run = (cmd: string, args: string[], cwd: string, opts?: RunOpts) => Promise<{ code: number; stdout: string }>
/** A build with commits on top of a release tag (D55): the updater must never check it out onto LastNyx's tag. */
export interface CustomBuild {
  tag: string
  count: number
}

export interface UpdateInfo {
  state: 'disabled' | 'none' | 'available' | 'error'
  latest?: string
  message?: string
  custom?: CustomBuild
}

const TAG = /^v(\d+)\.(\d+)\.(\d+)$/
const parts = (v: string) => TAG.exec(v.startsWith('v') ? v : `v${v}`)?.slice(1).map(Number)

/** Tags vX.Y.Z from `git ls-remote --tags` text, once each; peeled (^{}) lines, other tags and branches are ignored. */
export function parseTags(text: string): string[] {
  const out = new Set<string>()
  for (const line of text.split('\n')) {
    const ref = line.trim().split(/\s+/)[1]
    const name = ref?.startsWith('refs/tags/') ? ref.slice('refs/tags/'.length) : ''
    if (TAG.test(name)) out.add(name)
  }
  return [...out]
}

/** The highest tag strictly above `current` (numeric compare), or null. */
export function newer(current: string, tags: string[]): string | null {
  const cur = parts(current)
  if (!cur) return null
  const cmp = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
  let best: string | null = null
  for (const t of tags) {
    const p = parts(t)
    if (p && cmp(p, cur) > 0 && (!best || cmp(p, parts(best)!) > 0)) best = t
  }
  return best
}

const DESCRIBE = /^(v\d+\.\d+\.\d+)(?:-(\d+)-g[0-9a-f]+)?(?:-dirty)?$/

/** `git describe --tags` text: the nearest release tag and how many commits HEAD is ahead of it. */
export function parseDescribe(text: string): { tag: string; ahead: number } | null {
  const m = DESCRIBE.exec(text.trim())
  if (!m) return null
  return { tag: m[1], ahead: m[2] ? Number(m[2]) : 0 }
}

/**
 * Is this install a custom build (D55)? HEAD off a release tag, or local commits on top of the nearest one. The
 * in-app updater checks out a release tag from origin, which would drop those commits, so it must stay off.
 */
export async function detectCustom(o: { root: string; run: Run }): Promise<CustomBuild | null> {
  try {
    const opts = { env: { GIT_TERMINAL_PROMPT: '0' }, timeoutMs: 5000 }
    const d = await o.run('git', ['describe', '--tags'], o.root, opts)
    if (d.code !== 0) return null
    const p = parseDescribe(d.stdout)
    if (!p || p.ahead === 0) return null
    const c = await o.run('git', ['rev-list', `${p.tag}..HEAD`, '--count'], o.root, opts)
    const count = c.code === 0 ? Number(c.stdout.trim()) : p.ahead
    return Number.isInteger(count) && count > 0 ? { tag: p.tag, count } : null
  } catch {
    return null
  }
}

export async function checkForUpdate(o: { root: string; current: string; env: Record<string, string | undefined>; run: Run }): Promise<UpdateInfo> {
  if (o.env.GUISEDESK_DEV || o.env.GUISEDESK_DATA || o.env.GUISEDESK_SHOT || !existsSync(join(o.root, '.git'))) return { state: 'disabled' }
  // Decide before the remote check: the answer still shows an available note, but never offers Update and restart.
  const custom = await detectCustom(o)
  const withCustom = (u: UpdateInfo): UpdateInfo => (custom ? { ...u, custom } : u)
  try {
    // No prompt (git must fail, not wait for a password) and a timeout so an unreachable origin cannot hang the check.
    const r = await o.run('git', ['ls-remote', '--tags', 'origin'], o.root, { env: { GIT_TERMINAL_PROMPT: '0' }, timeoutMs: 20_000 })
    if (r.code !== 0) return withCustom({ state: 'error', message: r.stdout.trim().split('\n').pop() || `git exited with ${r.code}` })
    const latest = newer(o.current, parseTags(r.stdout))
    return withCustom(latest ? { state: 'available', latest } : { state: 'none' })
  } catch (e) {
    return withCustom({ state: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}

/** The real runner: stdout and stderr together, never throws on a non-zero exit. */
export const realRun: Run = (cmd, args, cwd, opts) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, env: { ...process.env, ...opts?.env }, timeout: opts?.timeoutMs, encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err && (err as { killed?: boolean }).killed) return reject(new Error('Timed out'))
      if (err && typeof (err as { code?: unknown }).code !== 'number') return reject(err)
      resolve({ code: err ? ((err as { code: number }).code) : 0, stdout: err ? `${stdout}${stderr}` : stdout })
    })
  })
