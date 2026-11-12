import type { Exercise, Routine } from '../types'
import { db, newId } from './db'

const SEEDED_KEY = 'pulsus.seeded'

/** La primera vez que se abre la app carga ejercicios y rutinas de ejemplo, para no partir en blanco. */
export async function seedIfFirstRun(): Promise<void> {
  try {
    if (localStorage.getItem(SEEDED_KEY)) return
  } catch {
    return
  }
  const count = await db.exercises.count()
  if (count === 0) await loadExamples()
  try {
    localStorage.setItem(SEEDED_KEY, '1')
  } catch {
    // sin almacenamiento local
  }
}

export async function loadExamples(): Promise<void> {
  const now = Date.now()
  const mk = (name: string, emoji: string, color: string, mode: 'time' | 'reps', seconds: number, reps: number, notes?: string): Exercise => ({
    id: newId(),
    name,
    icon: { kind: 'emoji', value: emoji },
    color,
    notes,
    defaultMode: mode,
    defaultSeconds: seconds,
    defaultReps: reps,
    createdAt: now,
    updatedAt: now,
  })

  const sentadillas = mk('Sentadillas', '🦵', 'orange', 'time', 40, 15, 'Rodillas en línea con los pies, espalda recta.')
  const flexiones = mk('Flexiones', '💪', 'red', 'reps', 30, 12)
  const plancha = mk('Plancha', '🧱', 'amber', 'time', 45, 0, 'Cadera alineada, abdomen apretado.')
  const burpees = mk('Burpees', '🔥', 'pink', 'time', 30, 10)
  const escaladores = mk('Escaladores', '⛰️', 'lime', 'time', 30, 20)
  const pressBanca = mk('Press banca', '🏋️', 'sky', 'reps', 40, 10)
  const remo = mk('Remo con barra', '🚣', 'indigo', 'reps', 40, 10)
  const dominadas = mk('Dominadas', '🧗', 'violet', 'reps', 30, 8)

  const step = (ex: Exercise, over: Partial<{ mode: 'time' | 'reps'; seconds: number; reps: number; sets: number; restBetweenSets: number; note: string }> = {}) => ({
    id: newId(),
    type: 'exercise' as const,
    exerciseId: ex.id,
    mode: over.mode ?? ex.defaultMode,
    seconds: over.seconds ?? ex.defaultSeconds,
    reps: over.reps ?? ex.defaultReps,
    sets: over.sets ?? 1,
    restBetweenSets: over.restBetweenSets ?? 0,
    note: over.note,
  })
  const rest = (seconds: number) => ({ id: newId(), type: 'rest' as const, seconds })

  const hiit: Routine = {
    id: newId(),
    name: 'HIIT en casa',
    icon: { kind: 'emoji', value: '⚡' },
    color: 'orange',
    prepSeconds: 10,
    rounds: 3,
    restBetweenRounds: 60,
    steps: [
      step(sentadillas, { mode: 'time', seconds: 40 }),
      rest(20),
      step(burpees, { mode: 'time', seconds: 30 }),
      rest(20),
      step(escaladores, { mode: 'time', seconds: 30 }),
      rest(20),
      step(plancha, { mode: 'time', seconds: 45 }),
    ],
    createdAt: now,
    updatedAt: now,
  }

  const gym: Routine = {
    id: newId(),
    name: 'Pecho y espalda',
    icon: { kind: 'emoji', value: '🏋️' },
    color: 'sky',
    prepSeconds: 5,
    rounds: 1,
    restBetweenRounds: 0,
    steps: [
      step(pressBanca, { sets: 4, reps: 10, restBetweenSets: 90 }),
      rest(120),
      step(remo, { sets: 4, reps: 10, restBetweenSets: 90 }),
      rest(120),
      step(dominadas, { sets: 3, reps: 8, restBetweenSets: 90 }),
      rest(60),
      step(flexiones, { sets: 2, reps: 15, restBetweenSets: 60, note: 'Al fallo en la última' }),
    ],
    createdAt: now + 1,
    updatedAt: now + 1,
  }

  await db.transaction('rw', db.exercises, db.routines, async () => {
    await db.exercises.bulkAdd([sentadillas, flexiones, plancha, burpees, escaladores, pressBanca, remo, dominadas])
    await db.routines.bulkAdd([hiit, gym])
  })
}
