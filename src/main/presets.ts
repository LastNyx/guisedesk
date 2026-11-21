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
  /** The service's own domains (never CDN or login hosts): a link to one opens in this service (D40). */
  homeHosts: string[]
  userAgent: string
  /** Services of one company that may share a login (D36). */
  family?: 'meta'
  /** Selectors for a post that is not a link: its container and the permalink inside it (D38). */
  postLink?: { container: string; link: string }
  /** Selectors for media to blur until clicked: container, media inside it, and media to leave alone (D42). */
  blurMedia?: { container: string; media: string; skip?: string }
}

// Plain Chrome UA, no Electron or app tokens (WhatsApp Web refuses Electron's).
export const CHROME_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'

const p = (
  id: string, name: string, startUrl: string, glyph: string, bg: string, kind: Kind, hosts: string[], homeHosts: string[]
): Preset => ({ id, name, startUrl, icon: { glyph, bg }, kind, hosts, homeHosts, userAgent: CHROME_UA })

const META = ['instagram', 'threads', 'facebook']

export const PRESETS: Preset[] = [
  p('whatsapp', 'WhatsApp', 'https://web.whatsapp.com/', 'W', '#25d366', 'chat', ['whatsapp.com', 'whatsapp.net'], ['whatsapp.com']),
  p('discord', 'Discord', 'https://discord.com/app', 'D', '#5865f2', 'chat', ['discord.com', 'discordapp.com', 'discord.gg', 'discordapp.net'], ['discord.com', 'discord.gg']),
  p('instagram', 'Instagram', 'https://www.instagram.com/', 'I', '#c13584', 'feed', ['instagram.com', 'cdninstagram.com', 'facebook.com', 'fbcdn.net'], ['instagram.com']),
  p('facebook', 'Facebook', 'https://www.facebook.com/', 'f', '#1877f2', 'feed', ['facebook.com', 'fbcdn.net', 'fb.com'], ['facebook.com', 'fb.com']),
  p('x', 'X', 'https://x.com/', 'X', '#000000', 'feed', ['x.com', 'twitter.com', 'twimg.com'], ['x.com', 'twitter.com']),
  p('threads', 'Threads', 'https://www.threads.com/', '@', '#000000', 'feed', ['threads.com', 'threads.net', 'instagram.com', 'cdninstagram.com', 'fbcdn.net'], ['threads.com', 'threads.net']),
  p('tiktok', 'TikTok', 'https://www.tiktok.com/', 'T', '#000000', 'feed', ['tiktok.com', 'tiktokcdn.com', 'tiktokv.com'], ['tiktok.com'])
].map((x) => (META.includes(x.id) ? { ...x, family: 'meta' as const } : x))
  .map((x) => (x.id === 'threads' ? { ...x, postLink: { container: '[data-pressable-container]', link: 'a[href*="/post/"]' } } : x))

// Best effort selectors (D42); they drift as the sites change.
const BLUR: Record<string, NonNullable<Preset['blurMedia']>> = {
  x: { container: 'article[data-testid="tweet"]', media: '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="card.layoutLarge.media"]' },
  threads: { container: '[data-pressable-container]', media: 'picture, img, video', skip: 'img[alt*="profile picture"]' },
  instagram: { container: 'article', media: 'img, video', skip: 'img[alt*="profile picture"]' },
  facebook: { container: '[role="article"]', media: 'img, video', skip: 'svg image, img[height="40"], img[width="40"]' }
}
for (const x of PRESETS) if (BLUR[x.id]) x.blurMedia = BLUR[x.id]

/** Custom URL service: kind feed by default; start URL and hosts come from the account. */
export const CUSTOM_PRESET_ID = 'custom'

export function presetFor(serviceId: string): Preset | undefined {
  return PRESETS.find((x) => x.id === serviceId)
}

export function kindOf(serviceId: string): Kind {
  return presetFor(serviceId)?.kind ?? 'feed'
}
