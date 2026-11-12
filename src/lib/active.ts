import type { PlayerState } from '../engine/player'
import type { Routine } from '../types'

/**
 * La rutina en curso se guarda en localStorage en cada cambio. Si iOS recarga la app
 * (por ejemplo, al volver de otra app), el reproductor continúa donde iba.
 */
export interface ActiveRun {
  routine: Routine
  state: PlayerState
  sessionId: string
}

const KEY = 'pulsus.active'

export function loadActive(): ActiveRun | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ActiveRun) : null
  } catch {
    return null
  }
}

export function saveActive(run: ActiveRun): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(run))
  } catch {
    // sin almacenamiento local
  }
}

export function clearActive(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nada
  }
}
