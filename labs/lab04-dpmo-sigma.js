/**
 * LAB 04 · DPMO y nivel sigma
 *
 * Guía: M1 §6 (DPU, DPO, DPMO, rendimiento, nivel sigma y desplazamiento de 1.5σ) y plantilla Excel «DPMO y Sigma».
 * Convención de la plantilla: Z de largo plazo = NORMSINV(1 − DPO); nivel sigma = Z + desplazamiento.
 * Compara dos escenarios (A = antes, B = después) y convierte un nivel sigma en DPMO con la tabla de la guía.
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: caso de los arneses (300 → 162.5 DPMO), ejemplo de la plantilla Excel y los ejercicios 1, 3, 4 y 5
 * del módulo 1 de la guía.
 */
import { dpmoDeSigma, metricasDefectos } from '../js/lib/stats.js';
import { cifras, conSigno, dpmo as fmtDpmo, dpmoGuia, entero, num, pct, rendimiento } from '../js/core/format.js';
import { GENERADORES } from '../js/lib/graficas.js';

/** Tabla de la guía (M1 §6): nivel sigma ↔ DPMO ↔ rendimiento, con desplazamiento de 1.5σ. */
const NIVELES = [6, 5, 4, 3, 2, 1];

const UMBRAL = {
  titulo: 'Tabla de niveles sigma (guía M1 §6, con desplazamiento de 1.5σ)',
  filas: NIVELES.map((n) => {
    const p = dpmoDeSigma(n);
    return { rango: `${n}σ`, texto: `${dpmoGuia(p)} DPMO · rendimiento ${rendimiento(1 - p / 1e6)}${n === 6 ? ' · estándar Six Sigma' : ''}` };
  }),
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto: 'Los defectos ocurren de forma independiente y las oportunidades de defecto están bien definidas y son comparables entre unidades. El desplazamiento de 1.5σ es una convención de largo plazo, no una medición de tu proceso.',
};

const escenario = (e, p) => ({ unidades: e[`${p}_unidades`], oportunidades: e[`${p}_oportunidades`], defectos: e[`${p}_defectos`] });
const sinCapturar = (s) => [s.unidades, s.oportunidades, s.defectos].every((x) => !Number.isFinite(x));

export default function lab04(ctx = {}) {
  const caso = ctx.caso?.defectos;
  const antes = caso?.antes ?? { unidades: 2000, oportunidades: 5, defectos: 3 };
  const despues = caso?.despues ?? { unidades: 16000, oportunidades: 5, defectos: 13 };
  const excel = caso?.plantillaExcel ?? { antes: { unidades: 2000, oportunidades: 25, defectos: 15 }, despues: { unidades: 4000, oportunidades: 25, defectos: 16 } };
  const meta = caso?.metaDpmo ?? 100;
  const vacio = { despues_unidades: NaN, despues_oportunidades: NaN, despues_defectos: NaN };
  const valores = (a, b, extra = {}) => ({
    antes_unidades: a.unidades, antes_oportunidades: a.oportunidades, antes_defectos: a.defectos,
    ...(b ? { despues_unidades: b.unidades, despues_oportunidades: b.oportunidades, despues_defectos: b.defectos } : vacio),
    desplazamiento: 1.5, meta, sigmaEntrada: 4, ...extra,
  });

  return {
    id: 'lab04',
    numero: '04',
    modulo: 'M1',
    titulo: 'DPMO y nivel sigma',
    resumen: 'Convierte defectos, unidades y oportunidades en DPU, DPO, DPMO, rendimiento y nivel sigma; compara dos escenarios y revisa el efecto del desplazamiento de 1.5σ.',
    panelAncho: true,
    entradas: [
      { tipo: 'seccion', etiqueta: 'Escenario A · antes' },
      { id: 'antes_unidades', tipo: 'numero', etiqueta: 'Unidades inspeccionadas', valor: antes.unidades, min: 0 },
      { id: 'antes_oportunidades', tipo: 'numero', etiqueta: 'Oportunidades de defecto por unidad', valor: antes.oportunidades, min: 0, ayuda: 'Lo que puede salir mal en cada unidad y que de verdad se verifica.' },
      { id: 'antes_defectos', tipo: 'numero', etiqueta: 'Defectos encontrados', valor: antes.defectos, min: 0 },
      { tipo: 'seccion', etiqueta: 'Escenario B · después (opcional)' },
      { id: 'despues_unidades', tipo: 'numero', etiqueta: 'Unidades inspeccionadas', valor: despues.unidades, min: 0 },
      { id: 'despues_oportunidades', tipo: 'numero', etiqueta: 'Oportunidades de defecto por unidad', valor: despues.oportunidades, min: 0 },
      { id: 'despues_defectos', tipo: 'numero', etiqueta: 'Defectos encontrados', valor: despues.defectos, min: 0 },
      { tipo: 'seccion', etiqueta: 'Criterios' },
      { id: 'desplazamiento', tipo: 'slider', etiqueta: 'Desplazamiento de largo plazo', min: 0, max: 2, paso: 0.1, valor: 1.5, dec: 1, unidad: 'σ', ayuda: 'La convención de Six Sigma es 1.5σ; con 0 obtienes el Z a secas.' },
      { id: 'meta', tipo: 'numero', etiqueta: 'Meta de DPMO', valor: meta, min: 0, marcador: 'opcional' },
      { id: 'sigmaEntrada', tipo: 'slider', etiqueta: 'Convertir un nivel sigma a DPMO', min: 1, max: 6, paso: 0.1, valor: 4, dec: 1, unidad: 'σ', ayuda: 'Usa la tabla de la guía: DPMO = P(Z > σ − desplazamiento) × 1,000,000.' },
    ],
    presets: [
      { id: 'guia', etiqueta: 'Caso: arneses antes y después', ayuda: 'M1 §7 y M10: 2,000 arneses × 5 oportunidades con 3 defectos (300 DPMO); tras la mejora, 16,000 × 5 con 13 (162.5 DPMO; la guía redondea a 162).', valores: valores(antes, despues) },
      { id: 'excel', etiqueta: 'Plantilla Excel «DPMO y Sigma»', ayuda: 'Ejemplo de la plantilla: 25 oportunidades por arnés; antes 2,000 unidades con 15 defectos (300 DPMO), después 4,000 con 16 (160 DPMO).', valores: valores(excel.antes, excel.despues) },
      { id: 'empaque', etiqueta: 'Guía M1: ejercicio 1 (empaque)', ayuda: '1,500 unidades, 8 oportunidades, 18 defectos: 1,500 DPMO, entre 4σ y 5σ (≈ 4.5σ).', valores: valores({ unidades: 1500, oportunidades: 8, defectos: 18 }, null, { meta: NaN }) },
      { id: 'lineas-ab', etiqueta: 'Guía M1: ejercicio 3 (líneas A y B)', ayuda: 'Escenario A = línea A (3,000 × 6, 4 defectos: 222.2 DPMO); escenario B = línea B (800 × 5, 2 defectos: 500 DPMO).', valores: valores({ unidades: 3000, oportunidades: 6, defectos: 4 }, { unidades: 800, oportunidades: 5, defectos: 2 }, { meta: NaN }) },
      { id: 'ej4', etiqueta: 'Guía M1: ejercicio 4 (desplazamiento)', ayuda: 'Una capacidad de corto plazo de 4.5σ equivale a 3.0σ de largo plazo; la guía ubica 3σ en la tabla (66,807 DPMO).', valores: valores({ unidades: NaN, oportunidades: NaN, defectos: NaN }, null, { meta: NaN, sigmaEntrada: 3 }) },
      { id: 'ej5', etiqueta: 'Guía M1: ejercicio 5 (sin resolver)', ayuda: '12 defectos en 3,000 unidades con 6 oportunidades por unidad.', valores: valores({ unidades: 3000, oportunidades: 6, defectos: 12 }, null, { meta: NaN }) },
    ],
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Cómo cambia el DPMO si defines 25 oportunidades por arnés en lugar de 5, con los mismos defectos? ¿Qué decisión de definición hay detrás de esa cifra?',
      'La mejora de 300 a 162.5 DPMO, ¿alcanza la meta de 100? ¿Cuántos defectos como máximo habría tolerado el periodo «después» para cumplirla?',
      'Con tan pocos defectos en la línea base, ¿cuánto confías en su DPMO? ¿Qué ampliarías para mejorar la estimación?',
      'Pon el desplazamiento en 0: ¿qué nivel sigma obtienes? ¿Por qué la convención de 1.5σ cambia la cifra sin cambiar el proceso?',
    ],

    calcular(e) {
      const d = Number.isFinite(e.desplazamiento) ? e.desplazamiento : 1.5;
      const A = escenario(e, 'antes');
      const B = escenario(e, 'despues');
      const mA = metricasDefectos({ ...A, desplazamiento: d });
      const mB = sinCapturar(B) ? null : metricasDefectos({ ...B, desplazamiento: d });
      const okA = mA.completo;
      const okB = Boolean(mB?.completo);
      const aviso = [];
      if (!okA) aviso.push('Escenario A incompleto: captura unidades, oportunidades por unidad y defectos (cero o más).');
      if (mB && !okB) aviso.push('Escenario B incompleto: se ignora hasta que captures sus tres datos.');
      if (okA && mA.dpo >= 1) aviso.push('Escenario A: hay más defectos que oportunidades; revisa los datos.');
      if (okB && mB.dpo >= 1) aviso.push('Escenario B: hay más defectos que oportunidades; revisa los datos.');

      const nota = (s) => `${entero(s.defectos)} ÷ (${entero(s.unidades)} × ${entero(s.oportunidades)}) × 10⁶`;
      const salidas = [];
      if (okA) {
        salidas.push(
          { id: 'dpmo-a', etiqueta: 'DPMO · A (antes)', valor: fmtDpmo(mA.dpmo), color: 'teal', nota: nota(A) },
          { id: 'sigma-a', etiqueta: 'Nivel sigma · A', valor: num(mA.sigma, 2), color: 'azul', nota: `Z = ${num(mA.z, 2)} + ${num(d, 1)}` }
        );
      }
      if (okB) {
        salidas.push(
          { id: 'dpmo-b', etiqueta: 'DPMO · B (después)', valor: fmtDpmo(mB.dpmo), color: 'teal', nota: nota(B) },
          { id: 'sigma-b', etiqueta: 'Nivel sigma · B', valor: num(mB.sigma, 2), color: 'azul', nota: `Z = ${num(mB.z, 2)} + ${num(d, 1)}` }
        );
      }
      if (okA && okB && mA.dpmo > 0) {
        salidas.push(
          { id: 'reduccion', etiqueta: 'Cambio de DPMO (B − A)', valor: `${conSigno(mB.dpmo - mA.dpmo, 1)} (${conSigno(((mB.dpmo - mA.dpmo) / mA.dpmo) * 100, 1)} %)`, nota: 'negativo = mejora' },
          { id: 'delta-sigma', etiqueta: 'Cambio de nivel sigma', valor: Number.isFinite(mA.sigma + mB.sigma) ? conSigno(mB.sigma - mA.sigma, 2) : '—', nota: 'B − A' }
        );
      }
      const sigmaIn = e.sigmaEntrada;
      const dpmoIn = Number.isFinite(sigmaIn) ? dpmoDeSigma(sigmaIn, d) : NaN;
      salidas.push({ id: 'conversion', etiqueta: Number.isFinite(sigmaIn) ? `Un nivel de ${num(sigmaIn, 1)}σ equivale a` : 'Nivel sigma a convertir', valor: Number.isFinite(dpmoIn) ? `${dpmoGuia(dpmoIn)} DPMO` : '—', ancha: true, nota: Number.isFinite(dpmoIn) ? `Z de largo plazo ${num(sigmaIn - d, 2)} · rendimiento ${rendimiento(1 - dpmoIn / 1e6)}` : 'mueve el control deslizante' });

      /* ---- semáforos ---- */
      const semaforos = [];
      const ref = okB ? mB : okA ? mA : null;
      if (!ref) semaforos.push({ nombre: 'Datos', estado: 'sin-datos', texto: 'Captura el escenario A para calcular el DPMO.' });
      if (ref) {
        const nombreRef = okB ? 'B (después)' : 'A (antes)';
        if (Number.isFinite(e.meta) && e.meta >= 0) {
          semaforos.push(
            ref.dpmo <= e.meta
              ? { nombre: 'Meta de DPMO', estado: 'cumple', texto: `${nombreRef}: ${fmtDpmo(ref.dpmo)} DPMO, dentro de la meta de ${fmtDpmo(e.meta)}.` }
              : okA && okB && mB.dpmo < mA.dpmo
                ? { nombre: 'Meta de DPMO', estado: 'atencion', texto: `${nombreRef}: ${fmtDpmo(ref.dpmo)} DPMO; mejora frente a A, pero queda por encima de la meta de ${fmtDpmo(e.meta)}.` }
                : { nombre: 'Meta de DPMO', estado: 'critico', texto: `${nombreRef}: ${fmtDpmo(ref.dpmo)} DPMO, por encima de la meta de ${fmtDpmo(e.meta)}.` }
          );
        }
        if (okA && okB) {
          semaforos.push(
            mB.dpmo < mA.dpmo
              ? { nombre: 'Cambio A → B', estado: 'cumple', texto: `El DPMO bajó ${pct((mA.dpmo - mB.dpmo) / mA.dpmo, 1)}.` }
              : mB.dpmo === mA.dpmo
                ? { nombre: 'Cambio A → B', estado: 'informativo', texto: 'El DPMO no cambió.' }
                : { nombre: 'Cambio A → B', estado: 'critico', texto: `El DPMO subió ${pct((mB.dpmo - mA.dpmo) / mA.dpmo, 1)}.` }
          );
        }
        semaforos.push(
          ref.dpmo <= 3.4
            ? { nombre: 'Estándar Six Sigma', estado: 'cumple', texto: 'Está en 3.4 DPMO o menos.' }
            : { nombre: 'Estándar Six Sigma', estado: 'informativo', texto: `Estándar: 3.4 DPMO; ${nombreRef} está ${num(ref.dpmo / 3.4, 1)} veces por encima.` }
        );
        const pocos = [okA ? A.defectos : Infinity, okB ? B.defectos : Infinity].some((x) => x < 5);
        semaforos.push(
          pocos
            ? { nombre: 'Defectos observados', estado: 'atencion', texto: 'Menos de 5 defectos en algún escenario: el DPMO es una estimación muy ruidosa (referencia didáctica).' }
            : { nombre: 'Defectos observados', estado: 'cumple', texto: 'Cada escenario reúne 5 defectos o más (referencia didáctica).' }
        );
      }

      /* ---- umbral y supuesto dinámicos ---- */
      const activo = ref && Number.isFinite(ref.sigma) ? NIVELES.find((n) => ref.sigma >= n) : undefined;
      const umbral = { ...UMBRAL, filas: UMBRAL.filas.map((f, i) => ({ ...f, activa: NIVELES[i] === activo })) };
      const supuesto = {
        ...SUPUESTO,
        estado: semaforos.some((s) => s.nombre === 'Defectos observados' && s.estado === 'atencion') ? 'atencion' : 'informativo',
        detalle: 'Si cambias la definición de «oportunidad», el DPMO cambia sin que el proceso cambie: fíjala antes de comparar.',
      };

      /* ---- gráfica ---- */
      const puntos = [];
      if (okA && mA.dpmo > 0 && mA.dpo < 1) puntos.push({ nombre: 'A (antes)', dpmo: mA.dpmo });
      if (okB && mB.dpmo > 0 && mB.dpo < 1) puntos.push({ nombre: 'B (después)', dpmo: mB.dpmo });
      const grafica = GENERADORES['sigma-dpmo']({ desplazamiento: d, puntos });
      const graficas = [{ id: 'sigma-dpmo', titulo: 'DPMO frente a nivel sigma', ancha: true, alta: true, ...grafica }];

      /* ---- tabla de métricas ---- */
      const celda = (m, ok, fn) => ({ texto: ok ? fn(m) : '—', num: true, formula: true });
      const fila = (nombre, fn) => [nombre, celda(mA, okA, fn), celda(mB, okB, fn)];
      const tablas = [
        {
          titulo: 'Métricas por escenario',
          columnas: ['Métrica', { t: 'A (antes)', num: true }, { t: 'B (después)', num: true }],
          filas: [
            fila('DPU = defectos ÷ unidades', (m) => cifras(m.dpu, 3)),
            fila('DPO = defectos ÷ (unidades × oportunidades)', (m) => cifras(m.dpo, 3)),
            fila('DPMO = DPO × 1,000,000', (m) => fmtDpmo(m.dpmo)),
            fila('Rendimiento = 1 − DPO', (m) => rendimiento(m.rendimiento)),
            fila('Rendimiento de primera pasada = e^(−DPU)', (m) => pct(m.primeraPasada, 2)),
            fila('Z de largo plazo = NORMSINV(1 − DPO)', (m) => num(m.z, 2)),
            fila(`Nivel sigma = Z + ${num(d, 1)}`, (m) => num(m.sigma, 2)),
          ],
          pie: 'La plantilla Excel «DPMO y Sigma» usa la misma convención. La guía redondea 162.5 DPMO a 162.',
        },
      ];

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
