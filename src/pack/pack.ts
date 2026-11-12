/**
 * Paquetes de rutinas: formato `pulsus-pack/1`.
 *
 * Es el formato para crear ejercicios y rutinas fuera de la app (a mano o con un agente) e importarlos.
 * La especificación para quien escribe paquetes está en docs/PAQUETES.md y docs/pulsus-pack.schema.json.
 *
 * Este archivo es puro (sin base de datos ni DOM) para poder testearlo:
 *   validatePack()  → errores y advertencias legibles
 *   planImport()    → qué se crea y qué se actualiza, ya convertido al modelo de la app
 *   routinesToPack() → el camino inverso (exportar / compartir por link)
 */
import { COLOR_KEYS } from '../lib/colors'
import type { Block, Exercise, ExerciseMode, ExerciseStep, Routine, RoutineStep } from '../types'

export const PACK_FORMAT = 'pulsus-pack/1'

export interface PackExercise {
  id: string
  name: string
  emoji?: string
  color?: string
  description?: string
  tips?: string
  easier?: string
  harder?: string
  mode?: ExerciseMode
  seconds?: number
  reps?: number
  perSide?: boolean
}

export interface PackExerciseStep {
  exercise: string
  seconds?: number
  reps?: number
  max?: boolean
  sets?: number
  restBetweenSets?: number
  perSide?: boolean
  note?: string
}

export interface PackRestStep {
  rest: number
  label?: string
}

export type PackStep = PackExerciseStep | PackRestStep

export interface PackBlock {
  name?: string
  steps: PackStep[]
}

export interface PackRoutine {
  id: string
  name: string
  description?: string
  emoji?: string
  color?: string
  prepSeconds?: number
  blocks: PackBlock[]
}

export interface Pack {
  format: typeof PACK_FORMAT
  name?: string
  description?: string
  exercises?: PackExercise[]
  routines?: PackRoutine[]
}

export interface Validation {
  errors: string[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
const KEYS = {
  pack: ['format', 'name', 'description', 'exercises', 'routines'],
  exercise: ['id', 'name', 'emoji', 'color', 'description', 'tips', 'easier', 'harder', 'mode', 'seconds', 'reps', 'perSide'],
  routine: ['id', 'name', 'description', 'emoji', 'color', 'prepSeconds', 'blocks'],
  block: ['name', 'steps'],
  exStep: ['exercise', 'seconds', 'reps', 'max', 'sets', 'restBetweenSets', 'perSide', 'note'],
  restStep: ['rest', 'label'],
}

/**
 * Valida un paquete. `knownExerciseIds`: ejercicios que ya existen en la app (un paso puede usarlos
 * aunque no vengan en el paquete).
 */
export function validatePack(data: unknown, knownExerciseIds: Set<string> = new Set()): Validation {
  const errors: string[] = []
  const warnings: string[] = []
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`)
  const warn = (path: string, msg: string) => warnings.push(`${path}: ${msg}`)

  if (!isObj(data)) return { errors: ['El archivo no es un objeto JSON.'], warnings }
  if (data.format !== PACK_FORMAT) err('format', `debe ser "${PACK_FORMAT}"`)
  extraKeys(data, KEYS.pack, 'paquete', warn)
  optString(data, 'name', 'name', err, 80)
  optString(data, 'description', 'description', err, 500)

  const exercises = data.exercises ?? []
  const routines = data.routines ?? []
  if (!Array.isArray(exercises)) err('exercises', 'debe ser una lista')
  if (!Array.isArray(routines)) err('routines', 'debe ser una lista')
  if (Array.isArray(exercises) && Array.isArray(routines) && exercises.length + routines.length === 0) err('paquete', 'no trae ejercicios ni rutinas')

  const exIds = new Set<string>()
  if (Array.isArray(exercises)) {
    exercises.forEach((e, i) => {
      const p = `exercises[${i}]`
      if (!isObj(e)) return err(p, 'debe ser un objeto')
      const label = typeof e.name === 'string' ? `${p} "${e.name}"` : p
      extraKeys(e, KEYS.exercise, label, warn)
      if (checkId(e.id, `${label}.id`, err)) {
        if (exIds.has(e.id as string)) err(`${label}.id`, `"${e.id}" está repetido`)
        exIds.add(e.id as string)
      }
      reqString(e, 'name', `${label}.name`, err, 60)
      optEmoji(e, `${label}.emoji`, err)
      optColor(e, `${label}.color`, err)
      for (const k of ['description', 'tips', 'easier', 'harder'] as const) optString(e, k, `${label}.${k}`, err, 1000)
      if (e.mode !== undefined && !['time', 'reps', 'max'].includes(e.mode as string)) err(`${label}.mode`, 'debe ser "time", "reps" o "max"')
      optInt(e, 'seconds', `${label}.seconds`, 1, 3600, err)
      optInt(e, 'reps', `${label}.reps`, 1, 1000, err)
      optBool(e, 'perSide', `${label}.perSide`, err)
    })
  }

  const routineIds = new Set<string>()
  if (Array.isArray(routines)) {
    routines.forEach((r, i) => {
      const p = `routines[${i}]`
      if (!isObj(r)) return err(p, 'debe ser un objeto')
      const label = typeof r.name === 'string' ? `${p} "${r.name}"` : p
      extraKeys(r, KEYS.routine, label, warn)
      if (checkId(r.id, `${label}.id`, err)) {
        if (routineIds.has(r.id as string)) err(`${label}.id`, `"${r.id}" está repetido`)
        routineIds.add(r.id as string)
      }
      reqString(r, 'name', `${label}.name`, err, 60)
      optString(r, 'description', `${label}.description`, err, 300)
      optEmoji(r, `${label}.emoji`, err)
      optColor(r, `${label}.color`, err)
      optInt(r, 'prepSeconds', `${label}.prepSeconds`, 0, 300, err)
      if (!Array.isArray(r.blocks) || r.blocks.length === 0) return err(`${label}.blocks`, 'debe ser una lista con al menos un bloque')
      let stepCount = 0
      r.blocks.forEach((b, bi) => {
        const bp = `${label}.blocks[${bi}]`
        if (!isObj(b)) return err(bp, 'debe ser un objeto')
        extraKeys(b, KEYS.block, bp, warn)
        optString(b, 'name', `${bp}.name`, err, 40)
        if (!Array.isArray(b.steps)) return err(`${bp}.steps`, 'debe ser una lista')
        if (b.steps.length === 0) warn(`${bp}.steps`, 'el bloque está vacío')
        b.steps.forEach((s, si) => {
          stepCount++
          const sp = `${bp}.steps[${si}]`
          if (!isObj(s)) return err(sp, 'debe ser un objeto')
          if ('rest' in s) {
            extraKeys(s, KEYS.restStep, sp, warn)
            if (isRange(s.rest)) return err(`${sp}.rest`, rangeMsg)
            optInt(s, 'rest', `${sp}.rest`, 1, 3600, err)
            optString(s, 'label', `${sp}.label`, err, 40)
            return
          }
          if (!('exercise' in s)) return err(sp, 'un paso necesita "exercise" (ejercicio) o "rest" (descanso)')
          extraKeys(s, KEYS.exStep, sp, warn)
          const ref = s.exercise
          if (typeof ref !== 'string' || !ref) err(`${sp}.exercise`, 'debe ser el id de un ejercicio')
          else if (!exIds.has(ref) && !knownExerciseIds.has(ref)) err(`${sp}.exercise`, `no existe un ejercicio con id "${ref}" en "exercises"`)
          const modes = (['seconds', 'reps', 'max'] as const).filter((k) => s[k] !== undefined && s[k] !== false)
          if (modes.length !== 1) err(sp, 'un ejercicio lleva exactamente uno de: "seconds", "reps" o "max": true')
          const ranged = new Set((['seconds', 'reps', 'sets', 'restBetweenSets'] as const).filter((k) => isRange(s[k])))
          for (const k of ranged) err(`${sp}.${k}`, rangeMsg)
          if (!ranged.has('seconds')) optInt(s, 'seconds', `${sp}.seconds`, 1, 3600, err)
          if (!ranged.has('reps')) optInt(s, 'reps', `${sp}.reps`, 1, 1000, err)
          if (s.max !== undefined && s.max !== true && s.max !== false) err(`${sp}.max`, 'debe ser true')
          if (!ranged.has('sets')) optInt(s, 'sets', `${sp}.sets`, 1, 20, err)
          if (!ranged.has('restBetweenSets')) optInt(s, 'restBetweenSets', `${sp}.restBetweenSets`, 0, 900, err)
          if (s.restBetweenSets && (!s.sets || s.sets === 1)) warn(`${sp}.restBetweenSets`, 'solo se usa entre series; con 1 serie no hace nada')
          optBool(s, 'perSide', `${sp}.perSide`, err)
          optString(s, 'note', `${sp}.note`, err, 120)
        })
      })
      if (stepCount === 0) err(label, 'la rutina no tiene pasos')
    })
  }

  return { errors, warnings }
}

const rangeMsg = 'no se aceptan rangos. Usa un número fijo (normalmente el mínimo del rango) y anota el rango en "note"'

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isRange(v: unknown) {
  return typeof v === 'string' && /\d\s*[-–a]\s*\d/.test(v)
}
function extraKeys(o: Record<string, unknown>, allowed: string[], path: string, warn: (p: string, m: string) => void) {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) warn(path, `campo desconocido "${k}" (se ignora)`)
}
function checkId(v: unknown, path: string, err: (p: string, m: string) => void): boolean {
  if (typeof v !== 'string' || !ID_RE.test(v)) {
    err(path, 'debe ser un id en minúsculas, números y guiones (ej: "dominada-pronada")')
    return false
  }
  return true
}
function reqString(o: Record<string, unknown>, k: string, path: string, err: (p: string, m: string) => void, max: number) {
  if (typeof o[k] !== 'string' || !(o[k] as string).trim()) err(path, 'es obligatorio')
  else if ((o[k] as string).length > max) err(path, `máximo ${max} caracteres`)
}
function optString(o: Record<string, unknown>, k: string, path: string, err: (p: string, m: string) => void, max: number) {
  if (o[k] === undefined) return
  if (typeof o[k] !== 'string') err(path, 'debe ser texto')
  else if ((o[k] as string).length > max) err(path, `máximo ${max} caracteres`)
}
function optInt(o: Record<string, unknown>, k: string, path: string, min: number, max: number, err: (p: string, m: string) => void) {
  const v = o[k]
  if (v === undefined) return
  if (typeof v !== 'number' || !Number.isInteger(v)) err(path, 'debe ser un número entero')
  else if (v < min || v > max) err(path, `debe estar entre ${min} y ${max}`)
}
function optBool(o: Record<string, unknown>, k: string, path: string, err: (p: string, m: string) => void) {
  if (o[k] !== undefined && typeof o[k] !== 'boolean') err(path, 'debe ser true o false')
}
function optEmoji(o: Record<string, unknown>, path: string, err: (p: string, m: string) => void) {
  const v = o.emoji
  if (v === undefined) return
  if (typeof v !== 'string' || !v.trim() || [...new Intl.Segmenter().segment(v.trim())].length !== 1) err(path, 'debe ser un solo emoji')
}
function optColor(o: Record<string, unknown>, path: string, err: (p: string, m: string) => void) {
  if (o.color !== undefined && !COLOR_KEYS.includes(o.color as string)) err(path, `debe ser uno de: ${COLOR_KEYS.join(', ')}`)
}

// ---------------------------------------------------------------------------
// Importación (plan puro: la escritura en la base de datos está en import.ts)
// ---------------------------------------------------------------------------

export interface ImportPlan {
  exercises: Exercise[]
  routines: Routine[]
  summary: { exercisesCreated: number; exercisesUpdated: number; routinesCreated: number; routinesUpdated: number }
}

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Color estable a partir del id, para que el mismo ejercicio salga siempre del mismo color. */
export function colorFor(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLOR_KEYS[h % (COLOR_KEYS.length - 1)] // sin 'slate'
}

/**
 * Decide qué crear y qué actualizar.
 * - Ejercicios: se busca por id; si no, por nombre (sin mayúsculas ni tildes) para no duplicar los que ya tienes.
 *   Los campos que trae el paquete reemplazan a los tuyos; los que no trae se mantienen.
 *   Nunca se tocan tu imagen de técnica ni un icono de imagen.
 * - Rutinas: se busca por id. Si existe, se reemplazan sus bloques (las ediciones hechas en el teléfono se pierden).
 *   El historial nunca se toca.
 */
export function planImport(pack: Pack, existingExercises: Exercise[], existingRoutines: Routine[], now = Date.now()): ImportPlan {
  const byId = new Map(existingExercises.map((e) => [e.id, e]))
  const byName = new Map(existingExercises.map((e) => [norm(e.name), e]))
  const idMap = new Map<string, string>()
  const exercises: Exercise[] = []
  let exercisesCreated = 0
  let exercisesUpdated = 0

  for (const pe of pack.exercises ?? []) {
    const existing = byId.get(pe.id) ?? byName.get(norm(pe.name))
    const id = existing?.id ?? pe.id
    idMap.set(pe.id, id)
    const keepImageIcon = existing?.icon.kind === 'image'
    const ex: Exercise = {
      ...(existing ?? {
        id,
        icon: { kind: 'emoji', value: '💪' },
        color: colorFor(pe.id),
        defaultMode: 'reps',
        defaultSeconds: 30,
        defaultReps: 10,
        createdAt: now,
      }),
      name: pe.name.trim(),
      updatedAt: now,
    } as Exercise
    if (pe.emoji && !keepImageIcon) ex.icon = { kind: 'emoji', value: pe.emoji.trim() }
    if (pe.color) ex.color = pe.color
    for (const k of ['description', 'tips', 'easier', 'harder'] as const) if (pe[k] !== undefined) ex[k] = pe[k]
    if (pe.mode) ex.defaultMode = pe.mode
    if (pe.seconds) ex.defaultSeconds = pe.seconds
    if (pe.reps) ex.defaultReps = pe.reps
    if (pe.perSide !== undefined) ex.defaultPerSide = pe.perSide
    exercises.push(ex)
    if (existing) exercisesUpdated++
    else exercisesCreated++
  }

  const routineById = new Map(existingRoutines.map((r) => [r.id, r]))
  const routines: Routine[] = []
  let routinesCreated = 0
  let routinesUpdated = 0

  for (const pr of pack.routines ?? []) {
    const existing = routineById.get(pr.id)
    const blocks: Block[] = pr.blocks.map((b, bi) => ({
      id: `${pr.id}-b${bi}`,
      name: b.name?.trim() ?? '',
      steps: b.steps.map((s, si): RoutineStep => {
        const id = `${pr.id}-b${bi}-s${si}`
        if ('rest' in s) return { id, type: 'rest', seconds: s.rest, label: s.label }
        const mode: ExerciseMode = s.max ? 'max' : s.seconds ? 'time' : 'reps'
        const step: ExerciseStep = {
          id,
          type: 'exercise',
          exerciseId: idMap.get(s.exercise) ?? s.exercise,
          mode,
          seconds: s.seconds ?? 30,
          reps: s.reps ?? 10,
          sets: s.sets ?? 1,
          restBetweenSets: s.restBetweenSets ?? 0,
          perSide: s.perSide || undefined,
          note: s.note,
        }
        return step
      }),
    }))
    const keepImageIcon = existing?.icon.kind === 'image'
    routines.push({
      id: pr.id,
      name: pr.name.trim(),
      description: pr.description,
      icon: keepImageIcon ? existing!.icon : { kind: 'emoji', value: pr.emoji?.trim() || '🏋️' },
      color: pr.color ?? existing?.color ?? colorFor(pr.id),
      prepSeconds: pr.prepSeconds ?? existing?.prepSeconds ?? 10,
      rounds: existing?.rounds ?? 1,
      restBetweenRounds: existing?.restBetweenRounds ?? 0,
      blocks,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    if (existing) routinesUpdated++
    else routinesCreated++
  }

  return { exercises, routines, summary: { exercisesCreated, exercisesUpdated, routinesCreated, routinesUpdated } }
}

// ---------------------------------------------------------------------------
// Exportar: de la app a paquete (para compartir por link o para que un agente parta de lo que ya tienes)
// ---------------------------------------------------------------------------

export function routinesToPack(routines: Routine[], exercises: Map<string, Exercise>, name?: string): Pack {
  const used = new Set<string>()
  const packRoutines: PackRoutine[] = routines.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description || undefined,
    emoji: r.icon.kind === 'emoji' ? r.icon.value : undefined,
    color: r.color,
    prepSeconds: r.prepSeconds,
    blocks: r.blocks.map((b) => ({
      name: b.name || undefined,
      steps: b.steps.map((s): PackStep => {
        if (s.type === 'rest') return { rest: s.seconds, label: s.label || undefined }
        used.add(s.exerciseId)
        return {
          exercise: s.exerciseId,
          ...(s.mode === 'time' ? { seconds: s.seconds } : s.mode === 'max' ? { max: true } : { reps: s.reps }),
          sets: s.sets > 1 ? s.sets : undefined,
          restBetweenSets: s.sets > 1 && s.restBetweenSets ? s.restBetweenSets : undefined,
          perSide: s.perSide || undefined,
          note: s.note || undefined,
        }
      }),
    })),
  }))
  const packExercises: PackExercise[] = [...exercises.values()]
    .filter((e) => used.has(e.id) || routines.length === 0)
    .map((e) => ({
      id: e.id,
      name: e.name,
      emoji: e.icon.kind === 'emoji' ? e.icon.value : undefined,
      color: e.color,
      description: e.description || undefined,
      tips: e.tips || undefined,
      easier: e.easier || undefined,
      harder: e.harder || undefined,
      mode: e.defaultMode,
      seconds: e.defaultMode === 'time' && e.defaultSeconds > 0 ? e.defaultSeconds : undefined,
      reps: e.defaultMode === 'reps' && e.defaultReps > 0 ? e.defaultReps : undefined,
      perSide: e.defaultPerSide || undefined,
    }))
  return JSON.parse(JSON.stringify({ format: PACK_FORMAT, name, exercises: packExercises, routines: packRoutines })) as Pack
}
