import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { useMatchStore } from '../store/matchStore'
import type { Team, Player } from '../types/cricket'
import { db } from '../db/database'

function buildTeam(name: string, playerNames: string[]): Team {
  const players: Player[] = playerNames
    .filter((n) => n.trim())
    .map((n) => ({ id: uuidv4(), name: n.trim() }))
  return { name, players }
}

export default function MatchSetup() {
  const navigate = useNavigate()
  const { createMatch } = useMatchStore()

  const [teamAName, setTeamAName] = useState('')
  const [teamBName, setTeamBName] = useState('')
  const [overs, setOvers] = useState('10')
  const [teamAPlayers, setTeamAPlayers] = useState(Array(11).fill(''))
  const [teamBPlayers, setTeamBPlayers] = useState(Array(11).fill(''))
  const [playerCount, setPlayerCount] = useState(11)
  const [knownPlayers, setKnownPlayers] = useState<string[]>([])

  useEffect(() => {
    db.players.toArray().then((ps) =>
        setKnownPlayers(ps.sort((a, b) => b.totalMatches - a.totalMatches).map((p) => p.name))
      )
  }, [])

  function handleStart() {
    if (!teamAName.trim() || !teamBName.trim()) return alert('Enter both team names')
    const teamA = buildTeam(teamAName.trim(), teamAPlayers.slice(0, playerCount))
    const teamB = buildTeam(teamBName.trim(), teamBPlayers.slice(0, playerCount))
    if (teamA.players.length < 2 || teamB.players.length < 2)
      return alert('Enter at least 2 players per team')
    createMatch([teamA, teamB], Number(overs))
    navigate('/toss')
  }

  function updatePlayer(team: 'A' | 'B', idx: number, value: string) {
    if (team === 'A') {
      const updated = [...teamAPlayers]; updated[idx] = value; setTeamAPlayers(updated)
    } else {
      const updated = [...teamBPlayers]; updated[idx] = value; setTeamBPlayers(updated)
    }
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <button onClick={() => navigate('/')} className="text-gray-400 mb-4 text-sm">← Back</button>
      <h1 className="text-2xl font-bold mb-6">Match Setup</h1>

      {/* Format */}
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

      {/* Players per side */}
      <div className="card mb-4">
        <label className="block text-sm text-gray-400 mb-2">Players per side</label>
        <div className="flex gap-2">
          {[6, 8, 11].map((n) => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex-1 ${
                playerCount === n ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Teams */}
      {(['A', 'B'] as const).map((side) => {
        const name = side === 'A' ? teamAName : teamBName
        const setName = side === 'A' ? setTeamAName : setTeamBName
        const players = side === 'A' ? teamAPlayers : teamBPlayers

        return (
          <div key={side} className="card mb-4">
            <input
              className="input-field mb-3 font-semibold"
              placeholder={`Team ${side} name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: playerCount }).map((_, i) => (
                <input
                  key={i}
                  list="player-names"
                  className="input-field text-sm py-2"
                  placeholder={`Player ${i + 1}`}
                  value={players[i]}
                  onChange={(e) => updatePlayer(side, i, e.target.value)}
                />
              ))}
            </div>
          </div>
        )
      })}

      <button className="btn-primary mt-2" onClick={handleStart}>
        Continue to Toss →
      </button>

      {/* Datalist for player autocomplete */}
      <datalist id="player-names">
        {knownPlayers.map((n) => <option key={n} value={n} />)}
      </datalist>
    </div>
  )
}
