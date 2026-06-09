import type { Canvas } from '../types/domain'

/**
 * Private-canvas share links. With a real backend, the canvas is resolved
 * server-side from the opaque token in the path — so links are short and
 * contain no embedded payload. The guest link omits the host token entirely.
 */

/** Participant link → joins + gets assigned an artboard (guest entry, no account). */
export function buildGuestLink(origin: string, canvas: Canvas): string {
  return `${origin}/join/${canvas.guestToken}`
}

/** Host link → management console. Bearer of this link controls the canvas. */
export function buildHostLink(origin: string, canvas: Canvas): string {
  return `${origin}/host/${canvas.hostToken}`
}
