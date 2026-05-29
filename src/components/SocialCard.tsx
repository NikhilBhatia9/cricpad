import { forwardRef } from 'react'
import type { Match } from '../types/cricket'
import { oversDisplay } from '../utils/cricket'
import { computeMvp } from '../utils/mvp'

interface Props {
  match: Match
  completedAt?: string
}

const SocialCard = forwardRef<HTMLDivElement, Props>(({ match, completedAt }, ref) => {
  const mvp = computeMvp(match)

  const mainInnings = match.isSuperOver && match.completedInnings
    ? match.completedInnings
    : match.innings

  const inn1 = mainInnings[0]
  const inn2 = mainInnings[1]

  function topBat(inn: typeof inn1) {
    if (!inn) return null
    const bats = Object.values(inn.batsmen).filter((b) => b.balls > 0)
    if (bats.length === 0) return null
    return bats.reduce((best, b) => (b.runs > best.runs ? b : best))
  }

  const tb1 = topBat(inn1)
  const tb2 = topBat(inn2)

  const s = {
    wrap: {
      width: '390px',
      background: 'linear-gradient(145deg, #0a0f1e 0%, #111827 40%, #0d1829 100%)',
      color: '#f1f5f9',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: '0',
      borderRadius: '20px',
      overflow: 'hidden' as const,
      position: 'relative' as const,
    },
    topBand: {
      background: 'linear-gradient(90deg, #166534, #15803d, #16a34a)',
      padding: '4px 24px',
      display: 'flex' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
    },
    appName: { fontSize: '11px', fontWeight: 700, color: '#dcfce7', letterSpacing: '2px', textTransform: 'uppercase' as const },
    dateText: { fontSize: '10px', color: '#86efac' },
    body: { padding: '20px 22px 18px' },
    resultPill: {
      display: 'inline-block' as const,
      background: 'rgba(34,197,94,0.15)',
      border: '1px solid rgba(34,197,94,0.4)',
      borderRadius: '999px',
      padding: '5px 16px',
      fontSize: '13px',
      fontWeight: 700,
      color: '#4ade80',
      marginBottom: '18px',
      maxWidth: '100%',
    },
    teamsRow: {
      display: 'flex' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: '16px',
      gap: '8px',
    },
    teamBlock: { flex: 1, textAlign: 'center' as const },
    teamName: { fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 },
    teamScore: { fontSize: '28px', fontWeight: 800, color: '#f8fafc', lineHeight: 1 },
    teamOvers: { fontSize: '11px', color: '#64748b', marginTop: '3px' },
    vsText: { fontSize: '14px', color: '#475569', fontWeight: 700, flexShrink: 0 },
    divider: { height: '1px', background: 'rgba(255,255,255,0.07)', margin: '14px 0' },
    statsRow: {
      display: 'grid' as const,
      gridTemplateColumns: '1fr 1fr',
      gap: '10px',
      marginBottom: '12px',
    },
    statBox: {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '12px',
      padding: '10px 12px',
    },
    statLabel: { fontSize: '9px', color: '#64748b', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '4px' },
    statName: { fontSize: '13px', fontWeight: 700, color: '#e2e8f0', marginBottom: '2px' },
    statVal: { fontSize: '11px', color: '#94a3b8' },
    mvpBox: {
      background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.08))',
      border: '1px solid rgba(245,158,11,0.3)',
      borderRadius: '12px',
      padding: '10px 14px',
      display: 'flex' as const,
      alignItems: 'center' as const,
      gap: '10px',
      marginBottom: '14px',
    },
    mvpLabel: { fontSize: '9px', color: '#fbbf24', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' as const },
    mvpName: { fontWeight: 800, fontSize: '15px', color: '#fde68a' },
    mvpStats: { fontSize: '11px', color: '#d97706' },
    superOverBadge: {
      display: 'inline-block' as const,
      background: 'rgba(234,179,8,0.15)',
      border: '1px solid rgba(234,179,8,0.35)',
      borderRadius: '999px',
      padding: '3px 10px',
      fontSize: '10px',
      color: '#fbbf24',
      fontWeight: 700,
      marginBottom: '10px',
    },
    footer: {
      background: 'rgba(0,0,0,0.3)',
      padding: '8px 22px',
      display: 'flex' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
    },
    footerApp: { fontSize: '11px', color: '#22c55e', fontWeight: 700, letterSpacing: '1px' },
    footerSub: { fontSize: '10px', color: '#374151' },
  }

  const dateStr = completedAt
    ? new Date(completedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  return (
    <div ref={ref} style={s.wrap}>
      <div style={s.topBand}>
        <span style={s.appName}>🏏 CricPad</span>
        <span style={s.dateText}>{dateStr} · {match.maxOvers} ov</span>
      </div>

      <div style={s.body}>
        {match.isSuperOver && (
          <div style={s.superOverBadge}>⚡ Decided by Super Over</div>
        )}

        {match.result && <div style={s.resultPill}>{match.result}</div>}
        {match.isSuperOver && match.completedResult && (
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
            Main match: {match.completedResult}
          </div>
        )}

        <div style={s.teamsRow}>
          {inn1 && (
            <div style={s.teamBlock}>
              <div style={s.teamName}>{match.teams[inn1.battingTeamIndex].name}</div>
              <div style={s.teamScore}>{inn1.totalRuns}/{inn1.totalWickets}</div>
              <div style={s.teamOvers}>({oversDisplay(inn1.totalLegalBalls)} ov)</div>
            </div>
          )}
          <div style={s.vsText}>VS</div>
          {inn2 && (
            <div style={s.teamBlock}>
              <div style={s.teamName}>{match.teams[inn2.battingTeamIndex].name}</div>
              <div style={s.teamScore}>{inn2.totalRuns}/{inn2.totalWickets}</div>
              <div style={s.teamOvers}>({oversDisplay(inn2.totalLegalBalls)} ov)</div>
            </div>
          )}
          {!inn2 && inn1 && (
            <div style={{ ...s.teamBlock, opacity: 0.4 }}>
              <div style={s.teamName}>{match.teams[inn1.battingTeamIndex === 0 ? 1 : 0].name}</div>
              <div style={s.teamScore}>—</div>
            </div>
          )}
        </div>

        <div style={s.divider} />

        <div style={s.statsRow}>
          {tb1 && inn1 && (
            <div style={s.statBox}>
              <div style={s.statLabel}>🏏 Top Bat · {match.teams[inn1.battingTeamIndex].name}</div>
              <div style={s.statName}>{tb1.name}</div>
              <div style={s.statVal}>{tb1.runs}{!tb1.isOut ? '*' : ''} ({tb1.balls}b){tb1.fours > 0 ? ` · ${tb1.fours}×4` : ''}{tb1.sixes > 0 ? ` · ${tb1.sixes}×6` : ''}</div>
            </div>
          )}
          {tb2 && inn2 && (
            <div style={s.statBox}>
              <div style={s.statLabel}>🏏 Top Bat · {match.teams[inn2.battingTeamIndex].name}</div>
              <div style={s.statName}>{tb2.name}</div>
              <div style={s.statVal}>{tb2.runs}{!tb2.isOut ? '*' : ''} ({tb2.balls}b){tb2.fours > 0 ? ` · ${tb2.fours}×4` : ''}{tb2.sixes > 0 ? ` · ${tb2.sixes}×6` : ''}</div>
            </div>
          )}
        </div>

        {mvp && (
          <div style={s.mvpBox}>
            <span style={{ fontSize: '26px' }}>🌟</span>
            <div>
              <div style={s.mvpLabel}>Player of the Match</div>
              <div style={s.mvpName}>{mvp.name}</div>
              <div style={s.mvpStats}>
                {[
                  mvp.batDidBat && mvp.batRuns > 0 ? `${mvp.batRuns}(${mvp.batBalls}b)` : '',
                  mvp.bowlDidBowl && mvp.bowlWickets > 0 ? `${mvp.bowlWickets}w/${mvp.bowlRunsConceded}` : '',
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={s.footer}>
        <span style={s.footerApp}>cricpad.app</span>
        <span style={s.footerSub}>Score · Share · Celebrate</span>
      </div>
    </div>
  )
})

SocialCard.displayName = 'SocialCard'
export default SocialCard
