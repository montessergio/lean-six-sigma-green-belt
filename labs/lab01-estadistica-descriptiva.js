/**
 * LAB 01 · Estadística descriptiva
 *
 * Guía: M0 §1 (media, mediana, moda, rango, suma de cuadrados, s y σ) y plantilla Excel
 * «Estadistica Descriptiva». Es una función pura de los datos capturados: la interfaz
 * (js/core/lab-ui.js) solo pinta lo que devuelve calcular().
 *
 * Datos de práctica: el ejemplo de la guía (seis tiempos de inspección), los rechazos por turno
 * del ejercicio 1 y, del caso de los arneses, las 40 fuerzas de engarzado (umbral de 173 N) y
 * las 10 mediciones de torque.
 */
import { asimetria, curtosis, histograma, mediana, moda, normalPdf, resumen, suma, sumaCuadrados } from '../js/lib/stats.js';
import { entero, num, pct } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { etiquetaV, hexARgba, lineaV, malla } from '../js/lib/graficas.js';

/** Decimales a mostrar: uno más que los de los datos (entre 2 y 4). */
function decimalesDe(valores) {
  let max = 0;
  for (const v of valores) {
    const t = String(v);
    if (t.includes('e')) continue;
    const d = t.includes('.') ? t.split('.')[1].length : 0;
    if (d > max) max = d;
  }
  return Math.min(4, Math.max(2, max + 1));
}

const UMBRAL = {
  titulo: 'Umbrales de interpretación',
  filas: [
    { rango: '|asimetría| ≤ 1', texto: 'forma aproximadamente simétrica; la media describe bien el centro' },
    { rango: '|asimetría| > 1', texto: 'sesgo marcado: reporta la mediana junto a la media' },
    { rango: 'x < Q1 − 1.5·RIC  ó  x > Q3 + 1.5·RIC', texto: 'valor atípico (regla de Tukey): revísalo, no lo descartes sin causa' },
    { rango: 'n < 10 · 10 ≤ n < 30 · n ≥ 30', texto: 'atención · informativo · cumple (referencia didáctica sobre la confiabilidad de la forma)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto: 'Los resúmenes (media, mediana, desviación, cuartiles) valen para cualquier muestra. El intervalo de confianza de la media y la lectura con la regla empírica suponen datos aproximadamente normales e independientes; con pocos datos esa normalidad no se puede comprobar.',
};

export default function lab01(ctx = {}) {
  const fuerza = ctx.caso?.fuerza;
  const torque = ctx.caso?.torque;

  const presets = [
    { id: 'guia', etiqueta: 'Guía M0: 6 conectores (s)', ayuda: 'Tiempos de inspección visual del ejemplo del módulo 0: media 14 s, mediana 13.5 s, SC = 40.', valores: { datos: [12, 15, 11, 14, 13, 19], unidad: 's', tipo: 'muestra', clases: 4, lsl: NaN, usl: NaN } },
    { id: 'rechazos', etiqueta: 'Rechazos por turno', ayuda: 'Ejercicio 1 del módulo 0: siete días de piezas rechazadas.', valores: { datos: [4, 6, 4, 9, 5, 4, 7], unidad: 'piezas', tipo: 'muestra', clases: 5, lsl: NaN, usl: NaN } },
  ];
  if (fuerza?.valores?.length) {
    presets.push({ id: 'fuerza', etiqueta: 'Caso: fuerza de engarzado (N)', ayuda: '40 fuerzas de engarzado de los arneses; el poka-yoke rechaza lo que quede por debajo de 173 N.', valores: { datos: fuerza.valores, unidad: fuerza.unidad ?? 'N', tipo: 'muestra', clases: 8, lsl: fuerza.minimo ?? NaN, usl: NaN } });
  }
  if (torque?.valores?.length) {
    presets.push({ id: 'torque', etiqueta: 'Caso: torque (N·m)', ayuda: 'Diez mediciones de torque; especificación 1.2 a 1.5 N·m.', valores: { datos: torque.valores, unidad: torque.unidad ?? 'N·m', tipo: 'muestra', clases: 5, lsl: torque.lsl ?? NaN, usl: torque.usl ?? NaN } });
  }

  return {
    id: 'lab01',
    numero: '01',
    modulo: 'M0',
    titulo: 'Estadística descriptiva',
    resumen: 'Resume una muestra con una cifra de centro y una de dispersión. Cambia entre muestra (÷ n − 1) y población (÷ N) y observa qué pasa con la desviación estándar.',
    entradas: [
      { id: 'datos', tipo: 'datos', etiqueta: 'Datos de la muestra', valor: [12, 15, 11, 14, 13, 19], filasTexto: 5, ayuda: 'Separa los valores con espacios, comas o saltos de línea; puedes pegar una columna de Excel.' },
      { id: 'unidad', tipo: 'texto', etiqueta: 'Unidad', valor: 's', marcador: 's, N, mm…' },
      {
        id: 'tipo', tipo: 'opcion', etiqueta: 'Los datos son…', valor: 'muestra',
        opciones: [
          { valor: 'muestra', texto: 'Una muestra (÷ n − 1)', ayuda: 'Lo habitual en un proyecto: x̄ y s' },
          { valor: 'poblacion', texto: 'Toda la población (÷ N)', ayuda: 'Solo si son todos los datos que existen: μ y σ' },
        ],
      },
      { id: 'clases', tipo: 'slider', etiqueta: 'Clases del histograma', min: 3, max: 15, paso: 1, valor: 4 },
      { id: 'lsl', tipo: 'numero', etiqueta: 'Límite inferior de especificación (LSL)', marcador: 'opcional', ayuda: 'Déjalo vacío si no hay límite. Ejemplo del caso: 173 N.' },
      { id: 'usl', tipo: 'numero', etiqueta: 'Límite superior de especificación (USL)', marcador: 'opcional' },
    ],
    presets,
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿La media y la mediana cuentan la misma historia? Si difieren mucho, ¿hacia qué lado se jala la media?',
      'Cambia entre muestra y población: ¿cuánto cambia la desviación estándar con n = 6? ¿Y con las 40 fuerzas? ¿Por qué la diferencia se encoge al crecer n?',
      'Agrega un valor muy grande a los datos: ¿qué estadístico cambia más, la media, la mediana o el RIC?',
      'Con las 40 fuerzas, ¿basta que la media supere 173 N para concluir que el proceso cumple el umbral? Mira cuántos datos quedan por debajo.',
    ],

    calcular(e) {
      const x = e.datos;
      const n = x.length;
      if (n === 0) {
        return {
          vacio: 'Captura al menos un dato para ver el resumen y el histograma.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Sin datos: pega o escribe la muestra.' }],
        };
      }
      const unidad = (e.unidad ?? '').trim();
      const u = unidad ? ` ${unidad}` : '';
      const dec = decimalesDe(x);
      const f = (v) => num(v, dec);
      const poblacion = e.tipo === 'poblacion';
      const r = resumen(x);
      const sc = sumaCuadrados(x);
      const gl = poblacion ? n : n - 1;
      const sdElegida = gl > 0 ? Math.sqrt(sc / gl) : NaN;
      const sdMuestra = n > 1 ? Math.sqrt(sc / (n - 1)) : NaN;
      const sdPoblacion = Math.sqrt(sc / n);
      const k = Math.round(e.clases);
      const aviso = [];
      const lsl = e.lsl;
      const usl = e.usl;
      const hayLsl = Number.isFinite(lsl);
      const hayUsl = Number.isFinite(usl);
      if (hayLsl && hayUsl && lsl >= usl) aviso.push('El LSL debe ser menor que el USL: no se evalúa la especificación.');
      if (n === 1) aviso.push('Con un solo dato no hay dispersión que medir: captura al menos dos.');

      /* ---- salidas ---- */
      const modaTxt = r.moda.valores.length ? r.moda.valores.map(f).join(', ') : 'Sin moda';
      const salidas = [
        { id: 'n', etiqueta: 'Tamaño (n)', valor: entero(n) },
        { id: 'media', etiqueta: poblacion ? 'Media (μ)' : 'Media (x̄)', valor: f(r.media), color: 'teal', nota: `Σx ÷ n = ${f(suma(x))} ÷ ${n}` },
        { id: 'mediana', etiqueta: 'Mediana', valor: f(r.mediana), nota: n % 2 ? 'el valor central' : 'promedio de los dos centrales' },
        { id: 'moda', etiqueta: 'Moda', valor: modaTxt, nota: r.moda.valores.length ? `se repite ${r.moda.frecuencia} veces` : 'todos los valores son distintos' },
        { id: 'sc', etiqueta: 'Suma de cuadrados (SC)', valor: f(sc), nota: 'Σ(x − x̄)²' },
        { id: 'gl', etiqueta: 'Divisor', valor: entero(gl), nota: poblacion ? 'N (población)' : 'n − 1 (grados de libertad)' },
        { id: 'desviacion', etiqueta: poblacion ? 'Desviación estándar (σ)' : 'Desviación estándar (s)', valor: f(sdElegida), color: 'azul', nota: `√(SC ÷ ${gl})` },
        { id: 'varianza', etiqueta: 'Varianza', valor: f(sdElegida ** 2), nota: `SC ÷ ${gl}` },
        { id: 'rango', etiqueta: 'Rango', valor: f(r.rango), nota: `${f(r.maximo)} − ${f(r.minimo)}` },
        { id: 'extremos', etiqueta: 'Mínimo · máximo', valor: `${f(r.minimo)} · ${f(r.maximo)}`, pequeno: true },
        { id: 'cuartiles', etiqueta: 'Cuartiles Q1 · Q3', valor: `${f(r.q1)} · ${f(r.q3)}`, pequeno: true, nota: 'como QUARTILE.INC de Excel' },
        { id: 'ric', etiqueta: 'Rango intercuartílico (RIC)', valor: f(r.iqr), nota: 'Q3 − Q1' },
        { id: 'cv', etiqueta: 'Coeficiente de variación', valor: Number.isFinite(sdElegida) && r.media ? pct(sdElegida / r.media, 1) : '—', nota: 'desviación ÷ media' },
        { id: 'asimetria', etiqueta: 'Asimetría', valor: n >= 3 ? num(r.asimetria, 2) : '—', nota: n >= 3 ? 'SKEW de Excel' : 'requiere n ≥ 3' },
        { id: 'curtosis', etiqueta: 'Curtosis (exceso)', valor: n >= 4 ? num(r.curtosis, 2) : '—', nota: n >= 4 ? 'KURT de Excel' : 'requiere n ≥ 4' },
        { id: 'ic', etiqueta: 'IC al 95 % de la media', valor: n > 1 ? `${f(r.icInferior)} a ${f(r.icSuperior)}` : '—', pequeno: true, nota: 'x̄ ± t × s/√n (supone normalidad)' },
        { id: 'ambas', etiqueta: 'Las dos convenciones', valor: n > 1 ? `s = ${f(sdMuestra)} · σ = ${f(sdPoblacion)}` : `σ = ${f(sdPoblacion)}`, pequeno: true, ancha: true, nota: 's divide entre n − 1 (muestra); σ divide entre N (población)' },
        { id: 'cotas', etiqueta: 'Límites de valores atípicos', valor: `${f(r.cotaInferior)} a ${f(r.cotaSuperior)}`, pequeno: true, ancha: true, nota: 'Q1 − 1.5·RIC  y  Q3 + 1.5·RIC' },
      ];

      /* ---- semáforos ---- */
      const semaforos = [];
      const nPequeno = n < 10;
      semaforos.push(
        n >= 30
          ? { nombre: 'Tamaño de la muestra', estado: 'cumple', texto: `n = ${n}: suficiente para juzgar la forma con el histograma.` }
          : nPequeno
            ? { nombre: 'Tamaño de la muestra', estado: 'atencion', texto: `n = ${n}: muy pocos datos; no saques conclusiones definitivas sobre la forma ni la normalidad.` }
            : { nombre: 'Tamaño de la muestra', estado: 'informativo', texto: `n = ${n}: la forma ya se insinúa, pero confirma con más datos.` }
      );
      const asim = n >= 3 ? asimetria(x) : NaN;
      const sesgado = Number.isFinite(asim) && Math.abs(asim) > 1;
      semaforos.push(
        !Number.isFinite(asim)
          ? { nombre: 'Forma (asimetría)', estado: 'sin-datos', texto: 'Requiere al menos tres datos y dispersión distinta de cero.' }
          : sesgado
            ? { nombre: 'Forma (asimetría)', estado: 'atencion', texto: `|asimetría| = ${num(Math.abs(asim), 2)} > 1: hay sesgo; la media y la mediana se separan.` }
            : { nombre: 'Forma (asimetría)', estado: 'cumple', texto: `|asimetría| = ${num(Math.abs(asim), 2)} ≤ 1: forma aproximadamente simétrica.` }
      );
      const atipicos = r.atipicos;
      semaforos.push(
        atipicos.length
          ? { nombre: 'Valores atípicos', estado: 'atencion', texto: `${atipicos.length} fuera de [${f(r.cotaInferior)}, ${f(r.cotaSuperior)}]: ${atipicos.slice(0, 4).map(f).join(', ')}${atipicos.length > 4 ? '…' : ''}. Revísalos antes de decidir.` }
          : { nombre: 'Valores atípicos', estado: 'cumple', texto: 'Ningún dato cae fuera de los límites de 1.5 × RIC.' }
      );
      const espOk = (hayLsl || hayUsl) && !(hayLsl && hayUsl && lsl >= usl);
      let fuera = [];
      if (espOk) {
        fuera = x.filter((v) => (hayLsl && v < lsl) || (hayUsl && v > usl));
        const limites = [hayLsl ? `LSL ${num(lsl, 4).replace(/\.?0+$/, '')}` : null, hayUsl ? `USL ${num(usl, 4).replace(/\.?0+$/, '')}` : null].filter(Boolean).join(' · ');
        semaforos.push(
          fuera.length
            ? { nombre: 'Especificación', estado: 'critico', texto: `${fuera.length} de ${n} datos (${pct(fuera.length / n, 1)}) fuera de ${limites}.` }
            : { nombre: 'Especificación', estado: 'cumple', texto: `Los ${n} datos están dentro de ${limites}.` }
        );
      } else {
        semaforos.push({ nombre: 'Especificación', estado: 'informativo', texto: 'Sin límites capturados: escribe un LSL y/o USL para contar los datos fuera.' });
      }

      /* ---- umbral y supuesto dinámicos ---- */
      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((fila, i) => ({
          ...fila,
          activa: [Number.isFinite(asim) && !sesgado, sesgado, atipicos.length > 0, true][i],
        })),
      };
      const sinNormalidad = n < 8;
      const supuesto = {
        ...SUPUESTO,
        estado: sinNormalidad ? 'atencion' : sesgado || atipicos.length ? 'atencion' : 'cumple',
        detalle: sinNormalidad
          ? `Con n = ${n} no es razonable asumir normalidad todavía (guía, M0 §2).`
          : sesgado || atipicos.length
            ? 'La forma no es simétrica o hay atípicos: el IC de la media y la regla empírica pueden engañar.'
            : 'El histograma es razonablemente simétrico y sin atípicos: la suposición de normalidad es plausible.',
      };

      /* ---- gráficas ---- */
      const { ancho, clases } = histograma(x, k);
      const anchoBarra = ancho > 0 ? ancho * 0.94 : 1;
      const datosHist = [
        {
          type: 'bar', name: 'Frecuencia', x: clases.map((c) => c.centro), y: clases.map((c) => c.frecuencia), width: clases.map(() => anchoBarra),
          marker: { color: hexARgba(COLOR.teal, 0.55), line: { color: COLOR.teal, width: 1 } },
          hovertemplate: '%{y} dato(s)<extra></extra>',
        },
      ];
      if (n >= 3 && sdElegida > 0 && ancho > 0) {
        const xs = malla(r.minimo - ancho, r.maximo + ancho, 160);
        datosHist.push({
          type: 'scatter', mode: 'lines', name: 'Normal con esa media y desviación', x: xs, y: xs.map((v) => n * ancho * normalPdf(v, r.media, sdElegida)),
          line: { color: COLOR.violeta, width: 2, dash: 'dot' }, hoverinfo: 'skip',
        });
      }
      const formas = [lineaV(r.media, COLOR.teal, { dash: 'solid', ancho: 2 }), lineaV(mediana(x), COLOR.azul, { dash: 'dash', ancho: 1.8 })];
      const notas = [etiquetaV(r.media, ' media', COLOR.teal), etiquetaV(mediana(x), ' mediana', COLOR.azul, { desplazarY: 16 })];
      if (espOk && hayLsl) { formas.push(lineaV(lsl, COLOR.coral)); notas.push(etiquetaV(lsl, ' LSL', COLOR.coral)); }
      if (espOk && hayUsl) { formas.push(lineaV(usl, COLOR.coral)); notas.push(etiquetaV(usl, ' USL', COLOR.coral)); }
      const tituloX = `Valor${unidad ? ` (${unidad})` : ''}`;
      const graficas = [
        {
          id: 'histograma', titulo: 'Histograma con media y mediana', ancha: true, datos: datosHist,
          layout: { xaxis: { title: { text: tituloX } }, yaxis: { title: { text: 'Frecuencia' }, rangemode: 'tozero', dtick: 1 }, shapes: formas, annotations: notas },
          respaldo: { columnas: ['Clase', 'Frecuencia'], filas: clases.map((c) => [`${f(c.desde)} – ${f(c.hasta)}`, String(c.frecuencia)]) },
        },
        {
          id: 'caja', titulo: 'Diagrama de caja y bigotes',
          datos: [
            {
              type: 'box', orientation: 'h', x, name: '', boxpoints: 'all', jitter: 0.55, pointpos: 0, boxmean: true,
              marker: { color: COLOR.azul, size: 7, opacity: 0.85 }, line: { color: COLOR.teal, width: 1.6 }, fillcolor: hexARgba(COLOR.teal, 0.14),
              hoverinfo: 'x',
            },
          ],
          layout: { showlegend: false, xaxis: { title: { text: tituloX } }, yaxis: { visible: false }, shapes: [...(espOk && hayLsl ? [lineaV(lsl, COLOR.coral)] : []), ...(espOk && hayUsl ? [lineaV(usl, COLOR.coral)] : [])] },
          respaldo: {
            columnas: ['Estadístico', 'Valor'],
            filas: [['Mínimo', f(r.minimo)], ['Q1', f(r.q1)], ['Mediana', f(r.mediana)], ['Q3', f(r.q3)], ['Máximo', f(r.maximo)], ['Atípicos', atipicos.length ? atipicos.map(f).join(', ') : 'ninguno']],
          },
        },
      ];

      /* ---- tabla de la suma de cuadrados (como en la guía), solo si cabe ---- */
      const tablas = [];
      if (n <= 12) {
        const filas = x.map((v) => [f(v), num(v - r.media, dec), { texto: num((v - r.media) ** 2, dec), num: true, formula: true }]);
        filas.push(['Suma (SC)', '—', { texto: f(sc), num: true, formula: true }]);
        tablas.push({
          titulo: 'Suma de cuadrados, paso a paso',
          columnas: [{ t: `Dato${unidad ? ` (${unidad})` : ''}`, num: true }, { t: 'Desviación (x − x̄)', num: true }, { t: 'Desviación²', num: true }],
          filas,
          resaltar: [filas.length - 1],
          pie: Number.isFinite(sdMuestra) ? `s = √(${f(sc)} ÷ ${n - 1}) = ${f(sdMuestra)}${u} · σ = √(${f(sc)} ÷ ${n}) = ${f(sdPoblacion)}${u}` : `σ = √(${f(sc)} ÷ ${n}) = ${f(sdPoblacion)}${u}`,
        });
      }

      void asimetria; void curtosis; void moda;
      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
