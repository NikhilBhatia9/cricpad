import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type {
  Match, Team, Innings, BallEvent,
} from '../types/cricket'

interface MatchStore {
  match: Match | null
  roomCode: string | null
  undoHistory: Innings[]

  // Setup
  createMatch: (teams: [Team, Team], maxOvers: number) => void
  setToss: (winnerIndex: 0 | 1, elected: 'bat' | 'field') => void

  // During play
  setBatsmen: (strikerId: string, nonStrikerId: string) => void
  setBowler: (bowlerId: string) => void
  recordBall: (ball: Omit<BallEvent, 'id'>) => void
  undoLastBall: () => void

  // Navigation
  startSecondInnings: () => void
  completeMatch: () => void
  resetMatch: () => void

  // Sync
  setRoomCode: (code: string | null) => void
  loadRemoteMatch: (match: Match) => void
}

function createInnings(battingTeamIndex: 0 | 1, target?: number): Innings {
  return {
    battingTeamIndex,
    overs: [],
    batsmen: {},
    bowlers: {},
    fielders: {},
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    totalRuns: 0,
    totalWickets: 0,
    totalLegalBalls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    target,
    isComplete: false,
  }
}

export const useMatchStore = create<MatchStore>()(
  persist(
    (set) => ({
      match: null,
      roomCode: null,
      undoHistory: [],

      createMatch: (teams, maxOvers) => {
        const match: Match = {
          id: uuidv4(),
          teams,
          maxOvers,
          innings: [null, null],
          currentInningsIndex: 0,
          toss: null,
          status: 'toss',
          createdAt: new Date().toISOString(),
        }
        set({ match })
      },

      setToss: (winnerIndex, elected) => {
        set((s) => {
          if (!s.match) return s
          const battingFirst: 0 | 1 =
            (elected === 'bat') === (winnerIndex === 0) ? 0 : 1
          const innings = createInnings(battingFirst)
          const newInnings: [Innings | null, Innings | null] = [innings, null]
          return {
            match: {
              ...s.match,
              toss: { winnerIndex, elected },
              innings: newInnings,
              status: 'live',
            },
          }
        })
      },

      setBatsmen: (strikerId, nonStrikerId) => {
        set((s) => {
          if (!s.match) return s
          const idx = s.match.currentInningsIndex
          const innings = s.match.innings[idx]
          if (!innings) return s

          const batsmen = { ...innings.batsmen }
          const team = s.match.teams[innings.battingTeamIndex]

          if (!batsmen[strikerId]) {
            const p = team.players.find((p) => p.id === strikerId)
            const pos = Object.keys(batsmen).length + 1
            batsmen[strikerId] = { playerId: strikerId, name: p?.name ?? strikerId, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, battingPosition: pos }
          }
          // Only create non-striker entry if a valid (non-empty) ID is provided.
          // An empty string means "last batsman" mode — solo striker, no partner.
          const actualNonStrikerId = nonStrikerId || null
          if (actualNonStrikerId && !batsmen[actualNonStrikerId]) {
            const p = team.players.find((p) => p.id === actualNonStrikerId)
            const pos = Object.keys(batsmen).length + 1
            batsmen[actualNonStrikerId] = { playerId: actualNonStrikerId, name: p?.name ?? actualNonStrikerId, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, battingPosition: pos }
          }

          const updatedInnings = { ...innings, batsmen, strikerId, nonStrikerId: actualNonStrikerId }
          const newInnings = [...s.match.innings] as [Innings | null, Innings | null]
          newInnings[idx] = updatedInnings
          return { match: { ...s.match, innings: newInnings } }
        })
      },

      setBowler: (bowlerId) => {
        set((s) => {
          if (!s.match) return s
          const idx = s.match.currentInningsIndex
          const innings = s.match.innings[idx]
          if (!innings) return s

          const bowlers = { ...innings.bowlers }
          const fieldingTeamIndex: 0 | 1 = innings.battingTeamIndex === 0 ? 1 : 0
          const team = s.match.teams[fieldingTeamIndex]

          if (!bowlers[bowlerId]) {
            const p = team.players.find((p) => p.id === bowlerId)
            bowlers[bowlerId] = { playerId: bowlerId, name: p?.name ?? bowlerId, legalBalls: 0, runsConceded: 0, wickets: 0, wides: 0, noBalls: 0 }
          }

          // Ensure current over exists
          const overs = [...innings.overs]
          const currentOverNum = Math.floor(innings.totalLegalBalls / 6) + 1
          if (overs.length < currentOverNum) {
            overs.push({ number: currentOverNum, balls: [], bowlerId })
          }

          const updatedInnings = { ...innings, bowlers, bowlerId, overs }
          const newInnings = [...s.match.innings] as [Innings | null, Innings | null]
          newInnings[idx] = updatedInnings
          return { match: { ...s.match, innings: newInnings } }
        })
      },

      recordBall: (ballData) => {
        set((s) => {
          if (!s.match) return s
          const idx = s.match.currentInningsIndex
          const innings = s.match.innings[idx]
          if (!innings || !innings.strikerId || !innings.bowlerId) return s

          // Snapshot for undo (keep last 6)
          const newUndoHistory = [...s.undoHistory, innings].slice(-6)

          const ball: BallEvent = { ...ballData, id: uuidv4() }
          const batsmen = { ...innings.batsmen }
          const bowlers = { ...innings.bowlers }
          const extras = { ...innings.extras }

          const striker = { ...batsmen[ball.strikerId] }
          const bowler = { ...bowlers[ball.bowlerId] }

          // Update batsman
          if (ball.isLegal) striker.balls += 1
          striker.runs += ball.runsOffBat
          if (ball.runsOffBat === 4) striker.fours += 1
          if (ball.runsOffBat === 6) striker.sixes += 1
          if (ball.isWicket && ball.wicketType !== 'Run Out') {
            striker.isOut = true
            striker.wicketType = ball.wicketType
            striker.bowledBy = bowler.name
            if (ball.fielderName) striker.fielderName = ball.fielderName
          } else if (ball.isWicket && ball.wicketType === 'Run Out') {
            striker.isOut = true
            striker.wicketType = ball.wicketType
            if (ball.fielderName) striker.fielderName = ball.fielderName
          }
          batsmen[ball.strikerId] = striker

          // Update fielder stats
          const fielders = { ...innings.fielders }
          if (ball.isWicket && ball.fielderId && ball.fielderName) {
            const existing = fielders[ball.fielderId]
            const base = existing ?? { playerId: ball.fielderId, name: ball.fielderName, catches: 0, runOuts: 0, stumpings: 0 }
            if (ball.wicketType === 'Caught') fielders[ball.fielderId] = { ...base, catches: base.catches + 1 }
            else if (ball.wicketType === 'Stumped') fielders[ball.fielderId] = { ...base, stumpings: base.stumpings + 1 }
            else if (ball.wicketType === 'Run Out') fielders[ball.fielderId] = { ...base, runOuts: base.runOuts + 1 }
          }

          // Update bowler
          const totalBallRuns = ball.runsOffBat + ball.extras
          bowler.runsConceded += totalBallRuns
          if (ball.extraType === 'wide') { bowler.wides += 1; extras.wides += ball.extras }
          else if (ball.extraType === 'noball') { bowler.noBalls += 1; extras.noBalls += 1 }
          else if (ball.extraType === 'bye') extras.byes += ball.extras
          else if (ball.extraType === 'legbye') extras.legByes += ball.extras

          if (ball.isLegal) bowler.legalBalls += 1
          if (ball.isWicket && ball.wicketType !== 'Run Out') bowler.wickets += 1
          bowlers[ball.bowlerId] = bowler

          // Add to current over
          const overs = innings.overs.map((o) => ({ ...o, balls: [...o.balls] }))
          const currentOverIndex = overs.length - 1
          if (currentOverIndex >= 0) overs[currentOverIndex].balls.push(ball)

          const newLegalBalls = innings.totalLegalBalls + (ball.isLegal ? 1 : 0)
          const newRuns = innings.totalRuns + ball.runsOffBat + ball.extras
          const newWickets = innings.totalWickets + (ball.isWicket ? 1 : 0)

          // Swap striker on odd runs (off bat only) or end of over
          let { strikerId, nonStrikerId } = innings
          const endOfOver = ball.isLegal && newLegalBalls % 6 === 0

          if (ball.isLegal && !ball.isWicket) {
            if (ball.runsOffBat % 2 === 1) {
              ;[strikerId, nonStrikerId] = [nonStrikerId, strikerId]
            }
          }
          if (endOfOver && !ball.isWicket) {
            ;[strikerId, nonStrikerId] = [nonStrikerId, strikerId]
          }

          const maxBalls = s.match.maxOvers * 6
          // Innings ends when ALL batsmen are dismissed (not teamSize-1).
          // This allows the last remaining batsman to continue batting alone.
          const allOut = newWickets >= s.match.teams[innings.battingTeamIndex].players.length
          const oversUp = newLegalBalls >= maxBalls
          const chased = innings.target !== undefined && newRuns >= innings.target

          let isComplete = allOut || oversUp || chased
          let resultNote: string | undefined

          if (chased) {
            const wicketsLeft = s.match.teams[innings.battingTeamIndex].players.length - 1 - newWickets
            resultNote = `Won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`
          }

          const updatedInnings: Innings = {
            ...innings,
            overs,
            batsmen,
            bowlers,
            fielders,
            extras,
            strikerId: ball.isWicket ? null : strikerId,
            nonStrikerId: ball.isWicket ? nonStrikerId : nonStrikerId,
            totalRuns: newRuns,
            totalWickets: newWickets,
            totalLegalBalls: newLegalBalls,
            isComplete,
            resultNote,
          }

          const newInnings = [...s.match.innings] as [Innings | null, Innings | null]
          newInnings[idx] = updatedInnings

          const newStatus = isComplete
            ? idx === 0 ? 'innings_break' : 'complete'
            : 'live'

          let result = s.match.result
          if (newStatus === 'complete') {
            if (chased) result = `${s.match.teams[innings.battingTeamIndex].name} won! ${resultNote}`
            else {
              const i1 = newInnings[0]!
              const i2 = newInnings[1]!
              if (i2.totalRuns > i1.totalRuns) result = `${s.match.teams[i2.battingTeamIndex].name} won by ${i2.totalRuns - i1.totalRuns} runs`
              else if (i1.totalRuns > i2.totalRuns) result = `${s.match.teams[i1.battingTeamIndex].name} won by ${i1.totalRuns - i2.totalRuns} runs`
              else result = 'Match tied!'
            }
          }

          return { match: { ...s.match, innings: newInnings, status: newStatus, result }, undoHistory: newUndoHistory }
        })
      },

      undoLastBall: () => {
        set((s) => {
          if (!s.match || s.undoHistory.length === 0) return s
          const idx = s.match.currentInningsIndex
          const prevInnings = s.undoHistory[s.undoHistory.length - 1]
          const newUndoHistory = s.undoHistory.slice(0, -1)
          const newInnings = [...s.match.innings] as [Innings | null, Innings | null]
          newInnings[idx] = prevInnings
          return {
            match: { ...s.match, innings: newInnings, status: 'live' },
            undoHistory: newUndoHistory,
          }
        })
      },

      startSecondInnings: () => {
        set((s) => {
          if (!s.match) return s
          // Idempotent: if 2nd innings already in progress, just resume it — never overwrite
          if (s.match.innings[1]) {
            return {
              match: { ...s.match, currentInningsIndex: 1, status: 'live' },
            }
          }
          const firstInnings = s.match.innings[0]
          if (!firstInnings) return s
          const target = firstInnings.totalRuns + 1
          const battingSecond: 0 | 1 = firstInnings.battingTeamIndex === 0 ? 1 : 0
          const secondInnings = createInnings(battingSecond, target)
          const newInnings: [Innings | null, Innings | null] = [firstInnings, secondInnings]
          return {
            match: {
              ...s.match,
              innings: newInnings,
              currentInningsIndex: 1,
              status: 'live',
            },
            undoHistory: [],
          }
        })
      },

      completeMatch: () => {
        set((s) => {
          if (!s.match) return s
          return { match: { ...s.match, status: 'complete' } }
        })
      },

      resetMatch: () => set({ match: null, roomCode: null, undoHistory: [] }),

      setRoomCode: (code) => set({ roomCode: code }),

      loadRemoteMatch: (match) => set({ match }),
    }),
    { name: 'cricket-match', partialize: (s) => ({ match: s.match, roomCode: s.roomCode, undoHistory: s.undoHistory }) }
  )
)
