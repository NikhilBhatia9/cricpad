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
  return Object.values(innings.batsmen).sort((a, b) => {
    if (!a.isOut && !b.isOut) return 0
    if (!a.isOut) return -1
    if (!b.isOut) return 1
    return 0
  })
}

export function sortedBowlers(innings: Innings): BowlerScore[] {
  return Object.values(innings.bowlers).sort((a, b) => b.legalBalls - a.legalBalls)
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
