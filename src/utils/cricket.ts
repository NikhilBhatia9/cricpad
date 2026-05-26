import type { Innings, BatsmanScore, BowlerScore, Over } from '../types/cricket'

export function oversDisplay(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6)
  const balls = legalBalls % 6
  return balls === 0 ? `${overs}` : `${overs}.${balls}`
}

export function runRate(runs: number, legalBalls: number): string {
  if (legalBalls === 0) return '0.00'
  return ((runs / legalBalls) * 6).toFixed(2)
}

export function requiredRunRate(target: number, currentRuns: number, ballsRemaining: number): string {
  if (ballsRemaining <= 0) return '—'
  const needed = target - currentRuns
  if (needed <= 0) return '0.00'
  return ((needed / ballsRemaining) * 6).toFixed(2)
}

export function strikeRate(runs: number, balls: number): string {
  if (balls === 0) return '0.0'
  return ((runs / balls) * 100).toFixed(1)
}

export function economyRate(runs: number, legalBalls: number): string {
  if (legalBalls === 0) return '0.00'
  return ((runs / legalBalls) * 6).toFixed(2)
}

export function currentOverBalls(currentOver: Over | undefined): string[] {
  if (!currentOver) return []
  return currentOver.balls.map((b) => {
    if (b.isWicket) return 'W'
    if (b.extraType === 'wide') return `wd${b.extras > 1 ? b.extras : ''}`
    if (b.extraType === 'noball') return `nb${b.runsOffBat > 0 ? '+' + b.runsOffBat : ''}`
    if (b.extraType === 'bye') return `b${b.extras}`
    if (b.extraType === 'legbye') return `lb${b.extras}`
    return String(b.runsOffBat)
  })
}

export function scoreString(innings: Innings): string {
  return `${innings.totalRuns}/${innings.totalWickets}`
}

export function sortedBatsmen(innings: Innings): BatsmanScore[] {
  return Object.values(innings.batsmen).sort((a, b) =>
    (a.battingPosition ?? 999) - (b.battingPosition ?? 999)
  )
}

export function sortedBowlers(innings: Innings): Array<BowlerScore & { maidens: number }> {
  const maidensByBowler: Record<string, number> = {}
  const firstOverByBowler: Record<string, number> = {}

  for (const over of innings.overs) {
    if (!(over.bowlerId in firstOverByBowler)) {
      firstOverByBowler[over.bowlerId] = over.number
    }
    // Maiden: completed over where bowler conceded 0 runs (byes/leg-byes don't count against bowler)
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

  return Object.values(innings.bowlers)
    .sort((a, b) => (firstOverByBowler[a.playerId] ?? 999) - (firstOverByBowler[b.playerId] ?? 999))
    .map((b) => ({ ...b, maidens: maidensByBowler[b.playerId] ?? 0 }))
}

export function ballColorClass(ballStr: string): string {
  if (ballStr === 'W') return 'bg-red-500 text-white'
  if (ballStr === '4') return 'bg-blue-500 text-white'
  if (ballStr === '6') return 'bg-purple-600 text-white'
  if (ballStr.startsWith('wd') || ballStr.startsWith('nb')) return 'bg-yellow-400 text-black'
  if (ballStr.startsWith('b') || ballStr.startsWith('lb')) return 'bg-gray-500 text-white'
  if (ballStr === '0') return 'bg-gray-800 text-gray-300'
  return 'bg-gray-700 text-white'
}
