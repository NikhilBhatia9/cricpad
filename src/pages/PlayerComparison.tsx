import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  fetchPlayerStats,
  fetchMatchResultsMap,
  fetchMatchSnapshotsByIds,
  computeCareerBatting,
  computeCareerBowling,
  computeCareerFielding,
} from '../db/operations'
import type { PlayerMatchStat } from '../db/types'
import type { Match } from '../types/cricket'
import BackButton from '../components/BackButton'

interface BallH2H { runs: number; balls: number; dismissals: number }

function computeBallH2H(
  playerAName: string,
  playerBName: string,
  snaps: Record<string, Match>
): { aBatVsB: BallH2H; bBatVsA: BallH2H } {
  const aBatVsB: BallH2H = { runs: 0, balls: 0, dismissals: 0 }
  const bBatVsA: BallH2H = { runs: 0, balls: 0, dismissals: 0 }
  for (const match of Object.values(snaps)) {
    for (const innings of match.innings) {
      if (!innings) continue
      const aId = Object.entries(innings.batsmen).find(([, v]) => v.name === playerAName)?.[0]
      const bId = Object.entries(innings.batsmen).find(([, v]) => v.name === playerBName)?.[0]
      const aBowlId = Object.entries(innings.bowlers).find(([, v]) => v.name === playerAName)?.[0]
      const bBowlId = Object.entries(innings.bowlers).find(([, v]) => v.name === playerBName)?.[0]

      for (const over of innings.overs) {
        for (const ball of over.balls) {
          // A batting, B bowling
          if (aId && bBowlId && ball.strikerId === aId && ball.bowlerId === bBowlId) {
            aBatVsB.runs += ball.runsOffBat
            if (ball.isLegal) aBatVsB.balls += 1
            if (ball.isWicket && !ball.runOutNonStriker) aBatVsB.dismissals += 1
          }
          // B batting, A bowling
          if (bId && aBowlId && ball.strikerId === bId && ball.bowlerId === aBowlId) {
            bBatVsA.runs += ball.runsOffBat
            if (ball.isLegal) bBatVsA.balls += 1
            if (ball.isWicket && !ball.runOutNonStriker) bBatVsA.dismissals += 1
          }
        }
      }
    }
  }
  return { aBatVsB, bBatVsA }
}

function avg(runs: number, dismissals: number): string {
  if (dismissals === 0) return runs > 0 ? '∞' : '-'
  return (runs / dismissals).toFixed(1)
}

function sr(runs: number, balls: number): string {
  if (balls === 0) return '-'
  return ((runs / balls) * 100).toFixed(1)
}

// Simple stat row for side-by-side table
function Row({
  label, a, b, highlightA, highlightB,
}: {
  label: string
  a: string | number
  b: string | number
  highlightA?: boolean
  highlightB?: boolean
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5 border-b border-gray-700/40 last:border-0">
      <p className={`text-right text-base font-bold ${highlightA ? 'text-green-400' : 'text-white'}`}>{a}</p>
      <p className="text-center text-xs text-gray-500 min-w-[80px]">{label}</p>
      <p className={`text-left text-base font-bold ${highlightB ? 'text-green-400' : 'text-white'}`}>{b}</p>
    </div>
  )
}

export default function PlayerComparison() {
  const { nameA, nameB } = useParams<{ nameA: string; nameB: string }>()
  const navigate = useNavigate()
  const pA = decodeURIComponent(nameA ?? '')
  const pB = decodeURIComponent(nameB ?? '')

  const [statsA, setStatsA] = useState<PlayerMatchStat[]>([])
  const [statsB, setStatsB] = useState<PlayerMatchStat[]>([])
  const [matchResults, setMatchResults] = useState<Record<string, string>>({})
  const [snapshots, setSnapshots] = useState<Record<string, Match>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [sA, sB] = await Promise.all([fetchPlayerStats(pA), fetchPlayerStats(pB)])
      setStatsA(sA)
      setStatsB(sB)
      const allIds = [...new Set([...sA, ...sB].map((s) => s.matchId))]
      const results = await fetchMatchResultsMap(allIds)
      setMatchResults(results)
      // H2H match IDs (both players in same match on different teams)
      const h2hIds = sA
        .filter((a) => sB.some((b) => b.matchId === a.matchId && b.teamName !== a.teamName))
        .map((a) => a.matchId)
        .filter((id, i, arr) => arr.indexOf(id) === i)
      const snaps = await fetchMatchSnapshotsByIds(h2hIds)
      setSnapshots(snaps)
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [pA, pB])

  const batA = useMemo(() => computeCareerBatting(statsA), [statsA])
  const batB = useMemo(() => computeCareerBatting(statsB), [statsB])
  const bowlA = useMemo(() => computeCareerBowling(statsA), [statsA])
  const bowlB = useMemo(() => computeCareerBowling(statsB), [statsB])
  const fieldA = useMemo(() => computeCareerFielding(statsA), [statsA])
  const fieldB = useMemo(() => computeCareerFielding(statsB), [statsB])

  // Head to head stats
  const h2hMatchIds = useMemo(() =>
    statsA
      .filter((a) => statsB.some((b) => b.matchId === a.matchId && b.teamName !== a.teamName))
      .map((a) => a.matchId)
      .filter((id, i, arr) => arr.indexOf(id) === i),
    [statsA, statsB]
  )

  const h2h = useMemo(() => {
    let winsA = 0, winsB = 0, ties = 0
    for (const matchId of h2hMatchIds) {
      const result = matchResults[matchId]
      if (!result) continue
      const statA = statsA.find((s) => s.matchId === matchId)
      if (!statA) continue
      const r = result.toLowerCase()
      if (r.includes('tied') || r.includes('tie')) ties++
      else if (result.startsWith(statA.teamName)) winsA++
      else winsB++
    }
    // Batting in H2H matches
    const h2hBatA = statsA.filter((s) => h2hMatchIds.includes(s.matchId) && s.batDidBat)
    const h2hBatB = statsB.filter((s) => h2hMatchIds.includes(s.matchId) && s.batDidBat)
    const runsA = h2hBatA.reduce((s, r) => s + r.batRuns, 0)
    const runsB = h2hBatB.reduce((s, r) => s + r.batRuns, 0)
    const disA = h2hBatA.filter((s) => s.batIsOut).length
    const disB = h2hBatB.filter((s) => s.batIsOut).length
    return { winsA, winsB, ties, runsA, runsB, disA, disB }
  }, [h2hMatchIds, matchResults, statsA, statsB])

  const { aBatVsB, bBatVsA } = useMemo(
    () => computeBallH2H(pA, pB, snapshots),
    [pA, pB, snapshots]
  )

  const hasBatA = batA.innings > 0
  const hasBatB = batB.innings > 0
  const hasBowlA = bowlA.legalBalls > 0
  const hasBowlB = bowlB.legalBalls > 0
  const hasH2H = h2hMatchIds.length > 0
  const hasBallH2H = aBatVsB.balls > 0 || bBatVsA.balls > 0

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Loading comparison…</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <BackButton onClick={() => navigate('/players')} label="Players" />
      </div>

      {/* Player names banner */}
      <div className="card mb-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button
            className="text-center hover:opacity-80 transition-opacity"
            onClick={() => navigate(`/players/${encodeURIComponent(pA)}`)}
          >
            <div className="text-3xl mb-1">🏏</div>
            <p className="font-bold text-lg leading-tight">{pA}</p>
            <p className="text-xs text-gray-500">{batA.matches} matches</p>
          </button>
          <div className="text-gray-500 font-bold text-sm px-2">VS</div>
          <button
            className="text-center hover:opacity-80 transition-opacity"
            onClick={() => navigate(`/players/${encodeURIComponent(pB)}`)}
          >
            <div className="text-3xl mb-1">🏏</div>
            <p className="font-bold text-lg leading-tight">{pB}</p>
            <p className="text-xs text-gray-500">{batB.matches} matches</p>
          </button>
        </div>
      </div>

      {/* Head to Head */}
      {hasH2H && (
        <div className="card mb-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 text-center uppercase tracking-wide">⚔️ Head to Head ({h2hMatchIds.length} match{h2hMatchIds.length !== 1 ? 'es' : ''})</h2>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-green-500/20 border border-green-500/30 rounded-xl py-3 text-center">
              <p className="text-2xl font-bold text-green-400">{h2h.winsA}</p>
              <p className="text-xs text-gray-400 mt-0.5">Wins</p>
            </div>
            <div className="bg-gray-700 rounded-xl py-3 text-center">
              <p className="text-2xl font-bold text-yellow-400">{h2h.ties}</p>
              <p className="text-xs text-gray-400 mt-0.5">Tied</p>
            </div>
            <div className="bg-green-500/20 border border-green-500/30 rounded-xl py-3 text-center">
              <p className="text-2xl font-bold text-green-400">{h2h.winsB}</p>
              <p className="text-xs text-gray-400 mt-0.5">Wins</p>
            </div>
          </div>
          {/* H2H batting averages */}
          <div className="pt-2 border-t border-gray-700">
            <p className="text-xs text-gray-500 text-center mb-2">Batting in H2H matches</p>
            <Row
              label="Runs"
              a={h2h.runsA}
              b={h2h.runsB}
              highlightA={h2h.runsA > h2h.runsB}
              highlightB={h2h.runsB > h2h.runsA}
            />
            <Row
              label="Average"
              a={avg(h2h.runsA, h2h.disA)}
              b={avg(h2h.runsB, h2h.disB)}
              highlightA={h2h.disA > 0 && (h2h.disB === 0 || h2h.runsA / h2h.disA >= h2h.runsB / h2h.disB)}
              highlightB={h2h.disB > 0 && (h2h.disA === 0 || h2h.runsB / h2h.disB > h2h.runsA / h2h.disA)}
            />
          </div>
        </div>
      )}

      {/* Ball-by-ball H2H */}
      {hasBallH2H && (
        <div className="card mb-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 text-center uppercase tracking-wide">🎯 Batter vs Bowler</h2>
          {aBatVsB.balls > 0 && (
            <div className="bg-gray-900/60 rounded-xl p-3 mb-2">
              <p className="text-xs text-gray-400 mb-2">
                <span className="font-semibold text-white">{pA}</span> batting vs <span className="font-semibold text-white">{pB}</span> bowling
              </p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-green-400">{aBatVsB.runs}</p>
                  <p className="text-xs text-gray-500">Runs</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{aBatVsB.balls}</p>
                  <p className="text-xs text-gray-500">Balls</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-400">{aBatVsB.dismissals}</p>
                  <p className="text-xs text-gray-500">Out</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-yellow-300">{avg(aBatVsB.runs, aBatVsB.dismissals)}</p>
                  <p className="text-xs text-gray-500">Avg</p>
                </div>
              </div>
              {aBatVsB.balls > 0 && (
                <p className="text-xs text-gray-500 mt-1 text-center">S/R {sr(aBatVsB.runs, aBatVsB.balls)}</p>
              )}
            </div>
          )}
          {bBatVsA.balls > 0 && (
            <div className="bg-gray-900/60 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-2">
                <span className="font-semibold text-white">{pB}</span> batting vs <span className="font-semibold text-white">{pA}</span> bowling
              </p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-green-400">{bBatVsA.runs}</p>
                  <p className="text-xs text-gray-500">Runs</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{bBatVsA.balls}</p>
                  <p className="text-xs text-gray-500">Balls</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-400">{bBatVsA.dismissals}</p>
                  <p className="text-xs text-gray-500">Out</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-yellow-300">{avg(bBatVsA.runs, bBatVsA.dismissals)}</p>
                  <p className="text-xs text-gray-500">Avg</p>
                </div>
              </div>
              {bBatVsA.balls > 0 && (
                <p className="text-xs text-gray-500 mt-1 text-center">S/R {sr(bBatVsA.runs, bBatVsA.balls)}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Batting comparison */}
      {(hasBatA || hasBatB) && (
        <div className="card mb-4">
          <div className="grid grid-cols-[1fr_auto_1fr] mb-3">
            <p className="text-right text-xs font-bold text-gray-300 truncate pr-2">{pA}</p>
            <p className="text-center text-xs font-semibold text-green-400 uppercase tracking-wide min-w-[80px]">🏏 Batting</p>
            <p className="text-left text-xs font-bold text-gray-300 truncate pl-2">{pB}</p>
          </div>
          <Row label="Matches" a={batA.matches} b={batB.matches} highlightA={batA.matches > batB.matches} highlightB={batB.matches > batA.matches} />
          <Row label="Innings" a={batA.innings} b={batB.innings} />
          <Row label="Runs" a={batA.totalRuns} b={batB.totalRuns} highlightA={batA.totalRuns > batB.totalRuns} highlightB={batB.totalRuns > batA.totalRuns} />
          <Row label="Average" a={batA.average} b={batB.average} />
          <Row label="Strike Rate" a={batA.strikeRate} b={batB.strikeRate} />
          <Row label="Highest" a={batA.highestScore} b={batB.highestScore} highlightA={batA.highestScore > batB.highestScore} highlightB={batB.highestScore > batA.highestScore} />
          <Row label="50s" a={batA.fifties} b={batB.fifties} highlightA={batA.fifties > batB.fifties} highlightB={batB.fifties > batA.fifties} />
          <Row label="Sixes" a={batA.sixes} b={batB.sixes} highlightA={batA.sixes > batB.sixes} highlightB={batB.sixes > batA.sixes} />
          <Row label="Not Outs" a={batA.notOuts} b={batB.notOuts} />
          {(batA.mvpWins > 0 || batB.mvpWins > 0) && (
            <Row label="MVP Wins" a={batA.mvpWins} b={batB.mvpWins} highlightA={batA.mvpWins > batB.mvpWins} highlightB={batB.mvpWins > batA.mvpWins} />
          )}
        </div>
      )}

      {/* Bowling comparison */}
      {(hasBowlA || hasBowlB) && (
        <div className="card mb-4">
          <div className="grid grid-cols-[1fr_auto_1fr] mb-3">
            <p className="text-right text-xs font-bold text-gray-300 truncate pr-2">{pA}</p>
            <p className="text-center text-xs font-semibold text-blue-400 uppercase tracking-wide min-w-[80px]">🎯 Bowling</p>
            <p className="text-left text-xs font-bold text-gray-300 truncate pl-2">{pB}</p>
          </div>
          <Row label="Wickets" a={bowlA.wickets} b={bowlB.wickets} highlightA={bowlA.wickets > bowlB.wickets} highlightB={bowlB.wickets > bowlA.wickets} />
          <Row label="Overs" a={`${Math.floor(bowlA.legalBalls/6)}.${bowlA.legalBalls%6}`} b={`${Math.floor(bowlB.legalBalls/6)}.${bowlB.legalBalls%6}`} />
          <Row label="Runs" a={bowlA.runsConceded} b={bowlB.runsConceded} />
          <Row label="Economy" a={bowlA.economy} b={bowlB.economy} />
          <Row label="Average" a={bowlA.average} b={bowlB.average} />
          <Row label="Maidens" a={bowlA.maidens} b={bowlB.maidens} highlightA={bowlA.maidens > bowlB.maidens} highlightB={bowlB.maidens > bowlA.maidens} />
          <Row label="Best" a={`${bowlA.bestWickets}/${bowlA.bestRuns}`} b={`${bowlB.bestWickets}/${bowlB.bestRuns}`} />
        </div>
      )}

      {/* Fielding comparison */}
      {(fieldA.total > 0 || fieldB.total > 0) && (
        <div className="card mb-4">
          <div className="grid grid-cols-[1fr_auto_1fr] mb-3">
            <p className="text-right text-xs font-bold text-gray-300 truncate pr-2">{pA}</p>
            <p className="text-center text-xs font-semibold text-purple-400 uppercase tracking-wide min-w-[80px]">🧤 Fielding</p>
            <p className="text-left text-xs font-bold text-gray-300 truncate pl-2">{pB}</p>
          </div>
          <Row label="Total" a={fieldA.total} b={fieldB.total} highlightA={fieldA.total > fieldB.total} highlightB={fieldB.total > fieldA.total} />
          <Row label="Catches" a={fieldA.catches} b={fieldB.catches} highlightA={fieldA.catches > fieldB.catches} highlightB={fieldB.catches > fieldA.catches} />
          <Row label="Run Outs" a={fieldA.runOuts} b={fieldB.runOuts} highlightA={fieldA.runOuts > fieldB.runOuts} highlightB={fieldB.runOuts > fieldA.runOuts} />
          <Row label="Stumpings" a={fieldA.stumpings} b={fieldB.stumpings} highlightA={fieldA.stumpings > fieldB.stumpings} highlightB={fieldB.stumpings > fieldA.stumpings} />
        </div>
      )}
    </div>
  )
}
