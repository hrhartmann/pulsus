/** Paleta de colores para rutinas y ejercicios. La clave es lo que se guarda en la base de datos. */
export const COLORS: Record<string, { solid: string; soft: string }> = {
  red: { solid: '#ff4d5e', soft: '#ff4d5e26' },
  orange: { solid: '#ff8a3d', soft: '#ff8a3d26' },
  amber: { solid: '#ffc53d', soft: '#ffc53d26' },
  lime: { solid: '#a3e635', soft: '#a3e63526' },
  green: { solid: '#34d399', soft: '#34d39926' },
  teal: { solid: '#2dd4bf', soft: '#2dd4bf26' },
  sky: { solid: '#38bdf8', soft: '#38bdf826' },
  indigo: { solid: '#818cf8', soft: '#818cf826' },
  violet: { solid: '#c084fc', soft: '#c084fc26' },
  pink: { solid: '#f472b6', soft: '#f472b626' },
  slate: { solid: '#94a3b8', soft: '#94a3b826' },
}

export const COLOR_KEYS = Object.keys(COLORS)

export function color(key: string | undefined) {
  return COLORS[key ?? ''] ?? COLORS.slate
}
