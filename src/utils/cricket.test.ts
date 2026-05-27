import { describe, it, expect } from 'vitest'
import {
  oversDisplay,
  runRate,
  requiredRunRate,
  ballColorClass,
  currentOverBalls,
  dismissalText,
} from './cricket'
import type { BatsmanScore, Over } from '../types/cricket'

// ── oversDisplay ─────────────────────────────────────────────────────────────

describe('oversDisplay', () => {
  it('shows 0 for no balls bowled', () => {
    expect(oversDisplay(0)).toBe('0')
  })
  it('shows full over with no decimal when exactly divisible', () => {
    expect(oversDisplay(6)).toBe('1')
    expect(oversDisplay(12)).toBe('2')
    expect(oversDisplay(60)).toBe('10')
  })
  it('shows overs.balls for partial overs', () => {
    expect(oversDisplay(1)).toBe('0.1')
    expect(oversDisplay(7)).toBe('1.1')
    expect(oversDisplay(19)).toBe('3.1')
    expect(oversDisplay(23)).toBe('3.5')
  })
})

// ── runRate ───────────────────────────────────────────────────────────────────

describe('runRate', () => {
  it('returns 0.00 when no balls bowled', () => {
    expect(runRate(0, 0)).toBe('0.00')
    expect(runRate(50, 0)).toBe('0.00')
  })
  it('calculates correctly for a full over', () => {
    expect(runRate(6, 6)).toBe('6.00')
    expect(runRate(12, 6)).toBe('12.00')
  })
  it('calculates correctly for partial overs', () => {
    // 10 runs off 3 balls → 10/3*6 = 20.00
    expect(runRate(10, 3)).toBe('20.00')
    // 36 runs off 12 balls → 36/12*6 = 18.00
    expect(runRate(36, 12)).toBe('18.00')
  })
})

// ── requiredRunRate ───────────────────────────────────────────────────────────

describe('requiredRunRate', () => {
  it('returns — when no balls left', () => {
    expect(requiredRunRate(100, 90, 0)).toBe('—')
  })
  it('returns 0.00 when target already chased', () => {
    expect(requiredRunRate(100, 100, 12)).toBe('0.00')
    expect(requiredRunRate(100, 110, 6)).toBe('0.00')
  })
  it('calculates RRR correctly', () => {
    // Need 60 off 30 balls → 60/30*6 = 12.00
    expect(requiredRunRate(100, 40, 30)).toBe('12.00')
    // Need 24 off 12 balls → 12.00
    expect(requiredRunRate(50, 26, 12)).toBe('12.00')
  })
})

// ── ballColorClass ────────────────────────────────────────────────────────────

describe('ballColorClass', () => {
  it('gives red class for wicket', () => {
    expect(ballColorClass('W')).toContain('red')
  })
  it('gives blue for 4', () => {
    expect(ballColorClass('4')).toContain('blue')
  })
  it('gives purple for 6', () => {
    expect(ballColorClass('6')).toContain('purple')
  })
  it('gives yellow for wide or no-ball', () => {
    expect(ballColorClass('wd')).toContain('yellow')
    expect(ballColorClass('wd3')).toContain('yellow')
    expect(ballColorClass('nb')).toContain('yellow')
    expect(ballColorClass('nb+2')).toContain('yellow')
  })
  it('gives gray for bye or leg-bye', () => {
    expect(ballColorClass('b1')).toContain('gray')
    expect(ballColorClass('lb2')).toContain('gray')
  })
  it('gives dark gray for dot ball', () => {
    expect(ballColorClass('0')).toContain('gray-8')
  })
  it('gives default gray for normal runs', () => {
    expect(ballColorClass('1')).toContain('gray-7')
    expect(ballColorClass('3')).toContain('gray-7')
  })
})

// ── currentOverBalls ──────────────────────────────────────────────────────────

describe('currentOverBalls', () => {
  it('returns empty array for undefined over', () => {
    expect(currentOverBalls(undefined)).toEqual([])
  })

  it('returns empty for an over with no balls', () => {
    const over: Over = { number: 1, balls: [], bowlerId: 'b1' }
    expect(currentOverBalls(over)).toEqual([])
  })

  it('encodes runs correctly', () => {
    const over: Over = {
      number: 1,
      bowlerId: 'b1',
      balls: [
        { id: '1', runsOffBat: 0, extras: 0, isWicket: false, strikerId: 's1', bowlerId: 'b1', isLegal: true },
        { id: '2', runsOffBat: 4, extras: 0, isWicket: false, strikerId: 's1', bowlerId: 'b1', isLegal: true },
        { id: '3', runsOffBat: 6, extras: 0, isWicket: false, strikerId: 's1', bowlerId: 'b1', isLegal: true },
      ],
    }
    expect(currentOverBalls(over)).toEqual(['0', '4', '6'])
  })

  it('encodes wicket as W', () => {
    const over: Over = {
      number: 1,
      bowlerId: 'b1',
      balls: [
        { id: '1', runsOffBat: 0, extras: 0, isWicket: true, wicketType: 'Bowled', strikerId: 's1', bowlerId: 'b1', isLegal: true },
      ],
    }
    expect(currentOverBalls(over)).toEqual(['W'])
  })

  it('encodes wide with extra runs', () => {
    const over: Over = {
      number: 1,
      bowlerId: 'b1',
      balls: [
        { id: '1', runsOffBat: 0, extras: 1, extraType: 'wide', isWicket: false, strikerId: 's1', bowlerId: 'b1', isLegal: false },
        { id: '2', runsOffBat: 0, extras: 3, extraType: 'wide', isWicket: false, strikerId: 's1', bowlerId: 'b1', isLegal: false },
      ],
    }
    expect(currentOverBalls(over)).toEqual(['wd', 'wd3'])
  })

  it('encodes no-ball with runs', () => {
    const over: Over = {
      number: 1,
      bowlerId: 'b1',
      balls: [
        { id: '1', runsOffBat: 0, extras: 1, extraType: 'noball', isWicket: false, strikerId: 's1', bowlerId: 'b1', isLegal: false },
        { id: '2', runsOffBat: 4, extras: 1, extraType: 'noball', isWicket: false, strikerId: 's1', bowlerId: 'b1', isLegal: false },
      ],
    }
    expect(currentOverBalls(over)).toEqual(['nb', 'nb+4'])
  })

  it('encodes byes and leg-byes', () => {
    const over: Over = {
      number: 1,
      bowlerId: 'b1',
      balls: [
        { id: '1', runsOffBat: 0, extras: 2, extraType: 'bye', isWicket: false, strikerId: 's1', bowlerId: 'b1', isLegal: true },
        { id: '2', runsOffBat: 0, extras: 1, extraType: 'legbye', isWicket: false, strikerId: 's1', bowlerId: 'b1', isLegal: true },
      ],
    }
    expect(currentOverBalls(over)).toEqual(['b2', 'lb1'])
  })
})

// ── dismissalText ─────────────────────────────────────────────────────────────

describe('dismissalText', () => {
  const base: BatsmanScore = {
    playerId: 'p1', name: 'A', runs: 10, balls: 8, fours: 1, sixes: 0,
    isOut: false, battingPosition: 1,
  }

  it('returns not out for not-out batsman', () => {
    expect(dismissalText({ ...base, isOut: false })).toBe('not out')
  })

  it('handles bowled', () => {
    expect(dismissalText({ ...base, isOut: true, wicketType: 'Bowled', bowledBy: 'Smith' }))
      .toBe('b Smith')
  })

  it('handles LBW', () => {
    expect(dismissalText({ ...base, isOut: true, wicketType: 'LBW', bowledBy: 'Jones' }))
      .toBe('lbw b Jones')
  })

  it('handles caught', () => {
    expect(dismissalText({ ...base, isOut: true, wicketType: 'Caught', bowledBy: 'Jones', fielderName: 'Taylor' }))
      .toBe('c Taylor b Jones')
  })

  it('handles stumped', () => {
    expect(dismissalText({ ...base, isOut: true, wicketType: 'Stumped', bowledBy: 'Jones', fielderName: 'Keeper' }))
      .toBe('st Keeper b Jones')
  })

  it('handles run out with fielder', () => {
    expect(dismissalText({ ...base, isOut: true, wicketType: 'Run Out', fielderName: 'Warner' }))
      .toBe('run out (Warner)')
  })

  it('handles run out without fielder', () => {
    expect(dismissalText({ ...base, isOut: true, wicketType: 'Run Out' }))
      .toBe('run out')
  })

  it('handles retired', () => {
    expect(dismissalText({ ...base, isOut: true, wicketType: 'Retired' }))
      .toBe('retired')
  })
})
