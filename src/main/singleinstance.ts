import { startsHidden } from './autostart'

/** What the running instance does when a second copy is launched (D35): a --hidden launch (login start) changes nothing visible. */
export const secondLaunch = (argv: string[]): 'show' | 'ignore' => (startsHidden(argv) ? 'ignore' : 'show')
