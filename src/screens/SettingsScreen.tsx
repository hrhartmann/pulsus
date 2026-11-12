import { useRef, useState, type ReactNode } from 'react'
import { sounds, speak, unlockAudio } from '../audio/audio'
import { BigTitle, Button, Confirm, Segmented, Toggle } from '../components/ui'
import { db } from '../db/db'
import { loadExamples } from '../db/seed'
import { isoLocal } from '../lib/format'
import { setSettings, useSettings } from '../lib/settings'
import { buildBackup, buildCsvFiles, restoreBackup, shareOrDownload } from '../lib/transfer'

/** En GitHub Pages (usuario.github.io/pulsus) deduce el repo; en otro hosting no muestra el link. */
const REPO_URL = location.hostname.endsWith('github.io')
  ? `https://github.com/${location.hostname.split('.')[0]}/${location.pathname.split('/')[1] || 'pulsus'}`
  : null

export function SettingsScreen() {
  const s = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [confirmWipe, setConfirmWipe] = useState(false)

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div>
      <BigTitle>Ajustes</BigTitle>
      <div className="mx-auto max-w-lg space-y-6 px-4 pt-2">
        <Section title="Sonido">
          <Toggle checked={s.sound} onChange={(sound) => setSettings({ sound })} label="Bips de inicio y fin" hint="Suena al empezar y terminar cada ejercicio y descanso." />
          <Toggle checked={s.countdown} onChange={(countdown) => setSettings({ countdown })} label="Cuenta regresiva 3‑2‑1" hint="Antes de que termine cada timer." />
          <div className="py-3">
            <div className="mb-2 font-medium">Volumen</div>
            <input type="range" min={0.1} max={1} step={0.05} value={s.volume} onChange={(e) => setSettings({ volume: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
          </div>
          <Toggle checked={s.voice} onChange={(voice) => setSettings({ voice })} label="Voz" hint="Anuncia cada ejercicio y lo que sigue." />
          <div className="py-3">
            <div className="mb-1 font-medium">Con música de fondo</div>
            <div className="mb-2 text-sm text-muted">Si los bips no suenan o te cortan la música, prueba otra opción.</div>
            <Segmented
              value={s.audioMode}
              onChange={(audioMode) => setSettings({ audioMode })}
              options={[
                { value: 'transient', label: 'Encima' },
                { value: 'ambient', label: 'Mezclar' },
                { value: 'playback', label: 'Solo' },
              ]}
            />
            <div className="mt-2 text-xs text-faint">
              Encima: baja la música un momento (recomendado). Mezclar: no la toca, pero el modo silencio puede callar los bips. Solo: pausa la música.
            </div>
          </div>
          <Button
            variant="secondary"
            className="mt-1 w-full"
            onClick={() => {
              unlockAudio()
              sounds.exerciseStart()
              setTimeout(() => sounds.restStart(), 900)
              setTimeout(() => speak('Así suena la voz'), 1800)
            }}
          >
            🔊 Probar sonido
          </Button>
        </Section>

        <Section title="Tus datos">
          <p className="pb-3 text-sm text-muted">Todo se guarda solo en este teléfono. Haz un respaldo de vez en cuando.</p>
          <div className="space-y-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                const files = await buildCsvFiles()
                await shareOrDownload(files, 'Pulsus CSV')
              }}
            >
              📊 Exportar a CSV (Excel / Sheets)
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                const blob = await buildBackup()
                const file = new File([blob], `pulsus-respaldo-${isoLocal(Date.now()).slice(0, 10)}.json`, { type: 'application/json' })
                await shareOrDownload([file], 'Respaldo Pulsus')
              }}
            >
              💾 Crear respaldo completo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  const r = await restoreBackup(f)
                  flash(`Restaurado: ${r.routines} rutinas, ${r.exercises} ejercicios, ${r.sessions} registros.`)
                } catch (err) {
                  flash((err as Error).message || 'No se pudo leer el respaldo')
                }
              }}
            />
            <Button variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
              📥 Restaurar respaldo
            </Button>
            {msg && <div className="animate-fade rounded-2xl bg-surface-2 p-3 text-center text-sm">{msg}</div>}
          </div>
          <p className="pt-3 text-xs text-faint">
            El CSV trae 4 archivos: ejercicios, rutinas, historial y detalle del historial. Separados por “;”, se abren directo en Excel. En Google Sheets: Archivo → Importar.
          </p>
        </Section>

        <Section title="Otros">
          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              await loadExamples()
              flash('Se agregaron los ejemplos.')
            }}
          >
            ✨ Cargar rutinas de ejemplo
          </Button>
          <Button variant="danger" className="mt-2 w-full" onClick={() => setConfirmWipe(true)}>
            Borrar todos los datos
          </Button>
        </Section>

        <div className="pb-6 text-center text-xs text-faint">
          Pulsus v{__APP_VERSION__}
          {REPO_URL && (
            <>
              {' · '}
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="underline">
                código en GitHub
              </a>
            </>
          )}
        </div>
      </div>

      <Confirm
        open={confirmWipe}
        danger
        title="¿Borrar todo?"
        message="Se borran rutinas, ejercicios, imágenes e historial de este teléfono. No se puede deshacer."
        confirmLabel="Borrar todo"
        onConfirm={async () => {
          await Promise.all([db.routines.clear(), db.exercises.clear(), db.sessions.clear(), db.images.clear()])
          setConfirmWipe(false)
          flash('Datos borrados.')
        }}
        onCancel={() => setConfirmWipe(false)}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg font-bold tracking-wide text-muted uppercase">{title}</h2>
      <div className="divide-line/50 rounded-3xl bg-surface px-4 py-2">{children}</div>
    </section>
  )
}
