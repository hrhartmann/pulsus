import Dexie, { type EntityTable } from 'dexie'
import type { Exercise, Routine, RoutineStep, Session, StoredImage } from '../types'

/**
 * Base de datos local (IndexedDB) del teléfono.
 * Para cambiar el esquema: agrega una nueva `db.version(n)` debajo, nunca edites una versión existente.
 */
export const db = new Dexie('pulsus') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  routines: EntityTable<Routine, 'id'>
  sessions: EntityTable<Session, 'id'>
  images: EntityTable<StoredImage, 'id'>
}

db.version(1).stores({
  exercises: 'id, name, updatedAt',
  routines: 'id, name, createdAt, updatedAt',
  sessions: 'id, routineId, startedAt',
  images: 'id',
})

// v2: rutinas organizadas en bloques; `notes` del ejercicio pasa a `tips`.
db.version(2)
  .stores({})
  .upgrade(async (tx) => {
    await tx
      .table('routines')
      .toCollection()
      .modify((r: Record<string, unknown>) => {
        if (!r.blocks) {
          r.blocks = [{ id: newId(), name: '', steps: (r.steps as unknown[]) ?? [] }]
          delete r.steps
        }
      })
    await tx
      .table('exercises')
      .toCollection()
      .modify((e: Record<string, unknown>) => {
        if (e.notes && !e.tips) e.tips = e.notes
        delete e.notes
      })
  })

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

/** Pide al navegador que no borre los datos si falta espacio. */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    // no disponible
  }
}

/** Acepta datos de la versión 1 (respaldo viejo): `steps` → `blocks`, `notes` → `tips`. */
export function normalizeRoutine(r: Routine): Routine {
  const raw = r as Routine & { steps?: RoutineStep[] }
  if (raw.blocks) return r
  const { steps, ...rest } = raw
  return { ...rest, blocks: [{ id: newId(), name: '', steps: steps ?? [] }] }
}

export function normalizeExercise(e: Exercise): Exercise {
  const raw = e as Exercise & { notes?: string }
  if (raw.notes === undefined) return e
  const { notes, ...rest } = raw
  return { ...rest, tips: rest.tips ?? notes }
}

export async function exerciseMap(): Promise<Map<string, Exercise>> {
  const all = await db.exercises.toArray()
  return new Map(all.map((e) => [e.id, e]))
}

/** Borra un ejercicio y lo quita de las rutinas que lo usan. */
export async function deleteExercise(id: string): Promise<void> {
  await db.transaction('rw', db.exercises, db.routines, db.images, async () => {
    const ex = await db.exercises.get(id)
    const routines = await db.routines.toArray()
    for (const r of routines) {
      const uses = r.blocks.some((b) => b.steps.some((s) => s.type === 'exercise' && s.exerciseId === id))
      if (!uses) continue
      const blocks = r.blocks.map((b) => ({ ...b, steps: b.steps.filter((s) => !(s.type === 'exercise' && s.exerciseId === id)) }))
      await db.routines.update(r.id, { blocks, updatedAt: Date.now() })
    }
    if (ex?.techniqueImageId) await db.images.delete(ex.techniqueImageId)
    if (ex?.icon.kind === 'image') await db.images.delete(ex.icon.imageId)
    await db.exercises.delete(id)
  })
}

export async function routinesUsingExercise(id: string): Promise<Routine[]> {
  const routines = await db.routines.toArray()
  return routines.filter((r) => r.blocks.some((b) => b.steps.some((s) => s.type === 'exercise' && s.exerciseId === id)))
}
