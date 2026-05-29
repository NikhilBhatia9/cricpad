import { fetchSavedTeams, upsertSavedTeam, deleteSavedTeam } from '../db/operations'
import type { SavedTeamRecord } from '../db/types'

// Keep the SavedTeam alias for backward compat across the codebase
export type SavedTeam = SavedTeamRecord

const LEGACY_KEY = 'cricket_saved_teams'

/**
 * One-time migration: if localStorage has teams and Supabase is empty,
 * upload localStorage teams to Supabase so the primary device's data is preserved.
 */
async function migrateFromLocalStorage(): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return
    const local: SavedTeam[] = JSON.parse(raw)
    if (!local.length) return
    // Only migrate if Supabase is empty to avoid duplicates
    const remote = await fetchSavedTeams()
    if (remote.length > 0) {
      localStorage.removeItem(LEGACY_KEY)
      return
    }
    for (const team of local) {
      await upsertSavedTeam(team)
    }
    localStorage.removeItem(LEGACY_KEY)
  } catch (e) {
    console.error('[savedTeams] migration failed:', e)
  }
}

export async function getSavedTeams(): Promise<SavedTeam[]> {
  try {
    await migrateFromLocalStorage()
    return await fetchSavedTeams()
  } catch (e) {
    console.error('[savedTeams] fetch failed:', e)
    return []
  }
}

export async function upsertTeam(team: SavedTeam): Promise<void> {
  return upsertSavedTeam(team)
}

export async function deleteTeam(id: string): Promise<void> {
  return deleteSavedTeam(id)
}

