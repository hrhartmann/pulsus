// Modelo de datos de Pulsus. Todo vive en IndexedDB (ver src/db/db.ts).

/** Icono de un ejercicio o rutina: un emoji o una imagen guardada en la tabla `images`. */
export type IconValue =
  | { kind: 'emoji'; value: string }
  | { kind: 'image'; imageId: string }

/** `time`: corre un timer y avanza solo. `reps`: muestra las repeticiones y espera a que toques "Listo". */
export type ExerciseMode = 'time' | 'reps'

/** Ejercicio de la biblioteca. Se reutiliza en varias rutinas. */
export interface Exercise {
  id: string
  name: string
  icon: IconValue
  color: string
  /** Foto o GIF para revisar la técnica. Id en la tabla `images`. */
  techniqueImageId?: string
  notes?: string
  /** Valores sugeridos al agregarlo a una rutina. */
  defaultMode: ExerciseMode
  defaultSeconds: number
  defaultReps: number
  createdAt: number
  updatedAt: number
}

/** Un paso de rutina que usa un ejercicio de la biblioteca. Los tiempos viven aquí, no en el ejercicio. */
export interface ExerciseStep {
  id: string
  type: 'exercise'
  exerciseId: string
  mode: ExerciseMode
  seconds: number
  reps: number
  /** Cantidad de series. 1 = una sola vez. */
  sets: number
  /** Descanso entre series (seg). 0 = sin descanso. Solo se inserta ENTRE series, no después de la última. */
  restBetweenSets: number
  /** Texto libre: peso, variante, etc. */
  note?: string
}

/** Descanso explícito: siempre tiene timer y avanza solo. */
export interface RestStep {
  id: string
  type: 'rest'
  seconds: number
  label?: string
}

export type RoutineStep = ExerciseStep | RestStep

export interface Routine {
  id: string
  name: string
  icon: IconValue
  color: string
  /** Cuenta regresiva antes del primer ejercicio (seg). 0 = sin preparación. */
  prepSeconds: number
  /** Repetir la lista completa de pasos N veces. */
  rounds: number
  /** Descanso entre vueltas (seg). */
  restBetweenRounds: number
  steps: RoutineStep[]
  createdAt: number
  updatedAt: number
}

export interface StoredImage {
  id: string
  blob: Blob
  mime: string
}

// ---------- Reproductor ----------

export type SegmentKind = 'prep' | 'exercise' | 'rest'

/**
 * Un "pedazo" de la rutina ya expandida (series, vueltas y descansos incluidos).
 * El reproductor recorre la lista de segmentos como si fueran capítulos de un video.
 */
export interface Segment {
  kind: SegmentKind
  /** `auto`: tiene timer y avanza solo. `manual`: espera a que toques "Listo". */
  advance: 'auto' | 'manual'
  seconds?: number
  reps?: number
  name: string
  icon: IconValue
  color: string
  exerciseId?: string
  techniqueImageId?: string
  note?: string
  stepId?: string
  set?: number
  sets?: number
  round: number
  rounds: number
}

export type SegmentStatus = 'pending' | 'done' | 'skipped'

export interface SegmentLog {
  /** Tiempo real que pasaste en el segmento (suma todas las visitas). */
  elapsedMs: number
  status: SegmentStatus
}

/** Una rutina realizada. Guarda una foto de la rutina tal como se hizo, aunque después la edites o la borres. */
export interface Session {
  id: string
  routineId: string
  routineName: string
  routineIcon: IconValue
  routineColor: string
  startedAt: number
  endedAt: number
  durationMs: number
  completed: boolean
  segments: SessionSegment[]
  /** Copia de la rutina al momento de empezar. */
  routineSnapshot: Routine
}

export interface SessionSegment {
  kind: SegmentKind
  advance: 'auto' | 'manual'
  name: string
  emoji?: string
  plannedSeconds?: number
  plannedReps?: number
  set?: number
  sets?: number
  round: number
  note?: string
  elapsedMs: number
  status: SegmentStatus
}
