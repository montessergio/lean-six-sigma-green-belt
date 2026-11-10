/**
 * LAB 20 · Mapa de flujo de valor (VSM)
 *
 * Guía: M8 §1 («Mapa de Flujo de Valor: ver el desperdicio de punta a punta», con la línea de tiempo de la línea de arneses y
 * el estado futuro con Kanban), ejercicio 4 (PCE y lead time con Kanban) · plantilla Excel «VSM».
 *   El VSM suma al diagrama de flujo los datos de cada etapa y la línea de tiempo del pie del mapa: tiempo de ciclo arriba
 *   (valor agregado o no) y esperas abajo (los triángulos de inventario). Lead time = Σ tiempos de ciclo + Σ esperas;
 *   PCE = tiempo de valor agregado ÷ lead time. La plantilla convierte el inventario en tiempo con el takt
 *   (espera = unidades en el triángulo × takt); la guía da las esperas en minutos. Aquí se aceptan las dos formas.
 *   El estado futuro sustituye la espera de una etapa por otra (el buffer de 15 min entre el engarzado y el ensamble por dos
 *   contenedores Kanban de 4 min) y recalcula lead time y PCE: solo cuantifica lo que ese cambio justifica.
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Diferencias con la plantilla: la guía no cuenta la inspección final como valor agregado (es SVA necesario) y la plantilla
 * suma todos los tiempos de ciclo como VA; aquí cada etapa lleva su clase. La plantilla también calcula la capacidad de cada
 * proceso con su disponibilidad, su tiempo de cambio de modelo y su tamaño de lote; este laboratorio no la incluye
 * (el LAB 22 trata la disponibilidad con el OEE).
 *
 * Presets: la línea de tiempo de la guía y su ejercicio 4 (lead time 55 min, PCE 27.3 % → 44 min y 34.1 % con Kanban) y los cinco procesos de
 * la plantilla (takt de 0.9375 min).
 */
import { CLASES_VSM, aplicarEspera, resumenVsm, taktTime } from '../js/lib/mejorar.js';
import { corto, entero, num, pct, plural } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';

const CLASE_COLOR = { VA: COLOR.teal, SVA: COLOR.azul, Desperdicio: COLOR.coral };
const MAX_ETAPAS = 12;

const sin = { inv: NaN, espera: NaN, fty: NaN };
const FILAS_GUIA = [
  { etapa: 'Corte y pelado', tc: 3, clase: 'VA', ...sin },
  { etapa: 'Engarzado de terminales', tc: 4, clase: 'VA', ...sin, espera: 15 },
  { etapa: 'Ensamble de conectores', tc: 3, clase: 'VA', ...sin },
  { etapa: 'Ruteo y amarre', tc: 5, clase: 'VA', ...sin },
  { etapa: 'Inspección final', tc: 2, clase: 'SVA', ...sin },
  { etapa: 'Resto de esperas y transporte', tc: 0, clase: 'Desperdicio', ...sin, espera: 23 },
];
const FILAS_EXCEL = [
  { etapa: 'Corte y pelado', tc: 0.4, clase: 'VA', inv: 150, espera: NaN, fty: 99 },
  { etapa: 'Crimpado', tc: 0.7, clase: 'VA', inv: 120, espera: NaN, fty: 98 },
  { etapa: 'Ensamble en tablero', tc: 0.85, clase: 'VA', inv: 80, espera: NaN, fty: 97 },
  { etapa: 'Apriete y verificación', tc: 0.9, clase: 'VA', inv: 60, espera: NaN, fty: 96 },
  { etapa: 'Prueba eléctrica', tc: 0.6, clase: 'VA', inv: 100, espera: NaN, fty: 99 },
];

const UMBRAL = {
  titulo: 'Cómo leer el VSM (guía M8 §1 y plantilla «VSM»)',
  filas: [
    { rango: 'PCE < 5 %', texto: 'lo que encuentra la mayoría de los VSM reales: menos del 5 % del tiempo agrega valor (guía M8 §1)' },
    { rango: '5 % a 25 %', texto: 'por encima de ese promedio y todavía bajo un proceso ya mejorado (referencia didáctica)' },
    { rango: 'PCE > 25 %', texto: 'se asocia con procesos ya mejorados con Lean (guía M4 §2)' },
    { rango: 'Espera = inventario × takt', texto: 'cálculo de la plantilla: cada unidad inventariada espera lo que tarda el cliente en consumirla; si capturas los minutos de espera, mandan ellos' },
    { rango: 'Tiempo de ciclo > takt', texto: 'la etapa no puede seguir el ritmo del cliente aunque nunca se detenga' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto del método',
  texto:
    'El mapa describe un solo flujo de valor (una familia de producto) tal como funciona hoy, con tiempos observados y no los de diseño. ' +
    'El inventario se convierte en espera con el takt como si se consumiera al ritmo del cliente; si el inventario no se consume en orden o el ritmo real es otro, mide la espera directamente. ' +
    'El estado futuro solo cuantifica el cambio que se simula: no suma las mejoras de 5S, Poka-Yoke o SMED, que se miden con otras métricas.',
};

const recorta = (texto, n = 30) => (texto.length > n ? `${texto.slice(0, n - 1)}…` : texto);
const minutos = (x) => `${corto(x, 3)} min`;
const pcePct = (x) => (x < 0.01 ? pct(x, 2) : pct(x, 1));

export default function lab20() {
  return {
    id: 'lab20',
    numero: '20',
    modulo: 'M8',
    titulo: 'Mapa de flujo de valor (VSM)',
    resumen: 'Captura las etapas del flujo con su tiempo de ciclo, su inventario o espera y su rendimiento, y obtén el lead time, el PCE, el cuello de botella y el efecto de reducir una espera.',
    panelAncho: true,
    entradas: [
      {
        id: 'etapas', tipo: 'tabla', etiqueta: 'Etapas del flujo, en orden',
        columnas: [
          { id: 'etapa', etiqueta: 'Etapa', tipo: 'texto', ancho: '128px' },
          { id: 'tc', etiqueta: 'Ciclo (min)', tipo: 'numero', min: 0, ancho: '78px', ayuda: 'Tiempo de ciclo: minutos que tarda la etapa por unidad.' },
          { id: 'clase', etiqueta: 'Clase', tipo: 'opcion', opciones: CLASES_VSM.map((c) => ({ valor: c, texto: c })), ancho: '108px', ayuda: 'VA: transforma, el cliente paga y sale bien a la primera · SVA: necesaria sin agregar valor (inspección) · Desperdicio: todo lo demás.' },
          { id: 'inv', etiqueta: 'Inventario (u.)', tipo: 'numero', min: 0, ancho: '82px', ayuda: 'Unidades en el triángulo que sigue a la etapa. Con el takt se convierten en minutos de espera.' },
          { id: 'espera', etiqueta: 'Espera (min)', tipo: 'numero', min: 0, ancho: '82px', ayuda: 'Minutos que espera una unidad después de la etapa. Si lo capturas, manda sobre el inventario.' },
          { id: 'fty', etiqueta: 'FTY (%)', tipo: 'numero', min: 0, max: 100, ancho: '64px', ayuda: 'Rendimiento de primera pasada: porcentaje que sale bien sin retrabajo.' },
        ],
        filas: FILAS_GUIA, filaNueva: { etapa: '', tc: NaN, clase: 'VA', inv: NaN, espera: NaN, fty: NaN }, minFilas: 1, maxFilas: MAX_ETAPAS,
        ayuda: 'Una fila por etapa, en el orden del flujo; la espera o el inventario son los de después de esa etapa.',
      },
      { tipo: 'seccion', etiqueta: 'Opcional · ritmo del cliente (takt)' },
      { id: 'demanda', tipo: 'numero', etiqueta: 'Demanda del cliente (unidades por día)', valor: NaN, min: 0, marcador: 'p. ej. 480' },
      { id: 'disponible', tipo: 'numero', etiqueta: 'Tiempo disponible (min por día)', valor: NaN, min: 0, marcador: 'p. ej. 450', ayuda: 'Turno menos descansos. Takt = tiempo disponible ÷ demanda.' },
      { tipo: 'seccion', etiqueta: 'Opcional · estado futuro' },
      {
        id: 'mejoraFila', tipo: 'opcion', etiqueta: 'Etapa cuya espera se reduce',
        opciones: [{ valor: '', texto: '— ninguna —' }, ...Array.from({ length: MAX_ETAPAS }, (_, i) => ({ valor: String(i + 1), texto: `Fila ${i + 1}` }))],
        ayuda: 'La espera (o el inventario) de esa fila se sustituye por la espera nueva.',
      },
      { id: 'esperaNueva', tipo: 'numero', etiqueta: 'Espera nueva (min)', valor: NaN, min: 0, marcador: 'p. ej. 4', ayuda: 'En la guía, dos contenedores Kanban dejan la espera en 4 min.' },
    ],
    presets: [
      {
        id: 'guia', etiqueta: 'Guía M8 §1 y ejercicio 4: línea de arneses (55 min → 44 min)',
        ayuda: 'Cinco etapas y las esperas y transportes (38 min, 15 de ellos en el buffer entre el engarzado y el ensamble). La guía no ubica los otros 23 min: se agrupan al final. Con Kanban el buffer baja a 4 min.',
        valores: { etapas: FILAS_GUIA, demanda: NaN, disponible: NaN, mejoraFila: '2', esperaNueva: 4 },
      },
      {
        id: 'excel', etiqueta: 'Plantilla Excel «VSM»: cinco procesos con inventario',
        ayuda: 'Demanda de 480 unidades en 450 min (takt 0.9375 min): cada inventario se convierte en espera con inventario × takt. La plantilla cuenta todos los tiempos de ciclo como valor agregado.',
        valores: { etapas: FILAS_EXCEL, demanda: 480, disponible: 450, mejoraFila: '', esperaNueva: NaN },
      },
    ],
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Cuál es la espera o el inventario más grande del mapa? ¿Qué lo produce: lotes grandes, empuje sin señal del cliente o diferencias de velocidad entre etapas?',
      'Si llevaras esa espera a la cuarta parte (como el Kanban de la guía), ¿cuánto sube el PCE? Compáralo con acelerar a la mitad una etapa que ya agrega valor.',
      '¿Qué etapa marca el ritmo de la línea y qué pasaría con los inventarios aguas arriba y aguas abajo si su tiempo de ciclo creciera 10 %?',
      '¿Qué datos del mapa mediste en el piso y cuáles son estimaciones? ¿Cómo comprobarías que el inventario se consume al ritmo del takt?',
      'Un estado futuro solo cuantifica lo que simulas. ¿Qué otras mejoras (5S, Poka-Yoke, SMED) cambiarían este mapa y con qué métrica las medirías?',
    ],

    calcular(e) {
      const demanda = e.demanda;
      const disponible = e.disponible;
      const t = taktTime(disponible, demanda);
      const r = resumenVsm(e.etapas, { takt: t, demanda });
      if (!r.valido) {
        return {
          vacio: 'Captura al menos una etapa con su tiempo de ciclo o su espera para armar el mapa.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Sin tiempos capturados.' }],
        };
      }

      const aviso = [];
      if (r.descartadas) aviso.push(`${plural(r.descartadas, 'fila')} sin números válidos (todo ≥ 0 y el FTY entre 0 y 100) ${r.descartadas === 1 ? 'no se contó' : 'no se contaron'}.`);
      const hayDemanda = Number.isFinite(demanda);
      const hayDisponible = Number.isFinite(disponible);
      if (hayDemanda !== hayDisponible) aviso.push('Para el takt captura la demanda y el tiempo disponible.');
      else if (hayDemanda && !(t > 0)) aviso.push('La demanda y el tiempo disponible deben ser mayores que cero: no se calculó el takt.');
      if (r.inventarioSinTakt) aviso.push(`${plural(r.inventarioSinTakt, 'etapa')} con inventario pero sin espera en minutos: captura el takt (demanda y tiempo disponible) o la espera para contarlas en el lead time.`);
      if (r.inventarioYEspera) aviso.push(`${plural(r.inventarioYEspera, 'etapa')} con inventario y espera en minutos: manda la espera capturada.`);

      /* ---- estado futuro ---- */
      const filaMejora = e.mejoraFila ? Number(e.mejoraFila) : NaN;
      let futuro = null;
      if (Number.isFinite(filaMejora)) {
        const objetivo = r.filas.find((f) => f.indice === filaMejora);
        if (!objetivo) aviso.push(`La fila ${filaMejora} no forma parte del mapa: elige una etapa capturada para simular la mejora.`);
        else if (!(Number.isFinite(e.esperaNueva) && e.esperaNueva >= 0)) aviso.push('Captura la espera nueva (0 o más minutos) para simular el estado futuro.');
        else futuro = { objetivo, resumen: resumenVsm(aplicarEspera(e.etapas, filaMejora, e.esperaNueva), { takt: t, demanda }) };
      }

      const pctDe = (x) => pct(x / r.leadTime, 1);
      const pPce = r.pce * 100;
      const fila = pPce < 5 ? 0 : pPce <= 25 ? 1 : 2;
      const sinValorProceso = r.minutos.SVA + r.minutos.Desperdicio;

      /* ---- salidas ---- */
      const salidas = [
        { id: 'lead', etiqueta: 'Lead time del flujo', valor: minutos(r.leadTime), nota: `${plural(r.filas.length, 'etapa')} · tiempos de ciclo + esperas` },
        { id: 'va', etiqueta: 'Valor agregado (VA)', valor: minutos(r.minutos.VA), nota: `${pctDe(r.minutos.VA)} del lead time` },
        { id: 'esperas', etiqueta: 'Esperas entre etapas', valor: minutos(r.esperaTotal), color: 'coral', nota: `${pctDe(r.esperaTotal)} del lead time` },
        { id: 'pce', etiqueta: 'PCE (VA ÷ lead time)', valor: pcePct(r.pce), color: 'teal', nota: `${corto(r.minutos.VA, 3)} ÷ ${corto(r.leadTime, 3)}` },
      ];
      if (sinValorProceso > 0) salidas.push({ id: 'sva', etiqueta: 'Etapas sin valor (SVA + desperdicio)', valor: minutos(sinValorProceso), color: 'azul', nota: `${pctDe(sinValorProceso)} del lead time` });
      if (t > 0) salidas.push({ id: 'takt', etiqueta: 'Takt time', valor: `${corto(t, 4)} min`, nota: `${corto(t * 60, 3)} s por unidad · ${corto(disponible, 1)} min ÷ ${corto(demanda, 1)} unidades` });
      if (Number.isFinite(r.rty)) salidas.push({ id: 'rty', etiqueta: 'Rendimiento acumulado (RTY)', valor: pct(r.rty, 1), nota: 'producto de los FTY de las etapas' });
      if (Number.isFinite(r.inventario)) {
        salidas.push({ id: 'inventario', etiqueta: 'Inventario en proceso', valor: `${entero(r.inventario)} unid.`, nota: Number.isFinite(r.dias) ? `${corto(r.dias, 2)} días de demanda` : 'captura la demanda para ver los días' });
      }
      if (r.cuello) {
        salidas.push({
          id: 'cuello', etiqueta: 'Etapa más lenta', valor: r.cuello.etapa || `Fila ${r.cuello.indice}`, pequeno: true, ancha: true,
          nota: `${corto(r.cuello.tc, 3)} min por unidad${t > 0 ? ` · ${pct(r.cuello.tc / t, 0)} del takt` : ''}`,
        });
      }
      if (r.mayorEspera) {
        salidas.push({
          id: 'mayor-espera', etiqueta: 'Mayor espera', valor: minutos(r.mayorEspera.espera), color: 'coral', ancha: true,
          nota: `después de «${r.mayorEspera.etapa || `fila ${r.mayorEspera.indice}`}» · ${pctDe(r.mayorEspera.espera)} del lead time`,
        });
      }
      if (futuro) {
        const f = futuro.resumen;
        salidas.push(
          { id: 'lead-futuro', etiqueta: 'Lead time del estado futuro', valor: minutos(f.leadTime), color: 'teal', nota: `${corto(f.leadTime - r.leadTime, 3)} min (${pct((f.leadTime - r.leadTime) / r.leadTime, 1)})` },
          { id: 'pce-futuro', etiqueta: 'PCE del estado futuro', valor: pcePct(f.pce), color: 'teal', nota: `${corto(f.minutos.VA, 3)} ÷ ${corto(f.leadTime, 3)}` }
        );
      }

      /* ---- semáforos ---- */
      const TEXTO_PCE = [
        `${pcePct(r.pce)}: como la mayoría de los VSM reales, donde menos del 5 % del tiempo agrega valor (guía M8 §1).`,
        `${pcePct(r.pce)}: por encima de ese promedio, todavía bajo el 25 % de un proceso ya mejorado con Lean.`,
        `${pcePct(r.pce)}: supera el 25 % que se asocia con procesos ya mejorados con Lean.`,
      ];
      const semaforos = [{ nombre: 'PCE frente a las referencias', estado: 'informativo', texto: TEXTO_PCE[fila] }];
      if (r.mayorEspera) {
        const m = r.mayorEspera;
        semaforos.push({
          nombre: 'Mayor espera', estado: 'informativo',
          texto: `La espera después de «${recorta(m.etapa || `fila ${m.indice}`, 40)}» dura ${minutos(m.espera)}, ${pctDe(m.espera)} del lead time${m.espera > r.leadTime / 2 ? ': más de la mitad del tiempo' : ''}. Es la espera más larga del mapa: pregunta qué la genera antes de acelerar una etapa y, si la fila agrupa varias esperas, desglósala para hallar la mayor oportunidad individual.`,
        });
      }
      if (t > 0) {
        if (r.excedenTakt.length) {
          const lista = r.excedenTakt.map((f) => `«${recorta(f.etapa || `fila ${f.indice}`, 24)}» (${corto(f.tc, 3)} min)`).join(', ');
          semaforos.push({ nombre: 'Takt', estado: 'critico', texto: `${plural(r.excedenTakt.length, 'etapa')} con tiempo de ciclo mayor que el takt de ${corto(t, 4)} min: ${lista}. No siguen el ritmo del cliente.` });
        } else {
          semaforos.push({ nombre: 'Takt', estado: 'cumple', texto: `Ninguna etapa excede el takt de ${corto(t, 4)} min.${r.cuello ? ` La más cargada usa ${pct(r.cuello.tc / t, 0)} del takt.` : ''}` });
        }
      }
      if (r.cuello) {
        semaforos.push({
          nombre: 'Etapa más lenta', estado: 'informativo',
          texto: `«${recorta(r.cuello.etapa || `fila ${r.cuello.indice}`, 40)}» tiene el mayor tiempo de ciclo (${corto(r.cuello.tc, 3)} min): marca la capacidad del flujo si todo lo demás funciona.`,
        });
      }
      if (Number.isFinite(r.rty)) {
        semaforos.push({ nombre: 'Rendimiento acumulado', estado: 'informativo', texto: `RTY = ${pct(r.rty, 1)}: de cada 100 unidades que entran, ${corto(r.rty * 100, 0)} salen bien de punta a punta sin retrabajo. Es el producto de los rendimientos de primera pasada, no su promedio.` });
      }
      if (Number.isFinite(r.dias)) {
        semaforos.push({ nombre: 'Inventario', estado: 'informativo', texto: `${entero(r.inventario)} unidades en proceso equivalen a ${corto(r.dias, 2)} días de demanda (${corto(demanda, 0)} por día).` });
      }
      if (futuro) {
        const f = futuro.resumen;
        semaforos.push({
          nombre: 'Estado futuro', estado: 'informativo',
          texto: `La espera después de «${recorta(futuro.objetivo.etapa || `fila ${futuro.objetivo.indice}`, 36)}» pasa de ${minutos(futuro.objetivo.espera)} a ${minutos(e.esperaNueva)}: el lead time baja de ${corto(r.leadTime, 3)} a ${corto(f.leadTime, 3)} min y el PCE sube de ${pcePct(r.pce)} a ${pcePct(f.pce)}. El valor agregado no cambia; solo se cuantifica este cambio.`,
        });
      }

      const umbral = { ...UMBRAL, filas: UMBRAL.filas.map((x, i) => ({ ...x, activa: i < 3 ? i === fila : i === 3 ? r.esperasPorInventario > 0 : t > 0 })) };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Comprueba que cada tiempo sea observado y que cada espera corresponda a la unidad que recorre el flujo completo.' };

      /* ---- gráficas ---- */
      let reloj = 0;
      const segmentos = r.filas.map((f) => {
        const s = { f, inicio: reloj, inicioEspera: reloj + f.tc };
        reloj += f.tc + f.espera;
        return s;
      });
      const etiquetas = segmentos.map((s, i) => `${i + 1}. ${recorta(s.f.etapa || `Fila ${s.f.indice}`)}`);
      const trazas = CLASES_VSM.map((clase) => {
        const idx = segmentos.map((_, i) => i).filter((i) => segmentos[i].f.clase === clase && segmentos[i].f.tc > 0);
        return {
          type: 'bar', orientation: 'h', name: clase,
          x: idx.map((i) => segmentos[i].f.tc), y: idx.map((i) => etiquetas[i]), base: idx.map((i) => segmentos[i].inicio),
          customdata: idx.map((i) => [corto(segmentos[i].inicio, 3)]),
          marker: { color: CLASE_COLOR[clase], line: { width: 0 } },
          text: idx.map((i) => corto(segmentos[i].f.tc, 3)), textposition: 'auto',
          insidetextfont: { color: '#0a1011', size: 11 }, outsidetextfont: { color: COLOR.blanco, size: 11 },
          hovertemplate: '%{y}<br>tiempo de ciclo: %{x} min · empieza en el minuto %{customdata[0]}<extra></extra>',
        };
      }).filter((tr) => tr.x.length);
      const idxEspera = segmentos.map((_, i) => i).filter((i) => segmentos[i].f.espera > 0);
      if (idxEspera.length) {
        trazas.push({
          type: 'bar', orientation: 'h', name: 'Espera',
          x: idxEspera.map((i) => segmentos[i].f.espera), y: idxEspera.map((i) => etiquetas[i]), base: idxEspera.map((i) => segmentos[i].inicioEspera),
          customdata: idxEspera.map((i) => [corto(segmentos[i].inicioEspera, 3)]),
          marker: { color: COLOR.ambar, line: { width: 0 } },
          text: idxEspera.map((i) => corto(segmentos[i].f.espera, 1)), textposition: 'auto',
          insidetextfont: { color: '#0a1011', size: 11 }, outsidetextfont: { color: COLOR.blanco, size: 11 },
          hovertemplate: 'espera después de %{y}<br>%{x} min · desde el minuto %{customdata[0]}<extra></extra>',
        });
      }
      const graficas = [
        {
          id: 'linea-tiempo', titulo: 'Línea de tiempo del flujo (minutos desde que entra la unidad)', ancha: true, alta: segmentos.length > 8,
          datos: trazas,
          layout: {
            barmode: 'overlay', bargap: 0.25,
            xaxis: { rangemode: 'tozero', title: { text: 'minutos' } },
            yaxis: { autorange: 'reversed', categoryorder: 'array', categoryarray: etiquetas },
          },
          respaldo: {
            columnas: ['Etapa', 'Clase', 'Tiempo de ciclo (min)', 'Espera después (min)', 'Empieza en el minuto'],
            filas: segmentos.map((s, i) => [etiquetas[i], s.f.clase, corto(s.f.tc, 3), corto(s.f.espera, 3), corto(s.inicio, 3)]),
          },
        },
      ];
      if (futuro) {
        const f = futuro.resumen;
        const partes = [
          { nombre: 'Valor agregado', color: COLOR.teal, v: [r.minutos.VA, f.minutos.VA] },
          { nombre: 'SVA', color: COLOR.azul, v: [r.minutos.SVA, f.minutos.SVA] },
          { nombre: 'Desperdicio en etapas', color: COLOR.coral, v: [r.minutos.Desperdicio, f.minutos.Desperdicio] },
          { nombre: 'Esperas', color: COLOR.ambar, v: [r.esperaTotal, f.esperaTotal] },
        ].filter((p) => p.v[0] > 0 || p.v[1] > 0);
        graficas.push({
          id: 'futuro', titulo: 'Estado actual y estado futuro (minutos de lead time)',
          datos: partes.map((p) => ({
            type: 'bar', orientation: 'h', name: p.nombre, x: p.v, y: ['Estado actual', 'Estado futuro'],
            marker: { color: p.color, line: { width: 0 } }, text: p.v.map((v) => (v >= 0.06 * Math.max(r.leadTime, f.leadTime) ? corto(v, 1) : '')), textposition: 'auto',
            insidetextfont: { color: '#0a1011', size: 11 }, outsidetextfont: { color: COLOR.blanco, size: 11 },
          })),
          layout: { barmode: 'stack', xaxis: { rangemode: 'tozero', title: { text: 'minutos' } }, yaxis: { autorange: 'reversed' } },
          respaldo: {
            columnas: ['Componente', 'Estado actual (min)', 'Estado futuro (min)'],
            filas: partes.map((p) => [p.nombre, corto(p.v[0], 3), corto(p.v[1], 3)]),
          },
        });
      }

      /* ---- tablas ---- */
      const filasMapa = r.filas.map((f) => {
        const celdas = [
          recorta(f.etapa || `Fila ${f.indice}`, 40), f.clase,
          { texto: corto(f.tc, 3), num: true },
          { texto: Number.isFinite(f.inv) ? entero(f.inv) : '—', num: true },
          { texto: corto(f.espera, 3), num: true, formula: f.origen === 'inventario' },
          { texto: pctDe(f.tc + f.espera), num: true, formula: true },
        ];
        if (t > 0) celdas.splice(3, 0, { texto: f.tc > t + 1e-9 ? 'Excede' : 'Sí', num: false, estado: f.tc > t + 1e-9 ? 'critico' : 'cumple' });
        return celdas;
      });
      const total = ['Total', '', { texto: corto(r.proceso, 3), num: true, formula: true }, { texto: Number.isFinite(r.inventario) ? entero(r.inventario) : '—', num: true, formula: true }, { texto: corto(r.esperaTotal, 3), num: true, formula: true }, { texto: '100.0 %', num: true, formula: true }];
      if (t > 0) total.splice(3, 0, '');
      const columnasMapa = ['Etapa', 'Clase', { t: 'Tiempo de ciclo (min)', num: true }, { t: 'Inventario después', num: true }, { t: 'Espera después (min)', num: true }, { t: '% del lead time', num: true }];
      if (t > 0) columnasMapa.splice(3, 0, '¿Cumple takt?');
      const tablas = [
        {
          titulo: 'El mapa, etapa por etapa',
          columnas: columnasMapa, filas: [...filasMapa, total], resaltar: [filasMapa.length],
          pie: `Lead time = ${corto(r.proceso, 3)} (tiempos de ciclo) + ${corto(r.esperaTotal, 3)} (esperas) = ${corto(r.leadTime, 3)} min. PCE = ${corto(r.minutos.VA, 3)} ÷ ${corto(r.leadTime, 3)} = ${pcePct(r.pce)}.${r.esperasPorInventario ? ` Espera = inventario × takt (${corto(t, 4)} min) en ${plural(r.esperasPorInventario, 'etapa')}.` : ''}`,
        },
      ];
      if (futuro) {
        const f = futuro.resumen;
        const cambio = (a, b) => (a === b ? '0' : `${b > a ? '+' : '−'}${corto(Math.abs(b - a), 3)}`);
        tablas.push({
          titulo: `Estado actual y estado futuro (espera de «${recorta(futuro.objetivo.etapa || `fila ${futuro.objetivo.indice}`, 30)}»)`,
          columnas: ['Métrica', { t: 'Actual', num: true }, { t: 'Futuro', num: true }, { t: 'Cambio', num: true }],
          filas: [
            ['Lead time (min)', { texto: corto(r.leadTime, 3), num: true }, { texto: corto(f.leadTime, 3), num: true, formula: true }, { texto: cambio(r.leadTime, f.leadTime), num: true, formula: true }],
            ['Esperas (min)', { texto: corto(r.esperaTotal, 3), num: true }, { texto: corto(f.esperaTotal, 3), num: true, formula: true }, { texto: cambio(r.esperaTotal, f.esperaTotal), num: true, formula: true }],
            ['Valor agregado (min)', { texto: corto(r.minutos.VA, 3), num: true }, { texto: corto(f.minutos.VA, 3), num: true, formula: true }, { texto: '0', num: true, formula: true }],
            ['PCE', { texto: pcePct(r.pce), num: true }, { texto: pcePct(f.pce), num: true, formula: true }, { texto: `${f.pce >= r.pce ? '+' : '−'}${num(Math.abs(f.pce - r.pce) * 100, 1)} pts`, num: true, formula: true }],
          ],
          pie: `Esperas futuras = ${corto(r.esperaTotal, 3)} − ${corto(futuro.objetivo.espera, 3)} + ${corto(e.esperaNueva, 3)} = ${corto(f.esperaTotal, 3)} min.`,
        });
      }

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
