import Dexie, { type Table } from 'dexie'
import type { PlayerRecord, MatchRecord, PlayerMatchStat } from './types'

class CricketDB extends Dexie {
  players!: Table<PlayerRecord, string>
  matches!: Table<MatchRecord, string>
  playerStats!: Table<PlayerMatchStat, number>

  constructor() {
    super('CricketDB')
    this.version(1).stores({
      players: 'name',
      matches: 'id, completedAt',
      playerStats: '++id, matchId, playerName',
    })
  }
}

export const db = new CricketDB()
