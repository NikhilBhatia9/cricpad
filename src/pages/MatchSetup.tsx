import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { useMatchStore } from '../store/matchStore'
import type { Team, Player } from '../types/cricket'
import { fetchAllPlayers, fetchPlayerStats, fetchMatchResultsMap } from '../db/operations'
import type { PlayerMatchStat } from '../db/types'
import BackButton from '../components/BackButton'
import { getSavedTeams } from '../utils/savedTeams'
import type { SavedTeam } from '../utils/savedTeams'

type Assignment = 'A' | 'B' | 'both'

function buildTeam(name: string, playerNames: string[]): Team {
  const players: Player[] = playerNames.map((n) => ({ id: uuidv4(), name: n }))
  return { name, players }
}

export default function MatchSetup() {
  const navigate = useNavigate()
  const { createMatch } = useMatchStore()

  const [teamAName, setTeamAName] = useState('')
  const [teamBName, setTeamBName] = useState('')
  const [overs, setOvers] = useState('10')
  const [pool, setPool] = useState<string[]>([])
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({})
  const [newName, setNewName] = useState('')
  const [statsMap, setStatsMap] = useState<Record<string, PlayerMatchStat[]>>({})
  const [matchResults, setMatchResults] = useState<Record<string, string>>({})
  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([])
  const [loadTeamSlot, setLoadTeamSlot] = useState<'A' | 'B' | null>(null)

  useEffect(() => {
    setSavedTeams(getSavedTeams())
    fetchAllPlayers()
      .then((ps) => {
        const names = ps.map((p) => p.name)
        setPool(names)
        return names
      })
      .then((names) =>
        Promise.all(names.map((n) => fetchPlayerStats(n).then((s) => ({ name: n, stats: s }))))
      )
      .then((results) => {
        const map: Record<string, PlayerMatchStat[]> = {}
        const allIds: string[] = []
        results.forEach(({ name, stats }) => {
          map[name] = stats
          stats.forEach((s) => { if (!allIds.includes(s.matchId)) allIds.push(s.matchId) })
        })
        setStatsMap(map)
        return fetchMatchResultsMap(allIds)
      })
      .then((results) => setMatchResults(results))
      .catch(() => {})
  }, [])

  const teamAPlayers = pool.filter((n) => assignments[n] === 'A' || assignments[n] === 'both')
  const teamBPlayers = pool.filter((n) => assignments[n] === 'B' || assignments[n] === 'both')
  const sharedPlayers = pool.filter((n) => assignments[n] === 'both')
  const unassigned = pool.filter((n) => !assignments[n])

  function toggle(name: string, team: 'A' | 'B') {
    setAssignments((prev) => {
      const current = prev[name] as Assignment | undefined
      const next = { ...prev }
      if (team === 'A') {
        if (!current) { next[name] = 'A' }
        else if (current === 'A') { delete next[name] }
        else if (current === 'B') { next[name] = 'both' }
        else if (current === 'both') { next[name] = 'B' }
      } else {
        if (!current) { next[name] = 'B' }
        else if (current === 'B') { delete next[name] }
        else if (current === 'A') { next[name] = 'both' }
        else if (current === 'both') { next[name] = 'A' }
      }
      return next
    })
  }

  function addNew() {
    const name = newName.trim()
    if (!name) return
    if (!pool.includes(name)) setPool((prev) => [name, ...prev])
    setNewName('')
  }

  function loadSavedTeam(team: SavedTeam, slot: 'A' | 'B') {
    // Set team name
    if (slot === 'A') setTeamAName(team.name)
    else setTeamBName(team.name)
    // Add any players not already in pool
    const newPlayers = team.playerNames.filter((n) => !pool.includes(n))
    if (newPlayers.length > 0) setPool((prev) => [...prev, ...newPlayers])
    // Assign players to slot (other assignments preserved)
    setAssignments((prev) => {
      const next = { ...prev }
      team.playerNames.forEach((n) => {
        const current = next[n] as Assignment | undefined
        if (!current) {
          next[n] = slot
        } else if (current !== slot && current !== 'both') {
          next[n] = 'both'
        }
        // already in this slot or 'both' — no change
      })
      return next
    })
    setLoadTeamSlot(null)
  }

  function handleStart() {
    if (!teamAName.trim() || !teamBName.trim()) return alert('Enter both team names')
    if (teamAPlayers.length < 2) return alert('Assign at least 2 players to Team A')
    if (teamBPlayers.length < 2) return alert('Assign at least 2 players to Team B')
    createMatch(
      [buildTeam(teamAName.trim(), teamAPlayers), buildTeam(teamBName.trim(), teamBPlayers)],
      Number(overs)
    )
    navigate('/toss')
  }

  // ── Load Team modal ─────────────────────────────────────────────────────────
  if (loadTeamSlot) {
    const slotColor = loadTeamSlot === 'A' ? 'text-green-400' : 'text-blue-400'
    return (
      <div className="px-4 py-6 max-w-lg mx-auto pb-10">
        <div className="flex items-center gap-3 mb-5">
          <BackButton onClick={() => setLoadTeamSlot(null)} label="Back" />
          <h1 className="text-xl font-bold">
            Load Team for <span className={slotColor}>Team {loadTeamSlot}</span>
          </h1>
        </div>
        {savedTeams.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-4xl mb-3">🛡️</p>
            <p className="text-gray-300 font-semibold mb-1">No saved teams</p>
            <p className="text-gray-500 text-sm mb-5">Create teams in the Teams section first.</p>
            <button className="btn-primary" onClick={() => navigate('/teams')}>Go to Teams</button>
          </div>
        ) : (
          <div className="space-y-3">
            {savedTeams.map((team) => (
              <button
                key={team.id}
                className="w-full card text-left hover:bg-gray-700/50 transition-colors"
                onClick={() => loadSavedTeam(team, loadTeamSlot)}
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl">🛡️</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{team.name}</p>
                    <p className="text-xs text-gray-400">
                      {team.playerNames.length} players &middot;{' '}
                      {team.playerNames.slice(0, 5).join(', ')}{team.playerNames.length > 5 ? `... +${team.playerNames.length - 5}` : ''}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${slotColor}`}>Load →</span>
                </div>
              </button>
            ))}
            <button
              className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-2 transition-colors"
              onClick={() => navigate('/teams')}
            >
              + Manage saved teams
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto pb-10">
      <BackButton onClick={() => navigate('/')} />
      <h1 className="text-2xl font-bold mb-6">Match Setup</h1>

      {/* Overs */}
      <div className="card mb-4">
        <label className="block text-sm text-gray-400 mb-2">Number of Overs</label>
        <div className="flex gap-2 flex-wrap">
          {['5', '6', '10', '15', '20'].map((o) => (
            <button
              key={o}
              onClick={() => setOvers(o)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                overs === o ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {o}
            </button>
          ))}
          <input
            type="number"
            value={overs}
            onChange={(e) => setOvers(e.target.value)}
            className="input-field w-20 text-center"
            min="1"
            max="50"
          />
        </div>
      </div>

      {/* Team names */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs text-green-400 font-bold uppercase tracking-wide">Team A</label>
            {savedTeams.length > 0 && (
              <button
                onClick={() => setLoadTeamSlot('A')}
                className="text-xs text-gray-400 hover:text-green-400 flex items-center gap-1 transition-colors"
              >
                📂 Load
              </button>
            )}
          </div>
          <input
            className="input-field font-semibold"
            placeholder="Team name"
            value={teamAName}
            onChange={(e) => setTeamAName(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">{teamAPlayers.length} player{teamAPlayers.length !== 1 ? 's' : ''} selected</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs text-blue-400 font-bold uppercase tracking-wide">Team B</label>
            {savedTeams.length > 0 && (
              <button
                onClick={() => setLoadTeamSlot('B')}
                className="text-xs text-gray-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
              >
                📂 Load
              </button>
            )}
          </div>
          <input
            className="input-field font-semibold"
            placeholder="Team name"
            value={teamBName}
            onChange={(e) => setTeamBName(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">{teamBPlayers.length} player{teamBPlayers.length !== 1 ? 's' : ''} selected</p>
        </div>
      </div>

      {/* Add a new player to the pool */}
      <div className="card mb-4">
        <label className="block text-sm text-gray-400 mb-2">Add Player to Pool</label>
        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            placeholder="Player name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNew()}
          />
          <button
            className="bg-gray-600 hover:bg-gray-500 px-4 rounded-lg font-semibold text-sm transition-colors"
            onClick={addNew}
          >
            Add
          </button>
        </div>
      </div>

      {/* Player assignment */}
      {pool.length === 0 ? (
        <div className="card mb-4 text-center py-8">
          <p className="text-gray-400 text-sm">No players yet.</p>
          <p className="text-gray-500 text-xs mt-1">Add players above, or create profiles in the Players section.</p>
        </div>
      ) : (
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-1">Assign Players to Teams</h2>
          <p className="text-xs text-gray-500 mb-3">Tap a team button to assign. Tap again to remove.</p>

          {/* Unassigned */}
          {unassigned.length > 0 && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Unassigned ({unassigned.length})</p>
              <div className="space-y-2 mb-4">
                {unassigned.map((name) => (
                  <PlayerRow
                    key={name}
                    name={name}
                    assigned={undefined}
                    teamALabel={teamAName || 'Team A'}
                    teamBLabel={teamBName || 'Team B'}
                    onToggle={toggle}
                    stats={statsMap[name] ?? []}
                    matchResults={matchResults}
                  />
                ))}
              </div>
            </>
          )}

          {/* Shared */}
          {sharedPlayers.length > 0 && (
            <>
              <p className="text-xs text-yellow-500 uppercase tracking-wide mb-2">⚡ Shared — Both Teams ({sharedPlayers.length})</p>
              <div className="space-y-2 mb-4">
                {sharedPlayers.map((name) => (
                  <PlayerRow
                    key={name}
                    name={name}
                    assigned="both"
                    teamALabel={teamAName || 'Team A'}
                    teamBLabel={teamBName || 'Team B'}
                    onToggle={toggle}
                    stats={statsMap[name] ?? []}
                    matchResults={matchResults}
                  />
                ))}
              </div>
            </>
          )}

          {/* Team A */}
          {teamAPlayers.filter((n) => assignments[n] === 'A').length > 0 && (
            <>
              <p className="text-xs text-green-500 uppercase tracking-wide mb-2">
                {teamAName || 'Team A'} only ({teamAPlayers.filter((n) => assignments[n] === 'A').length})
              </p>
              <div className="space-y-2 mb-4">
                {teamAPlayers.filter((n) => assignments[n] === 'A').map((name) => (
                  <PlayerRow
                    key={name}
                    name={name}
                    assigned="A"
                    teamALabel={teamAName || 'Team A'}
                    teamBLabel={teamBName || 'Team B'}
                    onToggle={toggle}
                    stats={statsMap[name] ?? []}
                    matchResults={matchResults}
                  />
                ))}
              </div>
            </>
          )}

          {/* Team B */}
          {teamBPlayers.filter((n) => assignments[n] === 'B').length > 0 && (
            <>
              <p className="text-xs text-blue-500 uppercase tracking-wide mb-2">
                {teamBName || 'Team B'} only ({teamBPlayers.filter((n) => assignments[n] === 'B').length})
              </p>
              <div className="space-y-2">
                {teamBPlayers.filter((n) => assignments[n] === 'B').map((name) => (
                  <PlayerRow
                    key={name}
                    name={name}
                    assigned="B"
                    teamALabel={teamAName || 'Team A'}
                    teamBLabel={teamBName || 'Team B'}
                    onToggle={toggle}
                    stats={statsMap[name] ?? []}
                    matchResults={matchResults}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <button className="btn-primary w-full" onClick={handleStart}>
        Continue to Toss &#x1F3CF;
      </button>
    </div>
  )
}

function PlayerRow({
  name, assigned, teamALabel, teamBLabel, onToggle, stats = [], matchResults = {},
}: {
  name: string
  assigned: Assignment | undefined
  teamALabel: string
  teamBLabel: string
  onToggle: (name: string, team: 'A' | 'B') => void
  stats?: PlayerMatchStat[]
  matchResults?: Record<string, string>
}) {
  const inA = assigned === 'A' || assigned === 'both'
  const inB = assigned === 'B' || assigned === 'both'

  // Compute last 5 form dots
  const sortedStats = [...stats].sort((a, b) => a.matchDate.localeCompare(b.matchDate))
  const uniqueMatchIds = [...new Set(sortedStats.map((s) => s.matchId))].slice(-5)
  const formDots = uniqueMatchIds.map((matchId) => {
    const result = matchResults[matchId] ?? ''
    const stat = stats.find((s) => s.matchId === matchId)
    if (!stat || !result) return 'unknown'
    const r = result.toLowerCase()
    if (r.includes('tied') || r.includes('tie')) return 'tie'
    return result.startsWith(stat.teamName) ? 'win' : 'loss'
  })

  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
      assigned === 'both' ? 'bg-yellow-900/30 border border-yellow-700/40' : 'bg-gray-800'
    }`}>
      <span className="flex-1 text-sm font-medium truncate flex items-center gap-1.5">
        {name}
        {assigned === 'both' && <span className="text-xs text-yellow-400 font-normal">shared</span>}
        {formDots.length > 0 && (
          <span className="flex gap-0.5 ml-1">
            {formDots.map((d, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full inline-block ${
                  d === 'win' ? 'bg-green-500' : d === 'loss' ? 'bg-red-500' : d === 'tie' ? 'bg-yellow-500' : 'bg-gray-600'
                }`}
              />
            ))}
          </span>
        )}
      </span>
      <button
        onClick={() => onToggle(name, 'A')}
        className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
          inA ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
        }`}
      >
        {teamALabel.length > 8 ? teamALabel.slice(0, 7) + '...' : teamALabel}
      </button>
      <button
        onClick={() => onToggle(name, 'B')}
        className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
          inB ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
        }`}
      >
        {teamBLabel.length > 8 ? teamBLabel.slice(0, 7) + '...' : teamBLabel}
      </button>
    </div>
  )
}