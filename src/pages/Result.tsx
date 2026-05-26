import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatchStore } from '../store/matchStore'
import { scoreString, oversDisplay, sortedBatsmen, sortedBowlers, strikeRate, economyRate } from '../utils/cricket'
import { saveMatch } from '../db/operations'

export default function Result() {
  const navigate = useNavigate()
  const { match, resetMatch } = useMatchStore()

  // Auto-save completed match to DB (idempotent — saveMatch checks for duplicates)
  useEffect(() => {
    if (match?.status === 'complete') saveMatch(match)
  }, [match])

  if (!match) return <div className="p-6">No match data. <button onClick={() => navigate('/')}>Go home</button></div>

  const i1 = match.innings[0]
  const i2 = match.innings[1]

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* Result banner */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">🏆</div>
        <h1 className="text-2xl font-bold mb-2">Match Over</h1>
        {match.result && (
          <div className="bg-green-800 rounded-2xl px-4 py-3">
            <p className="text-xl font-bold text-green-200">{match.result}</p>
          </div>
        )}
      </div>

      {/* Scorecards */}
      {[i1, i2].map((inn, innIdx) => {
        if (!inn) return null
        const battingTeam = match.teams[inn.battingTeamIndex]
        return (
          <div key={innIdx} className="card mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-lg">{battingTeam.name}</h2>
              <p className="text-2xl font-bold">{scoreString(inn)} <span className="text-base text-gray-400">({oversDisplay(inn.totalLegalBalls)} ov)</span></p>
            </div>

            <table className="w-full text-sm mb-3">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-700">
                  <th className="text-left pb-2">Batter</th>
                  <th className="text-right pb-2">R</th>
                  <th className="text-right pb-2">B</th>
                  <th className="text-right pb-2">4s</th>
                  <th className="text-right pb-2">6s</th>
                  <th className="text-right pb-2">SR</th>
                </tr>
              </thead>
              <tbody>
                {sortedBatsmen(inn).map((b) => (
                  <tr key={b.playerId} className="border-b border-gray-700/40">
                    <td className="py-1.5">
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-gray-500">{b.isOut ? b.wicketType : 'not out'}</p>
                    </td>
                    <td className="text-right font-bold">{b.runs}</td>
                    <td className="text-right text-gray-400">{b.balls}</td>
                    <td className="text-right text-gray-400">{b.fours}</td>
                    <td className="text-right text-gray-400">{b.sixes}</td>
                    <td className="text-right text-gray-400">{strikeRate(b.runs, b.balls)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mb-3">
              Extras: {inn.extras.wides}w · {inn.extras.noBalls}nb · {inn.extras.byes}b · {inn.extras.legByes}lb
            </p>

            <h3 className="text-sm text-gray-400 font-semibold mb-2">Bowling</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-700">
                  <th className="text-left pb-2">Bowler</th>
                  <th className="text-right pb-2">O</th>
                  <th className="text-right pb-2">M</th>
                  <th className="text-right pb-2">R</th>
                  <th className="text-right pb-2">W</th>
                  <th className="text-right pb-2">Eco</th>
                </tr>
              </thead>
              <tbody>
                {sortedBowlers(inn).map((b) => (
                  <tr key={b.playerId} className="border-b border-gray-700/40">
                    <td className="py-1.5 font-medium">{b.name}</td>
                    <td className="text-right text-gray-400">{Math.floor(b.legalBalls / 6)}.{b.legalBalls % 6}</td>
                    <td className="text-right text-gray-400">{b.maidens}</td>
                    <td className="text-right text-gray-400">{b.runsConceded}</td>
                    <td className="text-right font-bold">{b.wickets}</td>
                    <td className="text-right text-gray-400">{economyRate(b.runsConceded, b.legalBalls)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      <div className="flex gap-3 mt-2">
        <button className="btn-primary" onClick={() => { resetMatch(); navigate('/') }}>
          🏏 New Match
        </button>
      </div>
    </div>
  )
}
