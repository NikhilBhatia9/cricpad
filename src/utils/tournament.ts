import { v4 as uuidv4 } from 'uuid'
import { fetchTournaments, upsertTournamentRecord, deleteTournamentRecord } from '../db/operations'

export interface TournamentMatch {
  id: string
  teamA: string
  teamB: string
  result?: 'A' | 'B' | 'tie' | 'no_result'
  runsA?: number
  ballsFacedA?: number
  runsB?: number
  ballsFacedB?: number
  playedAt?: string
}

export interface Tournament {
  id: string
  name: string
  teams: string[]
  overs: number
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
    return await fetchTournaments()
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

export function generateFixtures(teams: string[]): TournamentMatch[] {
  const matches: TournamentMatch[] = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({ id: uuidv4(), teamA: teams[i], teamB: teams[j] })
    }
  }
  return matches
}

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
