import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabase'
import { fetchAllPlayers, fetchPlayerStats, fetchMatchResultsMap, fetchLeaderboard, computeCareerBatting, computeCareerBowling, computeCareerRecord, renamePlayer } from '../db/operations'
import type { PlayerRecord, PlayerMatchStat, LeaderboardEntry } from '../db/types'
import BackButton from '../components/BackButton'

type LeaderboardPeriod = 'all' | 'year' | 'month' | 'week'

const PERIOD_LABELS: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'all',   label: 'All Time' },
  { key: 'year',  label: 'Year' },
  { key: 'month', label: 'Month' },
  { key: 'week',  label: 'Week' },
]

function getSince(period: LeaderboardPeriod): string | undefined {
  const now = new Date()
  if (period === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString() }
  if (period === 'month') { return new Date(now.getFullYear(), now.getMonth(), 1).toISOString() }
  if (period === 'year')  { return new Date(now.getFullYear(), 0, 1).toISOString() }
  return undefined
}

type SortKey = 'matches' | 'wins' | 'losses' | 'runs' | 'wickets' | 'maidens' | 'mvps' | 'average' | 'economy' | 'sixes' | 'catches'

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'matches',  label: 'Most Matches',   icon: '📅' },
  { key: 'wins',     label: 'Most Wins',       icon: '🏆' },
  { key: 'losses',   label: 'Most Losses',     icon: '💔' },
  { key: 'runs',     label: 'Most Runs',       icon: '🏏' },
  { key: 'wickets',  label: 'Most Wickets',    icon: '🎯' },
  { key: 'maidens',  label: 'Most Maidens',    icon: '🔇' },
  { key: 'mvps',     label: 'Most MVPs',       icon: '⭐' },
  { key: 'average',  label: 'Best Average',    icon: '📈' },
  { key: 'economy',  label: 'Best Economy',    icon: '💨' },
  { key: 'sixes',    label: 'Most Sixes',      icon: '6️⃣' },
  { key: 'catches',  label: 'Most Catches',    icon: '🤲' },
]

function parseStat(val: string | number, fallback = 0): number {
  if (typeof val === 'number') return val
  if (val === '-' || val === '') return fallback
  if (val === '\u221e') return 9999
  return parseFloat(val) || fallback
}

export default function Players() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'players' | 'leaderboard'>('players')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [players, setPlayers] = useState<PlayerRecord[] | null>(null)
  const [statsMap, setStatsMap] = useState<Record<string, PlayerMatchStat[]>>({})
  const [matchResults, setMatchResults] = useState<Record<string, string>>({})
  const [sortKey, setSortKey] = useState<SortKey>('matches')
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareA, setCompareA] = useState<string | null>(null)

  // Leaderboard state
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('all')
  const [leaderboardSort, setLeaderboardSort] = useState<'points' | 'mvps'>('points')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [potmData, setPotmData] = useState<LeaderboardEntry | null>(null)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const potmLoadedRef = useRef(false)

  async function loadPlayers() {
    try {
      const ps = await fetchAllPlayers()
      setPlayers(ps)
      const map: Record<string, PlayerMatchStat[]> = {}
      await Promise.all(
        ps.map(async (p) => {
          map[p.name] = await fetchPlayerStats(p.name)
        })
      )
      setStatsMap(map)
      const allMatchIds = [...new Set(Object.values(map).flat().map((s) => s.matchId))]
      const results = await fetchMatchResultsMap(allMatchIds)
      setMatchResults(results)
    } catch {
      setPlayers([]) // ensure UI renders even if Supabase is unreachable
    }
  }

  useEffect(() => { loadPlayers() }, [])

  // Load leaderboard when tab is active or period changes
  useEffect(() => {
    if (activeTab !== 'leaderboard') return
    async function loadLeaderboard() {
      setLeaderboardLoading(true)
      try {
        const since = getSince(leaderboardPeriod)
        const data = await fetchLeaderboard(since)
        setLeaderboard(data)
        // Load Player of the Month once per session
        if (!potmLoadedRef.current) {
          potmLoadedRef.current = true
          const monthStart = new Date()
          monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
          const potm = await fetchLeaderboard(monthStart.toISOString())
          setPotmData(potm[0] ?? null)
        }
      } catch {
        setLeaderboard([])
      } finally {
        setLeaderboardLoading(false)
      }
    }
    loadLeaderboard()
  }, [activeTab, leaderboardPeriod])

  async function addPlayer() {
    const name = newName.trim()
    if (!name) { setAddError('Enter a name'); return }
    const existing = players?.find((p) => p.name === name)
    if (existing) { setAddError('Player already exists'); return }
    const now = new Date().toISOString()
    await supabase.from('players').insert({ name, first_seen_at: now, last_seen_at: now, total_matches: 0 })
    setNewName('')
    setShowAdd(false)
    setAddError('')
    loadPlayers()
  }

  async function saveEdit() {
    if (!editingPlayer) return
    const trimmed = editName.trim()
    if (!trimmed) { setEditError('Enter a name'); return }
    setEditSaving(true)
    const { error } = await renamePlayer(editingPlayer, trimmed)
    setEditSaving(false)
    if (error) { setEditError(error); return }
    setEditingPlayer(null)
    setEditName('')
    setEditError('')
    loadPlayers()
  }

  function startEdit(name: string, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingPlayer(name)
    setEditName(name)
    setEditError('')
  }

  function cancelEdit() {
    setEditingPlayer(null)
    setEditName('')
    setEditError('')
  }

  const sortedPlayers = useMemo(() => {
    if (!players) return []
    return [...players].sort((a, b) => {
      const sa = statsMap[a.name] ?? []
      const sb = statsMap[b.name] ?? []
      const batA = computeCareerBatting(sa)
      const batB = computeCareerBatting(sb)
      const bowlA = computeCareerBowling(sa)
      const bowlB = computeCareerBowling(sb)

      switch (sortKey) {
        case 'matches':  return b.totalMatches - a.totalMatches
        case 'wins': {
          const recA = computeCareerRecord(sa, matchResults)
          const recB = computeCareerRecord(sb, matchResults)
          return recB.wins - recA.wins
        }
        case 'losses': {
          const recA = computeCareerRecord(sa, matchResults)
          const recB = computeCareerRecord(sb, matchResults)
          return recB.losses - recA.losses
        }
        case 'runs':     return batB.totalRuns - batA.totalRuns
        case 'wickets':  return bowlB.wickets - bowlA.wickets
        case 'maidens':  return bowlB.maidens - bowlA.maidens
        case 'mvps':     return batB.mvpWins - batA.mvpWins
        case 'sixes':    return batB.sixes - batA.sixes
        case 'catches': {
          const cA = sa.reduce((s, r) => s + (r.fieldCatches ?? 0), 0)
          const cB = sb.reduce((s, r) => s + (r.fieldCatches ?? 0), 0)
          return cB - cA
        }
        case 'average':  return parseStat(batB.average) - parseStat(batA.average)
        case 'economy':  {
          const eA = parseStat(bowlA.economy, 9999)
          const eB = parseStat(bowlB.economy, 9999)
          return eA - eB
        }
        default: return 0
      }
    })
  }, [players, statsMap, matchResults, sortKey])

  if (!players) {
    return (
      <div className="flex flex-col min-h-screen px-6 py-12 items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <BackButton onClick={() => navigate('/')} />
        <h1 className="text-xl font-bold">Players</h1>
        <div className="ml-auto flex items-center gap-2">
          {activeTab === 'players' && !compareMode && (
            <>
              {players && players.length >= 2 && (
                <button
                  className="bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5"
                  onClick={() => { setCompareMode(true); setCompareA(null) }}
                >
                  ⚖️ Compare
                </button>
              )}
              <button
                className="bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5"
                onClick={() => { setShowAdd(!showAdd); setAddError('') }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
            </>
          )}
          {activeTab === 'players' && compareMode && (
            <button
              className="bg-gray-600 hover:bg-gray-500 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              onClick={() => { setCompareMode(false); setCompareA(null) }}
            >
              ✕ Cancel
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-xl p-1 mb-4">
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'players' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
          onClick={() => setActiveTab('players')}
        >
          👥 Players
        </button>
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'leaderboard' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          🏆 Leaderboard
        </button>
      </div>

      {/* ── LEADERBOARD TAB ── */}
      {activeTab === 'leaderboard' && (
        <div>
          {/* Period filter */}
          <div className="flex gap-1 mb-4">
            {PERIOD_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setLeaderboardPeriod(key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  leaderboardPeriod === key ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Player of the Month spotlight */}
          {potmData && (
            <div className="relative mb-4 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 via-amber-600/10 to-orange-500/20 border border-yellow-500/30 rounded-2xl" />
              <div className="relative px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-yellow-400 mb-2">🗓️ Player of the Month</p>
                <button
                  className="w-full text-left flex items-center gap-3"
                  onClick={() => navigate(`/players/${encodeURIComponent(potmData.playerName)}`)}
                >
                  <div className="text-4xl">🏏</div>
                  <div>
                    <p className="text-xl font-bold text-yellow-300">{potmData.playerName}</p>
                    <p className="text-xs text-gray-400">
                      {potmData.mvpWins > 0
                        ? `${potmData.mvpWins} MVP win${potmData.mvpWins !== 1 ? 's' : ''} this month`
                        : 'Top performer this month'}{' '}
                      · {potmData.totalMvpPoints} pts · {potmData.totalRuns} runs · {potmData.totalWickets} wkts
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {leaderboardLoading ? (
            <div className="text-center py-12 text-gray-400">Loading…</div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No data for this period yet.</div>
          ) : (
            <>
              {/* Sort toggle */}
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => setLeaderboardSort('points')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${leaderboardSort === 'points' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  🟣 Sort by Points
                </button>
                <button
                  onClick={() => setLeaderboardSort('mvps')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${leaderboardSort === 'mvps' ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  ⭐ Sort by MVP Wins
                </button>
              </div>
            <div className="space-y-2">
              {[...leaderboard]
                .sort((a, b) => leaderboardSort === 'mvps'
                  ? (b.mvpWins !== a.mvpWins ? b.mvpWins - a.mvpWins : b.totalMvpPoints - a.totalMvpPoints)
                  : (b.totalMvpPoints !== a.totalMvpPoints ? b.totalMvpPoints - a.totalMvpPoints : b.mvpWins - a.mvpWins)
                )
                .map((entry, index) => {
                const medals = ['🥇', '🥈', '🥉']
                const medal = medals[index]
                return (
                  <button
                    key={entry.playerName}
                    className="w-full text-left card hover:bg-gray-700/50 transition-colors"
                    onClick={() => navigate(`/players/${encodeURIComponent(entry.playerName)}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 text-center text-2xl flex-shrink-0">
                        {medal ?? <span className="text-gray-500 font-bold text-base">#{index + 1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{entry.playerName}</p>
                        <p className="text-xs text-gray-400">
                          {entry.matches} match{entry.matches !== 1 ? 'es' : ''} · {entry.totalRuns} runs · {entry.totalWickets} wkt{entry.totalWickets !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className="text-center bg-yellow-900/40 border border-yellow-700/40 rounded-xl px-3 py-1 min-w-[60px]">
                          <p className="text-base font-bold text-yellow-400">{entry.mvpWins}</p>
                          <p className="text-xs text-gray-500">MVP{entry.mvpWins !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="text-center bg-purple-900/40 border border-purple-700/40 rounded-xl px-3 py-1 min-w-[60px]">
                          <p className="text-base font-bold text-purple-300">{entry.totalMvpPoints}</p>
                          <p className="text-xs text-gray-500">pts</p>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            </>
          )}
        </div>
      )}

      {/* ── PLAYERS TAB ── */}
      {activeTab === 'players' && (
        <>
          {/* Compare mode banner */}
          {compareMode && (
            <div className="card mb-4 bg-blue-900/40 border border-blue-700/50">
              <p className="text-sm font-semibold text-blue-300">
                {compareA === null
                  ? '👆 Tap a player to compare'
                  : `✅ ${compareA} selected — tap a second player`}
              </p>
            </div>
          )}

          {showAdd && (
            <div className="card mb-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">New Player</h2>
              <div className="flex gap-2">
                <input
                  autoFocus
                  className="input-field flex-1"
                  placeholder="Player name"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setAddError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                />
                <button
                  className="bg-green-600 hover:bg-green-500 px-4 rounded-lg font-semibold text-sm transition-colors"
                  onClick={addPlayer}
                >
                  Save
                </button>
              </div>
              {addError && <p className="text-red-400 text-xs mt-2">{addError}</p>}
            </div>
          )}

          {/* Sort dropdown */}
          {players && players.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <label className="text-xs text-gray-400 whitespace-nowrap">Sort by</label>
              <div className="relative flex-1">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="w-full appearance-none bg-gray-700 border border-gray-600 text-white text-sm font-semibold rounded-xl px-4 py-2.5 pr-9 focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                >
                  {SORT_OPTIONS.map(({ key, label, icon }) => (
                    <option key={key} value={key}>{icon} {label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {players && players.length === 0 && !showAdd && (
            <div className="flex flex-col items-center justify-center gap-4 text-center py-16">
              <div className="text-5xl">&#x1F3CF;</div>
              <p className="text-gray-400">No player profiles yet.<br />Add players or complete a match.</p>
            </div>
          )}

          <div className="space-y-3">
            {sortedPlayers.map((player) => {
              const stats = statsMap[player.name] ?? []
              const bat = computeCareerBatting(stats)
              const bowl = computeCareerBowling(stats)
              const rec = computeCareerRecord(stats, matchResults)

              // Last 5 match form dots
              const uniqueMatchIds = [...new Set(
                [...stats].sort((a, b) => a.matchDate.localeCompare(b.matchDate)).map((s) => s.matchId)
              )]
              const last5 = uniqueMatchIds.slice(-5)
              const formDots = last5.map((matchId) => {
                const result = matchResults[matchId] ?? ''
                const playerStat = stats.find((s) => s.matchId === matchId)
                if (!playerStat || !result) return 'unknown'
                const r = result.toLowerCase()
                if (r.includes('tied') || r.includes('tie')) return 'tie'
                return result.startsWith(playerStat.teamName) ? 'win' : 'loss'
              })

              // Build the highlighted stat badge based on current sort
              let statLabel = ''
              let statValue: string | number = ''
              switch (sortKey) {
                case 'matches':  statLabel = 'Matches';  statValue = player.totalMatches; break
                case 'wins':     statLabel = 'Wins';     statValue = rec.wins; break
                case 'losses':   statLabel = 'Losses';   statValue = rec.losses; break
                case 'runs':     statLabel = 'Runs';     statValue = bat.totalRuns; break
                case 'wickets':  statLabel = 'Wickets';  statValue = bowl.wickets; break
                case 'maidens':  statLabel = 'Maidens';  statValue = bowl.maidens; break
                case 'mvps':     statLabel = 'MVPs';     statValue = bat.mvpWins; break
                case 'average':  statLabel = 'Avg';      statValue = bat.average; break
                case 'economy':  statLabel = 'Economy';  statValue = bowl.economy; break
                case 'sixes':    statLabel = 'Sixes';    statValue = bat.sixes; break
                case 'catches':  statLabel = 'Catches';  statValue = stats.reduce((s, r) => s + (r.fieldCatches ?? 0), 0); break
              }

              const statColor = sortKey === 'wins' ? 'text-green-400' : sortKey === 'losses' ? 'text-red-400' : 'text-yellow-300'

              return (
                <div key={player.name} className="card">
                  {/* ── Inline rename form ── */}
                  {editingPlayer === player.name ? (
                    <div>
                      <p className="text-xs text-gray-400 mb-2 font-semibold">Rename player</p>
                      <div className="flex gap-2 mb-2">
                        <input
                          autoFocus
                          className="input-field flex-1"
                          value={editName}
                          onChange={(e) => { setEditName(e.target.value); setEditError('') }}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                        />
                        <button
                          disabled={editSaving}
                          onClick={saveEdit}
                          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 px-4 rounded-lg font-semibold text-sm transition-colors"
                        >
                          {editSaving ? '…' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="bg-gray-600 hover:bg-gray-500 px-3 rounded-lg text-sm transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                      {editError && <p className="text-red-400 text-xs">{editError}</p>}
                    </div>
                  ) : (
                    /* ── Normal player row (tappable to navigate or compare-select) ── */
                    <button
                      className={`w-full text-left hover:bg-gray-700/40 transition-colors active:scale-[0.99] rounded-xl ${
                        compareMode && compareA === player.name ? 'ring-2 ring-blue-400' : ''
                      } ${compareMode && compareA !== null && compareA === player.name ? 'opacity-70' : ''}`}
                      onClick={() => {
                        if (compareMode) {
                          if (compareA === null) {
                            setCompareA(player.name)
                          } else if (compareA !== player.name) {
                            navigate(`/compare/${encodeURIComponent(compareA)}/${encodeURIComponent(player.name)}`)
                            setCompareMode(false)
                            setCompareA(null)
                          }
                        } else {
                          navigate(`/players/${encodeURIComponent(player.name)}`)
                        }
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-lg truncate">{player.name}</p>
                            {compareMode ? (
                              compareA === player.name
                                ? <span className="text-blue-400 text-sm">✓ Selected</span>
                                : compareA !== null ? <span className="text-xs text-gray-500">Tap to compare</span> : null
                            ) : (
                              <button
                                className="text-gray-500 hover:text-white transition-colors flex-shrink-0 p-1 rounded"
                                onClick={(e) => startEdit(player.name, e)}
                                title="Rename player"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{player.totalMatches} match{player.totalMatches !== 1 ? 'es' : ''} &middot; {rec.wins}W {rec.losses}L</p>
                          {/* Form dots — last 5 results */}
                          {formDots.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {formDots.map((dot, i) => (
                                <span
                                  key={i}
                                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                                    dot === 'win' ? 'bg-green-500' : dot === 'loss' ? 'bg-red-500' : dot === 'tie' ? 'bg-yellow-400' : 'bg-gray-600'
                                  }`}
                                  title={dot}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-1 ml-3">
                          {/* Sort-relevant stat */}
                          <div className="bg-gray-800 rounded-xl px-3 py-1.5 text-center min-w-[64px]">
                            <p className={`text-xl font-bold ${statColor}`}>{statValue}</p>
                            <p className="text-xs text-gray-500">{statLabel}</p>
                          </div>
                          {bat.mvpWins > 0 && (
                            <p className="text-xs text-yellow-400 font-semibold">&#x2B50; MVP &times;{bat.mvpWins}</p>
                          )}
                        </div>
                      </div>
                      {(bat.innings > 0 || bowl.wickets > 0) && (
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {bat.innings > 0 && (
                            <div className="bg-gray-900/60 rounded-xl p-2.5 text-center">
                              <p className="text-xs text-gray-500 mb-1">&#x1F3CF; Batting</p>
                              <p className="text-xl font-bold text-green-400">{bat.totalRuns}</p>
                              <p className="text-xs text-gray-400">runs &middot; avg {bat.average}</p>
                            </div>
                          )}
                          {bowl.wickets > 0 && (
                            <div className="bg-gray-900/60 rounded-xl p-2.5 text-center">
                              <p className="text-xs text-gray-500 mb-1">&#x1F3AF; Bowling</p>
                              <p className="text-xl font-bold text-blue-400">{bowl.wickets}</p>
                              <p className="text-xs text-gray-400">wkts &middot; eco {bowl.economy}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
