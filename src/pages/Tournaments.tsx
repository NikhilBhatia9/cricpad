import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import {
  getTournaments, upsertTournament, deleteTournament,
  generateFixtures, computeStandings,
} from '../utils/tournament'
import type { Tournament, TournamentMatch } from '../utils/tournament'
import BackButton from '../components/BackButton'

type TView = 'list' | 'create' | 'detail' | 'enter-result'

export default function Tournaments() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [view, setView] = useState<TView>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // Create form
  const [createName, setCreateName] = useState('')
  const [createTeams, setCreateTeams] = useState<string[]>([])
  const [createNewTeam, setCreateNewTeam] = useState('')
  const [createOvers, setCreateOvers] = useState('10')
  // Result entry form
  const [resultWinner, setResultWinner] = useState<'A' | 'B' | 'tie' | 'no_result' | ''>('')
  const [resultRunsA, setResultRunsA] = useState('')
  const [resultBallsA, setResultBallsA] = useState('')
  const [resultRunsB, setResultRunsB] = useState('')
  const [resultBallsB, setResultBallsB] = useState('')

  useEffect(() => { getTournaments().then(setTournaments) }, [])

  async function reload() { setTournaments(await getTournaments()) }

  const selectedTournament = tournaments.find((t) => t.id === selectedId) ?? null
  const selectedMatch: TournamentMatch | null = selectedTournament?.matches.find((m) => m.id === selectedMatchId) ?? null

  function openDetail(t: Tournament) {
    setSelectedId(t.id)
    setView('detail')
  }

  async function handleCreate() {
    const name = createName.trim()
    if (!name || createTeams.length < 2) return
    const t: Tournament = {
      id: uuidv4(),
      name,
      teams: createTeams,
      overs: Number(createOvers) || 10,
      matches: generateFixtures(createTeams),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await upsertTournament(t)
    void reload()
    setCreateName(''); setCreateTeams([]); setCreateNewTeam('')
    setSelectedId(t.id)
    setView('detail')
  }

  function openEnterResult(m: TournamentMatch) {
    setSelectedMatchId(m.id)
    setResultWinner(m.result ?? '')
    setResultRunsA(m.runsA?.toString() ?? '')
    setResultBallsA(m.ballsFacedA?.toString() ?? '')
    setResultRunsB(m.runsB?.toString() ?? '')
    setResultBallsB(m.ballsFacedB?.toString() ?? '')
    setView('enter-result')
  }

  async function handleSaveResult() {
    if (!selectedTournament || !selectedMatchId || !resultWinner) return
    const updated: Tournament = {
      ...selectedTournament,
      updatedAt: new Date().toISOString(),
      matches: selectedTournament.matches.map((m) => {
        if (m.id !== selectedMatchId) return m
        return {
          ...m,
          result: resultWinner as 'A' | 'B' | 'tie' | 'no_result',
          runsA: resultRunsA ? Number(resultRunsA) : undefined,
          ballsFacedA: resultBallsA ? Number(resultBallsA) : undefined,
          runsB: resultRunsB ? Number(resultRunsB) : undefined,
          ballsFacedB: resultBallsB ? Number(resultBallsB) : undefined,
          playedAt: new Date().toISOString(),
        }
      }),
    }
    await upsertTournament(updated)
    // Optimistically update local state without waiting for reload
    setTournaments((prev) => prev.map((t) => t.id === updated.id ? updated : t))
    setSelectedId(updated.id)
    setSelectedMatchId(null)
    setResultWinner(''); setResultRunsA(''); setResultBallsA(''); setResultRunsB(''); setResultBallsB('')
    setView('detail')
  }

  async function handleDeleteTournament(id: string) {
    await deleteTournament(id)
    if (selectedId === id) setSelectedId(null)
    setConfirmDeleteId(null)
    void reload()
    setView('list')
  }

  function addCreateTeam() {
    const n = createNewTeam.trim()
    if (!n || createTeams.includes(n)) return
    setCreateTeams((prev) => [...prev, n])
    setCreateNewTeam('')
  }

  const fixtureCount = (createTeams.length * (createTeams.length - 1)) / 2

  // ── Enter Result view ──────────────────────────────────────────────────────
  if (view === 'enter-result' && selectedTournament && selectedMatch) {
    const btnBase = 'flex-1 py-3 rounded-xl font-bold text-sm transition-colors border-2'
    const active = (val: string) => resultWinner === val
    return (
      <div className="px-4 py-6 max-w-lg mx-auto pb-10">
        <div className="flex items-center gap-3 mb-5">
          <BackButton onClick={() => { setSelectedMatchId(null); setView('detail') }} label={selectedTournament.name} />
          <h1 className="text-xl font-bold">Enter Result</h1>
        </div>

        <div className="card mb-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Match</p>
          <p className="text-lg font-bold">{selectedMatch.teamA} <span className="text-gray-500">vs</span> {selectedMatch.teamB}</p>
        </div>

        {/* Winner selection */}
        <div className="card mb-4">
          <p className="text-sm font-semibold text-gray-300 mb-3">Result</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { val: 'A', label: `🏆 ${selectedMatch.teamA}` },
              { val: 'B', label: `🏆 ${selectedMatch.teamB}` },
              { val: 'tie', label: '🤝 Tie' },
              { val: 'no_result', label: '🚫 No Result' },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setResultWinner(val as typeof resultWinner)}
                className={`${btnBase} px-3 py-2 rounded-lg ${
                  active(val)
                    ? 'border-green-500 bg-green-900/40 text-green-300'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Optional scores for NRR */}
        <div className="card mb-5">
          <p className="text-sm font-semibold text-gray-300 mb-1">Scores <span className="text-gray-500 font-normal text-xs">(optional — used for NRR)</span></p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-semibold">{selectedMatch.teamA}</p>
              <input className="input-field mb-2" placeholder="Runs" type="number" value={resultRunsA} onChange={(e) => setResultRunsA(e.target.value)} />
              <input className="input-field" placeholder="Balls faced" type="number" value={resultBallsA} onChange={(e) => setResultBallsA(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-semibold">{selectedMatch.teamB}</p>
              <input className="input-field mb-2" placeholder="Runs" type="number" value={resultRunsB} onChange={(e) => setResultRunsB(e.target.value)} />
              <input className="input-field" placeholder="Balls faced" type="number" value={resultBallsB} onChange={(e) => setResultBallsB(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={() => { setSelectedMatchId(null); setView('detail') }}>Cancel</button>
          <button className="btn-primary flex-1" onClick={handleSaveResult} disabled={!resultWinner}>Save Result</button>
        </div>
      </div>
    )
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  if (view === 'detail' && selectedTournament) {
    const standings = computeStandings(selectedTournament)
    const played = selectedTournament.matches.filter((m) => m.result).length
    const total = selectedTournament.matches.length

    return (
      <div className="px-4 py-6 max-w-lg mx-auto pb-10">
        <div className="flex items-center gap-2 mb-5">
          <BackButton onClick={() => setView('list')} label="Tournaments" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{selectedTournament.name}</h1>
            <p className="text-xs text-gray-500">{selectedTournament.teams.length} teams · {selectedTournament.overs} overs · {played}/{total} played</p>
          </div>
          <button
            onClick={() => setConfirmDeleteId(selectedTournament.id)}
            className="text-xs text-red-500 hover:text-red-400 px-2 py-1 transition-colors"
          >
            Delete
          </button>
        </div>

        {confirmDeleteId === selectedTournament.id && (
          <div className="card mb-4 border border-red-800/40">
            <p className="text-sm font-semibold text-red-400 mb-1">Delete &ldquo;{selectedTournament.name}&rdquo;?</p>
            <p className="text-xs text-gray-400 mb-3">All fixtures and results will be lost.</p>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1 text-sm py-2" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-2 rounded-xl text-sm transition-colors" onClick={() => handleDeleteTournament(selectedTournament.id)}>Delete</button>
            </div>
          </div>
        )}

        {/* Points Table */}
        <div className="card mb-4">
          <p className="text-sm font-bold text-gray-300 mb-3">🏆 Points Table</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[320px]">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-700">
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2">Team</th>
                  <th className="text-right pb-2">P</th>
                  <th className="text-right pb-2">W</th>
                  <th className="text-right pb-2">L</th>
                  <th className="text-right pb-2">T</th>
                  <th className="text-right pb-2 font-bold text-gray-300">Pts</th>
                  <th className="text-right pb-2">NRR</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.team} className={`border-b border-gray-700/40 ${i === 0 && s.played > 0 ? 'text-yellow-300' : ''}`}>
                    <td className="py-2 pr-2 text-gray-500 text-xs">{i + 1}</td>
                    <td className="py-2 font-semibold">{s.team}</td>
                    <td className="text-right text-gray-400">{s.played}</td>
                    <td className="text-right text-green-400">{s.won}</td>
                    <td className="text-right text-red-400">{s.lost}</td>
                    <td className="text-right text-yellow-400">{s.tied + s.noResult}</td>
                    <td className="text-right font-bold">{s.points}</td>
                    <td className={`text-right text-xs ${s.nrr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {s.nrr >= 0 ? '+' : ''}{s.nrr.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fixtures */}
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-300 mb-2">Fixtures</p>
          {selectedTournament.matches.map((m) => {
            const hasResult = !!m.result
            const winnerName = m.result === 'A' ? m.teamA : m.result === 'B' ? m.teamB : null
            return (
              <div key={m.id} className="card py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{m.teamA} <span className="text-gray-500">vs</span> {m.teamB}</p>
                    {hasResult && (
                      <p className="text-xs mt-0.5">
                        {m.result === 'tie' && <span className="text-yellow-400">🤝 Tied</span>}
                        {m.result === 'no_result' && <span className="text-gray-400">🚫 No Result</span>}
                        {winnerName && <span className="text-green-400">🏆 {winnerName} won</span>}
                        {(m.runsA !== undefined && m.runsB !== undefined) && (
                          <span className="text-gray-500 ml-2">
                            · {m.runsA} vs {m.runsB}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => openEnterResult(m)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                      hasResult
                        ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        : 'bg-green-700 hover:bg-green-600 text-white'
                    }`}
                  >
                    {hasResult ? 'Edit' : 'Add Result'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Create view ────────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto pb-10">
        <div className="flex items-center gap-3 mb-5">
          <BackButton onClick={() => { setView('list'); setCreateName(''); setCreateTeams([]) }} label="Tournaments" />
          <h1 className="text-xl font-bold">New Tournament</h1>
        </div>

        <div className="card mb-4">
          <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1.5">Tournament Name</label>
          <input
            className="input-field"
            placeholder="e.g. Summer League 2026"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="card mb-4">
          <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1.5">Overs per innings</label>
          <div className="flex gap-2 flex-wrap">
            {['5', '6', '10', '15', '20'].map((o) => (
              <button
                key={o}
                onClick={() => setCreateOvers(o)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${createOvers === o ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className="card mb-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-gray-400 uppercase tracking-wide">Teams</label>
            <span className="text-xs text-gray-500">{createTeams.length} added · {fixtureCount} fixture{fixtureCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              className="input-field flex-1 text-sm"
              placeholder="Team name..."
              value={createNewTeam}
              onChange={(e) => setCreateNewTeam(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCreateTeam()}
            />
            <button className="bg-gray-600 hover:bg-gray-500 px-4 rounded-lg text-sm font-semibold transition-colors" onClick={addCreateTeam}>Add</button>
          </div>
          {createTeams.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {createTeams.map((name) => (
                <span key={name} className="flex items-center gap-1.5 bg-gray-700 rounded-full px-3 py-1 text-sm">
                  {name}
                  <button onClick={() => setCreateTeams((prev) => prev.filter((n) => n !== name))} className="text-gray-400 hover:text-red-400 transition-colors">×</button>
                </span>
              ))}
            </div>
          )}
          {createTeams.length < 2 && (
            <p className="text-xs text-gray-500 mt-2">Add at least 2 teams to generate fixtures.</p>
          )}
        </div>

        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={() => { setView('list'); setCreateName(''); setCreateTeams([]) }}>Cancel</button>
          <button
            className="btn-primary flex-1"
            onClick={handleCreate}
            disabled={!createName.trim() || createTeams.length < 2}
          >
            Create & Generate Fixtures
          </button>
        </div>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 max-w-lg mx-auto pb-10">
      <div className="flex items-center gap-3 mb-5">
        <BackButton onClick={() => navigate('/')} />
        <h1 className="text-xl font-bold flex-1">Tournaments</h1>
        <button
          className="bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
          onClick={() => setView('create')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>
      </div>

      {tournaments.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-gray-300 font-semibold mb-1">No tournaments yet</p>
          <p className="text-gray-500 text-sm mb-5">Create a mini-league to track standings and fixtures.</p>
          <button className="btn-primary" onClick={() => setView('create')}>+ Create Tournament</button>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => {
            const played = t.matches.filter((m) => m.result).length
            const standings = computeStandings(t)
            const leader = standings[0]
            return (
              <button
                key={t.id}
                className="w-full card text-left hover:bg-gray-700/50 transition-colors"
                onClick={() => openDetail(t)}
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">🏆</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{t.name}</p>
                    <p className="text-xs text-gray-400">
                      {t.teams.length} teams · {t.overs} ov · {played}/{t.matches.length} played
                    </p>
                    {leader && leader.played > 0 && (
                      <p className="text-xs text-yellow-400 mt-1">🥇 {leader.team} — {leader.points} pts</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-gray-500 mt-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
