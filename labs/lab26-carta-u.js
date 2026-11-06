/**
 * LAB 26 · Carta de control u
 *
 * Guía: M10 §3 (carta de atributos u: el DPMO semanal antes y después de la mejora; recalcular la línea central desde la semana 9) y
 * ejercicio 2 (ū = 0.006, n = 7,200 y 12 defectos) · plantilla Excel «Carta u» (25 periodos con unidades variables).
 *   La carta u vigila los defectos por unidad (o por oportunidad de defecto) cuando el tamaño de lo inspeccionado cambia de un periodo
 *   a otro, así que cada periodo tiene sus propios límites:
 *     ū = Σc ÷ Σn      LSC = ū + 3·√(ū/n)      LIC = máx[0, ū − 3·√(ū/n)]
 *   con c los defectos del periodo y n su área de oportunidad (unidades × oportunidades por unidad). Con una oportunidad por unidad es
 *   la plantilla de Excel; con 5 y los resultados en DPMO, la carta de la guía.
 *   Reglas de la guía: 1 periodo fuera de ±3σ; 2 de 3 más allá de 2σ del mismo lado; 9 seguidos del mismo lado de la línea central (σ de
 *   cada periodo = √(ū/n)). La plantilla de Excel solo cuenta los periodos fuera de límites (regla 1): el laboratorio deja elegir.
 *   Dos decisiones que la guía distingue: si el proceso cambió a propósito (el poka-yoke y la instrucción actualizada), se calcula una
 *   línea central y límites nuevos desde ese periodo en lugar de extender los anteriores; si una señal viene de una causa especial ya
 *   corregida, se excluye ese periodo y se recalcula. Y una señal hacia abajo (menos defectos) también es señal: se investiga para
 *   estandarizar, no para corregir (ejercicio 2).
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: guía (16 semanas, DPMO, línea nueva desde la 9), la misma guía con una sola línea central (el error que advierte), plantilla
 * Excel (25 periodos, solo la regla 1) y ejercicio 2 (ū histórico). IMPORTANTE: la guía publica la carta u del M10 §3 solo como imagen,
 * sin las cuentas de cada semana. Los conteos semanales de los presets «guía» son una RECONSTRUCCIÓN DIDÁCTICA que respeta lo que el
 * texto sí dice: 16 semanas de unas 2,000 unidades con 5 oportunidades cada una; 25 defectos en las 8 semanas de «antes» (312.5 DPMO,
 * «312» en la guía) y 13 en las 8 de «después» (162.5 DPMO, «162»; son los 13 defectos y 16,000 unidades del caso); y ninguna semana
 * fuera de límites dentro de su propia fase.
 */
import { COLOR } from '../js/core/config.js';
import { cifras, conSigno, dpmo, entero, plural } from '../js/core/format.js';
import { cartaU, leerSubgrupos, resumenPeriodos, textoSenales } from '../js/lib/controlar.js';

const UB = 'ū'; // ū: defectos por unidad (u) promedio, la línea central
const MAX_PERIODOS = 30;
const MILLON = 1e6;

const limpio = (t) => String(t ?? '').replace(/[<>]/g, '');
const fmt = (x, escala) => (escala === 'dpmo' ? dpmo(x * MILLON) : cifras(x, 3));
const listaCitada = (nombres, max = 4) => {
  const citados = nombres.slice(0, max);
  if (nombres.length > max) citados.push(`${nombres.length - max} más`);
  return citados.length > 1 ? `${citados.slice(0, -1).join(', ')} y ${citados[citados.length - 1]}` : citados[0] ?? '';
};
const periodosTexto = (indices) => (indices.length === 1 ? `el periodo ${indices[0]}` : `los periodos ${listaCitada(indices.map(String), 6)}`);
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const sinCeros = (t) => (t.includes('.') ? t.replace(/0+$/, '').replace(/\.$/, '') : t);

/** Agrupa los puntos con señal que comparten texto: «los periodos 15 y 16 (regla 3, abajo de la línea central)». */
function citasAgrupadas(puntos) {
  const grupos = new Map();
  for (const p of puntos) {
    const t = textoSenales(p.senales, p.u, p);
    if (!grupos.has(t)) grupos.set(t, []);
    grupos.get(t).push(p.indice);
  }
  return [...grupos].map(([t, indices]) => `${periodosTexto(indices)} (${t})`);
}

/* ------------------------------------------------------------------ datos ------------------------------------------------------------------ */

// Plantilla Excel «Carta u»: 25 periodos con defectos (c) y unidades (n); el 17 (26 defectos en 40 unidades) es la señal del ejemplo.
const EXCEL_C = [14, 13, 12, 10, 11, 16, 7, 17, 11, 18, 16, 15, 16, 13, 16, 13, 26, 15, 17, 14, 14, 12, 10, 14, 13];
const EXCEL_N = [44, 42, 43, 37, 42, 42, 34, 39, 37, 44, 45, 43, 43, 44, 39, 41, 40, 34, 38, 41, 42, 44, 35, 44, 40];
const EXCEL_PERIODOS = EXCEL_C.map((defectos, i) => ({ defectos, unidades: EXCEL_N[i] }));

// Guía M10 §3: RECONSTRUCCIÓN DIDÁCTICA (la guía no publica las cuentas semanales). 8 semanas de «antes» con 25 defectos y 8 de «después»
// con 13, de 2,000 arneses con 5 oportunidades cada semana.
const GUIA_ANTES = [3, 4, 2, 5, 3, 4, 2, 2];
const GUIA_DESPUES = [2, 1, 2, 1, 2, 2, 1, 2];
const GUIA_PERIODOS = [...GUIA_ANTES, ...GUIA_DESPUES].map((defectos) => ({ defectos, unidades: 2000 }));
const filasVacias = (k) => Array.from({ length: k }, () => ({}));

// Todas las entradas, en este orden (escala y oportunidades antes que la tabla, cuyas columnas calculadas dependen de ellas).
const BASE = { escala: 'u', oportunidades: 1, periodos: filasVacias(5), centro: 'datos', ubarDado: NaN, desde: NaN, excluir: '', reglas: 'tres' };

/* ------------------------------------------------------------------ textos ------------------------------------------------------------------ */

const umbralDe = (activas = new Set()) => ({
  titulo: 'Cómo se lee una carta u',
  filas: [
    { rango: `${UB} y los límites`, texto: `${UB} = Σc ÷ Σn (defectos totales entre oportunidades totales). LSC = ${UB} + 3·√(${UB}/n) y LIC = máx[0, ${UB} − 3·√(${UB}/n)]: la banda se ensancha en los periodos con menos unidades (guía M10 §3 y plantilla «Carta u»).` },
    { rango: 'Regla 1', texto: 'Un periodo cae fuera de los límites de control (±3σ). Es la única regla que cuenta la plantilla de Excel.', activa: activas.has(1) },
    { rango: 'Regla 2', texto: `Dos de tres periodos consecutivos caen más allá de 2σ, del mismo lado de la línea central. Aquí σ = √(${UB}/n) de cada periodo.`, activa: activas.has(2) },
    { rango: 'Regla 3', texto: 'Nueve periodos consecutivos caen del mismo lado de la línea central: un cambio sostenido que ningún punto individual delata (guía M10 §2, ejercicio 3).', activa: activas.has(3) },
    {
      rango: 'Dirección de la señal',
      texto: 'Arriba hay más defectos de lo habitual y abajo, menos. Las reglas no distinguen «malo» de «bueno»: una señal hacia abajo también se investiga, pero para entender qué se hizo distinto y estandarizarlo si es replicable, no para corregirlo (guía M10, ejercicio 2).',
    },
    {
      rango: 'Nueva línea central',
      texto: 'Si el proceso cambió a propósito (el poka-yoke y la instrucción actualizada), calcula una línea central y límites nuevos desde ese periodo: extender la línea de «antes» es un error común (guía M10 §3 y «Errores comunes»). Si la señal viene de una causa especial ya corregida, se excluye ese periodo y se recalcula.',
    },
    { rango: 'LIC = 0', texto: `Con pocos defectos esperados por periodo, ${UB} − 3·√(${UB}/n) sale negativo y el LIC se corta en 0: ningún periodo puede salir por abajo. Una mejora se ve entonces con la regla 3 (nueve periodos seguidos bajo la línea central) más que con un punto aislado.` },
  ],
});

const SUPUESTO = {
  titulo: 'Supuesto del método',
  texto:
    'Los defectos se cuentan en periodos comparables y cada oportunidad de defecto es independiente de las demás, de modo que el conteo se comporta aproximadamente como una distribución de Poisson, que es la base de la carta u. ' +
    'Los límites de ±3σ son una aproximación normal: funciona mal cuando se esperan muy pocos defectos por periodo (por eso el LIC se corta en 0). ' +
    'La carta muestra si cada fase es estable; no prueba que la diferencia entre dos fases sea estadísticamente significativa ni que el cambio sea una mejora: eso descansa en que el cambio fue deliberado y está documentado. ' +
    'Y una señal no confirma por sí sola una causa: hay que investigarla (5 Porqués, LAB 16).',
  estado: 'informativo',
};

/* ------------------------------------------------------------------ gráfica ------------------------------------------------------------------ */

/** Línea escalonada por fases: cada periodo ocupa de i − 0.5 a i + 0.5 con su propio valor; un hueco separa una fase de otra. */
function pasos(puntos, valorDe) {
  const x = [];
  const y = [];
  let faseActual = null;
  for (const p of puntos) {
    if (faseActual !== null && p.fase !== faseActual) {
      x.push(null);
      y.push(null);
    }
    faseActual = p.fase;
    x.push(p.indice - 0.5, p.indice + 0.5);
    y.push(valorDe(p), valorDe(p));
  }
  return { x, y };
}

/** Línea central: una recta por fase, con un hueco entre ellas. */
function centrales(puntos, factor) {
  const x = [];
  const y = [];
  const fases = [...new Set(puntos.map((p) => p.fase))];
  fases.forEach((id, i) => {
    const de = puntos.filter((p) => p.fase === id);
    if (i > 0) {
      x.push(null);
      y.push(null);
    }
    x.push(de[0].indice - 0.5, de[de.length - 1].indice + 0.5);
    y.push(de[0].cl * factor, de[0].cl * factor);
  });
  return { x, y };
}

function graficaU({ puntos, primera, fx, factor, escala, conZonas, etiquetaCentro, dosFases, constante }) {
  const xs = puntos.map((p) => p.indice);
  const x0 = Math.min(...xs) - 0.5;
  const x1 = Math.max(...xs) + 0.5;
  const nombreU = escala === 'dpmo' ? 'DPMO' : 'u';
  const hover = puntos.map((p) => [
    `<b>Periodo ${p.indice}</b>`,
    `c = ${entero(p.c)} · n = ${entero(p.n)}`,
    `${nombreU} = ${fx(p.u)}`,
    `LIC ${fx(p.lic)} · LSC ${fx(p.lsc)}`,
    p.excluido ? 'Excluido del cálculo de ū' : p.senales.length ? `Señal: ${textoSenales(p.senales, p.u, p)}` : 'En control',
  ].join('<br>'));
  const datos = [];
  if (primera) {
    const ls = pasos(primera, (p) => p.lsc * factor);
    const li = pasos(primera, (p) => p.lic * factor);
    datos.push({
      type: 'scatter', mode: 'lines', name: 'Límites con todos los periodos', x: [...ls.x, null, ...li.x], y: [...ls.y, null, ...li.y], connectgaps: false,
      line: { color: COLOR.violeta, width: 1.4, dash: 'dot' }, hoverinfo: 'skip',
    });
  }
  if (conZonas) {
    const arriba = pasos(puntos, (p) => (p.cl + 2 * p.sigma) * factor);
    const abajo = pasos(puntos, (p) => Math.max(0, p.cl - 2 * p.sigma) * factor);
    datos.push({
      type: 'scatter', mode: 'lines', name: 'Zonas ±2σ (regla 2)', x: [...arriba.x, null, ...abajo.x], y: [...arriba.y, null, ...abajo.y], connectgaps: false,
      line: { color: COLOR.gris, width: 1, dash: 'dot' }, opacity: 0.7, hoverinfo: 'skip',
    });
  }
  const lsc = pasos(puntos, (p) => p.lsc * factor);
  const lic = pasos(puntos, (p) => p.lic * factor);
  const valoresUnicos = (clave) => [...new Set(puntos.map((p) => p[clave].toPrecision(12)))];
  const nombreLimite = (clave, texto) => (constante && !dosFases && valoresUnicos(clave).length === 1 ? `${texto} ${fx(puntos[0][clave])}` : `${texto}${dosFases ? ' (por fase)' : constante ? '' : ' (cambia con n)'}`);
  datos.push({ type: 'scatter', mode: 'lines', name: nombreLimite('lsc', 'LSC'), ...lsc, connectgaps: false, line: { color: COLOR.coral, width: 1.6, dash: 'dash' }, hoverinfo: 'skip' });
  datos.push({ type: 'scatter', mode: 'lines', name: nombreLimite('lic', 'LIC'), ...lic, connectgaps: false, line: { color: COLOR.coral, width: 1.6, dash: 'dash' }, hoverinfo: 'skip' });
  datos.push({ type: 'scatter', mode: 'lines', name: etiquetaCentro, ...centrales(puntos, factor), connectgaps: false, line: { color: COLOR.ambar, width: 1.5 }, hoverinfo: 'skip' });
  datos.push({
    type: 'scatter', mode: 'lines+markers', name: nombreU, x: xs, y: puntos.map((p) => p.u * factor), line: { color: COLOR.teal, width: 1.6 },
    marker: { color: COLOR.teal, size: 7, line: { color: '#0a1011', width: 1 } }, customdata: hover, hovertemplate: '%{customdata}<extra></extra>',
  });
  const conSenal = puntos.filter((p) => !p.excluido && p.senales.length);
  if (conSenal.length) {
    datos.push({
      type: 'scatter', mode: 'markers', name: 'Señal de causa especial', x: conSenal.map((p) => p.indice), y: conSenal.map((p) => p.u * factor),
      marker: { symbol: 'diamond', size: 12, color: COLOR.coral, line: { color: '#0a1011', width: 1 } }, customdata: conSenal.map((p) => hover[puntos.indexOf(p)]), hovertemplate: '%{customdata}<extra></extra>',
    });
  }
  const excluidos = puntos.filter((p) => p.excluido);
  if (excluidos.length) {
    datos.push({
      type: 'scatter', mode: 'markers', name: 'Excluido (causa corregida)', x: excluidos.map((p) => p.indice), y: excluidos.map((p) => p.u * factor),
      marker: { symbol: 'circle-open', size: 13, color: COLOR.blanco, line: { width: 2 } }, customdata: excluidos.map((p) => hover[puntos.indexOf(p)]), hovertemplate: '%{customdata}<extra></extra>',
    });
  }
  const k = Math.max(...xs);
  return {
    id: 'carta-u', titulo: escala === 'dpmo' ? 'Carta u: DPMO de cada periodo, con la línea central y los límites de su fase' : 'Carta u: defectos por unidad de cada periodo, con límites propios', ancha: true, alta: true,
    datos,
    layout: {
      xaxis: { title: { text: 'Periodo' }, range: [x0, x1], tick0: 0, dtick: k > 20 ? 5 : 1, zeroline: false },
      yaxis: { title: { text: escala === 'dpmo' ? 'DPMO' : 'Defectos por unidad (u = c ÷ n)' }, rangemode: 'tozero', zeroline: false },
      margin: { l: 70, r: 24, t: 40, b: 52 },
    },
    respaldo: {
      columnas: ['Periodo', 'c', 'n', nombreU, 'LIC', etiquetaCentro, 'LSC', 'Estado'],
      filas: puntos.map((p) => [
        String(p.indice), entero(p.c), entero(p.n), fx(p.u), fx(p.lic), fx(p.cl), fx(p.lsc),
        p.excluido ? 'excluido' : p.senales.length ? textoSenales(p.senales, p.u, p) : 'en control',
      ]),
    },
  };
}

/* ------------------------------------------------------------------ laboratorio ------------------------------------------------------------------ */

export default function lab26() {
  const presets = [
    {
      id: 'guia', etiqueta: 'Guía M10 §3: 16 semanas de DPMO, línea nueva desde la 9 (conteos reconstruidos)',
      ayuda: `Las 16 semanas de la guía —8 de antes y 8 de después de la mejora— con unas 2,000 unidades y 5 oportunidades por unidad. OJO: la guía publica la carta solo como imagen; los conteos semanales de este ejemplo son una reconstrucción didáctica que respeta lo que el texto dice (25 defectos antes = 312.5 DPMO, 13 después = 162.5 DPMO, ninguna semana fuera de límites). La línea central cambia en la semana 9 porque el poka-yoke y la instrucción actualizada son un cambio deliberado del proceso.`,
      valores: { ...BASE, escala: 'dpmo', oportunidades: 5, periodos: GUIA_PERIODOS, desde: 9 },
    },
    {
      id: 'guia-una-linea', etiqueta: 'Guía M10 §3 con una sola línea central (el error que advierte la guía)',
      ayuda: 'Los mismos conteos reconstruidos, pero con una sola línea central para las 16 semanas, como si la mejora no hubiera sido deliberada. Las últimas semanas quedan seguidas bajo una línea que ya no las describe y la regla 3 las marca: es el error de «extender la línea de antes» de la sección «Errores comunes». Compáralo con el preset anterior.',
      valores: { ...BASE, escala: 'dpmo', oportunidades: 5, periodos: GUIA_PERIODOS },
    },
    {
      id: 'excel', etiqueta: 'Plantilla Excel «Carta u»: 25 periodos con unidades distintas (solo la regla 1)',
      ayuda: `Los 25 periodos de la hoja, con la regla que ella aplica: ${UB} = 0.347 y un punto fuera, el periodo 17 (26 defectos en 40 unidades, u = 0.65 sobre su LSC de 0.627). Los límites cambian de periodo a periodo porque n cambia. Escribe 17 en «Periodos que se excluyen» para recalcular, o cambia a «las tres reglas» para ver si las reglas 2 y 3 encuentran algo más (aquí no).`,
      valores: { ...BASE, periodos: EXCEL_PERIODOS, reglas: 'una' },
    },
    {
      id: 'ej2', etiqueta: `Guía M10, ejercicio 2: ${UB} = 0.006, n = 7,200 y 12 defectos`,
      ayuda: `Con un ${UB} histórico de 0.006 y una semana de 1,800 unidades con 4 oportunidades cada una (n = 7,200) que registra 12 defectos: LSC = 0.00874 y LIC = 0.00326. Con u = 12 ÷ 7,200 = 0.00167 el punto cae bajo el LIC: «fuera de control» en la dirección deseable. La guía llama «DPU» a 0.006 pero lo usa como defectos por oportunidad (n = 7,200 son las oportunidades).`,
      valores: { ...BASE, oportunidades: 4, periodos: [{ defectos: 12, unidades: 1800 }], centro: 'dado', ubarDado: 0.006 },
    },
  ];

  const oportunidadesDe = (estado) => (Number.isInteger(estado.oportunidades) && estado.oportunidades >= 1 ? estado.oportunidades : 1);
  const filaValida = (fila) => Number.isInteger(fila.defectos) && fila.defectos >= 0 && Number.isFinite(fila.unidades) && fila.unidades > 0;

  return {
    id: 'lab26',
    numero: '26',
    modulo: 'M10',
    titulo: 'Carta de control u',
    resumen: 'Construye una carta u: defectos por unidad (o el DPMO semanal) con tamaño de muestra variable, límites propios para cada periodo, las tres reglas de causas especiales y una línea central nueva cuando el proceso cambia a propósito.',
    panelAncho: true,
    entradas: [
      {
        id: 'escala', tipo: 'opcion', etiqueta: 'Mostrar los resultados como', valor: 'dpmo',
        opciones: [
          { valor: 'u', texto: 'Defectos por unidad u oportunidad (u = c ÷ n)', ayuda: 'Como la plantilla de Excel: con una oportunidad por unidad, u son los defectos por unidad (DPU).' },
          { valor: 'dpmo', texto: 'DPMO (defectos por millón de oportunidades)', ayuda: 'Como la carta de la guía: u × 1,000,000.' },
        ],
      },
      {
        id: 'oportunidades', tipo: 'numero', etiqueta: 'Oportunidades de defecto por unidad', valor: 5, min: 1, ancho: '110px',
        ayuda: 'Cuántas cosas pueden salir mal en cada unidad. La guía usa 5; la plantilla de Excel cuenta defectos por unidad (1). El área de oportunidad de cada periodo es unidades × este número.',
      },
      {
        id: 'periodos', tipo: 'tabla', etiqueta: 'Defectos y unidades de cada periodo (una fila por periodo)',
        columnas: (estado) => [
          { id: 'defectos', etiqueta: 'Defectos (c)', tipo: 'numero', min: 0, ancho: '104px', ayuda: 'Defectos contados en el periodo: un entero de 0 en adelante.' },
          { id: 'unidades', etiqueta: 'Unidades', tipo: 'numero', min: 0, ancho: '104px', ayuda: 'Unidades inspeccionadas en el periodo. Pueden cambiar de un periodo a otro: los límites se ajustan.' },
          {
            id: 'n', etiqueta: 'n (oportunidades)', tipo: 'fijo', ancho: '116px', ayuda: 'Área de oportunidad del periodo: unidades × oportunidades por unidad.',
            texto: (est, fila) => (filaValida(fila) ? entero(fila.unidades * oportunidadesDe(est)) : ''),
          },
          {
            id: 'u', etiqueta: estado.escala === 'dpmo' ? 'DPMO' : 'u = c ÷ n', tipo: 'fijo', ancho: '96px', ayuda: 'Defectos del periodo entre su área de oportunidad.',
            texto: (est, fila) => (filaValida(fila) ? fmt(fila.defectos / (fila.unidades * oportunidadesDe(est)), est.escala === 'dpmo' ? 'dpmo' : 'u') : ''),
          },
        ],
        filas: GUIA_PERIODOS, filaNueva: { defectos: NaN, unidades: NaN }, minFilas: 1, maxFilas: MAX_PERIODOS, filasVacias: 5, etiquetaAgregar: '+ Periodo',
        ayuda: `Hasta ${MAX_PERIODOS} periodos (la plantilla trae 25). Ejemplo: las 16 semanas de la guía M10 §3 con conteos reconstruidos (la guía publica la carta solo como imagen). Un periodo cuenta si tiene defectos (un entero ≥ 0) y unidades (> 0).`,
      },
      {
        id: 'centro', tipo: 'opcion', etiqueta: `Línea central (${UB})`, valor: 'datos',
        opciones: [
          { valor: 'datos', texto: 'Calcularla con los datos de la tabla', ayuda: `${UB} = Σc ÷ Σn de los periodos de cada fase.` },
          { valor: 'dado', texto: `Usar un ${UB} histórico que ya conozco`, ayuda: 'Como el ejercicio 2 de la guía: el ū viene de la historia del proceso y la tabla solo trae los periodos por evaluar.' },
        ],
      },
      {
        id: 'ubarDado', tipo: 'numero', etiqueta: `${UB} histórico (en la escala elegida)`, visibleSi: (e) => e.centro === 'dado', min: 0, ancho: '130px',
        ayuda: 'En la escala de arriba: 0.006 defectos por unidad u oportunidad, o 6,000 DPMO. Debe ser mayor que 0.',
      },
      {
        id: 'desde', tipo: 'numero', etiqueta: 'Fila donde empieza la segunda fase (línea central nueva)', visibleSi: (e) => e.centro !== 'dado', valor: 9, min: 2, ancho: '130px',
        ayuda: 'Si el proceso cambió a propósito (la mejora), escribe el número de fila del primer periodo «después»: cada fase tendrá su propia línea central y sus límites. Déjalo vacío para una sola línea central con todos los periodos. La guía usa la semana 9.',
      },
      {
        id: 'excluir', tipo: 'texto', etiqueta: 'Periodos que se excluyen (con su causa especial ya corregida)', visibleSi: (e) => e.centro !== 'dado', valor: '', marcador: 'Por ejemplo: 17 o 5, 17',
        ayuda: 'Números de periodo separados por comas. Se excluyen del cálculo de ū y de los límites, no de la gráfica. Déjalo vacío para calcular con todos. Excluye solo lo que ya tiene causa identificada y corregida.',
      },
      {
        id: 'reglas', tipo: 'opcion', etiqueta: 'Reglas de causas especiales', valor: 'tres',
        opciones: [
          { valor: 'tres', texto: 'Las tres reglas de la guía', ayuda: 'Regla 1 (fuera de ±3σ), regla 2 (dos de tres más allá de 2σ) y regla 3 (nueve seguidos del mismo lado).' },
          { valor: 'una', texto: 'Solo la regla 1 (como la plantilla de Excel)', ayuda: 'Solo cuenta los periodos fuera de los límites de control, que es lo que hace la hoja «Carta u».' },
        ],
      },
    ],
    presets,
    umbral: umbralDe(),
    supuesto: SUPUESTO,
    preguntas: [
      'Con el preset de la guía, borra «Fila donde empieza la segunda fase»: ¿qué regla se dispara y en qué semanas? ¿Por qué esa señal no es una causa especial que haya que investigar sino el resultado de dejar una sola línea central después de una mejora deliberada?',
      'En las dos fases del ejemplo el LIC vale 0. ¿Qué dice eso sobre lo que esta carta puede detectar con tan pocos defectos por semana? Si quisieras un LIC mayor que 0, ¿cuántos defectos esperarías por periodo? Pruébalo subiendo las unidades o las oportunidades.',
      'En el ejercicio 2 de la guía, la semana con 12 defectos sale bajo el LIC. ¿Qué haría el equipo: celebrar, corregir algo o investigar? ¿Por qué la regla 1 no distingue entre «bueno» y «malo» y qué debería hacerse con esa señal?',
      'Con el preset de la plantilla, el periodo 17 sale (26 defectos en 40 unidades). ¿Qué necesitarías saber para excluirlo? ¿Qué le pasa a ū y a los límites si lo excluyes sin haber encontrado una causa?',
      'La línea central baja de 312.5 a 162.5 DPMO (−48 %) y la guía reporta −46 %. ¿De dónde sale la diferencia? ¿Qué comparación es más honesta para decirle a un gerente cuánto mejoró el proceso, y por qué una carta de control no basta para afirmar que la mejora es real?',
    ],

    calcular(e) {
      const aviso = [];
      const escala = e.escala === 'u' ? 'u' : 'dpmo';
      const factor = escala === 'dpmo' ? MILLON : 1;
      const fx = (x) => fmt(x, escala);
      const reglas = e.reglas === 'una' ? [1] : [1, 2, 3];
      const centro = e.centro === 'dado' ? 'dado' : 'datos';
      const descripcionReglas = reglas.length === 1 ? 'regla 1' : 'reglas 1, 2 y 3';
      const oportunidadesValidas = Number.isInteger(e.oportunidades) && e.oportunidades >= 1;
      const oportunidades = oportunidadesValidas ? e.oportunidades : 1;
      if (!oportunidadesValidas) aviso.push('Las oportunidades de defecto por unidad deben ser un entero de 1 en adelante: se usó 1.');
      const sinDatos = (texto) => ({
        aviso, umbral: umbralDe(), supuesto: SUPUESTO, vacio: texto,
        semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Faltan datos para calcular los límites.' }],
      });

      const { periodos, invalidas } = resumenPeriodos(e.periodos, oportunidades);
      if (invalidas) {
        aviso.push(`${plural(invalidas, 'fila')} sin defectos (un entero ≥ 0) o sin unidades (mayores que 0): ${invalidas === 1 ? 'se ignoró' : 'se ignoraron'}.`);
      }
      if (!periodos.length) return sinDatos('Captura al menos un periodo con sus defectos y las unidades que se inspeccionaron.');
      if (centro === 'datos' && periodos.length < 2) return sinDatos(`Captura al menos dos periodos para calcular la línea central con los datos (o usa un ${UB} histórico).`);

      let dado = NaN;
      if (centro === 'dado') {
        dado = e.ubarDado / factor;
        if (!(Number.isFinite(dado) && dado > 0)) return sinDatos(`Captura el ${UB} histórico, mayor que 0, ${escala === 'dpmo' ? 'en DPMO' : 'en defectos por unidad u oportunidad'}.`);
      }
      const leidos = centro === 'datos' ? leerSubgrupos(e.excluir) : { indices: [], ignoradas: [] };
      if (leidos.ignoradas.length) aviso.push(`No se entendió «${limpio(leidos.ignoradas.join(' '))}» en los periodos que se excluyen: escribe números de periodo separados por comas (por ejemplo «5, 17»).`);

      const c = cartaU(periodos, { desde: centro === 'datos' ? e.desde : NaN, excluir: leidos.indices, dado, reglas });
      if (!c.valido) {
        return sinDatos(c.motivo === 'fase-excluida'
          ? 'Excluiste todos los periodos de una de las dos fases: deja al menos uno en cada una.'
          : 'Excluiste todos los periodos: deja al menos uno para calcular la línea central.');
      }
      if (c.sinEncontrar.length) aviso.push(`Periodos por excluir que no existen o no tienen datos completos (se ignoraron): ${c.sinEncontrar.join(', ')}.`);
      if (centro === 'datos' && Number.isFinite(e.desde) && c.corte === null) {
        aviso.push('La fila donde empieza la segunda fase debe ser un entero entre 2 y el último periodo, y dejar datos en las dos fases: se calculó con una sola línea central.');
      }

      const f = c.final;
      const fases = f.fases;
      const dosFases = fases.length === 2;
      const hayExclusion = c.excluidos.length > 0;
      const conSenal = f.puntos.filter((p) => p.senales.length);
      const reglasActivas = new Set(conSenal.flatMap((p) => p.senales));
      const usables = f.puntos.filter((p) => !p.excluido);
      const nVarios = new Set(usables.map((p) => p.n)).size > 1;
      const rangoDe = (puntos, clave) => {
        const v = puntos.filter((p) => !p.excluido).map((p) => p[clave]);
        const a = Math.min(...v);
        const b = Math.max(...v);
        return Math.abs(b - a) <= 1e-12 * Math.max(1, Math.abs(b)) ? fx(a) : `${fx(a)} a ${fx(b)}`;
      };
      const unidad = escala === 'dpmo' ? 'DPMO' : 'u';
      const nMin = Math.min(...usables.map((p) => p.n));
      const nMax = Math.max(...usables.map((p) => p.n));
      const nTexto = nMin === nMax ? `n = ${entero(nMin)}` : `n entre ${entero(nMin)} y ${entero(nMax)}`;

      /* ---- salidas ---- */
      const salidas = [{
        id: 'periodos', etiqueta: 'Periodos usados', valor: `${entero(c.usados)} de ${entero(c.total)}`, color: 'teal',
        nota: [dosFases ? `fase 1: ${fases[0].usados} · fase 2: ${fases[1].usados}` : null, hayExclusion ? `sin ${periodosTexto(c.excluidos)}` : null, !dosFases && !hayExclusion ? nTexto : null].filter(Boolean).join(' · '),
      }];
      fases.forEach((fase, i) => {
        const puntos = f.puntos.filter((p) => p.fase === fase.id);
        const sufijo = dosFases ? ` · fase ${fase.id}` : '';
        const id = (base) => (i === 0 ? base : `${base}${i + 1}`);
        salidas.push({
          id: id('ubar'), etiqueta: `${UB}${dosFases ? sufijo : c.dado ? ' (histórico)' : ' (línea central)'}`, valor: c.dado ? sinCeros(fx(fase.ubar)) : fx(fase.ubar), color: 'azul',
          nota: c.dado ? 'no se calcula con estos datos' : `Σc ÷ Σn = ${entero(fase.c)} ÷ ${entero(fase.n)}${dosFases ? ` · periodos ${fase.desde} a ${fase.hasta}` : ''}`,
        });
        salidas.push({ id: id('lsc'), etiqueta: `LSC${sufijo}`, valor: rangoDe(puntos, 'lsc'), color: 'coral', nota: `${UB} + 3·√(${UB}/n)${nVarios ? ' · cambia con n' : ''}` });
        salidas.push({
          id: id('lic'), etiqueta: `LIC${sufijo}`, valor: rangoDe(puntos, 'lic'), color: 'coral',
          nota: puntos.every((p) => p.lic === 0) ? 'se corta en 0: máx[0, …]' : `máx[0, ${UB} − 3·√(${UB}/n)]${nVarios ? ' · cambia con n' : ''}`,
        });
      });
      if (dosFases) {
        const [a, b] = fases;
        salidas.push({
          id: 'cambio', etiqueta: 'Cambio de la línea central', valor: a.ubar > 0 ? `${conSigno(((b.ubar - a.ubar) / a.ubar) * 100, 0)} %` : '—', color: 'verde',
          nota: `de ${fx(a.ubar)} a ${fx(b.ubar)}${escala === 'dpmo' ? ' DPMO' : ''}`,
        });
      }
      if (c.usados === 1 && f.puntos.length === 1) {
        salidas.push({ id: 'u', etiqueta: `${unidad} del periodo`, valor: fx(f.puntos[0].u), color: 'teal', nota: `${entero(f.puntos[0].c)} ÷ ${entero(f.puntos[0].n)}` });
      }
      salidas.push({
        id: 'senales', etiqueta: 'Periodos con señal', valor: String(conSenal.length), color: conSenal.length ? 'coral' : 'verde',
        nota: conSenal.length ? listaCitada(citasAgrupadas(conSenal), 2) : `${descripcionReglas}: sin señales`,
      });

      /* ---- semáforos ---- */
      const semaforos = [];
      if (!conSenal.length) {
        semaforos.push({
          nombre: 'Carta u (estabilidad)', estado: 'cumple',
          texto: `Ningún periodo da señal (${descripcionReglas}): ${dosFases ? 'cada fase es estable' : 'el proceso es estable'} y la variación entre periodos es la que se espera con estos límites.`,
        });
      } else {
        const arriba = conSenal.filter((p) => p.u > p.cl);
        const abajo = conSenal.filter((p) => p.u < p.cl);
        const partes = [];
        if (arriba.length) partes.push(`${mayuscula(listaCitada(citasAgrupadas(arriba)))}: más defectos de lo habitual. Una señal no confirma por sí sola una causa: investiga (5 Porqués, LAB 16) antes de decidir`);
        if (abajo.length) partes.push(`${mayuscula(listaCitada(citasAgrupadas(abajo)))}: menos defectos de lo habitual, la dirección deseable. No hay nada que corregir: investiga qué se hizo distinto y, si es replicable, estandarízalo (guía M10, ejercicio 2)`);
        const sugerencia = !dosFases && !c.dado && conSenal.some((p) => p.senales.includes(3))
          ? ' Si en esos periodos hubo un cambio deliberado del proceso, empieza otra fase en el periodo del cambio con «Fila donde empieza la segunda fase»: cada fase tiene su propia línea central.'
          : '';
        semaforos.push({
          nombre: 'Carta u (estabilidad)', estado: arriba.some((p) => p.senales.includes(1)) ? 'critico' : 'atencion',
          texto: `${partes.join('. ')}.${sugerencia}${hayExclusion ? ' Con los límites ya recalculados.' : ''}`,
        });
      }
      if (dosFases) {
        const [a, b] = fases;
        const una = cartaU(periodos, { excluir: leidos.indices, reglas });
        const extras = una.valido ? una.final.puntos.filter((p) => p.senales.length) : [];
        const cambio = a.ubar > 0 ? `${conSigno(((b.ubar - a.ubar) / a.ubar) * 100, 0)} %` : 'sin cambio medible';
        const reglasExtras = [...new Set(extras.flatMap((p) => p.senales))].sort((x, y) => x - y);
        const medida = escala === 'dpmo' ? ' DPMO' : '';
        semaforos.push({
          nombre: 'Línea central nueva', estado: 'informativo',
          texto: `Los periodos ${b.desde} a ${b.hasta} tienen su propia línea central (${fx(b.ubar)} frente a ${fx(a.ubar)}${medida}: ${cambio}). Un cambio deliberado y conocido del proceso exige línea central y límites nuevos, no extender los anteriores (guía M10 §3). ` +
            (extras.length
              ? `Con una sola línea central (${fx(una.final.fases[0].ubar)}${medida}) ${extras.length === 1 ? 'saldría' : 'saldrían'} ${periodosTexto(extras.map((p) => p.indice))} (${reglasExtras.length > 1 ? 'reglas' : 'regla'} ${reglasExtras.join(' y ')}): la mejora se confundiría con una causa especial.`
              : `Con una sola línea central (${fx(una.final.fases[0].ubar)}${medida}) no aparecería ninguna señal en estos datos, pero esos límites no describirían a ninguna de las dos fases.`),
        });
      }
      if (hayExclusion) {
        const sinSenal = c.excluidos.filter((i) => {
          const p = c.primera.puntos.find((q) => q.indice === i);
          return p && !p.senales.length;
        });
        const vistoAntes = c.primera.puntos.filter((p) => p.senales.length).map((p) => `el periodo ${p.indice}`);
        semaforos.push(
          sinSenal.length
            ? {
              nombre: 'Periodos excluidos', estado: 'atencion',
              texto: `Excluiste ${periodosTexto(sinSenal)}, pero con todos los periodos no daba ninguna señal. Sin una causa especial identificada y corregida, quitar un punto solo estrecha los límites y esconde la variación real del proceso.`,
            }
            : {
              nombre: 'Periodos excluidos', estado: 'informativo',
              texto: `Con los ${c.total} periodos, la primera pasada marcaba ${vistoAntes.length ? listaCitada(vistoAntes) : 'ningún punto'}. ${UB} y los límites finales se calcularon sin ${periodosTexto(c.excluidos)}. Excluir solo corresponde si la causa ya se identificó y se corrigió; el laboratorio no puede saberlo.`,
            }
        );
      }
      if (reglas.length === 1) {
        const completo = cartaU(periodos, { desde: centro === 'datos' ? e.desde : NaN, excluir: leidos.indices, dado, reglas: [1, 2, 3] });
        const extras = completo.valido ? completo.final.puntos.filter((p) => p.senales.some((r) => r !== 1)) : [];
        semaforos.push(
          extras.length
            ? {
              nombre: 'Reglas 2 y 3 (no aplicadas)', estado: 'atencion',
              texto: `Con las tres reglas aparecerían señales que la regla 1 deja pasar: ${listaCitada(extras.map((p) => `${p.indice} (regla ${p.senales.filter((r) => r !== 1).join(' y ')})`))}. Cambia a «las tres reglas» para verlas.`,
            }
            : { nombre: 'Reglas 2 y 3 (no aplicadas)', estado: 'informativo', texto: 'Con las tres reglas no aparecería ninguna señal adicional en estos datos. La plantilla de Excel solo cuenta los periodos fuera de límites; las reglas 2 y 3 detectan cambios pequeños pero sostenidos.' }
        );
      }
      const sinLic = usables.filter((p) => p.lic === 0);
      if (sinLic.length) {
        semaforos.push({
          nombre: 'Límite inferior (LIC)', estado: 'informativo',
          texto: `${sinLic.length === usables.length ? 'En todos los periodos' : `En ${sinLic.length} de ${usables.length} periodos`} ${UB} − 3·√(${UB}/n) es negativo y el LIC se corta en 0: ningún periodo puede salir por abajo. Con tan pocos defectos esperados por periodo, ver una mejora depende de la regla 3 (nueve periodos seguidos bajo la línea central) más que de un punto aislado${reglas.length === 1 ? ', y con «solo la regla 1» esa señal no se ve' : ''}.`,
        });
      }
      if (!c.dado) {
        const cortas = fases.filter((fase) => fase.usados < 20);
        semaforos.push(
          cortas.length
            ? {
              nombre: 'Número de periodos', estado: 'informativo',
              texto: `${fases.map((fase) => `${dosFases ? `Fase ${fase.id}: ` : ''}${plural(fase.usados, 'periodo')}`).join(' · ')}. Con pocos periodos los límites son preliminares: la plantilla de la carta X̄-R (LAB 25) pide de 20 a 25 para límites definitivos; la guía usa 8 semanas por fase en este ejemplo.`,
            }
            : { nombre: 'Número de periodos', estado: 'cumple', texto: `${fases.map((fase) => `${dosFases ? `Fase ${fase.id}: ` : ''}${plural(fase.usados, 'periodo')}`).join(' · ')}: suficientes para límites definitivos (la plantilla de la carta X̄-R pide de 20 a 25).` }
        );
      }

      /* ---- gráfica ---- */
      const graficas = [
        graficaU({
          puntos: f.puntos, primera: hayExclusion ? c.primera.puntos : null, fx, factor, escala, conZonas: reglas.length > 1,
          etiquetaCentro: c.dado ? `${UB} (histórico)` : dosFases ? `${UB} (por fase)` : `${UB} ${fx(fases[0].ubar)}`, dosFases, constante: !nVarios,
        }),
      ];

      /* ---- tablas ---- */
      const chip = (p) => (p.excluido ? { estado: 'informativo', texto: 'Excluido' } : p.senales.length ? { estado: p.senales.includes(1) && p.u > p.cl ? 'critico' : 'atencion', texto: mayuscula(textoSenales(p.senales, p.u, p)) } : { estado: 'cumple', texto: 'En control' });
      const tablas = [
        {
          titulo: 'Límites de control',
          columnas: ['Línea', 'Fórmula', { t: 'Valor', num: true }],
          filas: fases.flatMap((fase) => {
            const puntos = f.puntos.filter((p) => p.fase === fase.id);
            const sufijo = dosFases ? ` (fase ${fase.id})` : '';
            return [
              [`${UB}${sufijo}`, c.dado ? 'dato (histórico)' : `Σc ÷ Σn = ${entero(fase.c)} ÷ ${entero(fase.n)}`, { texto: c.dado ? sinCeros(fx(fase.ubar)) : fx(fase.ubar), num: true, formula: !c.dado }],
              [`LSC${sufijo}`, `${UB} + 3·√(${UB}/n)`, { texto: rangoDe(puntos, 'lsc'), num: true, formula: true }],
              [`LIC${sufijo}`, `máx[0, ${UB} − 3·√(${UB}/n)]`, { texto: rangoDe(puntos, 'lic'), num: true, formula: true }],
            ];
          }),
          pie: `${nVarios ? 'Los límites cambian con el área de oportunidad n de cada periodo; se muestra el rango. ' : ''}n = unidades × ${plural(oportunidades, 'oportunidad', 'oportunidades')} por unidad${escala === 'dpmo' ? '; valores en DPMO (× 1,000,000)' : ''}.`,
        },
        {
          titulo: 'Periodo por periodo',
          columnas: [{ t: '#', num: true }, { t: 'c', num: true }, { t: 'n', num: true }, { t: unidad, num: true }, { t: 'LIC', num: true }, { t: 'LSC', num: true }, 'Estado'],
          filas: f.puntos.map((p) => [
            { texto: String(p.indice), num: true }, { texto: entero(p.c), num: true }, { texto: entero(p.n), num: true }, { texto: fx(p.u), num: true },
            { texto: fx(p.lic), num: true }, { texto: fx(p.lsc), num: true }, chip(p),
          ]),
          resaltar: f.puntos.map((p, i) => (p.senales.length || p.excluido ? i : -1)).filter((i) => i >= 0),
          pie: `Con ${reglas.length === 1 ? 'la regla 1' : 'las tres reglas'}. Resaltados: los periodos con señal y los excluidos del cálculo de ${UB}.`,
        },
      ];
      if (dosFases) {
        const una = cartaU(periodos, { excluir: leidos.indices, reglas });
        if (una.valido) {
          const [a, b] = fases;
          const u1 = una.final.fases[0];
          const lista = (puntos) => (citasAgrupadas(puntos.filter((p) => p.senales.length)).join('; ') || 'ninguna');
          tablas.push({
            titulo: 'Una línea central frente a dos fases',
            columnas: ['Cálculo', { t: 'Una sola línea', num: true }, { t: `Dos fases (desde ${b.desde})`, num: true }],
            filas: [
              [`${UB}${dosFases ? ' (fase 1)' : ''}`, { texto: fx(u1.ubar), num: true, formula: true }, { texto: fx(a.ubar), num: true, formula: true }],
              [`${UB} (fase 2)`, { texto: '—', num: true }, { texto: fx(b.ubar), num: true, formula: true }],
              ['LSC', { texto: rangoDe(una.final.puntos, 'lsc'), num: true, formula: true }, { texto: `${rangoDe(f.puntos.filter((p) => p.fase === 1), 'lsc')} · ${rangoDe(f.puntos.filter((p) => p.fase === 2), 'lsc')}`, num: true, formula: true }],
              ['Periodos con señal', lista(una.final.puntos), lista(f.puntos)],
            ],
            pie: 'Extender la línea central de «antes» a los periodos de «después» (guía M10 §3) hace que una mejora deliberada parezca una señal; con una línea nueva cada fase se compara con su propio proceso.',
          });
        }
      }
      if (hayExclusion) {
        const p = c.primera.fases[0];
        const l = fases[0];
        const textoPrimera = citasAgrupadas(c.primera.puntos.filter((q) => q.senales.length)).join('; ') || 'ninguna';
        tablas.push({
          titulo: 'Primera pasada frente a límites finales',
          columnas: ['Cálculo', { t: `Con los ${c.total} periodos`, num: true }, { t: `Sin ${periodosTexto(c.excluidos)}`, num: true }],
          filas: [
            [`${UB}${dosFases ? ' (fase 1)' : ''}`, { texto: fx(p.ubar), num: true, formula: true }, { texto: fx(l.ubar), num: true, formula: true }],
            ...(dosFases ? [[`${UB} (fase 2)`, { texto: fx(c.primera.fases[1].ubar), num: true, formula: true }, { texto: fx(fases[1].ubar), num: true, formula: true }]] : []),
            ['Periodos con señal', textoPrimera, citasAgrupadas(conSenal).join('; ') || 'ninguna'],
          ],
          pie: 'La primera pasada es la que encuentra la causa especial; los límites finales son los que se usan para vigilar el proceso en adelante.',
        });
      }

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral: umbralDe(reglasActivas), supuesto: SUPUESTO, graficas, tablas };
    },
  };
}
