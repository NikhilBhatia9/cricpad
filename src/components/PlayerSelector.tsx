import type { Player } from '../types/cricket'
import { useState } from 'react'

interface Props {
  title: string
  players: Player[]
  exclude?: string[]
  onSelect?: (id: string) => void
  isBowler?: boolean
  isTwoStep?: boolean
  currentStriker?: string | null
  currentNonStriker?: string | null
  onSetBatsmen?: (strikerId: string, nonStrikerId: string) => void
  onConfirm?: () => void
}

export default function PlayerSelector({
  title,
  players,
  exclude = [],
  onSelect,
  isBowler,
  isTwoStep,
  currentStriker,
  currentNonStriker,
  onSetBatsmen,
}: Props) {
  const available = players.filter((p) => !exclude.includes(p.id))
  const singlePlayer = available.length === 1

  // Auto-select the sole available player as striker when only one option exists
  const [striker, setStriker] = useState(currentStriker ?? (singlePlayer ? available[0].id : ''))
  const [nonStriker, setNonStriker] = useState(currentNonStriker ?? '')

  if (isTwoStep && onSetBatsmen) {
    // Allow confirming with just a striker when only one batsman is available
    // (e.g. common player is the last remaining batsman — no non-striker possible)
    const canConfirm = striker && (available.length <= 1 || (nonStriker && striker !== nonStriker))
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-6 text-center">{title}</h2>

        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-2">⚡ Striker (on strike)</p>
          <div className="grid grid-cols-2 gap-2">
            {available.map((p) => (
              <button
                key={p.id}
                onClick={() => setStriker(p.id)}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-colors ${
                  striker === p.id ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          {singlePlayer ? (
            <p className="text-sm text-gray-500 italic text-center">No non-striker available</p>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-2">Non-striker</p>
              <div className="grid grid-cols-2 gap-2">
                {available.filter((p) => p.id !== striker).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setNonStriker(p.id)}
                    className={`py-3 px-4 rounded-xl font-semibold text-sm transition-colors ${
                      nonStriker === p.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          disabled={!canConfirm}
          onClick={() => canConfirm && onSetBatsmen(striker, nonStriker)}
          className={`btn-primary ${!canConfirm ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Start Batting →
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-6 text-center">{title}</h2>
      <div className="grid grid-cols-2 gap-3">
        {available.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect?.(p.id)}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 rounded-2xl text-lg transition-colors"
          >
            {isBowler ? '🎯 ' : '🏏 '}{p.name}
          </button>
        ))}
      </div>
      {isBowler && exclude.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-600 text-center uppercase tracking-wide mb-2">Cannot bowl this over</p>
          <div className="grid grid-cols-2 gap-3">
            {players.filter((p) => exclude.includes(p.id)).map((p) => (
              <div
                key={p.id}
                className="bg-gray-800 text-gray-600 font-semibold py-4 rounded-2xl text-lg text-center cursor-not-allowed line-through"
              >
                🎯 {p.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
