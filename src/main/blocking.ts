// Ad and pop-up blocking (D45): settings.json key `blocking`, and the pop-up rule. Plain TS, no electron import.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeAtomic } from './atomic'

export interface BlockingSettings {
  /** Block ad and tracker requests and hide ad slots (filter lists), in every service view and popup. */
  ads: boolean
  /** Drop windows a page opens on its own, without a click or key press just before. */
  popups: boolean
}

/** A window.open counts as user-made when a click, tap or key press came this recently (ms). */
export const GESTURE_MS = 1500

/** Filter lists are re-downloaded when the cached engine is older than this (ms). */
export const ENGINE_MAX_AGE = 7 * 24 * 3600_000

function readAll(dir: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))
  } catch {
    return {}
  }
}

/** Both on when missing; only an explicit false turns one off. */
export function loadBlocking(dir: string): BlockingSettings {
  const b = readAll(dir).blocking as { ads?: unknown; popups?: unknown } | undefined
  return { ads: b?.ads !== false, popups: b?.popups !== false }
}

export function saveBlocking(dir: string, value: BlockingSettings): void {
  const blocking: BlockingSettings = { ads: value.ads === true, popups: value.popups === true }
  writeAtomic(join(dir, 'settings.json'), JSON.stringify({ ...readAll(dir), blocking }, null, 2))
}

/** Input types that count as the user asking for a new window. */
export function isGesture(type: string): boolean {
  return ['mouseDown', 'mouseUp', 'keyDown', 'rawKeyDown', 'gestureTap', 'touchStart', 'touchEnd', 'pointerDown', 'pointerUp'].includes(type)
}

/** A page-opened window is a blocked pop-up when blocking is on and no click or key press came within GESTURE_MS. */
export function popupBlocked(s: { on: boolean; now: number; lastGesture: number | undefined }): boolean {
  if (!s.on) return false
  return s.lastGesture === undefined || s.now - s.lastGesture > GESTURE_MS
}

/** The cached engine file is usable when it exists and is younger than ENGINE_MAX_AGE. */
export function engineFresh(mtimeMs: number | undefined, now: number): boolean {
  return mtimeMs !== undefined && now - mtimeMs < ENGINE_MAX_AGE
}
