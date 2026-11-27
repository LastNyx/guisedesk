import { describe, expect, it } from 'vitest'
import { clampSplit, isSidebarShortcut, panelBounds, SIDE_FULL, SIDE_MINI, sideWidth, splitBounds, splitRatioAt, SPLIT_GAP } from '../src/main/layout'

describe('layout (shared by renderer and main)', () => {
  it('sidebar is 232px full and 64px collapsed (D26)', () => {
    expect([SIDE_FULL, SIDE_MINI]).toEqual([232, 64])
    expect(sideWidth(false)).toBe(232)
    expect(sideWidth(true)).toBe(64)
  })

  it('the view bounds follow the sidebar width', () => {
    expect(panelBounds(1240, 780, false)).toEqual({ x: 248, y: 58, width: 976, height: 706 })
    expect(panelBounds(1240, 780, true)).toEqual({ x: 80, y: 58, width: 1144, height: 706 })
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

describe('split view (D62)', () => {
  it('clamps the divider to 20-80 percent, 50 when missing', () => {
    expect(clampSplit(0.5)).toBe(0.5)
    expect(clampSplit(0.1)).toBe(0.2)
    expect(clampSplit(0.95)).toBe(0.8)
    expect(clampSplit('x')).toBe(0.5)
    expect(clampSplit(Number.NaN)).toBe(0.5)
  })

  it('splits the panel into two bounds with the divider gap between them', () => {
    const panel = { x: 100, y: 50, width: 1000, height: 600 }
    const { left, right } = splitBounds(panel, 0.5)
    expect(left).toEqual({ x: 100, y: 50, width: 495, height: 600 })
    expect(right).toEqual({ x: 605, y: 50, width: 495, height: 600 })
    expect(left.width + SPLIT_GAP + right.width).toBe(panel.width)
    const quarter = splitBounds(panel, 0.25)
    expect(quarter.left.width).toBe(245)
    expect(quarter.right.x).toBe(355)
    expect(quarter.left.width + SPLIT_GAP + quarter.right.width).toBe(panel.width)
  })

  it('keeps both sides on screen at the extremes', () => {
    const panel = { x: 0, y: 0, width: 200, height: 100 }
    expect(splitBounds(panel, 0).left.width).toBe(35)
    expect(splitBounds(panel, 1).right.width).toBe(35)
  })

  it('turns a pointer position into a clamped ratio', () => {
    expect(splitRatioAt(500, 100, 800)).toBe(0.5)
    expect(splitRatioAt(100, 100, 800)).toBe(0.2)
    expect(splitRatioAt(900, 100, 800)).toBe(0.8)
    expect(splitRatioAt(500, 100, 0)).toBe(0.5)
  })
})
