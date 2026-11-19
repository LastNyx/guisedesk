// Permission policy for service pages: only notifications are granted; camera, mic, geolocation and the rest are denied.
export function permissionAllowed(permission: string): boolean {
  return permission === 'notifications'
}
