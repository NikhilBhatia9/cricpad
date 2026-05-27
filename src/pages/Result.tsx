import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatchStore } from '../store/matchStore'
import { scoreString, oversDisplay, sortedBatsmen, sortedBowlers, strikeRate, economyRate } from '../utils/cricket'
import { computeMvp, mvpNarrative } from '../utils/mvp'
import { saveMatch } from '../db/operations'

export default function Result() {
  const navigate = useNavigate()
  const { match, resetMatch } = useMatchStore()

  useEffect(() => {
    if (match?.status === 'complete') saveMatch(match)
  }, [match])

  if (!match) return <div className="p-6">No match data. <button onClick={() => navigate('/')}>Go home</button></div>

  const i1 = match.innings[0]
  const i2 = match.innings[1]
  const mvp = computeMvp(match)

  return (
    <div className="px-4 py-6 max-w-lg mx-auto pb-10">
      {/* Result banner */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">&#x1F3C6;</div>
        <h1 className="text-2xl font-bold mb-2">Match Over</h1>
        {match.result && (
          <div className="bg-green-800 rounded-2xl px-4 py-3">
            <p className="text-xl font-bold text-green-200">{match.result}</p>
          </div>
        )}
      </div>

      {/* MVP Card */}
      {mvp && (
        <div className="relative mb-5 rounded-2xl overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 via-amber-600/10 to-orange-500/20 border border-yellow-500/30 rounded-2xl" />
          <div className="relative px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">&#x1F31F;</span>
              <span className="text-xs font-bold uppercase tracking-widest text-yellow-400">Player of the Match</span>
              <span className="ml-auto text-xs text-yellow-600 bg-yellow-900/40 px-2 py-0.5 rounded-full">AI Selected</span>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-yellow-900/40 border-2 border-yellow-500/40 flex items-center justify-center text-2xl">
                &#x1F9D1;&#x200D;&#x1F3CF;
              </div>
              <div>
                <p className="text-xl font-bold text-yellow-300">{mvp.name}</p>
                <p className="text-xs text-gray-400">{mvp.teamName}</p>
              </div>
              <div className="ml-auto text-center">
                <p className="text-2xl font-bold text-yellow-400">{mvp.totalPoints}</p>
                <p className="text-xs text-gray-500">pts</p>
              </div>
            </div>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-2 mb-3">
              {mvp.batDidBat && mvp.batRuns > 0 && (
                <span className="bg-green-900/50 border border-green-700/40 text-green-300 text-xs px-2.5 py-1 rounded-full font-semibold">
                  &#x1F3CF; {mvp.batRuns}{!mvp.batIsOut ? '*' : ''} ({mvp.batBalls}b)
                </span>
              )}
              {mvp.bowlDidBowl && mvp.bowlWickets > 0 && (
                <span className="bg-blue-900/50 border border-blue-700/40 text-blue-300 text-xs px-2.5 py-1 rounded-full font-semibold">
                  &#x1F3AF; {mvp.bowlWickets}/{mvp.bowlRunsConceded} ({Math.floor(mvp.bowlLegalBalls/6)}.{mvp.bowlLegalBalls%6}ov)
                </span>
              )}
              {mvp.batSixes > 0 && (
                <span className="bg-purple-900/50 border border-purple-700/40 text-purple-300 text-xs px-2.5 py-1 rounded-full font-semibold">
                  &#x1F4A5; {mvp.batSixes} six{mvp.batSixes > 1 ? 'es' : ''}
                </span>
              )}
              {mvp.bowlMaidens > 0 && (
                <span className="bg-teal-900/50 border border-teal-700/40 text-teal-300 text-xs px-2.5 py-1 rounded-full font-semibold">
                  &#x1F9CA; {mvp.bowlMaidens} maiden{mvp.bowlMaidens > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <p className="text-xs text-gray-400 italic leading-relaxed">{mvpNarrative(mvp)}</p>
          </div>
        </div>
      )}

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
              Extras: {inn.extras.wides}w &middot; {inn.extras.noBalls}nb &middot; {inn.extras.byes}b &middot; {inn.extras.legByes}lb
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
          &#x1F3CF; New Match
        </button>
      </div>
    </div>
  )
}
