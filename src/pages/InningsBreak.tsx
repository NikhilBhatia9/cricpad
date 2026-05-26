import { useNavigate } from 'react-router-dom'
import { useMatchStore } from '../store/matchStore'
import { scoreString, oversDisplay, sortedBatsmen, sortedBowlers, strikeRate, economyRate } from '../utils/cricket'

export default function InningsBreak() {
  const navigate = useNavigate()
  const { match, startSecondInnings } = useMatchStore()

  if (!match || !match.innings[0]) return <div className="p-6">No match data.</div>

  const firstInnings = match.innings[0]!
  const battingTeam = match.teams[firstInnings.battingTeamIndex]
  const bowlingTeamIndex: 0 | 1 = firstInnings.battingTeamIndex === 0 ? 1 : 0
  const target = firstInnings.totalRuns + 1
  const chasingTeam = match.teams[bowlingTeamIndex]

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🔁</div>
        <h1 className="text-2xl font-bold">Innings Break</h1>
        <p className="text-gray-400 mt-1">{battingTeam.name} innings complete</p>
      </div>

      {/* Score summary */}
      <div className="card mb-4 text-center">
        <p className="text-sm text-gray-400">{battingTeam.name}</p>
        <p className="text-5xl font-bold my-2">{scoreString(firstInnings)}</p>
        <p className="text-gray-400">{oversDisplay(firstInnings.totalLegalBalls)} overs</p>
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-yellow-400 font-bold text-xl">{chasingTeam.name} need {target} to win</p>
          <p className="text-gray-400 text-sm">in {match.maxOvers} overs</p>
        </div>
      </div>

      {/* Batting scorecard */}
      <div className="card mb-4">
        <h3 className="font-semibold text-sm text-gray-400 mb-3">Batting</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-gray-700">
              <th className="text-left pb-2">Batter</th>
              <th className="text-right pb-2">R</th>
              <th className="text-right pb-2">B</th>
              <th className="text-right pb-2">SR</th>
            </tr>
          </thead>
          <tbody>
            {sortedBatsmen(firstInnings).map((b) => (
              <tr key={b.playerId} className="border-b border-gray-700/50">
                <td className="py-2">
                  <p className="font-medium">{b.name}</p>
                  {b.isOut && <p className="text-xs text-gray-500">{b.wicketType}{b.bowledBy ? ` b. ${b.bowledBy}` : ''}</p>}
                  {!b.isOut && <p className="text-xs text-green-400">not out</p>}
                </td>
                <td className="text-right font-bold">{b.runs}</td>
                <td className="text-right text-gray-400">{b.balls}</td>
                <td className="text-right text-gray-400">{strikeRate(b.runs, b.balls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-2">
          Extras: {firstInnings.extras.wides}w · {firstInnings.extras.noBalls}nb · {firstInnings.extras.byes}b · {firstInnings.extras.legByes}lb
        </p>
      </div>

      {/* Bowling scorecard */}
      <div className="card mb-6">
        <h3 className="font-semibold text-sm text-gray-400 mb-3">Bowling</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-gray-700">
              <th className="text-left pb-2">Bowler</th>
              <th className="text-right pb-2">O</th>
              <th className="text-right pb-2">R</th>
              <th className="text-right pb-2">W</th>
              <th className="text-right pb-2">Eco</th>
            </tr>
          </thead>
          <tbody>
            {sortedBowlers(firstInnings).map((b) => (
              <tr key={b.playerId} className="border-b border-gray-700/50">
                <td className="py-2 font-medium">{b.name}</td>
                <td className="text-right text-gray-400">{Math.floor(b.legalBalls / 6)}.{b.legalBalls % 6}</td>
                <td className="text-right text-gray-400">{b.runsConceded}</td>
                <td className="text-right font-bold">{b.wickets}</td>
                <td className="text-right text-gray-400">{economyRate(b.runsConceded, b.legalBalls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="btn-primary" onClick={() => { startSecondInnings(); navigate('/scoring') }}>
        Start 2nd Innings →
      </button>
    </div>
  )
}
