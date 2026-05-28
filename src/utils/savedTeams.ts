const STORAGE_KEY = 'cricket_saved_teams'

export interface SavedTeam {
  id: string
  name: string
  playerNames: string[]
  updatedAt: string
}

export function getSavedTeams(): SavedTeam[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedTeam[]
  } catch {
    return []
  }
}

export function upsertTeam(team: SavedTeam): void {
  const teams = getSavedTeams()
  const idx = teams.findIndex((t) => t.id === team.id)
  if (idx >= 0) {
    teams[idx] = team
  } else {
    teams.push(team)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams))
}

export function deleteTeam(id: string): void {
  const teams = getSavedTeams().filter((t) => t.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams))
}
