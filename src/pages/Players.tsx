import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabase'
import { fetchAllPlayers, fetchPlayerStats, fetchMatchResultsMap, computeCareerBatting, computeCareerBowling, computeCareerRecord, renamePlayer } from '../db/operations'
import type { PlayerRecord, PlayerMatchStat } from '../db/types'
import BackButton from '../components/BackButton'
import { useAuth } from '../hooks/useAuth'

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
  const { isAdmin, user, signIn, signOut } = useAuth()
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
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

  async function loadPlayers() {
    const ps = await fetchAllPlayers()
    setPlayers(ps)
    const map: Record<string, PlayerMatchStat[]> = {}
    await Promise.all(
      ps.map(async (p) => {
        map[p.name] = await fetchPlayerStats(p.name)
      })
    )
    setStatsMap(map)
    // Collect all unique match IDs across all players and fetch results once
    const allMatchIds = [...new Set(Object.values(map).flat().map((s) => s.matchId))]
    const results = await fetchMatchResultsMap(allMatchIds)
    setMatchResults(results)
  }

  useEffect(() => { loadPlayers() }, [])

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

  async function handleLogin() {
    const err = await signIn(loginEmail.trim(), loginPassword)
    setLoginLoading(false)
    if (err) { setLoginError(err); return }
    setShowLoginForm(false)
    setLoginEmail('')
    setLoginPassword('')
    setLoginError('')
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
          {isAdmin && (
            <button
              className="bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5"
              onClick={() => { setShowAdd(!showAdd); setAddError('') }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          )}
          {user ? (
            <button
              onClick={() => signOut()}
              className="text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 px-2.5 py-1.5 rounded-lg transition-colors"
              title={`Signed in as ${user.email}`}
            >
              🔑 Admin
            </button>
          ) : (
            <button
              onClick={() => { setShowLoginForm(!showLoginForm); setLoginError('') }}
              className="text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              🔑 Sign in
            </button>
          )}
        </div>
      </div>

      {/* Admin login form */}
      {showLoginForm && !user && (
        <div className="card mb-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Admin Sign In</h2>
          <div className="space-y-2 mb-2">
            <input
              autoFocus
              type="email"
              className="input-field w-full"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => { setLoginEmail(e.target.value); setLoginError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <input
              type="password"
              className="input-field w-full"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => { setLoginPassword(e.target.value); setLoginError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <button
            disabled={loginLoading}
            onClick={() => { setLoginLoading(true); handleLogin() }}
            className="btn-primary w-full text-sm disabled:opacity-50"
          >
            {loginLoading ? 'Signing in…' : 'Sign In'}
          </button>
          {loginError && <p className="text-red-400 text-xs mt-2">{loginError}</p>}
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
      {players.length > 0 && (
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

      {players.length === 0 && !showAdd && (
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
                /* ── Normal player row (tappable to navigate) ── */
                <button
                  className="w-full text-left hover:bg-gray-700/40 transition-colors active:scale-[0.99] rounded-xl"
                  onClick={() => navigate(`/players/${encodeURIComponent(player.name)}`)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg truncate">{player.name}</p>
                        {isAdmin && (
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
    </div>
  )
}
