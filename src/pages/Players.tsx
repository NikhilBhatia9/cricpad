import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/database'
import { computeCareerBatting, computeCareerBowling } from '../db/operations'

export default function Players() {
  const navigate = useNavigate()

  const players = useLiveQuery(() => db.players.orderBy('totalMatches').reverse().toArray(), [])
  const allStats = useLiveQuery(() => db.playerStats.toArray(), [])

  if (!players || !allStats) {
    return (
      <div className="flex flex-col min-h-screen px-6 py-12 items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (players.length === 0) {
    return (
      <div className="flex flex-col min-h-screen px-6">
        <div className="flex items-center gap-3 py-5">
          <button onClick={() => navigate('/')} className="text-gray-400 text-sm">← Back</button>
          <h1 className="text-xl font-bold">Players</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <div className="text-5xl">👤</div>
          <p className="text-gray-400">No player profiles yet.<br />Complete a match to build profiles.</p>
          <button className="btn-primary" onClick={() => navigate('/setup')}>Start a Match</button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-400 text-sm">← Back</button>
        <h1 className="text-xl font-bold">Players</h1>
        <span className="ml-auto text-gray-500 text-sm">{players.length} players</span>
      </div>

      <div className="space-y-3">
        {players.map((player) => {
          const stats = allStats.filter((s) => s.playerName === player.name)
          const bat = computeCareerBatting(stats)
          const bowl = computeCareerBowling(stats)

          return (
            <button
              key={player.name}
              className="card w-full text-left hover:bg-gray-750 transition-colors active:scale-[0.99]"
              onClick={() => navigate(`/players/${encodeURIComponent(player.name)}`)}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-lg">{player.name}</p>
                  <p className="text-xs text-gray-500">{player.totalMatches} match{player.totalMatches !== 1 ? 'es' : ''}</p>
                </div>
                <span className="text-2xl">🏏</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                {bat.innings > 0 && (
                  <div className="bg-gray-800 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-500 mb-1">Batting</p>
                    <p className="text-xl font-bold text-green-400">{bat.totalRuns}</p>
                    <p className="text-xs text-gray-400">runs · avg {bat.average}</p>
                  </div>
                )}
                {bowl.wickets > 0 && (
                  <div className="bg-gray-800 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-500 mb-1">Bowling</p>
                    <p className="text-xl font-bold text-blue-400">{bowl.wickets}</p>
                    <p className="text-xs text-gray-400">wkts · eco {bowl.economy}</p>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
