import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import * as realFs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addAccount, loadAccounts, orderedAccounts, saveAccounts } from '../src/main/accounts'
import { PRESETS } from '../src/main/presets'

const tmp = () => mkdtempSync(join(tmpdir(), 'gd-acc-'))

describe('accounts store', () => {
  it('round-trips accounts with generated unique ids', () => {
    const dir = tmp()
    const a = addAccount(dir, { serviceId: 'whatsapp', label: 'Personal', colour: '#6d5bd0' })
    const b = addAccount(dir, { serviceId: 'whatsapp', label: 'Business', colour: '#c7772a' })
    expect(a.id).not.toBe(b.id)
    const loaded = loadAccounts(dir)
    expect(loaded.map((x) => x.label)).toEqual(['Personal', 'Business'])
    expect(loaded[0]).toEqual(a)
  })

  it('loads an empty list when no file exists', () => {
    expect(loadAccounts(tmp())).toEqual([])
  })

  it('keeps the old file intact when the write dies before the rename', () => {
    const dir = tmp()
    const a = addAccount(dir, { serviceId: 'discord', label: 'ben_n', colour: '#4a5bc4' })
    const crashing = {
      ...realFs,
      renameSync: () => {
        throw new Error('crash mid-write')
      }
    }
    expect(() => saveAccounts(dir, [], crashing)).toThrow('crash mid-write')
    expect(loadAccounts(dir)).toEqual([a])
    expect(JSON.parse(readFileSync(join(dir, 'accounts.json'), 'utf8'))).toHaveLength(1)
  })

  it('returns accounts sorted by stored order', () => {
    const dir = tmp()
    writeFileSync(
      join(dir, 'accounts.json'),
      JSON.stringify([
        { id: 'b', serviceId: 'x', label: 'B', colour: '#000', order: 1 },
        { id: 'a', serviceId: 'x', label: 'A', colour: '#000', order: 0 }
      ])
    )
    expect(orderedAccounts(loadAccounts(dir)).map((x) => x.id)).toEqual(['a', 'b'])
    expect(existsSync(join(dir, 'accounts.json.tmp'))).toBe(false)
  })

  it('has the seven presets with kinds', () => {
    expect(PRESETS.filter((p) => p.kind === 'chat').map((p) => p.id)).toEqual(['whatsapp', 'discord'])
    expect(PRESETS.filter((p) => p.kind === 'feed').map((p) => p.id)).toEqual([
      'instagram', 'facebook', 'x', 'threads', 'tiktok'
    ])
  })
})
