import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/database'
import { computeCareerBatting, computeCareerBowling } from '../db/operations'

export default function Players() {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')

  const players = useLiveQuery(
    () => db.players.toArray().then((ps) => ps.sort((a, b) => b.totalMatches - a.totalMatches)),
    []
  )
  const allStats = useLiveQuery(() => db.playerStats.toArray(), [])

  async function addPlayer() {
    const name = newName.trim()
    if (!name) { setAddError('Enter a name'); return }
    const existing = await db.players.get(name)
    if (existing) { setAddError('Player already exists'); return }
    await db.players.put({
      name,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      totalMatches: 0,
    })
    setNewName('')
    setShowAdd(false)
    setAddError('')
  }

  if (!players || !allStats) {
    return (
      <div className="flex flex-col min-h-screen px-6 py-12 items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-400 text-sm">? Back</button>
        <h1 className="text-xl font-bold">Players</h1>
        <button
          className="ml-auto bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          onClick={() => { setShowAdd(!showAdd); setAddError('') }}
        >
          + Add Player
        </button>
      </div>

      {/* Add player form */}
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
          <div className="text-5xl">??</div>
          <p className="text-gray-400">No player profiles yet.<br />Add players or complete a match.</p>
        </div>
      )}

      <div className="space-y-3">
        {players.map((player) => {
          const stats = allStats.filter((s) => s.playerName === player.name)
          const bat = computeCareerBatting(stats)
          const bowl = computeCareerBowling(stats)

          return (
            <button
              key={player.name}
              className="card w-full text-left hover:bg-gray-750 transition-colors active:scale-[0.99]"
              onClick={() => navigate(`/players/${encodeURIComponent(player.name)}`)}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-lg">{player.name}</p>
                  <p className="text-xs text-gray-500">{player.totalMatches} match{player.totalMatches !== 1 ? 'es' : ''}</p>
                </div>
                <span className="text-2xl">??</span>
              </div>

              {(bat.innings > 0 || bowl.wickets > 0) && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {bat.innings > 0 && (
                    <div className="bg-gray-800 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500 mb-1">Batting</p>
                      <p className="text-xl font-bold text-green-400">{bat.totalRuns}</p>
                      <p className="text-xs text-gray-400">runs · avg {bat.average}</p>
                    </div>
                  )}
                  {bowl.wickets > 0 && (
                    <div className="bg-gray-800 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500 mb-1">Bowling</p>
                      <p className="text-xl font-bold text-blue-400">{bowl.wickets}</p>
                      <p className="text-xs text-gray-400">wkts · eco {bowl.economy}</p>
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
