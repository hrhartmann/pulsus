import type { Exercise, IconValue, Routine, Segment } from '../types'

export const REST_ICON: IconValue = { kind: 'emoji', value: '😮‍💨' }
export const PREP_ICON: IconValue = { kind: 'emoji', value: '⏱️' }
export const REST_COLOR = 'teal'
export const PREP_COLOR = 'amber'
const MISSING_ICON: IconValue = { kind: 'emoji', value: '❔' }

/**
 * Convierte una rutina en la lista lineal de segmentos que recorre el reproductor.
 *
 *  preparación → [vuelta 1: pasos con sus series y descansos] → descanso entre vueltas → [vuelta 2] …
 *
 * - Un paso con 3 series y 60 s de descanso entre series genera: Ej (1/3), Desc, Ej (2/3), Desc, Ej (3/3).
 * - No se agrega descanso después de la última serie: si quieres uno, va como paso de descanso explícito.
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
    for (const step of routine.steps) {
      if (step.type === 'rest') {
        if (step.seconds > 0) out.push({ ...rest(step.seconds, step.label || 'Descanso', round, rounds), stepId: step.id })
        continue
      }
      const ex = exercises.get(step.exerciseId)
      const sets = Math.max(1, step.sets || 1)
      for (let set = 1; set <= sets; set++) {
        if (set > 1 && step.restBetweenSets > 0) {
          out.push({ ...rest(step.restBetweenSets, 'Descanso', round, rounds), stepId: step.id })
        }
        if (step.mode === 'time' && step.seconds <= 0) continue
        out.push({
          kind: 'exercise',
          advance: step.mode === 'time' ? 'auto' : 'manual',
          seconds: step.mode === 'time' ? step.seconds : undefined,
          reps: step.mode === 'reps' ? step.reps : undefined,
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
      }
    }
  }
  return out
}

function rest(seconds: number, name: string, round: number, rounds: number): Segment {
  return { kind: 'rest', advance: 'auto', seconds, name, icon: REST_ICON, color: REST_COLOR, round, rounds }
}

/** Duración estimada: suma los segmentos con timer. Los de repeticiones se cuentan aparte. */
export function estimateDuration(segments: Segment[]): { seconds: number; manualCount: number } {
  let seconds = 0
  let manualCount = 0
  for (const s of segments) {
    if (s.advance === 'auto') seconds += s.seconds ?? 0
    else manualCount++
  }
  return { seconds, manualCount }
}
