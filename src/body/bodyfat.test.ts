import { describe, expect, it } from 'vitest'
import { bodyDensity, brozek, category, computeBody, siri } from './bodyfat'

describe('bodyfat', () => {
  it('Siri y Brozek: densidad 1,06 ≈ 17 %', () => {
    expect(siri(1.06)).toBeCloseTo(16.98, 1)
    expect(brozek(1.06)).toBeCloseTo(16.93, 1)
  })

  it('Jackson‑Pollock 3, hombre de 30 con suma 45 mm', () => {
    // 1,10938 − 0,0372015 + 0,00324 − 0,007722 = 1,0676965
    const d = bodyDensity('jp3', 'male', 30, { chest: 10, abdomen: 20, thigh: 15 })!
    expect(d).toBeCloseTo(1.0676965, 6)
    expect(siri(d)).toBeCloseTo(13.61, 1)
  })

  it('Jackson‑Pollock 3, mujer de 30 con suma 60 mm', () => {
    // 1,0994921 − 0,059574 + 0,00828 − 0,004176 = 1,0440221
    const d = bodyDensity('jp3', 'female', 30, { triceps: 20, suprailiac: 15, thigh: 25 })!
    expect(d).toBeCloseTo(1.0440221, 6)
    expect(siri(d)).toBeCloseTo(24.13, 1)
  })

  it('Jackson‑Pollock 7, hombre de 30 con suma 100 mm', () => {
    // 1,112 − 0,043499 + 0,0055 − 0,0086478 = 1,0653532
    const d = bodyDensity('jp7', 'male', 30, { chest: 10, midaxillary: 12, triceps: 10, subscapular: 14, abdomen: 22, suprailiac: 16, thigh: 16 })!
    expect(d).toBeCloseTo(1.0653532, 6)
  })

  it('Durnin‑Womersley usa el tramo de edad correcto', () => {
    const folds = { biceps: 5, triceps: 10, subscapular: 12, suprailiac: 13 } // suma 40
    expect(bodyDensity('dw4', 'male', 25, folds)).toBeCloseTo(1.1631 - 0.0632 * Math.log10(40), 6)
    expect(bodyDensity('dw4', 'male', 35, folds)).toBeCloseTo(1.1422 - 0.0544 * Math.log10(40), 6)
    expect(bodyDensity('dw4', 'female', 55, folds)).toBeCloseTo(1.1339 - 0.0645 * Math.log10(40), 6)
  })

  it('devuelve null si falta un pliegue', () => {
    expect(bodyDensity('jp3', 'male', 30, { chest: 10, abdomen: 20 })).toBeNull()
    expect(computeBody({ sex: 'male', age: 30, weightKg: 80, heightCm: 180, formula: 'jp3', skinfolds: {} })).toBeNull()
  })

  it('calcula masa grasa, masa magra, IMC e índice de masa magra', () => {
    const r = computeBody({ sex: 'male', age: 30, weightKg: 80, heightCm: 180, formula: 'jp3', skinfolds: { chest: 10, abdomen: 20, thigh: 15 } })!
    expect(r.sum).toBe(45)
    expect(r.fatMassKg + r.leanMassKg).toBeCloseTo(80, 6)
    expect(r.fatMassKg).toBeCloseTo(10.89, 1)
    expect(r.bmi).toBeCloseTo(24.69, 1)
    expect(r.ffmi).toBeCloseTo(r.leanMassKg / 3.24, 6) // a 1,80 m no hay corrección
    expect(r.category).toBe('Atleta')
  })

  it('categorías ACE', () => {
    expect(category('male', 16)).toBe('Fitness')
    expect(category('male', 26)).toBe('Alto')
    expect(category('female', 23)).toBe('Fitness')
  })
})
