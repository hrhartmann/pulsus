import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { db } from '../db/db'
import { color } from '../lib/colors'
import type { IconValue } from '../types'

// ---------- Imagen guardada en IndexedDB ----------

export function useImageUrl(id: string | undefined): string | undefined {
  const img = useLiveQuery(() => (id ? db.images.get(id) : undefined), [id])
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!img) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(img.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [img])
  return url
}

export function BlobImage({ id, className, alt = '' }: { id: string; className?: string; alt?: string }) {
  const url = useImageUrl(id)
  if (!url) return <div className={`${className} bg-surface-2`} />
  return <img src={url} alt={alt} className={className} draggable={false} />
}

// ---------- Icono (emoji o imagen) sobre fondo de color ----------

export function IconBadge({ icon, colorKey, size = 48, className = '' }: { icon: IconValue; colorKey: string; size?: number; className?: string }) {
  const c = color(colorKey)
  const radius = Math.round(size * 0.3)
  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(145deg, ${c.solid}40, ${c.solid}14)`,
        boxShadow: `inset 0 0 0 1px ${c.solid}50`,
      }}
    >
      {icon.kind === 'emoji' ? (
        <span style={{ fontSize: size * 0.55, lineHeight: 1 }} aria-hidden>
          {icon.value}
        </span>
      ) : (
        <BlobImage id={icon.imageId} className="h-full w-full object-cover" />
      )}
    </div>
  )
}

// ---------- Barra superior ----------

export function TopBar({ title, left, right, sub }: { title: ReactNode; left?: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-line/60 bg-bg/85 px-4 pb-3 backdrop-blur-xl">
      <div className="flex min-h-10 items-center gap-2">
        <div className="flex min-w-10 justify-start">{left}</div>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate font-display text-xl font-bold tracking-wide uppercase">{title}</h1>
          {sub && <div className="text-xs text-muted">{sub}</div>}
        </div>
        <div className="flex min-w-10 justify-end">{right}</div>
      </div>
    </header>
  )
}

export function BigTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <header className="pt-safe px-5 pb-2">
      <div className="flex items-end justify-between gap-3 pt-4">
        <h1 className="font-display text-4xl font-bold tracking-wide uppercase">{children}</h1>
        {right}
      </div>
    </header>
  )
}

export function IconButton({ children, onClick, label, className = '' }: { children: ReactNode; onClick?: () => void; label: string; className?: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={`press grid h-10 min-w-10 place-items-center rounded-full px-2 text-ink ${className}`}>
      {children}
    </button>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const styles = {
    primary: 'bg-accent text-white',
    secondary: 'bg-surface-2 text-ink',
    danger: 'bg-red-500/15 text-red-400',
    ghost: 'text-muted',
  }[variant]
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`press flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-semibold disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

// ---------- Hoja inferior (modal) ----------

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="animate-fade absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="animate-sheet pb-safe relative flex max-h-[88dvh] flex-col rounded-t-3xl border-t border-line bg-surface">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line" />
        {title && (
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <h2 className="font-display text-2xl font-bold tracking-wide uppercase">{title}</h2>
            <button type="button" onClick={onClose} className="press text-sm font-semibold text-muted">
              Cerrar
            </button>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- Confirmación ----------

export function Confirm({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger,
  onConfirm,
  onCancel,
  extra,
}: {
  open: boolean
  title: string
  message?: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  extra?: ReactNode
}) {
  return (
    <Sheet open={open} onClose={onCancel}>
      <div className="pt-4 text-center">
        <h2 className="font-display text-2xl font-bold tracking-wide uppercase">{title}</h2>
        {message && <p className="mt-2 text-muted">{message}</p>}
        <div className="mt-6 flex flex-col gap-2">
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          {extra}
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

// ---------- Selector numérico ----------

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 3600,
  step = 1,
  format = (v: number) => String(v),
  presets,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  format?: (v: number) => string
  presets?: number[]
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(clamp(value - step))} className="press grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-2xl font-bold">
          −
        </button>
        <div className="tabular flex-1 text-center font-display text-3xl font-bold">{format(value)}</div>
        <button type="button" onClick={() => onChange(clamp(value + step))} className="press grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-2xl font-bold">
          +
        </button>
      </div>
      {presets && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`press rounded-full px-3 py-1.5 text-sm font-semibold ${p === value ? 'bg-ink text-bg' : 'bg-surface-2 text-muted'}`}
            >
              {format(p)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold tracking-wider text-muted uppercase">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </label>
  )
}

export const inputCls = 'h-12 w-full rounded-2xl bg-surface-2 px-4 text-ink placeholder:text-faint outline-none focus:ring-2 focus:ring-accent/60'

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="flex rounded-2xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`press flex-1 rounded-xl py-2.5 text-sm font-semibold ${o.value === value ? 'bg-ink text-bg' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 py-3 text-left">
      <div>
        <div className="font-medium">{label}</div>
        {hint && <div className="text-sm text-muted">{hint}</div>}
      </div>
      <div className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-2'}`}>
        <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-5.5' : 'left-0.5'}`} />
      </div>
    </button>
  )
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="text-5xl">{emoji}</div>
      <div className="mt-3 font-display text-2xl font-bold tracking-wide uppercase">{title}</div>
      {children && <div className="mt-2 text-muted">{children}</div>}
    </div>
  )
}

// ---------- Iconos SVG ----------

export const Ico = {
  back: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  close: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  play: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
    </svg>
  ),
  pause: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4.5" height="16" rx="1.2" />
      <rect x="13.5" y="4" width="4.5" height="16" rx="1.2" />
    </svg>
  ),
  prev: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 5.2v13.6a.8.8 0 0 1-1.2.7L7.6 12.7a.8.8 0 0 1 0-1.4l9.2-6.8a.8.8 0 0 1 1.2.7z" />
      <rect x="4.5" y="5" width="2.6" height="14" rx="1" />
    </svg>
  ),
  next: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 5.2v13.6a.8.8 0 0 0 1.2.7l9.2-6.8a.8.8 0 0 0 0-1.4L7.2 4.5A.8.8 0 0 0 6 5.2z" />
      <rect x="16.9" y="5" width="2.6" height="14" rx="1" />
    </svg>
  ),
  check: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  plus: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  up: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 15l6-6 6 6" />
    </svg>
  ),
  down: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  copy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
    </svg>
  ),
  trash: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9L17.5 7" />
    </svg>
  ),
  share: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" />
    </svg>
  ),
  edit: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
    </svg>
  ),
  list: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
}
