// Data only: service presets. No electron imports (the renderer reads this too).
export type Kind = 'chat' | 'feed'

export interface Preset {
  id: string
  name: string
  startUrl: string
  /** Badge shown at the avatar corner: short glyph on a brand colour. */
  icon: { glyph: string; bg: string }
  kind: Kind
  /** Hosts (and their subdomains) that count as the same service. */
  hosts: string[]
  userAgent: string
  /** Services of one company that may share a login (D36). */
  family?: 'meta'
}

// Plain Chrome UA, no Electron or app tokens (WhatsApp Web refuses Electron's).
export const CHROME_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'

const p = (
  id: string, name: string, startUrl: string, glyph: string, bg: string, kind: Kind, hosts: string[]
): Preset => ({ id, name, startUrl, icon: { glyph, bg }, kind, hosts, userAgent: CHROME_UA })

const META = ['instagram', 'threads', 'facebook']

export const PRESETS: Preset[] = [
  p('whatsapp', 'WhatsApp', 'https://web.whatsapp.com/', 'W', '#25d366', 'chat', ['whatsapp.com', 'whatsapp.net']),
  p('discord', 'Discord', 'https://discord.com/app', 'D', '#5865f2', 'chat', ['discord.com', 'discordapp.com', 'discord.gg', 'discordapp.net']),
  p('instagram', 'Instagram', 'https://www.instagram.com/', 'I', '#c13584', 'feed', ['instagram.com', 'cdninstagram.com', 'facebook.com', 'fbcdn.net']),
  p('facebook', 'Facebook', 'https://www.facebook.com/', 'f', '#1877f2', 'feed', ['facebook.com', 'fbcdn.net', 'fb.com']),
  p('x', 'X', 'https://x.com/', 'X', '#000000', 'feed', ['x.com', 'twitter.com', 'twimg.com']),
  p('threads', 'Threads', 'https://www.threads.com/', '@', '#000000', 'feed', ['threads.com', 'threads.net', 'instagram.com', 'cdninstagram.com', 'fbcdn.net']),
  p('tiktok', 'TikTok', 'https://www.tiktok.com/', 'T', '#000000', 'feed', ['tiktok.com', 'tiktokcdn.com', 'tiktokv.com'])
].map((x) => (META.includes(x.id) ? { ...x, family: 'meta' as const } : x))

/** Custom URL service: kind feed by default; start URL and hosts come from the account. */
export const CUSTOM_PRESET_ID = 'custom'

export function presetFor(serviceId: string): Preset | undefined {
  return PRESETS.find((x) => x.id === serviceId)
}

export function kindOf(serviceId: string): Kind {
  return presetFor(serviceId)?.kind ?? 'feed'
}
