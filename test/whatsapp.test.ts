import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseWaPage, readDirSafe, storeHasData, WA_PAGE_SCRIPT, WA_STORE, waStorePath, whatsappLoggedIn } from '../src/main/whatsapp'

describe('WhatsApp login detection (D50)', () => {
  it('builds the leveldb path under the account partition', () => {
    expect(waStorePath('/data', 'abc')).toBe(join('/data', 'Partitions', 'abc', 'IndexedDB', WA_STORE))
    expect(waStorePath('/data', 'abc').endsWith('https_web.whatsapp.com_0.indexeddb.leveldb')).toBe(true)
  })

  it('treats a missing or empty folder as no login data', () => {
    expect(storeHasData([])).toBe(false)
    expect(storeHasData(null)).toBe(false)
    expect(storeHasData(undefined)).toBe(false)
    expect(storeHasData(['CURRENT'])).toBe(true)
    expect(readDirSafe('/definitely/not/here')).toBeNull()
    const d = mkdtempSync(join(tmpdir(), 'gd-wa-'))
    expect(readDirSafe(d)).toEqual([])
    writeFileSync(join(d, 'CURRENT'), 'x')
    expect(readDirSafe(d)).toEqual(['CURRENT'])
  })

  it('reads qr and side markers from the page answer', () => {
    expect(parseWaPage({ qr: true, side: false })).toEqual({ qr: true, side: false })
    expect(parseWaPage({ qr: 1, side: 'yes' })).toEqual({ qr: false, side: false })
    expect(parseWaPage(null)).toBeUndefined()
    expect(parseWaPage('x')).toBeUndefined()
    expect(WA_PAGE_SCRIPT).toContain('canvas[aria-label]')
    expect(WA_PAGE_SCRIPT).toContain('[data-ref]')
    expect(WA_PAGE_SCRIPT).toContain('#side')
  })

  it('is logged in only with stored data and no QR screen; unknown while loading', () => {
    expect(whatsappLoggedIn(false)).toBe(false)
    expect(whatsappLoggedIn(false, { qr: false, side: true })).toBe(false)
    expect(whatsappLoggedIn(true)).toBe(true)
    expect(whatsappLoggedIn(true, { qr: true, side: false })).toBe(false)
    expect(whatsappLoggedIn(true, { qr: false, side: true })).toBe(true)
    expect(whatsappLoggedIn(true, { qr: false, side: false })).toBeUndefined()
  })

  it('uses the folder when an account has no loaded view', () => {
    const base = mkdtempSync(join(tmpdir(), 'gd-wa-'))
    const store = waStorePath(base, 'abc')
    expect(whatsappLoggedIn(storeHasData(readDirSafe(store)))).toBe(false)
    mkdirSync(store, { recursive: true })
    writeFileSync(join(store, 'CURRENT'), 'x')
    expect(whatsappLoggedIn(storeHasData(readDirSafe(store)))).toBe(true)
  })
})
