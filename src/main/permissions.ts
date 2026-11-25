// Permission policy for service pages: notifications and clipboard writes (site "Copy link" buttons use
// navigator.clipboard.writeText) are granted; clipboard reads, camera, mic, geolocation and the rest are denied.
const ALLOWED = new Set(['notifications', 'clipboard-sanitized-write'])

export function permissionAllowed(permission: string): boolean {
  return ALLOWED.has(permission)
}
