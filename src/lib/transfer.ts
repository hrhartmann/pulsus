import { db, normalizeExercise, normalizeRoutine } from '../db/db'
import type { Exercise, IconValue, Routine, Session } from '../types'
import { clock, isoLocal } from './format'

// =====================================================================
// Respaldo completo (JSON): ejercicios, rutinas, historial e imágenes.
// =====================================================================

interface Backup {
  app: 'pulsus'
  /** 1: rutinas con `steps`; 2: rutinas con `blocks`. Se aceptan ambas al restaurar. */
  version: 1 | 2
  exportedAt: string
  exercises: Exercise[]
  routines: Routine[]
  sessions: Session[]
  images: { id: string; mime: string; data: string }[]
}

export async function buildBackup(): Promise<Blob> {
  const [exercises, routines, sessions, images] = await Promise.all([db.exercises.toArray(), db.routines.toArray(), db.sessions.toArray(), db.images.toArray()])
  const backup: Backup = {
    app: 'pulsus',
    version: 2,
    exportedAt: new Date().toISOString(),
    exercises,
    routines,
    sessions,
    images: await Promise.all(images.map(async (i) => ({ id: i.id, mime: i.mime, data: await blobToBase64(i.blob) }))),
  }
  return new Blob([JSON.stringify(backup)], { type: 'application/json' })
}

/** Importa un respaldo. Agrega o reemplaza por id; no borra lo que ya tienes. */
export async function restoreBackup(file: File): Promise<{ exercises: number; routines: number; sessions: number }> {
  const data = JSON.parse(await file.text()) as Backup
  if (data.app !== 'pulsus') throw new Error('Este archivo no es un respaldo de Pulsus.')
  const images = data.images.map((i) => ({ id: i.id, mime: i.mime, blob: base64ToBlob(i.data, i.mime) }))
  await db.transaction('rw', [db.exercises, db.routines, db.sessions, db.images], async () => {
    await db.images.bulkPut(images)
    await db.exercises.bulkPut(data.exercises.map(normalizeExercise))
    await db.routines.bulkPut(data.routines.map(normalizeRoutine))
    await db.sessions.bulkPut(data.sessions)
  })
  return { exercises: data.exercises.length, routines: data.routines.length, sessions: data.sessions.length }
}

// =====================================================================
// CSV para Excel / Google Sheets. Separador ";" y BOM UTF-8 para que
// Excel en español lo abra en columnas y con tildes.
// =====================================================================

const SEP = ';'

function csv(rows: (string | number | boolean | undefined | null)[][]): Blob {
  const esc = (v: string | number | boolean | undefined | null) => {
    if (v === undefined || v === null) return ''
    const s = String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const text = rows.map((r) => r.map(esc).join(SEP)).join('\r\n')
  return new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })
}

const MODE = { time: 'tiempo', reps: 'repeticiones', max: 'maximo' } as const

const iconText = (i: IconValue) => (i.kind === 'emoji' ? i.value : '[imagen]')

export async function buildCsvFiles(): Promise<File[]> {
  const [exercises, routines, sessions] = await Promise.all([
    db.exercises.orderBy('name').toArray(),
    db.routines.orderBy('createdAt').toArray(),
    db.sessions.orderBy('startedAt').toArray(),
  ])
  const exName = new Map(exercises.map((e) => [e.id, e.name]))
  const stamp = isoLocal(Date.now()).slice(0, 10)

  const ejercicios = csv([
    ['id', 'nombre', 'icono', 'modo', 'segundos', 'repeticiones', 'por_lado', 'tiene_imagen_tecnica', 'descripcion', 'tips', 'mas_facil', 'mas_dificil'],
    ...exercises.map((e) => [
      e.id,
      e.name,
      iconText(e.icon),
      MODE[e.defaultMode],
      e.defaultSeconds,
      e.defaultReps,
      e.defaultPerSide ? 'si' : 'no',
      e.techniqueImageId ? 'si' : 'no',
      e.description,
      e.tips,
      e.easier,
      e.harder,
    ]),
  ])

  const rutinas = csv([
    [
      'rutina_id',
      'rutina',
      'vueltas',
      'descanso_entre_vueltas_seg',
      'preparacion_seg',
      'bloque',
      'orden',
      'tipo',
      'ejercicio',
      'modo',
      'segundos',
      'repeticiones',
      'series',
      'descanso_entre_series_seg',
      'por_lado',
      'nota',
    ],
    ...routines.flatMap((r) =>
      r.blocks
        .flatMap((b) => b.steps.map((s) => ({ b, s })))
        .map(({ b, s }, i) => [
          r.id,
          r.name,
          r.rounds,
          r.restBetweenRounds,
          r.prepSeconds,
          b.name,
          i + 1,
          s.type === 'rest' ? 'descanso' : 'ejercicio',
          s.type === 'exercise' ? (exName.get(s.exerciseId) ?? '(eliminado)') : s.label || 'Descanso',
          s.type === 'exercise' ? MODE[s.mode] : 'tiempo',
          s.type === 'rest' || s.mode === 'time' ? s.seconds : '',
          s.type === 'exercise' && s.mode === 'reps' ? s.reps : '',
          s.type === 'exercise' ? s.sets : '',
          s.type === 'exercise' ? s.restBetweenSets : '',
          s.type === 'exercise' && s.perSide ? 'si' : '',
          s.type === 'exercise' ? s.note : '',
        ]),
    ),
  ])

  const historial = csv([
    ['sesion_id', 'rutina', 'inicio', 'fin', 'duracion_seg', 'duracion', 'completada', 'ejercicios_hechos', 'ejercicios_saltados', 'ejercicios_pendientes'],
    ...sessions.map((s) => {
      const ex = s.segments.filter((g) => g.kind === 'exercise')
      return [
        s.id,
        s.routineName,
        isoLocal(s.startedAt),
        isoLocal(s.endedAt),
        Math.round(s.durationMs / 1000),
        clock(s.durationMs / 1000),
        s.completed ? 'si' : 'no',
        ex.filter((g) => g.status === 'done').length,
        ex.filter((g) => g.status === 'skipped').length,
        ex.filter((g) => g.status === 'pending').length,
      ]
    }),
  ])

  const detalle = csv([
    ['sesion_id', 'fecha', 'rutina', 'orden', 'bloque', 'tipo', 'nombre', 'lado', 'vuelta', 'serie', 'plan_seg', 'plan_reps', 'real_seg', 'reps_hechas', 'estado', 'nota'],
    ...sessions.flatMap((s) =>
      s.segments.map((g, i) => [
        s.id,
        isoLocal(s.startedAt),
        s.routineName,
        i + 1,
        g.block ?? '',
        g.kind === 'exercise' ? 'ejercicio' : g.kind === 'rest' ? 'descanso' : 'preparacion',
        g.name,
        g.side === 'left' ? 'izquierda' : g.side === 'right' ? 'derecha' : '',
        g.round,
        g.set ? `${g.set}/${g.sets}` : '',
        g.plannedSeconds ?? '',
        g.max ? 'max' : (g.plannedReps ?? ''),
        Math.round(g.elapsedMs / 1000),
        g.actualReps ?? '',
        g.status === 'done' ? 'hecho' : g.status === 'skipped' ? 'saltado' : 'pendiente',
        g.note,
      ]),
    ),
  ])

  return [
    new File([ejercicios], `pulsus-ejercicios-${stamp}.csv`, { type: 'text/csv' }),
    new File([rutinas], `pulsus-rutinas-${stamp}.csv`, { type: 'text/csv' }),
    new File([historial], `pulsus-historial-${stamp}.csv`, { type: 'text/csv' }),
    new File([detalle], `pulsus-historial-detalle-${stamp}.csv`, { type: 'text/csv' }),
  ]
}

/** En iPhone abre el menú Compartir (Guardar en Archivos, Drive, Mail…). Si no se puede, descarga. */
export async function shareOrDownload(files: File[], title: string): Promise<void> {
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  for (const f of files) {
    const url = URL.createObjectURL(f)
    const a = document.createElement('a')
    a.href = url
    a.download = f.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    await new Promise((r) => setTimeout(r, 300))
  }
}

// ---------- helpers ----------

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64)
  return new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: mime })
}
