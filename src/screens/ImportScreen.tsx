import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { Button, EmptyState, IconBadge, Ico, IconButton, TopBar } from '../components/ui'
import { colorFor, type PackExerciseStep, type PackRoutine } from '../pack/pack'
import { applyPlan, decodePackParam, type PackPreview, previewPack } from '../pack/io'
import { dur } from '../lib/format'

/** Texto de un paquete elegido desde Ajustes (archivo), para mostrarlo en esta pantalla. */
let pendingText: string | null = null
export function setPendingPack(text: string) {
  pendingText = text
}

/**
 * Vista previa e importación de un paquete `pulsus-pack/1`.
 * Llega por link compartido (#/importar/<base64>) o por archivo (#/importar/archivo).
 */
export function ImportScreen() {
  const { data } = useParams<{ data: string }>()
  const [, navigate] = useLocation()
  const [preview, setPreview] = useState<PackPreview | { error: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      let text: string
      try {
        text = data === 'archivo' ? (pendingText ?? '') : decodePackParam(data)
      } catch {
        setPreview({ error: 'Este link no se pudo leer.' })
        return
      }
      if (!text) return navigate('/ajustes', { replace: true })
      setPreview(await previewPack(text))
    })()
  }, [data, navigate])

  const back = (
    <IconButton label="Volver" onClick={() => navigate('/', { replace: true })}>
      {Ico.back}
    </IconButton>
  )

  if (!preview) return <div className="min-h-dvh" />

  if ('error' in preview) {
    return (
      <div className="min-h-dvh">
        <TopBar title="Importar" left={back} />
        <EmptyState emoji="🤔" title="No se pudo leer">
          {preview.error}
        </EmptyState>
      </div>
    )
  }

  const { pack, validation, plan } = preview
  const exById = new Map((pack.exercises ?? []).map((e) => [e.id, e]))

  return (
    <div className="pb-safe min-h-dvh">
      <TopBar title="Importar" left={back} />
      <div className="mx-auto max-w-lg px-4 pt-5 pb-40">
        <div className="text-xs font-semibold tracking-wider text-muted uppercase">Paquete de rutinas</div>
        <h1 className="mt-1 font-display text-3xl leading-tight font-bold tracking-wide uppercase">{pack.name || 'Sin nombre'}</h1>
        {pack.description && <p className="mt-1 text-muted">{pack.description}</p>}

        {validation.errors.length > 0 && (
          <div className="mt-5 rounded-3xl border border-red-500/40 bg-red-500/10 p-4">
            <div className="font-semibold text-red-300">
              El paquete tiene {validation.errors.length} error{validation.errors.length === 1 ? '' : 'es'}. No se puede importar.
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-red-200/90">
              {validation.errors.slice(0, 30).map((e, i) => (
                <li key={i} className="font-mono text-[12px] leading-snug">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Stat n={plan.summary.routinesCreated} label="rutinas nuevas" />
            <Stat n={plan.summary.routinesUpdated} label="rutinas que se reemplazan" warn={plan.summary.routinesUpdated > 0} />
            <Stat n={plan.summary.exercisesCreated} label="ejercicios nuevos" />
            <Stat n={plan.summary.exercisesUpdated} label="ejercicios que se actualizan" />
          </div>
        )}
        {plan && plan.summary.routinesUpdated > 0 && (
          <p className="mt-2 text-sm text-amber-300/90">Las rutinas que ya tenías con el mismo id se reemplazan por las del paquete. Tu historial y tus imágenes no cambian.</p>
        )}

        {validation.warnings.length > 0 && (
          <details className="mt-4 rounded-2xl bg-surface p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-muted">{validation.warnings.length} advertencia(s)</summary>
            <ul className="mt-2 space-y-1">
              {validation.warnings.map((w, i) => (
                <li key={i} className="font-mono text-[12px] text-muted">
                  {w}
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-6 space-y-3">
          {(pack.routines ?? []).map((r) => (
            <RoutinePreview key={r.id} routine={r} exName={(id) => exById.get(id)?.name ?? id} exEmoji={(id) => exById.get(id)?.emoji} />
          ))}
          {(pack.routines ?? []).length === 0 && (pack.exercises ?? []).length > 0 && (
            <div className="rounded-2xl bg-surface p-4 text-sm text-muted">Solo trae ejercicios: {(pack.exercises ?? []).map((e) => e.name).join(', ')}.</div>
          )}
        </div>
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-6">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          <Button
            disabled={!plan || busy}
            onClick={async () => {
              if (!plan) return
              setBusy(true)
              await applyPlan(plan)
              navigate(plan.routines.length === 1 ? `/rutina/${plan.routines[0].id}` : '/', { replace: true })
            }}
          >
            {plan ? 'Importar' : 'No se puede importar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Stat({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface p-3">
      <div className={`tabular font-display text-3xl font-bold ${warn ? 'text-amber-300' : ''}`}>{n}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

function RoutinePreview({ routine, exName, exEmoji }: { routine: PackRoutine; exName: (id: string) => string; exEmoji: (id: string) => string | undefined }) {
  const [open, setOpen] = useState(false)
  const steps = routine.blocks.flatMap((b) => b.steps)
  const exCount = steps.filter((s) => 'exercise' in s).length
  return (
    <div className="rounded-3xl bg-surface p-4">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 text-left">
        <IconBadge icon={{ kind: 'emoji', value: routine.emoji || '🏋️' }} colorKey={routine.color ?? colorFor(routine.id)} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{routine.name}</div>
          <div className="truncate text-sm text-muted">{routine.description || `${routine.blocks.length} bloque(s) · ${exCount} ejercicio(s)`}</div>
        </div>
        <span className={`text-muted transition ${open ? 'rotate-180' : ''}`}>{Ico.down}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-line/60 pt-3">
          {routine.blocks.map((b, bi) => (
            <div key={bi}>
              {b.name && <div className="mb-1 text-xs font-bold tracking-wider text-muted uppercase">{b.name}</div>}
              <div className="space-y-1">
                {b.steps.map((s, si) =>
                  'rest' in s ? (
                    <div key={si} className="flex justify-between text-sm text-rest">
                      <span>😮‍💨 {s.label || 'Descanso'}</span>
                      <span>{dur(s.rest)}</span>
                    </div>
                  ) : (
                    <div key={si} className="flex justify-between gap-3 text-sm">
                      <span className="truncate">
                        {exEmoji(s.exercise) ?? '💪'} {exName(s.exercise)}
                      </span>
                      <span className="shrink-0 text-muted">{summary(s)}</span>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function summary(s: PackExerciseStep): string {
  const main = s.max ? 'máx.' : s.seconds ? dur(s.seconds) : `${s.reps} reps`
  return `${s.sets && s.sets > 1 ? `${s.sets} × ` : ''}${main}${s.perSide ? ' por lado' : ''}`
}
