import { useEffect, useRef } from 'react'
import { useMatchStore } from '../store/matchStore'
import { pushMatchToRoom, subscribeToRoom } from '../services/matchSync'
import { isFirebaseConfigured } from '../config/firebase'
import type { Match } from '../types/cricket'

/**
 * Invisible component that wires up Firebase real-time sync.
 * - Pushes local match state to Firebase on every change.
 * - Subscribes to the room and applies remote updates.
 * - Uses a lightweight fingerprint (B-07) instead of full JSON to prevent
 *   false echo loops caused by key-order serialization differences.
 */

// B-07: lightweight fingerprint — immune to JSON key-order differences
function matchFingerprint(m: Match): string {
  const i1 = m.innings[0], i2 = m.innings[1]
  return [
    m.id, m.status,
    i1?.totalLegalBalls ?? 0, i1?.totalRuns ?? 0, i1?.totalWickets ?? 0,
    i2?.totalLegalBalls ?? 0, i2?.totalRuns ?? 0, i2?.totalWickets ?? 0,
  ].join('|')
}

export default function SyncManager() {
  const { match, roomCode, loadRemoteMatch } = useMatchStore()
  const lastPushedRef = useRef<string>('')

  // Push local changes to Firebase
  useEffect(() => {
    if (!isFirebaseConfigured || !match || !roomCode) return
    const fp = matchFingerprint(match)
    if (fp === lastPushedRef.current) return // no change, skip
    lastPushedRef.current = fp
    pushMatchToRoom(roomCode, match)
  }, [match, roomCode])

  // Subscribe to remote updates when roomCode is set
  useEffect(() => {
    if (!isFirebaseConfigured || !roomCode) return
    const unsubscribe = subscribeToRoom(roomCode, (remoteMatch) => {
      const fp = matchFingerprint(remoteMatch)
      // Skip if this is exactly what we last pushed (echo prevention)
      if (fp === lastPushedRef.current) return
      lastPushedRef.current = fp
      loadRemoteMatch(remoteMatch)
    })
    return unsubscribe
  }, [roomCode, loadRemoteMatch])

  return null
}
