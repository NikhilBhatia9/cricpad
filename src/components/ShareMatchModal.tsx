import { useState, useEffect } from 'react'
import { useMatchStore } from '../store/matchStore'
import { generateRoomCode, createSpectatorAlias } from '../services/matchSync'
import { isFirebaseConfigured } from '../config/firebase'

interface Props {
  onClose: () => void
}

export default function ShareMatchModal({ onClose }: Props) {
  const { match, roomCode, spectatorCode, setRoomCode, setSpectatorCode } = useMatchStore()
  const [copiedScorer, setCopiedScorer] = useState(false)
  const [copiedSpectator, setCopiedSpectator] = useState(false)

  if (!isFirebaseConfigured) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4" onClick={onClose}>
        <div className="card w-full max-w-md mb-4" onClick={(e) => e.stopPropagation()}>
          <h2 className="font-bold text-lg mb-2">Live Sharing</h2>
          <p className="text-gray-400 text-sm mb-4">
            Live sharing requires Firebase to be configured. See <code className="text-green-400">FIREBASE_SETUP.md</code> in the repo for instructions.
          </p>
          <button className="btn-secondary w-full" onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }

  // Generate both codes on first open
  const scorer = roomCode ?? generateRoomCode()
  const spectator = spectatorCode ?? generateRoomCode()

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!roomCode) setRoomCode(scorer)
    if (!spectatorCode) {
      setSpectatorCode(spectator)
      createSpectatorAlias(spectator, scorer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scorerUrl = `${window.location.origin}/cricpad/join?code=${scorer}`
  const spectatorUrl = `${window.location.origin}/cricpad/join?code=${spectator}`

  function copy(text: string, setFlag: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setFlag(true)
      setTimeout(() => setFlag(false), 2000)
    })
  }

  async function shareUrl(url: string, label: string) {
    if (navigator.share) {
      await navigator.share({
        title: `Join cricket match — ${match?.teams[0].name} vs ${match?.teams[1].name}`,
        text: label,
        url,
      })
    } else {
      navigator.clipboard.writeText(url)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md mb-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">Share Match</h2>
          <button className="text-gray-400 text-xl" onClick={onClose}>✕</button>
        </div>

        {/* Scorer code */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-2">🎯 Scorer Code — can record balls</p>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 text-center mb-2">
            <p className="text-4xl font-bold tracking-[0.3em] text-green-600 dark:text-green-400 font-mono">{scorer}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`btn-secondary text-sm flex items-center justify-center gap-1.5 ${copiedScorer ? 'bg-green-800 text-green-300' : ''}`}
              onClick={() => copy(scorer, setCopiedScorer)}
            >
              {copiedScorer ? '✓ Copied' : '📋 Copy Code'}
            </button>
            <button className="btn-primary text-sm flex items-center justify-center gap-1.5" onClick={() => shareUrl(scorerUrl, `Use scorer code ${scorer} to score live`)}>
              🔗 Share Link
            </button>
          </div>
        </div>

        <div className="h-px bg-gray-200 dark:bg-gray-700 mb-4" />

        {/* Spectator code */}
        <div>
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">👁 Spectator Code — view only</p>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 text-center mb-2">
            <p className="text-4xl font-bold tracking-[0.3em] text-blue-600 dark:text-blue-400 font-mono">{spectator}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`btn-secondary text-sm flex items-center justify-center gap-1.5 ${copiedSpectator ? 'bg-blue-800 text-blue-300' : ''}`}
              onClick={() => copy(spectator, setCopiedSpectator)}
            >
              {copiedSpectator ? '✓ Copied' : '📋 Copy Code'}
            </button>
            <button className="btn-primary text-sm flex items-center justify-center gap-1.5" onClick={() => shareUrl(spectatorUrl, `Use spectator code ${spectator} to watch live`)}>
              🔗 Share Link
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-600 text-center mt-4">
          Tell others to tap "Join Match" on the home screen
        </p>
      </div>
    </div>
  )
}
