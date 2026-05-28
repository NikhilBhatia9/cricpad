import { supabase } from '../config/supabase'
import type { Match } from '../types/cricket'
import type { PlayerRecord, MatchRecord, PlayerMatchStat, CareerBatting, CareerBowling, CareerFielding, LeaderboardEntry } from './types'
import { computeMvp } from '../utils/mvp'

// ─── Row mappers (DB snake_case → TS camelCase) ────────────────────────────

function rowToPlayer(r: Record<string, unknown>): PlayerRecord {
  return {
    name: r.name as string,
    firstSeenAt: r.first_seen_at as string,
    lastSeenAt: r.last_seen_at as string,
    totalMatches: r.total_matches as number,
  }
}

function rowToMatch(r: Record<string, unknown>): MatchRecord {
  return {
    id: r.id as string,
    teamAName: r.team_a_name as string,
    teamBName: r.team_b_name as string,
    result: r.result as string,
    maxOvers: r.max_overs as number,
    completedAt: r.completed_at as string,
    snapshot: r.snapshot as string,
  }
}

function rowToStat(r: Record<string, unknown>): PlayerMatchStat {
  return {
    id: r.id as number,
    matchId: r.match_id as string,
    playerName: r.player_name as string,
    teamName: r.team_name as string,
    opponent: r.opponent as string,
    matchDate: r.match_date as string,
    batRuns: r.bat_runs as number,
    batBalls: r.bat_balls as number,
    batFours: r.bat_fours as number,
    batSixes: r.bat_sixes as number,
    batIsOut: r.bat_is_out as boolean,
    batWicketType: r.bat_wicket_type as string | undefined,
    batDidBat: r.bat_did_bat as boolean,
    bowlLegalBalls: r.bowl_legal_balls as number,
    bowlRunsConceded: r.bowl_runs_conceded as number,
    bowlWickets: r.bowl_wickets as number,
    bowlWides: r.bowl_wides as number,
    bowlNoBalls: r.bowl_no_balls as number,
    bowlMaidens: r.bowl_maidens as number,
    bowlDidBowl: r.bowl_did_bowl as boolean,
    fieldCatches: (r.field_catches as number) ?? 0,
    fieldRunOuts: (r.field_runouts as number) ?? 0,
    fieldStumpings: (r.field_stumpings as number) ?? 0,
    isMvp: (r.is_mvp as boolean) ?? false,
  }
}

// ─── Query helpers (replaces useLiveQuery) ─────────────────────────────────

export async function fetchAllPlayers(): Promise<PlayerRecord[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('total_matches', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToPlayer)
}

export async function fetchPlayer(name: string): Promise<PlayerRecord | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('name', name)
    .maybeSingle()
  if (error) throw error
  return data ? rowToPlayer(data) : null
}

export async function fetchAllMatches(): Promise<MatchRecord[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('completed_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToMatch)
}

export async function fetchMatch(id: string): Promise<MatchRecord | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? rowToMatch(data) : null
}

export async function fetchPlayerStats(playerName: string): Promise<PlayerMatchStat[]> {
  const { data, error } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_name', playerName)
  if (error) throw error
  return (data ?? []).map(rowToStat)
}

export async function fetchMatchesByIds(ids: string[]): Promise<MatchRecord[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .in('id', ids)
    .order('completed_at', { ascending: false })
    .limit(10)
  if (error) throw error
  return (data ?? []).map(rowToMatch)
}

// Lightweight: fetch only id+result for a set of match IDs (no limit)
// Fetch full match snapshots for comparison / ball-level analysis
export async function fetchMatchSnapshotsByIds(ids: string[]): Promise<Record<string, Match>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabase
    .from('matches')
    .select('id, snapshot')
    .in('id', ids)
  if (error) throw error
  const map: Record<string, Match> = {}
  for (const r of (data ?? [])) {
    try { map[r.id as string] = JSON.parse(r.snapshot as string) as Match } catch { /* skip malformed */ }
  }
  return map
}

export async function fetchMatchResultsMap(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabase
    .from('matches')
    .select('id, result')
    .in('id', ids)
  if (error) throw error
  const map: Record<string, string> = {}
  for (const r of (data ?? [])) map[r.id as string] = r.result as string
  return map
}

export function computeCareerRecord(
  stats: PlayerMatchStat[],
  matchResults: Record<string, string>
): { wins: number; losses: number; ties: number } {
  const matchIds = [...new Set(stats.map((s) => s.matchId))]
  return matchIds.reduce(
    (acc, matchId) => {
      const result = matchResults[matchId]
      if (!result) return acc
      const playerStat = stats.find((s) => s.matchId === matchId)
      if (!playerStat) return acc
      const r = result.toLowerCase()
      if (r.includes('tied') || r.includes('tie')) return { ...acc, ties: acc.ties + 1 }
      if (result.startsWith(playerStat.teamName)) return { ...acc, wins: acc.wins + 1 }
      return { ...acc, losses: acc.losses + 1 }
    },
    { wins: 0, losses: 0, ties: 0 }
  )
}

// ─── Save match ─────────────────────────────────────────────────────────────

export async function saveMatch(match: Match): Promise<void> {
  // Idempotent — skip if already saved
  const existing = await fetchMatch(match.id)
  if (existing) return

  const completedAt = new Date().toISOString()

  await supabase.from('matches').upsert({
    id: match.id,
    team_a_name: match.teams[0].name,
    team_b_name: match.teams[1].name,
    result: match.result ?? '',
    max_overs: match.maxOvers,
    completed_at: completedAt,
    snapshot: JSON.stringify(match),
  })

  // Upsert all players — deduplicate shared players
  const uniqueNames = [...new Set([...match.teams[0].players, ...match.teams[1].players].map((p) => p.name))]
  for (const name of uniqueNames) {
    const existing = await fetchPlayer(name)
    if (existing) {
      await supabase
        .from('players')
        .update({ last_seen_at: completedAt, total_matches: existing.totalMatches + 1 })
        .eq('name', name)
    } else {
      await supabase.from('players').insert({
        name,
        first_seen_at: completedAt,
        last_seen_at: completedAt,
        total_matches: 1,
      })
    }
  }

  // Build per-player stats
  const statsToAdd: Record<string, unknown>[] = []

  // Compute MVP
  const mvp = computeMvp(match)
  const mvpName = mvp?.name ?? null

  for (const innings of match.innings) {
    if (!innings) continue
    const battingTeam = match.teams[innings.battingTeamIndex]
    const fieldingTeamIndex: 0 | 1 = innings.battingTeamIndex === 0 ? 1 : 0
    const fieldingTeam = match.teams[fieldingTeamIndex]

    // Build fielding lookup for this innings
    const fielderStats: Record<string, { catches: number; runOuts: number; stumpings: number }> = {}
    for (const [id, f] of Object.entries(innings.fielders ?? {})) {
      fielderStats[id] = { catches: f.catches, runOuts: f.runOuts, stumpings: f.stumpings }
    }

    for (const b of Object.values(innings.batsmen)) {
      statsToAdd.push({
        match_id: match.id, player_name: b.name, team_name: battingTeam.name,
        opponent: fieldingTeam.name, match_date: completedAt,
        bat_runs: b.runs, bat_balls: b.balls, bat_fours: b.fours, bat_sixes: b.sixes,
        bat_is_out: b.isOut, bat_wicket_type: b.wicketType ?? null, bat_did_bat: true,
        bowl_legal_balls: 0, bowl_runs_conceded: 0, bowl_wickets: 0,
        bowl_wides: 0, bowl_no_balls: 0, bowl_maidens: 0, bowl_did_bowl: false,
        field_catches: 0, field_runouts: 0, field_stumpings: 0,
        is_mvp: b.name === mvpName,
      })
    }

    const maidensByBowler: Record<string, number> = {}
    for (const over of innings.overs) {
      const legalBalls = over.balls.filter((b) => b.isLegal).length
      if (legalBalls >= 6) {
        const conceded = over.balls.reduce((sum, b) => {
          if (b.extraType === 'bye' || b.extraType === 'legbye') return sum
          return sum + b.runsOffBat + b.extras
        }, 0)
        if (conceded === 0) {
          maidensByBowler[over.bowlerId] = (maidensByBowler[over.bowlerId] ?? 0) + 1
        }
      }
    }

    for (const b of Object.values(innings.bowlers)) {
      // Find player id to look up fielding
      const player = fieldingTeam.players.find((p) => p.name === b.name)
      const fs = player ? (fielderStats[player.id] ?? { catches: 0, runOuts: 0, stumpings: 0 }) : { catches: 0, runOuts: 0, stumpings: 0 }
      statsToAdd.push({
        match_id: match.id, player_name: b.name, team_name: fieldingTeam.name,
        opponent: battingTeam.name, match_date: completedAt,
        bat_runs: 0, bat_balls: 0, bat_fours: 0, bat_sixes: 0,
        bat_is_out: false, bat_wicket_type: null, bat_did_bat: false,
        bowl_legal_balls: b.legalBalls, bowl_runs_conceded: b.runsConceded,
        bowl_wickets: b.wickets, bowl_wides: b.wides, bowl_no_balls: b.noBalls,
        bowl_maidens: maidensByBowler[b.playerId] ?? 0,
        bowl_did_bowl: true,
        field_catches: fs.catches, field_runouts: fs.runOuts, field_stumpings: fs.stumpings,
        is_mvp: b.name === mvpName,
      })
    }
  }

  if (statsToAdd.length > 0) {
    await supabase.from('player_stats').insert(statsToAdd)
  }
}

export async function renamePlayer(oldName: string, newName: string): Promise<{ error: string | null }> {
  const trimmed = newName.trim()
  if (!trimmed) return { error: 'Name cannot be empty' }
  if (trimmed === oldName) return { error: null } // no-op

  // Check for duplicate
  const existing = await fetchPlayer(trimmed)
  if (existing) return { error: 'A player with that name already exists' }

  // Rename in players table
  const { error: playerErr } = await supabase
    .from('players')
    .update({ name: trimmed })
    .eq('name', oldName)
  if (playerErr) return { error: playerErr.message }

  // Cascade rename to all player_stats rows
  const { error: statsErr } = await supabase
    .from('player_stats')
    .update({ player_name: trimmed })
    .eq('player_name', oldName)
  if (statsErr) return { error: statsErr.message }

  return { error: null }
}


export function computeCareerBatting(stats: PlayerMatchStat[]): CareerBatting {
  const bat = stats.filter((s) => s.batDidBat)
  const totalRuns = bat.reduce((sum, s) => sum + s.batRuns, 0)
  const innings = bat.length
  const notOuts = bat.filter((s) => !s.batIsOut).length
  const dismissals = innings - notOuts
  const highestScore = bat.length > 0 ? Math.max(...bat.map((s) => s.batRuns)) : 0
  const average = dismissals > 0 ? (totalRuns / dismissals).toFixed(1) : totalRuns > 0 ? '\u221e' : '-'
  const totalBalls = bat.reduce((sum, s) => sum + s.batBalls, 0)
  const strikeRate = totalBalls > 0 ? ((totalRuns / totalBalls) * 100).toFixed(1) : '-'
  return {
    matches: new Set(bat.map((s) => s.matchId)).size,
    innings, notOuts, totalRuns, highestScore, average, strikeRate,
    fifties: bat.filter((s) => s.batRuns >= 50 && s.batRuns < 100).length,
    hundreds: bat.filter((s) => s.batRuns >= 100).length,
    fours: bat.reduce((sum, s) => sum + s.batFours, 0),
    sixes: bat.reduce((sum, s) => sum + s.batSixes, 0),
    mvpWins: new Set(stats.filter((s) => s.isMvp).map((s) => s.matchId)).size,
  }
}

export function computeCareerFielding(stats: PlayerMatchStat[]): CareerFielding {
  const catches = stats.reduce((sum, s) => sum + (s.fieldCatches ?? 0), 0)
  const runOuts = stats.reduce((sum, s) => sum + (s.fieldRunOuts ?? 0), 0)
  const stumpings = stats.reduce((sum, s) => sum + (s.fieldStumpings ?? 0), 0)
  return { catches, runOuts, stumpings, total: catches + runOuts + stumpings }
}

export function computeCareerBowling(stats: PlayerMatchStat[]): CareerBowling {
  const bowl = stats.filter((s) => s.bowlDidBowl)
  const legalBalls = bowl.reduce((sum, s) => sum + s.bowlLegalBalls, 0)
  const runsConceded = bowl.reduce((sum, s) => sum + s.bowlRunsConceded, 0)
  const wickets = bowl.reduce((sum, s) => sum + s.bowlWickets, 0)
  const maidens = bowl.reduce((sum, s) => sum + (s.bowlMaidens ?? 0), 0)
  const economy = legalBalls > 0 ? ((runsConceded / legalBalls) * 6).toFixed(2) : '-'
  const average = wickets > 0 ? (runsConceded / wickets).toFixed(1) : '-'
  const strikeRate = wickets > 0 ? (legalBalls / wickets).toFixed(1) : '-'
  const best = bowl.reduce(
    (b, s) => {
      if (s.bowlWickets > b.w || (s.bowlWickets === b.w && s.bowlRunsConceded < b.r))
        return { w: s.bowlWickets, r: s.bowlRunsConceded }
      return b
    },
    { w: 0, r: 0 }
  )
  return {
    matches: new Set(bowl.map((s) => s.matchId)).size,
    legalBalls, runsConceded, wickets, maidens, economy, average, strikeRate,
    bestWickets: best.w, bestRuns: best.r,
  }
}

function calcRowPoints(r: Record<string, unknown>): number {
  let pts = 0
  const batDidBat = !!r.bat_did_bat
  const bowlDidBowl = !!r.bowl_did_bowl
  const batRuns = (r.bat_runs as number) || 0
  const batBalls = (r.bat_balls as number) || 0
  const batFours = (r.bat_fours as number) || 0
  const batSixes = (r.bat_sixes as number) || 0
  const batIsOut = !!r.bat_is_out
  const bowlWickets = (r.bowl_wickets as number) || 0
  const bowlLegalBalls = (r.bowl_legal_balls as number) || 0
  const bowlRunsConceded = (r.bowl_runs_conceded as number) || 0
  const bowlMaidens = (r.bowl_maidens as number) || 0

  if (batDidBat) {
    pts += batRuns + batFours * 2 + batSixes * 3
    if (batBalls >= 10) {
      const sr = (batRuns / batBalls) * 100
      if (sr > 150) pts += 20
      else if (sr > 120) pts += 10
      else if (sr < 60) pts -= 5
    }
    if (batRuns >= 100) pts += 50
    else if (batRuns >= 50) pts += 25
    else if (batRuns >= 25) pts += 15
    if (!batIsOut) pts += 5
  }

  if (bowlDidBowl && bowlLegalBalls > 0) {
    pts += bowlWickets * 20
    if (bowlWickets >= 3) pts += 20
    else if (bowlWickets >= 2) pts += 10
    if (bowlLegalBalls >= 6) {
      const eco = (bowlRunsConceded / bowlLegalBalls) * 6
      if (eco < 6) pts += 15
      else if (eco < 8) pts += 8
      else if (eco > 14) pts -= 10
    }
    pts += bowlMaidens * 10
  }

  return Math.max(0, pts)
}

export async function fetchLeaderboard(since?: string): Promise<LeaderboardEntry[]> {
  let query = supabase
    .from('player_stats')
    .select('player_name, is_mvp, bat_runs, bat_balls, bat_fours, bat_sixes, bat_is_out, bat_did_bat, bowl_wickets, bowl_legal_balls, bowl_runs_conceded, bowl_maidens, bowl_did_bowl, match_id, match_date')
  if (since) query = query.gte('match_date', since)
  const { data, error } = await query
  if (error) throw error

  const map: Record<string, { mvpMatchIds: Set<string>; totalMvpPoints: number; totalRuns: number; totalWickets: number; matchIds: Set<string> }> = {}
  for (const r of (data ?? [])) {
    const name = r.player_name as string
    if (!map[name]) map[name] = { mvpMatchIds: new Set(), totalMvpPoints: 0, totalRuns: 0, totalWickets: 0, matchIds: new Set() }
    map[name].matchIds.add(r.match_id as string)
    if (r.is_mvp) map[name].mvpMatchIds.add(r.match_id as string)
    if (r.bat_did_bat) map[name].totalRuns += (r.bat_runs as number) || 0
    map[name].totalWickets += (r.bowl_wickets as number) || 0
    map[name].totalMvpPoints += calcRowPoints(r as Record<string, unknown>)
  }

  return Object.entries(map)
    .map(([playerName, s]) => ({
      playerName,
      mvpWins: s.mvpMatchIds.size,
      totalMvpPoints: s.totalMvpPoints,
      totalRuns: s.totalRuns,
      totalWickets: s.totalWickets,
      matches: s.matchIds.size,
    }))
    .sort((a, b) => (b.mvpWins !== a.mvpWins ? b.mvpWins - a.mvpWins : b.totalMvpPoints - a.totalMvpPoints))
}
