import { describe, expect, it } from 'vitest'
import type { Exercise, Routine } from '../types'
import { estimateDuration, expandRoutine } from './expand'
import * as P from './player'

const ex = (id: string, name: string): Exercise => ({
  id,
  name,
  icon: { kind: 'emoji', value: '💪' },
  color: 'red',
  defaultMode: 'time',
  defaultSeconds: 30,
  defaultReps: 10,
  createdAt: 0,
  updatedAt: 0,
})

const lib = new Map([
  ['sq', ex('sq', 'Sentadillas')],
  ['bp', ex('bp', 'Press banca')],
])

const routine = (over: Partial<Routine> = {}): Routine => ({
  id: 'r1',
  name: 'Test',
  icon: { kind: 'emoji', value: '🔥' },
  color: 'red',
  prepSeconds: 5,
  rounds: 1,
  restBetweenRounds: 0,
  createdAt: 0,
  updatedAt: 0,
  blocks: [
    {
      id: 'b1',
      name: 'Principal',
      steps: [
        { id: 's1', type: 'exercise', exerciseId: 'sq', mode: 'time', seconds: 30, reps: 0, sets: 1, restBetweenSets: 0 },
        { id: 's2', type: 'rest', seconds: 15 },
        { id: 's3', type: 'exercise', exerciseId: 'bp', mode: 'reps', seconds: 0, reps: 12, sets: 3, restBetweenSets: 60 },
      ],
    },
  ],
  ...over,
})

const oneBlock = (steps: Routine['blocks'][0]['steps']): Partial<Routine> => ({ prepSeconds: 0, blocks: [{ id: 'b', name: '', steps }] })

describe('expandRoutine', () => {
  it('expande preparación, series y descansos entre series', () => {
    const segs = expandRoutine(routine(), lib)
    expect(segs.map((s) => `${s.kind}:${s.name}:${s.seconds ?? s.reps}:${s.advance}`)).toEqual([
      'prep:Prepárate:5:auto',
      'exercise:Sentadillas:30:auto',
      'rest:Descanso:15:auto',
      'exercise:Press banca:12:manual',
      'rest:Descanso:60:auto',
      'exercise:Press banca:12:manual',
      'rest:Descanso:60:auto',
      'exercise:Press banca:12:manual',
    ])
    expect(segs[3].set).toBe(1)
    expect(segs[7].set).toBe(3)
    expect(segs[7].sets).toBe(3)
  })

  it('repite vueltas con descanso entre vueltas', () => {
    const segs = expandRoutine(routine({ ...oneBlock([routine().blocks[0].steps[0]]), rounds: 2, restBetweenRounds: 90 }), lib)
    expect(segs.map((s) => `${s.kind}:${s.round}`)).toEqual(['exercise:1', 'rest:2', 'exercise:2'])
  })

  it('marca el bloque de cada segmento y une bloques en orden', () => {
    const r = routine({
      prepSeconds: 0,
      blocks: [
        { id: 'a', name: 'Calentamiento', steps: [{ id: 'x', type: 'rest', seconds: 10, label: 'Movilidad' }] },
        { id: 'b', name: '  ', steps: [{ id: 'y', type: 'exercise', exerciseId: 'sq', mode: 'time', seconds: 20, reps: 0, sets: 1, restBetweenSets: 0 }] },
      ],
    })
    const segs = expandRoutine(r, lib)
    expect(segs.map((s) => `${s.name}:${s.block}`)).toEqual(['Movilidad:Calentamiento', 'Sentadillas:undefined'])
  })

  it('por lado y por tiempo: izquierda, cambio de 5 s, derecha, en cada serie', () => {
    const segs = expandRoutine(
      routine(oneBlock([{ id: 'p', type: 'exercise', exerciseId: 'sq', mode: 'time', seconds: 20, reps: 0, sets: 2, restBetweenSets: 30, perSide: true }])),
      lib,
    )
    expect(segs.map((s) => `${s.name}:${s.side ?? '-'}:${s.seconds}:${s.set ?? '-'}`)).toEqual([
      'Sentadillas:left:20:1',
      'Cambia de lado:-:5:-',
      'Sentadillas:right:20:1',
      'Descanso:-:30:-',
      'Sentadillas:left:20:2',
      'Cambia de lado:-:5:-',
      'Sentadillas:right:20:2',
    ])
  })

  it('por lado y por repeticiones: sin pausa de cambio (ya espera "Listo")', () => {
    const segs = expandRoutine(
      routine(oneBlock([{ id: 'p', type: 'exercise', exerciseId: 'bp', mode: 'reps', seconds: 0, reps: 8, sets: 1, restBetweenSets: 0, perSide: true }])),
      lib,
    )
    expect(segs.map((s) => `${s.side}:${s.reps}:${s.advance}`)).toEqual(['left:8:manual', 'right:8:manual'])
  })

  it('máximo de repeticiones: manual y marcado como max', () => {
    const segs = expandRoutine(routine(oneBlock([{ id: 'm', type: 'exercise', exerciseId: 'bp', mode: 'max', seconds: 0, reps: 0, sets: 1, restBetweenSets: 0 }])), lib)
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({ advance: 'manual', max: true, reps: undefined })
  })

  it('estima la duración separando los manuales', () => {
    expect(estimateDuration(expandRoutine(routine(), lib))).toEqual({ seconds: 5 + 30 + 15 + 120, manualCount: 3 })
  })
})

describe('player', () => {
  const segs = expandRoutine(routine(), lib)
  const T0 = 1_000_000

  it('avanza solo los segmentos con timer y se detiene en el manual', () => {
    let { state } = P.start(segs, T0)
    const r = P.tick(state, T0 + 5_000 + 30_000 + 15_000 + 10)
    state = r.state
    expect(state.index).toBe(3) // press banca, manual
    expect(r.events.filter((e) => e.type === 'segment-start').map((e) => (e as { index: number }).index)).toEqual([1, 2, 3])
    expect(state.logs.slice(0, 3).map((l) => l.status)).toEqual(['done', 'done', 'done'])
    // El manual empieza exactamente cuando terminó el descanso, no cuando llegó el tick.
    expect(state.segStartedAt).toBe(T0 + 50_000)
    // Se queda esperando aunque pase mucho tiempo.
    expect(P.tick(state, T0 + 999_999).state.index).toBe(3)
  })

  it('emite 3-2-1 antes de terminar un segmento con timer', () => {
    const { state } = P.start(segs, T0)
    const r = P.tick(state, T0 + 3_500)
    expect(r.events.filter((e) => e.type === 'countdown').map((e) => (e as { remaining: number }).remaining)).toEqual([3, 2])
    const r2 = P.tick(r.state, T0 + 3_900)
    expect(r2.events).toEqual([])
  })

  it('"Listo" en un manual lo marca hecho y pasa al siguiente', () => {
    let { state } = P.start(segs, T0)
    state = P.jump(state, 3, T0).state
    state = P.next(state, T0 + 40_000).state
    expect(state.index).toBe(4)
    expect(state.logs[3]).toEqual({ elapsedMs: 40_000, status: 'done' })
  })

  it('saltar un segmento con timer antes de tiempo lo marca saltado', () => {
    let { state } = P.start(segs, T0)
    state = P.next(state, T0 + 1_000).state
    expect(state.logs[0].status).toBe('skipped')
    expect(state.index).toBe(1)
  })

  it('atrás reinicia el segmento anterior desde cero y deja pendiente el actual', () => {
    let { state } = P.start(segs, T0)
    state = P.tick(state, T0 + 10_000).state // en sentadillas, 5 s adentro
    expect(state.index).toBe(1)
    state = P.prev(state, T0 + 10_000).state
    expect(state.index).toBe(0)
    expect(state.logs[1].status).toBe('pending')
    expect(P.remainingMs(state, T0 + 10_000)).toBe(5_000)
  })

  it('la pausa detiene el segmento pero no el timer general', () => {
    let { state } = P.start(segs, T0)
    state = P.pause(state, T0 + 1_000)
    state = P.tick(state, T0 + 60_000).state
    expect(state.index).toBe(0)
    expect(P.remainingMs(state, T0 + 60_000)).toBe(4_000)
    expect(P.totalElapsedMs(state, T0 + 60_000)).toBe(60_000)
    state = P.resume(state, T0 + 60_000)
    expect(P.remainingMs(state, T0 + 61_000)).toBe(3_000)
  })

  it('termina al pasar el último y genera la sesión', () => {
    let { state } = P.start(segs, T0)
    state = P.jump(state, segs.length - 1, T0 + 1_000).state
    const r = P.next(state, T0 + 20_000)
    expect(r.events.at(-1)?.type).toBe('finish')
    expect(P.isFinished(r.state)).toBe(true)
    expect(r.state.completed).toBe(true)
    const session = P.toSession(r.state, routine(), 'sess1')
    expect(session.durationMs).toBe(20_000)
    expect(session.segments).toHaveLength(segs.length)
    expect(session.segments[0].status).toBe('skipped')
    expect(session.segments.at(-1)?.status).toBe('done')
  })

  it('anota las reps de un máximo y quedan en el historial', () => {
    const segs2 = expandRoutine(routine(oneBlock([{ id: 'm', type: 'exercise', exerciseId: 'bp', mode: 'max', seconds: 0, reps: 0, sets: 1, restBetweenSets: 0 }])), lib)
    let { state } = P.start(segs2, T0)
    state = P.setReps(state, 0, 11)
    state = P.next(state, T0 + 30_000).state
    const s = P.toSession(state, routine(), 'x')
    expect(s.segments[0]).toMatchObject({ max: true, actualReps: 11, status: 'done', elapsedMs: 30_000 })
  })

  it('terminar antes deja la sesión incompleta', () => {
    const { state } = P.start(segs, T0)
    const stopped = P.stop(state, T0 + 3_000)
    expect(stopped.completed).toBe(false)
    expect(P.toSession(stopped, routine(), 'x').durationMs).toBe(3_000)
  })
})
