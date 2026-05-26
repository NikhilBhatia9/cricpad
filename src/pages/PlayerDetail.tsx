import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/database'
import { computeCareerBatting, computeCareerBowling } from '../db/operations'
import BackButton from '../components/BackButton'

export default function PlayerDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const playerName = decodeURIComponent(name ?? '')

  const player = useLiveQuery(() => db.players.get(playerName), [playerName])
  const stats = useLiveQuery(
    () => db.playerStats.where('playerName').equals(playerName).toArray(),
    [playerName]
  )

  // Derive match IDs from stats (empty array while loading)
  const matchIds = stats ? [...new Set(stats.map((s) => s.matchId))] : []

  const playerMatches = useLiveQuery(
    () =>
      matchIds.length > 0
        ? db.matches.where('id').anyOf(matchIds).sortBy('completedAt').then((ms) => ms.reverse().slice(0, 10))
        : Promise.resolve([]),
    [matchIds.join(',')]
  )

  if (player === undefined || stats === undefined || playerMatches === undefined) {
    return (
      <div className="flex flex-col min-h-screen px-6 py-12 items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (player === null) {
    return (
      <div className="flex flex-col min-h-screen px-6 py-12 items-center justify-center gap-4">
        <p className="text-gray-400">Player not found.</p>
        <BackButton onClick={() => navigate('/players')} label="Players" />
      </div>
    )
  }

  const bat = computeCareerBatting(stats)
  const bowl = computeCareerBowling(stats)

  return (
    <div className="px-4 py-6 max-w-lg mx-auto pb-10">
      <div className="flex items-center gap-3 mb-6">
        <BackButton onClick={() => navigate('/players')} label="Players" />
      </div>

      {/* Header */}
      <div className="card mb-4 text-center">
        <div className="text-5xl mb-2">🏏</div>
        <h1 className="text-2xl font-bold">{player.name}</h1>
        <p className="text-gray-400 text-sm mt-1">{matchIds.length} match{matchIds.length !== 1 ? 'es' : ''} played</p>
      </div>

      {/* Batting */}
      {bat.innings > 0 && (
        <div className="card mb-4">
          <h2 className="font-semibold text-gray-300 mb-3">🏏 Batting</h2>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <StatBox label="Matches" value={bat.matches} />
            <StatBox label="Innings" value={bat.innings} />
            <StatBox label="Runs" value={bat.totalRuns} highlight />
            <StatBox label="Average" value={bat.average} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatBox label="S/R" value={bat.strikeRate} />
            <StatBox label="H/S" value={bat.highestScore} />
            <StatBox label="50s" value={bat.fifties} />
            <StatBox label="100s" value={bat.hundreds} />
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700 flex gap-4 text-sm text-gray-400">
            <span>Not Outs: <strong className="text-white">{bat.notOuts}</strong></span>
            <span>4s: <strong className="text-white">{bat.fours}</strong></span>
            <span>6s: <strong className="text-white">{bat.sixes}</strong></span>
          </div>
        </div>
      )}

      {/* Bowling */}
      {bowl.legalBalls > 0 && (
        <div className="card mb-4">
          <h2 className="font-semibold text-gray-300 mb-3">🎯 Bowling</h2>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <StatBox label="Wickets" value={bowl.wickets} highlight />
            <StatBox label="Overs" value={`${Math.floor(bowl.legalBalls / 6)}.${bowl.legalBalls % 6}`} />
            <StatBox label="Maidens" value={bowl.maidens} />
            <StatBox label="Runs" value={bowl.runsConceded} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatBox label="Economy" value={bowl.economy} />
            <StatBox label="Average" value={bowl.average} />
            <StatBox label="S/R" value={bowl.strikeRate} />
            <StatBox label="Best" value={`${bowl.bestWickets}/${bowl.bestRuns}`} />
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700 flex gap-4 text-sm text-gray-400">
            <span>Matches: <strong className="text-white">{bowl.matches}</strong></span>
          </div>
        </div>
      )}

      {/* Recent Matches */}
      {playerMatches.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-300 mb-3">Recent Matches</h2>
          <div className="space-y-2">
            {playerMatches.map((m) => {
              const playerStat = stats.filter((s) => s.matchId === m.id)
              const batStat = playerStat.find((s) => s.batDidBat)
              const bowlStat = playerStat.find((s) => s.bowlDidBowl)
              return (
                <button
                  key={m.id}
                  className="w-full text-left bg-gray-800 rounded-lg p-3 hover:bg-gray-750 transition-colors"
                  onClick={() => navigate(`/history/${m.id}`)}
                >
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">{m.teamAName} vs {m.teamBName}</p>
                    <p className="text-xs text-gray-500">{new Date(m.completedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    {batStat && <span>🏏 {batStat.batRuns} ({batStat.batBalls}b){batStat.batIsOut ? '' : '*'}</span>}
                    {bowlStat && <span>🎯 {bowlStat.bowlWickets}/{bowlStat.bowlRunsConceded} ({Math.floor(bowlStat.bowlLegalBalls / 6)}.{bowlStat.bowlLegalBalls % 6}ov)</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-gray-800 rounded-lg p-2 text-center">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}
