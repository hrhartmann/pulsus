# Pulsus

App de timers para entrenar, instalable en iPhone (PWA). Armas rutinas con tus ejercicios, le das ▶ y la app
encadena todo: ejercicios por tiempo que avanzan solos, ejercicios por repeticiones que esperan a que toques
**Listo**, descansos explícitos con timer y bips, y un timer general que corre desde que empiezas.

- 🏋️ Rutinas y ejercicios con nombre, emoji o imagen, y color
- 🧱 Rutinas organizadas en **bloques** (Calentamiento, Principal, Core…)
- ⏱ Pasos por **tiempo** (avanza solo), por **repeticiones** o al **máximo** (esperan a tocar “Listo”; en el máximo anotas cuántas hiciste), con series y descanso entre series
- ↔️ Ejercicios **por lado**: izquierda y derecha en cada serie
- 📋 Ficha de cada ejercicio: descripción, tips, variante más fácil y más difícil
- 😮‍💨 Descansos explícitos, siempre con timer
- 🔔 Bip al empezar y al terminar cada paso, 3‑2‑1 antes de que termine cada timer, voz opcional
- ⏮ ⏭ Atrás y adelante como capítulos de un video; lista de pasos para saltar a cualquiera
- 📷 Imagen o GIF de técnica por ejercicio, visible mientras lo haces
- 📏 **% de grasa con plicómetro**: Jackson‑Pollock (3 o 7 pliegues) o Durnin‑Womersley + Siri, masa magra y grasa, registro con evolución y guía para medirse
- 📈 Historial: cada rutina hecha queda guardada tal como se hizo (aunque después edites la rutina)
- 📊 Exportar a CSV (Excel / Google Sheets) y respaldo completo en JSON
- 📦 Importar **paquetes de rutinas** (.json) creados a mano o por un agente — ver [docs/PAQUETES.md](docs/PAQUETES.md)
- 🔗 Compartir una rutina por link
- 📴 Funciona sin internet; los datos viven en el teléfono

## Instalar en el iPhone

1. Abre la URL de la app en **Safari**.
2. Toca **Compartir** → **Agregar a inicio**.
3. Ábrela desde el icono. Se ve a pantalla completa y funciona sin internet.

> La pantalla se mantiene encendida durante una rutina. Si bloqueas el teléfono o te cambias de app, iOS
> congela la página y no suenan los bips; al volver, el timer se pone al día solo.

## Desarrollo

Requisitos: [Node.js 22+](https://nodejs.org) y Git.

```bash
npm install
npm run dev        # http://localhost:5173/pulsus/  (también en tu red local)
npm test           # tests del motor del reproductor
npm run build      # genera dist/
npm run format     # prettier
npm run validate-pack -- archivo.json   # valida un paquete de rutinas
```

Para probar en el iPhone, sube los cambios a GitHub: el deploy es automático. (Desde `localhost` el
teléfono no tiene HTTPS, así que la instalación y el Wake Lock no funcionan ahí.)

## Publicar (GitHub Pages)

Cada `git push` a `main` corre los tests, compila y publica en `https://<usuario>.github.io/pulsus/`
(ver `.github/workflows/deploy.yml`).

Solo la primera vez: en GitHub → **Settings → Pages → Source: GitHub Actions**.

Las apps instaladas se actualizan solas: al abrirlas aparece “Hay una versión nueva → Actualizar”
(nunca se recarga sola en medio de una rutina).

## Estructura

```
src/
  types.ts            modelo de datos (Exercise, Routine, Session…)
  engine/
    expand.ts         rutina → lista lineal de segmentos (series, vueltas, descansos)
    player.ts         motor del reproductor: funciones puras (start, tick, next, prev, jump, pause…)
    engine.test.ts    tests
  pack/               paquetes de rutinas: validar, importar, exportar (pulsus-pack/1)
  db/                 IndexedDB con Dexie + migraciones + datos de ejemplo
  audio/audio.ts      bips con Web Audio + voz
  lib/                ajustes, exportar/importar, imágenes, wake lock, formato
  components/         UI reutilizable
  screens/            pantallas
public/pulsus-pack.schema.json   esquema JSON de los paquetes
public/ejemplo.pulsus.json       paquete de ejemplo
scripts/validate-pack.ts         validador de paquetes por línea de comandos
docs/                            propuesta, decisiones y formato de paquetes
```

Stack: React + TypeScript + Vite, Tailwind CSS, Dexie (IndexedDB), vite-plugin-pwa, Vitest.
