export type WicketType =
  | 'Bowled'
  | 'Caught'
  | 'LBW'
  | 'Run Out'
  | 'Stumped'
  | 'Hit Wicket'
  | 'Retired'

export type ExtraType = 'wide' | 'noball' | 'bye' | 'legbye'

export interface Player {
  id: string
  name: string
}

export interface BallEvent {
  id: string
  runsOffBat: number
  extras: number
  extraType?: ExtraType
  isWicket: boolean
  wicketType?: WicketType
  fielderId?: string
  fielderName?: string
  strikerId: string
  bowlerId: string
  /** false for wides/noballs — ball not counted in over */
  isLegal: boolean
  /** true when the non-striker (not the striker) is the one run out */
  runOutNonStriker?: boolean
}

export interface Over {
  number: number
  balls: BallEvent[]
  bowlerId: string
}

export interface BatsmanScore {
  playerId: string
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  isOut: boolean
  wicketType?: WicketType
  bowledBy?: string
  fielderName?: string   // name of catcher/stumper/run-out fielder
  battingPosition: number
}

export interface BowlerScore {
  playerId: string
  name: string
  legalBalls: number
  runsConceded: number
  wickets: number
  wides: number
  noBalls: number
}

export interface FielderScore {
  playerId: string
  name: string
  catches: number
  runOuts: number
  stumpings: number
}

export interface InningsExtras {
  wides: number
  noBalls: number
  byes: number
  legByes: number
}

export interface FallOfWicket {
  wicketNum: number
  runs: number
  legalBalls: number   // total legal balls in innings when wicket fell
  batsmanName: string
}

export interface Innings {
  battingTeamIndex: 0 | 1
  overs: Over[]
  batsmen: Record<string, BatsmanScore>
  bowlers: Record<string, BowlerScore>
  fielders: Record<string, FielderScore>
  strikerId: string | null
  nonStrikerId: string | null
  bowlerId: string | null
  totalRuns: number
  totalWickets: number
  totalLegalBalls: number
  extras: InningsExtras
  target?: number
  isComplete: boolean
  resultNote?: string
  fallOfWickets?: FallOfWicket[]
  /** True when the next delivery is a free hit (ball after a no-ball) */
  isFreeHit?: boolean
}

export interface Team {
  name: string
  players: Player[]
}

export interface Match {
  id: string
  teams: [Team, Team]
  maxOvers: number
  innings: [Innings | null, Innings | null]
  currentInningsIndex: 0 | 1
  toss: { winnerIndex: 0 | 1; elected: 'bat' | 'field' } | null
  status: 'setup' | 'toss' | 'live' | 'innings_break' | 'complete'
  result?: string
  createdAt: string
  spectatorCode?: string
  // Super Over
  isSuperOver?: boolean
  completedInnings?: [Innings | null, Innings | null]
  completedResult?: string
}
