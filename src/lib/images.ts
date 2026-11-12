import { db, newId } from '../db/db'

/**
 * Achica una imagen antes de guardarla para no llenar el teléfono.
 * - Los GIF se guardan tal cual (para no perder la animación) si pesan menos de 4 MB.
 * - `square`: recorta al centro en cuadrado (para iconos).
 */
export async function saveImage(file: File, opts: { maxSize: number; square?: boolean }): Promise<string> {
  const id = newId()
  if (file.type === 'image/gif' && file.size < 4 * 1024 * 1024 && !opts.square) {
    await db.images.add({ id, blob: file, mime: file.type })
    return id
  }
  const bitmap = await loadBitmap(file)
  const { width: w0, height: h0 } = bitmap
  let sx = 0
  let sy = 0
  let sw = w0
  let sh = h0
  if (opts.square) {
    const side = Math.min(w0, h0)
    sx = (w0 - side) / 2
    sy = (h0 - side) / 2
    sw = sh = side
  }
  const scale = Math.min(1, opts.maxSize / Math.max(sw, sh))
  const w = Math.round(sw * scale)
  const h = Math.round(sh * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const c = canvas.getContext('2d')!
  c.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85),
  )
  await db.images.add({ id, blob, mime: 'image/jpeg' })
  return id
}

async function loadBitmap(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      // HEIC u otro formato: probamos con <img>
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export async function deleteImage(id: string | undefined): Promise<void> {
  if (id) await db.images.delete(id)
}
