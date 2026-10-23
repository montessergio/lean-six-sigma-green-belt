/**
 * LAB 12 · Gauge R&R (%GRR)
 *
 * Guía: M5 §4 y plantilla Excel «Gauge RR» (método de promedios y rangos del AIAG).
 *   EV (repetibilidad)      = R̄ × K1
 *   AV (reproducibilidad)   = √[(X̄diff × K2)² − EV² ÷ (piezas × repeticiones)]
 *   R&R = √(EV² + AV²) · PV = Rp × K3 · TV = √(R&R² + PV²) · %GRR = R&R ÷ TV · ndc = 1.41 × PV ÷ R&R
 *   Criterio AIAG del %GRR: < 10 % aceptable · 10–30 % aceptable condicionalmente · > 30 % inaceptable; ndc ≥ 5.
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: el estudio de la fuerza de asentamiento de la guía (10 piezas × 3 operadores × 2 repeticiones, %GRR 16.9 %),
 * el de torque de la plantilla (5 × 3 × 2, 12.9 %) y una variante didáctica de la guía con 1.5 N de sesgo en el
 * operador C (no está en la guía: muestra qué componente reacciona a un sesgo de operador).
 *
 * Nota sobre %Tolerancia: las constantes K1, K2 y K3 ya incluyen el factor 5.15σ, de modo que R&R es un ancho de
 * variación y %Tolerancia = R&R ÷ tolerancia (sin multiplicar otra vez por 6).
 */
import { D4, gaugeRR } from '../js/lib/medir.js';
import { corto, entero, num, plural } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { etiquetaH, lineaH } from '../js/lib/graficas.js';

const OPERADORES = ['A', 'B', 'C'];
const COLOR_OP = { A: COLOR.teal, B: COLOR.azul, C: COLOR.coral };
const SESGO_C = 1.5; // N de la variante didáctica

const UMBRAL = {
  titulo: 'Criterio de aceptación AIAG (guía M5 §4)',
  filas: [
    { rango: '%GRR < 10 %', texto: 'sistema de medición aceptable' },
    { rango: '10 % ≤ %GRR ≤ 30 %', texto: 'aceptable condicionalmente, según la aplicación: indaga la causa antes de usarlo para decisiones críticas' },
    { rango: '%GRR > 30 %', texto: 'inaceptable: debe mejorarse antes de usar los datos' },
    { rango: 'ndc ≥ 5', texto: 'mínimo de categorías distintas que recomienda el AIAG (se trunca, no se redondea)' },
    { rango: 'Datos pasa / no pasa', texto: 'el Gauge R&R numérico no aplica: usa un análisis de concordancia de atributos (normalmente ≥ 90 % de acuerdo)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto:
    'Las piezas representan el rango real de variación del proceso, cada operador mide todas las piezas el mismo número de veces en orden aleatorio y sin ver sus lecturas anteriores, y el instrumento mide la misma característica en todas las mediciones. ' +
    'El método de promedios y rangos no separa la interacción operador × pieza; para eso se usa el ANOVA de un software. El %GRR depende de qué tan dispersas sean las piezas elegidas: piezas parecidas lo inflan.',
};

const DICTAMEN_TEXTO = {
  cumple: 'menor que 10 %: sistema de medición aceptable.',
  atencion: 'entre 10 % y 30 %: aceptable condicionalmente, según la aplicación.',
  critico: 'mayor que 30 %: inaceptable, debe mejorarse antes de usar los datos.',
};

const f4 = (x) => corto(x, 4);
const p1 = (x) => `${num(x, 1)} %`;
const sinRuido = (x) => Math.round(x * 1000) / 1000;
const promedio = (a) => a.reduce((x, y) => x + y, 0) / a.length;

/** Una pieza del caso { A:[…], B:[…], C:[…] } → fila de la tabla { A1, A2, …, C3 } (con un sesgo opcional por operador). */
const aFila = (pieza, repeticiones, sesgo = {}) => {
  const fila = {};
  for (const op of OPERADORES) {
    for (let k = 0; k < 3; k++) {
      const x = k < repeticiones ? pieza?.[op]?.[k] : NaN;
      fila[`${op}${k + 1}`] = Number.isFinite(x) ? sinRuido(x + (sesgo[op] ?? 0)) : NaN;
    }
  }
  return fila;
};

const filaNueva = Object.fromEntries(OPERADORES.flatMap((op) => [1, 2, 3].map((k) => [`${op}${k}`, NaN])));

const columnas = (estado) => {
  const o = estado.operadores === '2' ? 2 : 3;
  const r = estado.repeticiones === '3' ? 3 : 2;
  return [
    { id: 'pieza', etiqueta: 'Pieza', tipo: 'fijo', texto: (est, fila, i) => String(i + 1) },
    ...OPERADORES.slice(0, o).flatMap((op) =>
      Array.from({ length: r }, (_, k) => ({ id: `${op}${k + 1}`, etiqueta: `${op} · ${k + 1}`, tipo: 'numero', ancho: '62px', ayuda: `Operador ${op}, repetición ${k + 1}` }))
    ),
  ];
};

/** Lee la tabla: solo cuentan las columnas del diseño elegido y se ignoran las filas totalmente vacías. */
function leerEstudio(e) {
  const o = e.operadores === '2' ? 2 : 3;
  const r = e.repeticiones === '3' ? 3 : 2;
  const ops = OPERADORES.slice(0, o);
  const claves = ops.flatMap((op) => Array.from({ length: r }, (_, k) => `${op}${k + 1}`));
  const usadas = (e.mediciones ?? []).filter((f) => claves.some((c) => Number.isFinite(f?.[c])));
  const mediciones = ops.map((op) => usadas.map((f) => Array.from({ length: r }, (_, k) => f[`${op}${k + 1}`])));
  return { o, r, ops, usadas, mediciones, esperadas: o * usadas.length * r, capturadas: mediciones.flat(2).filter(Number.isFinite).length };
}

const sinDatos = (texto, aviso = []) => ({ aviso, vacio: texto, semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: aviso.length ? 'Revisa el aviso sobre la captura.' : 'Sin datos capturados.' }] });

export default function lab12(ctx = {}) {
  const caso = ctx.caso?.gaugeRR;
  const guia = caso?.guia;
  const excel = caso?.excel;
  const filasGuia = guia?.piezas?.length ? guia.piezas.map((p) => aFila(p, guia.repeticiones ?? 2)) : Array.from({ length: 3 }, () => ({ ...filaNueva }));
  const filasExcel = excel?.piezas?.length ? excel.piezas.map((p) => aFila(p, excel.repeticiones ?? 2)) : null;
  const filasSesgo = guia?.piezas?.length ? guia.piezas.map((p) => aFila(p, guia.repeticiones ?? 2, { C: SESGO_C })) : null;
  const diseno = { operadores: '3', repeticiones: '2', tolerancia: NaN };

  const presets = [
    ...(guia?.piezas?.length
      ? [{
        id: 'guia', etiqueta: 'Guía M5 §4: fuerza de asentamiento (10 × 3 × 2)',
        ayuda: 'Tres operadores miden diez piezas dos veces: R̄ 0.303, EV 1.38, AV 1.02, R&R 1.72, PV 10.02, TV 10.16. %GRR 16.9 % y ndc 8: aceptable condicionalmente. La guía redondea X̄diff a 0.40; con el valor exacto (0.395) sale su AV de 1.02.',
        valores: { ...diseno, unidad: guia.unidad ?? 'N', mediciones: filasGuia },
      }]
      : []),
    ...(filasExcel
      ? [{
        id: 'excel', etiqueta: 'Plantilla Excel: torque (5 × 3 × 2)',
        ayuda: 'Hoja «Gauge RR»: tres operadores, cinco piezas y dos mediciones en N·m. %GRR 12.9 % y ndc 10 (la plantilla muestra 10.86 sin truncar).',
        valores: { ...diseno, unidad: excel.unidad ?? 'N·m', mediciones: filasExcel },
      }]
      : []),
    ...(filasSesgo
      ? [{
        id: 'sesgo', etiqueta: 'Variante didáctica: operador C con +1.5 N',
        ayuda: 'No está en la guía: son los datos de la guía con 1.5 N sumados a todas las lecturas del operador C. Los rangos no cambian (EV igual), pero sube la reproducibilidad y el %GRR cruza el 30 %.',
        valores: { ...diseno, unidad: guia.unidad ?? 'N', mediciones: filasSesgo },
      }]
      : []),
  ];

  return {
    id: 'lab12',
    numero: '12',
    modulo: 'M5',
    titulo: 'Gauge R&R (%GRR)',
    resumen: 'Separa la variación del sistema de medición (repetibilidad y reproducibilidad) de la variación real de las piezas con el método de promedios y rangos, y dictamina si el sistema de medición se puede usar.',
    panelAncho: true,
    entradas: [
      { tipo: 'seccion', etiqueta: 'Diseño del estudio' },
      {
        id: 'operadores', tipo: 'opcion', etiqueta: 'Operadores', valor: '3',
        opciones: [{ valor: '2', texto: '2 (A, B)' }, { valor: '3', texto: '3 (A, B, C)' }],
      },
      {
        id: 'repeticiones', tipo: 'opcion', etiqueta: 'Repeticiones por operador y pieza', valor: '2',
        opciones: [{ valor: '2', texto: '2 repeticiones' }, { valor: '3', texto: '3 repeticiones' }],
      },
      { id: 'unidad', tipo: 'texto', etiqueta: 'Unidad de medida (opcional)', valor: guia?.unidad ?? 'N', marcador: 'p. ej. N·m' },
      { id: 'tolerancia', tipo: 'numero', etiqueta: 'Tolerancia USL − LSL (opcional)', valor: NaN, min: 0, ayuda: 'Con la tolerancia se calcula también %Tolerancia = R&R ÷ tolerancia.' },
      {
        id: 'mediciones', tipo: 'tabla', etiqueta: 'Mediciones (una fila por pieza)',
        columnas, filas: filasGuia, filaNueva, minFilas: 2, maxFilas: 10, filasVacias: 10, etiquetaAgregar: '+ Pieza',
        ayuda: 'Cada columna es operador · repetición (A · 1 = operador A, primera lectura). Las filas totalmente vacías se ignoran; si dejas celdas sueltas sin llenar el cálculo se detiene.',
      },
    ],
    presets,
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Qué componente domina, la repetibilidad o la reproducibilidad? ¿Qué acción pide cada caso (calibrar, cambiar o fijar mejor el equipo, frente a estandarizar el método y capacitar a los operadores)?',
      'Suma 1.5 a todas las lecturas de un operador (usa la variante didáctica): ¿qué componente se mueve y cuál no? ¿Por qué el rango medio no cambia aunque el promedio del operador sí?',
      '¿Qué pasa con el %GRR si las piezas del estudio cubren solo la mitad del rango real del proceso? ¿Y con el %Tolerancia si capturas la tolerancia?',
      'Con un %GRR de 16.9 %, ¿usarías este sistema para ajustar límites de control muy cerrados? ¿Y para aceptar piezas cerca del límite de especificación?',
      'Explica con tus palabras por qué un %GRR de 35 % haría poco confiable un Cpk calculado con esos datos aunque el Cpk «se vea bien».',
    ],

    calcular(e) {
      const est = leerEstudio(e);
      if (est.capturadas === 0) return sinDatos('Captura las mediciones de cada operador (una fila por pieza) para separar la repetibilidad de la reproducibilidad.');
      const aviso = [];
      if (est.usadas.length < 2) {
        return sinDatos('El método de promedios y rangos necesita de 2 a 10 piezas.', ['Captura al menos 2 piezas completas.']);
      }
      if (est.capturadas < est.esperadas) {
        const faltan = est.esperadas - est.capturadas;
        return sinDatos(
          `Faltan ${plural(faltan, 'medición', 'mediciones')}: cada operador mide cada pieza el mismo número de veces (${est.o} operadores × ${est.usadas.length} piezas × ${est.r} repeticiones = ${est.esperadas}).`,
          [`Hay ${est.capturadas} de ${est.esperadas} mediciones: completa las celdas vacías o borra las piezas incompletas.`]
        );
      }
      const toleranciaValida = Number.isFinite(e.tolerancia) && e.tolerancia > 0;
      if (Number.isFinite(e.tolerancia) && !toleranciaValida) aviso.push('La tolerancia debe ser mayor que cero; se ignoró.');
      const r = gaugeRR({ mediciones: est.mediciones, tolerancia: toleranciaValida ? e.tolerancia : NaN });
      if (!r.valido) return sinDatos(r.motivo, [r.motivo]);
      if (!(r.tv > 0)) return sinDatos('Todas las lecturas son iguales: sin variación no se puede calcular el %GRR.', ['No hay variación en los datos capturados.']);

      const unidad = String(e.unidad ?? '').trim();
      const u = unidad ? ` ${unidad}` : '';
      const ndcTexto = Number.isFinite(r.ndc) ? entero(r.ndc) : '∞';

      /* ---- salidas ---- */
      const salidas = [
        { id: 'pct-grr', etiqueta: '%GRR (R&R ÷ TV)', valor: p1(r.pctGrr), color: 'teal', nota: `R&R ${f4(r.rr)}${u} ÷ TV ${f4(r.tv)}${u}` },
        { id: 'ndc', etiqueta: 'Categorías distintas (ndc)', valor: ndcTexto, color: 'azul', nota: Number.isFinite(r.ndc) ? `1.41 × PV ÷ R&R = ${num(r.ndcExacto, 2)}: se trunca` : 'sin variación de medición' },
        { id: 'pct-ev', etiqueta: '% Repetibilidad (EV)', valor: p1(r.pctEv), nota: `EV ${f4(r.ev)}${u} · variación del equipo` },
        { id: 'pct-av', etiqueta: '% Reproducibilidad (AV)', valor: p1(r.pctAv), nota: `AV ${f4(r.av)}${u} · variación entre operadores` },
        { id: 'pct-pv', etiqueta: '% Variación de pieza (PV)', valor: p1(r.pctPv), nota: `PV ${f4(r.pv)}${u} · variación real de las piezas` },
      ];
      if (toleranciaValida) {
        salidas.push({ id: 'pct-tol', etiqueta: '%Tolerancia (R&R ÷ tolerancia)', valor: p1(r.pctTolerancia), nota: `${f4(r.rr)}${u} ÷ ${f4(e.tolerancia)}${u}: las constantes K ya incluyen el 5.15σ` });
      }

      /* ---- semáforos ---- */
      const semaforos = [{ nombre: 'Sistema de medición (%GRR)', estado: r.dictamen, texto: `${p1(r.pctGrr)}: ${DICTAMEN_TEXTO[r.dictamen]}` }];
      semaforos.push(
        r.ndc >= 5
          ? { nombre: 'Categorías distintas (ndc)', estado: 'cumple', texto: `ndc = ${ndcTexto}: por encima del mínimo de 5 que recomienda el AIAG.` }
          : { nombre: 'Categorías distintas (ndc)', estado: 'atencion', texto: `ndc = ${ndcTexto}: bajo el mínimo de 5 que recomienda el AIAG; el sistema distingue pocas categorías de piezas.` }
      );
      semaforos.push({
        nombre: 'Fuente dominante', estado: 'informativo',
        texto: r.dominante === 'repetibilidad'
          ? `Domina la repetibilidad (EV ${f4(r.ev)} frente a AV ${f4(r.av)}): el propio equipo varía; revisa calibración, resolución y fijación de la pieza.`
          : `Domina la reproducibilidad (AV ${f4(r.av)} frente a EV ${f4(r.ev)}): los operadores miden distinto; revisa el método, el punto de medición y la capacitación.`,
      });
      const rBarraOp = est.ops.map((op, i) => ({ op, r: r.rBarraPorOperador[i], media: r.mediaOperador[i] }));
      const mayorOp = rBarraOp.reduce((a, b) => (b.r > a.r ? b : a));
      const menorOp = rBarraOp.reduce((a, b) => (b.r < a.r ? b : a));
      if (mayorOp.r - menorOp.r > 1e-9 * Math.max(1, Math.abs(mayorOp.r))) { // sin dejarse engañar por el ruido de coma flotante
        const otros = rBarraOp.filter((x) => x.op !== mayorOp.op).map((x) => `${x.op} ${f4(x.r)}`).join(' · ');
        semaforos.push({ nombre: 'Operador con más variación entre repeticiones', estado: 'informativo', texto: `El operador ${mayorOp.op} tiene el rango medio más alto (${f4(mayorOp.r)}; ${otros}): ¿técnica de medición distinta o un instrumento que necesita calibración?` });
      }
      const fuera = [];
      r.rangos.forEach((fila, i) => fila.forEach((rango, j) => { if (rango > r.limiteRangos) fuera.push(`${est.ops[i]} en la pieza ${j + 1} (${f4(rango)}${u})`); }));
      semaforos.push(
        fuera.length
          ? { nombre: 'Rangos frente al límite', estado: 'atencion', texto: `Rango por encima de ${f4(r.limiteRangos)}${u} (D4 × R̄) en ${fuera.join(', ')}: revisa esas lecturas por un error de captura o de medición antes de seguir (referencia didáctica).` }
          : { nombre: 'Rangos frente al límite', estado: 'cumple', texto: `Todos los rangos quedan por debajo de ${f4(r.limiteRangos)}${u} (D4 × R̄); ninguna celda sugiere una lectura aislada (referencia didáctica).` }
      );
      semaforos.push({
        nombre: 'Diseño del estudio', estado: 'informativo',
        texto: `${est.o} operadores × ${est.usadas.length} piezas × ${est.r} repeticiones = ${est.esperadas} lecturas${est.usadas.length < 10 ? '. El diseño habitual de la guía usa 10 piezas: con menos, la variación entre piezas y el ndc se estiman con menos respaldo' : ''}.`,
      });
      if (toleranciaValida) {
        semaforos.push({ nombre: '%Tolerancia', estado: 'informativo', texto: `El R&R ocupa ${p1(r.pctTolerancia)} de la tolerancia. Se suele leer con los mismos cortes de 10 % y 30 % (referencia didáctica; la guía no trata %Tolerancia).` });
      }

      const umbral = { ...UMBRAL, filas: UMBRAL.filas.map((f, i) => ({ ...f, activa: [r.dictamen === 'cumple', r.dictamen === 'atencion', r.dictamen === 'critico', r.ndc >= 5, false][i] })) };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Confirma que los operadores no vieron sus lecturas anteriores y que las piezas cubren el rango real del proceso.' };

      /* ---- gráficas ---- */
      const nombres = ['Repetibilidad (EV)', 'Reproducibilidad (AV)', 'R&R del sistema', 'Variación de pieza (PV)'];
      const variacion = [r.pctEv, r.pctAv, r.pctGrr, r.pctPv];
      const contrib = [r.contribEv, r.contribAv, r.contribGrr, r.contribPv];
      const graficas = [
        {
          id: 'componentes', titulo: 'Componentes de variación (% del total)', ancha: true,
          datos: [
            {
              type: 'bar', name: '% de la variación del estudio', x: nombres, y: variacion, marker: { color: COLOR.azul }, text: variacion.map((v) => p1(v)), textposition: 'outside', cliponaxis: false,
              textfont: { color: COLOR.blanco, size: 11 }, hovertemplate: '%{x}<br>%{y:.1f} % de la variación del estudio<extra></extra>',
            },
            {
              type: 'bar', name: '% de contribución (varianzas)', x: nombres, y: contrib, marker: { color: COLOR.violeta }, text: contrib.map((v) => p1(v)), textposition: 'outside', cliponaxis: false,
              textfont: { color: COLOR.blanco, size: 11 }, hovertemplate: '%{x}<br>%{y:.2f} % de contribución<extra></extra>',
            },
          ],
          layout: {
            barmode: 'group', margin: { r: 46 }, yaxis: { title: { text: '%' }, range: [0, 118] },
            shapes: [lineaH(10, COLOR.ambar), lineaH(30, COLOR.coral)],
            annotations: [etiquetaH(10, '10 %', COLOR.ambar, { x: 1, ancla: 'left' }), etiquetaH(30, '30 %', COLOR.coral, { x: 1, ancla: 'left' })],
          },
          respaldo: { columnas: ['Componente', '% de la variación del estudio', '% de contribución'], filas: nombres.map((n, i) => [n, p1(variacion[i]), `${num(contrib[i], 2)} %`]) },
        },
        {
          id: 'promedios', titulo: `Promedio por pieza y operador${unidad ? ` (${unidad})` : ''}`,
          datos: est.ops.map((op, i) => ({
            type: 'scatter', mode: 'lines+markers', name: `Operador ${op}`, x: est.usadas.map((_, j) => j + 1),
            y: est.usadas.map((_, j) => promedio(est.mediciones[i][j])),
            line: { color: COLOR_OP[op], width: 1.8 }, marker: { color: COLOR_OP[op], size: 6 }, hovertemplate: `Operador ${op}<br>pieza %{x}: %{y:.3f}<extra></extra>`,
          })),
          layout: { xaxis: { title: { text: 'pieza' }, dtick: 1 }, yaxis: { title: { text: 'promedio de las repeticiones' } } },
          respaldo: {
            columnas: ['Pieza', ...est.ops.map((op) => `Operador ${op}`), 'Promedio de la pieza'],
            filas: est.usadas.map((_, j) => [String(j + 1), ...est.ops.map((_, i) => f4(promedio(est.mediciones[i][j]))), f4(r.mediaPieza[j])]),
          },
        },
        {
          id: 'rangos', titulo: `Rango de las repeticiones por pieza y operador${unidad ? ` (${unidad})` : ''}`,
          datos: est.ops.map((op, i) => ({
            type: 'scatter', mode: 'lines+markers', name: `Operador ${op}`, x: est.usadas.map((_, j) => j + 1), y: r.rangos[i],
            line: { color: COLOR_OP[op], width: 1.6 }, marker: { color: COLOR_OP[op], size: 6 }, hovertemplate: `Operador ${op}<br>pieza %{x}: rango %{y:.3f}<extra></extra>`,
          })),
          layout: {
            xaxis: { title: { text: 'pieza' }, dtick: 1 }, yaxis: { title: { text: 'rango' }, rangemode: 'tozero' },
            shapes: [lineaH(r.rBarra, COLOR.verde), lineaH(r.limiteRangos, COLOR.coral)],
            annotations: [etiquetaH(r.rBarra, `R̄ ${f4(r.rBarra)}`, COLOR.verde, { x: 1 }), etiquetaH(r.limiteRangos, `D4 × R̄ = ${f4(r.limiteRangos)}`, COLOR.coral, { x: 1 })],
          },
          respaldo: {
            columnas: ['Pieza', ...est.ops.map((op) => `Rango ${op}`)],
            filas: est.usadas.map((_, j) => [String(j + 1), ...est.ops.map((_, i) => f4(r.rangos[i][j]))]),
          },
        },
      ];

      /* ---- tablas ---- */
      const colValor = { t: `Valor${unidad ? ` (${unidad})` : ''}`, num: true };
      const tablas = [
        {
          titulo: 'Componentes de variación',
          columnas: ['Componente', colValor, { t: '% de contribución', num: true }, { t: '% de la variación del estudio', num: true }],
          filas: [
            ['Repetibilidad (EV)', { texto: f4(r.ev), num: true, formula: true }, { texto: `${num(r.contribEv, 2)} %`, num: true, formula: true }, { texto: p1(r.pctEv), num: true, formula: true }],
            ['Reproducibilidad (AV)', { texto: f4(r.av), num: true, formula: true }, { texto: `${num(r.contribAv, 2)} %`, num: true, formula: true }, { texto: p1(r.pctAv), num: true, formula: true }],
            ['R&R del sistema', { texto: f4(r.rr), num: true, formula: true }, { texto: `${num(r.contribGrr, 2)} %`, num: true, formula: true }, { texto: p1(r.pctGrr), num: true, formula: true }],
            ['Variación entre piezas (PV)', { texto: f4(r.pv), num: true, formula: true }, { texto: `${num(r.contribPv, 2)} %`, num: true, formula: true }, { texto: p1(r.pctPv), num: true, formula: true }],
            ['Variación total (TV)', { texto: f4(r.tv), num: true, formula: true }, { texto: '100.00 %', num: true, formula: true }, { texto: '100.0 %', num: true, formula: true }],
          ],
          resaltar: [2],
          pie: 'La contribución usa varianzas (R&R y piezas suman 100 %); la variación del estudio usa desviaciones, σ del componente ÷ σ total, y no suma 100 %.',
        },
        {
          titulo: 'Cálculo paso a paso (método de promedios y rangos)',
          columnas: ['Cantidad', 'Cómo se obtiene', colValor],
          filas: [
            ['R̄ (rango medio)', `promedio de los ${est.o * est.usadas.length} rangos de las repeticiones`, { texto: f4(r.rBarra), num: true, formula: true }],
            ['EV = R̄ × K1', `${f4(r.rBarra)} × ${r.k1}`, { texto: f4(r.ev), num: true, formula: true }],
            ['X̄diff', 'promedio mayor − promedio menor de los operadores', { texto: f4(r.xDiff), num: true, formula: true }],
            ['AV = √[(X̄diff × K2)² − EV² ÷ (n·r)]', `√[(${f4(r.xDiff)} × ${r.k2})² − ${f4(r.ev)}² ÷ (${r.piezas} × ${r.repeticiones})]`, { texto: f4(r.av), num: true, formula: true }],
            ['R&R = √(EV² + AV²)', `√(${f4(r.ev)}² + ${f4(r.av)}²)`, { texto: f4(r.rr), num: true, formula: true }],
            ['Rp', 'promedio de pieza mayor − menor', { texto: f4(r.rp), num: true, formula: true }],
            ['PV = Rp × K3', `${f4(r.rp)} × ${r.k3}`, { texto: f4(r.pv), num: true, formula: true }],
            ['TV = √(R&R² + PV²)', `√(${f4(r.rr)}² + ${f4(r.pv)}²)`, { texto: f4(r.tv), num: true, formula: true }],
          ],
          pie: `Constantes del AIAG para este diseño: K1 = ${r.k1} (${r.repeticiones} repeticiones) · K2 = ${r.k2} (${r.operadores} operadores) · K3 = ${r.k3} (${r.piezas} piezas).`,
        },
        {
          titulo: 'Promedio y rango medio por operador',
          columnas: ['Operador', { t: `Promedio${unidad ? ` (${unidad})` : ''}`, num: true }, { t: 'Rango medio R̄', num: true }],
          filas: rBarraOp.map((x) => [`Operador ${x.op}`, { texto: f4(x.media), num: true, formula: true }, { texto: f4(x.r), num: true, formula: true }]),
          pie: 'La diferencia entre los promedios alimenta la reproducibilidad (AV); el rango medio, la repetibilidad (EV).',
        },
      ];

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
