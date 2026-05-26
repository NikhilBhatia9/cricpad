import { useEffect, useRef } from 'react'
import { useMatchStore } from '../store/matchStore'
import { pushMatchToRoom, subscribeToRoom } from '../services/matchSync'
import { isFirebaseConfigured } from '../config/firebase'

/**
 * Invisible component that wires up Firebase real-time sync.
 * - Pushes local match state to Firebase on every change.
 * - Subscribes to the room and applies remote updates.
 * - Uses lastPushed ref to prevent echo loops (push → receive → push).
 */
export default function SyncManager() {
  const { match, roomCode, loadRemoteMatch } = useMatchStore()
  const lastPushedRef = useRef<string>('')

  // Push local changes to Firebase
  useEffect(() => {
    if (!isFirebaseConfigured || !match || !roomCode) return
    const json = JSON.stringify(match)
    if (json === lastPushedRef.current) return // no change, skip
    lastPushedRef.current = json
    pushMatchToRoom(roomCode, match)
  }, [match, roomCode])

  // Subscribe to remote updates when roomCode is set
  useEffect(() => {
    if (!isFirebaseConfigured || !roomCode) return
    const unsubscribe = subscribeToRoom(roomCode, (_remoteMatch, rawJson) => {
      // Skip if this is exactly what we last pushed (echo prevention)
      if (rawJson === lastPushedRef.current) return
      lastPushedRef.current = rawJson
      loadRemoteMatch(_remoteMatch)
    })
    return unsubscribe
  }, [roomCode, loadRemoteMatch])

  return null
}
