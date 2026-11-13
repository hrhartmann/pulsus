import type { ReactNode } from 'react'
import { useLocation } from 'wouter'
import { CATEGORIES, FORMULAS, SITE_INFO, type BodyFormula, type SkinfoldSite } from '../body/bodyfat'
import { Ico, IconButton, TopBar } from '../components/ui'

/** Guía para medirse con plicómetro, entender las fórmulas y leer el resultado. */
export function BodyGuide() {
  const [, navigate] = useLocation()
  return (
    <div className="min-h-dvh pb-16">
      <TopBar
        title="Guía de medición"
        left={
          <IconButton label="Volver" onClick={() => (history.length > 1 ? history.back() : navigate('/cuerpo'))}>
            {Ico.back}
          </IconButton>
        }
      />
      <div className="mx-auto max-w-lg space-y-8 px-5 pt-6 leading-relaxed">
        <Section n="1" title="Cómo medirte con el plicómetro">
          <ol className="list-decimal space-y-2.5 pl-5">
            <li>
              <b>Siempre en las mismas condiciones:</b> en la mañana, en ayunas, antes de entrenar y de ducharte. Después de entrenar la piel está hinchada y el pliegue sale más
              grueso.
            </li>
            <li>
              <b>Lado derecho del cuerpo</b>, de pie y con el músculo relajado.
            </li>
            <li>
              <b>Toma el pliegue</b> con el pulgar y el índice de la mano izquierda, como una pinza grande. Tienes que tomar piel y grasa, pero <b>no músculo</b>: si dudas, contrae
              el músculo un segundo; lo que se escapa de tus dedos era músculo.
            </li>
            <li>
              <b>Pon el plicómetro 1 cm más abajo de tus dedos</b>, perpendicular al pliegue y a media profundidad. No sueltes el pliegue mientras mides.
            </li>
            <li>
              <b>Suelta el gatillo y lee a los 2 segundos.</b> Si esperas más, la grasa se comprime y el número baja.
            </li>
            <li>
              <b>Mide cada punto 2 o 3 veces</b>, pasando por todos los puntos y volviendo al primero. Si dos lecturas difieren en más de 1–2 mm, mide de nuevo. Anota el promedio.
            </li>
            <li>
              <b>Marca el punto</b> con un lápiz las primeras veces. Medir un par de centímetros más arriba o más abajo cambia el resultado.
            </li>
          </ol>
          <Note>
            Mídete cada 2 a 4 semanas, no todos los días: la grasa cambia lento. Y ojalá te mida siempre la misma persona (o siempre tú): la técnica de cada uno da números un poco
            distintos.
          </Note>

          <h3 className="pt-3 font-semibold">Dónde va cada pliegue</h3>
          <div className="divide-y divide-line/60 rounded-2xl bg-surface px-4">
            {(Object.keys(SITE_INFO) as SkinfoldSite[]).map((s) => (
              <div key={s} className="py-3">
                <div className="font-semibold">
                  {SITE_INFO[s].name} <span className="text-sm font-normal text-muted">· pliegue {SITE_INFO[s].fold.toLowerCase()}</span>
                </div>
                <div className="text-sm text-ink/85">{SITE_INFO[s].how}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section n="2" title="Las fórmulas">
          <p>El cálculo tiene dos pasos:</p>
          <p>
            <b>Paso 1 — densidad corporal.</b> Una ecuación convierte la suma de tus pliegues en milímetros (S) y tu edad en la densidad de tu cuerpo (D). La grasa es menos densa
            que el músculo y el hueso: a más pliegue, menos densidad.
          </p>
          {(Object.keys(FORMULAS) as BodyFormula[]).map((f) => (
            <div key={f} className="rounded-2xl bg-surface p-4">
              <div className="font-semibold">{FORMULAS[f].name}</div>
              <div className="mt-0.5 text-sm text-muted">{FORMULAS[f].about}</div>
              <div className="mt-2 text-sm">
                <b>{f === 'dw4' ? 'Hombre y mujer' : 'Hombre'}:</b>{' '}
                {FORMULAS[f]
                  .sites('male')
                  .map((s) => SITE_INFO[s].name.toLowerCase())
                  .join(', ')}
              </div>
              <Formula>{FORMULAS[f].equation('male')}</Formula>
              {f !== 'dw4' && (
                <>
                  <div className="mt-2 text-sm">
                    <b>Mujer:</b>{' '}
                    {FORMULAS[f]
                      .sites('female')
                      .map((s) => SITE_INFO[s].name.toLowerCase())
                      .join(', ')}
                  </div>
                  <Formula>{FORMULAS[f].equation('female')}</Formula>
                </>
              )}
            </div>
          ))}
          <p>
            <b>Paso 2 — ecuación de Siri.</b> Convierte la densidad en porcentaje de grasa:
          </p>
          <Formula big>% grasa = 495 / D − 450</Formula>
          <p className="text-sm text-muted">La app también muestra la de Brozek (457 / D − 414,2) como referencia; da casi lo mismo. El número principal es siempre Siri.</p>
        </Section>

        <Section n="3" title="Cómo leer el resultado">
          <p>
            <b>El número exacto tiene un error de ± 3 a 4 puntos</b>, incluso bien medido. Lo que sí es confiable es la <b>tendencia</b>: si te mides igual cada vez y el número
            baja, estás perdiendo grasa. Por eso usa siempre la misma fórmula.
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(['male', 'female'] as const).map((sex) => (
              <div key={sex} className="rounded-2xl bg-surface p-3">
                <div className="mb-1 font-semibold">{sex === 'male' ? 'Hombres' : 'Mujeres'}</div>
                {CATEGORIES[sex].map(([max, name], i) => {
                  const min = i === 0 ? (sex === 'male' ? 2 : 10) : CATEGORIES[sex][i - 1][0]
                  return (
                    <div key={name} className="flex justify-between text-muted">
                      <span>{name}</span>
                      <span className="tabular">{max === Infinity ? `${min} % o más` : `${min}–${max - 1} %`}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <p className="text-xs text-faint">Rangos de referencia del American Council on Exercise.</p>
          <p>
            <b>Masa grasa</b> = peso × % de grasa. <b>Masa magra</b> = peso − masa grasa.
          </p>
          <p>
            <b>La masa magra no es solo músculo.</b> Es todo lo que no es grasa: músculo, huesos, órganos y <b>agua</b>. Sirve para estimar si ganas o pierdes músculo, con dos
            cuidados:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>El agua mueve el peso 1 a 2 kg de un día a otro</b> (sal, carbohidratos, hidratación, alcohol, ciclo menstrual, un entrenamiento duro). Como la masa magra sale del
              peso, esos kilos de agua aparecen como “músculo” ganado o perdido. Por eso: pésate siempre en ayunas y mira varias mediciones, no una.
            </li>
            <li>
              Si la masa magra <b>sube o se mantiene durante varias mediciones</b> mientras el % de grasa baja, vas bien: estás perdiendo grasa y conservando músculo.
            </li>
          </ul>
          <p>
            El <b>índice de masa magra</b> (masa magra ÷ altura², ajustado a 1,80 m) permite comparar musculatura sin que influya la altura. Referencia en hombres: 18–20 promedio,
            21–22 entrenado, 25 es cerca del límite natural. En mujeres, unos 3–4 puntos menos.
          </p>
        </Section>

        <Section n="4" title="Cómo bajar el % de grasa">
          <p>
            <b>Lo más importante es la alimentación.</b> La grasa baja cuando comes un poco menos energía de la que gastas, de forma sostenida. El ejercicio ayuda, pero es muy
            fácil comerse en 5 minutos lo que cuesta una hora quemar.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>Déficit moderado:</b> unas 300–500 kcal menos al día. Bajar 0,5–1 % del peso por semana es un buen ritmo; más rápido se pierde músculo.
            </li>
            <li>
              <b>Proteína alta</b> (1,6–2,2 g por kg de peso al día): protege el músculo y quita el hambre.
            </li>
            <li>
              <b>Entrenar fuerza:</b> es lo que le dice al cuerpo que conserve el músculo mientras pierde grasa. El % de grasa baja más cuando mantienes la masa magra.
            </li>
            <li>
              <b>Moverte más en el día</b> (caminar, cardio suave) y <b>dormir 7–8 horas</b>: con poco sueño aumenta el hambre y se pierde más músculo.
            </li>
          </ul>
          <Note>Resumen: la dieta decide cuánta grasa pierdes; el entrenamiento de fuerza y la proteína deciden que lo que pierdas sea grasa y no músculo.</Note>
          <p className="text-xs text-faint">
            Esto es orientación general, no un consejo médico. Si tienes una condición de salud, consulta con un profesional antes de hacer dieta.
          </p>
        </Section>
      </div>
    </div>
  )
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-3 font-display text-2xl font-bold tracking-wide uppercase">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-lg text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm">{children}</div>
}

function Formula({ children, big }: { children: ReactNode; big?: boolean }) {
  return <div className={`mt-1 rounded-xl bg-black/40 px-3 py-2 font-mono ${big ? 'text-center text-base' : 'text-[12px] text-muted'}`}>{children}</div>
}
