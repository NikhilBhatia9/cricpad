import { v4 as uuidv4 } from 'uuid'
import { fetchTournaments, upsertTournamentRecord, deleteTournamentRecord } from '../db/operations'

export type TournamentFormat = 'league' | 'series' | 'elimination'

export interface TournamentMatch {
  id: string
  teamA: string
  teamB: string
  /** Display label when team is TBD (elimination) */
  teamALabel?: string
  teamBLabel?: string
  result?: 'A' | 'B' | 'tie' | 'no_result'
  runsA?: number
  ballsFacedA?: number
  runsB?: number
  ballsFacedB?: number
  playedAt?: string
  /** Series: game number within the series (1-indexed) */
  gameNumber?: number
  /** Elimination: round name e.g. "Quarterfinal" */
  round?: string
  /** Elimination: 0-indexed round level */
  roundIndex?: number
  /** Elimination: 0-indexed position within this round */
  matchIndex?: number
}

export interface Tournament {
  id: string
  name: string
  teams: string[]
  overs: number
  format: TournamentFormat
  /** Series only: 3 or 5 */
  seriesLength?: 3 | 5
  matches: TournamentMatch[]
  createdAt: string
  updatedAt: string
}

export interface TeamStanding {
  team: string
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
  points: number
  nrr: number
  runsFor: number
  oversFor: number
  runsAgainst: number
  oversAgainst: number
}

export interface SeriesResult {
  winsA: number
  winsB: number
  teamA: string
  teamB: string
  winner: string | null
  complete: boolean
}

// ─── Supabase persistence ──────────────────────────────────────────────────

const LEGACY_KEY = 'cricket_tournaments'

async function migrateFromLocalStorage(): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return
    const local: Tournament[] = JSON.parse(raw)
    if (!local.length) return
    const remote = await fetchTournaments()
    if (remote.length > 0) {
      localStorage.removeItem(LEGACY_KEY)
      return
    }
    for (const t of local) {
      await upsertTournamentRecord(t)
    }
    localStorage.removeItem(LEGACY_KEY)
  } catch (e) {
    console.error('[tournaments] migration failed:', e)
  }
}

export async function getTournaments(): Promise<Tournament[]> {
  try {
    await migrateFromLocalStorage()
    const records = await fetchTournaments()
    // Back-compat: old records missing format default to league
    return records.map((t) => ({ format: 'league' as TournamentFormat, ...t }))
  } catch (e) {
    console.error('[tournaments] fetch failed:', e)
    return []
  }
}

export async function upsertTournament(t: Tournament): Promise<void> {
  return upsertTournamentRecord(t)
}

export async function deleteTournament(id: string): Promise<void> {
  return deleteTournamentRecord(id)
}

// ─── Fixture generators ────────────────────────────────────────────────────

export function generateLeagueFixtures(teams: string[]): TournamentMatch[] {
  const matches: TournamentMatch[] = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({ id: uuidv4(), teamA: teams[i], teamB: teams[j] })
    }
  }
  return matches
}

export function generateSeriesFixtures(teamA: string, teamB: string, length: 3 | 5): TournamentMatch[] {
  return Array.from({ length }, (_, i) => ({
    id: uuidv4(),
    teamA,
    teamB,
    gameNumber: i + 1,
  }))
}

const ROUND_NAMES = ['Final', 'Semifinal', 'Quarterfinal', 'Round of 16']

function getRoundName(totalRounds: number, roundIndex: number): string {
  // roundIndex 0 = first round, totalRounds-1 = final
  const fromEnd = totalRounds - 1 - roundIndex
  return ROUND_NAMES[fromEnd] ?? `Round ${roundIndex + 1}`
}

export function generateEliminationFixtures(teams: string[]): TournamentMatch[] {
  const n = teams.length
  // Pad to next power of 2
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(n, 2))))
  const totalRounds = Math.log2(size)

  // Standard bracket seeding: 1v(size), 2v(size-1), etc.
  const seeds: (string | null)[] = [...teams]
  while (seeds.length < size) seeds.push(null) // nulls = byes

  const matches: TournamentMatch[] = []

  // Round 0: seed pairings
  const round0Name = getRoundName(totalRounds, 0)
  for (let i = 0; i < size / 2; i++) {
    const teamA = seeds[i] ?? 'BYE'
    const teamB = seeds[size - 1 - i] ?? 'BYE'
    const m: TournamentMatch = {
      id: uuidv4(),
      teamA,
      teamB,
      round: round0Name,
      roundIndex: 0,
      matchIndex: i,
    }
    // Auto-result byes
    if (teamA === 'BYE') m.result = 'B'
    if (teamB === 'BYE') m.result = 'A'
    matches.push(m)
  }

  // Later rounds: placeholder matches
  for (let r = 1; r < totalRounds; r++) {
    const matchesInRound = size / Math.pow(2, r + 1)
    const roundName = getRoundName(totalRounds, r)
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        id: uuidv4(),
        teamA: 'TBD',
        teamB: 'TBD',
        teamALabel: `Winner of ${getRoundName(totalRounds, r - 1)} ${i * 2 + 1}`,
        teamBLabel: `Winner of ${getRoundName(totalRounds, r - 1)} ${i * 2 + 2}`,
        round: roundName,
        roundIndex: r,
        matchIndex: i,
      })
    }
  }

  return matches
}

// ─── Logic helpers ─────────────────────────────────────────────────────────

/** After saving a result in an elimination tournament, advance the winner to the next round */
export function advanceEliminationWinner(tournament: Tournament, matchId: string): Tournament {
  const match = tournament.matches.find((m) => m.id === matchId)
  if (!match || match.result == null || match.roundIndex === undefined || match.matchIndex === undefined) {
    return tournament
  }
  const winner = match.result === 'A' ? match.teamA : match.result === 'B' ? match.teamB : null
  if (!winner) return tournament // tie/no_result — cannot advance

  const nextRoundIndex = match.roundIndex + 1
  const nextMatchIndex = Math.floor(match.matchIndex / 2)
  const slot: 'A' | 'B' = match.matchIndex % 2 === 0 ? 'A' : 'B'

  const updatedMatches = tournament.matches.map((m) => {
    if (m.roundIndex !== nextRoundIndex || m.matchIndex !== nextMatchIndex) return m
    return slot === 'A'
      ? { ...m, teamA: winner, teamALabel: undefined }
      : { ...m, teamB: winner, teamBLabel: undefined }
  })

  return { ...tournament, matches: updatedMatches }
}

/** Compute series score for a series-format tournament */
export function computeSeriesResult(tournament: Tournament): SeriesResult {
  const teamA = tournament.teams[0] ?? ''
  const teamB = tournament.teams[1] ?? ''
  const needed = Math.ceil((tournament.seriesLength ?? 3) / 2)
  let winsA = 0
  let winsB = 0

  for (const m of tournament.matches) {
    if (m.result === 'A') winsA++
    else if (m.result === 'B') winsB++
  }

  const winner = winsA >= needed ? teamA : winsB >= needed ? teamB : null
  return { winsA, winsB, teamA, teamB, winner, complete: winner !== null }
}

/** Compute league standings */
export function computeStandings(t: Tournament): TeamStanding[] {
  const map: Record<string, TeamStanding> = {}
  for (const team of t.teams) {
    map[team] = { team, played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0, nrr: 0, runsFor: 0, oversFor: 0, runsAgainst: 0, oversAgainst: 0 }
  }

  for (const m of t.matches) {
    if (!m.result) continue
    const a = map[m.teamA]
    const b = map[m.teamB]
    if (!a || !b) continue

    a.played++
    b.played++

    if (m.result === 'A') {
      a.won++; b.lost++; a.points += 2
    } else if (m.result === 'B') {
      b.won++; a.lost++; b.points += 2
    } else if (m.result === 'tie') {
      a.tied++; b.tied++; a.points++; b.points++
    } else {
      a.noResult++; b.noResult++; a.points++; b.points++
    }

    if (m.runsA !== undefined && m.runsB !== undefined) {
      const ovA = (m.ballsFacedA ?? t.overs * 6) / 6
      const ovB = (m.ballsFacedB ?? t.overs * 6) / 6
      a.runsFor += m.runsA; a.oversFor += ovA
      a.runsAgainst += m.runsB; a.oversAgainst += ovB
      b.runsFor += m.runsB; b.oversFor += ovB
      b.runsAgainst += m.runsA; b.oversAgainst += ovA
    }
  }

  return Object.values(map)
    .map((s) => ({
      ...s,
      nrr: s.oversFor > 0 && s.oversAgainst > 0
        ? parseFloat(((s.runsFor / s.oversFor) - (s.runsAgainst / s.oversAgainst)).toFixed(3))
        : 0,
    }))
    .sort((a, b) => b.points - a.points || b.nrr - a.nrr)
}

/** @deprecated use generateLeagueFixtures */
export const generateFixtures = generateLeagueFixtures
