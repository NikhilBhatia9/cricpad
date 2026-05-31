/**
 * Common-player deadlock prevention tests
 *
 * These tests mirror the derivation logic in Scoring.tsx to verify that every
 * scenario involving a player shared between both teams (same name, different
 * IDs) produces the correct flags and never creates a deadlock state.
 *
 * Scenarios tested
 * ────────────────
 * A. Normal play — no common player involved
 * B. Common player bowling, striker dismissed mid-over, others still available
 * C. Common player bowling, striker dismissed mid-over, non-striker stays,
 *    common player is the ONLY remaining batsman → replacement bowler required
 * D. Common player bowling, ALL batsmen out mid-over (strikerId=null,
 *    nonStrikerId=null) → replacement bowler + common player takes bat
 * E. Common player bowling, ALL batsmen out at END of over → defer screens
 *    so over-summary + bowler-select runs first
 * F. Common player bowling, wicket on last ball, non-striker still exists →
 *    defer + common player available after new bowler
 * G. After replacement bowler is set, batsmanExcludeShared clears and
 *    common player becomes selectable
 * H. needsBatsmen defer: strikerId=null nonStrikerId=null at end of over
 *    with common player only → deferNeedsBatsmen=true
 * I. No deadlock when the common player is on the batting side (no bowler conflict)
 */

import { describe, it, expect } from 'vitest'
import type { Innings, Team } from '../types/cricket'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal Innings for testing. */
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
    isComplete: false,
    fallOfWickets: [],
    ...overrides,
  }
}

/**
 * Common player setup:
 *   Batting team (Team A): P1 "Alice", P2 "Bob", P3 "Charlie" (common)
 *   Fielding team (Team B): Q1 "Dave", Q2 "Eve", Q3 "Charlie" (common — same name, different ID)
 *
 * "Charlie" is the shared player. When Charlie (Q3) is bowling for Team B,
 * the batting-team Charlie (P3) is excluded from batting.
 */
const battingTeam: Team = {
  name: 'Team A',
  players: [
    { id: 'P1', name: 'Alice' },
    { id: 'P2', name: 'Bob' },
    { id: 'P3', name: 'Charlie' }, // common player (batting ID)
  ],
}

const fieldingTeam: Team = {
  name: 'Team B',
  players: [
    { id: 'Q1', name: 'Dave' },
    { id: 'Q2', name: 'Eve' },
    { id: 'Q3', name: 'Charlie' }, // common player (fielding ID)
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure derivation helpers — mirrors the exact logic in Scoring.tsx
// ─────────────────────────────────────────────────────────────────────────────

function deriveFlags(
  innings: Innings,
  showNewBatsman: boolean,
  needsBatsman: boolean,
  activeBowlerName: string | null,
) {
  // batsmanExcludeShared: batting-team players whose name matches the active bowler
  const batsmanExcludeShared = activeBowlerName
    ? battingTeam.players.filter((p) => p.name === activeBowlerName).map((p) => p.id)
    : []

  const isNewOver =
    innings.totalLegalBalls > 0 &&
    innings.totalLegalBalls % 6 === 0 &&
    innings.overs.length < Math.floor(innings.totalLegalBalls / 6) + 1

  // Hoisted computations
  const alreadyOut = Object.keys(innings.batsmen).filter((id) => innings.batsmen[id].isOut)
  const strikerDismissed = innings.strikerId === null
  const stayingPlayerId = strikerDismissed
    ? (innings.nonStrikerId ?? '')
    : (innings.strikerId ?? '')

  const availableForNew = battingTeam.players.filter(
    (p) => !alreadyOut.includes(p.id) && p.id !== stayingPlayerId && !batsmanExcludeShared.includes(p.id),
  )
  const availableIgnoringShared = battingTeam.players.filter(
    (p) => !alreadyOut.includes(p.id) && p.id !== stayingPlayerId,
  )

  const commonPlayerIsOnlyOption =
    availableForNew.length === 0 &&
    batsmanExcludeShared.length > 0 &&
    availableIgnoringShared.length > 0

  const deferNewBatsman = showNewBatsman && isNewOver && commonPlayerIsOnlyOption

  // needsBatsmen defer
  const openingAvailable = battingTeam.players.filter(
    (p) => !alreadyOut.includes(p.id) && !batsmanExcludeShared.includes(p.id),
  )
  const openingAvailableIgnoringShared = battingTeam.players.filter(
    (p) => !alreadyOut.includes(p.id),
  )
  const commonPlayerOnlyForOpening =
    needsBatsman &&
    openingAvailable.length === 0 &&
    batsmanExcludeShared.length > 0 &&
    openingAvailableIgnoringShared.length > 0

  const deferNeedsBatsmen = commonPlayerOnlyForOpening && isNewOver

  return {
    batsmanExcludeShared,
    isNewOver,
    alreadyOut,
    availableForNew,
    availableIgnoringShared,
    commonPlayerIsOnlyOption,
    deferNewBatsman,
    commonPlayerOnlyForOpening,
    deferNeedsBatsmen,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario A — no common player / normal play
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario A — no common player', () => {
  it('batsmanExcludeShared is empty when bowler is not a shared player', () => {
    const innings = makeInnings({ strikerId: 'P1', nonStrikerId: 'P2', bowlerId: 'Q1' })
    const f = deriveFlags(innings, false, false, 'Dave') // Dave is not in batting team
    expect(f.batsmanExcludeShared).toHaveLength(0)
  })

  it('commonPlayerIsOnlyOption is false when batsmen are still available', () => {
    // P1 out, P2 batting — P3 still available as next batsman
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: 'P2',
      bowlerId: 'Q1',
      totalLegalBalls: 3,
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 5, balls: 5, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 2, balls: 3, fours: 0, sixes: 0, isOut: false, battingPosition: 2 },
      },
    })
    const f = deriveFlags(innings, true, false, 'Dave')
    expect(f.commonPlayerIsOnlyOption).toBe(false)
    expect(f.deferNewBatsman).toBe(false)
    // P3 is available as replacement
    expect(f.availableForNew.map((p) => p.id)).toContain('P3')
  })

  it('no defer when needsBatsmen and non-shared bowler active', () => {
    const innings = makeInnings({ totalLegalBalls: 6, overs: [{ number: 1, balls: [], bowlerId: 'Q1' }] })
    const f = deriveFlags(innings, false, true, 'Dave')
    expect(f.deferNeedsBatsmen).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scenario B — common player bowling, striker out, others still available
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario B — common player bowling, other batsmen still available', () => {
  it('batsmanExcludeShared contains the batting-team common player ID', () => {
    const innings = makeInnings({ strikerId: 'P1', nonStrikerId: 'P2', bowlerId: 'Q3' })
    const f = deriveFlags(innings, false, false, 'Charlie')
    expect(f.batsmanExcludeShared).toEqual(['P3'])
  })

  it('commonPlayerIsOnlyOption is false when P2 can still bat', () => {
    // P1 dismissed (strikerId=null), P2 is non-striker (staying), P3 excluded
    // But wait: P2 is stayingPlayerId, so only remaining available = nobody?
    // Actually: alreadyOut=[P1], stayingPlayerId=P2, available = [P3] but P3 excluded → []
    // availableIgnoringShared = [] (P3 not excluded → wait let me recalculate)
    // stayingPlayerId = P2, alreadyOut = [P1]
    // availableIgnoringShared = players where !alreadyOut && id !== stayingPlayerId = [P3] ✓
    // availableForNew = [P3] minus batsmanExcludeShared=[P3] = []
    // So: availableForNew=[] && batsmanExclude>0 && availableIgnoringShared=[P3]>0 → commonPlayerIsOnlyOption=TRUE
    // This IS the common player scenario — only P3 left but excluded

    // Let's set up: P1 out, P2 non-striker, P3 not yet out → this IS scenario C not B
    // Scenario B: we still have other batsmen available (e.g. 4 players in team)
    const teamsWithExtra: Team = {
      name: 'Team A',
      players: [
        { id: 'P1', name: 'Alice' },
        { id: 'P2', name: 'Bob' },
        { id: 'P4', name: 'Zara' }, // extra player
        { id: 'P3', name: 'Charlie' },
      ],
    }
    // Override battingTeam in scope — we'll test inline
    const activeBowlerName = 'Charlie'
    const batsmanExcludeShared = ['P3'] // P3 excluded

    const alreadyOut = ['P1'] // P1 dismissed
    const stayingPlayerId = 'P2' // non-striker stays

    const availableForNew = teamsWithExtra.players.filter(
      (p) => !alreadyOut.includes(p.id) && p.id !== stayingPlayerId && !batsmanExcludeShared.includes(p.id),
    )
    expect(availableForNew.map((p) => p.id)).toContain('P4') // P4 still available
    expect(availableForNew).toHaveLength(1)

    const availableIgnoringShared = teamsWithExtra.players.filter(
      (p) => !alreadyOut.includes(p.id) && p.id !== stayingPlayerId,
    )
    const commonPlayerIsOnlyOption =
      availableForNew.length === 0 && batsmanExcludeShared.length > 0 && availableIgnoringShared.length > 0
    expect(commonPlayerIsOnlyOption).toBe(false) // P4 is available → no issue
    expect(activeBowlerName).toBe('Charlie') // just ensuring no TS unused var
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scenario C — striker out mid-over, common player is the only remaining batsman
// (non-striker still at crease, so game can continue after crossing)
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario C — common player is only remaining batsman, non-striker at crease', () => {
  it('commonPlayerIsOnlyOption=true when P3 is only non-out non-staying player', () => {
    // P1 dismissed (strikerId=null), P2 non-striker (stayingPlayerId=P2), P3 excluded
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: 'P2',
      totalLegalBalls: 3,
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 5, balls: 5, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 2, balls: 3, fours: 0, sixes: 0, isOut: false, battingPosition: 2 },
      },
    })
    const f = deriveFlags(innings, true, false, 'Charlie')
    expect(f.batsmanExcludeShared).toEqual(['P3'])
    expect(f.availableForNew).toHaveLength(0) // P3 excluded, nobody else
    expect(f.availableIgnoringShared).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'P3' })]),
    )
    expect(f.commonPlayerIsOnlyOption).toBe(true)
  })

  it('deferNewBatsman=false mid-over (only end-of-over triggers defer)', () => {
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: 'P2',
      totalLegalBalls: 3, // mid-over (3 of 6 balls done)
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 0, balls: 1, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 0, balls: 2, fours: 0, sixes: 0, isOut: false, battingPosition: 2 },
      },
    })
    const f = deriveFlags(innings, true, false, 'Charlie')
    expect(f.isNewOver).toBe(false)
    expect(f.deferNewBatsman).toBe(false) // mid-over → no defer, show replacement screen
    expect(f.commonPlayerIsOnlyOption).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scenario D — ALL batsmen out mid-over (strikerId=null, nonStrikerId=null)
// → replacement bowler + common player bats immediately
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario D — all batsmen out mid-over, common player the only one left', () => {
  it('commonPlayerIsOnlyOption=true when strikerId and nonStrikerId both null', () => {
    // P1 and P2 both dismissed, only P3 (common, excluded) remains
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: null,
      totalLegalBalls: 4, // ball 4 of 6
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 3, balls: 4, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 1, balls: 2, fours: 0, sixes: 0, isOut: true, battingPosition: 2 },
      },
    })
    const f = deriveFlags(innings, true, false, 'Charlie')
    expect(f.batsmanExcludeShared).toEqual(['P3'])
    expect(f.alreadyOut).toEqual(expect.arrayContaining(['P1', 'P2']))
    // stayingPlayerId = '' (both null)
    expect(f.availableForNew).toHaveLength(0) // P3 excluded
    expect(f.availableIgnoringShared).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'P3' })]),
    )
    expect(f.commonPlayerIsOnlyOption).toBe(true)
  })

  it('deferNewBatsman=false because isNewOver=false mid-over', () => {
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: null,
      totalLegalBalls: 4,
      overs: [{ number: 1, balls: [], bowlerId: 'Q3' }],
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 0, balls: 4, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 0, balls: 2, fours: 0, sixes: 0, isOut: true, battingPosition: 2 },
      },
    })
    const f = deriveFlags(innings, true, false, 'Charlie')
    expect(f.isNewOver).toBe(false)
    // Not deferred — the "replacement bowler" screen should show
    expect(f.deferNewBatsman).toBe(false)
    expect(f.commonPlayerIsOnlyOption).toBe(true)
  })

  it('replacement bowler list excludes only the current bowler (common player)', () => {
    // The PlayerSelector for replacement receives fieldingTeam.players
    // with exclude=[currentBowlerId='Q3']
    // Dave (Q1) and Eve (Q2) should be selectable
    const currentBowlerId = 'Q3'
    const selectableBowlers = fieldingTeam.players.filter((p) => p.id !== currentBowlerId)
    expect(selectableBowlers).toHaveLength(2)
    expect(selectableBowlers.map((p) => p.name)).toEqual(expect.arrayContaining(['Dave', 'Eve']))
  })

  it('remaining balls count is correct at ball 4 of over', () => {
    const totalLegalBalls = 4
    const remainingBalls = 6 - (totalLegalBalls % 6)
    expect(remainingBalls).toBe(2)
  })

  it('remaining balls count is correct at ball 1 of over', () => {
    const totalLegalBalls = 1
    const remainingBalls = 6 - (totalLegalBalls % 6)
    expect(remainingBalls).toBe(5)
  })

  it('after setBowler + setBatsmen: common player is striker, game can proceed', () => {
    // Simulate the state AFTER the UI selects replacement bowler + sets common player as striker
    const inningsAfter = makeInnings({
      strikerId: 'P3', // common player now batting
      nonStrikerId: null,
      bowlerId: 'Q1', // replacement bowler (Dave)
      totalLegalBalls: 4,
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 3, balls: 4, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 1, balls: 2, fours: 0, sixes: 0, isOut: true, battingPosition: 2 },
        P3: { playerId: 'P3', name: 'Charlie', runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, battingPosition: 3 },
      },
    })
    // activeBowlerName is now 'Dave' (replacement) — batsmanExcludeShared = []
    const f = deriveFlags(inningsAfter, false, false, 'Dave')
    expect(f.batsmanExcludeShared).toHaveLength(0) // Dave ≠ 'Charlie'
    expect(f.commonPlayerIsOnlyOption).toBe(false)
    expect(f.deferNewBatsman).toBe(false)
    // No deadlock: strikerId is set, bowlerId is set — scoring can proceed
    expect(inningsAfter.strikerId).toBe('P3')
    expect(inningsAfter.bowlerId).toBe('Q1')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scenario E — ALL batsmen out at END of over
// → deferNewBatsman=true, let over-summary + new bowler resolve
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario E — all batsmen out at END of over (last ball wicket)', () => {
  it('isNewOver=true when totalLegalBalls=6 and one over entry exists', () => {
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: null,
      totalLegalBalls: 6,
      overs: [{ number: 1, balls: [], bowlerId: 'Q3' }], // over entry created, not yet new over
    })
    // isNewOver = 6%6===0 && overs.length(1) < floor(6/6)+1=2 → TRUE
    const isNewOver =
      innings.totalLegalBalls > 0 &&
      innings.totalLegalBalls % 6 === 0 &&
      innings.overs.length < Math.floor(innings.totalLegalBalls / 6) + 1
    expect(isNewOver).toBe(true)
  })

  it('deferNewBatsman=true when over just ended and common player is only option', () => {
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: null,
      totalLegalBalls: 6,
      overs: [{ number: 1, balls: [], bowlerId: 'Q3' }],
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 5, balls: 5, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 2, balls: 5, fours: 0, sixes: 0, isOut: true, battingPosition: 2 },
      },
    })
    const f = deriveFlags(innings, true, false, 'Charlie')
    expect(f.isNewOver).toBe(true)
    expect(f.commonPlayerIsOnlyOption).toBe(true)
    expect(f.deferNewBatsman).toBe(true) // over-summary should show instead
  })

  it('showNewBatsman block is bypassed (deferred) allowing over-summary to render', () => {
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: null,
      totalLegalBalls: 6,
      overs: [{ number: 1, balls: [], bowlerId: 'Q3' }],
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 5, balls: 5, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 2, balls: 5, fours: 0, sixes: 0, isOut: true, battingPosition: 2 },
      },
    })
    const f = deriveFlags(innings, true, false, 'Charlie')
    const showNewBatsmanBlock = true && !f.deferNewBatsman
    expect(showNewBatsmanBlock).toBe(false) // over-summary renders instead
  })

  it('after new (non-shared) bowler: deferNewBatsman=false, common player selectable', () => {
    // Simulate state after new bowler (Dave) is selected — setBowler creates over 2 entry
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: null,
      totalLegalBalls: 6,
      overs: [
        { number: 1, balls: [], bowlerId: 'Q3' },
        { number: 2, balls: [], bowlerId: 'Q1' }, // new over entry created by setBowler
      ],
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 5, balls: 5, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 2, balls: 5, fours: 0, sixes: 0, isOut: true, battingPosition: 2 },
      },
    })
    // activeBowlerName is now 'Dave' (Q1)
    const f = deriveFlags(innings, true, false, 'Dave')
    expect(f.batsmanExcludeShared).toHaveLength(0) // Dave ≠ Charlie
    expect(f.isNewOver).toBe(false) // over 2 entry already created → isNewOver false
    expect(f.commonPlayerIsOnlyOption).toBe(false) // P3 no longer excluded
    expect(f.deferNewBatsman).toBe(false)
    // availableForNew now includes P3
    expect(f.availableForNew.map((p) => p.id)).toContain('P3')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scenario F — wicket on last ball, non-striker still exists
// → defer to let over-summary flow, common player available after
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario F — wicket on last ball of over, non-striker exists', () => {
  it('deferNewBatsman=true when last ball wicket and non-striker present', () => {
    // P1 dismissed on ball 6, P2 non-striker staying, P3 only replacement but excluded
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: 'P2', // non-striker still at crease
      totalLegalBalls: 6,
      overs: [{ number: 1, balls: [], bowlerId: 'Q3' }],
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 5, balls: 6, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 3, balls: 6, fours: 0, sixes: 0, isOut: false, battingPosition: 2 },
      },
    })
    const f = deriveFlags(innings, true, false, 'Charlie')
    expect(f.isNewOver).toBe(true)
    expect(f.commonPlayerIsOnlyOption).toBe(true) // P3 is only option but excluded
    expect(f.deferNewBatsman).toBe(true)
  })

  it('after new bowler, P2 + P3 both selectable — no deadlock', () => {
    // New over entry created after bowler select
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: 'P2',
      totalLegalBalls: 6,
      overs: [
        { number: 1, balls: [], bowlerId: 'Q3' },
        { number: 2, balls: [], bowlerId: 'Q1' },
      ],
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 5, balls: 6, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 3, balls: 6, fours: 0, sixes: 0, isOut: false, battingPosition: 2 },
      },
    })
    const f = deriveFlags(innings, true, false, 'Dave') // Dave is new bowler
    expect(f.batsmanExcludeShared).toHaveLength(0)
    expect(f.deferNewBatsman).toBe(false)
    // P3 now available (not excluded), stayingPlayerId=P2 so P3 is the only new batsman
    expect(f.availableForNew.map((p) => p.id)).toContain('P3')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scenario G — after replacement bowler confirmed, batsmanExcludeShared clears
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario G — replacement bowler clears the shared-player exclusion', () => {
  it('batsmanExcludeShared is empty when replacement bowler is Dave', () => {
    const f = deriveFlags(makeInnings(), false, false, 'Dave')
    expect(f.batsmanExcludeShared).toHaveLength(0)
  })

  it('batsmanExcludeShared is empty when replacement bowler is Eve', () => {
    const f = deriveFlags(makeInnings(), false, false, 'Eve')
    expect(f.batsmanExcludeShared).toHaveLength(0)
  })

  it('batsmanExcludeShared is non-empty only when Charlie (common player) is bowling', () => {
    const withCharlie = deriveFlags(makeInnings(), false, false, 'Charlie')
    const withDave = deriveFlags(makeInnings(), false, false, 'Dave')
    expect(withCharlie.batsmanExcludeShared).toHaveLength(1)
    expect(withDave.batsmanExcludeShared).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scenario H — needsBatsmen defer at end of over
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario H — deferNeedsBatsmen when over ended and common player only option', () => {
  it('deferNeedsBatsmen=true prevents deadlock when isNewOver=true', () => {
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: null,
      totalLegalBalls: 6,
      overs: [{ number: 1, balls: [], bowlerId: 'Q3' }],
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 5, balls: 5, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 2, balls: 5, fours: 0, sixes: 0, isOut: true, battingPosition: 2 },
      },
    })
    // needsBatsmen = !strikerId && !nonStrikerId = true
    const needsBatsman = !innings.strikerId && !innings.nonStrikerId
    expect(needsBatsman).toBe(true)

    const f = deriveFlags(innings, false, needsBatsman, 'Charlie')
    expect(f.commonPlayerOnlyForOpening).toBe(true)
    expect(f.deferNeedsBatsmen).toBe(true)
    // needsBatsmen block is bypassed
    const needsBatsmenBlockShows = needsBatsman && !f.deferNeedsBatsmen
    expect(needsBatsmenBlockShows).toBe(false) // over-summary shows instead
  })

  it('deferNeedsBatsmen=false when isNewOver=false (mid-over)', () => {
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: null,
      totalLegalBalls: 3, // mid-over
      overs: [{ number: 1, balls: [], bowlerId: 'Q3' }],
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 0, balls: 3, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 0, balls: 2, fours: 0, sixes: 0, isOut: true, battingPosition: 2 },
      },
    })
    const needsBatsman = !innings.strikerId && !innings.nonStrikerId
    const f = deriveFlags(innings, true, needsBatsman, 'Charlie')
    expect(f.isNewOver).toBe(false)
    expect(f.deferNeedsBatsmen).toBe(false)
    // In this mid-over case, the showNewBatsman block handles it
    // (showing replacement bowler selector) — no deadlock
  })

  it('after new bowler: deferNeedsBatsmen=false, P3 available for batting', () => {
    // setBowler creates over 2 entry → isNewOver becomes false
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: null,
      totalLegalBalls: 6,
      overs: [
        { number: 1, balls: [], bowlerId: 'Q3' },
        { number: 2, balls: [], bowlerId: 'Q1' }, // new bowler (Dave)
      ],
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 0, balls: 5, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 0, balls: 5, fours: 0, sixes: 0, isOut: true, battingPosition: 2 },
      },
    })
    const needsBatsman = !innings.strikerId && !innings.nonStrikerId
    const f = deriveFlags(innings, true, needsBatsman, 'Dave')
    expect(f.batsmanExcludeShared).toHaveLength(0)
    expect(f.isNewOver).toBe(false)
    expect(f.deferNeedsBatsmen).toBe(false)
    // P3 is now in openingAvailable
    expect(f.availableForNew).toContainEqual(expect.objectContaining({ id: 'P3' }))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scenario I — common player on batting side (no conflict)
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario I — common player batting (not bowling)', () => {
  it('batsmanExcludeShared does not exclude common player when a normal bowler is active', () => {
    const innings = makeInnings({ strikerId: 'P3', nonStrikerId: 'P1', bowlerId: 'Q1' })
    const f = deriveFlags(innings, false, false, 'Dave') // Dave bowling, not Charlie
    expect(f.batsmanExcludeShared).toHaveLength(0)
    expect(f.commonPlayerIsOnlyOption).toBe(false)
  })

  it('P3 batting correctly — activeBowlerName=Dave does not exclude anyone named Dave', () => {
    // Batting team has no "Dave" so batsmanExcludeShared=[]
    const f = deriveFlags(makeInnings({ strikerId: 'P3', nonStrikerId: 'P2' }), false, false, 'Dave')
    expect(f.batsmanExcludeShared).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scenario J — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario J — edge cases', () => {
  it('commonPlayerIsOnlyOption=false when no common player (empty batsmanExcludeShared)', () => {
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: null,
      totalLegalBalls: 3,
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 0, balls: 3, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 0, balls: 2, fours: 0, sixes: 0, isOut: true, battingPosition: 2 },
      },
    })
    // Bowler is Dave (not a shared player) — only P3 remains but batsmanExcludeShared=[]
    const f = deriveFlags(innings, true, false, 'Dave')
    expect(f.batsmanExcludeShared).toHaveLength(0)
    expect(f.commonPlayerIsOnlyOption).toBe(false)
    // In this case P3 IS available (not excluded) — normal new batsman screen shows
    expect(f.availableForNew).toContainEqual(expect.objectContaining({ id: 'P3' }))
  })

  it('commonPlayerIsOnlyOption=false when common player is also already out', () => {
    // P1, P2, P3 all out — no one left at all
    const innings = makeInnings({
      strikerId: null,
      nonStrikerId: null,
      totalLegalBalls: 3,
      batsmen: {
        P1: { playerId: 'P1', name: 'Alice', runs: 0, balls: 3, fours: 0, sixes: 0, isOut: true, battingPosition: 1 },
        P2: { playerId: 'P2', name: 'Bob', runs: 0, balls: 2, fours: 0, sixes: 0, isOut: true, battingPosition: 2 },
        P3: { playerId: 'P3', name: 'Charlie', runs: 0, balls: 1, fours: 0, sixes: 0, isOut: true, battingPosition: 3 },
      },
    })
    const f = deriveFlags(innings, true, false, 'Charlie')
    expect(f.availableIgnoringShared).toHaveLength(0) // P3 is also out
    expect(f.commonPlayerIsOnlyOption).toBe(false) // all out → innings should end
  })

  it('isNewOver=false when over entry already created for current over count', () => {
    // totalLegalBalls=6, overs has 2 entries (over 2 already set up by setBowler)
    const innings = makeInnings({
      totalLegalBalls: 6,
      overs: [
        { number: 1, balls: [], bowlerId: 'Q3' },
        { number: 2, balls: [], bowlerId: 'Q1' }, // already set
      ],
    })
    const isNewOver =
      innings.totalLegalBalls > 0 &&
      innings.totalLegalBalls % 6 === 0 &&
      innings.overs.length < Math.floor(innings.totalLegalBalls / 6) + 1
    // overs.length=2, floor(6/6)+1=2 → 2 < 2 = false
    expect(isNewOver).toBe(false)
  })

  it('deferNewBatsman=false when showNewBatsman=false (no wicket pending)', () => {
    const innings = makeInnings({
      strikerId: 'P1',
      nonStrikerId: 'P2',
      totalLegalBalls: 6,
      overs: [{ number: 1, balls: [], bowlerId: 'Q3' }],
    })
    const f = deriveFlags(innings, false /* showNewBatsman=false */, false, 'Charlie')
    expect(f.deferNewBatsman).toBe(false) // no wicket pending → no defer needed
  })
})
