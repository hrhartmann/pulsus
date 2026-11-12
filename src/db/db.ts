import Dexie, { type EntityTable } from 'dexie'
import type { Exercise, Routine, Session, StoredImage } from '../types'

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
      const steps = r.steps.filter((s) => !(s.type === 'exercise' && s.exerciseId === id))
      if (steps.length !== r.steps.length) await db.routines.update(r.id, { steps, updatedAt: Date.now() })
    }
    if (ex?.techniqueImageId) await db.images.delete(ex.techniqueImageId)
    if (ex?.icon.kind === 'image') await db.images.delete(ex.icon.imageId)
    await db.exercises.delete(id)
  })
}

export async function routinesUsingExercise(id: string): Promise<Routine[]> {
  const routines = await db.routines.toArray()
  return routines.filter((r) => r.steps.some((s) => s.type === 'exercise' && s.exerciseId === id))
}
