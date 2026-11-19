// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Sidebar from '../src/renderer/src/Sidebar.vue'

const acc = (id: string, serviceId: string, label: string, order: number) => ({
  id, serviceId, label, colour: '#6d5bd0', order
})
const accounts = [
  acc('wa1', 'whatsapp', 'Personal', 0),
  acc('ig1', 'instagram', '@ben.n', 1),
  acc('dc1', 'discord', 'ben_n', 2),
  acc('x1', 'x', '@ben_n', 3),
  acc('fb1', 'facebook', 'Ben N.', 4),
  acc('th1', 'threads', '@ben.n', 5),
  acc('tt1', 'tiktok', '@ben.n', 6)
]

describe('Sidebar', () => {
  const w = mount(Sidebar, { props: { accounts, selectedId: 'dc1' } })

  it('groups WhatsApp and Discord under Chats, the five feeds under Feeds, in stored order', () => {
    const secs = w.findAll('.sec').map((s) => s.text())
    expect(secs).toEqual(['Chats', 'Feeds'])
    const groups = w.findAll('.group')
    expect(groups[0].findAll('.row .name').map((n) => n.text())).toEqual(['PersonalWhatsApp', 'ben_nDiscord'])
    expect(groups[1].findAll('.row .name').map((n) => n.text())).toEqual([
      '@ben.nInstagram', '@ben_nX', 'Ben N.Facebook', '@ben.nThreads', '@ben.nTikTok'
    ])
  })

  it('shows initials avatar with colour and service badge, and marks the selected row', () => {
    const rows = w.findAll('.row')
    expect(rows[0].find('.av').text()).toContain('PE')
    expect(rows[0].find('.av').attributes('style')).toContain('background')
    expect(rows[0].find('.svc').exists()).toBe(true)
    expect(rows[0].find('.count').exists()).toBe(false)
    expect(rows[1].classes()).toContain('on')
    expect(rows[0].classes()).not.toContain('on')
  })

  it('shows the real service logo in each badge, a favicon for a custom site, and a + button', async () => {
    const rows = w.findAll('.row')
    expect(rows[0].find('.svc svg').html()).toContain('M12 2a10 10 0 0 0-8.6 15.1')
    expect(rows[1].find('.svc svg').html()).toContain('M19.3 5.3A16.5')
    const c = mount(Sidebar, {
      props: { accounts: [{ ...acc('c1', 'custom', 'Wiki', 0), custom: { name: 'Wiki', url: 'https://w.example.com', icon: 'data:image/png;base64,AAAA' } }] }
    })
    expect(c.find('.svc img').attributes('src')).toBe('data:image/png;base64,AAAA')
    await w.find('.brand .add').trigger('click')
    expect(w.emitted('add')).toHaveLength(1)
  })

  it('emits select with the account id on click', async () => {
    await w.findAll('.row')[0].trigger('click')
    expect(w.emitted('select')![0]).toEqual(['wa1'])
  })
})
