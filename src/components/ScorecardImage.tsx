import { forwardRef } from 'react'
import type { Match } from '../types/cricket'
import { oversDisplay } from '../utils/cricket'
import { computeMvp } from '../utils/mvp'

interface Props {
  match: Match
  completedAt?: string
}

const ScorecardImage = forwardRef<HTMLDivElement, Props>(({ match, completedAt }, ref) => {
  const mvp = computeMvp(match)

  const s = {
    wrap: {
      width: '420px',
      background: 'linear-gradient(160deg, #0f172a 0%, #1a2540 60%, #0f172a 100%)',
      color: '#f1f5f9',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: '28px 24px 20px',
      borderRadius: '20px',
      position: 'relative' as const,
    },
    header: { textAlign: 'center' as const, marginBottom: '20px' },
    appLabel: { fontSize: '11px', color: '#475569', letterSpacing: '3px', textTransform: 'uppercase' as const },
    vs: { fontSize: '22px', fontWeight: 700, marginTop: '10px', color: '#f8fafc' },
    date: { fontSize: '12px', color: '#64748b', marginTop: '4px' },
    result: { fontSize: '17px', fontWeight: 700, color: '#4ade80', marginTop: '10px', padding: '6px 16px', background: 'rgba(74,222,128,0.12)', borderRadius: '999px', display: 'inline-block' },
    inningsBox: { background: 'rgba(255,255,255,0.05)', borderRadius: '14px', padding: '14px 14px 10px', marginBottom: '12px' },
    inningsHeader: { display: 'flex' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: '10px' },
    teamName: { fontWeight: 700, fontSize: '15px', color: '#cbd5e1' },
    score: { fontWeight: 800, fontSize: '22px', color: '#f8fafc' },
    scoreOv: { fontSize: '12px', color: '#64748b', marginLeft: '4px', fontWeight: 400 },
    divider: { borderBottom: '1px solid rgba(255,255,255,0.06)', margin: '3px 0' },
    bRow: { display: 'flex' as const, justifyContent: 'space-between' as const, fontSize: '12px', padding: '4px 0' },
    bName: (highlight: boolean) => ({ color: highlight ? '#fbbf24' : '#94a3b8', fontWeight: highlight ? 600 : 400 }),
    bStats: { color: '#64748b' },
    bowlHeader: { fontSize: '10px', color: '#475569', letterSpacing: '2px', textTransform: 'uppercase' as const, margin: '10px 0 6px' },
    bowlRow: { display: 'flex' as const, justifyContent: 'space-between' as const, fontSize: '12px', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' },
    mvpBox: {
      background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(217,119,6,0.12))',
      border: '1px solid rgba(245,158,11,0.35)',
      borderRadius: '14px', padding: '12px 14px', marginBottom: '14px',
      display: 'flex' as const, alignItems: 'center' as const, gap: '12px',
    },
    mvpLabel: { fontSize: '10px', color: '#fbbf24', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' as const },
    mvpName: { fontWeight: 800, fontSize: '16px', color: '#fde68a', marginTop: '2px' },
    mvpStats: { fontSize: '12px', color: '#d97706', marginTop: '2px' },
    footer: { textAlign: 'center' as const, fontSize: '11px', color: '#334155', marginTop: '8px' },
    accentBar: { height: '3px', background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: '999px', marginBottom: '16px' },
  }

  return (
    <div ref={ref} style={s.wrap}>
      <div style={s.accentBar} />

      {/* Header */}
      <div style={s.header}>
        <div style={s.appLabel}>&#x1F3CF; Social Cricket Scorer</div>
        <div style={s.vs}>{match.teams[0].name} vs {match.teams[1].name}</div>
        {completedAt && (
          <div style={s.date}>
            {new Date(completedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' \u00b7 '}{match.maxOvers} overs
          </div>
        )}
        {match.result && <div style={s.result}>{match.result}</div>}
      </div>

      {/* Innings */}
      {match.innings.map((inn, idx) => {
        if (!inn) return null
        const battingTeam = match.teams[inn.battingTeamIndex]
        const fieldingTeamIdx: 0 | 1 = inn.battingTeamIndex === 0 ? 1 : 0
        const batsmen = Object.values(inn.batsmen).sort((a, b) => b.runs - a.runs).slice(0, 6)
        const bowlers = Object.values(inn.bowlers).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded).slice(0, 4)

        return (
          <div key={idx} style={s.inningsBox}>
            <div style={s.inningsHeader}>
              <span style={s.teamName}>{battingTeam.name}</span>
              <span>
                <span style={s.score}>{inn.totalRuns}/{inn.totalWickets}</span>
                <span style={s.scoreOv}>({oversDisplay(inn.totalLegalBalls)} ov)</span>
              </span>
            </div>

            {/* Batting */}
            {batsmen.map((b, i) => (
              <div key={b.playerId}>
                <div style={s.bRow}>
                  <span style={s.bName(b.runs >= 25)}>
                    {b.name}{!b.isOut ? '*' : ''}
                    <span style={{ color: '#475569', fontWeight: 400 }}>
                      {b.isOut ? ` \u00b7 ${b.wicketType ?? 'out'}` : ' \u00b7 not out'}
                    </span>
                  </span>
                  <span style={s.bStats}>
                    {b.runs} ({b.balls}b)
                    {b.fours > 0 ? `  ${b.fours}x4` : ''}
                    {b.sixes > 0 ? `  ${b.sixes}x6` : ''}
                  </span>
                </div>
                {i < batsmen.length - 1 && <div style={s.divider} />}
              </div>
            ))}

            {/* Bowling */}
            {bowlers.length > 0 && (
              <>
                <div style={s.bowlHeader}>{match.teams[fieldingTeamIdx].name} \u2014 Bowling</div>
                {bowlers.map((b) => (
                  <div key={b.playerId} style={s.bowlRow}>
                    <span style={{ color: '#94a3b8' }}>{b.name}</span>
                    <span style={{ color: '#64748b' }}>
                      {Math.floor(b.legalBalls / 6)}.{b.legalBalls % 6} ov
                      {' \u00b7 '}{b.wickets}w
                      {' \u00b7 '}{b.runsConceded}r
                      {b.legalBalls > 0 ? `  \u00b7 eco ${((b.runsConceded / b.legalBalls) * 6).toFixed(1)}` : ''}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )
      })}

      {/* MVP */}
      {mvp && (
        <div style={s.mvpBox}>
          <span style={{ fontSize: '28px' }}>&#x1F3C6;</span>
          <div>
            <div style={s.mvpLabel}>Player of the Match</div>
            <div style={s.mvpName}>{mvp.name}</div>
            <div style={s.mvpStats}>
              {[
                mvp.batDidBat ? `${mvp.batRuns} (${mvp.batBalls}b)` : '',
                mvp.bowlDidBowl ? `${mvp.bowlWickets}w/${mvp.bowlRunsConceded}` : '',
              ].filter(Boolean).join('  \u00b7  ')}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={s.footer}>nikhilbhatia9.github.io/social-cricket-scorer</div>
    </div>
  )
})

ScorecardImage.displayName = 'ScorecardImage'
export default ScorecardImage
