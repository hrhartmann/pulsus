import type { Exercise, ExerciseMode } from '../types'
import { dur } from './format'

export const MODE_OPTIONS: { value: ExerciseMode; label: string }[] = [
  { value: 'time', label: '⏱ Tiempo' },
  { value: 'reps', label: '✋ Reps' },
  { value: 'max', label: '🔥 Máx.' },
]

/** Lo que trae un ejercicio por defecto: "⏱ 30 s", "✋ 10 reps por lado", "🔥 máx. reps". */
export function exerciseDefaultLabel(e: Exercise): string {
  const side = e.defaultPerSide ? ' por lado' : ''
  if (e.defaultMode === 'time') return `⏱ ${dur(e.defaultSeconds)}${side}`
  if (e.defaultMode === 'max') return `🔥 máx. reps${side}`
  return `✋ ${e.defaultReps} reps${side}`
}
