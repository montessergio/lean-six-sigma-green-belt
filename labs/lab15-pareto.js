/**
 * LAB 15 · Diagrama de Pareto
 *
 * Guía: M6 §1 y plantilla Excel «Pareto».
 *   El Pareto ordena las categorías de un problema de mayor a menor frecuencia y superpone el porcentaje acumulado,
 *   para separar las «pocas vitales» (las categorías que juntas llegan al 80 %) de las «muchas triviales». La
 *   categoría que cruza el 80 % se incluye: la guía obtiene 84 % con tres categorías y, con los tickets del
 *   Ejercicio 1, 88 %. «Otros» va siempre al final, sea cual sea su tamaño. Prioriza por frecuencia, no por riesgo:
 *   el riesgo se pondera después con el AMEF (LAB 17).
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: las ocho semanas de la guía (25 defectos), los tickets del Ejercicio 1, el ejemplo de la plantilla
 * «Pareto» y la hoja de verificación del LAB 14 con los tres turnos sumados (103 defectos).
 */
import { UMBRAL_PARETO, pareto } from '../js/lib/analizar.js';
import { bandaV } from '../js/lib/graficas.js';
import { corto, entero, num, pct, plural } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';

const CORTE_MIN = 50;
const CORTE_MAX = 99;
/** Registros por debajo de los cuales una barra puede cambiar de lugar con solo un periodo más de datos (referencia didáctica). */
const POCOS_REGISTROS = 30;

const GUIA_RESPALDO = [
  { categoria: 'Continuidad eléctrica', frecuencia: 10 },
  { categoria: 'Etiquetado', frecuencia: 7 },
  { categoria: 'Torque fuera de especificación', frecuencia: 4 },
  { categoria: 'Conector mal asentado', frecuencia: 3 },
  { categoria: 'Ruteo', frecuencia: 1 },
];

const UMBRAL = {
  titulo: 'Cómo leer el Pareto',
  filas: [
    { rango: 'Pocas vitales', texto: 'las categorías que juntas llegan a la línea de corte (80 % por defecto); la que cruza el corte se incluye (guía M6 §1: tres categorías, 84 %; Ejercicio 1: tres categorías, 88 %). Se empieza por la de mayor frecuencia, no por «Otros»' },
    { rango: 'Muchas triviales', texto: 'el resto: numerosas, pero aportan poco; se atienden después o se agrupan (plantilla «Pareto»: columna «Clasificación»)' },
    { rango: 'Casi todas hacen falta', texto: 'si se necesitan todas las categorías (con tres) o todas menos una (con cuatro o más) para llegar al corte, las barras son parejas y el Pareto no separa vitales de triviales: estratifica los datos o revisa la clasificación (referencia didáctica)' },
    { rango: '«Otros» mayor que la primera barra', texto: '«Otros» siempre va al final; si pesa más que la mayor categoría nombrada, la clasificación no separa bien los problemas y conviene reclasificar antes de priorizar (referencia didáctica)' },
    { rango: `Menos de ${POCOS_REGISTROS} registros`, texto: 'con pocos registros el orden de las barras puede cambiar de un periodo a otro sin que el proceso cambie: confirma con más datos antes de comprometer recursos (referencia didáctica)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto:
    'Las categorías son excluyentes y se definieron antes de contar (definición operacional): cada defecto cae en una sola. El periodo de datos es representativo del proceso. ' +
    'La regla 80/20 es una guía, no una ley: cada conjunto de datos da su propio porcentaje (84 % y 88 % en los ejemplos de la guía). ' +
    'El Pareto ordena por frecuencia (o por costo o tiempo si eso se cuenta): no mide severidad ni riesgo. Una categoría muy frecuente puede tener bajo impacto; para eso está el AMEF (LAB 17).',
};

/** Parte una etiqueta larga en líneas de hasta `ancho` caracteres (máximo tres) para que quepa bajo cada barra. */
function envuelve(texto, ancho = 16) {
  const lineas = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/)) {
    if (actual && `${actual} ${palabra}`.length > ancho) {
      lineas.push(actual);
      actual = palabra;
    } else actual = actual ? `${actual} ${palabra}` : palabra;
  }
  lineas.push(actual);
  if (lineas.length > 3) lineas.length = 3, lineas[2] = `${lineas[2].slice(0, ancho - 1)}…`;
  return lineas.join('<br>');
}
const aFila = (c) => ({ categoria: c.categoria, frecuencia: c.frecuencia });
const mayuscula = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

export default function lab15(ctx = {}) {
  const caso = ctx.caso?.pareto;
  const guia = caso?.guia?.categorias?.length ? caso.guia : { unidad: 'defectos', categorias: GUIA_RESPALDO };
  const tickets = caso?.tickets?.categorias?.length ? caso.tickets : null;
  const excel = caso?.excel?.categorias?.length ? caso.excel : null;
  const hojaExcel = ctx.caso?.hojaVerificacion?.excel?.categorias;
  const hoja = hojaExcel?.length
    ? hojaExcel.map((c) => ({ categoria: c.categoria, frecuencia: (c.conteos ?? []).reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0) }))
    : null;

  const presets = [
    {
      id: 'guia', etiqueta: 'Guía M6 §1: arneses, 8 semanas (25 defectos)',
      ayuda: 'Ocho semanas acumuladas de la hoja de verificación del M4. Continuidad eléctrica, etiquetado y torque reúnen el 84 % de los defectos: son las pocas vitales, y se empieza por la de mayor frecuencia. Con solo 25 defectos conviene confirmar el orden con más datos.',
      valores: { unidad: guia.unidad ?? 'defectos', categorias: guia.categorias.map(aFila), corte: UMBRAL_PARETO * 100 },
    },
    ...(tickets
      ? [{
        id: 'tickets', etiqueta: 'Guía Ej. 1: tickets de soporte (100)',
        ayuda: 'Ejercicio 1 de la guía: 100 tickets de un mes. Las tres primeras categorías reúnen el 88 %; se empieza por los problemas de acceso (45 %), no por «Otros», aunque esa categoría exista.',
        valores: { unidad: tickets.unidad ?? 'tickets', categorias: tickets.categorias.map(aFila), corte: UMBRAL_PARETO * 100 },
      }]
      : []),
    ...(excel
      ? [{
        id: 'excel', etiqueta: 'Plantilla Excel «Pareto» (100 registros)',
        ayuda: 'Hoja «Pareto»: seis causas con 100 registros; las tres primeras llegan al 82 %. La plantilla ordena solo por frecuencia: aquí «Otros» va siempre al final, aunque tenga más registros que otra categoría.',
        valores: { unidad: excel.unidad ?? 'registros', categorias: excel.categorias.map(aFila), corte: UMBRAL_PARETO * 100 },
      }]
      : []),
    ...(hoja
      ? [{
        id: 'hoja', etiqueta: 'Hoja de verificación del LAB 14 (103 defectos)',
        ayuda: 'Las seis categorías de la hoja de verificación del LAB 14 con los tres turnos sumados. El torque (35) y la terminal mal crimpada (34) casi empatan; tres categorías reúnen el 81.6 %. El Pareto dice qué atacar primero, no por qué: el reparto por turno está en el LAB 14.',
        valores: { unidad: 'defectos', categorias: hoja, corte: UMBRAL_PARETO * 100 },
      }]
      : []),
  ];

  return {
    id: 'lab15',
    numero: '15',
    modulo: 'M6',
    titulo: 'Diagrama de Pareto',
    resumen: 'Ordena las categorías de mayor a menor, calcula el porcentaje acumulado y marca las pocas vitales que juntas llegan al 80 %: dónde conviene concentrar el análisis.',
    entradas: [
      {
        id: 'unidad', tipo: 'texto', etiqueta: '¿Qué se cuenta?', valor: guia.unidad ?? 'defectos', marcador: 'defectos, tickets, minutos, pesos…',
        ayuda: 'Solo rotula las gráficas y las tablas. El Pareto funciona igual con conteos, costos o tiempos.',
      },
      {
        id: 'categorias', tipo: 'tabla', etiqueta: 'Categorías y su frecuencia',
        columnas: [
          { id: 'categoria', etiqueta: 'Categoría', tipo: 'texto', ancho: '206px' },
          { id: 'frecuencia', etiqueta: 'Frecuencia', tipo: 'numero', min: 0, ancho: '88px', ayuda: 'Cuántas veces ocurrió (o el costo o los minutos). Una frecuencia de 0 no aparece en el diagrama.' },
        ],
        filas: guia.categorias.map(aFila), filaNueva: { categoria: '', frecuencia: NaN }, minFilas: 1, maxFilas: 12, filasVacias: 6, etiquetaAgregar: '+ Categoría',
        ayuda: 'Hasta 12 categorías (como la plantilla). Pon «Otros» como una categoría más: se dibuja siempre al final.',
      },
      {
        id: 'corte', tipo: 'numero', etiqueta: 'Línea de corte (% acumulado)', valor: UMBRAL_PARETO * 100, min: CORTE_MIN, max: CORTE_MAX, unidad: '%', marcador: '80',
        ayuda: `La regla 80/20 es una guía: 80 % por defecto, entre ${CORTE_MIN} y ${CORTE_MAX} %.`,
      },
    ],
    presets,
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      'Si solo tuvieras recursos para atacar dos categorías, ¿cuáles elegirías y llegarías al 80 %? ¿Qué harías con la tercera?',
      'El Pareto cuenta frecuencia, no impacto. ¿Cómo cambiaría el orden si cada categoría se ponderara por su costo o por su severidad? Compáralo con el AMEF del LAB 17.',
      'Cuando las barras salen parejas, ¿por qué estratificarías los datos (por turno, máquina o proveedor) y volverías a dibujar el Pareto?',
      '¿Qué te dice una categoría «Otros» muy grande sobre la forma en que se clasificaron los datos? ¿Cuándo la reclasificarías?',
      '¿Cuántos registros más reunirías antes de comprometer recursos con la barra mayor? ¿Qué pasaría si la primera y la segunda barra cambiaran de lugar por azar?',
    ],

    calcular(e) {
      const aviso = [];
      const unidad = String(e.unidad ?? '').trim() || 'registros';
      const Unidad = mayuscula(unidad);

      let corte = Number.isFinite(e.corte) ? e.corte : UMBRAL_PARETO * 100;
      if (!(corte >= CORTE_MIN && corte <= CORTE_MAX)) {
        aviso.push(`La línea de corte debe estar entre ${CORTE_MIN} % y ${CORTE_MAX} %: se usó ${num(UMBRAL_PARETO * 100, 0)} %.`);
        corte = UMBRAL_PARETO * 100;
      }
      const r = pareto(e.categorias, { umbral: corte / 100 });

      const d = r.descartadas;
      if (d.negativas) aviso.push(`Frecuencias negativas ignoradas: ${entero(d.negativas)}. Una frecuencia es un conteo, un costo o un tiempo, desde 0.`);
      if (d.sinFrecuencia) aviso.push(`Categorías sin frecuencia (no se incluyeron): ${entero(d.sinFrecuencia)}. Escribe la frecuencia o quita la fila.`);
      if (d.ceros) aviso.push(`${plural(d.ceros, 'categoría con frecuencia 0 no aparece', 'categorías con frecuencia 0 no aparecen')} en el diagrama.`);
      if (r.sinNombre) aviso.push(`Filas con frecuencia y sin nombre (aparecen como «(sin nombre)»): ${entero(r.sinNombre)}.`);
      if (r.repetidas) aviso.push('Hay categorías con el mismo nombre; se muestran numeradas: (2), (3)… Si son la misma categoría, suma sus frecuencias en una sola fila.');

      if (!r.valido) {
        return {
          aviso,
          vacio: 'Captura al menos una categoría con su frecuencia (mayor que 0) para ver el Pareto, el porcentaje acumulado y las pocas vitales.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: aviso.length ? 'Revisa el aviso sobre la captura.' : 'Sin categorías capturadas.' }],
        };
      }

      const n = r.categorias.length;
      const total = r.total;
      const f = (v) => corto(v, 2);
      const vitales = r.categorias.filter((c) => c.vital);
      const mayor = r.categorias[0];
      const nombresVitales = vitales.map((c) => `«${c.categoria}»`);

      /* ---- salidas ---- */
      const salidas = [
        { id: 'total', etiqueta: `Total de ${unidad}`, valor: f(total), color: 'teal', nota: plural(n, 'categoría') },
        {
          id: 'vitales', etiqueta: 'Pocas vitales', valor: `${entero(r.nVitales)} de ${entero(n)}`, color: 'azul',
          nota: `${plural(r.nVitales, 'categoría reúne', 'categorías reúnen')} el ${pct(r.pctVitales, 1)} (corte ${num(corte, 0)} %)`,
        },
        { id: 'mayor', etiqueta: 'Categoría mayor', valor: mayor.categoria, pequeno: true, ancha: true, nota: `${f(mayor.frecuencia)} ${unidad} · ${pct(mayor.pct, 1)} del total` },
      ];
      if (r.otros) salidas.push({ id: 'otros', etiqueta: '«Otros»', valor: pct(r.otros.pct, 1), nota: 'se dibuja al final, sea cual sea su tamaño' });

      /* ---- semáforos ---- */
      const semaforos = [];
      const casiTodas = (n >= 3 && r.nVitales === n) || (n >= 4 && r.nVitales === n - 1);
      if (n === 1) {
        semaforos.push({ nombre: 'Pocas vitales', estado: 'informativo', texto: 'Con una sola categoría no hay nada que priorizar: captura las demás categorías del problema.' });
      } else if (casiTodas) {
        semaforos.push({
          nombre: 'Pocas vitales', estado: 'atencion',
          texto: `Hacen falta ${entero(r.nVitales)} de ${entero(n)} categorías para llegar al ${num(corte, 0)} %: las barras son parejas y el Pareto no separa pocas vitales de muchas triviales. Estratifica los datos (turno, máquina, lote) o revisa la clasificación.`,
        });
      } else {
        semaforos.push({
          nombre: 'Pocas vitales', estado: 'cumple',
          texto: `${plural(r.nVitales, 'categoría', 'categorías')} (de ${entero(n)}) reúne${r.nVitales === 1 ? '' : 'n'} el ${pct(r.pctVitales, 1)}: ${nombresVitales.join(', ')}. Ahí conviene concentrar el análisis, empezando por «${mayor.categoria}», la de mayor frecuencia.`,
        });
      }
      let otrosGrande = false;
      if (r.otros) {
        otrosGrande = r.otros.mayorQueNombradas;
        semaforos.push(
          otrosGrande
            ? {
              nombre: 'Categoría «Otros»', estado: 'atencion',
              texto: `«Otros» reúne el ${pct(r.otros.pct, 1)} y supera a la mayor categoría nombrada (${pct(mayor.esOtros ? NaN : mayor.pct, 1)}): la clasificación no está separando bien los problemas. Reclasifica antes de priorizar.`,
            }
            : { nombre: 'Categoría «Otros»', estado: 'informativo', texto: `«Otros» pesa ${pct(r.otros.pct, 1)} y se dibuja al final, sea cual sea su tamaño. Si crece, reclasifícala.` }
        );
      }
      const pocos = n > 1 && total < POCOS_REGISTROS;
      if (pocos) {
        semaforos.push({
          nombre: 'Pocos registros', estado: 'informativo',
          texto: `Con ${f(total)} ${unidad} el orden de las barras puede cambiar de un periodo a otro sin que el proceso cambie (menos de ${POCOS_REGISTROS}; referencia didáctica). Confirma con más datos antes de comprometer recursos.`,
        });
      }

      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((fila, i) => ({ ...fila, activa: [n > 1 && !casiTodas, n > 1 && r.nVitales < n, casiTodas, otrosGrande, pocos][i] })),
      };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Antes de priorizar, confirma que las categorías son excluyentes y que el periodo de datos es representativo; una frecuencia alta no siempre es un riesgo alto.' };

      /* ---- gráfica: barras (vital / trivial) + línea de acumulado en un segundo eje ---- */
      const unicos = r.categorias.map((c) => envuelve(c.etiqueta));
      const grande = Math.max(1, total);
      const detalle = r.categorias.map((c) => [pct(c.pct, 1), pct(c.acum, 1), c.etiqueta]);
      const barras = (nombre, color, esVital) => ({
        type: 'bar', name: nombre, x: unicos, y: r.categorias.map((c) => (c.vital === esVital ? c.frecuencia : null)),
        marker: { color, line: { width: 0 } }, customdata: detalle,
        text: r.categorias.map((c) => (c.vital === esVital && c.frecuencia / grande >= 0.08 ? f(c.frecuencia) : '')),
        textposition: 'inside', textangle: 0, insidetextanchor: 'middle', insidetextfont: { color: '#0a1011', size: 11 }, cliponaxis: false,
        hovertemplate: `%{customdata[2]}<br>%{y} ${unidad} · %{customdata[0]} del total<br>acumulado %{customdata[1]}<extra></extra>`,
      });
      const datos = [
        barras('Pocas vitales', COLOR.teal, true),
        barras('Muchas triviales', COLOR.gris, false),
        {
          type: 'scatter', mode: 'lines+markers+text', name: '% acumulado', x: unicos, y: r.categorias.map((c) => 100 * c.acum), yaxis: 'y2',
          line: { color: COLOR.ambar, width: 2 }, marker: { color: COLOR.ambar, size: 7, line: { color: '#0a1011', width: 1 } },
          text: r.categorias.map((c) => `${corto(100 * c.acum, 1)} %`), textposition: 'top center', textfont: { color: COLOR.ambar, size: 11 },
          customdata: detalle, cliponaxis: false, hovertemplate: '%{customdata[2]}<br>acumulado %{y:.1f} %<extra></extra>',
        },
      ];
      const shapes = [
        { type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y2', y0: corte, y1: corte, line: { color: COLOR.ambar, width: 1.5, dash: 'dash' }, layer: 'below' },
      ];
      if (r.nVitales > 0) shapes.push(bandaV(-0.5, r.nVitales - 0.5, COLOR.teal, 0.07));
      const graficas = [
        {
          id: 'pareto', titulo: `Diagrama de Pareto (${unidad})`, ancha: true,
          datos,
          layout: {
            barmode: 'overlay', bargap: 0.18, shapes,
            xaxis: { type: 'category', categoryorder: 'array', categoryarray: unicos },
            yaxis: { title: { text: Unidad }, range: [0, grande], rangemode: 'tozero' },
            yaxis2: {
              overlaying: 'y', side: 'right', range: [0, 100], showgrid: false, ticksuffix: ' %', tickvals: [0, 20, 40, 60, 80, 100], automargin: true,
              tickfont: { size: 11, color: COLOR.gris }, linecolor: COLOR.linea2, tickcolor: COLOR.linea2, title: { text: '% acumulado', font: { size: 12, color: COLOR.gris }, standoff: 8 },
            },
            margin: { l: 56, r: 56, t: 18, b: 48 },
          },
          respaldo: {
            columnas: ['Categoría', Unidad, '% del total', '% acumulado', 'Clasificación'],
            filas: r.categorias.map((c) => [c.etiqueta, f(c.frecuencia), pct(c.pct, 1), pct(c.acum, 1), c.vital ? 'Poca vital' : 'Muchas triviales']),
          },
        },
      ];

      /* ---- tabla ---- */
      const calc = (texto) => ({ texto, num: true, formula: true });
      const filasTabla = r.categorias.map((c) => [{ texto: String(c.lugar), num: true }, c.etiqueta, { texto: f(c.frecuencia), num: true }, calc(pct(c.pct, 1)), calc(pct(c.acum, 1)), calc(c.vital ? 'Poca vital' : 'Muchas triviales')]);
      filasTabla.push(['', 'TOTAL', calc(f(total)), calc('100.0 %'), '', '']);
      const tablas = [
        {
          titulo: 'El Pareto, paso a paso',
          columnas: [{ t: '#', num: true }, 'Categoría', { t: Unidad, num: true }, { t: '% del total', num: true }, { t: '% acumulado', num: true }, 'Clasificación'],
          filas: filasTabla,
          resaltar: [...vitales.map((c) => c.lugar - 1), filasTabla.length - 1],
          pie: `El % acumulado suma los porcentajes hasta esa fila. Una categoría es «poca vital» si el acumulado anterior es menor que el corte (${num(corte, 0)} %): por eso la que cruza el corte se incluye. Las filas resaltadas son las pocas vitales y el total.`,
        },
      ];

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
