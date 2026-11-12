import type { Routine, Segment, SegmentLog, Session, SessionSegment } from '../types'

/**
 * Motor del reproductor. Funciones puras: reciben el estado y la hora (`now`, ms) y devuelven
 * el estado nuevo más los eventos que ocurrieron (para sonidos y voz). No usa setInterval ni
 * guarda nada: la UI llama a `tick` seguido y persiste el estado.
 *
 * Todo se calcula con la hora real, no contando ticks. Si iOS congela la página (pantalla
 * bloqueada, otra app), al volver `tick` se pone al día y avanza todos los segmentos con timer
 * que ya terminaron, deteniéndose en el primero que sea manual (repeticiones).
 */
export interface PlayerState {
  segments: Segment[]
  index: number
  /** Inicio de la rutina. El timer general = now - startedAt, y nunca se pausa. */
  startedAt: number
  /** Momento en que empezó el segmento actual. */
  segStartedAt: number
  pausedAt: number | null
  /** Pausa acumulada dentro del segmento actual. */
  pausedMs: number
  logs: SegmentLog[]
  finishedAt: number | null
  /** true si se llegó al final de la lista; false si se terminó antes. */
  completed: boolean
  lastTickAt: number
}

export type PlayerEvent = { type: 'segment-start'; index: number; at: number } | { type: 'countdown'; remaining: number; at: number } | { type: 'finish'; at: number }

export interface Step {
  state: PlayerState
  events: PlayerEvent[]
}

const COUNTDOWN = [3, 2, 1]
/** Si saltas un segmento con timer faltando menos que esto, igual cuenta como hecho. */
const DONE_TOLERANCE_MS = 1500

export function start(segments: Segment[], now: number): Step {
  const state: PlayerState = {
    segments,
    index: 0,
    startedAt: now,
    segStartedAt: now,
    pausedAt: null,
    pausedMs: 0,
    logs: segments.map(() => ({ elapsedMs: 0, status: 'pending' })),
    finishedAt: null,
    completed: false,
    lastTickAt: now,
  }
  if (segments.length === 0) return finish(state, now, true)
  return { state, events: [{ type: 'segment-start', index: 0, at: now }] }
}

// ---------- Lecturas ----------

export function current(s: PlayerState): Segment | undefined {
  return s.segments[s.index]
}

export function segmentElapsedMs(s: PlayerState, now: number): number {
  const ref = s.finishedAt ?? s.pausedAt ?? now
  return Math.max(0, ref - s.segStartedAt - s.pausedMs)
}

/** Milisegundos restantes del segmento actual, o null si es manual. */
export function remainingMs(s: PlayerState, now: number): number | null {
  const seg = current(s)
  if (!seg || seg.advance !== 'auto') return null
  return Math.max(0, (seg.seconds ?? 0) * 1000 - segmentElapsedMs(s, now))
}

/** Timer general: corre desde que empezó la rutina hasta que termina. No se detiene con la pausa. */
export function totalElapsedMs(s: PlayerState, now: number): number {
  return (s.finishedAt ?? now) - s.startedAt
}

export function isPaused(s: PlayerState): boolean {
  return s.pausedAt !== null
}

export function isFinished(s: PlayerState): boolean {
  return s.finishedAt !== null
}

// ---------- Acciones ----------

export function tick(s: PlayerState, now: number): Step {
  if (isFinished(s) || isPaused(s)) return { state: { ...s, lastTickAt: now }, events: [] }
  let state = s
  const events: PlayerEvent[] = []

  for (;;) {
    const seg = current(state)
    if (!seg || seg.advance !== 'auto') break
    const durationMs = (seg.seconds ?? 0) * 1000
    const endAt = state.segStartedAt + state.pausedMs + durationMs
    const lastTick = Math.max(state.lastTickAt, state.segStartedAt + state.pausedMs)

    for (const n of COUNTDOWN) {
      const at = endAt - n * 1000
      if (n * 1000 < durationMs && lastTick < at && now >= at) events.push({ type: 'countdown', remaining: n, at })
    }

    if (now < endAt) break

    // El segmento terminó: queda hecho y el siguiente empieza exactamente cuando terminó este.
    const logs = withLog(state.logs, state.index, durationMs, 'done')
    const moved = goTo({ ...state, logs, lastTickAt: endAt }, state.index + 1, endAt)
    state = moved.state
    events.push(...moved.events)
  }

  return { state: { ...state, lastTickAt: now }, events }
}

export function pause(s: PlayerState, now: number): PlayerState {
  if (isFinished(s) || isPaused(s)) return s
  return { ...s, pausedAt: now }
}

export function resume(s: PlayerState, now: number): PlayerState {
  if (!isPaused(s)) return s
  return { ...s, pausedMs: s.pausedMs + (now - (s.pausedAt as number)), pausedAt: null, lastTickAt: now }
}

/** Siguiente segmento. En uno manual es el botón "Listo"; en uno con timer lo salta. */
export function next(s: PlayerState, now: number): Step {
  return jump(s, s.index + 1, now)
}

/** Segmento anterior, que vuelve a empezar desde cero. En el primero, reinicia el actual. */
export function prev(s: PlayerState, now: number): Step {
  return jump(s, Math.max(0, s.index - 1), now)
}

/** Ir a cualquier segmento, como mover la barra de un video. */
export function jump(s: PlayerState, target: number, now: number): Step {
  if (isFinished(s)) return { state: s, events: [] }
  const seg = current(s)
  const elapsed = segmentElapsedMs(s, now)
  let logs = s.logs
  if (seg) {
    if (target > s.index) {
      const planned = seg.advance === 'auto' ? (seg.seconds ?? 0) * 1000 : 0
      const done = seg.advance === 'manual' || elapsed >= planned - DONE_TOLERANCE_MS
      const prevStatus = s.logs[s.index].status
      logs = withLog(logs, s.index, elapsed, done || prevStatus === 'done' ? 'done' : 'skipped')
    } else {
      // Volver atrás (o reiniciar): se suma el tiempo pero el segmento sigue pendiente.
      logs = withLog(logs, s.index, elapsed, s.logs[s.index].status)
    }
  }
  return goTo({ ...s, logs }, target, now)
}

/** Anota las repeticiones hechas en un segmento (máximo de reps). */
export function setReps(s: PlayerState, index: number, reps: number): PlayerState {
  if (!s.logs[index]) return s
  const logs = s.logs.slice()
  logs[index] = { ...logs[index], reps }
  return { ...s, logs }
}

/** Terminar la rutina antes de tiempo. Lo que no hiciste queda como pendiente en el historial. */
export function stop(s: PlayerState, now: number): PlayerState {
  if (isFinished(s)) return s
  const logs = withLog(s.logs, s.index, segmentElapsedMs(s, now), s.logs[s.index]?.status ?? 'pending')
  return { ...s, logs, finishedAt: s.pausedAt ?? now, completed: false }
}

// ---------- Internas ----------

function goTo(s: PlayerState, target: number, now: number): Step {
  const clamped = Math.max(0, target)
  if (clamped >= s.segments.length) return finish(s, now, true)
  return {
    state: { ...s, index: clamped, segStartedAt: now, pausedAt: null, pausedMs: 0, lastTickAt: now },
    events: [{ type: 'segment-start', index: clamped, at: now }],
  }
}

function finish(s: PlayerState, now: number, completed: boolean): Step {
  const logs = s.logs.map((l) => (l.status === 'pending' ? { ...l, status: 'skipped' as const } : l))
  return {
    state: { ...s, logs, index: s.segments.length, finishedAt: now, completed, pausedAt: null },
    events: [{ type: 'finish', at: now }],
  }
}

function withLog(logs: SegmentLog[], i: number, addMs: number, status: SegmentLog['status']): SegmentLog[] {
  if (!logs[i]) return logs
  const copy = logs.slice()
  copy[i] = { ...logs[i], elapsedMs: logs[i].elapsedMs + addMs, status }
  return copy
}

// ---------- Historial ----------

export function toSession(s: PlayerState, routine: Routine, id: string): Session {
  const endedAt = s.finishedAt ?? s.lastTickAt
  const segments: SessionSegment[] = s.segments.map((seg, i) => ({
    kind: seg.kind,
    advance: seg.advance,
    name: seg.name,
    emoji: seg.icon.kind === 'emoji' ? seg.icon.value : undefined,
    plannedSeconds: seg.seconds,
    plannedReps: seg.reps,
    max: seg.max,
    actualReps: s.logs[i].reps,
    side: seg.side,
    block: seg.block,
    set: seg.set,
    sets: seg.sets,
    round: seg.round,
    note: seg.note,
    elapsedMs: Math.round(s.logs[i].elapsedMs),
    status: s.logs[i].status,
  }))
  return {
    id,
    routineId: routine.id,
    routineName: routine.name,
    routineIcon: routine.icon,
    routineColor: routine.color,
    startedAt: s.startedAt,
    endedAt,
    durationMs: endedAt - s.startedAt,
    completed: s.completed,
    segments,
    routineSnapshot: routine,
  }
}
