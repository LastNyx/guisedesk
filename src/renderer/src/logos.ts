// Service logos (white glyphs on the brand colour), taken from the mockup symbols. One place: the sidebar badge and the Add account picker both use it.
export interface Logo { bg: string; svg: string }

export const LOGOS: Record<string, Logo> = {
  whatsapp: {
    bg: '#25d366',
    svg: '<path fill="#fff" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4zm-3 3.5c-.3 0-.7.1-1 .5-.3.4-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.3 2.4.9 2.9.7 3.4.7.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.1-1.4l-.5-.3-1.9-.9c-.3-.1-.5-.1-.7.2l-.9 1.1c-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5.3-.5v-.5l-.9-2.1c-.2-.5-.4-.5-.6-.5H9z"/>'
  },
  instagram: {
    bg: '#d62976',
    svg: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#fff" stroke-width="2.2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#fff" stroke-width="2.2"/><circle cx="17.3" cy="6.7" r="1.3" fill="#fff"/>'
  },
  facebook: {
    bg: '#1877f2',
    svg: '<path fill="#fff" d="M14 22v-8h2.7l.4-3.2H14V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4A22 22 0 0 0 14.8 4C12.4 4 10.8 5.5 10.8 8.2v2.6H8V14h2.8v8H14z"/>'
  },
  x: {
    bg: '#000000',
    svg: '<path fill="#fff" d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.2L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.5l11.2 14.5z"/>'
  },
  threads: {
    bg: '#000000',
    svg: '<path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" d="M16.5 11.2c-.6-2.8-2.6-4-5-4-3 0-4.8 2.3-4.8 5.3 0 3.4 2 5.8 5.5 5.8 3 0 5.3-1.8 5.3-4.4 0-2.3-2-3.5-4.3-3.5-2 0-3.3 1-3.3 2.4 0 1.2 1 2 2.3 2 2.2 0 3.3-2 3.3-5"/>'
  },
  tiktok: {
    bg: '#000000',
    svg: '<path fill="#fff" d="M16.6 2h-3.3v13.3a2.9 2.9 0 1 1-2-2.8V9.1a6.2 6.2 0 1 0 5.3 6.2V8.6a7.7 7.7 0 0 0 4.4 1.4V6.7a4.4 4.4 0 0 1-4.4-4.7z"/>'
  },
  discord: {
    bg: '#5865f2',
    svg: '<path fill="#fff" d="M19.3 5.3A16.5 16.5 0 0 0 15.2 4l-.5 1a15 15 0 0 0-5.4 0l-.5-1a16.5 16.5 0 0 0-4.1 1.3C2.1 9.2 1.4 13 1.8 16.8a16.6 16.6 0 0 0 5 2.5l1.1-1.7a10 10 0 0 1-1.7-.8l.4-.3a11.8 11.8 0 0 0 10.8 0l.4.3-1.7.8 1.1 1.7a16.6 16.6 0 0 0 5-2.5c.5-4.4-.7-8.2-2.9-11.5zM8.5 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/>'
  },
}

/** Stroke link icon for Custom URL (mockup i-link). */
export const LINK_ICON = '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'

export const logoStyle = (serviceId: string): Record<string, string> => {
  const bg = LOGOS[serviceId]?.bg
  return bg === '#000000' ? { background: bg, boxShadow: 'inset 0 0 0 1px #ffffff30' } : { background: bg ?? '#2a2a34' }
}
