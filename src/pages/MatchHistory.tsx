import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/database'
import type { Match } from '../types/cricket'
import { scoreString, oversDisplay } from '../utils/cricket'
import BackButton from '../components/BackButton'
export default function MatchHistory() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()

  const matches = useLiveQuery(
    () => db.matches.orderBy('completedAt').reverse().toArray(),
    []
  )

  // Detail view for a single match
  if (id) {
    return <MatchDetail matchId={id} onBack={() => navigate('/history')} />
  }

  if (!matches) {
    return (
      <div className="flex flex-col min-h-screen px-6 py-12 items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col min-h-screen px-6">
        <div className="flex items-center gap-3 py-5">
          <BackButton onClick={() => navigate('/')} />
          <h1 className="text-xl font-bold">Match History</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <div className="text-5xl">📋</div>
          <p className="text-gray-400">No matches recorded yet.<br />Complete a match to see it here.</p>
          <button className="btn-primary" onClick={() => navigate('/setup')}>Start a Match</button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton onClick={() => navigate('/')} />
        <h1 className="text-xl font-bold">Match History</h1>
        <span className="ml-auto text-gray-500 text-sm">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
      </div>

      <div className="space-y-3">
        {matches.map((m) => (
          <button
            key={m.id}
            className="card w-full text-left hover:bg-gray-750 transition-colors active:scale-[0.99]"
            onClick={() => navigate(`/history/${m.id}`)}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">{m.teamAName} vs {m.teamBName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.maxOvers} overs · {new Date(m.completedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <span className="text-gray-500 text-lg">›</span>
            </div>
            {m.result && (
              <p className="text-sm text-green-400 mt-2 font-medium">{m.result}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function MatchDetail({ matchId, onBack }: { matchId: string; onBack: () => void }) {
  const navigate = useNavigate()
  const matchRecord = useLiveQuery(() => db.matches.get(matchId), [matchId])

  if (!matchRecord) return <div className="flex flex-col min-h-screen px-6 py-12 items-center justify-center"><div className="text-gray-400">Loading...</div></div>

  const match: Match = JSON.parse(matchRecord.snapshot)
  const i1 = match.innings[0]
  const i2 = match.innings[1]

  return (
    <div className="px-4 py-6 max-w-lg mx-auto pb-10">
      <div className="flex items-center gap-3 mb-5">
        <BackButton onClick={onBack} label="History" />
      </div>

      <div className="text-center mb-5">
        <p className="text-sm text-gray-500">{new Date(matchRecord.completedAt).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p className="text-sm text-gray-400">{match.maxOvers} overs</p>
        {matchRecord.result && <p className="text-lg font-bold text-green-400 mt-2">{matchRecord.result}</p>}
      </div>

      {[i1, i2].map((inn, innIdx) => {
        if (!inn) return null
        const battingTeam = match.teams[inn.battingTeamIndex]
        const batsmen = Object.values(inn.batsmen).sort((a, b) => b.runs - a.runs)
        const bowlers = Object.values(inn.bowlers).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)

        return (
          <div key={innIdx} className="card mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-lg">{battingTeam.name}</h2>
              <p className="text-xl font-bold">{scoreString(inn)} <span className="text-sm text-gray-400">({oversDisplay(inn.totalLegalBalls)} ov)</span></p>
            </div>

            <table className="w-full text-sm mb-3">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-700">
                  <th className="text-left pb-1.5">Batter</th>
                  <th className="text-right pb-1.5">R</th>
                  <th className="text-right pb-1.5">B</th>
                  <th className="text-right pb-1.5">4s</th>
                  <th className="text-right pb-1.5">6s</th>
                  <th className="text-right pb-1.5">SR</th>
                </tr>
              </thead>
              <tbody>
                {batsmen.map((b) => (
                  <tr key={b.playerId} className="border-b border-gray-700/40">
                    <td className="py-1.5">
                      <button className="font-medium text-left hover:text-green-400" onClick={() => navigate(`/players/${encodeURIComponent(b.name)}`)}>{b.name}</button>
                      <p className="text-xs text-gray-500">{b.isOut ? b.wicketType : 'not out'}</p>
                    </td>
                    <td className="text-right font-bold">{b.runs}</td>
                    <td className="text-right text-gray-400">{b.balls}</td>
                    <td className="text-right text-gray-400">{b.fours}</td>
                    <td className="text-right text-gray-400">{b.sixes}</td>
                    <td className="text-right text-gray-400">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(0) : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="text-xs text-gray-500 font-semibold mb-2 mt-3">BOWLING</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-700">
                  <th className="text-left pb-1.5">Bowler</th>
                  <th className="text-right pb-1.5">O</th>
                  <th className="text-right pb-1.5">R</th>
                  <th className="text-right pb-1.5">W</th>
                  <th className="text-right pb-1.5">Eco</th>
                </tr>
              </thead>
              <tbody>
                {bowlers.map((b) => (
                  <tr key={b.playerId} className="border-b border-gray-700/40">
                    <td className="py-1.5">
                      <button className="font-medium text-left hover:text-green-400" onClick={() => navigate(`/players/${encodeURIComponent(b.name)}`)}>{b.name}</button>
                    </td>
                    <td className="text-right text-gray-400">{Math.floor(b.legalBalls / 6)}.{b.legalBalls % 6}</td>
                    <td className="text-right text-gray-400">{b.runsConceded}</td>
                    <td className="text-right font-bold">{b.wickets}</td>
                    <td className="text-right text-gray-400">{b.legalBalls > 0 ? ((b.runsConceded / b.legalBalls) * 6).toFixed(1) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
