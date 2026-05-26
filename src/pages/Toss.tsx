import { useNavigate } from 'react-router-dom'
import { useMatchStore } from '../store/matchStore'

export default function Toss() {
  const navigate = useNavigate()
  const { match, setToss } = useMatchStore()

  if (!match) return <div className="p-6">No match found. <button onClick={() => navigate('/')}>Go home</button></div>

  function handleToss(winnerIndex: 0 | 1, elected: 'bat' | 'field') {
    setToss(winnerIndex, elected)
    navigate('/scoring')
  }

  return (
    <div className="flex flex-col min-h-screen px-6 py-12">
      <button onClick={() => navigate('/setup')} className="text-gray-400 mb-4 text-sm self-start">← Back</button>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="text-5xl">🪙</div>
        <h1 className="text-2xl font-bold text-center">Toss</h1>
        <p className="text-gray-400 text-center">Who won the toss?</p>

        <div className="flex flex-col gap-4 w-full max-w-sm">
          {match.teams.map((team, idx) => (
            <div key={idx} className="card">
              <p className="font-semibold text-lg text-center mb-3">{team.name}</p>
              <div className="flex gap-3">
                <button
                  className="flex-1 bg-green-700 hover:bg-green-600 text-white font-semibold py-2 rounded-xl transition-colors"
                  onClick={() => handleToss(idx as 0 | 1, 'bat')}
                >
                  🏏 Bat
                </button>
                <button
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 rounded-xl transition-colors"
                  onClick={() => handleToss(idx as 0 | 1, 'field')}
                >
                  🧤 Field
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
