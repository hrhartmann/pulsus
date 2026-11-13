import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'wouter'
import { FORMULAS, computeBody, type Measurement } from '../body/bodyfat'
import { BigTitle, EmptyState, Ico } from '../components/ui'
import { db } from '../db/db'
import { shortDate } from '../lib/format'

export const n1 = (v: number) => v.toFixed(1).replace('.', ',')
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${n1(Math.abs(v))}`

export function BodyScreen() {
  const list = useLiveQuery(() => db.measurements.orderBy('date').reverse().toArray(), [])
  const latest = list?.[0]
  const prev = list?.[1]
  const r = latest ? computeBody(latest) : null
  const rp = prev ? computeBody(prev) : null

  return (
    <div>
      <BigTitle
        right={
          <Link href="/medicion/nueva" className="press mb-1 flex h-10 items-center gap-1 rounded-full bg-ink pr-4 pl-3 text-sm font-semibold text-bg">
            {Ico.plus} Medir
          </Link>
        }
      >
        Cuerpo
      </BigTitle>
      <div className="mx-auto max-w-lg space-y-3 px-4 pt-2">
        {list?.length === 0 && (
          <EmptyState emoji="📏" title="Mide tu % de grasa">
            Con un plicómetro y 3 pliegues calculas tu porcentaje de grasa y llevas el registro. Toca <b>Medir</b> para empezar.
          </EmptyState>
        )}

        {latest && r && (
          <div className="rounded-3xl border border-line bg-surface p-5" style={{ backgroundImage: 'radial-gradient(120% 90% at 100% 0%, #ff4d5e22, transparent 60%)' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold tracking-wider text-muted uppercase">Última medición · {shortDate(latest.date)}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="tabular font-display text-7xl leading-none font-bold">{n1(r.bodyFatPct)}</span>
                  <span className="font-display text-3xl font-bold text-muted">%</span>
                </div>
                <div className="mt-1 text-sm text-muted">
                  grasa corporal · <span className="text-ink">{r.category}</span>
                </div>
              </div>
              {rp && (
                <div
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold whitespace-nowrap ${r.bodyFatPct <= rp.bodyFatPct ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-300'}`}
                >
                  {signed(r.bodyFatPct - rp.bodyFatPct)} pts
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Mini label="Masa magra" value={`${n1(r.leanMassKg)} kg`} delta={rp ? signed(r.leanMassKg - rp.leanMassKg) : undefined} />
              <Mini label="Masa grasa" value={`${n1(r.fatMassKg)} kg`} delta={rp ? signed(r.fatMassKg - rp.fatMassKg) : undefined} />
              <Mini label="Peso" value={`${n1(latest.weightKg)} kg`} delta={prev ? signed(latest.weightKg - prev.weightKg) : undefined} />
            </div>
            <div className="mt-3 text-xs text-faint">
              {FORMULAS[latest.formula].name} + Siri · índice de masa magra {n1(r.ffmi)} · IMC {n1(r.bmi)}
            </div>
          </div>
        )}

        {list && list.length >= 2 && <Trend list={list} />}

        <Link href="/cuerpo/guia" className="press flex items-center gap-3 rounded-3xl bg-surface-2 p-4">
          <span className="text-2xl">📖</span>
          <span className="flex-1">
            <span className="block font-semibold">Guía: cómo medirte y cómo leer el resultado</span>
            <span className="block text-sm text-muted">Técnica con plicómetro, fórmulas y qué hacer para bajar el %.</span>
          </span>
          <span className="rotate-180 text-muted">{Ico.back}</span>
        </Link>

        {list && list.length > 0 && (
          <>
            <h2 className="pt-3 font-display text-lg font-bold tracking-wide text-muted uppercase">Registro</h2>
            <div className="space-y-2">
              {list.map((m) => (
                <Row key={m.id} m={m} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Mini({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="rounded-2xl bg-white/6 p-3">
      <div className="tabular font-display text-lg font-bold whitespace-nowrap">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
      {delta && <div className="tabular mt-0.5 text-[11px] text-faint">{delta} kg</div>}
    </div>
  )
}

function Row({ m }: { m: Measurement }) {
  const r = computeBody(m)
  return (
    <Link href={`/medicion/${m.id}`} className="press flex items-center gap-3 rounded-2xl bg-surface p-3">
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{shortDate(m.date)}</div>
        <div className="truncate text-sm text-muted">
          {n1(m.weightKg)} kg · {FORMULAS[m.formula].short}
          {r && ` · magra ${n1(r.leanMassKg)} kg`}
        </div>
      </div>
      <div className="tabular font-display text-2xl font-bold">{n1(m.bodyFatPct)} %</div>
    </Link>
  )
}

/** Evolución del % de grasa (más antiguo a la izquierda). */
function Trend({ list }: { list: Measurement[] }) {
  const pts = list.slice(0, 24).reverse()
  const vals = pts.map((p) => p.bodyFatPct)
  const min = Math.min(...vals) - 1
  const max = Math.max(...vals) + 1
  const W = 320
  const H = 110
  const x = (i: number) => 12 + (i * (W - 24)) / (pts.length - 1)
  const y = (v: number) => 14 + ((max - v) * (H - 34)) / (max - min)
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.bodyFatPct).toFixed(1)}`).join(' ')
  return (
    <div className="rounded-3xl bg-surface p-4">
      <div className="mb-1 text-xs font-semibold tracking-wider text-muted uppercase">Evolución del % de grasa</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolución del porcentaje de grasa">
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.bodyFatPct)} r="3.5" fill="var(--color-bg)" stroke="var(--color-accent)" strokeWidth="2" />
        ))}
        {[0, pts.length - 1].map((i) => (
          <g key={i}>
            <text x={x(i)} y={y(pts[i].bodyFatPct) - 8} textAnchor={i ? 'end' : 'start'} fill="var(--color-ink)" fontSize="11" fontWeight="700">
              {n1(pts[i].bodyFatPct)} %
            </text>
            <text x={x(i)} y={H - 2} textAnchor={i ? 'end' : 'start'} fill="var(--color-faint)" fontSize="10">
              {shortDate(pts[i].date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
