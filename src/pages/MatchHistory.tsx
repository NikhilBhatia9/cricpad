import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchAllMatches, fetchMatch } from '../db/operations'
import type { MatchRecord } from '../db/types'
import type { Match } from '../types/cricket'
import { scoreString, oversDisplay, dismissalText, sortedBatsmen, sortedBowlers, strikeRate, economyRate } from '../utils/cricket'
import BackButton from '../components/BackButton'
import { computeMvp, mvpNarrative } from '../utils/mvp'
import ScorecardImage from '../components/ScorecardImage'
import SocialCard from '../components/SocialCard'
import { captureAndShare } from '../utils/shareScorecard'
import { ManhattanChart, ScoreWorm, FallOfWicketsTimeline } from '../components/MatchCharts'

type HistoryPeriod = 'all' | 'year' | 'month' | 'week' | 'today'

const PERIOD_LABELS: { key: HistoryPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'Week' },
  { key: 'month', label: 'This month' },
  { key: 'year',  label: 'Year' },
  { key: 'all',   label: 'All' },
]

function getPeriodCutoff(period: HistoryPeriod): Date | null {
  const now = new Date()
  if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 7); return d }
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'year')  return new Date(now.getFullYear(), 0, 1)
  return null
}

export default function MatchHistory() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()

  const [matches, setMatches] = useState<MatchRecord[] | null>(null)
  const [period, setPeriod] = useState<HistoryPeriod>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!id) {
      fetchAllMatches().then(setMatches)
    }
  }, [id])

  // Parse snapshots once to extract innings scores for list cards
  const parsedScores = useMemo(() => {
    if (!matches) return {} as Record<string, { inn1: string; inn2: string | null }>
    const map: Record<string, { inn1: string; inn2: string | null }> = {}
    for (const m of matches) {
      try {
        const match: Match = JSON.parse(m.snapshot)
        const i1 = match.innings[0]
        const i2 = match.innings[1]
        map[m.id] = {
          inn1: i1 ? `${match.teams[i1.battingTeamIndex].name} ${scoreString(i1)}` : '',
          inn2: i2 ? `${match.teams[i2.battingTeamIndex].name} ${scoreString(i2)}` : null,
        }
      } catch { /* ignore malformed */ }
    }
    return map
  }, [matches])

  const filteredMatches = useMemo(() => {
    if (!matches) return []
    const cutoff = getPeriodCutoff(period)
    let list = cutoff ? matches.filter((m) => new Date(m.completedAt) >= cutoff) : matches
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((m) =>
        m.teamAName.toLowerCase().includes(q) || m.teamBName.toLowerCase().includes(q)
      )
    }
    return list
  }, [matches, period, searchQuery])

  // Group by "Month Year" label
  const groupedMatches = useMemo(() => {
    const groups: { label: string; items: MatchRecord[] }[] = []
    const map: Record<string, MatchRecord[]> = {}
    for (const m of filteredMatches) {
      const key = new Date(m.completedAt).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
      if (!map[key]) {
        map[key] = []
        groups.push({ label: key, items: map[key] })
      }
      map[key].push(m)
    }
    return groups
  }, [filteredMatches])

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
          <div className="text-5xl">&#x1F4CB;</div>
          <p className="text-gray-400">No matches recorded yet.<br />Complete a match to see it here.</p>
          <button className="btn-primary" onClick={() => navigate('/setup')}>Start a Match</button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <BackButton onClick={() => navigate('/')} />
        <h1 className="text-xl font-bold">Match History</h1>
        <span className="ml-auto text-gray-500 text-sm">{filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''}</span>
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="Search by team name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-9 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm border border-transparent focus:border-green-500 focus:outline-none placeholder-gray-400"
        />
        {searchQuery && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
            onClick={() => setSearchQuery('')}
          >×</button>
        )}
      </div>

      {/* Period filter */}
      <div className="flex gap-1 mb-5">
        {PERIOD_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              period === key ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredMatches.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-400">{searchQuery ? 'No matches found.' : 'No matches in this period.'}</p>
          {(period !== 'all' || searchQuery) && (
            <button className="mt-3 text-sm text-green-400 hover:text-green-300" onClick={() => { setPeriod('all'); setSearchQuery('') }}>
              View all matches →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedMatches.map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 px-1">{label}</p>
              <div className="space-y-2">
                {items.map((m) => {
                  const scores = parsedScores[m.id]
                  const result = m.result ?? ''
                  return (
                    <button
                      key={m.id}
                      className="card w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors active:scale-[0.99]"
                      onClick={() => navigate(`/history/${m.id}`)}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{m.teamAName} vs {m.teamBName}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {m.maxOvers} overs &middot; {new Date(m.completedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <span className="text-gray-500 text-lg shrink-0">›</span>
                      </div>
                      {scores && (
                        <div className="mt-2 space-y-0.5">
                          <p className="text-xs text-gray-300 font-medium">{scores.inn1}</p>
                          {scores.inn2 && <p className="text-xs text-gray-400">{scores.inn2}</p>}
                        </div>
                      )}
                      {result && (
                        <p className="text-xs text-green-400 mt-1.5 font-medium">{result}</p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MatchDetail({ matchId, onBack }: { matchId: string; onBack: () => void }) {
  const navigate = useNavigate()
  const [matchRecord, setMatchRecord] = useState<MatchRecord | null | undefined>(undefined)
  const scorecardRef = useRef<HTMLDivElement>(null)
  const socialCardRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)
  const [sharingCard, setSharingCard] = useState(false)
  const [graphTab, setGraphTab] = useState<'manhattan' | 'worm'>('manhattan')

  useEffect(() => {
    fetchMatch(matchId).then(setMatchRecord)
  }, [matchId])

  async function handleShare(match: Match) {
    if (!scorecardRef.current) return
    setSharing(true)
    try {
      const title = `${match.teams[0].name} vs ${match.teams[1].name} \u2014 ${match.result ?? 'Scorecard'}`
      await captureAndShare(scorecardRef.current, title, 'scorecard.png')
    } catch (e) {
      console.error('Share failed', e)
    } finally {
      setSharing(false)
    }
  }

  async function handleSocialCardShare(match: Match) {
    if (!socialCardRef.current) return
    setSharingCard(true)
    try {
      const title = `${match.teams[0].name} vs ${match.teams[1].name} — ${match.result ?? 'Match Summary'}`
      await captureAndShare(socialCardRef.current, title, 'social-card.png')
    } catch (e) {
      console.error('Share failed', e)
    } finally {
      setSharingCard(false)
    }
  }

  if (matchRecord === undefined) {
    return <div className="flex flex-col min-h-screen px-6 py-12 items-center justify-center"><div className="text-gray-400">Loading...</div></div>
  }

  if (!matchRecord) {
    return <div className="flex flex-col min-h-screen px-6 py-12 items-center justify-center"><div className="text-gray-400">Match not found.</div></div>
  }

  const match: Match = JSON.parse(matchRecord.snapshot)
  const i1 = match.innings[0]
  const i2 = match.innings[1]
  const mvp = computeMvp(match)

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

      {/* MVP Card */}
      {mvp && (
        <div className="mb-4 rounded-2xl p-4 border border-yellow-500/40" style={{ background: 'linear-gradient(135deg, #78350f33 0%, #92400e33 50%, #78350f33 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="text-3xl">&#x1F3C6;</div>
            <div className="flex-1">
              <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wide">Player of the Match</p>
              <button
                className="text-lg font-bold text-yellow-300 hover:text-yellow-200"
                onClick={() => navigate(`/players/${encodeURIComponent(mvp.name)}`)}
              >
                {mvp.name}
              </button>
              <p className="text-xs text-yellow-500/80">{mvp.teamName}</p>
            </div>
            <div className="text-right text-xs text-yellow-400/80 space-y-0.5">
              {mvp.batDidBat && <p>&#x1F3CF; {mvp.batRuns} ({mvp.batBalls}b)</p>}
              {mvp.bowlDidBowl && <p>&#x1F3AF; {mvp.bowlWickets}w/{mvp.bowlRunsConceded}</p>}
            </div>
          </div>
          <p className="text-xs text-yellow-500/70 mt-2 italic">{mvpNarrative(mvp)}</p>
        </div>
      )}

      {/* Charts — tab toggle */}
      {(i1 || i2) && (
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
      )}

      {/* Share buttons */}
      <div className="flex gap-2 mb-4">
        <button
          className="flex-1 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors"
          onClick={() => handleSocialCardShare(match)}
          disabled={sharingCard}
        >
          {sharingCard ? <span className="animate-spin">&#x21BB;</span> : <span>📸</span>}
          {sharingCard ? 'Generating...' : 'Social Card'}
        </button>
        <button
          className="flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors"
          onClick={() => handleShare(match)}
          disabled={sharing}
        >
          {sharing ? <span className="animate-spin">&#x21BB;</span> : <span>🧾</span>}
          {sharing ? 'Generating...' : 'Scorecard'}
        </button>
      </div>

      {[i1, i2].map((inn, innIdx) => {
        if (!inn) return null
        const battingTeam = match.teams[inn.battingTeamIndex]
        const fieldingTeamIndex: 0 | 1 = inn.battingTeamIndex === 0 ? 1 : 0
        const fieldingTeam = match.teams[fieldingTeamIndex]
        const batsmen = sortedBatsmen(inn)
        const bowlers = sortedBowlers(inn)

        // Fielders with contributions (catches / run-outs / stumpings)
        const fielders = Object.values(inn.fielders ?? {}).filter(
          (f) => f.catches > 0 || f.runOuts > 0 || f.stumpings > 0
        )

        const extras = inn.extras
        const totalExtras = extras.wides + extras.noBalls + extras.byes + extras.legByes

        return (
          <div key={innIdx} className="card mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-lg">{battingTeam.name}</h2>
              <p className="text-xl font-bold">{scoreString(inn)} <span className="text-sm text-gray-400">({oversDisplay(inn.totalLegalBalls)} ov)</span></p>
            </div>

            <table className="w-full text-sm mb-2">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-200 dark:border-gray-700">
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
                  <tr key={b.playerId} className="border-b border-gray-100 dark:border-gray-700/40">
                    <td className="py-1.5">
                      <button className="font-medium text-left hover:text-green-400" onClick={() => navigate(`/players/${encodeURIComponent(b.name)}`)}>{b.name}</button>
                      <p className="text-xs text-gray-500">{dismissalText(b)}</p>
                    </td>
                    <td className="text-right font-bold">{b.runs}</td>
                    <td className="text-right text-gray-400">{b.balls}</td>
                    <td className="text-right text-gray-400">{b.fours}</td>
                    <td className="text-right text-gray-400">{b.sixes}</td>
                    <td className="text-right text-gray-400">{strikeRate(b.runs, b.balls)}</td>
                  </tr>
                ))}
                {/* Extras row */}
                <tr className="border-b border-gray-100 dark:border-gray-700/40">
                  <td className="py-1.5 text-gray-500 text-xs" colSpan={3}>
                    Extras <span className="text-gray-400">{extras.wides}w · {extras.noBalls}nb · {extras.byes}b · {extras.legByes}lb</span>
                  </td>
                  <td className="text-right font-bold text-gray-400" colSpan={3}>{totalExtras}</td>
                </tr>
              </tbody>
            </table>

            {/* Fall of Wickets */}
            {inn.fallOfWickets !== undefined && (
              <div className="mb-3">
                <FallOfWicketsTimeline inn={inn} />
              </div>
            )}

            <h3 className="text-xs text-gray-500 font-semibold mb-2 mt-3">BOWLING — {fieldingTeam.name}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left pb-1.5">Bowler</th>
                  <th className="text-right pb-1.5">O</th>
                  <th className="text-right pb-1.5">M</th>
                  <th className="text-right pb-1.5">R</th>
                  <th className="text-right pb-1.5">W</th>
                  <th className="text-right pb-1.5">Eco</th>
                </tr>
              </thead>
              <tbody>
                {bowlers.map((b) => (
                  <tr key={b.playerId} className="border-b border-gray-100 dark:border-gray-700/40">
                    <td className="py-1.5">
                      <button className="font-medium text-left hover:text-green-400" onClick={() => navigate(`/players/${encodeURIComponent(b.name)}`)}>{b.name}</button>
                    </td>
                    <td className="text-right text-gray-400">{Math.floor(b.legalBalls / 6)}.{b.legalBalls % 6}</td>
                    <td className="text-right text-gray-400">{b.maidens}</td>
                    <td className="text-right text-gray-400">{b.runsConceded}</td>
                    <td className="text-right font-bold">{b.wickets}</td>
                    <td className="text-right text-gray-400">{economyRate(b.runsConceded, b.legalBalls)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Fielding stats */}
            {fielders.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-xs text-gray-500 font-semibold mb-2">FIELDING</h3>
                <div className="flex flex-wrap gap-2">
                  {fielders.map((f) => (
                    <div key={f.playerId} className="text-xs bg-gray-100 dark:bg-gray-800 rounded-lg px-2.5 py-1.5">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{f.name}</span>
                      <span className="text-gray-500 ml-1.5">
                        {[
                          f.catches > 0 && `${f.catches}c`,
                          f.runOuts > 0 && `${f.runOuts}ro`,
                          f.stumpings > 0 && `${f.stumpings}st`,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Hidden elements for image capture */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        <ScorecardImage ref={scorecardRef} match={match} completedAt={matchRecord.completedAt} />
      </div>
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        <SocialCard ref={socialCardRef} match={match} completedAt={matchRecord.completedAt} />
      </div>
    </div>
  )
}
