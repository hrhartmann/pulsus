# Pulsus — guía para desarrollar

App de timers de ejercicio, PWA para iPhone. Ver README.md, docs/DECISIONES.md y docs/PAQUETES.md.
Repo: https://github.com/hrhartmann/pulsus · App: https://hrhartmann.github.io/pulsus/

## Cómo trabajar
1. `npm install` (Node 22+).
2. Cambiar código. Toda lógica nueva va en módulos puros con test (`src/engine/`, `src/pack/`).
3. Antes de commitear: `npm test`, `npm run build` (incluye `tsc -b`) y `npm run format`.
4. Probar la UI en viewport de iPhone (393×852 y SE 375×667). Con Playwright, `page.clock` adelanta el tiempo.
   Para probar una migración de base de datos: servir la versión anterior y la nueva en el mismo origen.
5. Commit en `main` con mensaje en español que diga qué cambia para quien usa la app. Push → GitHub Actions corre
   tests, compila y publica en Pages. Subir `version` en package.json cuando cambie algo visible.
6. Si cambia el formato de paquetes: actualizar `public/pulsus-pack.schema.json`, `public/ejemplo.pulsus.json`,
   `docs/PAQUETES.md` y la guía para agentes que crean rutinas (`SportWorld/PULSUS_GUIA_RUTINAS.md`, fuera del repo).

## Comandos
- `npm run dev` · `npm test` · `npm run build` · `npm run format`
- `npm run validate-pack -- archivo.json` — valida un paquete con las mismas reglas que la app.

## Modelo (src/types.ts)
- `Exercise`: biblioteca. Ficha (`description`, `tips`, `easier`, `harder`) y valores sugeridos (`defaultMode`, …).
- `Routine` → `blocks[]` → `steps[]`. Paso = ejercicio (`mode: time | reps | max`, `sets`, `restBetweenSets`,
  `perSide`, `note`) o descanso (`rest`).
- `expandRoutine()` aplana todo en `Segment[]` (lo que recorre el reproductor). Ahí viven las reglas de series,
  lados (Izquierda/Derecha + 5 s de cambio si es por tiempo), descansos entre series y vueltas.
- `Session`: historial. Copia de cada segmento con tiempo real, estado y reps anotadas (`actualReps`).

## Composición corporal (src/body/)
- `bodyfat.ts` es puro: fórmulas de densidad (Jackson‑Pollock 3 y 7, Durnin‑Womersley 4) + Siri/Brozek, masa grasa,
  masa magra, índice de masa magra, categorías ACE. Los coeficientes tienen test con valores calculados a mano:
  no cambiarlos sin fuente.
- `Measurement` guarda las ENTRADAS (sexo, edad, peso, altura, pliegues, fórmula) y el % resultante; el resto se
  recalcula con `computeBody()`.
- Pantallas: `BodyScreen` (resumen + registro), `MeasurementEditor`, `BodyGuide` (cómo medirse, fórmulas, cómo leer).
- Los textos de la guía son contenido de salud: mantenerlos sobrios, con el margen de error y sin prometer precisión.

## Reglas que no hay que romper
- **El motor del reproductor (`src/engine/player.ts`) es puro**: recibe `now` y devuelve estado + eventos. Nada de
  `setInterval`, `Date.now()` ni efectos ahí. Todo cambio va con test en `engine.test.ts`.
- **El tiempo se calcula con la hora real, no contando ticks.** iOS congela la página en segundo plano; al volver,
  `tick()` avanza los segmentos con timer que ya terminaron y se detiene en el primero manual.
- **Los eventos viejos no suenan**: `PlayerScreen` ignora eventos con `at` de hace más de 1,5 s.
- **El timer general nunca se pausa** (`totalElapsedMs = now - startedAt`). La pausa solo afecta al segmento.
- **Audio en iPhone**: `unlockAudio()` tiene que llamarse dentro de un toque del usuario (botón ▶). Si la app se
  recarga a mitad de rutina, el reproductor muestra “Toca para continuar” por eso mismo.
- **La rutina en curso se guarda en localStorage** (`lib/active.ts`) para continuar si iOS recarga la app.
- **El historial guarda una copia**. Editar, borrar o reimportar una rutina nunca cambia el historial.
- **Duraciones en el paso de la rutina, no en el ejercicio.** El ejercicio solo trae valores sugeridos.
- **Sin rangos** en ningún lado (ni app ni paquetes): números fijos, el rango va en `note`.
- **Esquema de la base de datos**: para cambiarlo, agrega `db.version(n+1)` con `.upgrade()` en `src/db/db.ts`; nunca
  edites una versión existente (los teléfonos ya tienen datos). v2 pasó `steps` → `blocks` y `notes` → `tips`; v3 agregó la tabla `measurements`.
  Los respaldos viejos se normalizan al restaurar (`normalizeRoutine`, `normalizeExercise`).
- **Importar paquetes es idempotente**: ejercicios por id y luego por nombre; rutinas por id (se reemplazan).
  Nunca se pisan la imagen de técnica ni los iconos de imagen.
- **Actualizaciones de la PWA**: `registerType: 'prompt'`. No cambiar a autoUpdate: recargaría en medio de una rutina.
- Rutas con hash (`#/…`) para que funcione en GitHub Pages sin configurar el servidor.
- UI en español neutro. Tema oscuro. Inputs con font-size ≥ 16 px (si no, iOS hace zoom).
