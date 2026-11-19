import { describe, expect, it } from 'vitest'
import { buildContextMenu, type MenuParams } from '../src/main/contextmenu'

const flags = { canUndo: true, canRedo: false, canCut: true, canCopy: true, canPaste: true, canSelectAll: true }
const base: MenuParams = {
  linkURL: '',
  srcURL: '',
  mediaType: 'none',
  selectionText: '',
  isEditable: false,
  editFlags: flags,
  misspelledWord: '',
  dictionarySuggestions: []
}
const state = { canGoBack: true, canGoForward: false, locked: false }
const labels = (p: Partial<MenuParams>, s = state) =>
  buildContextMenu({ ...base, ...p }, s).map((i) => ('type' in i ? '-' : i.label))

describe('buildContextMenu', () => {
  it('plain page: Back, Forward, Reload with history enabled flags', () => {
    expect(buildContextMenu(base, state)).toEqual([
      { label: 'Back', action: 'back', enabled: true },
      { label: 'Forward', action: 'forward', enabled: false },
      { label: 'Reload', action: 'reload', enabled: true }
    ])
  })

  it('link: Open link in browser, Copy link address, then page items', () => {
    expect(labels({ linkURL: 'https://a.example/x' })).toEqual([
      'Open link in browser', 'Copy link address', '-', 'Back', 'Forward', 'Reload'
    ])
  })

  it('image: Save image, Copy image, Copy image address', () => {
    expect(labels({ mediaType: 'image', srcURL: 'https://a.example/i.png' })).toEqual([
      'Save image', 'Copy image', 'Copy image address', '-', 'Back', 'Forward', 'Reload'
    ])
  })

  it('selection: Copy; editable: Undo, Redo, Cut, Copy, Paste, Select all with enabled from editFlags', () => {
    expect(labels({ selectionText: 'hi' })).toEqual(['Copy', '-', 'Back', 'Forward', 'Reload'])
    const m = buildContextMenu({ ...base, isEditable: true }, state)
    expect(m.slice(0, 6).map((i) => ('type' in i ? '-' : `${i.label}:${i.enabled}`))).toEqual([
      'Undo:true', 'Redo:false', 'Cut:true', 'Copy:true', 'Paste:true', 'Select all:true'
    ])
  })

  it('misspelling: suggestions first, each carrying the word', () => {
    const m = buildContextMenu(
      { ...base, isEditable: true, misspelledWord: 'teh', dictionarySuggestions: ['the', 'ten'] },
      state
    )
    expect(m.slice(0, 3)).toEqual([
      { label: 'the', action: 'spell', enabled: true, value: 'the' },
      { label: 'ten', action: 'spell', enabled: true, value: 'ten' },
      { type: 'separator' }
    ])
    expect(m[3]).toMatchObject({ label: 'Undo' })
  })

  it('locked: nothing; non-http link: no Open link in browser', () => {
    expect(buildContextMenu({ ...base, linkURL: 'https://a.example' }, { ...state, locked: true })).toEqual([])
    expect(labels({ linkURL: 'mailto:a@b.c' })).toEqual(['Copy link address', '-', 'Back', 'Forward', 'Reload'])
  })
})
