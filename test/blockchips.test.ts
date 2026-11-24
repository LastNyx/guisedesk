// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TopBar from '../src/renderer/src/TopBar.vue'
import { createBlockState } from '../src/main/blockstate'

const wa = { id: 'wa1', serviceId: 'whatsapp', label: 'Personal', colour: '#2f9e6e', order: 1 }

describe('TopBar blocking chips', () => {
  it('the shield count shows only while ad blocking is on', () => {
    const on = mount(TopBar, { props: { account: wa, asleep: false, adsOn: true, blocked: 12 } })
    expect(on.find('.chip.shield').text()).toBe('12')
    expect(on.find('.chip.shield').attributes('title')).toBe('Ads and trackers blocked')
    expect(mount(TopBar, { props: { account: wa, asleep: false, adsOn: false, blocked: 12 } }).find('.chip.shield').exists()).toBe(false)
    expect(mount(TopBar, { props: { account: wa, asleep: false } }).find('.chip.shield').exists()).toBe(false)
  })
  it('"Pop-up blocked" shows for a dropped pop-up and clicking it asks to open it anyway', async () => {
    const w = mount(TopBar, { props: { account: wa, asleep: false, popup: 'https://shop.example/pay' } })
    const chip = w.find('.chip.popup')
    expect(chip.text()).toBe('Pop-up blocked')
    expect(chip.attributes('title')).toBe('Open anyway: https://shop.example/pay')
    await chip.trigger('click')
    expect(w.emitted('open-popup')).toHaveLength(1)
    expect(mount(TopBar, { props: { account: wa, asleep: false } }).find('.chip.popup').exists()).toBe(false)
  })
})

describe('block state', () => {
  it('open anyway hands back the dropped URL once and clears the chip; navigation resets the count', () => {
    vi.useFakeTimers()
    const changed = vi.fn()
    const s = createBlockState(changed)
    s.blocked('a'); s.blocked('a')
    vi.advanceTimersByTime(300)
    expect(s.snapshot().a.blocked).toBe(2)
    s.popup('a', 'https://x/p')
    expect(s.take('a')).toBe('https://x/p')
    expect(s.take('a')).toBeUndefined()
    expect(s.snapshot().a.popup).toBeUndefined()
    s.popup('a', 'https://x/q')
    s.navigated('a')
    expect(s.snapshot().a).toEqual({ blocked: 0 })
    expect(changed).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
