import { describe, it, expect } from 'vitest'
import {
  computeCareerBatting,
  computeCareerBowling,
  computeCareerFielding,
  computeCareerRecord,
} from './operations'
import type { PlayerMatchStat } from './types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeStat(overrides: Partial<PlayerMatchStat> = {}): PlayerMatchStat {
  return {
    matchId: 'match-1',
    playerName: 'Alice',
    teamName: 'Team A',
    opponent: 'Team B',
    matchDate: '2024-01-01T00:00:00Z',
    batRuns: 0, batBalls: 0, batFours: 0, batSixes: 0,
    batIsOut: false, batDidBat: false,
    bowlLegalBalls: 0, bowlRunsConceded: 0, bowlWickets: 0,
    bowlWides: 0, bowlNoBalls: 0, bowlMaidens: 0, bowlDidBowl: false,
    fieldCatches: 0, fieldRunOuts: 0, fieldStumpings: 0,
    isMvp: false,
    ...overrides,
  }
}

// ── computeCareerBatting ──────────────────────────────────────────────────────

describe('computeCareerBatting', () => {
  it('returns zeroed stats for empty input', () => {
    const result = computeCareerBatting([])
    expect(result.matches).toBe(0)
    expect(result.innings).toBe(0)
    expect(result.totalRuns).toBe(0)
    expect(result.average).toBe('-')
    expect(result.strikeRate).toBe('-')
    expect(result.mvpWins).toBe(0)
  })

  it('counts innings and runs correctly', () => {
    const stats = [
      makeStat({ matchId: 'm1', batDidBat: true, batRuns: 45, batBalls: 30, batIsOut: true }),
      makeStat({ matchId: 'm2', batDidBat: true, batRuns: 20, batBalls: 15, batIsOut: false }),
    ]
    const result = computeCareerBatting(stats)
    expect(result.innings).toBe(2)
    expect(result.totalRuns).toBe(65)
    expect(result.notOuts).toBe(1)
  })

  it('calculates average: totalRuns / dismissals', () => {
    const stats = [
      makeStat({ matchId: 'm1', batDidBat: true, batRuns: 30, batBalls: 20, batIsOut: true }),
      makeStat({ matchId: 'm2', batDidBat: true, batRuns: 70, batBalls: 40, batIsOut: true }),
    ]
    const result = computeCareerBatting(stats)
    expect(result.average).toBe('50.0') // 100 / 2
  })

  it('shows ∞ average when never dismissed but has runs', () => {
    const stats = [
      makeStat({ matchId: 'm1', batDidBat: true, batRuns: 25, batBalls: 20, batIsOut: false }),
    ]
    const result = computeCareerBatting(stats)
    expect(result.average).toBe('∞')
  })

  it('calculates strike rate correctly', () => {
    const stats = [
      makeStat({ matchId: 'm1', batDidBat: true, batRuns: 100, batBalls: 50, batIsOut: true }),
    ]
    expect(computeCareerBatting(stats).strikeRate).toBe('200.0')
  })

  it('counts fours and sixes', () => {
    const stats = [
      makeStat({ matchId: 'm1', batDidBat: true, batFours: 3, batSixes: 2, batRuns: 24, batBalls: 12, batIsOut: true }),
    ]
    const result = computeCareerBatting(stats)
    expect(result.fours).toBe(3)
    expect(result.sixes).toBe(2)
  })

  it('counts half-centuries and centuries', () => {
    const stats = [
      makeStat({ matchId: 'm1', batDidBat: true, batRuns: 55, batBalls: 40, batIsOut: true }),
      makeStat({ matchId: 'm2', batDidBat: true, batRuns: 105, batBalls: 80, batIsOut: false }),
    ]
    const result = computeCareerBatting(stats)
    expect(result.fifties).toBe(1)
    expect(result.hundreds).toBe(1)
  })

  it('counts highest score', () => {
    const stats = [
      makeStat({ matchId: 'm1', batDidBat: true, batRuns: 20, batBalls: 10, batIsOut: true }),
      makeStat({ matchId: 'm2', batDidBat: true, batRuns: 75, batBalls: 50, batIsOut: false }),
    ]
    expect(computeCareerBatting(stats).highestScore).toBe(75)
  })

  it('counts MVP wins by distinct match (not row count)', () => {
    const stats = [
      // Two rows for the same match (bat + bowl rows), both marked MVP
      makeStat({ matchId: 'm1', isMvp: true }),
      makeStat({ matchId: 'm1', isMvp: true }),
      makeStat({ matchId: 'm2', isMvp: true }),
    ]
    expect(computeCareerBatting(stats).mvpWins).toBe(2)
  })

  it('ignores non-batting rows for innings count', () => {
    const stats = [
      makeStat({ matchId: 'm1', batDidBat: false }),
      makeStat({ matchId: 'm2', batDidBat: true, batRuns: 10, batBalls: 5, batIsOut: true }),
    ]
    expect(computeCareerBatting(stats).innings).toBe(1)
  })
})

// ── computeCareerBowling ──────────────────────────────────────────────────────

describe('computeCareerBowling', () => {
  it('returns zeroed stats for empty input', () => {
    const result = computeCareerBowling([])
    expect(result.wickets).toBe(0)
    expect(result.economy).toBe('-')
    expect(result.average).toBe('-')
  })

  it('aggregates wickets, balls and runs across matches', () => {
    const stats = [
      makeStat({ matchId: 'm1', bowlDidBowl: true, bowlWickets: 2, bowlLegalBalls: 12, bowlRunsConceded: 30 }),
      makeStat({ matchId: 'm2', bowlDidBowl: true, bowlWickets: 1, bowlLegalBalls: 6, bowlRunsConceded: 20 }),
    ]
    const result = computeCareerBowling(stats)
    expect(result.wickets).toBe(3)
    expect(result.legalBalls).toBe(18)
    expect(result.runsConceded).toBe(50)
  })

  it('calculates economy correctly', () => {
    // 24 runs in 12 balls → (24/12)*6 = 12.00
    const stats = [
      makeStat({ matchId: 'm1', bowlDidBowl: true, bowlLegalBalls: 12, bowlRunsConceded: 24, bowlWickets: 1 }),
    ]
    expect(computeCareerBowling(stats).economy).toBe('12.00')
  })

  it('calculates bowling average', () => {
    // 50 runs, 5 wickets → avg 10.0
    const stats = [
      makeStat({ matchId: 'm1', bowlDidBowl: true, bowlLegalBalls: 12, bowlRunsConceded: 50, bowlWickets: 5 }),
    ]
    expect(computeCareerBowling(stats).average).toBe('10.0')
  })

  it('returns - bowling average when no wickets', () => {
    const stats = [
      makeStat({ matchId: 'm1', bowlDidBowl: true, bowlLegalBalls: 12, bowlRunsConceded: 30, bowlWickets: 0 }),
    ]
    expect(computeCareerBowling(stats).average).toBe('-')
  })

  it('counts maidens', () => {
    const stats = [
      makeStat({ matchId: 'm1', bowlDidBowl: true, bowlMaidens: 2, bowlLegalBalls: 12, bowlWickets: 1, bowlRunsConceded: 0 }),
    ]
    expect(computeCareerBowling(stats).maidens).toBe(2)
  })

  it('identifies best bowling figures', () => {
    const stats = [
      makeStat({ matchId: 'm1', bowlDidBowl: true, bowlWickets: 2, bowlRunsConceded: 18, bowlLegalBalls: 12 }),
      makeStat({ matchId: 'm2', bowlDidBowl: true, bowlWickets: 4, bowlRunsConceded: 22, bowlLegalBalls: 12 }),
      makeStat({ matchId: 'm3', bowlDidBowl: true, bowlWickets: 4, bowlRunsConceded: 30, bowlLegalBalls: 12 }),
    ]
    const result = computeCareerBowling(stats)
    expect(result.bestWickets).toBe(4)
    expect(result.bestRuns).toBe(22) // same wickets, lower runs wins
  })
})

// ── computeCareerFielding ─────────────────────────────────────────────────────

describe('computeCareerFielding', () => {
  it('returns zeros for empty input', () => {
    const result = computeCareerFielding([])
    expect(result.total).toBe(0)
  })

  it('sums catches, run-outs and stumpings', () => {
    const stats = [
      makeStat({ matchId: 'm1', fieldCatches: 2, fieldRunOuts: 1, fieldStumpings: 0 }),
      makeStat({ matchId: 'm2', fieldCatches: 1, fieldRunOuts: 0, fieldStumpings: 1 }),
    ]
    const result = computeCareerFielding(stats)
    expect(result.catches).toBe(3)
    expect(result.runOuts).toBe(1)
    expect(result.stumpings).toBe(1)
    expect(result.total).toBe(5)
  })
})

// ── computeCareerRecord ───────────────────────────────────────────────────────

describe('computeCareerRecord', () => {
  it('returns all zeros for empty stats', () => {
    const result = computeCareerRecord([], {})
    expect(result).toEqual({ wins: 0, losses: 0, ties: 0 })
  })

  it('counts a win when team name starts the result', () => {
    const stats = [makeStat({ matchId: 'm1', teamName: 'Team A' })]
    const matchResults = { 'm1': 'Team A won by 5 wickets' }
    expect(computeCareerRecord(stats, matchResults).wins).toBe(1)
    expect(computeCareerRecord(stats, matchResults).losses).toBe(0)
  })

  it('counts a loss when another team won', () => {
    const stats = [makeStat({ matchId: 'm1', teamName: 'Team A' })]
    const matchResults = { 'm1': 'Team B won by 10 runs' }
    const result = computeCareerRecord(stats, matchResults)
    expect(result.wins).toBe(0)
    expect(result.losses).toBe(1)
  })

  it('counts a tie correctly', () => {
    const stats = [makeStat({ matchId: 'm1', teamName: 'Team A' })]
    const matchResults = { 'm1': 'Match tied!' }
    const result = computeCareerRecord(stats, matchResults)
    expect(result.ties).toBe(1)
    expect(result.wins).toBe(0)
    expect(result.losses).toBe(0)
  })

  it('counts multiple matches correctly', () => {
    const stats = [
      makeStat({ matchId: 'm1', teamName: 'Team A' }),
      makeStat({ matchId: 'm2', teamName: 'Team A' }),
      makeStat({ matchId: 'm3', teamName: 'Team A' }),
      makeStat({ matchId: 'm4', teamName: 'Team A' }),
    ]
    const matchResults = {
      'm1': 'Team A won by 5 wickets',
      'm2': 'Team A won by 20 runs',
      'm3': 'Team B won by 3 wickets',
      'm4': 'Match tied!',
    }
    const result = computeCareerRecord(stats, matchResults)
    expect(result.wins).toBe(2)
    expect(result.losses).toBe(1)
    expect(result.ties).toBe(1)
  })

  it('deduplicates multiple stat rows for the same match', () => {
    // A player may have batting + bowling rows for the same match
    const stats = [
      makeStat({ matchId: 'm1', teamName: 'Team A', batDidBat: true }),
      makeStat({ matchId: 'm1', teamName: 'Team A', bowlDidBowl: true }),
    ]
    const matchResults = { 'm1': 'Team A won by 5 wickets' }
    expect(computeCareerRecord(stats, matchResults).wins).toBe(1)
  })

  it('gracefully ignores missing match results', () => {
    const stats = [makeStat({ matchId: 'm1', teamName: 'Team A' })]
    expect(computeCareerRecord(stats, {}).wins).toBe(0)
    expect(computeCareerRecord(stats, {}).losses).toBe(0)
  })
})
