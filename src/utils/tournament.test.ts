import { describe, it, expect } from 'vitest'
import {
  generateLeagueFixtures,
  generateSeriesFixtures,
  generateEliminationFixtures,
  advanceEliminationWinner,
  computeSeriesResult,
  computeStandings,
} from './tournament'
import type { Tournament, TournamentMatch } from './tournament'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 'test-id',
    name: 'Test Tournament',
    teams: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
    overs: 10,
    format: 'league',
    matches: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── generateLeagueFixtures ───────────────────────────────────────────────────

describe('generateLeagueFixtures', () => {
  it('generates n*(n-1)/2 fixtures for n teams', () => {
    expect(generateLeagueFixtures(['A', 'B', 'C']).length).toBe(3)
    expect(generateLeagueFixtures(['A', 'B', 'C', 'D']).length).toBe(6)
    expect(generateLeagueFixtures(['A', 'B']).length).toBe(1)
  })

  it('each pair appears exactly once', () => {
    const teams = ['A', 'B', 'C', 'D']
    const fixtures = generateLeagueFixtures(teams)
    const pairs = fixtures.map((m) => [m.teamA, m.teamB].sort().join('-'))
    const unique = new Set(pairs)
    expect(unique.size).toBe(pairs.length)
  })

  it('all teams are drawn from the input list', () => {
    const teams = ['Alpha', 'Bravo', 'Charlie']
    const fixtures = generateLeagueFixtures(teams)
    for (const m of fixtures) {
      expect(teams).toContain(m.teamA)
      expect(teams).toContain(m.teamB)
    }
  })

  it('each fixture has a unique id', () => {
    const fixtures = generateLeagueFixtures(['A', 'B', 'C', 'D'])
    const ids = fixtures.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ── generateSeriesFixtures ───────────────────────────────────────────────────

describe('generateSeriesFixtures', () => {
  it('generates exactly 3 games for best-of-3', () => {
    const games = generateSeriesFixtures('India', 'Australia', 3)
    expect(games.length).toBe(3)
  })

  it('generates exactly 5 games for best-of-5', () => {
    const games = generateSeriesFixtures('India', 'Australia', 5)
    expect(games.length).toBe(5)
  })

  it('game numbers are sequential from 1', () => {
    const games = generateSeriesFixtures('A', 'B', 3)
    expect(games.map((g) => g.gameNumber)).toEqual([1, 2, 3])
  })

  it('all games have the same teams', () => {
    const games = generateSeriesFixtures('Warriors', 'Lions', 3)
    for (const g of games) {
      expect(g.teamA).toBe('Warriors')
      expect(g.teamB).toBe('Lions')
    }
  })
})

// ── generateEliminationFixtures ──────────────────────────────────────────────

describe('generateEliminationFixtures', () => {
  it('generates correct total matches for 4 teams (3 matches)', () => {
    // 4 teams: 2 semis + 1 final = 3
    const matches = generateEliminationFixtures(['A', 'B', 'C', 'D'])
    expect(matches.length).toBe(3)
  })

  it('generates correct total matches for 2 teams (1 final)', () => {
    const matches = generateEliminationFixtures(['A', 'B'])
    expect(matches.length).toBe(1)
  })

  it('pads odd team counts to next power of 2 with BYEs', () => {
    // 3 teams → padded to 4 → 3 total matches
    const matches = generateEliminationFixtures(['A', 'B', 'C'])
    expect(matches.length).toBe(3)
    // One first-round match should involve BYE
    const round0 = matches.filter((m) => m.roundIndex === 0)
    const hasBye = round0.some((m) => m.teamA === 'BYE' || m.teamB === 'BYE')
    expect(hasBye).toBe(true)
  })

  it('BYE matches are auto-resolved in round 0', () => {
    const matches = generateEliminationFixtures(['A', 'B', 'C'])
    const byeMatch = matches.find(
      (m) => m.roundIndex === 0 && (m.teamA === 'BYE' || m.teamB === 'BYE')
    )
    expect(byeMatch).toBeDefined()
    expect(byeMatch!.result).toBeDefined()
  })

  it('later round matches start as TBD', () => {
    const matches = generateEliminationFixtures(['A', 'B', 'C', 'D'])
    const finalMatch = matches.find((m) => m.round === 'Final')
    expect(finalMatch).toBeDefined()
    expect(finalMatch!.teamA).toBe('TBD')
    expect(finalMatch!.teamB).toBe('TBD')
  })

  it('rounds are named correctly (Final, Semifinal, Quarterfinal)', () => {
    const matches8 = generateEliminationFixtures(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    const roundNames = [...new Set(matches8.map((m) => m.round))]
    expect(roundNames).toContain('Final')
    expect(roundNames).toContain('Semifinal')
    expect(roundNames).toContain('Quarterfinal')
  })
})

// ── advanceEliminationWinner ─────────────────────────────────────────────────

describe('advanceEliminationWinner', () => {
  function makeElimTournament(teams: string[]): Tournament {
    return makeTournament({
      format: 'elimination',
      teams,
      matches: generateEliminationFixtures(teams),
    })
  }

  it('advances teamA winner to next round slot A when matchIndex is even', () => {
    const t = makeElimTournament(['Alpha', 'Bravo', 'Charlie', 'Delta'])
    // find a round-0 match with matchIndex 0
    const m0 = t.matches.find((m) => m.roundIndex === 0 && m.matchIndex === 0)!
    const resolvedMatches = t.matches.map((m) =>
      m.id === m0.id ? { ...m, result: 'A' as const } : m
    )
    const resolved = { ...t, matches: resolvedMatches }
    const advanced = advanceEliminationWinner(resolved, m0.id)

    const final = advanced.matches.find((m) => m.roundIndex === 1 && m.matchIndex === 0)
    expect(final?.teamA).toBe(m0.teamA)
  })

  it('advances teamB winner to next round slot B when matchIndex is odd', () => {
    const t = makeElimTournament(['Alpha', 'Bravo', 'Charlie', 'Delta'])
    const m1 = t.matches.find((m) => m.roundIndex === 0 && m.matchIndex === 1)!
    const resolvedMatches = t.matches.map((m) =>
      m.id === m1.id ? { ...m, result: 'B' as const } : m
    )
    const resolved = { ...t, matches: resolvedMatches }
    const advanced = advanceEliminationWinner(resolved, m1.id)

    const final = advanced.matches.find((m) => m.roundIndex === 1 && m.matchIndex === 0)
    expect(final?.teamB).toBe(m1.teamB)
  })

  it('returns unchanged tournament for tie result (cannot advance)', () => {
    const t = makeElimTournament(['A', 'B', 'C', 'D'])
    const m0 = t.matches.find((m) => m.roundIndex === 0 && m.matchIndex === 0)!
    const resolvedMatches = t.matches.map((m) =>
      m.id === m0.id ? { ...m, result: 'tie' as const } : m
    )
    const resolved = { ...t, matches: resolvedMatches }
    const advanced = advanceEliminationWinner(resolved, m0.id)

    const final = advanced.matches.find((m) => m.round === 'Final')
    expect(final?.teamA).toBe('TBD')
    expect(final?.teamB).toBe('TBD')
  })

  it('returns unchanged tournament when matchId not found', () => {
    const t = makeElimTournament(['A', 'B', 'C', 'D'])
    const result = advanceEliminationWinner(t, 'nonexistent-id')
    expect(result).toEqual(t)
  })
})

// ── computeSeriesResult ──────────────────────────────────────────────────────

describe('computeSeriesResult', () => {
  function makeSeriesTournament(results: Array<'A' | 'B' | 'tie' | undefined>, length: 3 | 5 = 3): Tournament {
    const games = generateSeriesFixtures('India', 'Australia', length)
    const matches: TournamentMatch[] = games.map((g, i) => ({
      ...g,
      result: results[i],
    }))
    return makeTournament({
      format: 'series',
      teams: ['India', 'Australia'],
      seriesLength: length,
      matches,
    })
  }

  it('teamA wins best-of-3 after 2 wins', () => {
    const t = makeSeriesTournament(['A', 'A', undefined])
    const sr = computeSeriesResult(t)
    expect(sr.winner).toBe('India')
    expect(sr.winsA).toBe(2)
    expect(sr.winsB).toBe(0)
    expect(sr.complete).toBe(true)
  })

  it('teamB wins best-of-3 after 2 wins', () => {
    const t = makeSeriesTournament(['B', 'A', 'B'])
    const sr = computeSeriesResult(t)
    expect(sr.winner).toBe('Australia')
    expect(sr.winsA).toBe(1)
    expect(sr.winsB).toBe(2)
  })

  it('no winner when series is still in progress', () => {
    const t = makeSeriesTournament(['A', 'B', undefined])
    const sr = computeSeriesResult(t)
    expect(sr.winner).toBeNull()
    expect(sr.complete).toBe(false)
  })

  it('teamA wins best-of-5 after 3 wins', () => {
    const t = makeSeriesTournament(['A', 'A', 'B', 'A', undefined], 5)
    const sr = computeSeriesResult(t)
    expect(sr.winner).toBe('India')
    expect(sr.winsA).toBe(3)
  })

  it('handles all ties — no winner declared', () => {
    const t = makeSeriesTournament(['tie', 'tie', 'tie'])
    const sr = computeSeriesResult(t)
    expect(sr.winner).toBeNull()
    expect(sr.winsA).toBe(0)
    expect(sr.winsB).toBe(0)
  })
})

// ── computeStandings ─────────────────────────────────────────────────────────

describe('computeStandings', () => {
  function makeLeagueTournament(teams: string[], results: Array<[string, string, 'A' | 'B' | 'tie' | 'no_result']>): Tournament {
    const matches: TournamentMatch[] = results.map(([a, b, res]) => ({
      id: `${a}-${b}`,
      teamA: a,
      teamB: b,
      result: res,
    }))
    return makeTournament({ teams, matches, format: 'league' })
  }

  it('winner has 2 points, loser has 0', () => {
    const t = makeLeagueTournament(['A', 'B'], [['A', 'B', 'A']])
    const standings = computeStandings(t)
    const a = standings.find((s) => s.team === 'A')!
    const b = standings.find((s) => s.team === 'B')!
    expect(a.points).toBe(2)
    expect(b.points).toBe(0)
    expect(a.won).toBe(1)
    expect(b.lost).toBe(1)
  })

  it('tied match gives 1 point each', () => {
    const t = makeLeagueTournament(['A', 'B'], [['A', 'B', 'tie']])
    const standings = computeStandings(t)
    for (const s of standings) {
      expect(s.points).toBe(1)
      expect(s.tied).toBe(1)
    }
  })

  it('no_result gives 1 point each', () => {
    const t = makeLeagueTournament(['A', 'B'], [['A', 'B', 'no_result']])
    const standings = computeStandings(t)
    for (const s of standings) {
      expect(s.points).toBe(1)
      expect(s.noResult).toBe(1)
    }
  })

  it('standings are sorted by points descending', () => {
    // result 'A' = teamA (first column) wins; result 'B' = teamB (second column) wins
    // A beats B, A beats C, B beats C → A=4pts, B=2pts, C=0pts
    const t = makeLeagueTournament(
      ['A', 'B', 'C'],
      [['A', 'B', 'A'], ['A', 'C', 'A'], ['B', 'C', 'A']]
    )
    const standings = computeStandings(t)
    expect(standings[0].team).toBe('A') // 4 points
    expect(standings[1].team).toBe('B') // 2 points
    expect(standings[2].team).toBe('C') // 0 points
  })

  it('played count is correct for multiple matches', () => {
    const t = makeLeagueTournament(
      ['A', 'B', 'C'],
      [['A', 'B', 'A'], ['A', 'C', 'B'], ['B', 'C', 'A']]
    )
    const standings = computeStandings(t)
    for (const s of standings) {
      expect(s.played).toBe(2)
    }
  })

  it('teams with no matches have zero stats', () => {
    const t = makeLeagueTournament(['A', 'B', 'C'], [])
    const standings = computeStandings(t)
    for (const s of standings) {
      expect(s.played).toBe(0)
      expect(s.points).toBe(0)
      expect(s.nrr).toBe(0)
    }
  })

  it('calculates NRR when run data is provided', () => {
    const t = makeTournament({
      teams: ['A', 'B'],
      format: 'league',
      matches: [
        {
          id: '1',
          teamA: 'A',
          teamB: 'B',
          result: 'A',
          runsA: 150,
          ballsFacedA: 60, // 10 overs
          runsB: 100,
          ballsFacedB: 60, // 10 overs
        },
      ],
    })
    const standings = computeStandings(t)
    const a = standings.find((s) => s.team === 'A')!
    const b = standings.find((s) => s.team === 'B')!
    // A: scored 150/10 = 15 rpo, conceded 100/10 = 10 rpo → NRR = +5.000
    expect(a.nrr).toBe(5)
    // B: scored 100/10 = 10, conceded 150/10 = 15 → NRR = -5.000
    expect(b.nrr).toBe(-5)
  })
})
