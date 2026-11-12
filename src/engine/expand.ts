import type { Exercise, IconValue, Routine, RoutineStep, Segment, Side } from '../types'

export const REST_ICON: IconValue = { kind: 'emoji', value: '😮‍💨' }
export const PREP_ICON: IconValue = { kind: 'emoji', value: '⏱️' }
export const SWITCH_ICON: IconValue = { kind: 'emoji', value: '🔄' }
export const REST_COLOR = 'teal'
export const PREP_COLOR = 'amber'
/** Pausa automática para cambiar de lado en ejercicios por tiempo y por lado (plancha lateral, etc.). */
export const SWITCH_SIDE_SECONDS = 5
const MISSING_ICON: IconValue = { kind: 'emoji', value: '❔' }
const SIDES: Side[] = ['left', 'right']

export const SIDE_LABEL: Record<Side, string> = { left: 'Izquierda', right: 'Derecha' }

/** Todos los pasos de la rutina en orden, sin importar el bloque. */
export function allSteps(routine: Routine): RoutineStep[] {
  return routine.blocks.flatMap((b) => b.steps)
}

/**
 * Convierte una rutina en la lista lineal de segmentos que recorre el reproductor.
 *
 *  preparación → [vuelta 1: bloques → pasos → series → lados] → descanso entre vueltas → [vuelta 2] …
 *
 * - Un paso con 3 series y 60 s de descanso entre series genera: Ej (1/3), Desc, Ej (2/3), Desc, Ej (3/3).
 * - No se agrega descanso después de la última serie: si quieres uno, va como paso de descanso explícito.
 * - Un paso por lado genera, en cada serie, Izquierda y Derecha. Si es por tiempo, entre ambos lados
 *   va una pausa automática de 5 s para cambiar de posición. Si es por repeticiones, no (ya esperas "Listo").
 * - Los pasos y descansos de 0 s se omiten.
 */
export function expandRoutine(routine: Routine, exercises: Map<string, Exercise>): Segment[] {
  const rounds = Math.max(1, routine.rounds || 1)
  const out: Segment[] = []

  if (routine.prepSeconds > 0) {
    out.push({
      kind: 'prep',
      advance: 'auto',
      seconds: routine.prepSeconds,
      name: 'Prepárate',
      icon: PREP_ICON,
      color: PREP_COLOR,
      round: 1,
      rounds,
    })
  }

  for (let round = 1; round <= rounds; round++) {
    if (round > 1 && routine.restBetweenRounds > 0) {
      out.push(rest(routine.restBetweenRounds, `Descanso · vuelta ${round}`, round, rounds))
    }
    for (const block of routine.blocks) {
      const blockName = block.name.trim() || undefined
      for (const step of block.steps) {
        if (step.type === 'rest') {
          if (step.seconds > 0) out.push({ ...rest(step.seconds, step.label || 'Descanso', round, rounds), stepId: step.id, block: blockName })
          continue
        }
        if (step.mode === 'time' && step.seconds <= 0) continue
        const ex = exercises.get(step.exerciseId)
        const sets = Math.max(1, step.sets || 1)
        const sides: (Side | undefined)[] = step.perSide ? SIDES : [undefined]
        for (let set = 1; set <= sets; set++) {
          if (set > 1 && step.restBetweenSets > 0) {
            out.push({ ...rest(step.restBetweenSets, 'Descanso', round, rounds), stepId: step.id, block: blockName })
          }
          sides.forEach((side, i) => {
            if (i > 0 && step.mode === 'time') {
              out.push({
                kind: 'rest',
                advance: 'auto',
                seconds: SWITCH_SIDE_SECONDS,
                name: 'Cambia de lado',
                icon: SWITCH_ICON,
                color: REST_COLOR,
                stepId: step.id,
                block: blockName,
                round,
                rounds,
              })
            }
            out.push({
              kind: 'exercise',
              advance: step.mode === 'time' ? 'auto' : 'manual',
              seconds: step.mode === 'time' ? step.seconds : undefined,
              reps: step.mode === 'reps' ? step.reps : undefined,
              max: step.mode === 'max' || undefined,
              side,
              block: blockName,
              name: ex?.name ?? 'Ejercicio eliminado',
              icon: ex?.icon ?? MISSING_ICON,
              color: ex?.color ?? 'slate',
              exerciseId: step.exerciseId,
              techniqueImageId: ex?.techniqueImageId,
              note: step.note || undefined,
              stepId: step.id,
              set: sets > 1 ? set : undefined,
              sets: sets > 1 ? sets : undefined,
              round,
              rounds,
            })
          })
        }
      }
    }
  }
  return out
}

function rest(seconds: number, name: string, round: number, rounds: number): Segment {
  return { kind: 'rest', advance: 'auto', seconds, name, icon: REST_ICON, color: REST_COLOR, round, rounds }
}

/** Duración estimada: suma los segmentos con timer. Los manuales (reps y máx.) se cuentan aparte. */
export function estimateDuration(segments: Segment[]): { seconds: number; manualCount: number } {
  let seconds = 0
  let manualCount = 0
  for (const s of segments) {
    if (s.advance === 'auto') seconds += s.seconds ?? 0
    else manualCount++
  }
  return { seconds, manualCount }
}

/** Texto corto de lo que pide un segmento: "40 s", "12 reps", "Máx." */
export function segmentTarget(s: Pick<Segment, 'advance' | 'seconds' | 'reps' | 'max'>, dur: (s: number) => string): string {
  if (s.advance === 'auto') return dur(s.seconds ?? 0)
  if (s.max) return 'Máx.'
  return `${s.reps} reps`
}
