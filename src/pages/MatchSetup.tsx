import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { useMatchStore } from '../store/matchStore'
import type { Team, Player } from '../types/cricket'
import { db } from '../db/database'

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
  const [assignments, setAssignments] = useState<Record<string, 'A' | 'B'>>({})
  const [newName, setNewName] = useState('')

  useEffect(() => {
    db.players
      .toArray()
      .then((ps) => setPool(ps.sort((a, b) => b.totalMatches - a.totalMatches).map((p) => p.name)))
  }, [])

  const teamAPlayers = pool.filter((n) => assignments[n] === 'A')
  const teamBPlayers = pool.filter((n) => assignments[n] === 'B')
  const unassigned = pool.filter((n) => !assignments[n])

  function toggle(name: string, team: 'A' | 'B') {
    setAssignments((prev) => {
      if (prev[name] === team) {
        const next = { ...prev }
        delete next[name]
        return next
      }
      return { ...prev, [name]: team }
    })
  }

  function addNew() {
    const name = newName.trim()
    if (!name) return
    if (!pool.includes(name)) setPool((prev) => [name, ...prev])
    setNewName('')
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

  return (
    <div className="px-4 py-6 max-w-lg mx-auto pb-10">
      <button onClick={() => navigate('/')} className="text-gray-400 mb-4 text-sm">? Back</button>
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
          <label className="block text-xs text-green-400 font-bold mb-1.5 uppercase tracking-wide">Team A</label>
          <input
            className="input-field font-semibold"
            placeholder="Team name"
            value={teamAName}
            onChange={(e) => setTeamAName(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">{teamAPlayers.length} player{teamAPlayers.length !== 1 ? 's' : ''} selected</p>
        </div>
        <div className="card">
          <label className="block text-xs text-blue-400 font-bold mb-1.5 uppercase tracking-wide">Team B</label>
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
                  />
                ))}
              </div>
            </>
          )}

          {/* Team A */}
          {teamAPlayers.length > 0 && (
            <>
              <p className="text-xs text-green-500 uppercase tracking-wide mb-2">
                {teamAName || 'Team A'} ({teamAPlayers.length})
              </p>
              <div className="space-y-2 mb-4">
                {teamAPlayers.map((name) => (
                  <PlayerRow
                    key={name}
                    name={name}
                    assigned="A"
                    teamALabel={teamAName || 'Team A'}
                    teamBLabel={teamBName || 'Team B'}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </>
          )}

          {/* Team B */}
          {teamBPlayers.length > 0 && (
            <>
              <p className="text-xs text-blue-500 uppercase tracking-wide mb-2">
                {teamBName || 'Team B'} ({teamBPlayers.length})
              </p>
              <div className="space-y-2">
                {teamBPlayers.map((name) => (
                  <PlayerRow
                    key={name}
                    name={name}
                    assigned="B"
                    teamALabel={teamAName || 'Team A'}
                    teamBLabel={teamBName || 'Team B'}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <button className="btn-primary w-full" onClick={handleStart}>
        Continue to Toss ?
      </button>
    </div>
  )
}

function PlayerRow({
  name, assigned, teamALabel, teamBLabel, onToggle,
}: {
  name: string
  assigned: 'A' | 'B' | undefined
  teamALabel: string
  teamBLabel: string
  onToggle: (name: string, team: 'A' | 'B') => void
}) {
  return (
    <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
      <span className="flex-1 text-sm font-medium truncate">{name}</span>
      <button
        onClick={() => onToggle(name, 'A')}
        className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
          assigned === 'A'
            ? 'bg-green-600 text-white'
            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
        }`}
      >
        {teamALabel.length > 8 ? teamALabel.slice(0, 7) + '…' : teamALabel}
      </button>
      <button
        onClick={() => onToggle(name, 'B')}
        className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
          assigned === 'B'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
        }`}
      >
        {teamBLabel.length > 8 ? teamBLabel.slice(0, 7) + '…' : teamBLabel}
      </button>
    </div>
  )
}
