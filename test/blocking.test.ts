// @vitest-environment jsdom
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ENGINE_MAX_AGE, engineFresh, GESTURE_MS, isGesture, loadBlocking, popupBlocked, saveBlocking } from '../src/main/blocking'
import SettingsGeneral from '../src/renderer/src/SettingsGeneral.vue'

describe('blocking settings', () => {
  it('both on when missing; round-trip keeps other settings.json keys', () => {
    const d = mkdtempSync(join(tmpdir(), 'gd-block-'))
    expect(loadBlocking(d)).toEqual({ ads: true, popups: true })
    writeFileSync(join(d, 'settings.json'), JSON.stringify({ dnd: true }))
    saveBlocking(d, { ads: false, popups: true })
    expect(loadBlocking(d)).toEqual({ ads: false, popups: true })
    expect(JSON.parse(readFileSync(join(d, 'settings.json'), 'utf8'))).toMatchObject({ dnd: true, blocking: { ads: false, popups: true } })
  })
  it('only an explicit false turns one off', () => {
    const d = mkdtempSync(join(tmpdir(), 'gd-block-'))
    writeFileSync(join(d, 'settings.json'), JSON.stringify({ blocking: { ads: 0, popups: 'no' } }))
    expect(loadBlocking(d)).toEqual({ ads: true, popups: true })
  })
})

describe('pop-up rule', () => {
  it('blocks a window.open with no recent click or key', () => {
    expect(popupBlocked({ on: true, now: 10_000, lastGesture: undefined })).toBe(true)
    expect(popupBlocked({ on: true, now: 10_000, lastGesture: 10_000 - GESTURE_MS - 1 })).toBe(true)
    expect(popupBlocked({ on: true, now: 10_000, lastGesture: 10_000 - 200 })).toBe(false)
    expect(popupBlocked({ on: false, now: 10_000, lastGesture: undefined })).toBe(false)
  })
  it('counts clicks, taps and keys, not mouse moves or wheel', () => {
    for (const t of ['mouseDown', 'keyDown', 'rawKeyDown', 'gestureTap', 'touchStart']) expect(isGesture(t)).toBe(true)
    for (const t of ['mouseMove', 'mouseWheel', 'mouseEnter', 'gestureScrollUpdate']) expect(isGesture(t)).toBe(false)
  })
  it('engine cache is fresh for a week', () => {
    expect(engineFresh(undefined, 1)).toBe(false)
    expect(engineFresh(1000, 1000 + ENGINE_MAX_AGE - 1)).toBe(true)
    expect(engineFresh(1000, 1000 + ENGINE_MAX_AGE)).toBe(false)
  })
})

describe('Settings > General blocking card', () => {
  it('shows both switches from main and saves a flip', async () => {
    const setBlocking = vi.fn(async () => true)
    ;(window as unknown as { guisedesk: unknown }).guisedesk = {
      prefs: async () => ({ idleLock: 10, dnd: false, startOnLogin: false }),
      downloads: async () => ({ dir: '/dl', ask: false }),
      blocking: async () => ({ ads: true, popups: false }),
      setBlocking
    }
    const w = mount(SettingsGeneral, { props: { update: { state: 'none' } } })
    await flushPromises()
    const row = (t: string) => w.findAll('.sr').find((r) => r.find('b').text() === t)!
    expect(w.findAll('.card h4').map((h) => h.text())).toContain('Blocking')
    expect(row('Block ads and trackers').find('.tg').classes()).toContain('on')
    expect(row('Block pop-ups').find('.tg').classes()).not.toContain('on')
    await row('Block pop-ups').find('.tg').trigger('click')
    await flushPromises()
    expect(setBlocking).toHaveBeenCalledWith({ popups: true })
    expect(row('Block pop-ups').find('.tg').classes()).toContain('on')
  })
})
