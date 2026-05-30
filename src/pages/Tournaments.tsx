import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import {
  getTournaments, upsertTournament, deleteTournament,
  generateLeagueFixtures, generateSeriesFixtures, generateEliminationFixtures,
  computeStandings, computeSeriesResult, advanceEliminationWinner,
} from '../utils/tournament'
import type { Tournament, TournamentMatch, TournamentFormat } from '../utils/tournament'
import { getSavedTeams } from '../utils/savedTeams'
import type { SavedTeam } from '../utils/savedTeams'
import BackButton from '../components/BackButton'

type TView = 'list' | 'create' | 'detail' | 'enter-result'
type CreateStep = 1 | 2 | 3 | 4

export default function Tournaments() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([])
  const [view, setView] = useState<TView>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Create wizard
  const [step, setStep] = useState<CreateStep>(1)
  const [createName, setCreateName] = useState('')
  const [createOvers, setCreateOvers] = useState('10')
  const [createTeams, setCreateTeams] = useState<string[]>([])
  const [createCustomTeam, setCreateCustomTeam] = useState('')
  const [createFormat, setCreateFormat] = useState<TournamentFormat | ''>('')
  const [createSeriesLength, setCreateSeriesLength] = useState<3 | 5>(3)

  // Result entry
  const [resultWinner, setResultWinner] = useState<'A' | 'B' | 'tie' | 'no_result' | ''>('')
  const [resultRunsA, setResultRunsA] = useState('')
  const [resultBallsA, setResultBallsA] = useState('')
  const [resultRunsB, setResultRunsB] = useState('')
  const [resultBallsB, setResultBallsB] = useState('')

  useEffect(() => {
    getTournaments().then(setTournaments)
    getSavedTeams().then(setSavedTeams)
  }, [])

  async function reload() { setTournaments(await getTournaments()) }

  const selectedTournament = tournaments.find((t) => t.id === selectedId) ?? null
  const selectedMatch: TournamentMatch | null =
    selectedTournament?.matches.find((m) => m.id === selectedMatchId) ?? null

  // ── Create helpers ─────────────────────────────────────────────────────────

  function resetCreate() {
    setStep(1); setCreateName(''); setCreateOvers('10')
    setCreateTeams([]); setCreateCustomTeam(''); setCreateFormat(''); setCreateSeriesLength(3)
  }

  function toggleSavedTeam(name: string) {
    setCreateTeams((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    )
  }

  function addCustomTeam() {
    const n = createCustomTeam.trim()
    if (!n || createTeams.includes(n)) return
    setCreateTeams((prev) => [...prev, n])
    setCreateCustomTeam('')
  }

  const availableFormats = useMemo<TournamentFormat[]>(() => {
    const n = createTeams.length
    const fmts: TournamentFormat[] = []
    if (n >= 2) fmts.push('league')
    if (n === 2) fmts.push('series')
    if (n >= 2) fmts.push('elimination')
    return fmts
  }, [createTeams.length])

  async function handleCreate() {
    if (!createName.trim() || createTeams.length < 2 || !createFormat) return
    let matches: TournamentMatch[] = []
    if (createFormat === 'league') {
      matches = generateLeagueFixtures(createTeams)
    } else if (createFormat === 'series') {
      matches = generateSeriesFixtures(createTeams[0], createTeams[1], createSeriesLength)
    } else {
      matches = generateEliminationFixtures(createTeams)
    }
    const t: Tournament = {
      id: uuidv4(),
      name: createName.trim(),
      teams: createTeams,
      overs: Number(createOvers) || 10,
      format: createFormat,
      seriesLength: createFormat === 'series' ? createSeriesLength : undefined,
      matches,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await upsertTournament(t)
    resetCreate()
    void reload()
    setSelectedId(t.id)
    setView('detail')
  }

  // ── Result entry ───────────────────────────────────────────────────────────

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
    let updated: Tournament = {
      ...selectedTournament,
      updatedAt: new Date().toISOString(),
      matches: selectedTournament.matches.map((m) => {
        if (m.id !== selectedMatchId) return m
        return {
          ...m,
          result: resultWinner as TournamentMatch['result'],
          runsA: resultRunsA ? Number(resultRunsA) : undefined,
          ballsFacedA: resultBallsA ? Number(resultBallsA) : undefined,
          runsB: resultRunsB ? Number(resultRunsB) : undefined,
          ballsFacedB: resultBallsB ? Number(resultBallsB) : undefined,
          playedAt: new Date().toISOString(),
        }
      }),
    }
    // For elimination: advance winner to next round
    if (updated.format === 'elimination') {
      updated = advanceEliminationWinner(updated, selectedMatchId)
    }
    await upsertTournament(updated)
    setTournaments((prev) => prev.map((t) => t.id === updated.id ? updated : t))
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

  // ── Enter Result view ──────────────────────────────────────────────────────
  if (view === 'enter-result' && selectedTournament && selectedMatch) {
    const btnBase = 'flex-1 py-3 rounded-xl font-bold text-sm transition-colors border-2'
    const active = (val: string) => resultWinner === val
    const isSeries = selectedTournament.format === 'series'
    const teamA = selectedMatch.teamA
    const teamB = selectedMatch.teamB
    const canTie = !isSeries

    return (
      <div className="px-4 py-6 max-w-lg mx-auto pb-10">
        <div className="flex items-center gap-3 mb-5">
          <BackButton onClick={() => { setSelectedMatchId(null); setView('detail') }} label={selectedTournament.name} />
          <h1 className="text-xl font-bold">
            {isSeries ? `Game ${selectedMatch.gameNumber}` : 'Enter Result'}
          </h1>
        </div>

        <div className="card mb-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            {selectedMatch.round ?? (isSeries ? `Game ${selectedMatch.gameNumber} of ${selectedTournament.seriesLength}` : 'Match')}
          </p>
          <p className="text-lg font-bold">{teamA} <span className="text-gray-500">vs</span> {teamB}</p>
        </div>

        <div className="card mb-4">
          <p className="text-sm font-semibold text-gray-300 dark:text-gray-300 mb-3">Result</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { val: 'A', label: `🏆 ${teamA}` },
              { val: 'B', label: `🏆 ${teamB}` },
              ...(canTie ? [{ val: 'tie', label: '🤝 Tie' }] : []),
              { val: 'no_result', label: '🚫 No Result' },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setResultWinner(val as typeof resultWinner)}
                className={`${btnBase} px-3 py-2 rounded-lg ${
                  active(val)
                    ? 'border-green-500 bg-green-900/40 text-green-300'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="card mb-5">
          <p className="text-sm font-semibold text-gray-300 mb-1">
            Scores <span className="text-gray-500 font-normal text-xs">(optional — used for NRR)</span>
          </p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-semibold">{teamA}</p>
              <input className="input-field mb-2" placeholder="Runs" type="number" value={resultRunsA} onChange={(e) => setResultRunsA(e.target.value)} />
              <input className="input-field" placeholder="Balls faced" type="number" value={resultBallsA} onChange={(e) => setResultBallsA(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-semibold">{teamB}</p>
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
    const fmt = selectedTournament.format ?? 'league'
    const played = selectedTournament.matches.filter((m) => m.result).length
    const total = selectedTournament.matches.length
    const fmtLabel = fmt === 'league' ? 'League' : fmt === 'series' ? `Best of ${selectedTournament.seriesLength}` : 'Knockout'

    return (
      <div className="px-4 py-6 max-w-lg mx-auto pb-10">
        <div className="flex items-center gap-2 mb-5">
          <BackButton onClick={() => setView('list')} label="Tournaments" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{selectedTournament.name}</h1>
            <p className="text-xs text-gray-500">
              {fmtLabel} · {selectedTournament.teams.length} teams · {selectedTournament.overs} ov · {played}/{total} played
            </p>
          </div>
          <button onClick={() => setConfirmDeleteId(selectedTournament.id)} className="text-xs text-red-500 hover:text-red-400 px-2 py-1 transition-colors">
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

        {fmt === 'league' && <LeagueDetail t={selectedTournament} onEnterResult={openEnterResult} />}
        {fmt === 'series' && <SeriesDetail t={selectedTournament} onEnterResult={openEnterResult} />}
        {fmt === 'elimination' && <EliminationDetail t={selectedTournament} onEnterResult={openEnterResult} />}
      </div>
    )
  }

  // ── Create wizard ──────────────────────────────────────────────────────────
  if (view === 'create') {
    const canNext1 = createName.trim().length > 0
    const canNext2 = createTeams.length >= 2
    const canNext3 = createFormat !== ''
    const fixturePreview = (() => {
      if (!createFormat) return ''
      if (createFormat === 'league') {
        const n = createTeams.length
        return `${(n * (n - 1)) / 2} matches (round-robin)`
      }
      if (createFormat === 'series') return `${createSeriesLength} scheduled games`
      const size = Math.pow(2, Math.ceil(Math.log2(Math.max(createTeams.length, 2))))
      return `${size - 1} matches (${Math.log2(size)} rounds)`
    })()

    return (
      <div className="px-4 py-6 max-w-lg mx-auto pb-10">
        <div className="flex items-center gap-3 mb-5">
          <BackButton
            onClick={() => {
              if (step === 1) { resetCreate(); setView('list') }
              else setStep((s) => (s - 1) as CreateStep)
            }}
            label={step === 1 ? 'Tournaments' : `Step ${step - 1}`}
          />
          <div className="flex-1">
            <h1 className="text-xl font-bold">New Tournament</h1>
            <div className="flex gap-1 mt-1.5">
              {([1, 2, 3, 4] as const).map((s) => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-green-500' : 'bg-gray-700'}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Step 1: Name & Overs */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="card">
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1.5">Tournament Name</label>
              <input
                className="input-field"
                placeholder="e.g. Summer League 2026"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canNext1 && setStep(2)}
                autoFocus
              />
            </div>
            <div className="card">
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">Overs per innings</label>
              <div className="flex gap-2 flex-wrap">
                {['5', '6', '10', '15', '20'].map((o) => (
                  <button
                    key={o}
                    onClick={() => setCreateOvers(o)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${createOvers === o ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-primary w-full" onClick={() => setStep(2)} disabled={!canNext1}>Next: Add Teams →</button>
          </div>
        )}

        {/* Step 2: Select Teams */}
        {step === 2 && (
          <div className="space-y-4">
            {savedTeams.length > 0 && (
              <div className="card">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Saved Teams</p>
                <div className="flex flex-wrap gap-2">
                  {savedTeams.map((st) => {
                    const selected = createTeams.includes(st.name)
                    return (
                      <button
                        key={st.id}
                        onClick={() => toggleSavedTeam(st.name)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                          selected
                            ? 'border-green-500 bg-green-900/40 text-green-300'
                            : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {selected && <span>✓</span>}
                        {st.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="card">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Add Custom Team</p>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1 text-sm"
                  placeholder="Team name..."
                  value={createCustomTeam}
                  onChange={(e) => setCreateCustomTeam(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomTeam()}
                />
                <button className="bg-gray-600 hover:bg-gray-500 px-4 rounded-lg text-sm font-semibold transition-colors" onClick={addCustomTeam}>Add</button>
              </div>
            </div>

            {createTeams.length > 0 && (
              <div className="card">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Selected ({createTeams.length})</p>
                <div className="flex flex-wrap gap-2">
                  {createTeams.map((name) => (
                    <span key={name} className="flex items-center gap-1.5 bg-green-900/30 border border-green-700/50 rounded-full px-3 py-1 text-sm text-green-200">
                      {name}
                      <button onClick={() => setCreateTeams((prev) => prev.filter((n) => n !== name))} className="text-green-400 hover:text-red-400 transition-colors">×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {createTeams.length < 2 && (
              <p className="text-xs text-gray-500 text-center">Select at least 2 teams to continue.</p>
            )}

            <button className="btn-primary w-full" onClick={() => { setCreateFormat(''); setStep(3) }} disabled={!canNext2}>Next: Choose Format →</button>
          </div>
        )}

        {/* Step 3: Format */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 mb-1">How should matches be scheduled?</p>

            {availableFormats.includes('league') && (
              <FormatCard
                selected={createFormat === 'league'}
                onClick={() => setCreateFormat('league')}
                emoji="📋"
                title="League (Round Robin)"
                description={`Every team plays every other team once. ${createTeams.length} teams → ${(createTeams.length * (createTeams.length - 1)) / 2} matches.`}
                badge="Points table + NRR"
              />
            )}

            {availableFormats.includes('series') && (
              <FormatCard
                selected={createFormat === 'series'}
                onClick={() => setCreateFormat('series')}
                emoji="🔁"
                title="Series (Head-to-Head)"
                description={`${createTeams[0]} vs ${createTeams[1]} — first to win the majority takes the series.`}
                badge={null}
                extra={
                  createFormat === 'series' && (
                    <div className="mt-3 flex gap-2">
                      {([3, 5] as const).map((n) => (
                        <button
                          key={n}
                          onClick={(e) => { e.stopPropagation(); setCreateSeriesLength(n) }}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${
                            createSeriesLength === n
                              ? 'border-green-500 bg-green-900/40 text-green-300'
                              : 'border-gray-600 text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          Best of {n}
                        </button>
                      ))}
                    </div>
                  )
                }
              />
            )}

            {availableFormats.includes('elimination') && (
              <FormatCard
                selected={createFormat === 'elimination'}
                onClick={() => setCreateFormat('elimination')}
                emoji="🏆"
                title="Knockout (Elimination)"
                description={`Single elimination bracket. ${createTeams.length} teams → bracket of ${Math.pow(2, Math.ceil(Math.log2(Math.max(createTeams.length, 2))))} (byes added if needed).`}
                badge="Win or go home"
              />
            )}

            <button className="btn-primary w-full mt-2" onClick={() => setStep(4)} disabled={!canNext3}>Next: Review →</button>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="card space-y-3">
              <ReviewRow label="Name" value={createName} />
              <ReviewRow label="Overs" value={`${createOvers} overs per innings`} />
              <ReviewRow label="Teams" value={createTeams.join(', ')} />
              <ReviewRow
                label="Format"
                value={
                  createFormat === 'league' ? 'League (Round Robin)' :
                  createFormat === 'series' ? `Series — Best of ${createSeriesLength}` :
                  'Knockout (Elimination)'
                }
              />
              <ReviewRow label="Fixtures" value={fixturePreview} />
            </div>

            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setStep(3)}>← Back</button>
              <button className="btn-primary flex-1" onClick={handleCreate}>🚀 Create Tournament</button>
            </div>
          </div>
        )}
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
          onClick={() => { resetCreate(); setView('create') }}
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
          <p className="text-gray-500 text-sm mb-5">Create a league, series, or knockout bracket.</p>
          <button className="btn-primary" onClick={() => { resetCreate(); setView('create') }}>+ Create Tournament</button>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => {
            const played = t.matches.filter((m) => m.result).length
            const fmt = t.format ?? 'league'
            const fmtLabel = fmt === 'league' ? '📋 League' : fmt === 'series' ? `🔁 Best of ${t.seriesLength ?? 3}` : '🏆 Knockout'
            let subtitle = ''
            if (fmt === 'league') {
              const standings = computeStandings(t)
              const leader = standings[0]
              subtitle = leader && leader.played > 0 ? `🥇 ${leader.team} — ${leader.points} pts` : ''
            } else if (fmt === 'series') {
              const sr = computeSeriesResult(t)
              subtitle = sr.winner ? `🏆 ${sr.winner} won the series` : `${sr.winsA}–${sr.winsB} in games`
            } else {
              const final = t.matches.find((m) => m.round === 'Final' && m.result)
              if (final) {
                const w = final.result === 'A' ? final.teamA : final.result === 'B' ? final.teamB : null
                subtitle = w ? `🏆 ${w} won` : ''
              }
            }
            return (
              <button
                key={t.id}
                className="w-full card text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => { setSelectedId(t.id); setView('detail') }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{fmt === 'series' ? '🔁' : fmt === 'elimination' ? '🏆' : '📋'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{t.name}</p>
                    <p className="text-xs text-gray-400">{fmtLabel} · {t.teams.length} teams · {t.overs} ov · {played}/{t.matches.length} played</p>
                    {subtitle && <p className="text-xs text-yellow-500 dark:text-yellow-400 mt-1">{subtitle}</p>}
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

// ─── Sub-components ────────────────────────────────────────────────────────

function FormatCard({
  selected, onClick, emoji, title, description, badge, extra,
}: {
  selected: boolean
  onClick: () => void
  emoji: string
  title: string
  description: string
  badge: string | null
  extra?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-2 p-4 transition-colors ${
        selected
          ? 'border-green-500 bg-green-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{emoji}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm text-gray-900 dark:text-white">{title}</p>
            {badge && <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{badge}</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          {extra}
        </div>
        {selected && <span className="text-green-500 text-lg">✓</span>}
      </div>
    </button>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-gray-500 uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-sm text-right text-gray-900 dark:text-white font-medium">{value}</span>
    </div>
  )
}

function LeagueDetail({ t, onEnterResult }: { t: Tournament; onEnterResult: (m: TournamentMatch) => void }) {
  const standings = computeStandings(t)
  return (
    <>
      <div className="card mb-4">
        <p className="text-sm font-bold text-gray-300 mb-3">📊 Points Table</p>
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
      <FixtureList matches={t.matches} onEnterResult={onEnterResult} />
    </>
  )
}

function SeriesDetail({ t, onEnterResult }: { t: Tournament; onEnterResult: (m: TournamentMatch) => void }) {
  const sr = computeSeriesResult(t)
  const needed = Math.ceil((t.seriesLength ?? 3) / 2)

  return (
    <>
      {/* Series scoreboard */}
      <div className="card mb-4 text-center">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Series Score</p>
        <div className="flex items-center justify-center gap-6">
          <div className={`flex-1 ${sr.winner === sr.teamA ? 'text-green-400' : ''}`}>
            <p className="font-bold text-lg">{sr.teamA}</p>
            <p className="text-4xl font-black mt-1">{sr.winsA}</p>
          </div>
          <div className="text-gray-500 font-bold text-xl">vs</div>
          <div className={`flex-1 ${sr.winner === sr.teamB ? 'text-green-400' : ''}`}>
            <p className="font-bold text-lg">{sr.teamB}</p>
            <p className="text-4xl font-black mt-1">{sr.winsB}</p>
          </div>
        </div>
        {sr.winner ? (
          <div className="mt-3 bg-green-900/30 border border-green-700/50 rounded-xl py-2 px-4">
            <p className="text-green-300 font-bold">🏆 {sr.winner} wins the series!</p>
          </div>
        ) : (
          <p className="text-xs text-gray-500 mt-3">First to {needed} wins takes the series</p>
        )}
      </div>

      {/* Game list — only show games up to the point series is decided */}
      <div className="space-y-2">
        <p className="text-sm font-bold text-gray-300 mb-2">Games</p>
        {t.matches.map((m) => {
          const done = !!m.result
          const winnerName = m.result === 'A' ? m.teamA : m.result === 'B' ? m.teamB : null
          // Grey out games after series is decided
          const seriesOver = sr.winner !== null
          const gameDecisive = m.gameNumber !== undefined && sr.winner !== null &&
            ((sr.winsA >= needed && m.result === 'A') || (sr.winsB >= needed && m.result === 'B'))
          return (
            <div key={m.id} className={`card py-3 ${seriesOver && !done ? 'opacity-40' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Game {m.gameNumber}</p>
                  {done ? (
                    <p className="text-sm font-semibold">
                      {m.result === 'tie' && <span className="text-yellow-400">🤝 Tied</span>}
                      {m.result === 'no_result' && <span className="text-gray-400">🚫 No Result</span>}
                      {winnerName && <span className={gameDecisive ? 'text-green-300' : 'text-green-400'}>🏆 {winnerName}{gameDecisive ? ' — Series won!' : ''}</span>}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">Not played</p>
                  )}
                </div>
                {!seriesOver && (
                  <button
                    onClick={() => onEnterResult(m)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                      done ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-green-700 hover:bg-green-600 text-white'
                    }`}
                  >
                    {done ? 'Edit' : 'Add Result'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function EliminationDetail({ t, onEnterResult }: { t: Tournament; onEnterResult: (m: TournamentMatch) => void }) {
  const rounds = useMemo(() => {
    const map: Record<number, TournamentMatch[]> = {}
    for (const m of t.matches) {
      const r = m.roundIndex ?? 0
      if (!map[r]) map[r] = []
      map[r].push(m)
    }
    return Object.entries(map)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, matches]) => matches)
  }, [t.matches])

  return (
    <div className="space-y-5">
      {rounds.map((roundMatches, ri) => {
        const roundName = roundMatches[0]?.round ?? `Round ${ri + 1}`
        return (
          <div key={ri}>
            <p className="text-sm font-bold text-gray-300 mb-2">{roundName}</p>
            <div className="space-y-2">
              {roundMatches.map((m) => {
                const isTBD = m.teamA === 'TBD' || m.teamB === 'TBD'
                const done = !!m.result
                const winnerName = m.result === 'A' ? m.teamA : m.result === 'B' ? m.teamB : null
                const isBye = (m.teamA === 'BYE' || m.teamB === 'BYE') && done
                return (
                  <div key={m.id} className={`card py-3 ${isTBD ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">
                          {isTBD ? (
                            <span className="text-gray-500">
                              {m.teamALabel ?? m.teamA} <span className="text-gray-600">vs</span> {m.teamBLabel ?? m.teamB}
                            </span>
                          ) : (
                            <>
                              <span className={done && m.result === 'A' ? 'text-green-400' : ''}>{m.teamA}</span>
                              {' '}<span className="text-gray-500">vs</span>{' '}
                              <span className={done && m.result === 'B' ? 'text-green-400' : ''}>{m.teamB}</span>
                            </>
                          )}
                        </p>
                        {done && !isBye && (
                          <p className="text-xs mt-0.5">
                            {m.result === 'tie' && <span className="text-yellow-400">🤝 Tied</span>}
                            {m.result === 'no_result' && <span className="text-gray-400">🚫 No Result</span>}
                            {winnerName && <span className="text-green-400">🏆 {winnerName} advances</span>}
                          </p>
                        )}
                        {isBye && <p className="text-xs text-gray-500 mt-0.5">Bye — auto-advance</p>}
                      </div>
                      {!isTBD && !isBye && (
                        <button
                          onClick={() => onEnterResult(m)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                            done ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-green-700 hover:bg-green-600 text-white'
                          }`}
                        >
                          {done ? 'Edit' : 'Add Result'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FixtureList({ matches, onEnterResult }: { matches: TournamentMatch[]; onEnterResult: (m: TournamentMatch) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-gray-300 mb-2">Fixtures</p>
      {matches.map((m) => {
        const done = !!m.result
        const winnerName = m.result === 'A' ? m.teamA : m.result === 'B' ? m.teamB : null
        return (
          <div key={m.id} className="card py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{m.teamA} <span className="text-gray-500">vs</span> {m.teamB}</p>
                {done && (
                  <p className="text-xs mt-0.5">
                    {m.result === 'tie' && <span className="text-yellow-400">🤝 Tied</span>}
                    {m.result === 'no_result' && <span className="text-gray-400">🚫 No Result</span>}
                    {winnerName && <span className="text-green-400">🏆 {winnerName} won</span>}
                    {m.runsA !== undefined && m.runsB !== undefined && (
                      <span className="text-gray-500 ml-2">· {m.runsA} vs {m.runsB}</span>
                    )}
                  </p>
                )}
              </div>
              <button
                onClick={() => onEnterResult(m)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  done ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-green-700 hover:bg-green-600 text-white'
                }`}
              >
                {done ? 'Edit' : 'Add Result'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
