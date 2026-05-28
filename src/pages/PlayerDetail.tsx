import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchPlayer, fetchPlayerStats, fetchMatchesByIds, computeCareerBatting, computeCareerBowling, computeCareerFielding } from '../db/operations'
import type { PlayerRecord, MatchRecord, PlayerMatchStat } from '../db/types'
import BackButton from '../components/BackButton'

interface Badge {
  emoji: string
  label: string
  description: string
}

function computeBadges(stats: PlayerMatchStat[], totalMatches: number): Badge[] {
  const badges: Badge[] = []
  const bat = stats.filter((s) => s.batDidBat)
  const bowl = stats.filter((s) => s.bowlDidBowl)
  const mvpWins = new Set(stats.filter((s) => s.isMvp).map((s) => s.matchId)).size
  const totalRuns = bat.reduce((s, r) => s + r.batRuns, 0)
  const totalWickets = bowl.reduce((s, r) => s + r.bowlWickets, 0)
  const totalSixes = bat.reduce((s, r) => s + r.batSixes, 0)
  const totalCatches = stats.reduce((s, r) => s + (r.fieldCatches ?? 0), 0)
  const totalMaidens = bowl.reduce((s, r) => s + (r.bowlMaidens ?? 0), 0)
  const has50 = bat.some((s) => s.batRuns >= 50 && s.batRuns < 100)
  const has100 = bat.some((s) => s.batRuns >= 100)
  const hasHatTrick = bowl.some((s) => s.bowlWickets >= 3)

  if (totalMatches >= 5)    badges.push({ emoji: '🦾', label: 'Ironman',       description: 'Played 5+ matches' })
  if (mvpWins >= 1)         badges.push({ emoji: '⭐', label: 'MVP',            description: 'Won Player of the Match' })
  if (mvpWins >= 3)         badges.push({ emoji: '🏆', label: 'MVP Legend',     description: 'Won 3+ MVP awards' })
  if (has50)                badges.push({ emoji: '🔥', label: '50 Club',        description: 'Scored 50+ in a match' })
  if (has100)               badges.push({ emoji: '💯', label: 'Century Club',   description: 'Scored 100+ in a match' })
  if (totalRuns >= 200)     badges.push({ emoji: '🏃', label: 'Run Machine',    description: '200+ career runs' })
  if (totalSixes >= 10)     badges.push({ emoji: '💥', label: 'Six Machine',    description: '10+ career sixes' })
  if (hasHatTrick)          badges.push({ emoji: '🎳', label: 'Hat-trick Hero', description: '3+ wickets in a match' })
  if (totalWickets >= 5)    badges.push({ emoji: '🎯', label: 'Wicket Hunter',  description: '5+ career wickets' })
  if (totalMaidens >= 2)    badges.push({ emoji: '🔇', label: 'Miser',          description: '2+ maiden overs' })
  if (totalCatches >= 3)    badges.push({ emoji: '🧤', label: 'Safe Hands',     description: '3+ catches' })

  return badges
}

export default function PlayerDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const playerName = decodeURIComponent(name ?? '')

  const [loading, setLoading] = useState(true)
  const [player, setPlayer] = useState<PlayerRecord | null | undefined>(undefined)
  const [stats, setStats] = useState<PlayerMatchStat[]>([])
  const [playerMatches, setPlayerMatches] = useState<MatchRecord[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchPlayer(playerName),
      fetchPlayerStats(playerName),
    ]).then(async ([p, s]) => {
      setPlayer(p)
      setStats(s)
      const ids = [...new Set(s.map((st) => st.matchId))]
      const matches = await fetchMatchesByIds(ids)
      setPlayerMatches(matches)
      setLoading(false)
    })
  }, [playerName])

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen px-6 py-12 items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="flex flex-col min-h-screen px-6 py-12 items-center justify-center gap-4">
        <p className="text-gray-400">Player not found.</p>
        <BackButton onClick={() => navigate('/players')} label="Players" />
      </div>
    )
  }

  const bat = computeCareerBatting(stats)
  const bowl = computeCareerBowling(stats)
  const field = computeCareerFielding(stats)
  const matchIds = [...new Set(stats.map((s) => s.matchId))]
  const badges = computeBadges(stats, matchIds.length)

  // Win / Loss / Tie per match
  const record = playerMatches.reduce(
    (acc, m) => {
      const playerStat = stats.find((s) => s.matchId === m.id)
      if (!playerStat || !m.result) return acc
      const r = m.result.toLowerCase()
      if (r.includes('tied') || r.includes('tie')) return { ...acc, ties: acc.ties + 1 }
      if (m.result.startsWith(playerStat.teamName)) return { ...acc, wins: acc.wins + 1 }
      return { ...acc, losses: acc.losses + 1 }
    },
    { wins: 0, losses: 0, ties: 0 }
  )

  return (
    <div className="px-4 py-6 max-w-lg mx-auto pb-10">
      <div className="flex items-center gap-3 mb-6">
        <BackButton onClick={() => navigate('/players')} label="Players" />
      </div>

      {/* Header */}
      <div className="card mb-4 text-center">
        <div className="text-5xl mb-2">&#x1F3CF;</div>
        <h1 className="text-2xl font-bold">{player.name}</h1>
        <p className="text-gray-400 text-sm mt-1">{matchIds.length} match{matchIds.length !== 1 ? 'es' : ''} played</p>

        {/* W / L / T record */}
        {matchIds.length > 0 && (
          <div className="flex justify-center gap-3 mt-3">
            <div className="bg-green-500/20 border border-green-500/40 rounded-xl px-4 py-2 min-w-[60px]">
              <p className="text-xs text-green-400 font-semibold">WON</p>
              <p className="text-2xl font-bold text-green-400">{record.wins}</p>
            </div>
            <div className="bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-2 min-w-[60px]">
              <p className="text-xs text-red-400 font-semibold">LOST</p>
              <p className="text-2xl font-bold text-red-400">{record.losses}</p>
            </div>
            {record.ties > 0 && (
              <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-xl px-4 py-2 min-w-[60px]">
                <p className="text-xs text-yellow-400 font-semibold">TIED</p>
                <p className="text-2xl font-bold text-yellow-400">{record.ties}</p>
              </div>
            )}
            <div className="bg-blue-500/20 border border-blue-500/40 rounded-xl px-4 py-2 min-w-[60px]">
              <p className="text-xs text-blue-400 font-semibold">WIN%</p>
              <p className="text-2xl font-bold text-blue-400">
                {matchIds.length > 0 ? Math.round((record.wins / matchIds.length) * 100) : 0}
              </p>
            </div>
          </div>
        )}

        {bat.mvpWins > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 px-4 py-1.5 rounded-full text-sm font-semibold">
            &#x1F3C6; MVP &times; {bat.mvpWins}
          </div>
        )}
      </div>

      {/* Batting */}
      {bat.innings > 0 && (
        <div className="card mb-4">
          <h2 className="font-semibold text-gray-300 mb-3">&#x1F3CF; Batting</h2>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <StatBox label="Matches" value={matchIds.length} />
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
          <div className="mt-2 pt-2 border-t border-gray-700 flex gap-4 text-sm text-gray-400 flex-wrap">
            <span>Not Outs: <strong className="text-white">{bat.notOuts}</strong></span>
            <span>4s: <strong className="text-white">{bat.fours}</strong></span>
            <span>6s: <strong className="text-white">{bat.sixes}</strong></span>
          </div>
        </div>
      )}

      {/* Bowling */}
      {bowl.legalBalls > 0 && (
        <div className="card mb-4">
          <h2 className="font-semibold text-gray-300 mb-3">&#x1F3AF; Bowling</h2>
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
        </div>
      )}

      {/* Fielding */}
      {field.total > 0 && (
        <div className="card mb-4">
          <h2 className="font-semibold text-gray-300 mb-3">&#x1F9E4; Fielding</h2>
          <div className="grid grid-cols-4 gap-2">
            <StatBox label="Total" value={field.total} highlight />
            <StatBox label="Catches" value={field.catches} />
            <StatBox label="Run Outs" value={field.runOuts} />
            <StatBox label="Stumpings" value={field.stumpings} />
          </div>
        </div>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <div className="card mb-4">
          <h2 className="font-semibold text-gray-300 mb-3">🎖️ Badges</h2>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <div
                key={b.label}
                className="group relative flex items-center gap-1.5 bg-gray-800 border border-gray-700 hover:border-yellow-500/50 rounded-full px-3 py-1.5 cursor-default transition-colors"
                title={b.description}
              >
                <span className="text-base">{b.emoji}</span>
                <span className="text-xs font-semibold text-gray-300">{b.label}</span>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-gray-900 border border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 whitespace-nowrap shadow-lg">
                    {b.description}
                  </div>
                </div>
              </div>
            ))}
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
              const isMvp = playerStat.some((s) => s.isMvp)
              return (
                <button
                  key={m.id}
                  className="w-full text-left bg-gray-800 rounded-lg p-3 hover:bg-gray-700/80 transition-colors"
                  onClick={() => navigate(`/history/${m.id}`)}
                >
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">
                      {m.teamAName} vs {m.teamBName}
                      {isMvp && <span className="ml-2 text-yellow-400 text-xs">&#x1F3C6; MVP</span>}
                    </p>
                    <p className="text-xs text-gray-500">{new Date(m.completedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    {batStat && <span>&#x1F3CF; {batStat.batRuns} ({batStat.batBalls}b){batStat.batIsOut ? '' : '*'}</span>}
                    {bowlStat && <span>&#x1F3AF; {bowlStat.bowlWickets}/{bowlStat.bowlRunsConceded} ({Math.floor(bowlStat.bowlLegalBalls / 6)}.{bowlStat.bowlLegalBalls % 6}ov)</span>}
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
