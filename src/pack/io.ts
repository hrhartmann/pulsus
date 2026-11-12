import { db } from '../db/db'
import { toBase64Url, fromBase64Url } from '../lib/base64'
import { type ImportPlan, type Pack, planImport, routinesToPack, validatePack, type Validation } from './pack'

export interface PackPreview {
  pack: Pack
  validation: Validation
  plan: ImportPlan | null
}

/** Lee y valida un paquete (texto JSON) y calcula qué se crearía/actualizaría. No escribe nada. */
export async function previewPack(text: string): Promise<PackPreview | { error: string }> {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { error: `No es un JSON válido: ${(e as Error).message}` }
  }
  const [exercises, routines] = await Promise.all([db.exercises.toArray(), db.routines.toArray()])
  const validation = validatePack(data, new Set(exercises.map((e) => e.id)))
  const pack = data as Pack
  const plan = validation.errors.length ? null : planImport(pack, exercises, routines)
  return { pack, validation, plan }
}

export async function applyPlan(plan: ImportPlan): Promise<void> {
  await db.transaction('rw', db.exercises, db.routines, async () => {
    await db.exercises.bulkPut(plan.exercises)
    await db.routines.bulkPut(plan.routines)
  })
}

/** Todas tus rutinas y ejercicios como paquete (sin imágenes). */
export async function exportAllAsPack(): Promise<Pack> {
  const [exercises, routines] = await Promise.all([db.exercises.toArray(), db.routines.orderBy('createdAt').toArray()])
  const map = new Map(exercises.map((e) => [e.id, e]))
  const pack = routinesToPack(routines, map, 'Mis rutinas')
  // Incluye también los ejercicios que no están en ninguna rutina.
  const included = new Set(pack.exercises?.map((e) => e.id))
  const rest = routinesToPack([], new Map(exercises.filter((e) => !included.has(e.id)).map((e) => [e.id, e])))
  pack.exercises = [...(pack.exercises ?? []), ...(rest.exercises ?? [])]
  return pack
}

// ---------- Compartir una rutina por link: el link lleva un paquete con esa rutina ----------

export async function routineShareUrl(routineId: string): Promise<string> {
  const routine = await db.routines.get(routineId)
  if (!routine) throw new Error('Rutina no encontrada')
  const exercises = await db.exercises.toArray()
  const pack = routinesToPack([routine], new Map(exercises.map((e) => [e.id, e])), routine.name)
  const base = location.href.split('#')[0]
  return `${base}#/importar/${toBase64Url(JSON.stringify(pack))}`
}

export function decodePackParam(encoded: string): string {
  return fromBase64Url(encoded)
}
