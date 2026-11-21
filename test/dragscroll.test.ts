// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createDrag, parseDragHint, scrollRowOf, watchDragScroll } from '../src/preload/dragscroll'
import { PRESETS } from '../src/main/presets'

type S = { overflowX: string; scrollWidth: number; clientWidth: number }
const styles = new Map<Element, S>()
const getStyle = (e: Element): S => styles.get(e) ?? { overflowX: 'visible', scrollWidth: 100, clientWidth: 100 }
const tree = () => {
  const outer = document.createElement('div')
  const row = document.createElement('ul')
  const item = document.createElement('li')
  const img = document.createElement('img')
  item.append(img); row.append(item); outer.append(row)
  document.body.append(outer)
  return { outer, row, item, img }
}

describe('scrollRowOf', () => {
  it('finds the nearest ancestor that scrolls sideways, or null', () => {
    const { outer, row, img } = tree()
    styles.set(outer, { overflowX: 'auto', scrollWidth: 900, clientWidth: 500 })
    styles.set(row, { overflowX: 'scroll', scrollWidth: 900, clientWidth: 500 })
    expect(scrollRowOf(img, getStyle)).toBe(row)
    styles.set(row, { overflowX: 'scroll', scrollWidth: 500, clientWidth: 500 })
    expect(scrollRowOf(img, getStyle)).toBe(outer)
    styles.set(outer, { overflowX: 'hidden', scrollWidth: 900, clientWidth: 500 })
    expect(scrollRowOf(img, getStyle)).toBeNull()
  })
})

describe('createDrag', () => {
  it('stays a click under 5 px, scrolls by the opposite of the pointer move past it', () => {
    const d = createDrag()
    d.down(300, 40)
    expect(d.move(297)).toBeNull()
    expect(d.up()).toEqual({ dragged: false })
    d.down(300, 40)
    expect(d.move(250)).toBe(90)
    expect(d.move(320)).toBe(20)
    expect(d.dragging()).toBe(true)
    expect(d.up()).toEqual({ dragged: true })
    expect(d.dragging()).toBe(false)
  })
})

describe('watchDragScroll', () => {
  const ptr = (type: string, x: number, init: object = {}) => {
    const e = new MouseEvent(type, { clientX: x, button: 0, bubbles: true, cancelable: true, ...init })
    Object.defineProperty(e, 'pointerType', { value: 'mouse' })
    return e
  }
  it('drags the row with snap off, restores snap, swallows one click after a drag only', () => {
    const { row, img } = tree()
    styles.set(row, { overflowX: 'auto', scrollWidth: 900, clientWidth: 500 })
    row.style.scrollSnapType = 'x mandatory'
    row.scrollLeft = 40
    const w = watchDragScroll(window, getStyle)
    img.dispatchEvent(ptr('pointerdown', 300))
    window.dispatchEvent(ptr('pointermove', 250))
    expect(row.style.scrollSnapType).toBe('none')
    expect(row.scrollLeft).toBe(90)
    const drag = new Event('dragstart', { cancelable: true, bubbles: true })
    img.dispatchEvent(drag)
    expect(drag.defaultPrevented).toBe(true)
    window.dispatchEvent(ptr('pointerup', 250))
    expect(row.style.scrollSnapType).toBe('x mandatory')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    img.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    const again = new MouseEvent('click', { bubbles: true, cancelable: true })
    img.dispatchEvent(again)
    expect(again.defaultPrevented).toBe(false)
    // plain click: no swallow
    img.dispatchEvent(ptr('pointerdown', 300))
    window.dispatchEvent(ptr('pointermove', 298))
    window.dispatchEvent(ptr('pointerup', 298))
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true })
    img.dispatchEvent(plain)
    expect(plain.defaultPrevented).toBe(false)
    expect(row.style.scrollSnapType).toBe('x mandatory')
    w.stop()
  })
})

describe('hint and presets', () => {
  it('only x has dragScroll, passed as --gd-dragscroll', () => {
    expect(PRESETS.filter((p) => p.dragScroll).map((p) => p.id)).toEqual(['x'])
    expect(parseDragHint(['--gd-service', '--gd-dragscroll'])).toBe(true)
    expect(parseDragHint(['--gd-service'])).toBe(false)
  })
})
