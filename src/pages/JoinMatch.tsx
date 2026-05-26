import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMatchStore } from '../store/matchStore'
import { subscribeToRoom } from '../services/matchSync'
import { isFirebaseConfigured } from '../config/firebase'

export default function JoinMatch() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setRoomCode, loadRemoteMatch } = useMatchStore()

  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Auto-join if code is in URL
  useEffect(() => {
    const urlCode = searchParams.get('code')
    if (urlCode) joinWithCode(urlCode)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function joinWithCode(joinCode: string) {
    const trimmed = joinCode.trim().toUpperCase()
    if (trimmed.length !== 6) {
      setErrorMsg('Code must be 6 characters')
      setStatus('error')
      return
    }

    if (!isFirebaseConfigured) {
      setErrorMsg('Live sharing is not configured on this deployment.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setErrorMsg('')

    // Subscribe once to check if room exists
    const unsub = subscribeToRoom(trimmed, (remoteMatch, rawJson) => {
      unsub()
      setRoomCode(trimmed)
      loadRemoteMatch(remoteMatch)
      // Navigate to the right page based on match status
      const status = remoteMatch.status
      if (status === 'toss') navigate('/toss')
      else if (status === 'innings_break') navigate('/innings-break')
      else if (status === 'complete') navigate('/result')
      else navigate('/scoring')
      // Store raw for echo prevention
      void rawJson
    })

    // Timeout if no response after 5s
    setTimeout(() => {
      if (status === 'loading') {
        unsub()
        setErrorMsg('Room not found. Check the code and try again.')
        setStatus('error')
      }
    }, 5000)
  }

  return (
    <div className="flex flex-col min-h-screen px-6 py-12 max-w-md mx-auto">
      <button onClick={() => navigate('/')} className="text-gray-400 text-sm mb-8 self-start">← Back</button>

      <div className="flex-1 flex flex-col justify-center gap-6">
        <div className="text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold mb-2">Join Match</h1>
          <p className="text-gray-400 text-sm">Enter the 6-character code shared by the scorer</p>
        </div>

        <div className="card">
          <input
            className="input-field text-center text-2xl font-bold tracking-[0.3em] uppercase font-mono mb-4"
            placeholder="ABC123"
            value={code}
            maxLength={6}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setStatus('idle')
              setErrorMsg('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && joinWithCode(code)}
          />

          {errorMsg && (
            <p className="text-red-400 text-sm text-center mb-3">{errorMsg}</p>
          )}

          <button
            className="btn-primary w-full"
            onClick={() => joinWithCode(code)}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⟳</span> Joining...
              </span>
            ) : 'Join Match'}
          </button>
        </div>

        {!isFirebaseConfigured && (
          <p className="text-xs text-yellow-600 text-center">
            ⚠️ Live sync not configured — see FIREBASE_SETUP.md
          </p>
        )}
      </div>
    </div>
  )
}
