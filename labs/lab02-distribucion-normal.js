/**
 * LAB 02 · Distribución normal
 *
 * Guía: M0 §2 (distribución normal, regla empírica 68–95–99.7 y puntaje Z) y M1 §6 (desplazamiento de 1.5σ).
 * Con μ, σ y los límites de especificación calcula qué fracción cae fuera de especificación (DPMO),
 * el rendimiento y el nivel sigma, con o sin el desplazamiento de la media.
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: ejemplo de la guía (50 / 4, límites a ±3σ), 3σ y 6σ con desplazamiento, y μ y σ de las
 * 40 fuerzas de engarzado y de las 10 mediciones de torque del caso de los arneses.
 */
import { desviacion, media, normalCdf, normalPdf, normalSf } from '../js/lib/stats.js';
import { dpmo as fmtDpmo, num, rendimiento } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { etiquetaV, hexARgba, lineaV, malla } from '../js/lib/graficas.js';

/** Decimales a mostrar según el tamaño de σ (2 con σ ≥ 1; hasta 4 con σ ≈ 0.03). */
const decimalesDe = (sigma) => Math.max(2, Math.min(4, 2 - Math.floor(Math.log10(Math.abs(sigma) || 1))));
const redondea = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

/** Fracción → «0.135 %», «6.68 %», «0.00034 %»: los decimales necesarios para ver colas pequeñas. */
function pctFino(p) {
  if (!Number.isFinite(p)) return '—';
  if (p === 0) return '0 %';
  const x = p * 100;
  if (x < 0.00001) return '< 0.00001 %';
  return `${num(x, x >= 1 ? 2 : x >= 0.01 ? 3 : 5)} %`;
}

const UMBRAL = {
  titulo: 'Umbrales de interpretación',
  filas: [
    { rango: '±1σ · ±2σ · ±3σ', texto: '68.27 % · 95.45 % · 99.73 % de los datos quedan dentro (regla empírica, guía M0 §2)' },
    { rango: 'Z de largo plazo ≥ 4.5 (DPMO ≤ 3.4)', texto: 'nivel Six Sigma: 6σ con el desplazamiento de 1.5σ (tabla de la guía, M1 §6)' },
    { rango: 'Z de largo plazo de 1.5 a 4.5 (3.4 a 66,807 DPMO)', texto: 'entre 6σ y 3σ: atención; hay margen de mejora' },
    { rango: 'Z de largo plazo < 1.5 (DPMO > 66,807)', texto: 'peor que 3σ: crítico (referencia didáctica para el semáforo)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto: 'Las probabilidades suponen que el proceso sigue una distribución normal con la media y la desviación estándar capturadas, y que ambas son estables en el tiempo. σ debe ser la variación de corto plazo del proceso.',
};

export default function lab02(ctx = {}) {
  const fuerza = ctx.caso?.fuerza;
  const torque = ctx.caso?.torque;

  const presets = [
    { id: 'guia', etiqueta: 'Guía M0: μ = 50, σ = 4', ayuda: 'Proceso centrado con límites a ±3σ (38 y 62): sale ≈ 2,700 DPMO.', valores: { mu: 50, sigma: 4, lsl: 38, usl: 62, desplazamiento: 0, unidad: '' } },
    { id: 'tres-sigma', etiqueta: '3σ con desplazamiento de 1.5σ', ayuda: 'Mismos límites, con la media corrida 1.5σ hacia el USL: ≈ 66,807 DPMO en la cola cercana, como la tabla de la guía (66,811 al sumar también la cola lejana).', valores: { mu: 50, sigma: 4, lsl: 38, usl: 62, desplazamiento: 1.5, unidad: '' } },
    { id: 'seis-sigma', etiqueta: '6σ con desplazamiento de 1.5σ', ayuda: 'Límites a ±6σ (26 y 74) y desplazamiento de 1.5σ: ≈ 3.4 DPMO.', valores: { mu: 50, sigma: 4, lsl: 26, usl: 74, desplazamiento: 1.5, unidad: '' } },
  ];
  if (fuerza?.valores?.length > 1) {
    presets.push({
      id: 'fuerza', etiqueta: 'Caso: fuerza de engarzado (N)', ayuda: 'μ y σ de las 40 fuerzas del LAB 01; el poka-yoke rechaza lo que queda por debajo de 173 N.',
      valores: { mu: redondea(media(fuerza.valores), 3), sigma: redondea(desviacion(fuerza.valores), 3), lsl: fuerza.minimo ?? NaN, usl: NaN, desplazamiento: 0, unidad: fuerza.unidad ?? 'N' },
    });
  }
  if (torque?.valores?.length > 1) {
    presets.push({
      id: 'torque', etiqueta: 'Caso: torque (N·m)', ayuda: 'μ y σ de las 10 mediciones de torque; especificación 1.2 a 1.5 N·m.',
      valores: { mu: redondea(media(torque.valores), 4), sigma: redondea(desviacion(torque.valores), 4), lsl: torque.lsl ?? NaN, usl: torque.usl ?? NaN, desplazamiento: 0, unidad: torque.unidad ?? 'N·m' },
    });
  }

  return {
    id: 'lab02',
    numero: '02',
    modulo: 'M0',
    titulo: 'Distribución normal',
    resumen: 'Ubica una media y una desviación estándar sobre la campana: qué fracción cae fuera de los límites, cuánto vale en DPMO y qué pasa cuando la media se desplaza 1.5σ.',
    entradas: [
      { id: 'mu', tipo: 'numero', etiqueta: 'Media (μ)', valor: 50 },
      { id: 'sigma', tipo: 'numero', etiqueta: 'Desviación estándar (σ)', valor: 4, min: 0, ayuda: 'Debe ser mayor que cero.' },
      { id: 'unidad', tipo: 'texto', etiqueta: 'Unidad', valor: '', marcador: 'mm, N, s…' },
      { id: 'lsl', tipo: 'numero', etiqueta: 'Límite inferior de especificación (LSL)', valor: 38, marcador: 'opcional' },
      { id: 'usl', tipo: 'numero', etiqueta: 'Límite superior de especificación (USL)', valor: 62, marcador: 'opcional' },
      { id: 'desplazamiento', tipo: 'slider', etiqueta: 'Desplazamiento de la media', min: 0, max: 2, paso: 0.1, valor: 0, dec: 1, unidad: 'σ', ayuda: 'Corre la media hacia el límite más cercano. 1.5σ es la convención de largo plazo de Six Sigma.' },
    ],
    presets,
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      'Con los límites a ±3σ y el proceso centrado, ¿cuántas piezas fuera de especificación esperas por millón? ¿Y si la media se desplaza 1.5σ?',
      '¿Qué reduce más el DPMO: bajar σ a la mitad o centrar la media? Pruébalo con el ejemplo de la guía.',
      'Con la μ y la σ de las 40 fuerzas, ¿qué porcentaje queda por debajo de 173 N? Compáralo con el conteo directo que ves en el LAB 01.',
      '¿Qué supuesto haces al usar estas probabilidades con datos reales y cómo lo comprobarías?',
    ],

    calcular(e) {
      const { mu, sigma, lsl, usl } = e;
      if (!Number.isFinite(mu) || !(sigma > 0)) {
        return {
          vacio: 'Captura la media (μ) y una desviación estándar (σ) mayor que cero.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Faltan μ o σ.' }],
        };
      }
      const dec = decimalesDe(sigma);
      const f = (v) => num(v, dec);
      const unidad = (e.unidad ?? '').trim();
      const u = unidad ? ` ${unidad}` : '';
      const aviso = [];
      const hayLsl = Number.isFinite(lsl);
      const hayUsl = Number.isFinite(usl);
      const orden = !(hayLsl && hayUsl && lsl >= usl);
      const espOk = (hayLsl || hayUsl) && orden;
      if (!orden) aviso.push('El LSL debe ser menor que el USL: no se evalúa la especificación.');
      if (espOk && ((hayLsl && mu < lsl) || (hayUsl && mu > usl))) aviso.push('La media queda fuera de los límites de especificación.');
      const d = Number.isFinite(e.desplazamiento) ? Math.min(Math.max(e.desplazamiento, 0), 3) : 0;
      if (d > 0 && !espOk) aviso.push('Sin límites de especificación no hay hacia dónde desplazar la media: se ignora el desplazamiento.');

      // El desplazamiento va hacia el límite más cercano (con un solo límite, hacia ese límite).
      let dir = 0;
      if (espOk && d > 0) dir = hayLsl && hayUsl ? ((usl - mu) <= (mu - lsl) ? 1 : -1) : hayUsl ? 1 : -1;
      const muD = mu + dir * d * sigma;

      /* ---- regla empírica ---- */
      const bandas = [1, 2, 3].map((k) => ({ k, desde: mu - k * sigma, hasta: mu + k * sigma, p: normalCdf(k) - normalCdf(-k) }));

      /* ---- especificación ---- */
      const distLsl = hayLsl ? (mu - lsl) / sigma : Infinity; // en σ, sin desplazar
      const distUsl = hayUsl ? (usl - mu) / sigma : Infinity;
      const distLslD = hayLsl ? (muD - lsl) / sigma : Infinity;
      const distUslD = hayUsl ? (usl - muD) / sigma : Infinity;
      const pBajo = espOk && hayLsl ? normalCdf(-distLslD) : 0;
      const pSobre = espOk && hayUsl ? normalSf(distUslD) : 0;
      const pFuera = pBajo + pSobre;
      const dpmo = pFuera * 1e6;
      const zCorto = Math.min(distLsl, distUsl);
      const zLargo = Math.min(distLslD, distUslD);
      const nivel = zLargo >= 4.5 - 1e-9 ? 0 : zLargo >= 1.5 - 1e-9 ? 1 : 2; // 6σ · entre 6σ y 3σ · peor que 3σ

      const salidas = [];
      if (espOk) {
        salidas.push(
          { id: 'dpmo', etiqueta: 'DPMO fuera de especificación', valor: fmtDpmo(dpmo), color: 'teal', nota: `${d > 0 ? `largo plazo, con desplazamiento de ${num(d, 1)}σ` : 'proceso sin desplazar (corto plazo)'} · suma ambas colas` },
          { id: 'rendimiento', etiqueta: 'Rendimiento', valor: rendimiento(1 - pFuera), nota: 'fracción dentro de especificación' },
          { id: 'p-bajo', etiqueta: '% por debajo del LSL', valor: hayLsl ? pctFino(pBajo) : '—' },
          { id: 'p-sobre', etiqueta: '% por encima del USL', valor: hayUsl ? pctFino(pSobre) : '—' },
          { id: 'z-corto', etiqueta: 'Nivel sigma de corto plazo', valor: Number.isFinite(zCorto) ? num(zCorto, 2) : '—', color: 'azul', nota: 'Z mínimo: distancia al límite más cercano en σ' },
          { id: 'z-largo', etiqueta: 'Z de largo plazo', valor: Number.isFinite(zLargo) ? num(zLargo, 2) : '—', nota: d > 0 ? `Z de corto plazo − ${num(d, 1)}` : 'igual al de corto plazo' }
        );
        if (hayLsl && hayUsl) salidas.push({ id: 'tolerancia', etiqueta: 'Tolerancia en σ', valor: num((usl - lsl) / sigma, 2), nota: '(USL − LSL) ÷ σ; ±3σ = 6' });
        if (d > 0) salidas.push({ id: 'mu-desplazada', etiqueta: 'Media desplazada', valor: `${f(muD)}${u}`, pequeno: true, nota: dir > 0 ? 'hacia el USL' : 'hacia el LSL' });
      }
      salidas.push({ id: 'bandas', etiqueta: 'Regla empírica (±1σ · ±2σ · ±3σ)', valor: bandas.map((b) => num(b.p * 100, 2)).join(' · ') + ' %', pequeno: true, ancha: true, nota: 'proporción de datos dentro de cada banda' });

      /* ---- semáforos ---- */
      const semaforos = [];
      if (espOk) {
        semaforos.push(
          nivel === 0
            ? { nombre: 'DPMO', estado: 'cumple', texto: `${fmtDpmo(dpmo)} DPMO: nivel Six Sigma (Z de largo plazo ≥ 4.5).` }
            : nivel === 1
              ? { nombre: 'DPMO', estado: 'atencion', texto: `${fmtDpmo(dpmo)} DPMO: entre 6σ y 3σ (Z de largo plazo de 1.5 a 4.5).` }
              : { nombre: 'DPMO', estado: 'critico', texto: `${fmtDpmo(dpmo)} DPMO: peor que 3σ (Z de largo plazo menor que 1.5).` }
        );
        semaforos.push({ nombre: 'Desplazamiento', estado: 'informativo', texto: d > 0 ? `La media está corrida ${num(d, 1)}σ: el DPMO es de largo plazo.` : 'Sin desplazamiento: el DPMO es el de corto plazo (proceso centrado en μ).' });
      } else {
        semaforos.push({ nombre: 'Especificación', estado: 'informativo', texto: 'Captura un LSL y/o un USL para calcular el DPMO y el nivel sigma.' });
      }

      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((fila, i) => ({ ...fila, activa: [true, espOk && nivel === 0, espOk && nivel === 1, espOk && nivel === 2][i] })),
      };
      const supuesto = {
        ...SUPUESTO,
        estado: 'informativo',
        detalle: 'Este laboratorio no ve datos: confirma la forma con el histograma y la asimetría del LAB 01 antes de usar estas probabilidades con mediciones reales.',
      };

      /* ---- gráfica: campana con colas fuera de especificación ---- */
      const x0 = Math.min(mu, muD) - 4 * sigma;
      const x1 = Math.max(mu, muD) + 4 * sigma;
      const xMin = Math.min(x0, hayLsl && espOk ? lsl - 0.5 * sigma : x0);
      const xMax = Math.max(x1, hayUsl && espOk ? usl + 0.5 * sigma : x1);
      const xs = malla(xMin, xMax, 320);
      const cola = (desde, hasta, mostrar) => {
        const cx = malla(desde, hasta, 90);
        return {
          type: 'scatter', mode: 'lines', x: [cx[0], ...cx, cx[cx.length - 1]], y: [0, ...cx.map((v) => normalPdf(v, muD, sigma)), 0], fill: 'toself',
          fillcolor: hexARgba(COLOR.coral, 0.45), line: { width: 0 }, name: 'Fuera de especificación', showlegend: mostrar, hoverinfo: 'skip',
        };
      };
      const datos = [];
      if (d > 0 && dir !== 0) {
        datos.push({ type: 'scatter', mode: 'lines', x: xs, y: xs.map((v) => normalPdf(v, mu, sigma)), name: 'Proceso centrado', line: { color: COLOR.gris, width: 1.6, dash: 'dot' }, hoverinfo: 'skip' });
      }
      let colaMostrada = false;
      if (espOk && hayLsl && lsl > xMin) { datos.push(cola(xMin, lsl, !colaMostrada)); colaMostrada = true; }
      if (espOk && hayUsl && usl < xMax) { datos.push(cola(usl, xMax, !colaMostrada)); colaMostrada = true; }
      datos.push({ type: 'scatter', mode: 'lines', x: xs, y: xs.map((v) => normalPdf(v, muD, sigma)), name: d > 0 && dir !== 0 ? 'Proceso desplazado' : 'Proceso', line: { color: COLOR.teal, width: 2.4 }, hoverinfo: 'x' });
      const formas = [lineaV(muD, COLOR.teal, { dash: 'dash', ancho: 1.6 })];
      const notas = [etiquetaV(muD, ' μ', COLOR.teal)];
      if (espOk && hayLsl) { formas.push(lineaV(lsl, COLOR.coral, { dash: 'solid', ancho: 2 })); notas.push(etiquetaV(lsl, ' LSL', COLOR.coral, { desplazarY: 16 })); }
      if (espOk && hayUsl) { formas.push(lineaV(usl, COLOR.coral, { dash: 'solid', ancho: 2 })); notas.push(etiquetaV(usl, 'USL ', COLOR.coral, { ancla: 'right', desplazarY: 16 })); }
      const graficas = [
        {
          id: 'campana', titulo: 'Distribución normal y límites de especificación', ancha: true, alta: true, datos,
          layout: { xaxis: { title: { text: `Valor${unidad ? ` (${unidad})` : ''}` } }, yaxis: { title: { text: 'Densidad' }, rangemode: 'tozero', showticklabels: false }, shapes: formas, annotations: notas },
          respaldo: { columnas: ['Banda', 'Intervalo', 'Dentro'], filas: bandas.map((b) => [`±${b.k}σ`, `${f(b.desde)} a ${f(b.hasta)}`, `${num(b.p * 100, 2)} %`]) },
        },
      ];

      /* ---- tablas ---- */
      const tablas = [
        {
          titulo: 'Regla empírica alrededor de la media',
          columnas: ['Banda', { t: 'Intervalo', num: true }, { t: 'Dentro', num: true }, { t: 'DPMO fuera', num: true }],
          filas: bandas.map((b) => [`±${b.k}σ`, { texto: `${f(b.desde)} a ${f(b.hasta)}${u}`, num: true }, { texto: `${num(b.p * 100, 2)} %`, num: true, formula: true }, { texto: fmtDpmo((1 - b.p) * 1e6), num: true, formula: true }]),
        },
      ];
      if (espOk) {
        const fila = (nombre, valor, distSin, distCon, p, signo) => [
          nombre, { texto: `${f(valor)}${u}`, num: true }, { texto: num(signo * distSin, 2), num: true, formula: true }, { texto: num(signo * distCon, 2), num: true, formula: true }, { texto: pctFino(p), num: true, formula: true }, { texto: fmtDpmo(p * 1e6), num: true, formula: true },
        ];
        const filas = [];
        if (hayLsl) filas.push(fila('LSL', lsl, distLsl, distLslD, pBajo, -1));
        if (hayUsl) filas.push(fila('USL', usl, distUsl, distUslD, pSobre, 1));
        tablas.push({
          titulo: 'Z de cada límite: (límite − μ) ÷ σ',
          columnas: ['Límite', { t: 'Valor', num: true }, { t: 'Z sin desplazar', num: true }, { t: 'Z con desplazamiento', num: true }, { t: '% fuera', num: true }, { t: 'DPMO', num: true }],
          filas,
          pie: d > 0 ? `El desplazamiento de ${num(d, 1)}σ acerca la media al ${dir > 0 ? 'USL' : 'LSL'}; el otro lado casi no aporta.` : 'Sin desplazamiento, el Z de corto y de largo plazo coinciden.',
        });
      }

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
