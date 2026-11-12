# Pulsus — Propuesta técnica original (nombre de trabajo: WorkoutTimer)

> Nombre de trabajo. Candidatos para el nombre final: **Tanda**, **Serie**, **Pulso**, **Ritmo**.
> Fecha: 2026-10-22

## 1. Qué es

App de timers para entrenar. Tienes una **biblioteca de ejercicios** y armas **rutinas** con ellos.
Le das play a una rutina y la app encadena sola los tiempos de trabajo y descanso, con un sonido
al empezar y al terminar cada ejercicio, mostrando en pantalla el nombre, el icono, el tiempo
restante y (opcional) una imagen de la técnica correcta.

Requisitos que me diste:
- Rutinas y ejercicios con nombre, y cada uno con un emoji o imagen pequeña como icono.
- Imagen de referencia por ejercicio para revisar la técnica.
- Timers automáticos con descansos, sonido al inicio y al final de cada ejercicio.
- Funciona en iPhone, instalable, con los datos guardados en el teléfono.
- Exportar a CSV / Excel / Google Sheets.
- Fácil de compartir con amigos con iPhone.
- Fácil de seguir desarrollando (GitHub).

## 2. Recomendación: Progressive Web App (PWA)

Una página web que se instala en la pantalla de inicio del iPhone ("Compartir → Agregar a inicio"),
abre a pantalla completa sin barra de Safari, funciona sin internet y guarda los datos en el teléfono.

**Por qué PWA y no app nativa:**

| | PWA (recomendado) | App nativa (Swift) |
|---|---|---|
| Desarrollo desde tu PC Windows | ✅ Sí | ❌ Requiere Mac + Xcode |
| Costo | US$0 | US$99/año (Apple Developer) para compartirla |
| Compartir con amigos | Mandas un link | TestFlight, invitación por correo |
| Publicar un cambio | `git push` y listo, se actualiza sola | Nuevo build, subirlo, que lo instalen |
| Suena con el teléfono bloqueado | ❌ No (ver §6) | ✅ Sí (AlarmKit, iOS 26+) |
| Timer en pantalla de bloqueo / Dynamic Island | ❌ No | ✅ Sí |

La única ventaja real de lo nativo es la del teléfono bloqueado. Mi propuesta es partir con la PWA,
usarla un par de semanas en el gimnasio, y solo si esa limitación te molesta en la práctica,
evaluar la versión nativa (ver §8).

## 3. Stack

| Pieza | Tecnología | Por qué |
|---|---|---|
| Lenguaje | **TypeScript** | Tipos = menos bugs cuando vuelvas al código en 3 meses |
| UI | **React** + **Vite** | Estándar, mucha documentación, fácil de iterar con Claude |
| Estilos | **Tailwind CSS** | Rápido para lograr algo que se vea bien y consistente |
| Instalable / offline | **vite-plugin-pwa** (manifest + service worker) | Hace la parte PWA casi sola |
| Datos locales | **IndexedDB** vía **Dexie.js** | Base de datos en el teléfono; guarda también imágenes |
| Sonido | **Web Audio API** (tonos sintetizados) | Sin archivos de audio, latencia mínima |
| Pantalla encendida | **Screen Wake Lock API** | Funciona en apps instaladas desde iOS 18.4 |
| Voz (opcional) | **SpeechSynthesis** | "Siguiente: sentadillas" |
| Repo | **GitHub** | |
| Hosting | **Cloudflare Pages** (o GitHub Pages si el repo es público) | Gratis, HTTPS, URL de preview por cada rama |

Sin backend, sin login, sin base de datos en la nube. Todo vive en el teléfono de cada persona.

## 4. Modelo de datos

```
Ejercicio (biblioteca, reutilizable)
  id, nombre, icono (emoji o imagen), color
  imagenTecnica? (foto o GIF, opcional)
  notas?
  duracionPorDefecto (seg)

Rutina
  id, nombre, icono, color
  preparacion (seg)          ← cuenta regresiva antes de empezar, ej. 10 s
  vueltas                    ← repetir la rutina completa N veces
  descansoEntreVueltas (seg)
  pasos: [
    { ejercicioId, trabajo (seg), descansoDespues (seg), series }
  ]

Sesión (historial, opcional — ver contrapropuesta)
  id, rutinaId, inicio, fin, completada (sí/no)
```

**Decisión de diseño clave:** la duración vive en el *paso de la rutina*, no en el ejercicio.
El ejercicio solo trae una duración sugerida. Así "Plancha" puede durar 30 s en tu rutina de core
y 60 s en otra, sin duplicar el ejercicio ni su imagen.

## 5. Pantallas

1. **Rutinas** (inicio): tarjetas grandes con icono, nombre, duración total y botón ▶.
2. **Editor de rutina**: nombre + icono, lista de pasos que se reordena arrastrando,
   tiempos con selectores rápidos (15/20/30/45/60 s) además de escribir el número.
3. **Biblioteca de ejercicios**: nombre, icono, imagen de técnica.
4. **Reproductor** (la pantalla importante):

```
┌─────────────────────────────┐
│  Core 20 min    Vuelta 2/3  │
│  ━━━━━━━━━━━━━━━░░░░░░░░░░  │  ← progreso de la rutina
│                             │
│           🏋️                │
│        SENTADILLAS          │
│                             │
│          0:27               │  ← número gigante, legible a 2 m
│                             │
│   [ imagen de técnica ]     │
│                             │
│   Siguiente: 😮‍💨 Descanso 15s │
│                             │
│     ⏮      ⏸      ⏭        │
└─────────────────────────────┘
```
   - Color de fondo distinto para **trabajo** y **descanso**, para saber en qué fase estás sin leer.
   - Sonidos: 🔔 al empezar un ejercicio, 🔔 (otro tono) al terminarlo, y bips 3‑2‑1 al final de cada descanso.

5. **Ajustes**: volumen, voz on/off, exportar / importar.

## 6. Limitaciones honestas de iPhone (léelas antes de decidir)

1. **No se puede conectar con la app Reloj del iPhone.** Apple no permite que una web cree timers ahí.
   (Lo más parecido sería un Atajo de iOS, pero solo maneja un timer a la vez y te saca de la app; no sirve para encadenar.)
2. **La pantalla tiene que quedar encendida y la app abierta durante la rutina.** Si bloqueas el
   teléfono o te cambias a Spotify/WhatsApp, iOS congela la página y **los bips no suenan**.
   - Mitigación: la app mantiene la pantalla encendida sola (Wake Lock), y el timer se calcula con
     la hora real, así que al volver se pone al día sin desfasarse — solo se pierden los bips de ese rato.
   - En la práctica: dejas el teléfono apoyado mostrando el timer, que es justo lo que quieres para ver la imagen de la técnica.
   - La música en Spotify sigue sonando de fondo sin problema; los bips se superponen y la bajan un momento.
3. **El modo silencio (switch lateral) podría silenciar los bips.** Hay una API de Safari para evitarlo; lo pruebo en tu teléfono en la Fase 1.
4. **No hay vibración**: Safari en iPhone no permite que una web haga vibrar el teléfono.
5. **Los datos viven en cada teléfono.** Si borras la app, se borran. Por eso existe el respaldo en JSON (§7).

## 7. Exportar / importar

- **CSV** (abre directo en Excel y se importa en Google Sheets): `ejercicios.csv`, `rutinas.csv` (un paso por fila) y, si se activa, `sesiones.csv`.
- **JSON respaldo completo** (incluye imágenes): para pasar tus datos a otro teléfono o restaurarlos.
- **Importar JSON**: restaurar el respaldo.
- Sincronización directa con Google Sheets: posible más adelante (necesita login con Google); no lo pondría en el MVP.

## 8. Contrapropuesta — lo que cambiaría o agregaría

1. **Ejercicios por repeticiones, no solo por tiempo.** Para "10 dominadas" un timer no sirve:
   el paso queda esperando hasta que tocas "Listo", y después arranca el descanso con su timer.
   Mezcla natural para quien hace fuerza + intervalos.
2. **Series dentro del paso.** "Sentadillas 3×40 s con 20 s de descanso" es un paso, no tres copiados.
3. **Historial de sesiones.** Cada rutina terminada queda registrada (fecha, duración, completa o no).
   Es la data que de verdad te va a servir exportar después ("¿cuántas veces entrené este mes?").
4. **Compartir una rutina por link.** La rutina va codificada en el link; tu amigo lo abre y la importa.
   Sin servidor. Muy útil si la idea es pasársela a amigos.
5. **Iconos: emoji primero.** En iPhone los emoji nativos se ven muy bien, son gratis y no pesan.
   Para que se vea "chora": cada rutina/ejercicio tiene emoji + color de fondo, en un círculo o
   cuadrado redondeado (estilo icono de app). Imagen propia solo cuando quieras algo específico.
6. **Imagen de técnica: foto o GIF de tu galería**, que la app achica automáticamente
   (~800 px) para no llenar el teléfono. Un GIF corto del movimiento sirve más que una foto.
7. **Voz opcional** que anuncia el siguiente ejercicio — útil cuando no estás mirando la pantalla.
8. **Plan B nativo, solo si hace falta:** si después de usarla la limitación del teléfono bloqueado
   te molesta, la versión nativa con **SwiftUI + AlarmKit** (iOS 26+) da timer en pantalla de bloqueo,
   Dynamic Island y sonido aunque el teléfono esté bloqueado. Costo: Mac + US$99/año. El modelo
   de datos de arriba se mantiene igual, así que no se pierde el trabajo de diseño.

## 9. Fases

**Fase 1 — MVP (lo que usarías en el gimnasio)**
- Biblioteca de ejercicios y rutinas con nombre, emoji y color.
- Reproductor con trabajo/descanso, series, vueltas, sonidos de inicio/fin y 3‑2‑1.
- Pantalla siempre encendida, pausa / saltar / volver.
- Instalable, funciona sin internet.
- Respaldo e importación en JSON.
- Deploy automático: `git push` → la app se actualiza en tu teléfono.

**Fase 2 — Comodidad**
- Imagen de técnica (foto/GIF).
- Ejercicios por repeticiones.
- Exportar CSV.
- Historial de sesiones.
- Voz.

**Fase 3 — Amigos**
- Compartir rutina por link.
- Rutinas de ejemplo para que un amigo nuevo no parta con la app vacía.

## 10. Flujo de desarrollo

```
WorkoutTimer/
  PROPUESTA.md
  README.md
  src/
    db/          ← Dexie: tablas y migraciones
    engine/      ← lógica del timer (pura, testeable, sin UI)
    audio/       ← bips y voz
    screens/     ← Rutinas, Editor, Biblioteca, Reproductor, Ajustes
    components/
  public/        ← iconos de la app, manifest
```

- La lógica del timer va separada de la UI y con tests, porque es lo que no puede fallar.
- **Probar en el iPhone mientras desarrollas:** el Wake Lock y la instalación exigen HTTPS, así que
  `localhost` desde el teléfono no basta. Cada rama que subes a GitHub genera una URL de preview
  en Cloudflare Pages; la abres en el iPhone y pruebas. `main` = la versión que usas tú y tus amigos.
- Requisitos en tu PC: Node.js 22+, Git, cuenta de GitHub y de Cloudflare (gratis).

## 11. Decisiones pendientes

- [ ] ¿PWA ahora y nativo solo si hace falta? (recomendado) o ¿nativo desde el inicio?
- [ ] Nombre de la app.
- [ ] Repo público (GitHub Pages) o privado (Cloudflare Pages).
- [ ] ¿Entran "por repeticiones" e historial al MVP o quedan en Fase 2?
