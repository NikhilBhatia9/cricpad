import type { Match } from '../types/cricket'

export interface PlayerMvpScore {
  name: string
  teamName: string
  totalPoints: number
  // Batting
  batRuns: number
  batBalls: number
  batFours: number
  batSixes: number
  batIsOut: boolean
  batDidBat: boolean
  // Bowling
  bowlWickets: number
  bowlLegalBalls: number
  bowlRunsConceded: number
  bowlMaidens: number
  bowlDidBowl: boolean
}

/**
 * Cricket MVP scoring formula (similar to ICC/CricHeroes approach):
 *
 * BATTING
 *   +1 pt per run
 *   +20 pts if SR > 150 | +10 pts if SR > 120 | -5 pts if SR < 60 (min 10 balls)
 *   +2 pts per 4, +3 pts per 6
 *   +15 pts for 25+, +25 pts for 50+, +50 pts for 100+
 *   +5 pts not-out bonus
 *
 * BOWLING
 *   +20 pts per wicket
 *   +15 pts eco < 6 | +8 pts eco < 8 | -10 pts eco > 14  (min 6 balls)
 *   +10 pts per maiden
 *   +10 pts for 2-wicket haul, +20 pts for 3+
 */
function calcPoints(p: PlayerMvpScore): number {
  let pts = 0

  // ── Batting ──────────────────────────────────────────────────────────
  if (p.batDidBat) {
    pts += p.batRuns
    pts += p.batFours * 2
    pts += p.batSixes * 3

    if (p.batBalls >= 10) {
      const sr = (p.batRuns / p.batBalls) * 100
      if (sr > 150) pts += 20
      else if (sr > 120) pts += 10
      else if (sr < 60) pts -= 5
    }

    if (p.batRuns >= 100) pts += 50
    else if (p.batRuns >= 50) pts += 25
    else if (p.batRuns >= 25) pts += 15

    if (!p.batIsOut) pts += 5
  }

  // ── Bowling ───────────────────────────────────────────────────────────
  if (p.bowlDidBowl && p.bowlLegalBalls > 0) {
    pts += p.bowlWickets * 20

    // Haul bonus
    if (p.bowlWickets >= 3) pts += 20
    else if (p.bowlWickets >= 2) pts += 10

    // Economy (per over, min 1 full over)
    if (p.bowlLegalBalls >= 6) {
      const eco = (p.bowlRunsConceded / p.bowlLegalBalls) * 6
      if (eco < 6) pts += 15
      else if (eco < 8) pts += 8
      else if (eco > 14) pts -= 10
    }

    pts += p.bowlMaidens * 10
  }

  // ── Fielding proxy: weight by involvement ─────────────────────────────
  // Can't track catches/run-outs directly yet, so small bonus for
  // contributing in both disciplines (all-rounder bonus)
  if (p.batDidBat && p.bowlDidBowl && p.batRuns > 0 && p.bowlWickets > 0) {
    pts += 10 // all-rounder bonus
  }

  return Math.max(0, pts)
}

export function computeMvp(match: Match): PlayerMvpScore | null {
  const playerMap: Record<string, PlayerMvpScore> = {}

  const totalBalls = match.innings.reduce((sum, inn) => sum + (inn?.totalLegalBalls ?? 0), 0)
  void totalBalls // used implicitly for future fielding metrics

  for (const innings of match.innings) {
    if (!innings) continue
    const battingTeam = match.teams[innings.battingTeamIndex]
    const fieldingTeamIdx: 0 | 1 = innings.battingTeamIndex === 0 ? 1 : 0
    const fieldingTeam = match.teams[fieldingTeamIdx]

    // Batting contributions
    for (const b of Object.values(innings.batsmen)) {
      if (!playerMap[b.name]) {
        playerMap[b.name] = {
          name: b.name, teamName: battingTeam.name, totalPoints: 0,
          batRuns: 0, batBalls: 0, batFours: 0, batSixes: 0, batIsOut: false, batDidBat: false,
          bowlWickets: 0, bowlLegalBalls: 0, bowlRunsConceded: 0, bowlMaidens: 0, bowlDidBowl: false,
        }
      }
      playerMap[b.name].batRuns = b.runs
      playerMap[b.name].batBalls = b.balls
      playerMap[b.name].batFours = b.fours
      playerMap[b.name].batSixes = b.sixes
      playerMap[b.name].batIsOut = b.isOut
      playerMap[b.name].batDidBat = true
    }

    // Bowling contributions (compute maidens from overs)
    const maidensByBowler: Record<string, number> = {}
    for (const over of innings.overs) {
      const legalBalls = over.balls.filter((b) => b.isLegal).length
      if (legalBalls >= 6) {
        const conceded = over.balls.reduce((sum, b) => {
          if (b.extraType === 'bye' || b.extraType === 'legbye') return sum
          return sum + b.runsOffBat + b.extras
        }, 0)
        if (conceded === 0) maidensByBowler[over.bowlerId] = (maidensByBowler[over.bowlerId] ?? 0) + 1
      }
    }

    for (const b of Object.values(innings.bowlers)) {
      if (!playerMap[b.name]) {
        playerMap[b.name] = {
          name: b.name, teamName: fieldingTeam.name, totalPoints: 0,
          batRuns: 0, batBalls: 0, batFours: 0, batSixes: 0, batIsOut: false, batDidBat: false,
          bowlWickets: 0, bowlLegalBalls: 0, bowlRunsConceded: 0, bowlMaidens: 0, bowlDidBowl: false,
        }
      }
      playerMap[b.name].bowlWickets = b.wickets
      playerMap[b.name].bowlLegalBalls = b.legalBalls
      playerMap[b.name].bowlRunsConceded = b.runsConceded
      playerMap[b.name].bowlMaidens = maidensByBowler[b.playerId] ?? 0
      playerMap[b.name].bowlDidBowl = true
    }
  }

  // Calculate points for all players
  const players = Object.values(playerMap).map((p) => ({
    ...p,
    totalPoints: calcPoints(p),
  }))

  if (players.length === 0) return null

  players.sort((a, b) => b.totalPoints - a.totalPoints)
  return players[0]
}

export function mvpNarrative(mvp: PlayerMvpScore): string {
  const parts: string[] = []

  if (mvp.batDidBat && mvp.batRuns > 0) {
    const sr = mvp.batBalls > 0 ? ((mvp.batRuns / mvp.batBalls) * 100).toFixed(0) : '0'
    let batDesc = `scored ${mvp.batRuns} off ${mvp.batBalls} balls (SR: ${sr})`
    if (!mvp.batIsOut) batDesc += ', remaining not out'
    const extras: string[] = []
    if (mvp.batSixes > 0) extras.push(`${mvp.batSixes} six${mvp.batSixes > 1 ? 'es' : ''}`)
    if (mvp.batFours > 0) extras.push(`${mvp.batFours} four${mvp.batFours > 1 ? 's' : ''}`)
    if (extras.length) batDesc += ` including ${extras.join(' and ')}`
    parts.push(batDesc)
  }

  if (mvp.bowlDidBowl && mvp.bowlWickets > 0) {
    const overs = `${Math.floor(mvp.bowlLegalBalls / 6)}.${mvp.bowlLegalBalls % 6}`
    const eco = mvp.bowlLegalBalls > 0 ? ((mvp.bowlRunsConceded / mvp.bowlLegalBalls) * 6).toFixed(1) : '0'
    let bowlDesc = `took ${mvp.bowlWickets} wicket${mvp.bowlWickets > 1 ? 's' : ''} for ${mvp.bowlRunsConceded} runs in ${overs} overs (eco: ${eco})`
    if (mvp.bowlMaidens > 0) bowlDesc += ` with ${mvp.bowlMaidens} maiden${mvp.bowlMaidens > 1 ? 's' : ''}`
    parts.push(bowlDesc)
  } else if (mvp.bowlDidBowl && mvp.bowlLegalBalls >= 6) {
    const eco = ((mvp.bowlRunsConceded / mvp.bowlLegalBalls) * 6).toFixed(1)
    parts.push(`bowled economically at ${eco} runs/over`)
  }

  if (parts.length === 0) return 'Outstanding all-round contribution.'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '.'
  return parts.map((p, i) => i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p).join(', and ') + '.'
}
