/** Only real input (isTrusted) restarts the idle period; a page script can dispatch synthetic events. */
export const countsAsInput = (e: { isTrusted: boolean }): boolean => e.isTrusted === true
