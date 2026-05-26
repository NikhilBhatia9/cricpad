import { useState } from 'react'
import { useMatchStore } from '../store/matchStore'
import { generateRoomCode } from '../services/matchSync'
import { isFirebaseConfigured } from '../config/firebase'

interface Props {
  onClose: () => void
}

export default function ShareMatchModal({ onClose }: Props) {
  const { match, roomCode, setRoomCode } = useMatchStore()
  const [copied, setCopied] = useState(false)

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

  const code = roomCode ?? generateRoomCode()
  if (!roomCode) setRoomCode(code)

  const shareUrl = `${window.location.origin}/social-cricket-scorer/join?code=${code}`

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function shareLink() {
    if (navigator.share) {
      await navigator.share({
        title: `Join cricket match — ${match?.teams[0].name} vs ${match?.teams[1].name}`,
        text: `Use code ${code} to follow along live`,
        url: shareUrl,
      })
    } else {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md mb-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">Share Match</h2>
          <button className="text-gray-400 text-xl" onClick={onClose}>✕</button>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Others can join this match live on their device using the code below.
        </p>

        {/* Room code display */}
        <div className="bg-gray-800 rounded-2xl p-5 text-center mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Match Code</p>
          <p className="text-5xl font-bold tracking-[0.3em] text-green-400 font-mono">{code}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            className={`btn-secondary flex items-center justify-center gap-2 transition-colors ${copied ? 'bg-green-800 text-green-300' : ''}`}
            onClick={copyCode}
          >
            {copied ? '✓ Copied' : '📋 Copy Code'}
          </button>
          <button className="btn-primary flex items-center justify-center gap-2" onClick={shareLink}>
            🔗 Share Link
          </button>
        </div>

        <p className="text-xs text-gray-600 text-center">
          Tell others to tap "Join Match" on the home screen
        </p>
      </div>
    </div>
  )
}
