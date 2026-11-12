# Paquetes de rutinas (`pulsus-pack/1`)

Especificación del formato para crear ejercicios y rutinas **fuera** de la app e importarlos.
Pensado para que lo escriba una persona o un agente. La guía para agentes que crean rutinas
(sin tocar el código) es `PULSUS_GUIA_RUTINAS.md`, en la carpeta SportWorld de Hans (fuera de este repo);
esta es la referencia técnica. Si cambias el formato, actualiza las dos.

- Esquema JSON: [`public/pulsus-pack.schema.json`](../public/pulsus-pack.schema.json) — publicado en `https://hrhartmann.github.io/pulsus/pulsus-pack.schema.json`
- Ejemplo completo: [`public/ejemplo.pulsus.json`](../public/ejemplo.pulsus.json) — publicado en `https://hrhartmann.github.io/pulsus/ejemplo.pulsus.json`
- Validar: `npm run validate-pack -- ruta/al/paquete.json` (mismas reglas que la app)
- Código: `src/pack/pack.ts` (validación, plan de importación, exportación) y `src/pack/io.ts` (base de datos, links)

## Estructura

```jsonc
{
  "format": "pulsus-pack/1",        // obligatorio
  "name": "Plan nov 2026",          // opcional, se muestra al importar
  "description": "…",
  "exercises": [ Ejercicio ],
  "routines":  [ Rutina ]
}
```

### Ejercicio

| Campo | Tipo | |
|---|---|---|
| `id` | id | **Obligatorio.** Minúsculas, números y guiones: `dominada-pronada`. Estable. |
| `name` | texto ≤ 60 | **Obligatorio.** |
| `emoji` | 1 emoji | Icono. Por defecto 💪. |
| `color` | `red` `orange` `amber` `lime` `green` `teal` `sky` `indigo` `violet` `pink` `slate` | Por defecto, uno fijo según el id. |
| `description` | texto | Ficha: cómo se hace. |
| `tips` | texto | Ficha: claves de técnica. |
| `easier` / `harder` | texto | Ficha: variantes. |
| `mode` | `time` `reps` `max` | Valor sugerido cuando lo agregas a mano en la app. |
| `seconds` / `reps` | entero | Valor sugerido según `mode`. |
| `perSide` | bool | Sugerido: por lado. |

### Rutina

| Campo | Tipo | |
|---|---|---|
| `id` | id | **Obligatorio.** |
| `name` | texto ≤ 60 | **Obligatorio.** |
| `description` | texto ≤ 300 | Se muestra bajo el nombre (dónde, cuánto dura). |
| `emoji`, `color` | | Como en ejercicios. |
| `prepSeconds` | 0–300 | Cuenta regresiva inicial. Por defecto 10. |
| `blocks` | lista de bloques | **Obligatorio**, al menos uno. |

**Bloque:** `{ "name": "Calentamiento", "steps": [ Paso ] }` — `name` opcional (≤ 40).

### Paso

Ejercicio — exactamente **uno** de `seconds`, `reps` o `max`:

| Campo | Tipo | |
|---|---|---|
| `exercise` | id | **Obligatorio.** Un ejercicio del paquete (o uno que ya exista en la app con ese id). |
| `seconds` | 1–3600 | Por tiempo: corre el timer y avanza solo. |
| `reps` | 1–1000 | Por repeticiones: muestra el número y espera “Listo”. |
| `max` | `true` | Máximo de repeticiones: espera “Listo” y pregunta cuántas hiciste (queda en el historial). |
| `sets` | 1–20 | Series. Por defecto 1. |
| `restBetweenSets` | 0–900 | Descanso con timer **entre** series (no después de la última). |
| `perSide` | bool | Izquierda y derecha en cada serie. Por tiempo, con 5 s automáticos para cambiar de lado. |
| `note` | texto ≤ 120 | Se ve en pantalla: rango, peso, variante. |

Descanso: `{ "rest": 90, "label": "Prepara el mat" }` — `rest` en segundos (1–3600), `label` opcional.

## Reglas

- **Sin rangos.** `"reps": "8-12"` es un error. Se elige un número (normalmente el mínimo) y el rango va en `note`.
- **Sin vueltas de circuito.** Si un circuito se repite, se escriben los pasos las veces que corresponda, o se usan `sets`.
- **Números enteros**, en segundos.
- Campos desconocidos generan una advertencia y se ignoran.

## Cómo se importa

Ajustes → **Importar paquete de rutinas** → elegir el `.json` (en iPhone, desde Archivos / iCloud / OneDrive).
La app muestra una vista previa con lo que se crea y lo que se actualiza, y los errores si los hay.

- **Ejercicios:** se buscan por `id`; si no, por nombre (sin mayúsculas ni tildes). Se actualizan los campos que trae
  el paquete; los que no trae se mantienen. Nunca se tocan la imagen de técnica ni un icono de imagen.
- **Rutinas:** se buscan por `id`. Si existe, se **reemplaza** (bloques, nombre, etc.). Las ediciones hechas en el
  teléfono a esa rutina se pierden; para conservarlas, cambia el `id`.
- **El historial nunca se toca.**

Ajustes → **Exportar mis rutinas como paquete** genera el camino inverso (sin imágenes). Sirve como punto de partida
para que un agente modifique lo que ya tienes en el teléfono.

Compartir una rutina por link usa el mismo formato: el link lleva un paquete con esa rutina (`#/importar/<base64url>`).
