import { useNavigate } from 'react-router-dom'
import { useMatchStore } from '../store/matchStore'

export default function Home() {
  const navigate = useNavigate()
  const { match, resetMatch } = useMatchStore()

  const hasActiveMatch = match && match.status !== 'complete'

  function resumeMatch() {
    if (!match) return
    if (match.status === 'toss') navigate('/toss')
    else if (match.status === 'innings_break') navigate('/innings-break')
    else navigate('/scoring')
  }

  return (
    <div className="flex flex-col min-h-screen px-6 py-12">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="text-7xl">🏏</div>
        <h1 className="text-4xl font-bold text-center">Cricket Scorer</h1>
        <p className="text-gray-400 text-center text-lg">
          Live scoring for social cricket
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-4 pb-8">
        {hasActiveMatch && (
          <div className="card mb-2">
            <p className="text-sm text-gray-400 mb-1">Active match</p>
            <p className="font-semibold text-lg">
              {match.teams[0].name} vs {match.teams[1].name}
            </p>
            <p className="text-sm text-gray-400">{match.maxOvers} overs</p>
          </div>
        )}

        {hasActiveMatch ? (
          <>
            <button className="btn-primary" onClick={resumeMatch}>
              ▶ Resume Match
            </button>
            <button
              className="btn-secondary"
              onClick={() => { resetMatch(); navigate('/setup') }}
            >
              + New Match
            </button>
          </>
        ) : (
          <button className="btn-primary" onClick={() => navigate('/setup')}>
            + Start New Match
          </button>
        )}

        {match?.status === 'complete' && (
          <button className="btn-secondary" onClick={() => navigate('/result')}>
            View Last Result
          </button>
        )}

        {/* Stats nav */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            className="btn-secondary flex items-center justify-center gap-2"
            onClick={() => navigate('/players')}
          >
            👤 Players
          </button>
          <button
            className="btn-secondary flex items-center justify-center gap-2"
            onClick={() => navigate('/history')}
          >
            📋 History
          </button>
        </div>
      </div>
    </div>
  )
}
