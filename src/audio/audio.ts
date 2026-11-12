import { getSettings } from '../lib/settings'

/**
 * Sonidos generados con Web Audio (sin archivos). En iPhone el audio solo se puede activar
 * dentro de un toque del usuario: por eso `unlockAudio()` se llama en el botón ▶ de cada rutina.
 */

type AudioSessionNav = Navigator & { audioSession?: { type: string } }

let ctx: AudioContext | null = null

export function unlockAudio(): void {
  const { audioMode } = getSettings()
  try {
    const nav = navigator as AudioSessionNav
    // Safari 16.4+: 'transient' suena encima de la música y la baja un momento, en vez de pausarla.
    if (nav.audioSession) nav.audioSession.type = audioMode
  } catch {
    // no soportado
  }
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    ctx = new Ctor()
  }
  if (ctx.state !== 'running') void ctx.resume()
  // Un buffer silencioso termina de "despertar" el audio en iOS.
  const buffer = ctx.createBuffer(1, 1, 22050)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(ctx.destination)
  src.start(0)

  // La voz también necesita un primer uso dentro del toque.
  if (getSettings().voice && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance('')
    speechSynthesis.speak(u)
  }
}

export function audioReady(): boolean {
  return ctx?.state === 'running'
}

function tone(freq: number, startOffset: number, duration: number, type: OscillatorType = 'sine', gainMul = 1) {
  if (!ctx) return
  const { volume } = getSettings()
  const t = ctx.currentTime + startOffset
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  const peak = Math.max(0.0001, volume * 0.6 * gainMul)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

function play(fn: () => void) {
  if (!getSettings().sound || !ctx) return
  if (ctx.state !== 'running') void ctx.resume()
  fn()
}

export const sounds = {
  /** Empieza un ejercicio: dos tonos subiendo. */
  exerciseStart: () =>
    play(() => {
      tone(880, 0, 0.18, 'triangle')
      tone(1320, 0.16, 0.32, 'triangle')
    }),
  /** Termina un ejercicio / empieza un descanso: dos tonos bajando. */
  restStart: () =>
    play(() => {
      tone(988, 0, 0.18, 'triangle')
      tone(659, 0.16, 0.36, 'triangle')
    }),
  /** 3-2-1 */
  tick: () => play(() => tone(1046, 0, 0.09, 'sine', 0.7)),
  /** Rutina terminada. */
  finish: () =>
    play(() => {
      tone(784, 0, 0.16, 'triangle')
      tone(988, 0.15, 0.16, 'triangle')
      tone(1175, 0.3, 0.16, 'triangle')
      tone(1568, 0.45, 0.5, 'triangle')
    }),
}

export function speak(text: string): void {
  if (!getSettings().voice || !('speechSynthesis' in window)) return
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'es-ES'
    const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'))
    if (voice) u.voice = voice
    u.rate = 1.05
    speechSynthesis.speak(u)
  } catch {
    // sin voz
  }
}
