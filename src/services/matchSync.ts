import { ref, set, onValue, off, get } from 'firebase/database'
import { db, isFirebaseConfigured } from '../config/firebase'
import type { Match } from '../types/cricket'

// Characters chosen to avoid I/O/0/1 confusion
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('')
}

export async function pushMatchToRoom(code: string, match: Match, spectatorCode?: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return
  try {
    await set(ref(db, `rooms/${code}`), {
      match: JSON.stringify(match),
      ...(spectatorCode ? { spectatorCode } : {}),
      updatedAt: Date.now(),
    })
  } catch (e) {
    console.warn('Firebase push failed:', e)
  }
}

/** Creates a read-only alias node so spectators can join via their own code. */
export async function createSpectatorAlias(spectatorCode: string, scorerCode: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return
  try {
    await set(ref(db, `rooms/${spectatorCode}`), { aliasFor: scorerCode })
  } catch (e) {
    console.warn('Firebase alias creation failed:', e)
  }
}

/** Resolves a code to { scorerCode, isSpectator }.
 *  Returns null if the room doesn't exist after a single read. */
export async function resolveRoomCode(code: string): Promise<{ scorerCode: string; isSpectator: boolean } | null> {
  if (!isFirebaseConfigured || !db) return null
  try {
    const snap = await get(ref(db, `rooms/${code}`))
    if (!snap.exists()) return null
    const data = snap.val() as Record<string, unknown>
    if (data.aliasFor && typeof data.aliasFor === 'string') {
      return { scorerCode: data.aliasFor, isSpectator: true }
    }
    return { scorerCode: code, isSpectator: false }
  } catch {
    return null
  }
}

export function subscribeToRoom(
  code: string,
  onUpdate: (match: Match, raw: string) => void
): () => void {
  if (!isFirebaseConfigured || !db) return () => {}
  const roomRef = ref(db, `rooms/${code}`)
  onValue(roomRef, (snapshot) => {
    const data = snapshot.val()
    if (data?.match) {
      try {
        onUpdate(JSON.parse(data.match), data.match)
      } catch (e) {
        console.warn('Failed to parse remote match:', e)
      }
    }
  })
  return () => off(roomRef)
}
