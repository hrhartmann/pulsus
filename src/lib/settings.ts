import { useSyncExternalStore } from 'react'

/** Preferencias de este teléfono. Se guardan en localStorage (no van en el respaldo). */
export interface Settings {
  sound: boolean
  volume: number
  /** Bips 3-2-1 antes de que termine cada segmento con timer. */
  countdown: boolean
  voice: boolean
  /** Cómo convive el sonido con la música. Ver src/audio/audio.ts */
  audioMode: 'transient' | 'ambient' | 'playback' | 'auto'
}

const KEY = 'pulsus.settings'
const DEFAULTS: Settings = { sound: true, volume: 0.9, countdown: true, voice: false, audioMode: 'transient' }

let cache: Settings = load()
const listeners = new Set<() => void>()

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function getSettings(): Settings {
  return cache
}

export function setSettings(patch: Partial<Settings>): void {
  cache = { ...cache, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // sin almacenamiento local: queda en memoria
  }
  listeners.forEach((l) => l())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => cache,
  )
}
