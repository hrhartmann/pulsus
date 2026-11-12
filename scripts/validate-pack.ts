/**
 * Valida un paquete de rutinas con las mismas reglas que usa la app al importar.
 *
 *   npm run validate-pack -- ruta/al/paquete.json
 *
 * Sale con código 1 si hay errores.
 */
import { readFileSync } from 'node:fs'
import { expandRoutine, estimateDuration } from '../src/engine/expand'
import { planImport, validatePack, type Pack } from '../src/pack/pack'

const file = process.argv[2]
if (!file) {
  console.error('Uso: npm run validate-pack -- ruta/al/paquete.json')
  process.exit(2)
}

let data: unknown
try {
  data = JSON.parse(readFileSync(file, 'utf8'))
} catch (e) {
  console.error(`✖ No se pudo leer ${file}: ${(e as Error).message}`)
  process.exit(1)
}

const { errors, warnings } = validatePack(data)
for (const w of warnings) console.warn(`⚠ ${w}`)
for (const e of errors) console.error(`✖ ${e}`)
if (errors.length) {
  console.error(`\n${errors.length} error(es). El paquete NO se puede importar.`)
  process.exit(1)
}

const pack = data as Pack
const plan = planImport(pack, [], [])
const exMap = new Map(plan.exercises.map((e) => [e.id, e]))
console.log(`✔ ${file} es válido: ${plan.exercises.length} ejercicio(s), ${plan.routines.length} rutina(s).\n`)
for (const r of plan.routines) {
  const segs = expandRoutine(r, exMap)
  const { seconds, manualCount } = estimateDuration(segs)
  const min = Math.round(seconds / 60)
  console.log(`  ${r.icon.kind === 'emoji' ? r.icon.value : '·'} ${r.name} — ${segs.length} pasos en el reproductor, ≈ ${min} min con timer + ${manualCount} a tu ritmo`)
}
