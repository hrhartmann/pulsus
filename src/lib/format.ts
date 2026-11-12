/** 75 → "1:15", 3725 → "1:02:05" */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

/** Para mostrar duraciones de pasos: 45 → "45 s", 90 → "1:30", 120 → "2 min" */
export function dur(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  if (seconds % 60 === 0) return `${seconds / 60} min`
  return clock(seconds)
}

/** Duración aproximada de una rutina: "≈ 24 min" */
export function approxMinutes(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  return `${Math.round(seconds / 60)} min`
}

const dateFmt = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

export function shortDate(ts: number): string {
  return dateFmt.format(ts)
}

export function time(ts: number): string {
  return timeFmt.format(ts)
}

/** "2026-10-22 18:05" — para los CSV. */
export function isoLocal(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
