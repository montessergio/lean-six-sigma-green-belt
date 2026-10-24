/**
 * LAB 14 · Hoja de verificación (check sheet de conteo)
 *
 * Guía: M4 §6–7 y plantilla Excel «Hoja de Verificacion».
 *   La hoja de verificación es el formulario donde se registra, en el momento y lugar en que ocurre, cuántas veces
 *   se presenta cada categoría de defecto. Se estratifica (turno, máquina, operador…) para poder cruzar los datos
 *   en la fase Analizar y alimenta al diagrama de Pareto. No es un checklist: cuenta la frecuencia de un evento, no
 *   confirma que se completaron los pasos de un procedimiento.
 *   Con las unidades inspeccionadas y las oportunidades por unidad se obtiene el DPMO: defectos ÷ (unidades ×
 *   oportunidades) × 10⁶ (la guía: 3 defectos en 2,000 arneses con 5 oportunidades = 300 DPMO).
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: la semana de la guía (3 defectos, 300 DPMO) y las seis categorías de la plantilla Excel (103 defectos).
 */
import { MAX_ESTRATOS, MIN_ESPERADO, concentraciones, etiquetasUnicas, minimoCategoria, ordenPareto, resumenHoja } from '../js/lib/medir.js';
import { metricasDefectos } from '../js/lib/stats.js';
import { cifras, corto, dpmo, entero, num, pct, plural } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';

/** Qué se estratifica; el estrato se numera: «Turno 1», «Máquina 2»… */
const ESTRATOS = {
  Turno: { singular: 'turno', plural: 'turnos' },
  Máquina: { singular: 'máquina', plural: 'máquinas' },
  Operador: { singular: 'operador', plural: 'operadores' },
  Proveedor: { singular: 'proveedor', plural: 'proveedores' },
};
const COLORES = [COLOR.teal, COLOR.azul, COLOR.ambar, COLOR.coral, COLOR.violeta];
const CLAVES = Array.from({ length: MAX_ESTRATOS }, (_, j) => `e${j + 1}`);

/** Respaldo si no llega el caso: la hoja de la semana de la guía (M4 §7). */
const GUIA_RESPALDO = [
  { categoria: 'Continuidad eléctrica', conteos: [1, 0, 0] },
  { categoria: 'Torque fuera de especificación', conteos: [0, 1, 0] },
  { categoria: 'Conector mal asentado', conteos: [0, 0, 0] },
  { categoria: 'Etiquetado', conteos: [0, 0, 1] },
  { categoria: 'Ruteo', conteos: [0, 0, 0] },
];

const UMBRAL = {
  titulo: 'Cómo leer la hoja',
  filas: [
    { rango: `Menos de ${MIN_ESPERADO} defectos por estrato`, texto: `el reparto puede cambiar mucho de una semana a otra sin que el proceso cambie: aún no hay base para comparar estratos (referencia didáctica: la regla de ${MIN_ESPERADO} defectos esperados por celda que usa la chi-cuadrada)` },
    { rango: 'Sin concentración', texto: 'ninguna categoría con defectos suficientes reúne la mitad de ellos en un solo estrato' },
    { rango: 'Categoría concentrada', texto: `un estrato reúne la mitad o más de los defectos de una categoría (y al menos 1.5 veces lo que le tocaría en un reparto parejo), con ${MIN_ESPERADO} defectos por estrato en esa categoría. Es un indicio descriptivo (referencia didáctica), no una prueba estadística: esas pruebas llegan en la Sesión 4` },
    { rango: 'DPMO', texto: 'defectos ÷ (unidades × oportunidades) × 1,000,000 (guía M1 §6)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto:
    'Cada marca es un defecto contado en el momento y el lugar donde ocurre, no una pieza defectuosa: una pieza con dos defectos suma dos. Todos cuentan con la misma definición operacional y las categorías se acuerdan antes de contar. ' +
    'Comparar estratos con conteos supone que produjeron volúmenes parecidos; si no, compara defectos por unidad de cada estrato. ' +
    'La hoja cuenta la frecuencia de un evento; un checklist solo confirma que se completaron los pasos de un procedimiento.',
};

const recorta = (texto, n = 34) => (texto.length > n ? `${texto.slice(0, n - 1)}…` : texto);
const tipoDe = (e) => (Object.hasOwn(ESTRATOS, e?.estrato) ? e.estrato : 'Turno');
const cuantosDe = (e) => {
  const k = Number(e?.numEstratos);
  return Number.isInteger(k) && k >= 2 && k <= MAX_ESTRATOS ? k : 3;
};

/** Columnas de la tabla: la categoría y un conteo por estrato (dependen del tipo y del número de estratos elegidos). */
const columnas = (estado) => {
  const tipo = tipoDe(estado);
  return [
    { id: 'categoria', etiqueta: 'Categoría de defecto', tipo: 'texto', ancho: '244px' },
    ...CLAVES.slice(0, cuantosDe(estado)).map((id, j) => ({
      id, etiqueta: `${tipo} ${j + 1}`, tipo: 'numero', min: 0, ancho: '76px', ayuda: `Defectos de esta categoría en ${ESTRATOS[tipo].singular} ${j + 1}; escribe 0 si no hubo`,
    })),
  ];
};

const filaNueva = { categoria: '', ...Object.fromEntries(CLAVES.map((id) => [id, NaN])) };
const aFila = (c) => ({ categoria: c.categoria, ...Object.fromEntries(CLAVES.map((id, j) => [id, c.conteos?.[j] ?? NaN])) });

export default function lab14(ctx = {}) {
  const hoja = ctx.caso?.hojaVerificacion;
  const guia = hoja?.guia;
  const filasGuia = (guia?.categorias?.length ? guia.categorias : GUIA_RESPALDO).map(aFila);
  const filasExcel = hoja?.excel?.categorias?.length ? hoja.excel.categorias.map(aFila) : null;
  const unidadesGuia = guia?.unidades ?? 2000;
  const oportunidadesGuia = guia?.oportunidades ?? 5;
  const base = { estrato: 'Turno', numEstratos: '3' };

  const presets = [
    {
      id: 'guia', etiqueta: 'Guía M4 §7: una semana (3 defectos)',
      ayuda: 'Hoja de tipo conteo de una semana de producción: 1 defecto por turno, 3 en 2,000 arneses con 5 oportunidades cada uno = 300 DPMO. El reparto es parejo, pero con tan pocos defectos no hay base para comparar turnos.',
      valores: { ...base, categorias: filasGuia, unidades: unidadesGuia, oportunidades: oportunidadesGuia },
    },
    ...(filasExcel
      ? [{
        id: 'excel', etiqueta: 'Plantilla Excel: 6 categorías × 3 turnos (103)',
        ayuda: 'Hoja «Hoja de Verificacion»: 103 defectos en seis categorías. El torque fuera de especificación se concentra en el turno 3 (21 de 35): la conversación debe ir al porqué del proceso, no al quién. La plantilla no trae unidades ni oportunidades, por eso no hay DPMO.',
        valores: { ...base, categorias: filasExcel, unidades: NaN, oportunidades: NaN },
      }]
      : []),
  ];

  return {
    id: 'lab14',
    numero: '14',
    modulo: 'M4',
    titulo: 'Hoja de verificación (check sheet)',
    resumen: 'Cuenta los defectos por categoría y por turno (o máquina, operador, proveedor), calcula totales y porcentajes, muestra dónde se concentran y, si indicas unidades y oportunidades, el DPMO.',
    panelAncho: true,
    entradas: [
      {
        id: 'estrato', tipo: 'opcion', etiqueta: 'Estratificar por', valor: 'Turno',
        opciones: Object.keys(ESTRATOS).map((t) => ({ valor: t, texto: t })),
        ayuda: 'La estratificación registra junto con cada conteo el turno, la máquina, el operador o el proveedor, para poder cruzarlos después en la fase Analizar.',
      },
      {
        id: 'numEstratos', tipo: 'opcion', etiqueta: 'Número de estratos', valor: '3',
        opciones: ['2', '3', '4', '5'].map((n) => ({ valor: n, texto: n })),
      },
      {
        id: 'categorias', tipo: 'tabla', etiqueta: 'Defectos contados por categoría',
        columnas, filas: filasGuia, filaNueva, minFilas: 1, maxFilas: 12, filasVacias: 6, etiquetaAgregar: '+ Categoría',
        ayuda: 'Una fila por categoría de defecto y un conteo por estrato. Solo enteros desde 0; escribe 0 cuando no hubo defectos. Una pieza con dos defectos suma dos marcas.',
      },
      { tipo: 'seccion', etiqueta: 'Opcional · de defectos a DPMO' },
      { id: 'unidades', tipo: 'numero', etiqueta: 'Unidades inspeccionadas', valor: unidadesGuia, min: 0, marcador: 'p. ej. 2000', ayuda: 'Piezas producidas o inspeccionadas durante el periodo de la hoja.' },
      { id: 'oportunidades', tipo: 'numero', etiqueta: 'Oportunidades de defecto por unidad', valor: oportunidadesGuia, min: 0, marcador: 'p. ej. 5', ayuda: 'Verificaciones o características de cada unidad donde podría aparecer un defecto.' },
    ],
    presets,
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Qué categorías de defecto acordarías antes de empezar a contar y cómo las definirías para que dos personas cuenten igual el mismo defecto (definición operacional)?',
      'Si un turno concentra más defectos, ¿qué tres preguntas harías para llegar a la causa del proceso en lugar de a la persona? ¿Cómo le explicarías al turno que los datos evalúan al proceso y no a ellos?',
      '¿Los estratos produjeron lo mismo? Si el turno 3 hizo la mitad de piezas, ¿cambia la lectura de sus conteos? ¿Qué cifra compararías en su lugar?',
      '¿Qué te dice una categoría «Otro» muy grande sobre la hoja? ¿Cuándo agregarías una categoría nueva?',
      '¿En qué se distingue esta hoja de un checklist? ¿Cuál usarías para verificar que se cumplió un procedimiento y cuál para contar fallas?',
    ],

    calcular(e) {
      const k = cuantosDe(e);
      const tipo = tipoDe(e);
      const palabras = ESTRATOS[tipo];
      const etiquetas = Array.from({ length: k }, (_, j) => `${tipo} ${j + 1}`);
      const r = resumenHoja(e.categorias, { estratos: k });

      const aviso = [];
      if (r.celdasInvalidas) aviso.push(`Celdas ignoradas por no ser enteros desde 0: ${entero(r.celdasInvalidas)}.`);
      if (r.sinNombre) aviso.push(`Filas con conteos y sin nombre de categoría (aparecen como «(sin nombre)»): ${entero(r.sinNombre)}.`);
      if (r.sinConteo) aviso.push(`Categorías sin ningún conteo (no se incluyeron; escribe 0 si no hubo defectos): ${entero(r.sinConteo)}.`);

      if (!r.valido) {
        return {
          aviso,
          vacio: 'Captura al menos una categoría de defecto con sus conteos (escribe 0 si no hubo defectos) para ver los totales, el reparto y el DPMO.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: aviso.length ? 'Revisa el aviso sobre la captura.' : 'Sin conteos capturados.' }],
        };
      }

      const { total } = r;
      const minimo = minimoCategoria(k);
      const pequena = total < minimo;
      const conc = pequena ? [] : concentraciones(r);
      const evaluables = r.categorias.filter((c) => c.total >= minimo).length;

      /* ---- DPMO (opcional) ---- */
      const hayU = Number.isFinite(e.unidades);
      const hayO = Number.isFinite(e.oportunidades);
      let m = null;
      if (hayU !== hayO) {
        aviso.push('Para calcular el DPMO captura las unidades inspeccionadas y las oportunidades de defecto por unidad.');
      } else if (hayU && hayO) {
        const candidata = metricasDefectos({ unidades: e.unidades, oportunidades: e.oportunidades, defectos: total });
        if (!candidata.completo) aviso.push('Las unidades y las oportunidades por unidad deben ser mayores que cero: no se calculó el DPMO.');
        else if (total > e.unidades * e.oportunidades) aviso.push(`Hay más defectos (${entero(total)}) que oportunidades (${entero(e.unidades * e.oportunidades)}): revisa las unidades y las oportunidades por unidad. No se calculó el DPMO.`);
        else m = candidata;
      }

      /* ---- salidas ---- */
      const mayorTotal = Math.max(...r.categorias.map((c) => c.total));
      const mayores = r.categorias.filter((c) => c.total === mayorTotal);
      const salidas = [
        { id: 'total', etiqueta: 'Total de defectos', valor: entero(total), color: 'teal', nota: `${plural(r.categorias.length, 'categoría')} · ${plural(k, palabras.singular, palabras.plural)}` },
        {
          id: 'por-estrato', etiqueta: `Defectos por ${palabras.singular}`, valor: r.totalesEstrato.map(entero).join(' · '),
          nota: total > 0 ? `${r.pctEstrato.map((p) => pct(p, 1)).join(' · ')} del total` : 'sin defectos registrados',
        },
      ];
      if (mayorTotal > 0) {
        salidas.push(
          mayores.length === 1
            ? { id: 'mayor', etiqueta: 'Categoría con más defectos', valor: mayores[0].categoria, pequeno: true, ancha: true, nota: `${plural(mayorTotal, 'defecto')} · ${pct(mayores[0].pct, 1)} del total` }
            : { id: 'mayor', etiqueta: 'Categoría con más defectos', valor: `${entero(mayores.length)} categorías empatadas`, pequeno: true, ancha: true, nota: `con ${plural(mayorTotal, 'defecto')} cada una` }
        );
      }
      if (m) {
        salidas.push(
          { id: 'dpmo', etiqueta: 'DPMO de la hoja', valor: dpmo(m.dpmo), color: 'azul', nota: `${entero(total)} ÷ (${corto(e.unidades, 2)} × ${corto(e.oportunidades, 2)}) × 10⁶` },
          { id: 'dpu', etiqueta: 'Defectos por unidad (DPU)', valor: cifras(m.dpu, 3), nota: `${entero(total)} defectos ÷ ${corto(e.unidades, 2)} unidades` }
        );
        if (Number.isFinite(m.sigma)) salidas.push({ id: 'sigma', etiqueta: 'Nivel sigma equivalente', valor: num(m.sigma, 2), nota: 'con el desplazamiento de 1.5σ (como en el LAB 04)' });
      }

      /* ---- semáforos ---- */
      const semaforos = [];
      if (total > 0) {
        const parejo = r.totalesEstrato.every((t) => t === r.totalesEstrato[0]);
        semaforos.push({
          nombre: `Reparto por ${palabras.singular}`, estado: 'informativo',
          texto: parejo
            ? `Reparto parejo: ${plural(r.totalesEstrato[0], 'defecto')} en cada ${palabras.singular}, ${pct(1 / k, 1)} del total por ${palabras.singular}.`
            : `${etiquetas.map((et, j) => `${et} ${pct(r.pctEstrato[j], 1)}`).join(' · ')}. Un reparto parejo daría ${pct(1 / k, 1)} por ${palabras.singular}.`,
        });
      }
      if (total === 0) {
        semaforos.push({ nombre: 'Sin defectos', estado: 'informativo', texto: 'La hoja no registra ningún defecto: no hay reparto que analizar.' });
      } else if (pequena) {
        semaforos.push({
          nombre: 'Pocos defectos', estado: 'informativo',
          texto: `Con ${plural(total, 'defecto')} (menos de ${MIN_ESPERADO} por ${palabras.singular}) el reparto puede cambiar mucho de una semana a otra sin que el proceso haya cambiado: aún no hay base para comparar ${palabras.plural}.`,
        });
      } else if (conc.length) {
        semaforos.push({
          nombre: 'Categoría concentrada', estado: 'atencion',
          texto:
            `${conc.map((c) => `«${recorta(c.categoria, 48)}» tiene ${pct(c.pct, 1)} de sus defectos en ${etiquetas[c.estrato]} (${entero(c.valor)} de ${entero(c.total)})`).join('; ')}; un reparto parejo daría ${pct(1 / k, 1)}. ` +
            'Es un indicio, no un veredicto: pregunta por qué el proceso permite ese resultado (los 5 Porqués de la Sesión 4), no quién lo hizo.',
        });
      } else if (evaluables === 0) {
        semaforos.push({ nombre: 'Categoría concentrada', estado: 'informativo', texto: `Ninguna categoría reúne ${minimo} defectos (${MIN_ESPERADO} por ${palabras.singular}): todavía no se puede hablar de concentración por categoría.` });
      } else {
        semaforos.push({ nombre: 'Categoría concentrada', estado: 'informativo', texto: `Entre las categorías con ${minimo} o más defectos (${entero(evaluables)}), ninguna reúne la mitad de ellos en un solo ${palabras.singular}.` });
      }

      const activa = pequena ? 0 : conc.length ? 2 : 1;
      const umbral = { ...UMBRAL, filas: UMBRAL.filas.map((f, i) => ({ ...f, activa: i < 3 ? i === activa : m !== null })) };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: `Antes de leer el reparto, confirma que los ${palabras.plural} produjeron volúmenes parecidos y que todos contaron con la misma definición de defecto.` };

      /* ---- gráficas (orden de Pareto: de mayor a menor, «Otro» al final) ---- */
      const orden = ordenPareto(r.categorias);
      const nombresY = etiquetasUnicas(orden.map((c) => recorta(c.etiqueta)));
      const grande = Math.max(1, mayorTotal);
      const graficas = [
        {
          id: 'categorias', titulo: `Defectos por categoría y ${palabras.singular} (de mayor a menor)`, ancha: true, alta: orden.length > 8,
          datos: etiquetas.map((et, j) => ({
            type: 'bar', orientation: 'h', name: et,
            x: orden.map((c) => c.conteos[j]), y: nombresY,
            marker: { color: COLORES[j], line: { width: 0 } },
            text: orden.map((c) => (c.conteos[j] / grande >= 0.06 ? entero(c.conteos[j]) : '')),
            textposition: 'inside', insidetextanchor: 'middle', insidetextfont: { color: '#0a1011', size: 11 },
            hovertemplate: `%{y}<br>${et}: %{x} defectos<extra></extra>`,
          })),
          layout: {
            barmode: 'stack', bargap: 0.3, legend: { traceorder: 'normal' },
            xaxis: { rangemode: 'tozero', title: { text: 'defectos' }, ...(grande <= 10 ? { dtick: 1 } : {}) },
            yaxis: { autorange: 'reversed', categoryorder: 'array', categoryarray: nombresY },
          },
          respaldo: { columnas: ['Categoría', ...etiquetas, 'Total'], filas: orden.map((c) => [c.etiqueta, ...c.conteos.map(entero), entero(c.total)]) },
        },
      ];
      const conDefectos = orden.filter((c) => c.total > 0);
      if (conDefectos.length) {
        const nombres2 = etiquetasUnicas(conDefectos.map((c) => `${recorta(c.etiqueta, 28)} (${entero(c.total)})`));
        graficas.push({
          id: 'reparto', titulo: `Cómo se reparte cada categoría entre ${palabras.plural} (% de sus defectos; entre paréntesis, el total)`, ancha: true, alta: conDefectos.length > 8,
          datos: etiquetas.map((et, j) => ({
            type: 'bar', orientation: 'h', name: et,
            x: conDefectos.map((c) => 100 * c.pctEstrato[j]), y: nombres2,
            customdata: conDefectos.map((c) => [c.conteos[j], c.total]),
            marker: { color: COLORES[j], line: { width: 0 } },
            text: conDefectos.map((c) => (100 * c.pctEstrato[j] >= 9 ? `${corto(100 * c.pctEstrato[j], 0)} %` : '')),
            textposition: 'inside', insidetextanchor: 'middle', insidetextfont: { color: '#0a1011', size: 11 },
            hovertemplate: `%{y}<br>${et}: %{customdata[0]} de %{customdata[1]} defectos (%{x:.1f} %)<extra></extra>`,
          })),
          layout: {
            barmode: 'stack', bargap: 0.3, legend: { traceorder: 'normal' },
            xaxis: { range: [0, 100], title: { text: '% de los defectos de la categoría' } },
            yaxis: { autorange: 'reversed', categoryorder: 'array', categoryarray: nombres2 },
          },
          respaldo: { columnas: ['Categoría', ...etiquetas.map((et) => `% ${et}`), 'Defectos'], filas: conDefectos.map((c) => [c.etiqueta, ...c.pctEstrato.map((p) => pct(p, 1)), entero(c.total)]) },
        });
      }

      /* ---- tablas ---- */
      const celda = (v) => ({ texto: entero(v), num: true });
      const calc = (texto) => ({ texto, num: true, formula: true });
      const filasHoja = r.categorias.map((c) => [c.categoria, ...c.conteos.map(celda), calc(entero(c.total)), calc(pct(c.pct, 1))]);
      filasHoja.push(['TOTAL', ...r.totalesEstrato.map((t) => calc(entero(t))), calc(entero(total)), calc(total > 0 ? '100.0 %' : '—')]);
      const tablas = [
        {
          titulo: 'La hoja de verificación',
          columnas: ['Categoría de defecto', ...etiquetas.map((t) => ({ t, num: true })), { t: 'Total', num: true }, { t: '% del total', num: true }],
          filas: filasHoja, resaltar: [filasHoja.length - 1],
          pie: 'Las columnas «Total» y «% del total» son las fórmulas de la plantilla «Hoja de Verificacion».',
        },
      ];
      if (m) {
        const filasDpmo = [
          ['Defectos registrados', 'suma de la hoja', calc(entero(total))],
          ['Unidades inspeccionadas', 'captura', celda(e.unidades)],
          ['Oportunidades por unidad', 'captura', celda(e.oportunidades)],
          ['Oportunidades totales', 'unidades × oportunidades', calc(entero(e.unidades * e.oportunidades))],
          ['DPU', 'defectos ÷ unidades', calc(cifras(m.dpu, 3))],
          ['DPO', 'defectos ÷ oportunidades totales', calc(cifras(m.dpo, 3))],
          ['DPMO', 'DPO × 1,000,000', calc(dpmo(m.dpmo))],
        ];
        if (Number.isFinite(m.sigma)) filasDpmo.push(['Nivel sigma', 'Z + 1.5, como en el LAB 04', calc(num(m.sigma, 2))]);
        tablas.push({
          titulo: 'De defectos a DPMO',
          columnas: ['Cantidad', 'Cómo se obtiene', { t: 'Valor', num: true }],
          filas: filasDpmo, resaltar: [6],
          pie: 'La hoja cuenta defectos; el DPMO los relaciona con las oportunidades de fallar (guía M1 §6 y M4 §7).',
        });
      }

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
