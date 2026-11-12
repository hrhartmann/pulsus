import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { unlockAudio } from '../audio/audio'
import { IconPicker } from '../components/IconPicker'
import { Button, Confirm, Field, IconBadge, Ico, IconButton, Segmented, Sheet, Stepper, TopBar, inputCls } from '../components/ui'
import { db, newId } from '../db/db'
import { REST_COLOR, REST_ICON, estimateDuration, expandRoutine } from '../engine/expand'
import { COLOR_KEYS } from '../lib/colors'
import { approxMinutes, dur } from '../lib/format'
import { routineShareUrl } from '../lib/transfer'
import type { Exercise, ExerciseStep, RestStep, Routine, RoutineStep } from '../types'

const SECONDS_PRESETS = [15, 20, 30, 40, 45, 60, 90, 120]
const REST_PRESETS = [10, 15, 20, 30, 45, 60, 90, 120, 180]
const REPS_PRESETS = [5, 6, 8, 10, 12, 15, 20]

function blankRoutine(): Routine {
  const now = Date.now()
  return {
    id: newId(),
    name: '',
    icon: { kind: 'emoji', value: '🔥' },
    color: COLOR_KEYS[Math.floor(Math.random() * 10)],
    prepSeconds: 10,
    rounds: 1,
    restBetweenRounds: 60,
    steps: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function RoutineEditor() {
  const { id } = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const isNew = id === 'nueva'
  const [draft, setDraft] = useState<Routine | null>(null)
  const [original, setOriginal] = useState<string>('')
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])
  const exMap = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])

  const [editing, setEditing] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    void (async () => {
      const r = isNew ? blankRoutine() : await db.routines.get(id)
      if (!r) return navigate('/', { replace: true })
      setDraft(r)
      setOriginal(JSON.stringify(r))
    })()
  }, [id, isNew, navigate])

  if (!draft) return null
  const dirty = JSON.stringify(draft) !== original
  const set = (patch: Partial<Routine>) => setDraft({ ...draft, ...patch })
  const setSteps = (steps: RoutineStep[]) => set({ steps })

  const save = async () => {
    const r = { ...draft, name: draft.name.trim() || 'Mi rutina', updatedAt: Date.now() }
    await db.routines.put(r)
    setDraft(r)
    setOriginal(JSON.stringify(r))
    return r
  }

  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= draft.steps.length) return
    const steps = draft.steps.slice()
    ;[steps[i], steps[j]] = [steps[j], steps[i]]
    setSteps(steps)
  }

  const addExercise = (ex: Exercise) => {
    const step: ExerciseStep = {
      id: newId(),
      type: 'exercise',
      exerciseId: ex.id,
      mode: ex.defaultMode,
      seconds: ex.defaultSeconds || 30,
      reps: ex.defaultReps || 10,
      sets: 1,
      restBetweenSets: 60,
    }
    setSteps([...draft.steps, step])
    setPicking(false)
  }

  const addRest = () => {
    const lastRest = [...draft.steps].reverse().find((s): s is RestStep => s.type === 'rest')
    setSteps([...draft.steps, { id: newId(), type: 'rest', seconds: lastRest?.seconds ?? 60 }])
  }

  const segs = expandRoutine(draft, exMap)
  const { seconds, manualCount } = estimateDuration(segs)
  const editingStep = draft.steps.find((s) => s.id === editing)

  const share = async () => {
    const r = await save()
    const url = await routineShareUrl(r)
    if (navigator.share) {
      try {
        await navigator.share({ title: `Rutina ${r.name} · Pulsus`, text: `Te comparto mi rutina "${r.name}" en Pulsus`, url })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    await navigator.clipboard?.writeText(url)
    setToast('Link copiado')
    setTimeout(() => setToast(''), 2000)
  }

  return (
    <div className="min-h-dvh pb-40">
      <TopBar
        title={isNew ? 'Nueva rutina' : 'Editar rutina'}
        left={
          <IconButton label="Volver" onClick={() => (dirty ? setConfirmLeave(true) : navigate('/'))}>
            {Ico.back}
          </IconButton>
        }
        right={
          <button type="button" onClick={() => void save().then(() => navigate('/'))} className="press rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg">
            Guardar
          </button>
        }
      />

      <div className="mx-auto max-w-lg px-4 pt-5">
        <div className="flex items-center gap-4">
          <IconPicker icon={draft.icon} colorKey={draft.color} onChange={(icon, color) => set({ icon, color })} />
          <input
            className={`${inputCls} h-14 font-display text-2xl font-bold tracking-wide uppercase`}
            placeholder="Nombre de la rutina"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 text-sm text-muted">
          <span>⏱ ≈ {approxMinutes(seconds)}</span>
          {manualCount > 0 && <span>✋ + {manualCount} por repeticiones</span>}
          {draft.steps.length > 0 && <span>{segs.length} pasos en total</span>}
        </div>

        {/* Pasos */}
        <div className="mt-6 mb-2 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold tracking-wide text-muted uppercase">Pasos</h2>
          {draft.rounds > 1 && <span className="text-xs text-muted">se repiten {draft.rounds} veces</span>}
        </div>

        <div className="space-y-2">
          {draft.steps.map((s, i) => (
            <StepRow
              key={s.id}
              step={s}
              ex={s.type === 'exercise' ? exMap.get(s.exerciseId) : undefined}
              onEdit={() => setEditing(s.id)}
              onUp={i > 0 ? () => move(i, -1) : undefined}
              onDown={i < draft.steps.length - 1 ? () => move(i, 1) : undefined}
            />
          ))}
          {draft.steps.length === 0 && (
            <div className="rounded-3xl border border-dashed border-line p-6 text-center text-muted">
              Agrega ejercicios y descansos. Cada ejercicio puede ir por <b>tiempo</b> (avanza solo) o por <b>repeticiones</b> (esperas a tocar “Listo”).
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setPicking(true)}>
            {Ico.plus} Ejercicio
          </Button>
          <Button variant="secondary" onClick={addRest} className="text-rest">
            {Ico.plus} Descanso
          </Button>
        </div>

        {/* Ajustes de la rutina */}
        <h2 className="mt-8 mb-3 font-display text-xl font-bold tracking-wide text-muted uppercase">Ajustes</h2>
        <div className="space-y-5 rounded-3xl bg-surface p-4">
          <Field label="Preparación antes de empezar">
            <Stepper value={draft.prepSeconds} onChange={(v) => set({ prepSeconds: v })} max={120} step={5} format={(v) => (v === 0 ? 'Sin' : dur(v))} presets={[0, 5, 10, 15, 30]} />
          </Field>
          <Field label="Vueltas" hint="Repite todos los pasos este número de veces.">
            <Stepper value={draft.rounds} onChange={(v) => set({ rounds: v })} min={1} max={20} format={(v) => `${v}×`} />
          </Field>
          {draft.rounds > 1 && (
            <Field label="Descanso entre vueltas">
              <Stepper value={draft.restBetweenRounds} onChange={(v) => set({ restBetweenRounds: v })} max={600} step={15} format={(v) => (v === 0 ? 'Sin' : dur(v))} presets={[0, 30, 60, 90, 120, 180]} />
            </Field>
          )}
        </div>

        {!isNew && (
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void share()}>
              {Ico.share} Compartir
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                const now = Date.now()
                const copy: Routine = { ...draft, id: newId(), name: `${draft.name} (copia)`, steps: draft.steps.map((s) => ({ ...s, id: newId() })), createdAt: now, updatedAt: now }
                await db.routines.add(copy)
                navigate(`/rutina/${copy.id}`, { replace: true })
              }}
            >
              {Ico.copy} Duplicar
            </Button>
            <Button variant="danger" className="col-span-2" onClick={() => setConfirmDelete(true)}>
              {Ico.trash} Eliminar rutina
            </Button>
          </div>
        )}
      </div>

      {/* Botón empezar */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-6">
        <Button
          className="mx-auto w-full max-w-lg text-lg"
          disabled={draft.steps.length === 0}
          onClick={async () => {
            unlockAudio()
            const r = await save()
            navigate(`/play/${r.id}`)
          }}
        >
          {Ico.play} Guardar y empezar
        </Button>
      </div>

      <ExercisePicker open={picking} exercises={exercises ?? []} onClose={() => setPicking(false)} onPick={addExercise} />

      {editingStep && (
        <StepSheet
          step={editingStep}
          ex={editingStep.type === 'exercise' ? exMap.get(editingStep.exerciseId) : undefined}
          onClose={() => setEditing(null)}
          onChange={(s) => setSteps(draft.steps.map((x) => (x.id === s.id ? s : x)))}
          onDelete={() => {
            setSteps(draft.steps.filter((x) => x.id !== editingStep.id))
            setEditing(null)
          }}
          onDuplicate={() => {
            const i = draft.steps.findIndex((x) => x.id === editingStep.id)
            const steps = draft.steps.slice()
            steps.splice(i + 1, 0, { ...editingStep, id: newId() })
            setSteps(steps)
            setEditing(null)
          }}
        />
      )}

      <Confirm
        open={confirmLeave}
        title="¿Salir sin guardar?"
        message="Tienes cambios sin guardar."
        confirmLabel="Guardar y salir"
        onConfirm={() => void save().then(() => navigate('/'))}
        onCancel={() => setConfirmLeave(false)}
        extra={
          <Button variant="danger" onClick={() => navigate('/')}>
            Descartar cambios
          </Button>
        }
      />
      <Confirm
        open={confirmDelete}
        danger
        title="¿Eliminar rutina?"
        message="El historial de esta rutina se mantiene."
        confirmLabel="Eliminar"
        onConfirm={async () => {
          await db.routines.delete(draft.id)
          if (draft.icon.kind === 'image') await db.images.delete(draft.icon.imageId)
          navigate('/', { replace: true })
        }}
        onCancel={() => setConfirmDelete(false)}
      />
      {toast && <div className="animate-pop fixed inset-x-0 bottom-28 z-50 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg">{toast}</div>}
    </div>
  )
}

function stepSummary(s: ExerciseStep): string {
  const main = s.mode === 'time' ? dur(s.seconds) : `${s.reps} reps`
  if (s.sets <= 1) return main
  return `${s.sets} × ${main}${s.restBetweenSets ? ` · desc. ${dur(s.restBetweenSets)}` : ''}`
}

function StepRow({ step, ex, onEdit, onUp, onDown }: { step: RoutineStep; ex?: Exercise; onEdit: () => void; onUp?: () => void; onDown?: () => void }) {
  const arrows = (
    <div className="flex flex-col">
      <button type="button" disabled={!onUp} onClick={onUp} className="press grid h-7 w-9 place-items-center text-muted disabled:opacity-20" aria-label="Subir">
        {Ico.up}
      </button>
      <button type="button" disabled={!onDown} onClick={onDown} className="press grid h-7 w-9 place-items-center text-muted disabled:opacity-20" aria-label="Bajar">
        {Ico.down}
      </button>
    </div>
  )

  if (step.type === 'rest') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-rest/25 bg-rest/8 py-1 pr-1 pl-3">
        <button type="button" onClick={onEdit} className="flex flex-1 items-center gap-3 py-1.5 text-left">
          <IconBadge icon={REST_ICON} colorKey={REST_COLOR} size={34} />
          <div className="flex-1 font-semibold text-rest">{step.label || 'Descanso'}</div>
          <div className="tabular font-display text-xl font-bold text-rest">{dur(step.seconds)}</div>
        </button>
        {arrows}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-surface py-1 pr-1 pl-3">
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left">
        <IconBadge icon={ex?.icon ?? { kind: 'emoji', value: '❔' }} colorKey={ex?.color ?? 'slate'} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{ex?.name ?? 'Ejercicio eliminado'}</div>
          <div className="truncate text-sm text-muted">
            {step.mode === 'reps' ? '✋ ' : '⏱ '}
            {stepSummary(step)}
            {step.note && ` · ${step.note}`}
          </div>
        </div>
      </button>
      {arrows}
    </div>
  )
}

function StepSheet({ step, ex, onClose, onChange, onDelete, onDuplicate }: { step: RoutineStep; ex?: Exercise; onClose: () => void; onChange: (s: RoutineStep) => void; onDelete: () => void; onDuplicate: () => void }) {
  return (
    <Sheet
      open
      onClose={onClose}
      title={step.type === 'rest' ? 'Descanso' : (ex?.name ?? 'Ejercicio')}
      footer={
        <div className="grid grid-cols-3 gap-2">
          <Button variant="danger" onClick={onDelete}>
            {Ico.trash}
          </Button>
          <Button variant="secondary" onClick={onDuplicate}>
            {Ico.copy}
          </Button>
          <Button onClick={onClose}>Listo</Button>
        </div>
      }
    >
      {step.type === 'rest' ? (
        <div className="space-y-5 pt-2">
          <Field label="Duración">
            <Stepper value={step.seconds} onChange={(v) => onChange({ ...step, seconds: v })} min={5} max={900} step={5} format={dur} presets={REST_PRESETS} />
          </Field>
          <Field label="Nombre (opcional)">
            <input className={inputCls} placeholder="Descanso" value={step.label ?? ''} onChange={(e) => onChange({ ...step, label: e.target.value })} />
          </Field>
        </div>
      ) : (
        <div className="space-y-5 pt-2">
          <Segmented
            value={step.mode}
            onChange={(mode) => onChange({ ...step, mode })}
            options={[
              { value: 'time', label: '⏱ Por tiempo' },
              { value: 'reps', label: '✋ Por repeticiones' },
            ]}
          />
          <p className="-mt-2 text-sm text-muted">
            {step.mode === 'time' ? 'Corre el timer y pasa solo al siguiente paso.' : 'Muestra las repeticiones y espera a que toques “Listo”.'}
          </p>
          {step.mode === 'time' ? (
            <Field label="Duración">
              <Stepper value={step.seconds} onChange={(v) => onChange({ ...step, seconds: v })} min={5} max={1800} step={5} format={dur} presets={SECONDS_PRESETS} />
            </Field>
          ) : (
            <Field label="Repeticiones">
              <Stepper value={step.reps} onChange={(v) => onChange({ ...step, reps: v })} min={1} max={200} presets={REPS_PRESETS} />
            </Field>
          )}
          <Field label="Series">
            <Stepper value={step.sets} onChange={(v) => onChange({ ...step, sets: v })} min={1} max={20} format={(v) => `${v}×`} />
          </Field>
          {step.sets > 1 && (
            <Field label="Descanso entre series" hint="Se agrega un descanso con timer entre cada serie (no después de la última).">
              <Stepper value={step.restBetweenSets} onChange={(v) => onChange({ ...step, restBetweenSets: v })} max={600} step={15} format={(v) => (v === 0 ? 'Sin' : dur(v))} presets={[0, 30, 45, 60, 90, 120, 180]} />
            </Field>
          )}
          <Field label="Nota (opcional)">
            <input className={inputCls} placeholder="Ej: 40 kg, agarre ancho…" value={step.note ?? ''} onChange={(e) => onChange({ ...step, note: e.target.value })} />
          </Field>
        </div>
      )}
    </Sheet>
  )
}

function ExercisePicker({ open, exercises, onClose, onPick }: { open: boolean; exercises: Exercise[]; onClose: () => void; onPick: (e: Exercise) => void }) {
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'time' | 'reps'>('reps')
  const filtered = exercises.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))

  const create = async () => {
    const now = Date.now()
    const ex: Exercise = {
      id: newId(),
      name: name.trim(),
      icon: { kind: 'emoji', value: '💪' },
      color: COLOR_KEYS[Math.floor(Math.random() * 10)],
      defaultMode: mode,
      defaultSeconds: 30,
      defaultReps: 10,
      createdAt: now,
      updatedAt: now,
    }
    await db.exercises.add(ex)
    setCreating(false)
    setName('')
    onPick(ex)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Agregar ejercicio">
      {creating ? (
        <div className="space-y-4 pt-2">
          <Field label="Nombre" hint="El icono, la imagen de técnica y lo demás lo editas después en Ejercicios.">
            <input autoFocus className={inputCls} placeholder="Ej: Press militar" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'reps', label: '✋ Repeticiones' },
              { value: 'time', label: '⏱ Tiempo' },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Volver
            </Button>
            <Button disabled={!name.trim()} onClick={() => void create()}>
              Crear y agregar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <input className={`${inputCls} mt-1`} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" onClick={() => { setName(q); setCreating(true) }} className="press mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line p-3 text-left font-semibold">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2">{Ico.plus}</span>
            Crear ejercicio nuevo{q && `: “${q}”`}
          </button>
          <div className="mt-2 divide-y divide-line/60">
            {filtered.map((e) => (
              <button key={e.id} type="button" onClick={() => onPick(e)} className="press flex w-full items-center gap-3 py-2.5 text-left">
                <IconBadge icon={e.icon} colorKey={e.color} size={44} />
                <div className="flex-1">
                  <div className="font-semibold">{e.name}</div>
                  <div className="text-sm text-muted">{e.defaultMode === 'time' ? `⏱ ${dur(e.defaultSeconds)}` : `✋ ${e.defaultReps} reps`}</div>
                </div>
                <span className="text-accent">{Ico.plus}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
