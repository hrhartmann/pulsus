/**
 * Cálculo de % de grasa con plicómetro. Módulo puro (sin base de datos ni DOM), con tests.
 *
 * Paso 1: una ecuación convierte la suma de pliegues (mm) + edad en DENSIDAD corporal (g/cm³).
 * Paso 2: la ecuación de Siri convierte densidad en % de grasa:  %grasa = 495 / densidad − 450.
 *
 * Fuentes: Jackson & Pollock (1978), Jackson, Pollock & Ward (1980), Durnin & Womersley (1974),
 * Siri (1961), Brozek (1963).
 */

export type Sex = 'male' | 'female'
export type SkinfoldSite = 'chest' | 'abdomen' | 'thigh' | 'triceps' | 'suprailiac' | 'subscapular' | 'midaxillary' | 'biceps'
export type BodyFormula = 'jp3' | 'jp7' | 'dw4'
export type Skinfolds = Partial<Record<SkinfoldSite, number>>

export interface Measurement {
  id: string
  /** Fecha de la medición (ms). */
  date: number
  sex: Sex
  age: number
  weightKg: number
  heightCm: number
  formula: BodyFormula
  /** Pliegues en mm. */
  skinfolds: Skinfolds
  /** Resultado guardado al momento de medir (Siri). */
  bodyFatPct: number
  note?: string
  createdAt: number
}

export const SITE_INFO: Record<SkinfoldSite, { name: string; fold: string; how: string }> = {
  chest: {
    name: 'Pecho',
    fold: 'Diagonal',
    how: 'A mitad de camino entre el pliegue de la axila y la tetilla (en mujeres, a un tercio desde la axila). Pliegue diagonal, siguiendo la línea hacia la axila.',
  },
  abdomen: {
    name: 'Abdomen',
    fold: 'Vertical',
    how: 'Dos centímetros (un pulgar) a la derecha del ombligo. Pliegue vertical. Abdomen relajado, sin meter la barriga.',
  },
  thigh: {
    name: 'Muslo',
    fold: 'Vertical',
    how: 'Cara frontal del muslo, a media distancia entre el pliegue de la ingle y el borde superior de la rótula. Pliegue vertical. Sentado o con el peso en la otra pierna, muslo relajado.',
  },
  triceps: {
    name: 'Tríceps',
    fold: 'Vertical',
    how: 'Parte de atrás del brazo, a media distancia entre el hombro y el codo. Pliegue vertical. Brazo colgando relajado. Es difícil medírselo uno mismo: pide ayuda si puedes.',
  },
  suprailiac: {
    name: 'Suprailíaco',
    fold: 'Diagonal',
    how: 'Justo encima del hueso de la cadera (cresta ilíaca), en la línea que baja desde el borde delantero de la axila. Pliegue diagonal, siguiendo la línea natural de la cadera.',
  },
  subscapular: {
    name: 'Subescapular',
    fold: 'Diagonal',
    how: 'En la espalda, 1–2 cm bajo la punta inferior del omóplato. Pliegue diagonal a 45°. Necesitas ayuda de otra persona.',
  },
  midaxillary: {
    name: 'Axilar medio',
    fold: 'Vertical',
    how: 'En el costado, sobre la línea que baja desde el centro de la axila, a la altura de la punta inferior del esternón. Pliegue vertical.',
  },
  biceps: {
    name: 'Bíceps',
    fold: 'Vertical',
    how: 'Cara frontal del brazo, sobre el músculo, a media distancia entre el hombro y el codo. Pliegue vertical. Brazo relajado.',
  },
}

export interface FormulaInfo {
  id: BodyFormula
  name: string
  short: string
  about: string
  sites: (sex: Sex) => SkinfoldSite[]
  /** Texto de la ecuación de densidad, para mostrar. S = suma de pliegues en mm. */
  equation: (sex: Sex) => string
}

export const FORMULAS: Record<BodyFormula, FormulaInfo> = {
  jp3: {
    id: 'jp3',
    name: 'Jackson‑Pollock 3 pliegues',
    short: '3 pliegues',
    about: 'La más usada. Rápida y te la puedes medir solo (en hombres). Recomendada para llevar el registro.',
    sites: (sex) => (sex === 'male' ? ['chest', 'abdomen', 'thigh'] : ['triceps', 'suprailiac', 'thigh']),
    equation: (sex) => (sex === 'male' ? 'D = 1,10938 − 0,0008267·S + 0,0000016·S² − 0,0002574·edad' : 'D = 1,0994921 − 0,0009929·S + 0,0000023·S² − 0,0001392·edad'),
  },
  jp7: {
    id: 'jp7',
    name: 'Jackson‑Pollock 7 pliegues',
    short: '7 pliegues',
    about: 'Más completa: reparte el error entre más puntos. Necesitas ayuda para la espalda y el tríceps.',
    sites: () => ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdomen', 'suprailiac', 'thigh'],
    equation: (sex) => (sex === 'male' ? 'D = 1,112 − 0,00043499·S + 0,00000055·S² − 0,00028826·edad' : 'D = 1,097 − 0,00046971·S + 0,00000056·S² − 0,00012828·edad'),
  },
  dw4: {
    id: 'dw4',
    name: 'Durnin‑Womersley 4 pliegues',
    short: '4 pliegues',
    about: 'Solo tren superior (sin muslo). Suele dar valores algo más altos que Jackson‑Pollock.',
    sites: () => ['biceps', 'triceps', 'subscapular', 'suprailiac'],
    equation: () => 'D = c − m·log₁₀(S)   (c y m dependen de sexo y edad)',
  },
}

/** Coeficientes de Durnin‑Womersley por tramo de edad: [edad máxima, c, m]. */
const DW: Record<Sex, [number, number, number][]> = {
  male: [
    [16, 1.1533, 0.0643],
    [19, 1.162, 0.063],
    [29, 1.1631, 0.0632],
    [39, 1.1422, 0.0544],
    [49, 1.162, 0.07],
    [Infinity, 1.1715, 0.0779],
  ],
  female: [
    [16, 1.1369, 0.0598],
    [19, 1.1549, 0.0678],
    [29, 1.1599, 0.0717],
    [39, 1.1423, 0.0632],
    [49, 1.1333, 0.0612],
    [Infinity, 1.1339, 0.0645],
  ],
}

export function sumSkinfolds(formula: BodyFormula, sex: Sex, skinfolds: Skinfolds): number | null {
  let sum = 0
  for (const site of FORMULAS[formula].sites(sex)) {
    const v = skinfolds[site]
    if (v === undefined || !Number.isFinite(v) || v <= 0) return null
    sum += v
  }
  return sum
}

/** Densidad corporal (g/cm³), o null si falta algún pliegue. */
export function bodyDensity(formula: BodyFormula, sex: Sex, age: number, skinfolds: Skinfolds): number | null {
  const s = sumSkinfolds(formula, sex, skinfolds)
  if (s === null || !(age > 0)) return null
  if (formula === 'jp3') {
    return sex === 'male' ? 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * age : 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * age
  }
  if (formula === 'jp7') {
    return sex === 'male' ? 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * age : 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * age
  }
  const [, c, m] = DW[sex].find(([maxAge]) => age <= maxAge)!
  return c - m * Math.log10(s)
}

export const siri = (density: number) => 495 / density - 450
export const brozek = (density: number) => 457 / density - 414.2

export interface BodyResult {
  sum: number
  density: number
  /** % de grasa (Siri). Es el valor principal. */
  bodyFatPct: number
  /** % de grasa (Brozek), como referencia. */
  brozekPct: number
  fatMassKg: number
  /** Masa magra = todo lo que no es grasa: músculo, huesos, órganos y AGUA. */
  leanMassKg: number
  bmi: number
  /** Índice de masa magra (kg/m²), normalizado a 1,80 m. Sirve para comparar musculatura entre fechas. */
  ffmi: number
  category: string
}

export function computeBody(input: Pick<Measurement, 'sex' | 'age' | 'weightKg' | 'heightCm' | 'formula' | 'skinfolds'>): BodyResult | null {
  const density = bodyDensity(input.formula, input.sex, input.age, input.skinfolds)
  if (density === null || !(input.weightKg > 0) || !(input.heightCm > 0)) return null
  const bodyFatPct = Math.max(2, siri(density))
  const fatMassKg = (input.weightKg * bodyFatPct) / 100
  const leanMassKg = input.weightKg - fatMassKg
  const h = input.heightCm / 100
  return {
    sum: sumSkinfolds(input.formula, input.sex, input.skinfolds)!,
    density,
    bodyFatPct,
    brozekPct: Math.max(2, brozek(density)),
    fatMassKg,
    leanMassKg,
    bmi: input.weightKg / (h * h),
    ffmi: leanMassKg / (h * h) + 6.1 * (1.8 - h),
    category: category(input.sex, bodyFatPct),
  }
}

/** Rangos de referencia del American Council on Exercise (ACE). */
export const CATEGORIES: Record<Sex, [number, string][]> = {
  male: [
    [6, 'Grasa esencial'],
    [14, 'Atleta'],
    [18, 'Fitness'],
    [25, 'Promedio'],
    [Infinity, 'Alto'],
  ],
  female: [
    [14, 'Grasa esencial'],
    [21, 'Atleta'],
    [25, 'Fitness'],
    [32, 'Promedio'],
    [Infinity, 'Alto'],
  ],
}

export function category(sex: Sex, pct: number): string {
  return CATEGORIES[sex].find(([max]) => pct < max)![1]
}
