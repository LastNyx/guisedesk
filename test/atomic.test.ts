import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { writeAtomic } from '../src/main/atomic'

describe('writeAtomic mode', () => {
  it('applies the mode even when a looser temp file is left over', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-atomic-'))
    const f = join(dir, 'x.json')
    writeFileSync(`${f}.tmp`, 'old', { mode: 0o644 })
    writeAtomic(f, 'new', undefined, 0o600)
    expect(readFileSync(f, 'utf8')).toBe('new')
    expect(statSync(f).mode & 0o777).toBe(0o600)
  })
})
