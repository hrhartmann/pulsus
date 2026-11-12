import exampleJson from '../../public/ejemplo.pulsus.json'
import { describe, expect, it } from 'vitest'
import { expandRoutine } from '../engine/expand'
import type { Exercise } from '../types'
import { planImport, routinesToPack, validatePack, type Pack } from './pack'

const example = exampleJson as Pack

const minimal = (over: object = {}) => ({
  format: 'pulsus-pack/1',
  exercises: [{ id: 'flexion', name: 'Flexión' }],
  routines: [{ id: 'r', name: 'R', blocks: [{ steps: [{ exercise: 'flexion', reps: 10 }] }] }],
  ...over,
})

describe('validatePack', () => {
  it('el ejemplo de la documentación es válido y sin advertencias', () => {
    expect(validatePack(example)).toEqual({ errors: [], warnings: [] })
  })

  it('rechaza rangos con un mensaje que explica qué hacer', () => {
    const v = validatePack(minimal({ routines: [{ id: 'r', name: 'R', blocks: [{ steps: [{ exercise: 'flexion', reps: '8-12' }] }] }] }))
    expect(v.errors.join('\n')).toMatch(/no se aceptan rangos/)
  })

  it('exige exactamente uno de seconds / reps / max', () => {
    const none = validatePack(minimal({ routines: [{ id: 'r', name: 'R', blocks: [{ steps: [{ exercise: 'flexion' }] }] }] }))
    const two = validatePack(minimal({ routines: [{ id: 'r', name: 'R', blocks: [{ steps: [{ exercise: 'flexion', reps: 5, seconds: 20 }] }] }] }))
    expect(none.errors[0]).toMatch(/exactamente uno/)
    expect(two.errors[0]).toMatch(/exactamente uno/)
  })

  it('detecta ejercicios que no existen, ids inválidos o repetidos', () => {
    const v = validatePack({
      format: 'pulsus-pack/1',
      exercises: [
        { id: 'Flexión', name: 'Flexión' },
        { id: 'a', name: 'A' },
        { id: 'a', name: 'A2' },
      ],
      routines: [{ id: 'r', name: 'R', blocks: [{ steps: [{ exercise: 'nope', reps: 5 }] }] }],
    })
    expect(v.errors.join('\n')).toMatch(/minúsculas/)
    expect(v.errors.join('\n')).toMatch(/repetido/)
    expect(v.errors.join('\n')).toMatch(/no existe un ejercicio con id "nope"/)
  })

  it('acepta ejercicios que ya existen en la app aunque no vengan en el paquete', () => {
    const v = validatePack({ format: 'pulsus-pack/1', routines: [{ id: 'r', name: 'R', blocks: [{ steps: [{ exercise: 'mio', max: true }] }] }] }, new Set(['mio']))
    expect(v.errors).toEqual([])
  })

  it('avisa campos desconocidos (typos) sin fallar', () => {
    const v = validatePack(minimal({ exercises: [{ id: 'flexion', name: 'Flexión', notas: 'x' }] }))
    expect(v.errors).toEqual([])
    expect(v.warnings[0]).toMatch(/campo desconocido "notas"/)
  })
})

describe('planImport', () => {
  it('crea todo la primera vez y convierte al modelo de la app', () => {
    const plan = planImport(example, [], [], 1000)
    expect(plan.summary).toEqual({ exercisesCreated: 4, exercisesUpdated: 0, routinesCreated: 1, routinesUpdated: 0 })
    const r = plan.routines[0]
    expect(r.blocks.map((b) => b.name)).toEqual(['Calentamiento', 'Test', 'Principal', 'Core'])
    const segs = expandRoutine(r, new Map(plan.exercises.map((e) => [e.id, e])))
    expect(segs.some((s) => s.max)).toBe(true)
    expect(segs.filter((s) => s.side === 'left')).toHaveLength(5) // 3 búlgaras + 2 planchas
  })

  it('reimportar actualiza por id sin duplicar y conserva la imagen de técnica', () => {
    const first = planImport(example, [], [], 1000)
    const mine: Exercise[] = first.exercises.map((e) => (e.id === 'dominada-pronada' ? { ...e, techniqueImageId: 'img1' } : e))
    const second = planImport(example, mine, first.routines, 2000)
    expect(second.summary).toEqual({ exercisesCreated: 0, exercisesUpdated: 4, routinesCreated: 0, routinesUpdated: 1 })
    expect(second.exercises.find((e) => e.id === 'dominada-pronada')?.techniqueImageId).toBe('img1')
    expect(second.routines[0].createdAt).toBe(1000)
  })

  it('reutiliza un ejercicio tuyo con el mismo nombre (sin tildes ni mayúsculas)', () => {
    const mine: Exercise = {
      id: 'uuid-1',
      name: 'sentadilla bulgara',
      icon: { kind: 'emoji', value: '🦵' },
      color: 'red',
      defaultMode: 'reps',
      defaultSeconds: 30,
      defaultReps: 10,
      createdAt: 0,
      updatedAt: 0,
    }
    const plan = planImport(example, [mine], [], 1000)
    expect(plan.exercises.find((e) => e.name === 'Sentadilla búlgara')?.id).toBe('uuid-1')
    const steps = plan.routines[0].blocks.flatMap((b) => b.steps)
    expect(steps.some((s) => s.type === 'exercise' && s.exerciseId === 'uuid-1')).toBe(true)
  })

  it('exportar no saca valores fuera de rango (ej: reps 0 en un ejercicio por tiempo)', () => {
    const ex: Exercise = {
      id: 'p',
      name: 'Plancha',
      icon: { kind: 'emoji', value: '🧱' },
      color: 'amber',
      defaultMode: 'time',
      defaultSeconds: 45,
      defaultReps: 0,
      createdAt: 0,
      updatedAt: 0,
    }
    const pack = routinesToPack([], new Map([['p', ex]]))
    expect(validatePack(pack).errors).toEqual([])
    expect(pack.exercises?.[0]).toMatchObject({ mode: 'time', seconds: 45 })
    expect(pack.exercises?.[0].reps).toBeUndefined()
  })

  it('exportar → importar da la misma rutina', () => {
    const plan = planImport(example, [], [], 1000)
    const pack = routinesToPack(plan.routines, new Map(plan.exercises.map((e) => [e.id, e])))
    expect(validatePack(pack).errors).toEqual([])
    const again = planImport(pack, [], [], 1000)
    expect(again.routines[0].blocks).toEqual(plan.routines[0].blocks)
  })
})
