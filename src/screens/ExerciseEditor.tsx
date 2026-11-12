import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { IconPicker } from '../components/IconPicker'
import { BlobImage, Button, Confirm, Field, Ico, IconButton, Segmented, Stepper, Toggle, TopBar, inputCls } from '../components/ui'
import { MODE_OPTIONS } from '../lib/labels'
import { db, deleteExercise, newId, routinesUsingExercise } from '../db/db'
import { COLOR_KEYS } from '../lib/colors'
import { dur } from '../lib/format'
import { saveImage } from '../lib/images'
import type { Exercise } from '../types'

function blankExercise(): Exercise {
  const now = Date.now()
  return {
    id: newId(),
    name: '',
    icon: { kind: 'emoji', value: '💪' },
    color: COLOR_KEYS[Math.floor(Math.random() * 10)],
    defaultMode: 'reps',
    defaultSeconds: 30,
    defaultReps: 10,
    createdAt: now,
    updatedAt: now,
  }
}

export function ExerciseEditor() {
  const { id } = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const isNew = id === 'nuevo'
  const [draft, setDraft] = useState<Exercise | null>(null)
  const [usedIn, setUsedIn] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      const e = isNew ? blankExercise() : await db.exercises.get(id)
      if (!e) return navigate('/ejercicios', { replace: true })
      setDraft(e)
      if (!isNew) setUsedIn((await routinesUsingExercise(id)).map((r) => r.name))
    })()
  }, [id, isNew, navigate])

  if (!draft) return null
  const set = (patch: Partial<Exercise>) => setDraft({ ...draft, ...patch })

  const save = async () => {
    await db.exercises.put({ ...draft, name: draft.name.trim() || 'Ejercicio', updatedAt: Date.now() })
    navigate('/ejercicios')
  }

  const onTechnique = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try {
      const old = draft.techniqueImageId
      const techniqueImageId = await saveImage(f, { maxSize: 900 })
      set({ techniqueImageId })
      // Guardamos al tiro para no dejar imágenes huérfanas si sale sin guardar.
      if (!isNew) await db.exercises.update(draft.id, { techniqueImageId })
      if (old) await db.images.delete(old)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh pb-16">
      <TopBar
        title={isNew ? 'Nuevo ejercicio' : 'Ejercicio'}
        left={
          <IconButton label="Volver" onClick={() => navigate('/ejercicios')}>
            {Ico.back}
          </IconButton>
        }
        right={
          <button type="button" onClick={() => void save()} className="press rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg">
            Guardar
          </button>
        }
      />
      <div className="mx-auto max-w-lg space-y-6 px-4 pt-5">
        <div className="flex items-center gap-4">
          <IconPicker icon={draft.icon} colorKey={draft.color} onChange={(icon, color) => set({ icon, color })} />
          <input className={`${inputCls} h-14 text-lg font-semibold`} placeholder="Nombre del ejercicio" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </div>

        <Field label="Imagen de técnica" hint="Una foto o un GIF de cómo se hace bien. Se muestra mientras haces el ejercicio.">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onTechnique(e.target.files?.[0])} />
          {draft.techniqueImageId ? (
            <div className="relative overflow-hidden rounded-3xl bg-surface">
              <BlobImage id={draft.techniqueImageId} className="max-h-80 w-full object-contain" />
              <div className="absolute right-2 bottom-2 flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="press rounded-full bg-black/70 px-3 py-1.5 text-sm font-semibold backdrop-blur">
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const old = draft.techniqueImageId
                    set({ techniqueImageId: undefined })
                    if (!isNew) await db.exercises.update(draft.id, { techniqueImageId: undefined })
                    if (old) await db.images.delete(old)
                  }}
                  className="press rounded-full bg-black/70 px-3 py-1.5 text-sm font-semibold text-red-400 backdrop-blur"
                >
                  Quitar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="press flex h-36 w-full flex-col items-center justify-center gap-1 rounded-3xl border border-dashed border-line text-muted"
            >
              <span className="text-3xl">📷</span>
              <span className="text-sm font-semibold">{busy ? 'Procesando…' : 'Agregar foto o GIF'}</span>
            </button>
          )}
        </Field>

        <div className="space-y-5 rounded-3xl bg-surface p-4">
          <div className="text-xs font-semibold tracking-wider text-muted uppercase">Valores sugeridos al agregarlo a una rutina</div>
          <Segmented value={draft.defaultMode} onChange={(defaultMode) => set({ defaultMode })} options={MODE_OPTIONS} />
          {draft.defaultMode === 'time' && (
            <Stepper value={draft.defaultSeconds} onChange={(v) => set({ defaultSeconds: v })} min={5} max={1800} step={5} format={dur} presets={[20, 30, 40, 45, 60, 90]} />
          )}
          {draft.defaultMode === 'reps' && <Stepper value={draft.defaultReps} onChange={(v) => set({ defaultReps: v })} min={1} max={200} presets={[6, 8, 10, 12, 15, 20]} />}
          <div className="-mb-2">
            <Toggle checked={!!draft.defaultPerSide} onChange={(defaultPerSide) => set({ defaultPerSide })} label="Por lado" hint="Izquierda y derecha en cada serie." />
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-xs font-semibold tracking-wider text-muted uppercase">Ficha</div>
          <Field label="Descripción" hint="Cómo se hace. Se ve en el reproductor al tocar ⓘ.">
            <textarea
              className={`${inputCls} h-28 py-3`}
              placeholder="Ej: Agarra la barra con las palmas hacia adelante…"
              value={draft.description ?? ''}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
          <Field label="Tips">
            <textarea
              className={`${inputCls} h-24 py-3`}
              placeholder="Claves de técnica, respiración, errores comunes…"
              value={draft.tips ?? ''}
              onChange={(e) => set({ tips: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Más fácil">
              <textarea className={`${inputCls} h-20 py-3 text-sm`} placeholder="Variante más fácil" value={draft.easier ?? ''} onChange={(e) => set({ easier: e.target.value })} />
            </Field>
            <Field label="Más difícil">
              <textarea
                className={`${inputCls} h-20 py-3 text-sm`}
                placeholder="Variante más difícil"
                value={draft.harder ?? ''}
                onChange={(e) => set({ harder: e.target.value })}
              />
            </Field>
          </div>
        </div>

        {!isNew && (
          <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
            {Ico.trash} Eliminar ejercicio
          </Button>
        )}
      </div>

      <Confirm
        open={confirmDelete}
        danger
        title="¿Eliminar ejercicio?"
        message={usedIn.length ? `Se quitará de: ${usedIn.join(', ')}. El historial no cambia.` : 'El historial no cambia.'}
        confirmLabel="Eliminar"
        onConfirm={async () => {
          await deleteExercise(draft.id)
          navigate('/ejercicios', { replace: true })
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
