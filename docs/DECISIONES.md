# Pulsus — decisiones (2026-10-22)

Lo que se decidió a partir de [PROPUESTA.md](PROPUESTA.md) (la propuesta original, que se mantiene como referencia).

## Decidido

- **Nombre:** Pulsus.
- **Plataforma:** PWA (web instalable). Se acepta que no se conecta con la app Reloj del iPhone y que la app
  tiene que estar abierta durante la rutina. Plan B nativo (SwiftUI + AlarmKit) solo si en la práctica molesta.
- **Repo público** en GitHub, hosting en **GitHub Pages** (en vez de Cloudflare Pages).
- **Todo lo de la contrapropuesta entra en la primera versión**: repeticiones, series, historial, compartir por link,
  voz, imagen de técnica, CSV.

## Cambios respecto a la propuesta

1. **Dos tipos de ejercicio dentro de una rutina:**
   - **Por tiempo**: corre el timer y avanza solo.
   - **Por repeticiones**: muestra el número de repeticiones y **espera a que toques “Listo”**. Ej: press banca.
2. **Descansos explícitos.** Un descanso es un paso propio de la rutina, siempre con timer y bips.
   Además, un ejercicio con varias series puede llevar “descanso entre series”, que el reproductor convierte en
   descansos explícitos entre cada serie (no después de la última).
3. **Reproductor como un video cortado en capítulos:** ⏮ vuelve al paso anterior (reinicia su timer), ⏭ salta al
   siguiente, y la lista de pasos permite saltar a cualquiera.
4. **Timer general** visible arriba, corre desde que empiezas hasta que terminas y **nunca se pausa**.
   La pausa solo detiene el timer del paso actual.
5. **Historial desde el día 1**: cada rutina realizada guarda una copia de la rutina tal como se hizo y el detalle
   de cada paso (tiempo real, hecho / saltado / pendiente). Si después editas o borras la rutina, el historial no cambia.
   Si terminas antes, se guarda como incompleta.
6. **El modelo cambió**: el paso de ejercicio ya no tiene “descanso después”; los descansos son pasos propios.

```
Routine { name, icon, color, prepSeconds, rounds, restBetweenRounds, steps[] }
  step = { type: 'exercise', exerciseId, mode: 'time'|'reps', seconds, reps, sets, restBetweenSets, note }
       | { type: 'rest', seconds, label }

Session { routineName, startedAt, endedAt, durationMs, completed, routineSnapshot, segments[] }
  segment = { kind, name, plannedSeconds|plannedReps, set, round, elapsedMs, status }
```

## Pendiente de probar en un iPhone real

- Que los bips suenen con el switch de silencio activado (Ajustes → “Con música de fondo”).
- Cómo convive con Spotify: “Encima” (baja la música un momento), “Mezclar” o “Solo”.
- Que la pantalla no se apague durante una rutina (Wake Lock, iOS 18.4+).

## v0.2 (2026-11-12)

- **Bloques** dentro de cada rutina (Calentamiento, Principal, Core…). El reproductor y el historial muestran el bloque.
- **Por lado**: un paso puede hacerse por lado; genera Izquierda y Derecha en cada serie. Si es por tiempo, va una
  pausa automática de 5 s para cambiar de lado.
- **Máximo de repeticiones** (`max`): espera “Listo” y pregunta cuántas hiciste; queda en el historial y en el CSV.
- **Ficha** del ejercicio: descripción, tips, más fácil, más difícil (se ven con el botón “i” en el reproductor).
  No se leen en voz alta.
- **Sin rangos** ni vueltas de circuito en el formato: números fijos, el rango va en la nota.
- **Paquetes de rutinas** (`pulsus-pack/1`) para que otro agente cree rutinas y Hans solo las importe.
  Importar es idempotente (ids estables). Ver docs/PAQUETES.md.
- Las alternativas (“si no hay paralelas…”) no tienen campo propio: van en `note` o en `easier`.

## v0.3 (2026-11-13)

- Nueva pestaña **Cuerpo**: % de grasa con plicómetro. Pide sexo, edad, peso, altura y los pliegues en mm.
- Fórmulas: Jackson‑Pollock 3 pliegues (por defecto), Jackson‑Pollock 7 y Durnin‑Womersley 4; la densidad se
  convierte con Siri (Brozek como referencia). La app muestra el cálculo paso a paso.
- Registro de mediciones con evolución, masa magra, masa grasa e índice de masa magra. Entra en el respaldo y en el CSV.
- Guía dentro de la app: técnica de medición, ubicación de cada pliegue, fórmulas, margen de error (±3–4 puntos),
  por qué la masa magra no es solo músculo (agua) y qué hacer para bajar el % (alimentación primero).
