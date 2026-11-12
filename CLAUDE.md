# Pulsus — guía para desarrollar

App de timers de ejercicio, PWA para iPhone. Ver README.md y docs/PROPUESTA.md.

## Comandos
- `npm run dev` · `npm test` · `npm run build` (corre `tsc -b` antes de compilar)
- Deploy: push a `main` → GitHub Actions → GitHub Pages en `/pulsus/`.

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
- **El historial guarda una copia** de la rutina y de cada segmento (`Session.routineSnapshot`, `segments`).
  Editar o borrar una rutina nunca cambia el historial.
- **Duraciones en el paso de la rutina, no en el ejercicio.** El ejercicio solo trae valores sugeridos.
- **Descansos**: explícitos (paso `rest`) o entre series (`restBetweenSets`, solo ENTRE series, no después de la última).
- **Esquema de la base de datos**: para cambiarlo, agrega `db.version(n+1)` en `src/db/db.ts`; nunca edites una
  versión existente (los teléfonos ya tienen datos).
- **Actualizaciones de la PWA**: `registerType: 'prompt'`. No cambiar a autoUpdate: recargaría en medio de una rutina.
- Rutas con hash (`#/…`) para que funcione en GitHub Pages sin configurar el servidor.
- UI en español neutro. Tema oscuro. Inputs con font-size ≥ 16 px (si no, iOS hace zoom).

## Probar
- Lógica: `npm test`.
- Visual: viewport de iPhone (393×852 y SE 375×667). Con Playwright, `page.clock` sirve para adelantar el tiempo
  y probar el avance automático y la puesta al día.
