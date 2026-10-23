/**
 * LAB 10 · PCE y desperdicios (VA / SVA)
 *
 * Guía: M4 §1–2 y plantillas Excel «VA-SVA-Desperdicio» y «PCE».
 *   Un paso es de valor agregado (VA) solo si cumple tres criterios a la vez: transforma el producto, el cliente
 *   pagaría por él y se hace bien a la primera. Lo demás es sin valor agregado necesario (SVA: una inspección, un
 *   requisito regulatorio) o desperdicio puro (los ocho: defectos, sobreproducción, esperas…).
 *   PCE = tiempo de valor agregado ÷ tiempo total del ciclo (lead time).
 *   Ley de Little (plantilla «PCE»): lead time = WIP ÷ tasa de salida.
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: la línea de arneses de la guía (27.3 %), las 12 actividades de la plantilla Excel (meta 40 %, WIP 40 y
 * 48 piezas por hora) y el ejercicio 1 del módulo 4 (aprobación de crédito, 14.8 %).
 */
import { CLASES, TIPOS_DESPERDICIO, actividadesValidas, leadTimeLittle, resumenPce } from '../js/lib/medir.js';
import { conSigno, corto, entero, pct, plural } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { trazaBarras } from '../js/lib/graficas.js';

const CLASE_TEXTO = { VA: 'Valor agregado (VA)', SVA: 'Sin valor agregado necesario (SVA)', Desperdicio: 'Desperdicio' };
const CLASE_CORTO = { VA: 'VA', SVA: 'SVA', Desperdicio: 'Desperdicio' };
const CLASE_COLOR = { VA: COLOR.teal, SVA: COLOR.azul, Desperdicio: COLOR.coral };

/** Respaldo si no llega el caso: las seis actividades de la guía (M4 §2). */
const FILAS_GUIA = [
  { actividad: 'Corte y pelado', minutos: 3, clase: 'VA', tipo: '' },
  { actividad: 'Engarzado de terminales', minutos: 4, clase: 'VA', tipo: '' },
  { actividad: 'Ensamble de conectores', minutos: 3, clase: 'VA', tipo: '' },
  { actividad: 'Ruteo y amarre', minutos: 5, clase: 'VA', tipo: '' },
  { actividad: 'Inspección final', minutos: 2, clase: 'SVA', tipo: '' },
  { actividad: 'Esperas y transporte (staging, buffers, traslado a almacén)', minutos: 38, clase: 'Desperdicio', tipo: '' },
];

/** Ejercicio 1 del módulo 4: proceso de aprobación de crédito (PCE = 23 ÷ 155 = 14.8 %). */
const FILAS_CREDITO = [
  { actividad: 'Revisar documentos del cliente', minutos: 10, clase: 'VA', tipo: '' },
  { actividad: 'Consultar buró de crédito', minutos: 5, clase: 'VA', tipo: '' },
  { actividad: 'Espera en cola de aprobación gerencial', minutos: 120, clase: 'Desperdicio', tipo: 'Esperas' },
  { actividad: 'Aprobación gerencial', minutos: 8, clase: 'VA', tipo: '' },
  { actividad: 'Revisión de cumplimiento regulatorio (KYC)', minutos: 12, clase: 'SVA', tipo: '' },
];

const UMBRAL = {
  titulo: 'Umbrales de interpretación (guía M4 §2)',
  filas: [
    { rango: 'PCE < 5 %', texto: 'por debajo del rango típico: casi todo el ciclo es espera o trabajo sin valor (referencia didáctica; la guía no fija este corte)' },
    { rango: '5 % a 15 %', texto: 'típico de un proceso sin intervención Lean' },
    { rango: '15 % a 25 %', texto: 'zona intermedia entre el rango típico y un proceso ya mejorado (referencia didáctica)' },
    { rango: 'PCE > 25 %', texto: 'se asocia con procesos ya mejorados con Lean' },
    { rango: 'Meta propia', texto: 'lead time necesario = tiempo de VA ÷ meta; la reducción sale de quitar espera y desperdicio sin tocar los pasos que agregan valor (cálculo de la plantilla «PCE»)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto:
    'Cada paso se clasifica con los tres criterios de valor agregado a la vez (transforma, el cliente pagaría por él y se hace bien a la primera) y los minutos son los observados en el proceso real, no los de diseño. ' +
    'El lead time incluye esperas y transportes: si el denominador solo suma los pasos de VA, el PCE sale siempre 100 %. ' +
    'Un SVA necesario (inspección, requisito regulatorio) no se elimina para «subir» el PCE.',
};

const recorta = (texto, n = 34) => (texto.length > n ? `${texto.slice(0, n - 1)}…` : texto);
const minutos = (x) => `${corto(x, 1)} min`;

export default function lab10(ctx = {}) {
  const pceCaso = ctx.caso?.pce;
  const normaliza = (filas) => filas.map((f) => ({ actividad: f.actividad, minutos: f.minutos, clase: f.clase, tipo: f.tipo ?? '' }));
  const filasGuia = pceCaso?.guia?.actividades?.length ? normaliza(pceCaso.guia.actividades) : FILAS_GUIA;
  const excel = pceCaso?.excel;
  const filasExcel = excel?.actividades?.length ? normaliza(excel.actividades) : null;

  const opcionesTipo = [{ valor: '', texto: '— sin tipo —' }, ...TIPOS_DESPERDICIO.map((t) => ({ valor: t, texto: t }))];

  const presets = [
    {
      id: 'guia', etiqueta: 'Guía M4: línea de arneses (27.3 %)',
      ayuda: 'Seis pasos del mapa detallado: 15 min de valor agregado sobre 55 min de ciclo. La guía agrupa «esperas y transporte» en un solo renglón de 38 min, por eso no trae tipo de desperdicio.',
      valores: { actividades: filasGuia, meta: NaN, wip: NaN, tasaSalida: NaN },
    },
    ...(filasExcel
      ? [{
        id: 'excel', etiqueta: 'Plantilla Excel: 12 actividades',
        ayuda: 'Hojas «VA-SVA-Desperdicio» y «PCE»: 15 min de VA sobre 55 min, desperdicio por tipo, meta de 40 % y Ley de Little con 40 piezas en proceso a 48 por hora.',
        valores: { actividades: filasExcel, meta: excel.meta ?? 40, wip: excel.wip ?? 40, tasaSalida: excel.tasaSalida ?? 48 },
      }]
      : []),
    {
      id: 'credito', etiqueta: 'Guía M4: ejercicio 1 (crédito)',
      ayuda: 'Aprobación de crédito: 23 min de VA sobre 155 min de ciclo (14.8 %). La espera en la cola gerencial pesa 120 min.',
      valores: { actividades: FILAS_CREDITO, meta: NaN, wip: NaN, tasaSalida: NaN },
    },
  ];

  return {
    id: 'lab10',
    numero: '10',
    modulo: 'M4',
    titulo: 'PCE y desperdicios (VA / SVA)',
    resumen: 'Clasifica cada paso del proceso como valor agregado, sin valor agregado necesario o desperdicio, y calcula el lead time, la eficiencia del ciclo (PCE) y dónde se va el tiempo.',
    panelAncho: true,
    entradas: [
      {
        id: 'actividades', tipo: 'tabla', etiqueta: 'Pasos del proceso, en orden',
        columnas: [
          { id: 'actividad', etiqueta: 'Actividad', tipo: 'texto', ancho: '150px' },
          { id: 'minutos', etiqueta: 'Minutos', tipo: 'numero', min: 0, ancho: '70px' },
          { id: 'clase', etiqueta: 'Clase', tipo: 'opcion', opciones: CLASES.map((c) => ({ valor: c, texto: CLASE_CORTO[c] })), ancho: '132px', ayuda: 'VA: transforma, el cliente paga y sale bien a la primera · SVA: necesario pero sin valor (inspección, requisito legal) · Desperdicio: todo lo demás' },
          { id: 'tipo', etiqueta: 'Tipo de desperdicio', tipo: 'opcion', opciones: opcionesTipo, ancho: '150px', ayuda: 'Los ocho desperdicios de la plantilla. Solo cuenta si la clase es Desperdicio.' },
        ],
        filas: filasGuia, filaNueva: { actividad: '', minutos: NaN, clase: 'VA', tipo: '' }, minFilas: 1, maxFilas: 24,
        ayuda: 'Pon los minutos reales de cada paso y clasifícalo; el orden de la lista es el de la línea de tiempo.',
      },
      { tipo: 'seccion', etiqueta: 'Opcional · meta y Ley de Little' },
      { id: 'meta', tipo: 'numero', etiqueta: 'PCE objetivo (%)', valor: NaN, min: 0, max: 100, marcador: 'p. ej. 40', ayuda: 'Con una meta se calcula cuántos minutos hay que quitar sin tocar el valor agregado.' },
      { id: 'wip', tipo: 'numero', etiqueta: 'WIP: piezas en proceso', valor: NaN, min: 0, marcador: 'p. ej. 40' },
      { id: 'tasaSalida', tipo: 'numero', etiqueta: 'Tasa de salida (piezas por hora)', valor: NaN, min: 0, marcador: 'p. ej. 48', ayuda: 'Lead time = WIP ÷ tasa de salida × 60 (minutos).' },
    ],
    presets,
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Qué pasos de tu captura cumplen los tres criterios de valor agregado a la vez? ¿Cuál parece VA pero se repite porque no sale bien a la primera?',
      'Si eliminaras por completo el bloque más largo sin valor, ¿cuánto subiría el PCE? ¿Y si aceleraras a la mitad un paso que ya es VA? Compara los dos efectos.',
      '¿Qué SVA necesarios (inspecciones, requisitos regulatorios o del cliente) no deberías quitar aunque subieran el PCE, y qué alternativa tendrías para hacerlos más rápidos?',
      '¿Cómo medirías los minutos reales (cronómetro, registros del sistema, muestreo de trabajo) para que el lead time no sea una estimación a ojo?',
      'Si el PCE de la línea fuera de 27.3 %, ¿qué le dirías a un gerente que lo interpreta como un mal desempeño? Apóyate en los puntos de referencia del módulo.',
    ],

    calcular(e) {
      const meta = Number.isFinite(e.meta) ? e.meta / 100 : NaN;
      const r = resumenPce(e.actividades, { meta });
      if (!r.valido) {
        return {
          vacio: 'Captura al menos un paso con sus minutos y su clase para calcular el lead time y el PCE.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Sin minutos capturados.' }],
        };
      }

      const aviso = [];
      if (r.descartadas) aviso.push(`${plural(r.descartadas, 'fila')} sin minutos válidos (≥ 0) o sin clase ${r.descartadas === 1 ? 'no se contó' : 'no se contaron'}.`);
      const tipoSobrante = (e.actividades ?? []).filter((f) => f?.clase !== 'Desperdicio' && String(f?.tipo ?? '') !== '').length;
      if (tipoSobrante) aviso.push(`${plural(tipoSobrante, 'paso')} con tipo de desperdicio pero clasificado como VA o SVA: el tipo se ignora.`);
      if (Number.isFinite(e.meta) && !(e.meta > 0 && e.meta <= 100)) aviso.push('La meta de PCE debe estar entre 0 y 100 %: se ignoró.');
      const hayWip = Number.isFinite(e.wip);
      const hayTasa = Number.isFinite(e.tasaSalida);
      if (hayWip !== hayTasa) aviso.push('Para la Ley de Little captura el WIP y la tasa de salida.');
      const little = hayWip && hayTasa ? leadTimeLittle(e.wip, e.tasaSalida) : NaN; // NaN si la tasa no es positiva; 0 si el WIP es 0
      if (hayWip && hayTasa && !(little > 0)) aviso.push('La Ley de Little pide un WIP mayor que cero y una tasa de salida mayor que cero.');

      const { validas } = actividadesValidas(e.actividades);
      const pctCiclo = (t) => pct(t / r.leadTime, 1);
      const pPce = (100 * r.minutos.VA) / r.leadTime; // en %, para que 15 y 25 caigan exactos en los cortes
      const fila = pPce < 5 ? 0 : pPce <= 15 ? 1 : pPce <= 25 ? 2 : 3;

      /* ---- salidas ---- */
      const salidas = [
        { id: 'lead', etiqueta: 'Lead time (tiempo total del ciclo)', valor: minutos(r.leadTime), nota: `${plural(validas.length, 'paso')} · VA + SVA + desperdicio` },
        { id: 'va', etiqueta: 'Valor agregado (VA)', valor: minutos(r.minutos.VA), nota: `${pctCiclo(r.minutos.VA)} del ciclo · ${plural(r.conteo.VA, 'paso')}` },
        { id: 'sva', etiqueta: 'Sin valor agregado necesario (SVA)', valor: minutos(r.minutos.SVA), nota: `${pctCiclo(r.minutos.SVA)} del ciclo · ${plural(r.conteo.SVA, 'paso')}` },
        { id: 'desperdicio', etiqueta: 'Desperdicio', valor: minutos(r.minutos.Desperdicio), nota: `${pctCiclo(r.minutos.Desperdicio)} del ciclo · ${plural(r.conteo.Desperdicio, 'paso')}` },
        { id: 'pce', etiqueta: 'PCE (eficiencia del ciclo)', valor: pct(r.pce, 1), color: 'teal', nota: `VA ÷ lead time = ${corto(r.minutos.VA, 1)} ÷ ${corto(r.leadTime, 1)}` },
        { id: 'sin-va', etiqueta: 'Tiempo sin valor agregado', valor: minutos(r.sinVA), color: 'azul', nota: `SVA + desperdicio · ${pct(r.pctSinVA, 1)} del ciclo` },
      ];
      if (r.mayor) {
        salidas.push({ id: 'mayor', etiqueta: 'Paso que más tiempo consume', valor: r.mayor.actividad, pequeno: true, ancha: true, nota: `${minutos(r.mayor.minutos)} · ${pct(r.mayor.pctLead, 1)} del ciclo · ${CLASE_TEXTO[r.mayor.clase]}` });
      }
      if (r.meta) {
        salidas.push(
          { id: 'meta-lead', etiqueta: `Lead time para llegar a ${corto(e.meta, 1)} %`, valor: minutos(r.meta.leadTimeNecesario), nota: 'tiempo de VA ÷ meta' },
          {
            id: 'meta-reduccion', etiqueta: 'Tiempo a eliminar para la meta', valor: r.meta.cumplida ? '0 min' : minutos(r.meta.reduccion),
            nota: r.meta.cumplida ? 'ya cumples la meta' : `${pct(r.meta.reduccionPct, 1)} del lead time actual, sin tocar el VA`,
          }
        );
      }
      if (little > 0) {
        salidas.push(
          { id: 'little', etiqueta: 'Lead time por la Ley de Little', valor: minutos(little), nota: `WIP ÷ tasa × 60 = ${corto(e.wip, 1)} ÷ ${corto(e.tasaSalida, 1)} × 60` },
          { id: 'pce-little', etiqueta: 'PCE con el lead time de Little', valor: pct(r.minutos.VA / little, 1), nota: 'VA ÷ lead time de Little' }
        );
      }

      /* ---- semáforos ---- */
      const TEXTO_PCE = [
        `${pct(r.pce, 1)}: por debajo del 5 % a 15 % típico; casi todo el ciclo es espera o trabajo sin valor.`,
        `${pct(r.pce, 1)}: dentro del 5 % a 15 % típico de un proceso sin intervención Lean.`,
        `${pct(r.pce, 1)}: por encima del rango típico, todavía bajo el 25 % de un proceso ya mejorado.`,
        `${pct(r.pce, 1)}: supera el 25 % que se asocia con procesos ya mejorados con Lean.`,
      ];
      const semaforos = [{ nombre: 'PCE frente a las referencias', estado: 'informativo', texto: TEXTO_PCE[fila] }];
      if (Number.isFinite(meta) && meta > 0 && meta <= 1) {
        if (r.meta === null) {
          semaforos.push({ nombre: 'Meta de PCE', estado: 'atencion', texto: 'Sin tiempo de valor agregado no hay un lead time que alcance la meta: revisa la clasificación de los pasos.' });
        } else if (r.meta.cumplida) {
          semaforos.push({ nombre: 'Meta de PCE', estado: 'cumple', texto: `PCE ${pct(r.pce, 1)} ≥ meta ${corto(e.meta, 1)} %.` });
        } else {
          semaforos.push({ nombre: 'Meta de PCE', estado: 'atencion', texto: `PCE ${pct(r.pce, 1)} < meta ${corto(e.meta, 1)} %: faltan ${minutos(r.meta.reduccion)} por eliminar (${pct(r.meta.reduccionPct, 1)} del lead time) sin tocar el VA.` });
        }
      }
      const sinVa = validas.filter((f) => f.clase !== 'VA').sort((a, b) => b.minutos - a.minutos);
      if (sinVa.length && sinVa[0].minutos > 0) {
        const top = sinVa[0];
        semaforos.push({ nombre: 'Bloque sin valor más largo', estado: 'informativo', texto: `«${recorta(top.actividad || '(sin nombre)', 60)}» (${CLASE_CORTO[top.clase]}) ocupa ${minutos(top.minutos)}, ${pctCiclo(top.minutos)} del ciclo${top.minutos > r.leadTime / 2 ? ': más de la mitad del tiempo' : ''}. Mide cuánto subiría el PCE si lo eliminaras antes de optimizar un paso que ya agrega valor.` });
      }
      if (r.sinTipo > 0) {
        semaforos.push({ nombre: 'Tipo de desperdicio', estado: 'informativo', texto: `${minutos(r.sinTipo)} de desperdicio sin tipo asignado: elige uno de los ocho para ver dónde se concentra.` });
      }
      if (little > 0) {
        const dif = (little - r.leadTime) / r.leadTime;
        semaforos.push({ nombre: 'Little frente a la suma de pasos', estado: 'informativo', texto: `Little da ${minutos(little)} y la suma de pasos ${minutos(r.leadTime)} (${conSigno(dif * 100, 1)} %): si la diferencia es grande, busca esperas sin mapear o un WIP que no pertenece a este flujo.` });
      }

      const umbral = { ...UMBRAL, filas: UMBRAL.filas.map((f, i) => ({ ...f, activa: i < 4 ? i === fila : r.meta !== null })) };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Revisa que el lead time incluya las esperas y que ningún SVA necesario se haya contado como desperdicio.' };

      /* ---- gráficas ---- */
      let inicio = 0;
      const inicios = validas.map((f) => {
        const t = inicio;
        inicio += f.minutos;
        return t;
      });
      const etiquetas = validas.map((f, i) => `${i + 1}. ${recorta(f.actividad || 'Paso sin nombre')}`);
      const trazas = CLASES.map((clase) => {
        const idx = validas.map((_, i) => i).filter((i) => validas[i].clase === clase);
        return {
          type: 'bar', orientation: 'h', name: CLASE_CORTO[clase],
          x: idx.map((i) => validas[i].minutos), y: idx.map((i) => etiquetas[i]), base: idx.map((i) => inicios[i]),
          customdata: idx.map((i) => [corto(inicios[i], 1)]),
          marker: { color: CLASE_COLOR[clase], line: { width: 0 } },
          text: idx.map((i) => corto(validas[i].minutos, 1)), textposition: 'auto',
          insidetextfont: { color: '#0a1011', size: 11 }, outsidetextfont: { color: COLOR.blanco, size: 11 },
          hovertemplate: '%{y}<br>empieza en el minuto %{customdata[0]} · dura %{x} min<extra></extra>',
        };
      }).filter((t) => t.x.length);
      const graficas = [
        {
          id: 'linea-tiempo', titulo: 'Línea de tiempo del ciclo (minutos desde el inicio)', ancha: true, alta: validas.length > 8,
          datos: trazas,
          layout: {
            barmode: 'overlay', bargap: 0.25,
            xaxis: { rangemode: 'tozero', title: { text: 'minutos' } },
            yaxis: { autorange: 'reversed', categoryorder: 'array', categoryarray: etiquetas },
          },
          respaldo: {
            columnas: ['Paso', 'Clase', 'Minutos', 'Empieza en el minuto'],
            filas: validas.map((f, i) => [etiquetas[i], CLASE_CORTO[f.clase], corto(f.minutos, 1), corto(inicios[i], 1)]),
          },
        },
      ];
      const tipos = [...r.porTipo].sort((a, b) => b.minutos - a.minutos);
      if (tipos.length) {
        const nombres = tipos.map((t) => t.tipo);
        const valores = tipos.map((t) => t.minutos);
        const colores = tipos.map(() => COLOR.coral);
        if (r.sinTipo > 0) {
          nombres.push('Sin tipo asignado');
          valores.push(r.sinTipo);
          colores.push(COLOR.gris);
        }
        graficas.push({
          id: 'tipos', titulo: 'Desperdicio por tipo (minutos)',
          datos: [trazaBarras(nombres, valores, { colores, texto: valores.map((v) => corto(v, 1)), horizontal: true, mostrarLeyenda: false })],
          layout: { showlegend: false, xaxis: { rangemode: 'tozero' }, yaxis: { autorange: 'reversed' } },
          respaldo: { columnas: ['Tipo', 'Minutos', '% del ciclo'], filas: nombres.map((n, i) => [n, corto(valores[i], 1), pctCiclo(valores[i])]) },
        });
      }

      /* ---- tablas ---- */
      const filasClase = CLASES.map((c) => [
        CLASE_TEXTO[c],
        { texto: entero(r.conteo[c]), num: true },
        { texto: corto(r.minutos[c], 1), num: true, formula: true },
        { texto: pctCiclo(r.minutos[c]), num: true, formula: true },
      ]);
      filasClase.push(['Total (lead time)', { texto: entero(validas.length), num: true }, { texto: corto(r.leadTime, 1), num: true, formula: true }, { texto: '100.0 %', num: true, formula: true }]);
      const tablas = [
        {
          titulo: 'Tiempo por clase de paso',
          columnas: ['Clase', { t: 'Pasos', num: true }, { t: 'Minutos', num: true }, { t: '% del ciclo', num: true }],
          filas: filasClase, resaltar: [3],
          pie: `PCE = VA ÷ lead time = ${corto(r.minutos.VA, 1)} ÷ ${corto(r.leadTime, 1)} = ${pct(r.pce, 1)}.`,
        },
      ];
      if (sinVa.length) {
        tablas.push({
          titulo: 'Pasos sin valor agregado, de mayor a menor',
          columnas: ['Paso', 'Clase', 'Tipo', { t: 'Minutos', num: true }, { t: '% del ciclo', num: true }],
          filas: sinVa.slice(0, 8).map((f) => [
            recorta(f.actividad || '(sin nombre)', 48), CLASE_CORTO[f.clase], f.clase === 'Desperdicio' && f.tipo ? f.tipo : '—',
            { texto: corto(f.minutos, 1), num: true }, { texto: pctCiclo(f.minutos), num: true, formula: true },
          ]),
          pie: sinVa.length > 8 ? `Se muestran 8 de ${sinVa.length} pasos.` : undefined,
        });
      }

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
