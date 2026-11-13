import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { FORMULAS, SITE_INFO, computeBody, type BodyFormula, type Measurement, type Sex, type SkinfoldSite } from '../body/bodyfat'
import { Button, Confirm, Field, Ico, IconButton, Segmented, TopBar, inputCls } from '../components/ui'
import { db, newId } from '../db/db'
import { n1 } from './BodyScreen'

/** Los campos se editan como texto para aceptar coma decimal ("12,5"). */
interface Draft {
  date: string
  sex: Sex
  age: string
  weight: string
  height: string
  formula: BodyFormula
  folds: Partial<Record<SkinfoldSite, string>>
  note: string
}

const num = (s: string | undefined) => {
  const v = parseFloat((s ?? '').replace(',', '.'))
  return Number.isFinite(v) ? v : NaN
}
const str = (v: number | undefined) => (v === undefined ? '' : String(v).replace('.', ','))
const dateInput = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MeasurementEditor() {
  const { id } = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const isNew = id === 'nueva'
  const [d, setD] = useState<Draft | null>(null)
  const [existing, setExisting] = useState<Measurement | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openSite, setOpenSite] = useState<SkinfoldSite | null>(null)

  useEffect(() => {
    void (async () => {
      if (isNew) {
        // Parte con los datos de la última medición para no volver a escribirlos.
        const last = await db.measurements.orderBy('date').last()
        setD({
          date: dateInput(Date.now()),
          sex: last?.sex ?? 'male',
          age: str(last?.age),
          weight: str(last?.weightKg),
          height: str(last?.heightCm),
          formula: last?.formula ?? 'jp3',
          folds: {},
          note: '',
        })
        return
      }
      const m = await db.measurements.get(id)
      if (!m) return navigate('/cuerpo', { replace: true })
      setExisting(m)
      setD({
        date: dateInput(m.date),
        sex: m.sex,
        age: str(m.age),
        weight: str(m.weightKg),
        height: str(m.heightCm),
        formula: m.formula,
        folds: Object.fromEntries(Object.entries(m.skinfolds).map(([k, v]) => [k, str(v)])),
        note: m.note ?? '',
      })
    })()
  }, [id, isNew, navigate])

  if (!d) return null
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch })
  const formula = FORMULAS[d.formula]
  const sites = formula.sites(d.sex)
  const skinfolds = Object.fromEntries(sites.map((s) => [s, num(d.folds[s])]).filter(([, v]) => Number.isFinite(v as number)))
  const input = { sex: d.sex, age: num(d.age), weightKg: num(d.weight), heightCm: num(d.height), formula: d.formula, skinfolds }
  const result = computeBody(input)

  const save = async () => {
    if (!result) return
    const [y, mo, da] = d.date.split('-').map(Number)
    const now = new Date()
    const m: Measurement = {
      ...input,
      id: existing?.id ?? newId(),
      date: new Date(y, mo - 1, da, now.getHours(), now.getMinutes()).getTime(),
      bodyFatPct: Math.round(result.bodyFatPct * 10) / 10,
      note: d.note.trim() || undefined,
      createdAt: existing?.createdAt ?? Date.now(),
    }
    await db.measurements.put(m)
    navigate('/cuerpo')
  }

  return (
    <div className="min-h-dvh pb-44">
      <TopBar
        title={isNew ? 'Nueva medición' : 'Medición'}
        left={
          <IconButton label="Volver" onClick={() => navigate('/cuerpo')}>
            {Ico.back}
          </IconButton>
        }
        right={
          <Link href="/cuerpo/guia" className="press grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-lg" aria-label="Guía">
            📖
          </Link>
        }
      />
      <div className="mx-auto max-w-lg space-y-6 px-4 pt-5">
        <section className="space-y-4 rounded-3xl bg-surface p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <input type="date" className={inputCls} value={d.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label="Sexo">
              <Segmented
                value={d.sex}
                onChange={(sex) => set({ sex })}
                options={[
                  { value: 'male', label: 'Hombre' },
                  { value: 'female', label: 'Mujer' },
                ]}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Num label="Edad" unit="años" value={d.age} onChange={(age) => set({ age })} integer />
            <Num label="Peso" unit="kg" value={d.weight} onChange={(weight) => set({ weight })} />
            <Num label="Altura" unit="cm" value={d.height} onChange={(height) => set({ height })} />
          </div>
          <p className="text-xs text-faint">Pésate en ayunas, después de ir al baño. Las fórmulas cambian según sexo y edad.</p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl font-bold tracking-wide text-muted uppercase">Fórmula</h2>
          <Segmented value={d.formula} onChange={(f) => set({ formula: f })} options={(['jp3', 'jp7', 'dw4'] as const).map((f) => ({ value: f, label: FORMULAS[f].short }))} />
          <p className="mt-2 text-sm text-muted">
            <b className="text-ink">{formula.name}.</b> {formula.about}
          </p>
          <p className="mt-1 text-xs text-faint">Usa siempre la misma fórmula para poder comparar entre fechas.</p>
        </section>

        <section>
          <h2 className="mb-1 font-display text-xl font-bold tracking-wide text-muted uppercase">Pliegues (mm)</h2>
          <p className="mb-3 text-sm text-muted">Lado derecho del cuerpo. Mide cada punto 2 o 3 veces y anota el promedio.</p>
          <div className="space-y-2">
            {sites.map((site) => {
              const info = SITE_INFO[site]
              const open = openSite === site
              return (
                <div key={site} className="rounded-2xl bg-surface p-3">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setOpenSite(open ? null : site)} className="min-w-0 flex-1 text-left">
                      <div className="font-semibold">{info.name}</div>
                      <div className="text-xs text-muted">
                        Pliegue {info.fold.toLowerCase()} · <span className="underline">{open ? 'ocultar' : '¿dónde?'}</span>
                      </div>
                    </button>
                    <div className="relative w-28">
                      <input
                        inputMode="decimal"
                        aria-label={`${info.name} en milímetros`}
                        placeholder="0"
                        className={`${inputCls} tabular pr-11 text-right font-display text-2xl font-bold`}
                        value={d.folds[site] ?? ''}
                        onChange={(e) => set({ folds: { ...d.folds, [site]: e.target.value.replace(/[^0-9.,]/g, '') } })}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-faint">mm</span>
                    </div>
                  </div>
                  {open && <p className="animate-fade mt-2 border-t border-line/60 pt-2 text-sm leading-snug text-ink/90">{info.how}</p>}
                </div>
              )
            })}
          </div>
        </section>

        <Field label="Nota (opcional)">
          <input className={inputCls} placeholder="Ej: medido por mí, en la mañana" value={d.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>

        {result && (
          <section className="rounded-3xl bg-surface p-4 text-sm">
            <div className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Cómo se calculó</div>
            <div className="space-y-1 font-mono text-[12px] leading-relaxed text-muted">
              <div>S = suma de pliegues = {n1(result.sum)} mm</div>
              <div>{formula.equation(d.sex)}</div>
              <div>D = {result.density.toFixed(4).replace('.', ',')} g/cm³</div>
              <div className="text-ink">% grasa (Siri) = 495 / D − 450 = {n1(result.bodyFatPct)} %</div>
              <div>% grasa (Brozek) = 457 / D − 414,2 = {n1(result.brozekPct)} %</div>
              <div>masa grasa = peso × % = {n1(result.fatMassKg)} kg</div>
              <div>masa magra = peso − grasa = {n1(result.leanMassKg)} kg</div>
            </div>
          </section>
        )}

        {!isNew && (
          <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
            {Ico.trash} Borrar medición
          </Button>
        )}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line/70 bg-bg/90 px-4 pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            {result ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="tabular font-display text-4xl leading-none font-bold">{n1(result.bodyFatPct)} %</span>
                  <span className="truncate text-sm text-muted">{result.category}</span>
                </div>
                <div className="tabular truncate text-xs text-muted">
                  magra {n1(result.leanMassKg)} kg · grasa {n1(result.fatMassKg)} kg
                </div>
              </>
            ) : (
              <div className="text-sm text-muted">Completa edad, peso, altura y los {sites.length} pliegues para ver el resultado.</div>
            )}
          </div>
          <Button disabled={!result} onClick={() => void save()}>
            Guardar
          </Button>
        </div>
      </div>

      <Confirm
        open={confirmDelete}
        danger
        title="¿Borrar medición?"
        confirmLabel="Borrar"
        onConfirm={async () => {
          if (existing) await db.measurements.delete(existing.id)
          navigate('/cuerpo', { replace: true })
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function Num({ label, unit, value, onChange, integer }: { label: string; unit: string; value: string; onChange: (v: string) => void; integer?: boolean }) {
  return (
    <Field label={label}>
      <div className="relative">
        <input
          inputMode={integer ? 'numeric' : 'decimal'}
          className={`${inputCls} tabular px-3 pr-10 font-semibold`}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(integer ? /[^0-9]/g : /[^0-9.,]/g, ''))}
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-faint">{unit}</span>
      </div>
    </Field>
  )
}
