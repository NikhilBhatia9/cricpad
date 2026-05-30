import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatchStore } from '../store/matchStore'
import { scoreString, oversDisplay, sortedBatsmen, sortedBowlers, strikeRate, economyRate, dismissalText } from '../utils/cricket'
import { computeMvp, mvpNarrative } from '../utils/mvp'
import { saveMatch } from '../db/operations'
import ScorecardImage from '../components/ScorecardImage'
import SocialCard from '../components/SocialCard'
import { captureAndShare } from '../utils/shareScorecard'
import { generateShareText } from '../utils/shareText'
import { ManhattanChart, ScoreWorm, FallOfWicketsTimeline } from '../components/MatchCharts'
import { getTournaments, upsertTournament } from '../utils/tournament'
import type { Match } from '../types/cricket'

/** Derive tournament result + NRR data from a completed match */
function deriveTournamentMatchResult(match: Match): {
  result: 'A' | 'B' | 'tie' | 'no_result'
  runsA?: number
  ballsFacedA?: number
  runsB?: number
  ballsFacedB?: number
} {
  const resultStr = (match.result ?? '').toLowerCase()
  const teamAName = match.teams[0].name.toLowerCase()
  const teamBName = match.teams[1].name.toLowerCase()

  let result: 'A' | 'B' | 'tie' | 'no_result' = 'no_result'
  if (resultStr.includes('tied') || resultStr === 'match tied!') {
    result = 'tie'
  } else if (resultStr.startsWith(teamAName)) {
    result = 'A'
  } else if (resultStr.startsWith(teamBName)) {
    result = 'B'
  }

  // Map innings to teams: innings[n].battingTeamIndex tells us which team batted
  const i1 = match.innings[0]
  const i2 = match.innings[1]
  const teamAInn = i1?.battingTeamIndex === 0 ? i1 : i2
  const teamBInn = i1?.battingTeamIndex === 1 ? i1 : i2

  return {
    result,
    runsA: teamAInn?.totalRuns,
    ballsFacedA: teamAInn?.totalLegalBalls,
    runsB: teamBInn?.totalRuns,
    ballsFacedB: teamBInn?.totalLegalBalls,
  }
}

export default function Result() {
  const navigate = useNavigate()
  const { match, resetMatch, startSuperOver, tournamentContext, setTournamentContext } = useMatchStore()
  const scorecardRef = useRef<HTMLDivElement>(null)
  const socialCardRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)
  const [graphTab, setGraphTab] = useState<'manhattan' | 'worm'>('manhattan')
  const [copyDone, setCopyDone] = useState(false)

  useEffect(() => {
    if (match?.status !== 'complete') return
    saveMatch(match)

    // If this match was started from a tournament, update that fixture automatically
    if (tournamentContext) {
      const { tournamentId, matchId } = tournamentContext
      const derived = deriveTournamentMatchResult(match)
      getTournaments().then((tournaments) => {
        const t = tournaments.find((t) => t.id === tournamentId)
        if (!t) return
        const updated = {
          ...t,
          updatedAt: new Date().toISOString(),
          matches: t.matches.map((m) => {
            if (m.id !== matchId) return m
            return {
              ...m,
              result: derived.result,
              runsA: derived.runsA,
              ballsFacedA: derived.ballsFacedA,
              runsB: derived.runsB,
              ballsFacedB: derived.ballsFacedB,
              playedAt: new Date().toISOString(),
            }
          }),
        }
        // For elimination, advance the winner
        if (updated.format === 'elimination') {
          import('../utils/tournament').then(({ advanceEliminationWinner }) => {
            const advanced = advanceEliminationWinner(updated, matchId)
            upsertTournament(advanced).catch(console.error)
          })
        } else {
          upsertTournament(updated).catch(console.error)
        }
        setTournamentContext(null)
      }).catch(console.error)
    }
  }, [match?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!match) return <div className="p-6">No match data. <button onClick={() => navigate('/')}>Go home</button></div>

  const i1 = match.innings[0]
  const i2 = match.innings[1]
  const mvp = computeMvp(match)
  const isTied = match.result?.toLowerCase().includes('tied') || match.result?.toLowerCase().includes('tie')

  function handleSuperOver() {
    startSuperOver()
    navigate('/toss')
  }

  async function handleShare() {
    if (!scorecardRef.current) return
    setSharing(true)
    try {
      const title = `${match!.teams[0].name} vs ${match!.teams[1].name} \u2014 ${match!.result ?? 'Scorecard'}`
      await captureAndShare(scorecardRef.current, title, 'scorecard.png')
    } catch (e) {
      console.error('Share failed', e)
    } finally {
      setSharing(false)
    }
  }

  async function handleSocialCardShare() {
    if (!socialCardRef.current) return
    setSharing(true)
    try {
      const title = `${match!.teams[0].name} vs ${match!.teams[1].name} — ${match!.result ?? 'Match Summary'}`
      await captureAndShare(socialCardRef.current, title, 'social-card.png')
    } catch (e) {
      console.error('Share failed', e)
    } finally {
      setSharing(false)
    }
  }

  async function handleTextShare() {
    const text = generateShareText(match!)
    try {
      if (navigator.share) {
        await navigator.share({ text, title: `${match!.teams[0].name} vs ${match!.teams[1].name}` })
        return
      }
    } catch {
      // cancelled or unsupported — fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2500)
    } catch {
      // clipboard also unavailable — silently ignore
    }
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto pb-10">
      {/* Result banner */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">{match.isSuperOver ? '⚡' : '🏆'}</div>
        <h1 className="text-2xl font-bold mb-2">{match.isSuperOver ? 'Super Over Result' : 'Match Over'}</h1>
        {match.isSuperOver && match.completedResult && (
          <p className="text-sm text-gray-400 mb-2">Main match: <span className="text-yellow-400 font-semibold">{match.completedResult}</span></p>
        )}
        {match.result && (
          <div className="bg-green-800 rounded-2xl px-4 py-3">
            <p className="text-xl font-bold text-green-200">{match.result}</p>
          </div>
        )}
      </div>

      {/* MVP Card */}
      {mvp && (
        <div className="relative mb-5 rounded-2xl overflow-hidden">
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

      {/* Graph — tab toggle between Manhattan and Score Worm */}
      <div className="mb-4">
        <div className="flex gap-1 bg-gray-800 rounded-xl p-1 mb-0">
          <button
            onClick={() => setGraphTab('manhattan')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${graphTab === 'manhattan' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
          >
            📊 Manhattan
          </button>
          <button
            onClick={() => setGraphTab('worm')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${graphTab === 'worm' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
          >
            🐛 Score Worm
          </button>
        </div>
        {graphTab === 'manhattan' ? (
          <ManhattanChart
            inn1={i1}
            inn2={i2}
            team1={match.teams[i1?.battingTeamIndex ?? 0].name}
            team2={match.teams[i2?.battingTeamIndex ?? 1].name}
          />
        ) : (
          <ScoreWorm
            inn1={i1}
            inn2={i2}
            team1={match.teams[i1?.battingTeamIndex ?? 0].name}
            team2={match.teams[i2?.battingTeamIndex ?? 1].name}
            maxOvers={match.maxOvers}
          />
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
                      <p className="text-xs text-gray-500">{dismissalText(b)}</p>
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
            {inn.fallOfWickets !== undefined && (
              <FallOfWicketsTimeline inn={inn} />
            )}
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

      <div className="flex gap-3 mt-2 flex-wrap">
        {isTied && !match.isSuperOver && (
          <button
            className="flex-1 bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-700 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors"
            onClick={handleSuperOver}
          >
            ⚡ Super Over
          </button>
        )}
        <button
          className="flex-1 bg-green-700 hover:bg-green-600 active:bg-green-800 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors"
          onClick={handleTextShare}
        >
          {copyDone ? '✅ Copied!' : '💬 Share Text'}
        </button>
        <button
          className="flex-1 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors"
          onClick={handleSocialCardShare}
          disabled={sharing}
        >
          {sharing ? (
            <span className="animate-spin text-lg">&#x21BB;</span>
          ) : (
            <span>📸</span>
          )}
          {sharing ? 'Generating...' : 'Social Card'}
        </button>
        <button
          className="flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors"
          onClick={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <span className="animate-spin text-lg">&#x21BB;</span>
          ) : (
            <span>🧾</span>
          )}
          {sharing ? 'Generating...' : 'Scorecard'}
        </button>
        <button className="w-full btn-primary" onClick={() => { resetMatch(); navigate('/') }}>
          🏠 Homepage
        </button>
      </div>

      {/* Hidden scorecard for image capture */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        <ScorecardImage ref={scorecardRef} match={match} completedAt={new Date().toISOString()} />
      </div>
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        <SocialCard ref={socialCardRef} match={match} completedAt={new Date().toISOString()} />
      </div>
    </div>
  )
}
