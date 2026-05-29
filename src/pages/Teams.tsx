import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { getSavedTeams, upsertTeam, deleteTeam } from '../utils/savedTeams'
import type { SavedTeam } from '../utils/savedTeams'
import { fetchAllPlayers, ensurePlayerExists } from '../db/operations'
import BackButton from '../components/BackButton'

export default function Teams() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState<SavedTeam[]>([])
  const [playerPool, setPlayerPool] = useState<string[]>([])
  const [editing, setEditing] = useState<SavedTeam | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamPlayers, setNewTeamPlayers] = useState<string[]>([])
  const [customPlayerName, setCustomPlayerName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  // lifted pool state for sub-views (avoids hooks-in-conditionals violation)
  const [editPool, setEditPool] = useState<string[]>([])
  const [createPool, setCreatePool] = useState<string[]>([])

  useEffect(() => {
    getSavedTeams().then(setTeams)
    fetchAllPlayers()
      .then((ps) => setPlayerPool(ps.map((p) => p.name)))
      .catch(() => {})
  }, [])

  // Sync editPool when editing changes
  useEffect(() => {
    if (editing) {
      const all = [...playerPool]
      editing.playerNames.forEach((n) => { if (!all.includes(n)) all.push(n) })
      setEditPool(all)
    }
  }, [editing, playerPool])

  // Sync createPool when showNew opens
  useEffect(() => {
    if (showNew) {
      setCreatePool([...playerPool])
    }
  }, [showNew, playerPool])

  async function reload() {
    setTeams(await getSavedTeams())
  }

  async function handleSaveNew() {
    const name = newTeamName.trim()
    if (!name) return
    if (newTeamPlayers.length < 1) return
    await upsertTeam({
      id: uuidv4(),
      name,
      playerNames: newTeamPlayers,
      updatedAt: new Date().toISOString(),
    })
    setShowNew(false)
    setNewTeamName('')
    setNewTeamPlayers([])
    void reload()
  }

  async function handleSaveEdit() {
    if (!editing) return
    const name = editing.name.trim()
    if (!name || editing.playerNames.length < 1) return
    await upsertTeam({ ...editing, name, updatedAt: new Date().toISOString() })
    setEditing(null)
    void reload()
  }

  async function handleDelete(id: string) {
    await deleteTeam(id)
    setConfirmDelete(null)
    void reload()
  }

  function togglePlayer(
    name: string,
    selected: string[],
    setSelected: (v: string[]) => void
  ) {
    setSelected(
      selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]
    )
  }

  function addCustomPlayer(
    customName: string,
    selected: string[],
    setSelected: (v: string[]) => void,
    pool: string[],
    setPool: (v: string[]) => void
  ) {
    const n = customName.trim()
    if (!n) return
    if (!pool.includes(n)) setPool([...pool, n])
    if (!selected.includes(n)) setSelected([...selected, n])
    setCustomPlayerName('')
    ensurePlayerExists(n).catch(() => {})
  }

  // ── Edit team overlay ──────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto pb-10">
        <div className="flex items-center gap-3 mb-5">
          <BackButton onClick={() => setEditing(null)} label="Teams" />
          <h1 className="text-xl font-bold">Edit Team</h1>
        </div>
        <div className="card mb-4">
          <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1.5">Team Name</label>
          <input
            className="input-field"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder="Team name"
          />
        </div>
        <PlayerPicker
          pool={editPool}
          selected={editing.playerNames}
          onToggle={(n) =>
            setEditing({ ...editing, playerNames: editing.playerNames.includes(n)
              ? editing.playerNames.filter((x) => x !== n)
              : [...editing.playerNames, n] })
          }
          customPlayerName={customPlayerName}
          setCustomPlayerName={setCustomPlayerName}
          onAddCustom={() =>
            addCustomPlayer(customPlayerName, editing.playerNames,
              (v) => setEditing({ ...editing, playerNames: v }),
              editPool, setEditPool)
          }
        />
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={() => setEditing(null)}>Cancel</button>
          <button
            className="btn-primary flex-1"
            onClick={handleSaveEdit}
            disabled={!editing.name.trim() || editing.playerNames.length < 1}
          >
            Save Team
          </button>
        </div>
      </div>
    )
  }

  // ── Create team overlay ────────────────────────────────────────────────────
  if (showNew) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto pb-10">
        <div className="flex items-center gap-3 mb-5">
          <BackButton onClick={() => { setShowNew(false); setNewTeamName(''); setNewTeamPlayers([]) }} label="Teams" />
          <h1 className="text-xl font-bold">New Team</h1>
        </div>
        <div className="card mb-4">
          <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1.5">Team Name</label>
          <input
            className="input-field"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="e.g. Warriors, Thunder XI..."
            autoFocus
          />
        </div>
        <PlayerPicker
          pool={createPool}
          selected={newTeamPlayers}
          onToggle={(n) => togglePlayer(n, newTeamPlayers, setNewTeamPlayers)}
          customPlayerName={customPlayerName}
          setCustomPlayerName={setCustomPlayerName}
          onAddCustom={() =>
            addCustomPlayer(customPlayerName, newTeamPlayers, setNewTeamPlayers, createPool, setCreatePool)
          }
        />
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={() => { setShowNew(false); setNewTeamName(''); setNewTeamPlayers([]) }}>Cancel</button>
          <button
            className="btn-primary flex-1"
            onClick={handleSaveNew}
            disabled={!newTeamName.trim() || newTeamPlayers.length < 1}
          >
            Save Team
          </button>
        </div>
      </div>
    )
  }

  // ── Team list ──────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 max-w-lg mx-auto pb-10">
      <div className="flex items-center gap-3 mb-5">
        <BackButton onClick={() => navigate('/')} />
        <h1 className="text-xl font-bold">Teams</h1>
        <button
          className="ml-auto bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
          onClick={() => setShowNew(true)}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Team
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">🛡️</p>
          <p className="text-gray-300 font-semibold mb-1">No saved teams yet</p>
          <p className="text-gray-500 text-sm mb-5">Create a team to quickly load players when starting a match.</p>
          <button className="btn-primary" onClick={() => setShowNew(true)}>+ Create First Team</button>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <div key={team.id} className="card">
              {confirmDelete === team.id ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-red-400">Delete &ldquo;{team.name}&rdquo;?</p>
                  <p className="text-xs text-gray-400">This only removes the saved template — no match history is affected.</p>
                  <div className="flex gap-2">
                    <button className="btn-secondary flex-1 text-sm py-2" onClick={() => setConfirmDelete(null)}>Cancel</button>
                    <button className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-2 rounded-xl text-sm transition-colors" onClick={() => handleDelete(team.id)}>Delete</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-3xl">🛡️</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{team.name}</p>
                    <p className="text-xs text-gray-400">
                      {team.playerNames.length} player{team.playerNames.length !== 1 ? 's' : ''} &middot;{' '}
                      <span className="text-gray-500">{team.playerNames.slice(0, 4).join(', ')}{team.playerNames.length > 4 ? `... +${team.playerNames.length - 4}` : ''}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing({ ...team })}
                      className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(team.id)}
                      className="bg-red-900/40 hover:bg-red-800/60 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerPicker({
  pool, selected, onToggle, customPlayerName, setCustomPlayerName, onAddCustom,
}: {
  pool: string[]
  selected: string[]
  onToggle: (name: string) => void
  customPlayerName: string
  setCustomPlayerName: (v: string) => void
  onAddCustom: () => void
}) {
  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">Players</h2>
        <span className="text-xs text-gray-400">{selected.length} selected</span>
      </div>

      {/* Add custom player */}
      <div className="flex gap-2 mb-3">
        <input
          className="input-field flex-1 text-sm"
          placeholder="Add player not in pool..."
          value={customPlayerName}
          onChange={(e) => setCustomPlayerName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAddCustom()}
        />
        <button
          className="bg-gray-600 hover:bg-gray-500 px-3 rounded-lg text-sm font-semibold transition-colors"
          onClick={onAddCustom}
        >
          Add
        </button>
      </div>

      {/* Player chips */}
      {pool.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">No players found. Add players above or in the Players section.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {pool.map((name) => {
            const isSelected = selected.includes(name)
            return (
              <button
                key={name}
                onClick={() => onToggle(name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-green-600 text-white ring-2 ring-green-400/40'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {isSelected && <span className="mr-1">✓</span>}{name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
