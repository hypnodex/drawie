/**
 * Anonymous guest identity for link-only private canvases (no login required).
 * One persistent identity per browser; login will be layered on later.
 */
export interface GuestIdentity {
  id: string
  name: string
}

const KEY = 'drawie.guest.v1'
const ADJECTIVES = ['Swift', 'Calm', 'Bright', 'Bold', 'Quiet', 'Lucky', 'Brave', 'Keen']
const NOUNS = ['Fox', 'Heron', 'Otter', 'Lynx', 'Wren', 'Moth', 'Pike', 'Hare']

function randomName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 90) + 10
  return `${a} ${n} ${num}`
}

export function getOrCreateGuest(): GuestIdentity {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as GuestIdentity
  } catch { /* ignore */ }
  const guest: GuestIdentity = {
    id: `guest-${Math.random().toString(36).slice(2, 10)}`,
    name: randomName(),
  }
  try { localStorage.setItem(KEY, JSON.stringify(guest)) } catch { /* ignore */ }
  return guest
}
