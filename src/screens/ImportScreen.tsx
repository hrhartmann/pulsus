import { useMemo, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { Button, EmptyState, IconBadge } from '../components/ui'
import { dur } from '../lib/format'
import { decodeSharedRoutine, importSharedRoutine } from '../lib/transfer'

/** Abre un link de rutina compartida: muestra la rutina y permite agregarla. */
export function ImportScreen() {
  const { data } = useParams<{ data: string }>()
  const [, navigate] = useLocation()
  const [busy, setBusy] = useState(false)
  const shared = useMemo(() => {
    try {
      return decodeSharedRoutine(data)
    } catch {
      return null
    }
  }, [data])

  if (!shared) {
    return (
      <div className="pt-safe min-h-dvh px-4">
        <EmptyState emoji="🤔" title="Link inválido">Este link de rutina no se pudo leer.</EmptyState>
        <Button className="mx-auto w-full max-w-sm" onClick={() => navigate('/', { replace: true })}>
          Ir a mis rutinas
        </Button>
      </div>
    )
  }

  const exById = new Map(shared.e.map((e) => [e.id, e]))
  const r = shared.r

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col px-5">
      <div className="mx-auto w-full max-w-lg flex-1 pt-8">
        <div className="text-sm font-semibold tracking-wider text-muted uppercase">Te compartieron una rutina</div>
        <div className="mt-4 flex items-center gap-4">
          <IconBadge icon={r.icon} colorKey={r.color} size={72} />
          <div>
            <div className="font-display text-4xl leading-none font-bold tracking-wide uppercase">{r.name}</div>
            {r.rounds > 1 && <div className="mt-1 text-muted">{r.rounds} vueltas</div>}
          </div>
        </div>
        <div className="mt-6 space-y-1.5">
          {r.steps.map((s) => {
            if (s.type === 'rest') {
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-rest/8 px-3 py-2 text-rest">
                  <span>😮‍💨</span>
                  <span className="flex-1 font-semibold">{s.label || 'Descanso'}</span>
                  <span>{dur(s.seconds)}</span>
                </div>
              )
            }
            const e = exById.get(s.exerciseId)
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2">
                <span className="text-xl">{e?.emoji ?? '💪'}</span>
                <span className="flex-1 font-semibold">{e?.name ?? 'Ejercicio'}</span>
                <span className="text-sm text-muted">
                  {s.sets > 1 ? `${s.sets} × ` : ''}
                  {s.mode === 'time' ? dur(s.seconds) : `${s.reps} reps`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-2 pt-6">
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const id = await importSharedRoutine(shared)
            navigate(`/rutina/${id}`, { replace: true })
          }}
        >
          Agregar a mis rutinas
        </Button>
        <Button variant="ghost" onClick={() => navigate('/', { replace: true })}>
          No, gracias
        </Button>
      </div>
    </div>
  )
}
