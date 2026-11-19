import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import * as realFs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addAccount, loadAccounts, loadDnd, loadSelected, orderedAccounts, saveAccounts, saveDnd, saveSelected, setMuted } from '../src/main/accounts'
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

  it('requires a label, trims it, and allows a duplicate label within a service', () => {
    const dir = tmp()
    expect(() => addAccount(dir, { serviceId: 'whatsapp', label: '   ', colour: '#6d5bd0' })).toThrow('Label is required')
    expect(loadAccounts(dir)).toEqual([])
    const a = addAccount(dir, { serviceId: 'whatsapp', label: '  Business  ', colour: '#6d5bd0' })
    const b = addAccount(dir, { serviceId: 'whatsapp', label: 'Business', colour: '#c7772a' })
    expect(a.label).toBe('Business')
    expect(b.label).toBe('Business')
    expect(loadAccounts(dir)).toHaveLength(2)
  })

  it('accepts only http(s) URLs for a custom site', () => {
    const dir = tmp()
    const custom = (url: string) => ({ serviceId: 'custom', label: 'Wiki', colour: '#6d5bd0', custom: { name: 'Wiki', url } })
    for (const bad of ['', 'example.com', 'ftp://example.com/', 'javascript:alert(1)', 'file:///etc/passwd'])
      expect(() => addAccount(dir, custom(bad))).toThrow('URL must start with http:// or https://')
    expect(() => addAccount(dir, { ...custom('https://example.com'), custom: { name: ' ', url: 'https://example.com' } })).toThrow('Name is required')
    expect(() => addAccount(dir, { serviceId: 'nope', label: 'x', colour: '#000000' })).toThrow('Unknown service')
    expect(loadAccounts(dir)).toEqual([])
    expect(addAccount(dir, custom('http://wiki.example.com/start')).serviceId).toBe('custom')
  })

  it('stores a custom account host as its same-service host list', () => {
    const a = addAccount(tmp(), {
      serviceId: 'custom', label: 'Wiki', colour: '#6d5bd0', custom: { name: ' Team Wiki ', url: 'https://Wiki.Example.com:8080/start' }
    })
    expect(a.custom).toEqual({ name: 'Team Wiki', url: 'https://Wiki.Example.com:8080/start', hosts: ['wiki.example.com'] })
  })
})

describe('mute and Do Not Disturb persistence', () => {
  it('setMuted stores the flag per account and survives a reload', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-mute-'))
    const a = addAccount(dir, { serviceId: 'discord', label: 'ben_n', colour: '#6d5bd0' })
    const b = addAccount(dir, { serviceId: 'whatsapp', label: 'Personal', colour: '#6d5bd0' })
    setMuted(dir, a.id, true)
    const again = loadAccounts(dir)
    expect(again.find((x) => x.id === a.id)?.muted).toBe(true)
    expect(again.find((x) => x.id === b.id)?.muted).toBe(false)
    setMuted(dir, a.id, false)
    expect(loadAccounts(dir).find((x) => x.id === a.id)?.muted).toBe(false)
  })
  it('Do Not Disturb is off by default, is stored in settings and keeps the selected account', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-dnd-'))
    expect(loadDnd(dir)).toBe(false)
    saveSelected(dir, 'x1')
    saveDnd(dir, true)
    expect(loadDnd(dir)).toBe(true)
    expect(loadSelected(dir)).toBe('x1')
    saveSelected(dir, 'x2')
    expect(loadDnd(dir)).toBe(true)
    saveDnd(dir, false)
    expect(loadDnd(dir)).toBe(false)
  })
})
