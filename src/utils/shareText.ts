import type { Match } from '../types/cricket'
import { oversDisplay } from './cricket'
import { computeMvp } from './mvp'

export function generateShareText(match: Match): string {
  const i1 = match.innings[0]
  const i2 = match.innings[1]
  const mvp = computeMvp(match)
  const date = new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })

  const lines: string[] = [
    `🏏 *${match.teams[0].name} vs ${match.teams[1].name}* (${match.maxOvers} overs)`,
    `📅 ${date}`,
    '',
  ]

  if (i1) {
    const t = match.teams[i1.battingTeamIndex]
    lines.push(`🟢 *${t.name}*: ${i1.totalRuns}/${i1.totalWickets} (${oversDisplay(i1.totalLegalBalls)} ov)`)
  }
  if (i2) {
    const t = match.teams[i2.battingTeamIndex]
    lines.push(`🔵 *${t.name}*: ${i2.totalRuns}/${i2.totalWickets} (${oversDisplay(i2.totalLegalBalls)} ov)`)
  }

  if (match.result) {
    lines.push('')
    lines.push(`🏆 ${match.result}`)
  }

  if (mvp) {
    const batLine = mvp.batDidBat && mvp.batRuns > 0 ? `${mvp.batRuns}${!mvp.batIsOut ? '*' : ''} (${mvp.batBalls}b)` : ''
    const bowlLine = mvp.bowlDidBowl && mvp.bowlWickets > 0 ? `${mvp.bowlWickets}/${mvp.bowlRunsConceded}` : ''
    const stats = [batLine, bowlLine].filter(Boolean).join(' · ')
    lines.push(`🌟 MVP: ${mvp.name}${stats ? ` — ${stats}` : ''}`)
  }

  lines.push('')
  lines.push('📱 Scored with Social Cricket Scorer')
  lines.push('https://nikhilbhatia9.github.io/social-cricket-scorer')

  return lines.join('\n')
}
