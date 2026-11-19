import { describe, expect, it, vi } from 'vitest'
import { trayTemplate } from '../src/main/traymenu'

describe('trayTemplate', () => {
  it('has a Do Not Disturb checkbox that reflects the state and reports the new one', () => {
    const onDnd = vi.fn()
    const t = trayTemplate({ dnd: true, onShow: () => {}, onDnd, onQuit: () => {} })
    const item = t.find((i) => i.label === 'Do Not Disturb')!
    expect(item.type).toBe('checkbox')
    expect(item.checked).toBe(true)
    ;(item.click as (m: { checked: boolean }) => void)({ checked: false })
    expect(onDnd).toHaveBeenCalledWith(false)
    expect(trayTemplate({ dnd: false, onShow: () => {}, onDnd, onQuit: () => {} }).find((i) => i.label === 'Do Not Disturb')!.checked).toBe(false)
  })
})
