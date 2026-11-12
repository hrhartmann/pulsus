import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { unlockAudio } from '../audio/audio'
import { BigTitle, EmptyState, IconBadge, Ico } from '../components/ui'
import { db } from '../db/db'
import { estimateDuration, expandRoutine } from '../engine/expand'
import { loadActive } from '../lib/active'
import { color } from '../lib/colors'
import { approxMinutes, shortDate } from '../lib/format'
import type { Exercise, Routine } from '../types'

export function RoutinesScreen() {
  const [, navigate] = useLocation()
  const routines = useLiveQuery(() => db.routines.orderBy('createdAt').toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const lastDone = useLiveQuery(async () => {
    const map = new Map<string, number>()
    await db.sessions.orderBy('startedAt').each((s) => map.set(s.routineId, s.startedAt))
    return map
  }, [])
  const exMap = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])
  const [active] = useState(() => loadActive())

  const play = (r: Routine) => {
    unlockAudio() // tiene que ser dentro del toque para que suene en iPhone
    navigate(`/play/${r.id}`)
  }

  return (
    <div>
      <BigTitle
        right={
          <Link href="/rutina/nueva" className="press mb-1 flex h-10 items-center gap-1 rounded-full bg-ink pr-4 pl-3 text-sm font-semibold text-bg">
            {Ico.plus} Nueva
          </Link>
        }
      >
        Rutinas
      </BigTitle>

      <div className="mx-auto max-w-lg space-y-3 px-4 pt-2">
        <InstallHint />

        {active && !active.state.finishedAt && (
          <button
            type="button"
            onClick={() => {
              unlockAudio()
              navigate(`/play/${active.routine.id}`)
            }}
            className="press flex w-full items-center gap-3 rounded-3xl border border-accent/50 bg-accent/10 p-4 text-left"
          >
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
            </span>
            <div className="flex-1">
              <div className="text-xs font-semibold tracking-wider text-accent uppercase">En curso</div>
              <div className="font-semibold">{active.routine.name}</div>
            </div>
            <span className="text-sm font-semibold text-accent">Continuar →</span>
          </button>
        )}

        {routines?.length === 0 && (
          <EmptyState emoji="⚡" title="Sin rutinas">
            Crea tu primera rutina con el botón <b>Nueva</b>.
          </EmptyState>
        )}

        {routines?.map((r) => (
          <RoutineCard key={r.id} routine={r} exMap={exMap} last={lastDone?.get(r.id)} onPlay={() => play(r)} />
        ))}
      </div>
    </div>
  )
}

function RoutineCard({ routine, exMap, last, onPlay }: { routine: Routine; exMap: Map<string, Exercise>; last?: number; onPlay: () => void }) {
  const c = color(routine.color)
  const segs = expandRoutine(routine, exMap)
  const { seconds, manualCount } = estimateDuration(segs)
  const exerciseCount = routine.steps.filter((s) => s.type === 'exercise').length
  const preview = routine.steps.flatMap((s) => (s.type === 'exercise' ? [exMap.get(s.exerciseId)] : [])).filter(Boolean).slice(0, 6) as Exercise[]

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface" style={{ backgroundImage: `radial-gradient(120% 90% at 100% 0%, ${c.solid}22, transparent 60%)` }}>
      <Link href={`/rutina/${routine.id}`} className="block p-4 pr-24">
        <div className="flex items-center gap-3">
          <IconBadge icon={routine.icon} colorKey={routine.color} size={52} />
          <div className="min-w-0">
            <div className="truncate font-display text-2xl leading-tight font-bold tracking-wide uppercase">{routine.name}</div>
            <div className="text-sm text-muted">
              {exerciseCount} ejercicio{exerciseCount === 1 ? '' : 's'}
              {routine.rounds > 1 && ` · ${routine.rounds} vueltas`}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1">
          {preview.map((e, i) => (
            <IconBadge key={i} icon={e.icon} colorKey={e.color} size={26} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span>⏱ ≈ {approxMinutes(seconds)}</span>
          {manualCount > 0 && <span>✋ + {manualCount} por repeticiones</span>}
          {last && <span>Última vez: {shortDate(last)}</span>}
        </div>
      </Link>
      <button
        type="button"
        aria-label={`Empezar ${routine.name}`}
        onClick={onPlay}
        className="press absolute top-1/2 right-4 grid h-16 w-16 -translate-y-1/2 place-items-center rounded-full text-bg shadow-lg"
        style={{ background: c.solid, boxShadow: `0 8px 30px ${c.solid}55` }}
      >
        <span className="ml-1">{Ico.play}</span>
      </button>
    </div>
  )
}

function InstallHint() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('pulsus.hideInstall') === '1'
    } catch {
      return false
    }
  })
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  if (standalone || hidden) return null
  return (
    <div className="rounded-3xl border border-line bg-surface-2 p-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl">📲</div>
        <div className="flex-1 text-sm">
          <div className="font-semibold">Instala Pulsus en tu iPhone</div>
          <div className="mt-1 text-muted">
            En Safari toca <b>Compartir</b> <span className="inline-block translate-y-0.5">{Ico.share}</span> y luego <b>Agregar a inicio</b>. Así funciona sin internet y a pantalla completa.
          </div>
        </div>
        <button
          type="button"
          className="text-faint"
          aria-label="Ocultar"
          onClick={() => {
            setHidden(true)
            try {
              localStorage.setItem('pulsus.hideInstall', '1')
            } catch {
              // nada
            }
          }}
        >
          {Ico.close}
        </button>
      </div>
    </div>
  )
}
