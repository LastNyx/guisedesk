// @vitest-environment jsdom
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { addAccount, loadAccounts } from '../src/main/accounts'
import { removeAccount, logOut } from '../src/main/accountops'
import { defaultShare, partitionOf, shareHosts } from '../src/main/sharing'
import AccountSheet from '../src/renderer/src/AccountSheet.vue'
import AddAccount from '../src/renderer/src/AddAccount.vue'

const acc = (id: string, serviceId: string, label: string, order: number, shareWith?: string) => ({
  id, serviceId, label, colour: '#6d5bd0', order, ...(shareWith ? { shareWith } : {})
})
const ig = acc('ig1', 'instagram', 'Shop', 0)
const ig2 = acc('ig2', 'instagram', 'Other', 1)
const th = acc('th1', 'threads', 'Shop threads', 2, 'ig1')
const fb = acc('fb1', 'facebook', 'Page', 3)
const wa = acc('wa1', 'whatsapp', 'Chat', 4)

describe('sharing helpers', () => {
  it('partitionOf uses shareWith when set, else the id', () => {
    expect(partitionOf(ig)).toBe('persist:ig1')
    expect(partitionOf(th)).toBe('persist:ig1')
  })

  it('shareHosts lists different-service Meta accounts without chains; non-Meta is empty', () => {
    const all = [ig, ig2, th, fb, wa]
    expect(shareHosts('threads', all).map((a) => a.id)).toEqual(['ig1', 'ig2', 'fb1'])
    expect(shareHosts('instagram', all).map((a) => a.id)).toEqual(['fb1'])
    expect(shareHosts('whatsapp', all)).toEqual([])
    expect(shareHosts('custom', all)).toEqual([])
  })

  it('defaultShare is the first Instagram host for Threads, else none', () => {
    const all = [fb, ig2, ig]
    expect(defaultShare('threads', all)).toBe('ig2')
    expect(defaultShare('threads', [fb])).toBeUndefined()
    expect(defaultShare('facebook', all)).toBeUndefined()
    expect(defaultShare('instagram', all)).toBeUndefined()
  })
})

function fixture(list = [ig, ig2, th, fb, wa]) {
  const dir = join(mkdtempSync(join(tmpdir(), 'gd-meta-')), 'data')
  mkdirSync(join(dir, 'Partitions', 'ig1'), { recursive: true })
  writeFileSync(join(dir, 'Partitions', 'ig1', 'Cookies'), 'x')
  writeFileSync(join(dir, 'accounts.json'), JSON.stringify(list))
  return dir
}

describe('addAccount shareWith', () => {
  const input = (serviceId: string, shareWith?: string) => ({ serviceId, label: 'New', colour: '#6d5bd0', ...(shareWith ? { shareWith } : {}) })

  it('stores a valid shareWith', () => {
    const dir = fixture([ig, fb])
    expect(addAccount(dir, input('threads', 'ig1')).shareWith).toBe('ig1')
    expect(loadAccounts(dir).find((a) => a.serviceId === 'threads')!.shareWith).toBe('ig1')
  })

  it('rejects same-service, chained, unknown and non-Meta hosts', () => {
    const dir = fixture()
    expect(() => addAccount(dir, input('instagram', 'ig1'))).toThrow()
    expect(() => addAccount(dir, input('facebook', 'th1'))).toThrow()
    expect(() => addAccount(dir, input('threads', 'nope'))).toThrow()
    expect(() => addAccount(dir, input('whatsapp', 'ig1'))).toThrow()
    expect(loadAccounts(dir)).toHaveLength(5)
  })
})

describe('log out and remove with a shared partition', () => {
  const deps = () => ({ clearStorage: vi.fn(async () => {}), closeView: vi.fn(), reloadView: vi.fn() })

  it('Remove keeps a partition still in use, wipes it when the last user goes', async () => {
    const dir = fixture()
    const d = deps()
    await removeAccount(dir, 'ig1', d)
    expect(existsSync(join(dir, 'Partitions', 'ig1', 'Cookies'))).toBe(true)
    expect(d.clearStorage).not.toHaveBeenCalled()
    expect(loadAccounts(dir).find((a) => a.id === 'th1')!.shareWith).toBe('ig1')
    await removeAccount(dir, 'th1', d)
    expect(existsSync(join(dir, 'Partitions', 'ig1'))).toBe(false)
    expect(d.clearStorage).toHaveBeenCalledWith('ig1')
  })

  it('Remove of a sharer leaves the host partition alone', async () => {
    const dir = fixture()
    const d = deps()
    await removeAccount(dir, 'th1', d)
    expect(existsSync(join(dir, 'Partitions', 'ig1', 'Cookies'))).toBe(true)
    expect(d.clearStorage).not.toHaveBeenCalled()
  })

  it('Log out clears the shared partition once and reloads every account on it', async () => {
    const dir = fixture()
    const d = deps()
    await logOut(dir, 'th1', d)
    expect(d.clearStorage).toHaveBeenCalledOnce()
    expect(d.clearStorage).toHaveBeenCalledWith('ig1')
    expect(d.reloadView.mock.calls.map((c) => c[0]).sort()).toEqual(['ig1', 'th1'])
  })
})

describe('Add dialog Login choice', () => {
  const pick = (w: ReturnType<typeof mount>, name: string) => w.findAll('.pk').find((p) => p.text() === name)!
  const login = (w: ReturnType<typeof mount>) => w.findAll('.login span')

  it('shows only for Meta services with hosts, defaults to Same as the Instagram account for Threads, and emits it', async () => {
    const w = mount(AddAccount, { props: { accounts: [ig, fb, wa] } })
    expect(w.find('.login').exists()).toBe(false)
    await pick(w, 'Threads').trigger('click')
    expect(login(w).map((s) => s.text())).toEqual(['Separate', 'Same as Shop (Instagram)', 'Same as Page (Facebook)'])
    expect(w.find('.login span.sel').text()).toBe('Same as Shop (Instagram)')
    await w.find('input.label').setValue('T')
    await w.find('.btn.pri').trigger('click')
    expect(w.emitted('add')![0][0]).toMatchObject({ serviceId: 'threads', shareWith: 'ig1' })
    await login(w)[0].trigger('click')
    await w.find('.btn.pri').trigger('click')
    expect((w.emitted('add')![1][0] as { shareWith?: string }).shareWith).toBeUndefined()
    await pick(w, 'WhatsApp').trigger('click')
    expect(w.find('.login').exists()).toBe(false)
    await pick(w, 'Instagram').trigger('click')
    expect(w.find('.login span.sel').text()).toBe('Separate')
  })

  it('does not show for Threads when no other Meta account exists', async () => {
    const w = mount(AddAccount, { props: { accounts: [wa, ig] } })
    await pick(w, 'Instagram').trigger('click')
    expect(w.find('.login').exists()).toBe(false)
  })
})

describe('Account sheet sharing lines', () => {
  const all = [ig, th, fb]

  it('a sharer shows who it shares with and the Log out warning', () => {
    const w = mount(AccountSheet, { props: { account: th, accounts: all } })
    expect(w.find('.share').text()).toBe('Shares login with Shop')
    expect(w.find('.warn').text()).toBe('Also logs out Shop')
  })

  it('a host shows who shares its login and the warning; an unshared account shows neither', () => {
    const w = mount(AccountSheet, { props: { account: ig, accounts: all } })
    expect(w.find('.share').text()).toBe('Login shared with Shop threads')
    expect(w.find('.warn').text()).toBe('Also logs out Shop threads')
    const w2 = mount(AccountSheet, { props: { account: fb, accounts: all } })
    expect(w2.find('.share').exists()).toBe(false)
    expect(w2.find('.warn').exists()).toBe(false)
  })
})
