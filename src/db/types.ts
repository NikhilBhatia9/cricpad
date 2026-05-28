export interface PlayerRecord {
  name: string        // Primary key
  firstSeenAt: string
  lastSeenAt: string
  totalMatches: number
}

export interface MatchRecord {
  id: string          // Primary key (match UUID)
  teamAName: string
  teamBName: string
  result: string
  maxOvers: number
  completedAt: string
  snapshot: string    // Full Match JSON
}

export interface PlayerMatchStat {
  id?: number         // Auto-increment
  matchId: string
  playerName: string
  teamName: string
  opponent: string
  matchDate: string
  // Batting
  batRuns: number
  batBalls: number
  batFours: number
  batSixes: number
  batIsOut: boolean
  batWicketType?: string
  batDidBat: boolean
  // Bowling
  bowlLegalBalls: number
  bowlRunsConceded: number
  bowlWickets: number
  bowlWides: number
  bowlNoBalls: number
  bowlMaidens: number
  bowlDidBowl: boolean
  // Fielding
  fieldCatches: number
  fieldRunOuts: number
  fieldStumpings: number
  // MVP
  isMvp: boolean
}

export interface CareerBatting {
  matches: number
  innings: number
  notOuts: number
  totalRuns: number
  highestScore: number
  average: string
  strikeRate: string
  fifties: number
  hundreds: number
  fours: number
  sixes: number
  mvpWins: number
}

export interface CareerBowling {
  matches: number
  legalBalls: number
  runsConceded: number
  wickets: number
  maidens: number
  economy: string
  average: string
  strikeRate: string
  bestWickets: number
  bestRuns: number
}

export interface CareerFielding {
  catches: number
  runOuts: number
  stumpings: number
  total: number
}

export interface LeaderboardEntry {
  playerName: string
  mvpWins: number
  totalMvpPoints: number
  totalRuns: number
  totalWickets: number
  matches: number
}
