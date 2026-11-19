import { describe, expect, it } from 'vitest'
import { isSidebarShortcut, panelBounds, SIDE_FULL, SIDE_MINI, sideWidth } from '../src/main/layout'

describe('layout (shared by renderer and main)', () => {
  it('sidebar is 232px full and 64px collapsed (D26)', () => {
    expect([SIDE_FULL, SIDE_MINI]).toEqual([232, 64])
    expect(sideWidth(false)).toBe(232)
    expect(sideWidth(true)).toBe(64)
  })

  it('the view bounds follow the sidebar width', () => {
    expect(panelBounds(1240, 780, false)).toEqual({ x: 248, y: 12, width: 976, height: 752 })
    expect(panelBounds(1240, 780, true)).toEqual({ x: 80, y: 12, width: 1144, height: 752 })
    expect(panelBounds(100, 10, false).width).toBe(0)
  })

  it('Ctrl+B is the sidebar shortcut, nothing else is', () => {
    const k = (o: object) => ({ type: 'keyDown', key: 'b', control: true, ...o })
    expect(isSidebarShortcut(k({}))).toBe(true)
    expect(isSidebarShortcut(k({ key: 'B' }))).toBe(true)
    expect(isSidebarShortcut(k({ type: 'keyUp' }))).toBe(false)
    expect(isSidebarShortcut(k({ control: false }))).toBe(false)
    expect(isSidebarShortcut(k({ alt: true }))).toBe(false)
    expect(isSidebarShortcut(k({ key: 'l' }))).toBe(false)
  })
})
