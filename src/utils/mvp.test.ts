import { describe, it, expect } from 'vitest'
import { computeMvp } from './mvp'
import type { Match, Innings } from '../types/cricket'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeInnings(overrides: Partial<Innings> = {}): Innings {
  return {
    battingTeamIndex: 0,
    overs: [],
    batsmen: {},
    bowlers: {},
    fielders: {},
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    totalRuns: 0,
    totalWickets: 0,
    totalLegalBalls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    isComplete: true,
    ...overrides,
  }
}

function makeMatch(innings: [Innings | null, Innings | null]): Match {
  return {
    id: 'test-match',
    teams: [
      { name: 'Team A', players: [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }] },
      { name: 'Team B', players: [{ id: 'p3', name: 'Charlie' }, { id: 'p4', name: 'Dave' }] },
    ],
    maxOvers: 5,
    innings,
    currentInningsIndex: 1,
    toss: { winnerIndex: 0, elected: 'bat' },
    status: 'complete',
    createdAt: '2024-01-01T00:00:00Z',
  }
}

// ── computeMvp ────────────────────────────────────────────────────────────────

describe('computeMvp', () => {
  it('returns null for a match with no innings data', () => {
    expect(computeMvp(makeMatch([null, null]))).toBeNull()
  })

  it('picks the top scorer as MVP in a batting-only match', () => {
    const innings = makeInnings({
      battingTeamIndex: 0,
      batsmen: {
        p1: { playerId: 'p1', name: 'Alice', runs: 60, balls: 40, fours: 4, sixes: 2, isOut: false, battingPosition: 1 },
        p2: { playerId: 'p2', name: 'Bob',   runs: 10, balls: 12, fours: 1, sixes: 0, isOut: true,  battingPosition: 2 },
      },
      bowlers: {},
    })
    const mvp = computeMvp(makeMatch([innings, null]))
    expect(mvp).not.toBeNull()
    expect(mvp!.name).toBe('Alice')
  })

  it('awards points for not-out bonus', () => {
    const inningsAliceOut = makeInnings({
      battingTeamIndex: 0,
      batsmen: {
        p1: { playerId: 'p1', name: 'Alice', runs: 30, balls: 25, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
      },
      bowlers: {},
    })
    const inningsBobNotOut = makeInnings({
      battingTeamIndex: 0,
      batsmen: {
        p2: { playerId: 'p2', name: 'Bob', runs: 30, balls: 25, fours: 0, sixes: 0, isOut: false, battingPosition: 1 },
      },
      bowlers: {},
    })
    // Bob has same runs but not-out bonus → should score higher
    const mvpAlice = computeMvp(makeMatch([inningsAliceOut, null]))
    const mvpBob   = computeMvp(makeMatch([inningsBobNotOut, null]))
    expect(mvpAlice!.totalPoints).toBeLessThan(mvpBob!.totalPoints)
  })

  it('awards points for wicket-taking bowler', () => {
    const innings = makeInnings({
      battingTeamIndex: 0,
      batsmen: {
        p1: { playerId: 'p1', name: 'Alice', runs: 5, balls: 10, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
      },
      bowlers: {
        p3: { playerId: 'p3', name: 'Charlie', legalBalls: 12, runsConceded: 10, wickets: 3, wides: 0, noBalls: 0 },
      },
    })
    const mvp = computeMvp(makeMatch([innings, null]))
    expect(mvp!.name).toBe('Charlie')
    // 3 wickets × 20pts + 20pt haul bonus = 60+ pts
    expect(mvp!.totalPoints).toBeGreaterThanOrEqual(60)
  })

  it('gives all-rounder bonus when player both bats and bowls', () => {
    const innings = makeInnings({
      battingTeamIndex: 0,
      batsmen: {
        p1: { playerId: 'p1', name: 'Alice', runs: 20, balls: 15, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
      },
      bowlers: {
        p1: { playerId: 'p1', name: 'Alice', legalBalls: 6, runsConceded: 12, wickets: 1, wides: 0, noBalls: 0 },
        p3: { playerId: 'p3', name: 'Charlie', legalBalls: 6, runsConceded: 12, wickets: 1, wides: 0, noBalls: 0 },
      },
    })
    // Alice bats + bowls → should get all-rounder bonus over Charlie who only bowls
    const mvp = computeMvp(makeMatch([innings, null]))
    expect(mvp!.name).toBe('Alice')
  })

  it('economy bonus: bowler with eco < 6 scores more than one with eco > 14', () => {
    const goodBowlerInnings = makeInnings({
      battingTeamIndex: 0,
      batsmen: {},
      bowlers: {
        // 6 balls, 5 runs → eco = 5.0 → +15 pts
        p3: { playerId: 'p3', name: 'Charlie', legalBalls: 6, runsConceded: 5, wickets: 1, wides: 0, noBalls: 0 },
      },
    })
    const badBowlerInnings = makeInnings({
      battingTeamIndex: 0,
      batsmen: {},
      bowlers: {
        // 6 balls, 15 runs → eco = 15.0 → -10 pts
        p4: { playerId: 'p4', name: 'Dave', legalBalls: 6, runsConceded: 15, wickets: 1, wides: 0, noBalls: 0 },
      },
    })
    const goodMvp = computeMvp(makeMatch([goodBowlerInnings, null]))
    const badMvp  = computeMvp(makeMatch([badBowlerInnings, null]))
    expect(goodMvp!.totalPoints).toBeGreaterThan(badMvp!.totalPoints)
  })

  it('considers both innings when computing MVP', () => {
    const inn1 = makeInnings({
      battingTeamIndex: 0,
      batsmen: {
        p1: { playerId: 'p1', name: 'Alice', runs: 5, balls: 10, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
      },
      bowlers: {},
    })
    const inn2 = makeInnings({
      battingTeamIndex: 1,
      batsmen: {
        p3: { playerId: 'p3', name: 'Charlie', runs: 50, balls: 30, fours: 4, sixes: 2, isOut: false, battingPosition: 1 },
      },
      bowlers: {},
    })
    const mvp = computeMvp(makeMatch([inn1, inn2]))
    expect(mvp!.name).toBe('Charlie')
  })

  it('totalPoints is always >= 0 (floor at 0)', () => {
    // Terrible batting: 1 run off 20 balls (SR = 5, well below 60) → negative SR penalty but should floor at 0
    const innings = makeInnings({
      battingTeamIndex: 0,
      batsmen: {
        p1: { playerId: 'p1', name: 'Alice', runs: 1, balls: 20, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
      },
      bowlers: {},
    })
    const mvp = computeMvp(makeMatch([innings, null]))
    expect(mvp!.totalPoints).toBeGreaterThanOrEqual(0)
  })
})
