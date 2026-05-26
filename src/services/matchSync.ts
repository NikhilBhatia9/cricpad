import { ref, set, onValue, off } from 'firebase/database'
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

export async function pushMatchToRoom(code: string, match: Match): Promise<void> {
  if (!isFirebaseConfigured || !db) return
  try {
    await set(ref(db, `rooms/${code}`), {
      match: JSON.stringify(match),
      updatedAt: Date.now(),
    })
  } catch (e) {
    console.warn('Firebase push failed:', e)
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
