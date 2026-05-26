import { db } from './database'
import type { Match } from '../types/cricket'
import type { PlayerMatchStat, CareerBatting, CareerBowling } from './types'

export async function saveMatch(match: Match): Promise<void> {
  // Idempotent — skip if already saved
  const existing = await db.matches.get(match.id)
  if (existing) return

  const completedAt = new Date().toISOString()

  await db.matches.put({
    id: match.id,
    teamAName: match.teams[0].name,
    teamBName: match.teams[1].name,
    result: match.result ?? '',
    maxOvers: match.maxOvers,
    completedAt,
    snapshot: JSON.stringify(match),
  })

  // Upsert all players — deduplicate by name so shared players aren't double-counted
  const uniqueNames = [...new Set([...match.teams[0].players, ...match.teams[1].players].map((p) => p.name))]
  for (const name of uniqueNames) {
    const existing = await db.players.get(name)
    if (existing) {
      await db.players.update(name, {
        lastSeenAt: completedAt,
        totalMatches: existing.totalMatches + 1,
      })
    } else {
      await db.players.put({ name, firstSeenAt: completedAt, lastSeenAt: completedAt, totalMatches: 1 })
    }
  }

  // Save per-player stats per innings
  const statsToAdd: Omit<PlayerMatchStat, 'id'>[] = []

  for (const innings of match.innings) {
    if (!innings) continue
    const battingTeam = match.teams[innings.battingTeamIndex]
    const fieldingTeamIndex: 0 | 1 = innings.battingTeamIndex === 0 ? 1 : 0
    const fieldingTeam = match.teams[fieldingTeamIndex]

    // Batting records
    for (const b of Object.values(innings.batsmen)) {
      statsToAdd.push({
        matchId: match.id, playerName: b.name, teamName: battingTeam.name,
        opponent: fieldingTeam.name, matchDate: completedAt,
        batRuns: b.runs, batBalls: b.balls, batFours: b.fours, batSixes: b.sixes,
        batIsOut: b.isOut, batWicketType: b.wicketType, batDidBat: true,
        bowlLegalBalls: 0, bowlRunsConceded: 0, bowlWickets: 0,
        bowlWides: 0, bowlNoBalls: 0, bowlDidBowl: false,
      })
    }

    // Compute maiden count per bowler from completed overs
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

    // Bowling records
    for (const b of Object.values(innings.bowlers)) {
      statsToAdd.push({
        matchId: match.id, playerName: b.name, teamName: fieldingTeam.name,
        opponent: battingTeam.name, matchDate: completedAt,
        batRuns: 0, batBalls: 0, batFours: 0, batSixes: 0,
        batIsOut: false, batDidBat: false,
        bowlLegalBalls: b.legalBalls, bowlRunsConceded: b.runsConceded,
        bowlWickets: b.wickets, bowlWides: b.wides, bowlNoBalls: b.noBalls,
        bowlMaidens: maidensByBowler[b.playerId] ?? 0,
        bowlDidBowl: true,
      })
    }
  }

  await db.playerStats.bulkAdd(statsToAdd)
}

export function computeCareerBatting(stats: PlayerMatchStat[]): CareerBatting {
  const bat = stats.filter((s) => s.batDidBat)
  const totalRuns = bat.reduce((sum, s) => sum + s.batRuns, 0)
  const innings = bat.length
  const notOuts = bat.filter((s) => !s.batIsOut).length
  const dismissals = innings - notOuts
  const highestScore = bat.length > 0 ? Math.max(...bat.map((s) => s.batRuns)) : 0
  const average = dismissals > 0 ? (totalRuns / dismissals).toFixed(1) : totalRuns > 0 ? '∞' : '-'
  const totalBalls = bat.reduce((sum, s) => sum + s.batBalls, 0)
  const strikeRate = totalBalls > 0 ? ((totalRuns / totalBalls) * 100).toFixed(1) : '-'
  return {
    matches: new Set(bat.map((s) => s.matchId)).size,
    innings, notOuts, totalRuns, highestScore, average, strikeRate,
    fifties: bat.filter((s) => s.batRuns >= 50 && s.batRuns < 100).length,
    hundreds: bat.filter((s) => s.batRuns >= 100).length,
    fours: bat.reduce((sum, s) => sum + s.batFours, 0),
    sixes: bat.reduce((sum, s) => sum + s.batSixes, 0),
  }
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
