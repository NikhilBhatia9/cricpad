import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatchStore } from '../store/matchStore'
import BackButton from '../components/BackButton'

type Phase = 'pick' | 'flipping' | 'elect'

export default function Toss() {
  const navigate = useNavigate()
  const { match, setToss } = useMatchStore()
  const [phase, setPhase] = useState<Phase>('pick')
  const [winnerIdx, setWinnerIdx] = useState<0 | 1 | null>(null)

  if (!match) return <div className="p-6">No match found. <button onClick={() => navigate('/')}>Go home</button></div>

  function pickWinner(idx: 0 | 1) {
    setWinnerIdx(idx)
    setPhase('flipping')
    setTimeout(() => setPhase('elect'), 1600)
  }

  function handleElect(elected: 'bat' | 'field') {
    if (winnerIdx === null) return
    setToss(winnerIdx, elected)
    navigate('/scoring')
  }

  const winnerName = winnerIdx !== null ? match.teams[winnerIdx].name : ''

  return (
    <div className="flex flex-col min-h-screen px-6 py-12">
      <BackButton onClick={() => navigate('/setup')} label="Setup" />

      <div className="flex-1 flex flex-col items-center justify-center gap-6">

        {/* Coin */}
        <div
          className="text-8xl select-none"
          style={
            phase === 'flipping'
              ? { animation: 'spin 0.28s linear 6', display: 'inline-block' }
              : { display: 'inline-block' }
          }
        >
          🪙
        </div>

        {phase === 'pick' && (
          <>
            <h1 className="text-2xl font-bold text-center">Who won the toss?</h1>
            <p className="text-gray-500 dark:text-gray-400 text-center text-sm">Tap the winning team</p>
            <div className="flex flex-col gap-4 w-full max-w-sm mt-2">
              {match.teams.map((team, idx) => (
                <button
                  key={idx}
                  onClick={() => pickWinner(idx as 0 | 1)}
                  className="w-full py-5 rounded-2xl font-bold text-lg text-white transition-all active:scale-[0.97]"
                  style={{ background: idx === 0 ? '#15803d' : '#1d4ed8' }}
                >
                  {team.name}
                </button>
              ))}
            </div>
          </>
        )}

        {phase === 'flipping' && (
          <>
            <h1 className="text-2xl font-bold text-center animate-pulse">Flipping…</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Determining the winner</p>
          </>
        )}

        {phase === 'elect' && (
          <>
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Toss won by</p>
              <h1 className="text-2xl font-bold text-green-400">{winnerName} 🎉</h1>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Choose to bat or field</p>
            <div className="flex gap-4 w-full max-w-sm">
              <button
                className="flex-1 bg-green-700 hover:bg-green-600 text-white font-bold py-5 rounded-2xl text-lg transition-colors"
                onClick={() => handleElect('bat')}
              >
                🏏 Bat
              </button>
              <button
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-5 rounded-2xl text-lg transition-colors"
                onClick={() => handleElect('field')}
              >
                🧤 Field
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
