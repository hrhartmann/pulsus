import { useRef, useState } from 'react'
import { COLOR_KEYS, color } from '../lib/colors'
import { saveImage } from '../lib/images'
import type { IconValue } from '../types'
import { Button, IconBadge, Sheet, inputCls } from './ui'

const EMOJIS = [
  '🏋️', '💪', '🦵', '🦶', '🔥', '⚡', '🏃', '🚴', '🏊', '🧘', '🤸', '🧗',
  '🥊', '🤾', '⛹️', '🚣', '🏌️', '🤼', '🦾', '🫀', '🫁', '🧠', '🎯', '🏆',
  '⛰️', '🧱', '🪜', '🪢', '🏐', '⚽', '🏀', '🎾', '🏓', '🛹', '⛷️', '🥋',
  '⏱️', '⏳', '😤', '😮‍💨', '🥵', '💀', '🚀', '💥', '🌊', '🌪️', '❄️', '☀️',
  '🐢', '🐇', '🦍', '🐻', '🦅', '🐍', '🦘', '🐆', '🍌', '🥤', '💧', '✨',
]

/**
 * Elegir icono y color. El icono puede ser un emoji de la lista, cualquier emoji del teclado,
 * o una imagen de la galería (se recorta cuadrada).
 */
export function IconPicker({
  icon,
  colorKey,
  onChange,
  size = 72,
}: {
  icon: IconValue
  colorKey: string
  onChange: (icon: IconValue, colorKey: string) => void
  size?: number
}) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    const imageId = await saveImage(f, { maxSize: 256, square: true })
    onChange({ kind: 'image', imageId }, colorKey)
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="press relative" aria-label="Cambiar icono">
        <IconBadge icon={icon} colorKey={colorKey} size={size} />
        <span className="absolute -right-1 -bottom-1 grid h-6 w-6 place-items-center rounded-full bg-ink text-xs text-bg">✎</span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Icono">
        <div className="flex justify-center py-2">
          <IconBadge icon={icon} colorKey={colorKey} size={88} />
        </div>

        <div className="mt-3 mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Color</div>
        <div className="flex flex-wrap gap-2.5">
          {COLOR_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-label={k}
              onClick={() => onChange(icon, k)}
              className="press h-9 w-9 rounded-full"
              style={{ background: color(k).solid, boxShadow: k === colorKey ? `0 0 0 3px var(--color-surface), 0 0 0 5px ${color(k).solid}` : undefined }}
            />
          ))}
        </div>

        <div className="mt-5 mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Emoji</div>
        <div className="grid grid-cols-8 gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onChange({ kind: 'emoji', value: e }, colorKey)}
              className={`press grid aspect-square place-items-center rounded-xl text-2xl ${icon.kind === 'emoji' && icon.value === e ? 'bg-surface-2 ring-2 ring-ink/40' : ''}`}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            className={inputCls}
            placeholder="O escribe cualquier emoji"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={!custom.trim()}
            onClick={() => {
              const value = [...new Intl.Segmenter().segment(custom.trim())][0]?.segment
              if (value) onChange({ kind: 'emoji', value }, colorKey)
              setCustom('')
            }}
          >
            Usar
          </Button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button variant="secondary" className="mt-3 w-full" onClick={() => fileRef.current?.click()}>
          🖼️ Usar una imagen
        </Button>

        <Button className="mt-3 w-full" onClick={() => setOpen(false)}>
          Listo
        </Button>
      </Sheet>
    </>
  )
}
