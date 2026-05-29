import type { Innings } from '../types/cricket'

interface OverBarPoint { over: number; runs: number; rr: number }

export function computeOverData(inn: Innings): OverBarPoint[] {
  return inn.overs.map((o, i) => {
    const runs = o.balls.reduce((s, b) => s + b.runsOffBat + b.extras, 0)
    const legal = o.balls.filter((b) => b.isLegal).length
    const rr = legal > 0 ? (runs / legal) * 6 : 0
    return { over: i + 1, runs, rr: Math.round(rr * 10) / 10 }
  })
}

export function ManhattanChart({ inn1, inn2, team1, team2 }: {
  inn1: Innings | null
  inn2: Innings | null
  team1: string
  team2: string
}) {
  const d1 = inn1 ? computeOverData(inn1) : []
  const d2 = inn2 ? computeOverData(inn2) : []
  if (d1.length === 0 && d2.length === 0) return null

  const numOvers = Math.max(d1.length, d2.length, 1)
  const allRuns = [...d1, ...d2].map((p) => p.runs)
  const maxRuns = Math.max(...allRuns, 6)
  const w = 320; const h = 140
  const padL = 28; const padR = 8; const padT = 10; const padB = 24
  const chartW = w - padL - padR; const chartH = h - padT - padB
  const barW = Math.max(2, Math.floor(chartW / numOvers) - 2)

  function barX(i: number) {
    return padL + Math.floor((i / numOvers) * chartW) + Math.floor((chartW / numOvers - barW) / 2)
  }
  function barH(runs: number) {
    return Math.round((runs / maxRuns) * chartH)
  }

  const yLines = [0, Math.round(maxRuns / 2), maxRuns].filter((v, i, arr) => Number.isFinite(v) && arr.indexOf(v) === i)

  return (
    <div className="card mb-4">
      <p className="text-sm font-semibold text-gray-300 mb-3">📊 Manhattan — Runs per Over</p>
      <div className="flex gap-4 text-xs mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500/70" />
          <span className="text-gray-400">{team1}</span>
        </div>
        {d2.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500/70" />
            <span className="text-gray-400">{team2}</span>
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 160 }}>
        {yLines.map((v) => {
          const y = padT + chartH - Math.round((v / maxRuns) * chartH)
          return (
            <g key={v}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#374151" strokeWidth={0.5} strokeDasharray={v === 0 ? undefined : '3 3'} />
              <text x={padL - 3} y={y + 3} textAnchor="end" fontSize={8} fill="#6b7280">{v}</text>
            </g>
          )
        })}
        {d1.map((p, i) => {
          const bh = barH(p.runs); const x = barX(i); const y = padT + chartH - bh
          return <rect key={`i1-${i}`} x={x} y={y} width={barW} height={bh} rx={2} fill="#22c55e" fillOpacity={0.7} />
        })}
        {d2.map((p, i) => {
          const bh = barH(p.runs); const x = barX(i) + Math.floor(barW * 0.52); const y = padT + chartH - bh
          return <rect key={`i2-${i}`} x={x} y={y} width={Math.max(1, barW - Math.floor(barW * 0.52))} height={bh} rx={2} fill="#3b82f6" fillOpacity={0.7} />
        })}
        {Array.from({ length: numOvers }, (_, i) => i + 1)
          .filter((n) => n === 1 || n % Math.ceil(numOvers / 8) === 0 || n === numOvers)
          .map((n) => (
            <text key={n} x={barX(n - 1) + Math.floor(barW / 2)} y={h - 6} textAnchor="middle" fontSize={8} fill="#6b7280">{n}</text>
          ))}
        <text x={w / 2} y={h - 1} textAnchor="middle" fontSize={7} fill="#4b5563">Over</text>
        {d1.map((p, i) => (
          <text key={`rr1-${i}`} x={barX(i) + Math.floor(barW / 2)} y={padT + chartH - barH(p.runs) - 2} textAnchor="middle" fontSize={7} fill="#86efac" opacity={p.runs >= 10 ? 1 : 0}>{p.runs}</text>
        ))}
        {d2.map((p, i) => (
          <text key={`rr2-${i}`} x={barX(i) + Math.floor(barW * 0.52) + Math.floor((barW - Math.floor(barW * 0.52)) / 2)} y={padT + chartH - barH(p.runs) - 2} textAnchor="middle" fontSize={7} fill="#93c5fd" opacity={p.runs >= 10 ? 1 : 0}>{p.runs}</text>
        ))}
      </svg>
      <div className="mt-2 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {Array.from({ length: Math.max(d1.length, d2.length) }, (_, i) => (
            <div key={i} className="flex flex-col items-center min-w-[28px]">
              <p className="text-xs text-gray-500">{i + 1}</p>
              {d1[i] !== undefined && <p className="text-xs text-green-400 font-semibold">{d1[i].runs}</p>}
              {d2[i] !== undefined && <p className="text-xs text-blue-400 font-semibold">{d2[i].runs}</p>}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-4 mt-2 pt-2 border-t border-gray-700">
        {d1.length > 0 && (
          <p className="text-xs text-gray-400">
            <span className="text-green-400 font-bold">{team1}</span>: avg RR {(d1.reduce((s, p) => s + p.rr, 0) / d1.length).toFixed(1)} · max {Math.max(...d1.map((p) => p.rr)).toFixed(1)}/ov
          </p>
        )}
        {d2.length > 0 && (
          <p className="text-xs text-gray-400">
            <span className="text-blue-400 font-bold">{team2}</span>: avg RR {(d2.reduce((s, p) => s + p.rr, 0) / d2.length).toFixed(1)} · max {Math.max(...d2.map((p) => p.rr)).toFixed(1)}/ov
          </p>
        )}
      </div>
    </div>
  )
}

export function ScoreWorm({ inn1, inn2, team1, team2, maxOvers }: {
  inn1: Innings | null
  inn2: Innings | null
  team1: string
  team2: string
  maxOvers: number
}) {
  function cumulativeData(inn: Innings): { over: number; total: number }[] {
    let total = 0
    const pts: { over: number; total: number }[] = [{ over: 0, total: 0 }]
    inn.overs.forEach((o, i) => {
      total += o.balls.reduce((s, b) => s + b.runsOffBat + b.extras, 0)
      pts.push({ over: i + 1, total })
    })
    return pts
  }

  const d1 = inn1 ? cumulativeData(inn1) : []
  const d2 = inn2 ? cumulativeData(inn2) : []
  if (d1.length < 2 && d2.length < 2) return null

  const target = inn2?.target ?? null
  const maxY = Math.max(
    d1.length > 0 ? Math.max(...d1.map((p) => p.total)) : 0,
    d2.length > 0 ? Math.max(...d2.map((p) => p.total)) : 0,
    target ?? 0, 10,
  )

  const w = 320; const h = 140
  const padL = 28; const padR = 8; const padT = 10; const padB = 24
  const chartW = w - padL - padR; const chartH = h - padT - padB
  const bottom = padT + chartH

  function px(over: number) { return padL + (over / Math.max(maxOvers, 1)) * chartW }
  function py(runs: number) { return padT + chartH - (runs / maxY) * chartH }

  function polylinePoints(data: { over: number; total: number }[]) {
    return data.map((p) => `${px(p.over).toFixed(1)},${py(p.total).toFixed(1)}`).join(' ')
  }
  function areaPath(data: { over: number; total: number }[]) {
    if (data.length < 2) return ''
    const linePts = data.map((p) => `${px(p.over).toFixed(1)},${py(p.total).toFixed(1)}`).join(' L ')
    return `M ${px(data[0].over).toFixed(1)},${bottom} L ${linePts} L ${px(data[data.length - 1].over).toFixed(1)},${bottom} Z`
  }

  const yTicks = [0, Math.round(maxY * 0.5), maxY].filter((v, i, arr) => arr.indexOf(v) === i)

  return (
    <div className="card mb-4">
      <p className="text-sm font-semibold text-gray-300 mb-3">🐛 Score Worm</p>
      <div className="flex flex-wrap gap-4 text-xs mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500/70" />
          <span className="text-gray-400">{team1}</span>
        </div>
        {d2.length >= 2 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500/70" />
            <span className="text-gray-400">{team2}</span>
          </div>
        )}
        {target && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5" style={{ borderTop: '2px dashed #fb923c' }} />
            <span className="text-gray-400">Target {target}</span>
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 160 }}>
        {yTicks.map((v) => {
          const y = py(v)
          return (
            <g key={v}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#374151" strokeWidth={0.5} strokeDasharray={v === 0 ? undefined : '3 3'} />
              <text x={padL - 3} y={y + 3} textAnchor="end" fontSize={8} fill="#6b7280">{v}</text>
            </g>
          )
        })}
        {d1.length >= 2 && <path d={areaPath(d1)} fill="#22c55e" fillOpacity={0.08} />}
        {d2.length >= 2 && <path d={areaPath(d2)} fill="#3b82f6" fillOpacity={0.08} />}
        {target && <line x1={padL} x2={w - padR} y1={py(target)} y2={py(target)} stroke="#fb923c" strokeWidth={1.5} strokeDasharray="5 3" />}
        {d1.length >= 2 && <polyline points={polylinePoints(d1)} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
        {d2.length >= 2 && <polyline points={polylinePoints(d2)} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
        {d1.slice(1).map((p, i) => <circle key={`d1-${i}`} cx={px(p.over)} cy={py(p.total)} r={2} fill="#22c55e" />)}
        {d2.slice(1).map((p, i) => <circle key={`d2-${i}`} cx={px(p.over)} cy={py(p.total)} r={2} fill="#3b82f6" />)}
        {Array.from({ length: maxOvers + 1 }, (_, i) => i)
          .filter((n) => n === 0 || n % Math.max(1, Math.ceil(maxOvers / 8)) === 0 || n === maxOvers)
          .map((n) => (
            <text key={n} x={px(n)} y={h - 6} textAnchor="middle" fontSize={8} fill="#6b7280">{n}</text>
          ))}
        <text x={w / 2} y={h - 1} textAnchor="middle" fontSize={7} fill="#4b5563">Over</text>
      </svg>
    </div>
  )
}

export function FallOfWicketsTimeline({ inn }: { inn: Innings }) {
  const fow = inn.fallOfWickets ?? []
  const totalRuns = inn.totalRuns

  if (fow.length === 0) {
    return (
      <div className="mb-3">
        <p className="text-xs text-gray-500 font-semibold mb-1">Fall of Wickets</p>
        <p className="text-xs text-gray-400">No wickets lost</p>
      </div>
    )
  }

  const w = 300; const svgH = 54; const lineY = 20; const padH = 12

  type FowGroup = { runs: number; items: typeof fow }
  const groups: FowGroup[] = []
  fow.forEach((f) => {
    const g = groups.find((group) => group.runs === f.runs)
    if (g) g.items.push(f)
    else groups.push({ runs: f.runs, items: [f] })
  })

  function xPos(runs: number) {
    if (totalRuns === 0) return padH
    return padH + ((runs / totalRuns) * (w - padH * 2))
  }

  return (
    <div className="mb-3">
      <p className="text-xs text-gray-500 font-semibold mb-1">Fall of Wickets</p>
      <svg viewBox={`0 0 ${w} ${svgH}`} className="w-full text-gray-400" style={{ maxHeight: 60 }}>
        <line x1={padH} y1={lineY} x2={w - padH} y2={lineY} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1.5} />
        <circle cx={padH} cy={lineY} r={2.5} fill="currentColor" fillOpacity={0.3} />
        <circle cx={w - padH} cy={lineY} r={2.5} fill="currentColor" fillOpacity={0.3} />
        <text x={padH} y={lineY + 12} textAnchor="middle" fontSize={7} fill="#6b7280">0</text>
        <text x={w - padH} y={lineY + 12} textAnchor="middle" fontSize={7} fill="#6b7280">{totalRuns}</text>
        {groups.map((group, gi) =>
          group.items.map((f, fi) => {
            const x = xPos(group.runs); const xAdjusted = x + fi * 6; const dotY = lineY - (fi * 10)
            return (
              <g key={`${gi}-${fi}`}>
                <line x1={xAdjusted} y1={dotY} x2={xAdjusted} y2={lineY} stroke="#ef4444" strokeWidth={1} strokeOpacity={0.6} />
                <circle cx={xAdjusted} cy={dotY} r={5} fill="#ef4444" fillOpacity={0.85} />
                <text x={xAdjusted} y={dotY + 3.5} textAnchor="middle" fontSize={6} fill="white" fontWeight="bold">{f.wicketNum}</text>
                <text x={xAdjusted} y={lineY + 12} textAnchor="middle" fontSize={6.5} fill="#f87171">{f.runs}</text>
                {fi === 0 && (
                  <text x={xAdjusted} y={svgH - 2} textAnchor="middle" fontSize={5.5} fill="#9ca3af">
                    {f.batsmanName.length > 8 ? `${f.batsmanName.slice(0, 7)}…` : f.batsmanName}
                  </text>
                )}
              </g>
            )
          })
        )}
      </svg>
    </div>
  )
}
