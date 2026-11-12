import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { unlockAudio } from '../audio/audio'
import { IconPicker } from '../components/IconPicker'
import { Button, Confirm, Field, IconBadge, Ico, IconButton, Segmented, Sheet, Stepper, Toggle, TopBar, inputCls } from '../components/ui'
import { db, newId } from '../db/db'
import { REST_COLOR, REST_ICON, allSteps, estimateDuration, expandRoutine } from '../engine/expand'
import { COLOR_KEYS } from '../lib/colors'
import { approxMinutes, dur } from '../lib/format'
import { MODE_OPTIONS, exerciseDefaultLabel } from '../lib/labels'
import { routineShareUrl } from '../pack/io'
import type { Block, Exercise, ExerciseMode, ExerciseStep, RestStep, Routine, RoutineStep } from '../types'

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
    blocks: [{ id: newId(), name: '', steps: [] }],
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
  /** Bloque al que se agrega el ejercicio elegido en el selector. */
  const [pickingBlock, setPickingBlock] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingBlock, setDeletingBlock] = useState<string | null>(null)
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
  const setBlocks = (blocks: Block[]) => set({ blocks })
  const mapBlock = (blockId: string, fn: (b: Block) => Block) => setBlocks(draft.blocks.map((b) => (b.id === blockId ? fn(b) : b)))
  const steps = allSteps(draft)

  const save = async () => {
    const r = { ...draft, name: draft.name.trim() || 'Mi rutina', updatedAt: Date.now() }
    await db.routines.put(r)
    setDraft(r)
    setOriginal(JSON.stringify(r))
    return r
  }

  const locate = (stepId: string): [number, number] => {
    for (let bi = 0; bi < draft.blocks.length; bi++) {
      const si = draft.blocks[bi].steps.findIndex((s) => s.id === stepId)
      if (si >= 0) return [bi, si]
    }
    return [-1, -1]
  }

  /** Sube o baja un paso. En el borde de un bloque pasa al bloque vecino. */
  const moveStep = (stepId: string, d: -1 | 1) => {
    const [bi, si] = locate(stepId)
    if (bi < 0) return
    const blocks = draft.blocks.map((b) => ({ ...b, steps: b.steps.slice() }))
    const list = blocks[bi].steps
    const j = si + d
    if (j >= 0 && j < list.length) {
      ;[list[si], list[j]] = [list[j], list[si]]
    } else {
      const nb = bi + d
      if (nb < 0 || nb >= blocks.length) return
      const [step] = list.splice(si, 1)
      if (d < 0) blocks[nb].steps.push(step)
      else blocks[nb].steps.unshift(step)
    }
    setBlocks(blocks)
  }

  const moveBlock = (bi: number, d: -1 | 1) => {
    const j = bi + d
    if (j < 0 || j >= draft.blocks.length) return
    const blocks = draft.blocks.slice()
    ;[blocks[bi], blocks[j]] = [blocks[j], blocks[bi]]
    setBlocks(blocks)
  }

  const addExercise = (ex: Exercise) => {
    const blockId = pickingBlock ?? draft.blocks[draft.blocks.length - 1].id
    const step: ExerciseStep = {
      id: newId(),
      type: 'exercise',
      exerciseId: ex.id,
      mode: ex.defaultMode,
      seconds: ex.defaultSeconds || 30,
      reps: ex.defaultReps || 10,
      sets: 1,
      restBetweenSets: 60,
      perSide: ex.defaultPerSide || undefined,
    }
    mapBlock(blockId, (b) => ({ ...b, steps: [...b.steps, step] }))
    setPickingBlock(null)
  }

  const addRest = (blockId: string) => {
    const lastRest = [...steps].reverse().find((s): s is RestStep => s.type === 'rest')
    mapBlock(blockId, (b) => ({ ...b, steps: [...b.steps, { id: newId(), type: 'rest', seconds: lastRest?.seconds ?? 60 }] }))
  }

  const updateStep = (step: RoutineStep) => setBlocks(draft.blocks.map((b) => ({ ...b, steps: b.steps.map((x) => (x.id === step.id ? step : x)) })))
  const deleteStep = (stepId: string) => setBlocks(draft.blocks.map((b) => ({ ...b, steps: b.steps.filter((x) => x.id !== stepId) })))
  const duplicateStep = (stepId: string) => {
    const [bi, si] = locate(stepId)
    const blocks = draft.blocks.map((b) => ({ ...b, steps: b.steps.slice() }))
    blocks[bi].steps.splice(si + 1, 0, { ...blocks[bi].steps[si], id: newId() })
    setBlocks(blocks)
  }

  const segs = expandRoutine(draft, exMap)
  const { seconds, manualCount } = estimateDuration(segs)
  const editingStep = steps.find((s) => s.id === editing)
  const singleUnnamed = draft.blocks.length === 1 && !draft.blocks[0].name

  const share = async () => {
    const r = await save()
    const url = await routineShareUrl(r.id)
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
          <div className="min-w-0 flex-1 space-y-2">
            <input
              className={`${inputCls} h-14 font-display text-2xl font-bold tracking-wide uppercase`}
              placeholder="Nombre de la rutina"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
            />
            <input
              className={`${inputCls} h-10 text-sm`}
              placeholder="Descripción (opcional): dónde, cuánto dura…"
              value={draft.description ?? ''}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 text-sm text-muted">
          <span>⏱ ≈ {approxMinutes(seconds)}</span>
          {manualCount > 0 && <span>✋ + {manualCount} a tu ritmo</span>}
          {steps.length > 0 && <span>{segs.length} pasos en total</span>}
        </div>

        {/* Bloques y pasos */}
        <div className="mt-6 space-y-6">
          {draft.blocks.map((block, bi) => (
            <section key={block.id}>
              <div className="mb-2 flex items-center gap-1">
                <input
                  className="h-9 min-w-0 flex-1 rounded-xl bg-transparent px-1 font-display text-xl font-bold tracking-wide text-muted uppercase outline-none placeholder:text-faint focus:bg-surface-2 focus:text-ink"
                  placeholder={singleUnnamed ? 'Pasos' : 'Bloque sin nombre'}
                  value={block.name}
                  onChange={(e) => mapBlock(block.id, (b) => ({ ...b, name: e.target.value }))}
                />
                {draft.blocks.length > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={bi === 0}
                      onClick={() => moveBlock(bi, -1)}
                      className="press grid h-8 w-8 place-items-center text-muted disabled:opacity-20"
                      aria-label="Subir bloque"
                    >
                      {Ico.up}
                    </button>
                    <button
                      type="button"
                      disabled={bi === draft.blocks.length - 1}
                      onClick={() => moveBlock(bi, 1)}
                      className="press grid h-8 w-8 place-items-center text-muted disabled:opacity-20"
                      aria-label="Bajar bloque"
                    >
                      {Ico.down}
                    </button>
                    <button
                      type="button"
                      onClick={() => (block.steps.length ? setDeletingBlock(block.id) : setBlocks(draft.blocks.filter((b) => b.id !== block.id)))}
                      className="press grid h-8 w-8 place-items-center text-faint"
                      aria-label="Eliminar bloque"
                    >
                      {Ico.trash}
                    </button>
                  </>
                )}
              </div>

              <div className="space-y-2">
                {block.steps.map((s, si) => (
                  <StepRow
                    key={s.id}
                    step={s}
                    ex={s.type === 'exercise' ? exMap.get(s.exerciseId) : undefined}
                    onEdit={() => setEditing(s.id)}
                    onUp={bi > 0 || si > 0 ? () => moveStep(s.id, -1) : undefined}
                    onDown={bi < draft.blocks.length - 1 || si < block.steps.length - 1 ? () => moveStep(s.id, 1) : undefined}
                  />
                ))}
                {block.steps.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-line p-5 text-center text-sm text-muted">
                    Agrega ejercicios y descansos. Un ejercicio puede ir por <b>tiempo</b> (avanza solo), por <b>repeticiones</b> o al <b>máximo</b> (esperan a que toques “Listo”).
                  </div>
                )}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="secondary" className="h-10 text-sm" onClick={() => setPickingBlock(block.id)}>
                  {Ico.plus} Ejercicio
                </Button>
                <Button variant="secondary" className="h-10 text-sm text-rest" onClick={() => addRest(block.id)}>
                  {Ico.plus} Descanso
                </Button>
              </div>
            </section>
          ))}
        </div>

        <Button variant="ghost" className="mt-3 w-full border border-dashed border-line" onClick={() => setBlocks([...draft.blocks, { id: newId(), name: '', steps: [] }])}>
          {Ico.plus} Nuevo bloque
        </Button>
        <p className="mt-1 text-center text-xs text-faint">Los bloques ordenan la rutina: Calentamiento, Principal, Core…</p>

        {/* Ajustes de la rutina */}
        <h2 className="mt-8 mb-3 font-display text-xl font-bold tracking-wide text-muted uppercase">Ajustes</h2>
        <div className="space-y-5 rounded-3xl bg-surface p-4">
          <Field label="Preparación antes de empezar">
            <Stepper
              value={draft.prepSeconds}
              onChange={(v) => set({ prepSeconds: v })}
              max={120}
              step={5}
              format={(v) => (v === 0 ? 'Sin' : dur(v))}
              presets={[0, 5, 10, 15, 30]}
            />
          </Field>
          <Field label="Vueltas" hint="Repite la rutina completa este número de veces.">
            <Stepper value={draft.rounds} onChange={(v) => set({ rounds: v })} min={1} max={20} format={(v) => `${v}×`} />
          </Field>
          {draft.rounds > 1 && (
            <Field label="Descanso entre vueltas">
              <Stepper
                value={draft.restBetweenRounds}
                onChange={(v) => set({ restBetweenRounds: v })}
                max={600}
                step={15}
                format={(v) => (v === 0 ? 'Sin' : dur(v))}
                presets={[0, 30, 60, 90, 120, 180]}
              />
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
                const copy: Routine = {
                  ...draft,
                  id: newId(),
                  name: `${draft.name} (copia)`,
                  blocks: draft.blocks.map((b) => ({ ...b, id: newId(), steps: b.steps.map((s) => ({ ...s, id: newId() })) })),
                  createdAt: now,
                  updatedAt: now,
                }
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
          disabled={steps.length === 0}
          onClick={async () => {
            unlockAudio()
            const r = await save()
            navigate(`/play/${r.id}`)
          }}
        >
          {Ico.play} Guardar y empezar
        </Button>
      </div>

      <ExercisePicker open={pickingBlock !== null} exercises={exercises ?? []} onClose={() => setPickingBlock(null)} onPick={addExercise} />

      {editingStep && (
        <StepSheet
          step={editingStep}
          ex={editingStep.type === 'exercise' ? exMap.get(editingStep.exerciseId) : undefined}
          onClose={() => setEditing(null)}
          onChange={updateStep}
          onDelete={() => {
            deleteStep(editingStep.id)
            setEditing(null)
          }}
          onDuplicate={() => {
            duplicateStep(editingStep.id)
            setEditing(null)
          }}
        />
      )}

      <Confirm
        open={deletingBlock !== null}
        danger
        title="¿Eliminar bloque?"
        message="Se eliminan también sus pasos."
        confirmLabel="Eliminar bloque"
        onConfirm={() => {
          setBlocks(draft.blocks.filter((b) => b.id !== deletingBlock))
          setDeletingBlock(null)
        }}
        onCancel={() => setDeletingBlock(null)}
      />
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

const MODE_HELP: Record<ExerciseMode, string> = {
  time: 'Corre el timer y pasa solo al siguiente paso.',
  reps: 'Muestra las repeticiones y espera a que toques “Listo”.',
  max: 'Máximo de repeticiones: espera “Listo” y te pregunta cuántas hiciste.',
}

function stepSummary(s: ExerciseStep): string {
  const main = s.mode === 'time' ? dur(s.seconds) : s.mode === 'max' ? 'máx. reps' : `${s.reps} reps`
  const side = s.perSide ? ' por lado' : ''
  if (s.sets <= 1) return main + side
  return `${s.sets} × ${main}${side}${s.restBetweenSets ? ` · desc. ${dur(s.restBetweenSets)}` : ''}`
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
            {step.mode === 'time' ? '⏱ ' : step.mode === 'max' ? '🔥 ' : '✋ '}
            {stepSummary(step)}
            {step.note && ` · ${step.note}`}
          </div>
        </div>
      </button>
      {arrows}
    </div>
  )
}

function StepSheet({
  step,
  ex,
  onClose,
  onChange,
  onDelete,
  onDuplicate,
}: {
  step: RoutineStep
  ex?: Exercise
  onClose: () => void
  onChange: (s: RoutineStep) => void
  onDelete: () => void
  onDuplicate: () => void
}) {
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
          <Segmented value={step.mode} onChange={(mode) => onChange({ ...step, mode })} options={MODE_OPTIONS} />
          <p className="-mt-2 text-sm text-muted">{MODE_HELP[step.mode]}</p>
          {step.mode === 'time' && (
            <Field label="Duración">
              <Stepper value={step.seconds} onChange={(v) => onChange({ ...step, seconds: v })} min={5} max={1800} step={5} format={dur} presets={SECONDS_PRESETS} />
            </Field>
          )}
          {step.mode === 'reps' && (
            <Field label="Repeticiones">
              <Stepper value={step.reps} onChange={(v) => onChange({ ...step, reps: v })} min={1} max={200} presets={REPS_PRESETS} />
            </Field>
          )}
          <div className="rounded-2xl bg-surface-2 px-4">
            <Toggle
              checked={!!step.perSide}
              onChange={(perSide) => onChange({ ...step, perSide: perSide || undefined })}
              label="Por lado"
              hint={step.mode === 'time' ? 'Izquierda y derecha, con 5 s para cambiar de lado.' : 'Izquierda y derecha, cada una con su “Listo”.'}
            />
          </div>
          <Field label="Series">
            <Stepper value={step.sets} onChange={(v) => onChange({ ...step, sets: v })} min={1} max={20} format={(v) => `${v}×`} />
          </Field>
          {step.sets > 1 && (
            <Field label="Descanso entre series" hint="Se agrega un descanso con timer entre cada serie (no después de la última).">
              <Stepper
                value={step.restBetweenSets}
                onChange={(v) => onChange({ ...step, restBetweenSets: v })}
                max={600}
                step={15}
                format={(v) => (v === 0 ? 'Sin' : dur(v))}
                presets={[0, 30, 45, 60, 90, 120, 180]}
              />
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
  const [mode, setMode] = useState<ExerciseMode>('reps')
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
          <Segmented value={mode} onChange={setMode} options={MODE_OPTIONS} />
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
          <button
            type="button"
            onClick={() => {
              setName(q)
              setCreating(true)
            }}
            className="press mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line p-3 text-left font-semibold"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2">{Ico.plus}</span>
            Crear ejercicio nuevo{q && `: “${q}”`}
          </button>
          <div className="mt-2 divide-y divide-line/60">
            {filtered.map((e) => (
              <button key={e.id} type="button" onClick={() => onPick(e)} className="press flex w-full items-center gap-3 py-2.5 text-left">
                <IconBadge icon={e.icon} colorKey={e.color} size={44} />
                <div className="flex-1">
                  <div className="font-semibold">{e.name}</div>
                  <div className="text-sm text-muted">{exerciseDefaultLabel(e)}</div>
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
