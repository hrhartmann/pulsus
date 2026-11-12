import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { BigTitle, Button, Confirm, EmptyState, IconBadge, Ico, IconButton, TopBar } from '../components/ui'
import { db } from '../db/db'
import { clock, dur, shortDate, time } from '../lib/format'
import type { Session } from '../types'

export function HistoryScreen() {
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), [])
  const list = sessions ?? []

  const startOfWeek = (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d.getTime()
  })()
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const week = list.filter((s) => s.startedAt >= startOfWeek)
  const month = list.filter((s) => s.startedAt >= startOfMonth)
  const monthMs = month.reduce((a, s) => a + s.durationMs, 0)

  // Agrupar por mes
  const groups = new Map<string, Session[]>()
  const monthFmt = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' })
  for (const s of list) {
    const k = monthFmt.format(s.startedAt)
    groups.set(k, [...(groups.get(k) ?? []), s])
  }

  return (
    <div>
      <BigTitle>Historial</BigTitle>
      <div className="mx-auto max-w-lg px-4 pt-2">
        <div className="grid grid-cols-3 gap-2">
          <Stat value={week.length} label="esta semana" />
          <Stat value={month.length} label="este mes" />
          <Stat value={clock(monthMs / 1000).replace(/:\d\d$/, '')} label={monthMs >= 3_600_000 ? 'h:min este mes' : 'min este mes'} />
        </div>

        {list.length === 0 && (
          <EmptyState emoji="📈" title="Sin registros">
            Cada rutina que hagas queda guardada aquí, tal como la hiciste.
          </EmptyState>
        )}

        {[...groups.entries()].map(([month, items]) => (
          <div key={month} className="mt-6">
            <h2 className="mb-2 font-display text-lg font-bold tracking-wide text-muted uppercase">{month}</h2>
            <div className="space-y-2">
              {items.map((s) => (
                <Link key={s.id} href={`/historial/${s.id}`} className="press flex items-center gap-3 rounded-2xl bg-surface p-3">
                  <IconBadge icon={s.routineIcon} colorKey={s.routineColor} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{s.routineName}</div>
                    <div className="text-sm text-muted">
                      {shortDate(s.startedAt)} · {time(s.startedAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tabular font-display text-xl font-bold">{clock(s.durationMs / 1000)}</div>
                    <div className={`text-xs font-semibold ${s.completed ? 'text-green-400' : 'text-amber-400'}`}>{s.completed ? '✓ completa' : 'incompleta'}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center">
      <div className="tabular font-display text-3xl font-bold">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  )
}

export function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const [confirm, setConfirm] = useState(false)
  if (!session) return null

  const ex = session.segments.filter((s) => s.kind === 'exercise')
  const done = ex.filter((s) => s.status === 'done').length

  return (
    <div className="min-h-dvh pb-16">
      <TopBar
        title="Detalle"
        left={
          <IconButton label="Volver" onClick={() => navigate('/historial')}>
            {Ico.back}
          </IconButton>
        }
      />
      <div className="mx-auto max-w-lg px-4 pt-5">
        <div className="flex items-center gap-4">
          <IconBadge icon={session.routineIcon} colorKey={session.routineColor} size={64} />
          <div>
            <div className="font-display text-3xl leading-tight font-bold tracking-wide uppercase">{session.routineName}</div>
            <div className="text-muted">
              {shortDate(session.startedAt)} · {time(session.startedAt)} – {time(session.endedAt)}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat value={clock(session.durationMs / 1000)} label="duración" />
          <Stat value={`${done}/${ex.length}`} label="ejercicios" />
          <Stat value={session.completed ? '✓' : '—'} label={session.completed ? 'completa' : 'incompleta'} />
        </div>

        <h2 className="mt-6 mb-2 font-display text-lg font-bold tracking-wide text-muted uppercase">Así la hiciste</h2>
        <div className="divide-y divide-line/60 rounded-2xl bg-surface px-3">
          {session.segments.map((s, i) => (
            <div key={i}>
              {s.block && s.block !== session.segments[i - 1]?.block && <div className="pt-3 pb-1 text-xs font-bold tracking-wider text-muted uppercase">{s.block}</div>}
              <div className={`flex items-center gap-3 py-2.5 ${s.status !== 'done' ? 'opacity-50' : ''}`}>
                <span className="w-5 text-center text-sm">{s.status === 'done' ? '✓' : s.status === 'skipped' ? '↷' : '·'}</span>
                <span className="text-lg">{s.emoji ?? '💪'}</span>
                <div className="min-w-0 flex-1">
                  <div className={`truncate ${s.kind === 'exercise' ? 'font-semibold' : 'text-sm text-muted'}`}>
                    {s.name}
                    {s.side && <span className="font-normal text-muted"> · {s.side === 'left' ? 'izquierda' : 'derecha'}</span>}
                    {s.set && (
                      <span className="font-normal text-muted">
                        {' '}
                        · serie {s.set}/{s.sets}
                      </span>
                    )}
                  </div>
                  {s.note && <div className="text-xs text-muted">{s.note}</div>}
                </div>
                <div className="text-right text-sm">
                  {s.actualReps !== undefined ? (
                    <div className="tabular font-semibold text-accent">{s.actualReps} reps</div>
                  ) : (
                    <div className="tabular font-semibold">{clock(s.elapsedMs / 1000)}</div>
                  )}
                  <div className="text-xs text-faint">
                    {s.max
                      ? s.actualReps !== undefined
                        ? clock(s.elapsedMs / 1000)
                        : 'máx.'
                      : s.plannedReps
                        ? `${s.plannedReps} reps`
                        : s.plannedSeconds
                          ? `plan ${dur(s.plannedSeconds)}`
                          : ''}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="danger" className="mt-6 w-full" onClick={() => setConfirm(true)}>
          {Ico.trash} Borrar del historial
        </Button>
      </div>
      <Confirm
        open={confirm}
        danger
        title="¿Borrar este registro?"
        confirmLabel="Borrar"
        onConfirm={async () => {
          await db.sessions.delete(session.id)
          navigate('/historial', { replace: true })
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}
