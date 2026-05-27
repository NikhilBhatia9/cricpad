import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatchStore } from '../store/matchStore'
import { oversDisplay, runRate, requiredRunRate, currentOverBalls, ballColorClass } from '../utils/cricket'
import type { WicketType, ExtraType, Over, Innings } from '../types/cricket'
import PlayerSelector from '../components/PlayerSelector'
import ShareMatchModal from '../components/ShareMatchModal'

const WICKET_TYPES: WicketType[] = ['Bowled', 'Caught', 'LBW', 'Run Out', 'Stumped', 'Hit Wicket', 'Retired']
const FIELDER_WICKETS: WicketType[] = ['Caught', 'Run Out', 'Stumped']

const EXTRA_LABELS: Record<ExtraType, string> = {
  wide: 'Wide',
  noball: 'No Ball',
  bye: 'Bye',
  legbye: 'Leg Bye',
}

function OverSummary({ over, bowlerName, onContinue }: { over: Over; bowlerName: string; onContinue: () => void }) {
  const balls = over.balls
  const runsInOver = balls.reduce((s, b) => s + b.runsOffBat + b.extras, 0)
  const wicketsInOver = balls.filter((b) => b.isWicket).length
  const legalBalls = balls.filter((b) => b.isLegal).length
  const isMaiden = legalBalls >= 6 && runsInOver === 0
  const ballDisplay = currentOverBalls({ ...over, balls })

  return (
    <div className="flex flex-col min-h-screen items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm">
        <div className="text-5xl mb-3">{isMaiden ? '\uD83D\uDD07' : wicketsInOver > 0 ? '\uD83C\uDFAF' : '\uD83C\uDFCF'}</div>
        <h2 className="text-2xl font-bold mb-1">Over {over.number} Complete</h2>
        <p className="text-gray-400 text-sm mb-5">{bowlerName}</p>

        {isMaiden && (
          <div className="bg-teal-500/20 border border-teal-500/40 text-teal-300 font-bold px-4 py-2 rounded-full text-sm mb-4 inline-block">
            MAIDEN OVER!
          </div>
        )}

        {/* Ball dots */}
        <div className="flex gap-2 justify-center mb-6 flex-wrap">
          {ballDisplay.map((b, i) => (
            <div key={i} className={`ball-dot text-sm ${ballColorClass(b)}`}>{b}</div>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-800 rounded-xl py-3">
            <p className="text-2xl font-bold text-white">{runsInOver}</p>
            <p className="text-xs text-gray-500">Runs</p>
          </div>
          <div className="bg-gray-800 rounded-xl py-3">
            <p className="text-2xl font-bold text-red-400">{wicketsInOver}</p>
            <p className="text-xs text-gray-500">Wickets</p>
          </div>
          <div className="bg-gray-800 rounded-xl py-3">
            <p className="text-2xl font-bold text-yellow-400">{legalBalls > 0 ? ((runsInOver / legalBalls) * 6).toFixed(1) : '0.0'}</p>
            <p className="text-xs text-gray-500">Economy</p>
          </div>
        </div>

        <button onClick={onContinue} className="btn-primary">
          Next Over &rarr;
        </button>
      </div>
    </div>
  )
}

function partnershipRunsFrom(innings: Innings): number {
  const allBalls = innings.overs.flatMap((o) => o.balls)
  let runs = 0
  for (let i = allBalls.length - 1; i >= 0; i--) {
    if (allBalls[i].isWicket) break
    runs += allBalls[i].runsOffBat + allBalls[i].extras
  }
  return runs
}

export default function Scoring() {
  const navigate = useNavigate()
  const { match, setBatsmen, setBowler, recordBall, undoLastBall, undoHistory } = useMatchStore()

  const [showWicketModal, setShowWicketModal] = useState(false)
  const [pendingExtra, setPendingExtra] = useState<ExtraType | null>(null)
  const [showShare, setShowShare] = useState(false)
  const [showNewBatsman, setShowNewBatsman] = useState(false)
  const [pendingWicketType, setPendingWicketType] = useState<WicketType | null>(null)
  const [showFielderSelect, setShowFielderSelect] = useState(false)
  const [showRunOutVictim, setShowRunOutVictim] = useState(false)
  const [runOutNonStriker, setRunOutNonStriker] = useState(false)
  const [overSummaryDismissed, setOverSummaryDismissed] = useState(-1)
  const [milestone, setMilestone] = useState<{ emoji: string; title: string; subtitle: string } | null>(null)
  const prevInningsRef = useRef<Innings | null>(null)

  useEffect(() => {
    if (!match) return
    const inningsIdx = match.currentInningsIndex
    const innings = match.innings[inningsIdx]
    if (!innings) return
    const prev = prevInningsRef.current
    if (prev && innings !== prev) {
      let milestoneSet = false
      // Batting milestones
      if (innings.strikerId) {
        const curr = innings.batsmen[innings.strikerId]
        const prevBat = (prev.batsmen as Record<string, typeof curr | undefined>)[innings.strikerId]
        if (curr && prevBat && !curr.isOut) {
          const p = prevBat.runs
          const c = curr.runs
          if (p < 100 && c >= 100) {
            setMilestone({ emoji: '💯', title: 'CENTURY!', subtitle: `${curr.name} reaches 100!` })
            milestoneSet = true
          } else if (p < 50 && c >= 50) {
            setMilestone({ emoji: '🔥', title: 'HALF CENTURY!', subtitle: `${curr.name} reaches 50!` })
            milestoneSet = true
          } else if (p < 25 && c >= 25) {
            setMilestone({ emoji: '⭐', title: '25 UP!', subtitle: `${curr.name} reaches 25!` })
            milestoneSet = true
          }
        }
      }
      // Bowling milestones
      if (!milestoneSet && innings.bowlerId) {
        const curr = innings.bowlers[innings.bowlerId]
        const prevBowl = (prev.bowlers as Record<string, typeof curr | undefined>)[innings.bowlerId]
        if (curr && prevBowl && curr.wickets > prevBowl.wickets) {
          const w = curr.wickets
          if (w >= 5) {
            setMilestone({ emoji: '🎳', title: `${w}-FER!`, subtitle: `${curr.name} takes ${w} wickets!` })
          } else if (w === 4) {
            setMilestone({ emoji: '🎯', title: '4-FER!', subtitle: `${curr.name} takes 4 wickets!` })
          } else if (w === 3) {
            setMilestone({ emoji: '🎯', title: '3-FER!', subtitle: `${curr.name} takes 3 wickets!` })
          } else if (w === 2) {
            setMilestone({ emoji: '🎯', title: 'DOUBLE STRIKE!', subtitle: `${curr.name} takes 2nd wicket!` })
          }
          milestoneSet = true
        }
      }
      // Partnership milestones
      if (!milestoneSet && innings.strikerId && innings.nonStrikerId) {
        const currP = partnershipRunsFrom(innings)
        const prevP = partnershipRunsFrom(prev)
        for (const threshold of [100, 75, 50, 25]) {
          if (prevP < threshold && currP >= threshold) {
            const s = innings.batsmen[innings.strikerId]?.name ?? ''
            const ns = innings.batsmen[innings.nonStrikerId]?.name ?? ''
            setMilestone({ emoji: '🤝', title: `${threshold} PARTNERSHIP!`, subtitle: `${s} & ${ns}` })
            milestoneSet = true
            break
          }
        }
      }
    }
    prevInningsRef.current = innings
  }, [match])

  useEffect(() => {
    if (!milestone) return
    const t = setTimeout(() => setMilestone(null), 3000)
    return () => clearTimeout(t)
  }, [milestone])

  if (!match) return <div className="p-6 text-center">No match. <button onClick={() => navigate('/')} className="text-green-400">Go home</button></div>

  const idx = match.currentInningsIndex
  const innings = match.innings[idx]

  if (!innings) return <div className="p-6 text-center">Innings not started.</div>

  if (innings.isComplete) {
    if (idx === 0) navigate('/innings-break', { replace: true })
    else navigate('/result', { replace: true })
    return null
  }

  const battingTeam = match.teams[innings.battingTeamIndex]
  const fieldingTeamIndex: 0 | 1 = innings.battingTeamIndex === 0 ? 1 : 0
  const fieldingTeam = match.teams[fieldingTeamIndex]
  const currentOver = innings.overs[innings.overs.length - 1]
  const overBalls = currentOverBalls(currentOver)
  const overNum = Math.floor(innings.totalLegalBalls / 6) + 1

  const needsBatsmen = !innings.strikerId && !innings.nonStrikerId
  const needsBowler = !innings.bowlerId
  const isNewOver = innings.totalLegalBalls > 0 &&
    innings.totalLegalBalls % 6 === 0 &&
    innings.overs.length < Math.floor(innings.totalLegalBalls / 6) + 1

  const striker = innings.strikerId ? innings.batsmen[innings.strikerId] : null
  const nonStriker = innings.nonStrikerId ? innings.batsmen[innings.nonStrikerId] : null
  const bowler = innings.bowlerId ? innings.bowlers[innings.bowlerId] : null

  // Shared-player conflict prevention:
  // A player assigned to both teams has the same name but different IDs in each team.
  // If they are currently batting, exclude their fielding-team counterpart from the bowler list.
  // If they are currently bowling, exclude their batting-team counterpart from the batsman list.
  const activeBatsmanNames = [
    innings.strikerId ? innings.batsmen[innings.strikerId]?.name : null,
    innings.nonStrikerId ? innings.batsmen[innings.nonStrikerId]?.name : null,
  ].filter((n): n is string => !!n)

  const activeBowlerName = innings.bowlerId ? (innings.bowlers[innings.bowlerId]?.name ?? null) : null

  const bowlerExcludeShared = fieldingTeam.players
    .filter(p => activeBatsmanNames.includes(p.name))
    .map(p => p.id)

  const batsmanExcludeShared = activeBowlerName
    ? battingTeam.players.filter(p => p.name === activeBowlerName).map(p => p.id)
    : []

  const lastOverBowlerId = isNewOver && innings.overs.length > 0
    ? innings.overs[innings.overs.length - 1].bowlerId
    : null

  function recordRuns(runs: number) {
    if (!innings!.strikerId || !innings!.bowlerId) return
    const extra = pendingExtra
    const isLegal = extra !== 'wide' && extra !== 'noball'
    recordBall({
      runsOffBat: extra === 'wide' || extra === 'bye' || extra === 'legbye' ? 0 : runs,
      // Wide:   1 (penalty) + any runs  → extras = 1 + runs
      // No Ball: 1 (penalty) only       → extras = 1  (runs off bat counted separately via runsOffBat)
      // Bye/Leg: runs count as extras   → extras = runs
      extras: extra === 'wide' ? 1 + runs : extra === 'noball' ? 1 : extra ? runs : 0,
      extraType: extra ?? undefined,
      isWicket: false,
      strikerId: innings!.strikerId!,
      bowlerId: innings!.bowlerId!,
      isLegal,
    })
    setPendingExtra(null)
  }

  function handleWicketType(type: WicketType) {
    setShowWicketModal(false)
    if (type === 'Run Out') {
      setPendingWicketType(type)
      setShowRunOutVictim(true)
    } else if (FIELDER_WICKETS.includes(type)) {
      setPendingWicketType(type)
      setShowFielderSelect(true)
    } else {
      commitWicket(type, undefined, undefined)
    }
  }

  function commitWicket(type: WicketType, fielderId: string | undefined, fielderName: string | undefined) {
    if (!innings!.strikerId || !innings!.bowlerId) return
    recordBall({
      runsOffBat: 0,
      extras: 0,
      isWicket: true,
      wicketType: type,
      fielderId,
      fielderName,
      strikerId: innings!.strikerId!,
      bowlerId: innings!.bowlerId!,
      isLegal: true,
      runOutNonStriker: type === 'Run Out' ? runOutNonStriker : false,
    })
    setPendingWicketType(null)
    setShowFielderSelect(false)
    setRunOutNonStriker(false)
    setShowNewBatsman(true)
  }

  // ── Milestone celebration overlay ──
  if (milestone) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-center px-8"
        onClick={() => setMilestone(null)}
      >
        <div className="text-8xl mb-5 animate-bounce">{milestone.emoji}</div>
        <h2 className="text-4xl font-extrabold text-white mb-2 tracking-tight">{milestone.title}</h2>
        <p className="text-gray-300 text-lg">{milestone.subtitle}</p>
        <p className="text-gray-500 text-sm mt-8">Tap to continue</p>
      </div>
    )
  }

  // ── 1. New batsman after wicket ──
  if (showNewBatsman) {
    // Determine which position needs filling
    const strikerDismissed = innings.strikerId === null
    const stayingPlayerId = strikerDismissed ? (innings.nonStrikerId ?? '') : (innings.strikerId ?? '')
    const alreadyOut = Object.keys(innings.batsmen).filter((id) => innings.batsmen[id].isOut)
    const available = battingTeam.players.filter(
      (p) => !alreadyOut.includes(p.id) && p.id !== stayingPlayerId && !batsmanExcludeShared.includes(p.id)
    )

    // No replacement available — last batsman scenario
    if (available.length === 0) {
      const lastManName = strikerDismissed
        ? innings.batsmen[innings.nonStrikerId ?? '']?.name ?? 'Last player'
        : innings.batsmen[innings.strikerId ?? '']?.name ?? 'Last player'
      return (
        <div className="flex flex-col min-h-screen items-center justify-center px-6 text-center">
          <div className="text-5xl mb-3">&#x1F3CF;</div>
          <h2 className="text-xl font-bold mb-2">Last Batsman</h2>
          <p className="text-gray-400 mb-6">{lastManName} is the last batsman remaining.</p>
          <button
            className="btn-primary"
            onClick={() => {
              if (strikerDismissed && innings.nonStrikerId) setBatsmen(innings.nonStrikerId!, '')
              // Non-striker dismissed: strikerId already set, nonStrikerId already null — no update needed
              setShowNewBatsman(false)
            }}
          >
            Continue &rarr;
          </button>
        </div>
      )
    }

    return (
      <PlayerSelector
        title="New Batsman"
        players={battingTeam.players}
        exclude={[...alreadyOut, stayingPlayerId, ...batsmanExcludeShared]}
        onSelect={(id) => {
          if (strikerDismissed) {
            setBatsmen(id, innings.nonStrikerId ?? '')
          } else {
            // Non-striker was run out — new batsman goes to non-striker end
            setBatsmen(innings.strikerId!, id)
          }
          setShowNewBatsman(false)
        }}
      />
    )
  }

  // ── 2. Run out victim selection ──
  if (showRunOutVictim && pendingWicketType === 'Run Out') {
    return (
      <div className="flex flex-col min-h-screen px-4 py-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-2 text-center text-red-400">&#x26A1; Run Out! Who is out?</h2>
        <p className="text-gray-400 text-sm text-center mb-6">Select the batsman who was run out</p>
        <div className="space-y-3 mb-4">
          <button
            onClick={() => { setRunOutNonStriker(false); setShowRunOutVictim(false); setShowFielderSelect(true) }}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-5 rounded-2xl text-lg transition-colors"
          >
            &#x26A1; {striker?.name ?? 'Striker'}
            <span className="block text-xs text-gray-400 font-normal mt-1">on strike</span>
          </button>
          {nonStriker && (
            <button
              onClick={() => { setRunOutNonStriker(true); setShowRunOutVictim(false); setShowFielderSelect(true) }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-5 rounded-2xl text-lg transition-colors"
            >
              &#x26A1; {nonStriker.name}
              <span className="block text-xs text-gray-400 font-normal mt-1">non-striker</span>
            </button>
          )}
        </div>
        <button className="btn-secondary" onClick={() => { setShowRunOutVictim(false); setPendingWicketType(null) }}>
          Cancel
        </button>
      </div>
    )
  }

  // ── 3. Fielder selection ──
  if (showFielderSelect && pendingWicketType) {
    const fielderIcon = pendingWicketType === 'Caught' ? '\uD83D\uDC50' : pendingWicketType === 'Stumped' ? '\uD83E\uDDE4' : '\u26A1'
    const fielderTitle = pendingWicketType === 'Caught' ? `${fielderIcon} Who caught it?` :
      pendingWicketType === 'Stumped' ? `${fielderIcon} Who stumped?` :
      `${fielderIcon} Who ran them out?`
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-2 text-center">{fielderTitle}</h2>
        <p className="text-gray-400 text-sm text-center mb-5">Select the fielder</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {fieldingTeam.players.map((p) => (
            <button
              key={p.id}
              onClick={() => commitWicket(pendingWicketType!, p.id, p.name)}
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 rounded-2xl text-lg transition-colors"
            >
              {fielderIcon} {p.name}
            </button>
          ))}
        </div>
        <button
          className="btn-secondary w-full"
          onClick={() => commitWicket(pendingWicketType!, undefined, undefined)}
        >
          Skip (unknown fielder)
        </button>
      </div>
    )
  }

  // ── 3. Opening batsmen ──
  if (needsBatsmen) {
    return (
      <PlayerSelector
        title="Select Opening Batsmen"
        players={battingTeam.players}
        exclude={[
          ...Object.keys(innings.batsmen).filter((id) => innings.batsmen[id].isOut),
          ...batsmanExcludeShared,
        ]}
        isTwoStep
        currentStriker={innings.strikerId}
        currentNonStriker={innings.nonStrikerId}
        onSetBatsmen={(s, ns) => setBatsmen(s, ns)}
      />
    )
  }

  // ── 4. Over summary (after over ends, before bowler select) ──
  if (isNewOver && innings.totalLegalBalls !== overSummaryDismissed) {
    const justCompletedOver = innings.overs[innings.overs.length - 1]
    const bowlerName = justCompletedOver ? (innings.bowlers[justCompletedOver.bowlerId]?.name ?? 'Unknown') : 'Unknown'
    return (
      <OverSummary
        over={justCompletedOver}
        bowlerName={bowlerName}
        onContinue={() => setOverSummaryDismissed(innings.totalLegalBalls)}
      />
    )
  }

  // ── 5. Bowler selector ──
  if (needsBowler || isNewOver) {
    return (
      <PlayerSelector
        title={`Select Bowler ${'\u2014'} Over ${overNum}`}
        players={fieldingTeam.players}
        exclude={[
          ...(lastOverBowlerId ? [lastOverBowlerId] : []),
          ...bowlerExcludeShared,
        ]}
        onSelect={(id) => { setBowler(id) }}
        isBowler
      />
    )
  }

  // ── 6. Wicket type modal ──
  if (showWicketModal) {
    return (
      <div className="flex flex-col min-h-screen px-4 py-6">
        <h2 className="text-xl font-bold mb-6 text-center text-red-400">Wicket! How out?</h2>
        <div className="grid grid-cols-2 gap-3">
          {WICKET_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => handleWicketType(t)}
              className="bg-red-700 hover:bg-red-600 text-white font-semibold py-4 rounded-xl text-lg"
            >
              {t}
            </button>
          ))}
        </div>
        <button className="btn-secondary mt-4" onClick={() => setShowWicketModal(false)}>Cancel</button>
      </div>
    )
  }

  // ── Partnership tracker ──
  const allBalls = innings.overs.flatMap((o) => o.balls)
  const partnershipRuns = partnershipRunsFrom(innings)
  let partnershipBalls = 0
  for (let i = allBalls.length - 1; i >= 0; i--) {
    const b = allBalls[i]
    if (b.isWicket) break
    if (b.isLegal) partnershipBalls++
  }

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      {/* Score header */}
      <div className="bg-gray-800 px-4 py-4">
        <div className="flex justify-between items-start mb-1">
          <div>
            <p className="text-xs text-gray-400">{battingTeam.name}</p>
            <p className="text-4xl font-bold">{innings.totalRuns}<span className="text-2xl text-gray-400">/{innings.totalWickets}</span></p>
            <p className="text-gray-400 text-sm">
              {oversDisplay(innings.totalLegalBalls)} ov
              {' \u00b7 '}RR {runRate(innings.totalRuns, innings.totalLegalBalls)}
            </p>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <button
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              onClick={() => setShowShare(true)}
            >
              Share
            </button>
            <p className="text-xs text-gray-400">{match.maxOvers} overs</p>
            {innings.target && (() => {
              const ballsLeft = match.maxOvers * 6 - innings.totalLegalBalls
              const rrr = requiredRunRate(innings.target, innings.totalRuns, ballsLeft)
              const rrrNum = parseFloat(rrr)
              const rrrColor = isNaN(rrrNum) ? 'text-gray-400'
                : rrrNum >= 18 ? 'text-red-400 font-bold animate-pulse'
                : rrrNum >= 13 ? 'text-red-400 font-bold'
                : rrrNum >= 9  ? 'text-orange-400 font-semibold'
                : rrrNum >= 7  ? 'text-yellow-400'
                : 'text-green-400'
              return (
                <div className="text-right">
                  <p className="text-sm">Target <span className="font-bold text-yellow-400">{innings.target}</span></p>
                  <p className="text-xs text-gray-400">
                    Need {innings.target - innings.totalRuns} off {ballsLeft} balls
                  </p>
                  <p className={`text-sm ${rrrColor}`}>RRR {rrr}</p>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Current over balls */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {overBalls.map((b, i) => (
            <div key={i} className={`ball-dot ${ballColorClass(b)}`}>{b}</div>
          ))}
          {overBalls.length === 0 && <p className="text-xs text-gray-500">Over {overNum} {'\u2014'} no balls yet</p>}
        </div>
      </div>

      {/* Current players */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex gap-2 text-sm mb-2">
          {[striker, nonStriker].map((b, i) => b && (
            <div key={i} className={`flex-1 bg-gray-800 rounded-xl px-3 py-2 ${i === 0 ? 'border border-green-600' : ''}`}>
              <p className="font-semibold truncate">{b.name} {i === 0 ? '\u26a1' : ''}</p>
              <p className="text-gray-400">{b.runs}<span className="text-xs"> ({b.balls})</span></p>
            </div>
          ))}
        </div>
        {/* Partnership */}
        {striker && nonStriker && (
          <div className="flex items-center justify-center gap-1.5 mb-2 py-1">
            <div className="h-px flex-1 bg-gray-700" />
            <p className="text-xs text-gray-400 font-medium">
              Partnership: <span className="text-white font-bold">{partnershipRuns}</span>
              <span className="text-gray-500"> ({partnershipBalls}b)</span>
            </p>
            <div className="h-px flex-1 bg-gray-700" />
          </div>
        )}
        {bowler && (
          <div className="bg-gray-800 rounded-xl px-3 py-2 text-sm">
            <p className="text-gray-400 text-xs">Bowling</p>
            <p className="font-semibold">
              {bowler.name}
              {' \u00b7 '}
              {Math.floor(bowler.legalBalls / 6)}.{bowler.legalBalls % 6} ov
              {' \u00b7 '}
              {bowler.wickets}w
              {' \u00b7 '}
              {bowler.runsConceded}r
            </p>
          </div>
        )}
      </div>

      {/* Extra toggle */}
      <div className="px-4 pt-3">
        <div className="flex gap-2 mb-3">
          {(['wide', 'noball', 'bye', 'legbye'] as ExtraType[]).map((e) => (
            <button
              key={e}
              onClick={() => {
                if (e === 'wide') {
                  // Wides auto-record as 1 extra immediately — no run tap needed
                  if (!innings!.strikerId || !innings!.bowlerId) return
                  recordBall({
                    runsOffBat: 0,
                    extras: 1,
                    extraType: 'wide',
                    isWicket: false,
                    strikerId: innings!.strikerId!,
                    bowlerId: innings!.bowlerId!,
                    isLegal: false,
                  })
                } else {
                  setPendingExtra(pendingExtra === e ? null : e)
                }
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                pendingExtra === e ? 'bg-yellow-400 text-black ring-2 ring-yellow-300' : 'bg-gray-700 text-gray-300'
              }`}
            >
              {EXTRA_LABELS[e]}
            </button>
          ))}
        </div>

        {pendingExtra && pendingExtra !== 'wide' && (
          <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-1.5 mb-3 text-center">
            <p className="text-yellow-300 text-sm font-semibold">{EXTRA_LABELS[pendingExtra]} selected {'\u2014'} tap runs scored</p>
          </div>
        )}

        {/* Run buttons */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          {[0, 1, 2, 3].map((r) => (
            <button
              key={r}
              onClick={() => recordRuns(r)}
              className="bg-gray-700 hover:bg-gray-600 active:bg-gray-900 text-white text-2xl font-bold py-5 rounded-2xl transition-colors"
            >
              {r}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <button onClick={() => recordRuns(4)} className="bg-blue-700 hover:bg-blue-600 text-white text-2xl font-bold py-5 rounded-2xl">4</button>
          <button onClick={() => recordRuns(6)} className="bg-purple-700 hover:bg-purple-600 text-white text-2xl font-bold py-5 rounded-2xl">6</button>
          <button
            onClick={() => setShowWicketModal(true)}
            className="bg-red-700 hover:bg-red-600 text-white text-2xl font-bold py-5 rounded-2xl"
          >
            W
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 pb-6 flex gap-3 mt-auto pt-2">
        <button
          onClick={undoLastBall}
          disabled={undoHistory.length === 0}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
            undoHistory.length > 0
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          &#x21A9; Undo{undoHistory.length > 0 ? ` (${undoHistory.length})` : ''}
        </button>
        <button onClick={() => navigate('/')} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl text-sm font-semibold">
          &#x1F3E0; Menu
        </button>
      </div>

      {showShare && <ShareMatchModal onClose={() => setShowShare(false)} />}
    </div>
  )
}
