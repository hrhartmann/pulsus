import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { audioReady, sounds, speak, unlockAudio } from '../audio/audio'
import { useLiveQuery } from 'dexie-react-hooks'
import { BlobImage, Button, IconBadge, Ico, Sheet, Stepper } from '../components/ui'
import { db, exerciseMap, newId } from '../db/db'
import { SIDE_LABEL, expandRoutine, segmentTarget } from '../engine/expand'
import * as P from '../engine/player'
import { type ActiveRun, clearActive, loadActive, saveActive } from '../lib/active'
import { color } from '../lib/colors'
import { clock, dur } from '../lib/format'
import { getSettings } from '../lib/settings'
import { useWakeLock } from '../lib/wakeLock'
import type { Segment } from '../types'

/** Eventos más viejos que esto no suenan (pasaron mientras la app estaba congelada). */
const FRESH_MS = 1500

export function PlayerScreen() {
  const { id } = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const [run, setRun] = useState<ActiveRun | null>(null)
  const runRef = useRef<ActiveRun | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [needsTap, setNeedsTap] = useState(false)
  const [showList, setShowList] = useState(false)
  const [showExit, setShowExit] = useState(false)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [showFicha, setShowFicha] = useState(false)
  const [askReps, setAskReps] = useState(false)
  const [repsDraft, setRepsDraft] = useState(10)
  const exerciseList = useLiveQuery(() => db.exercises.toArray(), [])
  const savedRef = useRef(false)

  // ---------- Eventos → sonidos y voz ----------
  const handleEvents = useCallback((events: P.PlayerEvent[], state: P.PlayerState) => {
    const t = Date.now()
    const s = getSettings()
    for (const e of events) {
      if (t - e.at > FRESH_MS) continue
      if (e.type === 'countdown') {
        if (s.countdown) sounds.tick()
      } else if (e.type === 'finish') {
        sounds.finish()
        speak('Rutina completa. Buen trabajo.')
      } else {
        const seg = state.segments[e.index]
        if (seg.kind === 'exercise') sounds.exerciseStart()
        else sounds.restStart()
        speak(announce(seg, state.segments[e.index + 1]))
      }
    }
  }, [])

  const commit = useCallback(
    (step: P.Step, persist = true) => {
      const current = runRef.current
      if (!current) return
      const next = { ...current, state: step.state }
      runRef.current = next
      setRun(next)
      setNow(Date.now())
      handleEvents(step.events, step.state)
      if (persist || step.events.length) saveActive(next)
    },
    [handleEvents],
  )

  // ---------- Carga / reanudación ----------
  useEffect(() => {
    void (async () => {
      const active = loadActive()
      if (active && active.routine.id === id && !active.state.finishedAt) {
        runRef.current = active
        setRun(active)
        if (!audioReady()) setNeedsTap(true)
        return
      }
      // Había otra rutina a medias: queda guardada como incompleta.
      if (active && !active.state.finishedAt) {
        const stopped = P.stop(active.state, active.state.lastTickAt)
        await db.sessions.put(P.toSession(stopped, active.routine, active.sessionId))
      }
      const routine = await db.routines.get(id)
      if (!routine) return navigate('/', { replace: true })
      const segments = expandRoutine(routine, await exerciseMap())
      const started = P.start(segments, Date.now())
      const fresh: ActiveRun = { routine, state: started.state, sessionId: newId() }
      runRef.current = fresh
      setRun(fresh)
      saveActive(fresh)
      if (!audioReady()) setNeedsTap(true)
      handleEvents(started.events, started.state)
    })()
  }, [id, navigate, handleEvents])

  // ---------- Reloj ----------
  useEffect(() => {
    const tick = () => {
      const r = runRef.current
      if (!r || r.state.finishedAt) return
      commit(P.tick(r.state, Date.now()), false)
    }
    const interval = setInterval(tick, 200)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [commit])

  const state = run?.state
  const finished = !!state?.finishedAt
  useWakeLock(!!state && !finished)

  // ---------- Guardar en historial al terminar ----------
  useEffect(() => {
    if (!run || !finished || savedRef.current) return
    savedRef.current = true
    void db.sessions.put(P.toSession(run.state, run.routine, run.sessionId)).then(clearActive)
  }, [run, finished])

  if (!run || !state) return <div className="min-h-dvh bg-bg" />

  const act = (fn: (s: P.PlayerState, t: number) => P.Step | P.PlayerState) => {
    const r = runRef.current
    if (!r) return
    const out = fn(r.state, Date.now())
    commit('state' in out ? out : { state: out, events: [] })
  }

  if (finished) return <FinishedView run={run} onDone={() => navigate('/')} onHistory={() => navigate(`/historial/${run.sessionId}`)} />

  const seg = P.current(state)!
  const nextSeg = state.segments[state.index + 1]
  const exercise = seg.exerciseId ? exerciseList?.find((e) => e.id === seg.exerciseId) : undefined
  const hasFicha = !!(exercise && (exercise.description || exercise.tips || exercise.easier || exercise.harder))
  const remaining = P.remainingMs(state, now)
  const segElapsed = P.segmentElapsedMs(state, now)
  const total = P.totalElapsedMs(state, now)
  const paused = P.isPaused(state)
  const phase = phaseStyle(seg)
  const c = color(seg.color)
  const accent = seg.kind === 'exercise' ? c.solid : phase.color
  const urgent = remaining !== null && remaining <= 3000 && !paused

  return (
    <div
      className="pt-safe pb-safe fixed inset-0 flex flex-col overflow-hidden transition-[background] duration-500"
      style={{ background: `radial-gradient(140% 70% at 50% 0%, ${accent}38 0%, ${accent}10 45%, var(--color-bg) 80%)` }}
    >
      {/* Barra superior */}
      <div className="flex items-center gap-2 px-3">
        <button type="button" aria-label="Terminar" onClick={() => setShowExit(true)} className="press grid h-11 w-11 place-items-center rounded-full bg-white/8">
          {Ico.close}
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-semibold text-muted">{run.routine.name}</div>
          <div className="tabular font-display text-2xl leading-none font-bold tracking-wider">
            <span className="text-faint">TOTAL </span>
            {clock(total / 1000)}
          </div>
        </div>
        <button type="button" aria-label="Ver todos los pasos" onClick={() => setShowList(true)} className="press grid h-11 w-11 place-items-center rounded-full bg-white/8">
          {Ico.list}
        </button>
      </div>

      {/* Barra de progreso por segmentos (como capítulos de un video) */}
      <button type="button" onClick={() => setShowList(true)} className="mt-3 flex h-6 items-center gap-[3px] px-4" aria-label="Pasos">
        {state.segments.map((s, i) => {
          const st = state.logs[i].status
          const isCur = i === state.index
          const segColor = s.kind === 'exercise' ? color(s.color).solid : phaseStyle(s).color
          let fill = 0
          if (isCur) fill = s.advance === 'auto' && s.seconds ? Math.min(1, segElapsed / (s.seconds * 1000)) : 0.5
          else if (st !== 'pending') fill = 1
          return (
            <div key={i} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/12" style={{ height: isCur ? 8 : 5 }}>
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fill * 100}%`, background: st === 'skipped' && !isCur ? '#ffffff40' : segColor }} />
            </div>
          )
        })}
      </button>

      {/* Contenido */}
      <div className="flex min-h-0 flex-1 flex-col items-center px-5 pt-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {seg.block && <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold tracking-wider text-muted uppercase">{seg.block}</span>}
          <span className="rounded-full px-3 py-1 text-xs font-bold tracking-[0.18em] uppercase" style={{ background: `${accent}26`, color: accent }}>
            {phase.label}
          </span>
          {seg.sets && (
            <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-bold tracking-wider text-muted uppercase">
              Serie {seg.set}/{seg.sets}
            </span>
          )}
          {seg.rounds > 1 && (
            <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-bold tracking-wider text-muted uppercase">
              Vuelta {seg.round}/{seg.rounds}
            </span>
          )}
        </div>

        <div key={state.index} className="animate-pop mt-4 flex max-w-full items-center gap-3">
          <IconBadge icon={seg.icon} colorKey={seg.color} size={56} />
          <h1 className="min-w-0 font-display text-[clamp(2rem,10vw,3.4rem)] leading-[0.95] font-bold tracking-wide uppercase">{seg.name}</h1>
          {hasFicha && (
            <button
              type="button"
              aria-label="Ver ficha del ejercicio"
              onClick={() => setShowFicha(true)}
              className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 font-serif text-lg font-bold italic"
            >
              i
            </button>
          )}
        </div>
        {seg.side && (
          <div className="mt-3 rounded-full px-5 py-1.5 font-display text-2xl font-bold tracking-[0.2em] uppercase" style={{ background: `${accent}26`, color: accent }}>
            {seg.side === 'left' ? `← ${SIDE_LABEL.left}` : `${SIDE_LABEL.right} →`}
          </div>
        )}
        {seg.note && <div className="mt-2 rounded-full bg-white/8 px-3 py-1 text-sm font-semibold">{seg.note}</div>}

        {/* Número principal */}
        {seg.techniqueImageId ? (
          // Con imagen de técnica: la imagen manda y el timer va compacto debajo.
          <div className="flex min-h-0 w-full max-w-md flex-1 flex-col gap-3 py-3">
            <button type="button" onClick={() => setZoomImage(seg.techniqueImageId!)} className="press relative min-h-0 w-full flex-1 overflow-hidden rounded-3xl bg-black/30">
              <BlobImage id={seg.techniqueImageId} className="absolute inset-0 h-full w-full object-contain" />
            </button>
            {seg.advance === 'auto' ? (
              <div className="flex flex-col items-center">
                <div className="flex items-baseline gap-3">
                  <div
                    className={`tabular font-display leading-none font-bold transition-transform ${urgent ? 'scale-110' : ''}`}
                    style={{ fontSize: 'min(24vw, 12vh)', color: urgent ? accent : undefined }}
                  >
                    {formatRemaining(remaining!)}
                  </div>
                  {paused && <div className="text-sm font-bold tracking-[0.3em] text-muted">EN PAUSA</div>}
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-[width] duration-200 ease-linear"
                    style={{ width: `${(remaining! / ((seg.seconds ?? 1) * 1000)) * 100}%`, background: accent }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-end justify-center gap-3">
                <div className="tabular font-display leading-[0.85] font-bold" style={{ fontSize: 'min(24vw, 12vh)', color: accent }}>
                  {seg.max ? 'MÁX' : seg.reps}
                </div>
                <div className="pb-1">
                  <div className="font-display text-xl leading-none font-bold tracking-[0.2em] text-muted">REPS</div>
                  <div className="tabular mt-1 text-sm text-faint">⏱ {clock(segElapsed / 1000)}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center py-3">
            {seg.advance === 'auto' ? (
              <Ring progress={remaining! / ((seg.seconds ?? 1) * 1000)} color={accent}>
                <div
                  className={`tabular font-display leading-none font-bold transition-transform ${urgent ? 'scale-110' : ''}`}
                  style={{ fontSize: formatRemaining(remaining!).length > 2 ? '30cqh' : '42cqh', color: urgent ? accent : undefined }}
                >
                  {formatRemaining(remaining!)}
                </div>
                {paused && <div className="mt-1 text-sm font-bold tracking-[0.3em] text-muted">EN PAUSA</div>}
              </Ring>
            ) : (
              <div className="flex flex-col items-center">
                <div className="tabular font-display leading-[0.85] font-bold" style={{ fontSize: seg.max ? 'min(34vw, 18vh)' : 'min(42vw, 22vh)', color: accent }}>
                  {seg.max ? 'MÁX' : seg.reps}
                </div>
                <div className="font-display text-xl font-bold tracking-[0.3em] text-muted">REPETICIONES</div>
                <div className="tabular mt-2 text-sm text-faint">⏱ {clock(segElapsed / 1000)} en este ejercicio</div>
              </div>
            )}
          </div>
        )}

        {/* Siguiente */}
        <div className="mb-3 flex h-11 w-full max-w-md items-center gap-2 rounded-2xl bg-white/6 px-3 text-sm">
          {nextSeg ? (
            <>
              <span className="font-semibold text-faint uppercase">Sigue</span>
              <IconBadge icon={nextSeg.icon} colorKey={nextSeg.color} size={26} />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {nextSeg.name}
                {nextSeg.side && <span className="font-normal text-muted"> · {SIDE_LABEL[nextSeg.side].toLowerCase()}</span>}
              </span>
              <span className="tabular text-muted">{segmentTarget(nextSeg, dur)}</span>
            </>
          ) : (
            <span className="w-full text-center font-semibold text-muted">🏁 Último paso</span>
          )}
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center justify-center gap-5 px-5 pb-3">
        <button type="button" aria-label="Anterior" onClick={() => act(P.prev)} className="press grid h-16 w-16 place-items-center rounded-full bg-white/10">
          {Ico.prev}
        </button>
        {seg.advance === 'manual' ? (
          <button
            type="button"
            onClick={() => {
              if (seg.max) {
                setRepsDraft(state.logs[state.index].reps ?? lastMaxReps(state, seg) ?? 10)
                setAskReps(true)
              } else act(P.next)
            }}
            className="press flex h-20 flex-1 items-center justify-center gap-2 rounded-full font-display text-3xl font-bold tracking-wider text-bg uppercase"
            style={{ background: accent, boxShadow: `0 10px 40px ${accent}66` }}
          >
            {Ico.check} Listo
          </button>
        ) : (
          <button
            type="button"
            aria-label={paused ? 'Continuar' : 'Pausa'}
            onClick={() => act(paused ? P.resume : P.pause)}
            className="press grid h-20 w-20 place-items-center rounded-full text-bg"
            style={{ background: accent, boxShadow: `0 10px 40px ${accent}66` }}
          >
            <span className={`scale-150 ${paused ? 'ml-1' : ''}`}>{paused ? Ico.play : Ico.pause}</span>
          </button>
        )}
        <button type="button" aria-label="Siguiente" onClick={() => act(P.next)} className="press grid h-16 w-16 place-items-center rounded-full bg-white/10">
          {Ico.next}
        </button>
      </div>

      {/* Lista de pasos */}
      <Sheet open={showList} onClose={() => setShowList(false)} title="Pasos">
        <div className="space-y-1 pt-1">
          {state.segments.map((s, i) => {
            const st = state.logs[i].status
            const isCur = i === state.index
            const header = s.block && s.block !== state.segments[i - 1]?.block ? s.block : null
            return (
              <div key={i}>
                {header && <div className="px-2 pt-3 pb-1 text-xs font-bold tracking-wider text-muted uppercase">{header}</div>}
                <button
                  type="button"
                  onClick={() => {
                    act((cur, t) => P.jump(cur, i, t))
                    setShowList(false)
                  }}
                  className={`press flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left ${isCur ? 'bg-white/10' : ''}`}
                >
                  <span className="w-6 text-center text-sm text-faint">{st === 'done' ? '✓' : st === 'skipped' ? '↷' : i + 1}</span>
                  <IconBadge icon={s.icon} colorKey={s.color} size={34} />
                  <span className={`min-w-0 flex-1 truncate font-semibold ${st !== 'pending' && !isCur ? 'text-muted' : ''}`}>
                    {s.name}
                    {s.sets && (
                      <span className="font-normal text-muted">
                        {' '}
                        · {s.set}/{s.sets}
                      </span>
                    )}
                    {s.side && <span className="font-normal text-muted"> · {SIDE_LABEL[s.side].toLowerCase()}</span>}
                  </span>
                  <span className="tabular text-sm text-muted">{state.logs[i].reps !== undefined ? `${state.logs[i].reps} reps ✓` : segmentTarget(s, dur)}</span>
                </button>
              </div>
            )
          })}
        </div>
      </Sheet>

      {/* Ficha del ejercicio */}
      <Sheet open={showFicha} onClose={() => setShowFicha(false)} title={seg.name}>
        <div className="space-y-4 pt-1 pb-2">
          {exercise?.description && <p className="text-lg leading-snug">{exercise.description}</p>}
          {exercise?.tips && (
            <div>
              <div className="mb-1 text-xs font-bold tracking-wider text-muted uppercase">Tips</div>
              <p className="leading-snug text-ink/90">{exercise.tips}</p>
            </div>
          )}
          {(exercise?.easier || exercise?.harder) && (
            <div className="grid grid-cols-2 gap-2">
              {exercise?.easier && (
                <div className="rounded-2xl bg-surface-2 p-3">
                  <div className="mb-1 text-xs font-bold tracking-wider text-green-400 uppercase">Más fácil</div>
                  <p className="text-sm">{exercise.easier}</p>
                </div>
              )}
              {exercise?.harder && (
                <div className="rounded-2xl bg-surface-2 p-3">
                  <div className="mb-1 text-xs font-bold tracking-wider text-red-400 uppercase">Más difícil</div>
                  <p className="text-sm">{exercise.harder}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Sheet>

      {/* ¿Cuántas hiciste? (máximo de reps) */}
      <Sheet open={askReps} onClose={() => setAskReps(false)}>
        <div className="pt-4 text-center">
          <h2 className="font-display text-2xl font-bold tracking-wide uppercase">¿Cuántas hiciste?</h2>
          <p className="mt-1 text-muted">
            {seg.name}
            {seg.side && ` · ${SIDE_LABEL[seg.side].toLowerCase()}`}
          </p>
          <div className="mx-auto mt-5 max-w-xs">
            <Stepper value={repsDraft} onChange={setRepsDraft} min={0} max={500} />
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              onClick={() => {
                setAskReps(false)
                act((cur, t) => P.next(P.setReps(cur, cur.index, repsDraft), t))
              }}
            >
              Guardar y seguir
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAskReps(false)
                act(P.next)
              }}
            >
              Seguir sin anotar
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Salir */}
      <Sheet open={showExit} onClose={() => setShowExit(false)}>
        <div className="pt-4 text-center">
          <h2 className="font-display text-2xl font-bold tracking-wide uppercase">¿Terminar la rutina?</h2>
          <p className="mt-2 text-muted">Llevas {clock(total / 1000)}.</p>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              onClick={() => {
                setShowExit(false)
                act(P.stop)
              }}
            >
              Terminar y guardar en historial
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearActive()
                navigate('/')
              }}
            >
              Salir sin guardar
            </Button>
            <Button variant="ghost" onClick={() => setShowExit(false)}>
              Seguir entrenando
            </Button>
          </div>
        </div>
      </Sheet>

      {zoomImage && (
        <button type="button" onClick={() => setZoomImage(null)} className="animate-fade fixed inset-0 z-50 grid place-items-center bg-black/95 p-4">
          <BlobImage id={zoomImage} className="max-h-full max-w-full object-contain" />
        </button>
      )}

      {needsTap && (
        <button
          type="button"
          onClick={() => {
            unlockAudio()
            setNeedsTap(false)
          }}
          className="animate-fade fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg/90 backdrop-blur"
        >
          <div className="text-5xl">🔊</div>
          <div className="font-display text-3xl font-bold tracking-wide uppercase">Toca para continuar</div>
          <div className="text-muted">Activa el sonido de los timers</div>
        </button>
      )}
    </div>
  )
}

/** El anillo ocupa el alto disponible (hasta 40% de la pantalla) para no montarse sobre el resto en pantallas chicas. */
function Ring({ progress, color, children }: { progress: number; color: string; children: React.ReactNode }) {
  const r = 46
  const circ = 2 * Math.PI * r
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ height: '100%', maxHeight: 'min(80vw, 40vh)', aspectRatio: '1', containerType: 'size' }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#ffffff14" strokeWidth="4" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.max(0, Math.min(1, progress)))}
          style={{ transition: 'stroke-dashoffset 200ms linear', filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  )
}

function FinishedView({ run, onDone, onHistory }: { run: ActiveRun; onDone: () => void; onHistory: () => void }) {
  const { state, routine } = run
  const exLogs = state.segments.map((s, i) => ({ s, l: state.logs[i] })).filter((x) => x.s.kind === 'exercise')
  const done = exLogs.filter((x) => x.l.status === 'done').length
  const c = color(routine.color)
  return (
    <div
      className="pt-safe pb-safe fixed inset-0 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: `radial-gradient(120% 60% at 50% 30%, ${c.solid}33, var(--color-bg) 75%)` }}
    >
      <div className="animate-pop text-7xl">{state.completed ? '🏆' : '💾'}</div>
      <h1 className="mt-4 font-display text-5xl font-bold tracking-wide uppercase">{state.completed ? '¡Completa!' : 'Guardada'}</h1>
      <div className="mt-2 flex items-center gap-2 text-muted">
        <IconBadge icon={routine.icon} colorKey={routine.color} size={28} />
        {routine.name}
      </div>
      <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
        <div className="rounded-3xl bg-white/6 p-4">
          <div className="tabular font-display text-4xl font-bold">{clock(P.totalElapsedMs(state, 0) / 1000)}</div>
          <div className="text-sm text-muted">tiempo total</div>
        </div>
        <div className="rounded-3xl bg-white/6 p-4">
          <div className="tabular font-display text-4xl font-bold">
            {done}/{exLogs.length}
          </div>
          <div className="text-sm text-muted">ejercicios</div>
        </div>
      </div>
      <div className="mt-8 flex w-full max-w-sm flex-col gap-2">
        <Button onClick={onDone}>Volver a rutinas</Button>
        <Button variant="ghost" onClick={onHistory}>
          Ver detalle en historial
        </Button>
      </div>
    </div>
  )
}

function phaseStyle(seg: Segment): { label: string; color: string } {
  if (seg.kind === 'prep') return { label: 'Prepárate', color: '#ffc53d' }
  if (seg.kind === 'rest') return { label: 'Descanso', color: '#2dd4bf' }
  return { label: 'Ejercicio', color: '#ff4d5e' }
}

function formatRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return s >= 60 ? clock(s) : String(s)
}

/** Lo que anotaste la última vez en este mismo ejercicio dentro de la rutina (para partir de ahí). */
function lastMaxReps(state: P.PlayerState, seg: Segment): number | undefined {
  for (let i = state.index - 1; i >= 0; i--) {
    if (state.segments[i].exerciseId === seg.exerciseId && state.logs[i].reps !== undefined) return state.logs[i].reps
  }
  return undefined
}

function announce(seg: Segment, next?: Segment): string {
  const nextName = next ? next.name : ''
  if (seg.kind === 'prep') return `Prepárate. ${nextName ? `Primero: ${nextName}` : ''}`
  if (seg.kind === 'rest') return `${seg.name}, ${spokenDur(seg.seconds ?? 0)}.${nextName ? ` Sigue: ${nextName}` : ''}`
  const set = seg.sets ? `, serie ${seg.set} de ${seg.sets}` : ''
  const side = seg.side ? `, ${SIDE_LABEL[seg.side].toLowerCase()}` : ''
  if (seg.advance === 'auto') return `${seg.name}${side}${set}, ${spokenDur(seg.seconds ?? 0)}`
  if (seg.max) return `${seg.name}${side}${set}, máximo de repeticiones`
  return `${seg.name}${side}${set}, ${seg.reps} repeticiones`
}

function spokenDur(s: number): string {
  if (s < 60) return `${s} segundos`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m} minuto${m > 1 ? 's' : ''}${r ? ` y ${r} segundos` : ''}`
}
