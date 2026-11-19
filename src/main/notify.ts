// Notification decision (D4, D16, D19). Plain TS: no electron import.
export interface NotifyEvent {
  accountId: string
  serviceName: string
  label: string
  title: string
  body?: string
  icon?: string
}

/** Flags later tickets fill in (mute D19, DND D19, hibernated account, lock D16). All off = normal. */
export interface NotifyState {
  muted?: boolean
  dnd?: boolean
  asleep?: boolean
  locked?: boolean
}

export type NotifyDecision =
  | { action: 'drop' }
  | { action: 'generic'; accountId: string; title: string; body: string; subtitle: string }
  | { action: 'full'; accountId: string; title: string; body: string; subtitle: string; icon?: string }

export function decideNotification(event: NotifyEvent, state: NotifyState): NotifyDecision {
  if (state.muted || state.dnd || state.asleep) return { action: 'drop' }
  if (state.locked)
    return { action: 'generic', accountId: event.accountId, title: 'GuiseDesk', body: 'New message', subtitle: '' }
  return {
    action: 'full',
    accountId: event.accountId,
    title: event.title,
    body: event.body ?? '',
    subtitle: `${event.serviceName} - ${event.label}`,
    icon: event.icon
  }
}
