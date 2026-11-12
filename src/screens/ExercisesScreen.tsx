import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'wouter'
import { BigTitle, EmptyState, IconBadge, Ico, inputCls } from '../components/ui'
import { db } from '../db/db'
import { exerciseDefaultLabel } from '../lib/labels'

export function ExercisesScreen() {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])
  const [q, setQ] = useState('')
  const filtered = (exercises ?? []).filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <BigTitle
        right={
          <Link href="/ejercicio/nuevo" className="press mb-1 flex h-10 items-center gap-1 rounded-full bg-ink pr-4 pl-3 text-sm font-semibold text-bg">
            {Ico.plus} Nuevo
          </Link>
        }
      >
        Ejercicios
      </BigTitle>
      <div className="mx-auto max-w-lg px-4 pt-2">
        {(exercises?.length ?? 0) > 6 && <input className={`${inputCls} mb-3`} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />}
        {exercises?.length === 0 && (
          <EmptyState emoji="💪" title="Sin ejercicios">
            Crea ejercicios para usarlos en tus rutinas.
          </EmptyState>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map((e) => (
            <Link key={e.id} href={`/ejercicio/${e.id}`} className="press flex flex-col gap-3 rounded-3xl bg-surface p-4">
              <div className="flex items-start justify-between">
                <IconBadge icon={e.icon} colorKey={e.color} size={52} />
                {e.techniqueImageId && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">📷 técnica</span>}
              </div>
              <div>
                <div className="leading-tight font-semibold">{e.name}</div>
                <div className="mt-0.5 text-sm text-muted">{exerciseDefaultLabel(e)}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
