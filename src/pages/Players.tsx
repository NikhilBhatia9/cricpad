import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabase'
import { fetchAllPlayers, fetchPlayerStats, computeCareerBatting, computeCareerBowling } from '../db/operations'
import type { PlayerRecord, PlayerMatchStat } from '../db/types'
import BackButton from '../components/BackButton'

export default function Players() {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [players, setPlayers] = useState<PlayerRecord[] | null>(null)
  const [statsMap, setStatsMap] = useState<Record<string, PlayerMatchStat[]>>({})

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

  if (!players) {
    return (
      <div className="flex flex-col min-h-screen px-6 py-12 items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton onClick={() => navigate('/')} />
        <h1 className="text-xl font-bold">Players</h1>
        <button
          className="ml-auto bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5"
          onClick={() => { setShowAdd(!showAdd); setAddError('') }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Player
        </button>
      </div>

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

      {players.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center gap-4 text-center py-16">
          <div className="text-5xl">&#x1F3CF;</div>
          <p className="text-gray-400">No player profiles yet.<br />Add players or complete a match.</p>
        </div>
      )}

      <div className="space-y-3">
        {players.map((player) => {
          const stats = statsMap[player.name] ?? []
          const bat = computeCareerBatting(stats)
          const bowl = computeCareerBowling(stats)
          return (
            <button
              key={player.name}
              className="card w-full text-left hover:bg-gray-700/80 transition-colors active:scale-[0.99]"
              onClick={() => navigate(`/players/${encodeURIComponent(player.name)}`)}
            >
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="font-bold text-lg">{player.name}</p>
                  <p className="text-xs text-gray-500">{player.totalMatches} match{player.totalMatches !== 1 ? 'es' : ''}</p>
                </div>
                <span className="text-2xl">&#x1F9D1;&#x200D;&#x1F3CF;</span>
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
          )
        })}
      </div>
    </div>
  )
}
