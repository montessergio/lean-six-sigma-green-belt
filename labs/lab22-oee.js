/**
 * LAB 22 · OEE (eficacia global del equipo)
 *
 * Guía: M8 (cierre del módulo: OEE = disponibilidad × rendimiento × calidad; clase mundial 85 %; las plantas que no han trabajado
 * el tema, entre 40 % y 60 %; cada herramienta Lean empuja un factor), el turno de la línea de arneses, el ejercicio 5 y la
 * pregunta 4 del examen · plantilla Excel «OEE».
 *   Disponibilidad = (tiempo planificado − paros) ÷ tiempo planificado; rendimiento = ciclo ideal × unidades producidas ÷ tiempo
 *   operando; calidad = unidades buenas ÷ unidades producidas. La cascada de pérdidas reparte el tiempo planificado en paros,
 *   velocidad y microparos, defectos y tiempo completamente productivo, y cada pérdida tiene su herramienta Lean (SMED y
 *   mantenimiento autónomo · flujo continuo, Kanban y balanceo · poka-yoke y estandarización).
 *   Dos formas de capturar: por periodo (turno o día, como la plantilla) o directamente los tres factores en % (como la guía).
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Diferencias con la plantilla: acepta los factores en porcentaje, señala el factor más débil y la mayor pérdida (pueden no
 * coincidir), compara con la referencia de clase mundial factor por factor, simula llevar un factor a un valor nuevo y avisa
 * cuando el rendimiento pasa de 100 % (ciclo ideal demasiado lento). La plantilla suma los periodos y pondera el ciclo ideal por
 * las unidades producidas; aquí también. La guía toma el takt como ciclo ideal de su ejemplo; con el ciclo de diseño del equipo
 * el rendimiento cambiaría (se dice en el supuesto).
 *
 * Presets: la guía con factores redondeados (90 × 85 × 96 = 73.44 %), el mismo turno con minutos y unidades (73.24 %), los cinco
 * días de la plantilla (75.76 %), el ejercicio 5 (sin resultado impreso: clave en el Apéndice C) y la pregunta 4 del examen.
 */
import { FACTORES_OEE, cascadaOee, factorMasDebil, mayorPerdida, oee, resumenOee, simularMejora } from '../js/lib/mejorar.js';
import { corto, entero, pct, plural } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { etiquetaH, lineaH } from '../js/lib/graficas.js';

const MAX_PERIODOS = 14;
const ETIQUETA_OSCURA = { color: '#0a1011', size: 11 };
const REFERENCIA = { A: 90, P: 95, Q: 99, OEE: 85 }; // clase mundial (Nakajima)
const HERRAMIENTAS = { A: 'SMED, mantenimiento autónomo', P: 'flujo continuo, Kanban, balanceo', Q: 'poka-yoke, estandarización' };
const PERDIDA_DE = { paros: 'A', velocidad: 'P', defectos: 'Q' };
const NOMBRE_PERDIDA = {
  paros: 'Pérdida por paros (disponibilidad)',
  velocidad: 'Pérdida de velocidad y microparos (rendimiento)',
  defectos: 'Pérdida por defectos y retrabajo (calidad)',
};
const ARTICULO = { A: 'la disponibilidad', P: 'el rendimiento', Q: 'la calidad' };
const NOMBRE_CORTO = { paros: 'Paros (disponibilidad)', velocidad: 'Velocidad y microparos (rendimiento)', defectos: 'Defectos y retrabajo (calidad)' };

const FILAS_TURNO = [{ periodo: 'Turno', plan: 480, paros: 48, ciclo: 0.9375, prod: 391, buenas: 375 }];
const FILAS_EXCEL = [
  { periodo: 'Día 1', plan: 450, paros: 75, ciclo: 0.9, prod: 400, buenas: 380 },
  { periodo: 'Día 2', plan: 450, paros: 90, ciclo: 0.9, prod: 380, buenas: 360 },
  { periodo: 'Día 3', plan: 450, paros: 68, ciclo: 0.9, prod: 410, buenas: 392 },
  { periodo: 'Día 4', plan: 450, paros: 82, ciclo: 0.9, prod: 395, buenas: 374 },
  { periodo: 'Día 5', plan: 450, paros: 70, ciclo: 0.9, prod: 405, buenas: 388 },
];

const BASE = { modo: 'periodos', periodos: FILAS_TURNO, disp: 90, rend: 85, cal: 96, mejoraFactor: '', mejoraValor: NaN };
const esPeriodos = (e) => e.modo === 'periodos';
const esFactores = (e) => e.modo === 'factores';

const UMBRAL = {
  titulo: 'Cómo leer el OEE (guía M8 y plantilla «OEE»)',
  filas: [
    { rango: 'OEE ≥ 85 %', texto: 'clase mundial; la referencia de Nakajima combina disponibilidad de 90 %, rendimiento de 95 % y calidad de 99 %' },
    { rango: '60 % a 85 %', texto: 'hay margen de mejora (la plantilla lo llama «típico»; la guía ubica a las plantas que no han trabajado el tema entre 40 % y 60 %)' },
    { rango: 'OEE < 60 %', texto: 'bajo: hay pérdidas grandes por atacar' },
    { rango: 'Disponibilidad', texto: '(plan − paros) ÷ plan: el tiempo que el equipo estuvo disponible; se pierde en averías, cambios de modelo y falta de material' },
    { rango: 'Rendimiento', texto: 'ciclo ideal × producidas ÷ tiempo operando: qué tan cerca del ritmo ideal se trabajó; se pierde en velocidad reducida y microparos' },
    { rango: 'Calidad', texto: 'buenas ÷ producidas: qué parte salió bien a la primera; se pierde en defectos y retrabajo' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto del método',
  texto:
    'El OEE mide al equipo contra su ritmo ideal durante el tiempo planificado, así que depende de que el ciclo ideal sea el de diseño (o el mejor demostrado) y no el promedio real: con un ciclo ideal lento el rendimiento se infla y puede pasar de 100 %. ' +
    'La guía usa el takt como ciclo ideal de su ejemplo, lo que mide el ritmo del cliente más que el del equipo. ' +
    'Los paros planeados que ya salieron del tiempo planificado (descansos, mantenimiento programado) no cuentan como pérdida de disponibilidad; los demás sí, y conviene fijar ese criterio antes de comparar. ' +
    'Los tres factores se multiplican: un OEE solo se compara con otro del mismo equipo y con la misma definición de paro.',
};

const recorta = (texto, n = 30) => (texto.length > n ? `${texto.slice(0, n - 1)}…` : texto);
const pc = (x) => `${corto(x * 100, 2)} %`;
const conSigno = (x, dec = 2) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${corto(Math.abs(x), dec)}`;
const minutos = (x) => `${corto(x, 2)} min`;
const nombrePeriodo = (f) => f.periodo || `Periodo ${f.indice}`;

export default function lab22() {
  return {
    id: 'lab22',
    numero: '22',
    modulo: 'M8',
    titulo: 'OEE: eficacia global del equipo',
    resumen: 'Calcula el OEE por periodo o a partir de los tres factores, ve a dónde se va el tiempo planificado, cuál es el factor más débil y cuánto subiría el OEE si lo mejoras.',
    panelAncho: true,
    entradas: [
      {
        id: 'modo', tipo: 'opcion', etiqueta: 'Datos de entrada', valor: BASE.modo,
        opciones: [{ valor: 'periodos', texto: 'Por periodo (tiempos y unidades)' }, { valor: 'factores', texto: 'Por factores (porcentajes)' }],
        ayuda: 'Por periodo calculas los tres factores con la plantilla; por factores capturas la disponibilidad, el rendimiento y la calidad que ya tienes.',
      },
      {
        id: 'periodos', tipo: 'tabla', etiqueta: 'Periodos (turno o día)', visibleSi: esPeriodos,
        columnas: [
          { id: 'periodo', etiqueta: 'Periodo', tipo: 'texto', ancho: '84px' },
          { id: 'plan', etiqueta: 'Plan (min)', tipo: 'numero', min: 0, ancho: '78px', ayuda: 'Tiempo planificado para producir en el periodo, sin descansos ni mantenimiento programado.' },
          { id: 'paros', etiqueta: 'Paros (min)', tipo: 'numero', min: 0, ancho: '82px', ayuda: 'Minutos con el equipo detenido: averías, cambios de modelo, falta de material.' },
          { id: 'ciclo', etiqueta: 'Ciclo ideal (min/u.)', tipo: 'numero', min: 0, ancho: '96px', ayuda: 'Minutos por unidad al ritmo ideal del equipo (de diseño o el mejor demostrado).' },
          { id: 'prod', etiqueta: 'Producidas', tipo: 'numero', min: 0, ancho: '86px', ayuda: 'Unidades fabricadas en el periodo, buenas y malas.' },
          { id: 'buenas', etiqueta: 'Buenas', tipo: 'numero', min: 0, ancho: '70px', ayuda: 'Unidades buenas a la primera, sin retrabajo.' },
        ],
        filas: BASE.periodos, filaNueva: { periodo: '', plan: NaN, paros: NaN, ciclo: NaN, prod: NaN, buenas: NaN }, minFilas: 1, maxFilas: MAX_PERIODOS,
        ayuda: 'Una fila por turno o por día, completa: sin los cinco números la fila no se cuenta.',
      },
      { id: 'disp', tipo: 'numero', etiqueta: 'Disponibilidad (%)', valor: BASE.disp, min: 0, max: 100, marcador: 'p. ej. 90', visibleSi: esFactores },
      { id: 'rend', tipo: 'numero', etiqueta: 'Rendimiento (%)', valor: BASE.rend, min: 0, max: 100, marcador: 'p. ej. 85', visibleSi: esFactores },
      { id: 'cal', tipo: 'numero', etiqueta: 'Calidad (%)', valor: BASE.cal, min: 0, max: 100, marcador: 'p. ej. 96', visibleSi: esFactores },
      { tipo: 'seccion', etiqueta: 'Opcional · simular una mejora' },
      {
        id: 'mejoraFactor', tipo: 'opcion', etiqueta: 'Factor que se mejora', valor: BASE.mejoraFactor,
        opciones: [{ valor: '', texto: '— ninguno —' }, { valor: 'A', texto: 'Disponibilidad' }, { valor: 'P', texto: 'Rendimiento' }, { valor: 'Q', texto: 'Calidad' }],
        ayuda: 'Cambia solo ese factor y deja los otros como están.',
      },
      { id: 'mejoraValor', tipo: 'numero', etiqueta: 'Valor nuevo del factor (%)', valor: NaN, min: 0, max: 100, marcador: 'p. ej. 85' },
    ],
    presets: [
      {
        id: 'guia', etiqueta: 'Guía M8: turno de arneses, 90 % × 85 % × 96 % (73.44 %)',
        ayuda: 'Los tres factores del ejemplo del módulo: 432 de 480 min disponibles, 391 de 460 unidades posibles y 96 % de calidad.',
        valores: { ...BASE, modo: 'factores' },
      },
      {
        id: 'guia-turno', etiqueta: 'Guía M8: el mismo turno con minutos y unidades (73.24 %)',
        ayuda: '480 min planificados, 48 de paros, ciclo ideal de 56.25 s (el takt) y 391 piezas. La guía no da las unidades buenas: las 375 son el 96 % de calidad en unidades enteras. La guía redondea los factores y obtiene 73.4 %.',
        valores: { ...BASE },
      },
      {
        id: 'excel', etiqueta: 'Plantilla Excel «OEE»: cinco días (75.76 %)',
        ayuda: 'Cinco días de 450 min con ciclo ideal de 0.9 min por unidad: los paros son la mayor pérdida.',
        valores: { ...BASE, periodos: FILAS_EXCEL },
      },
      {
        id: 'ej5', etiqueta: 'Guía M8 ej. 5: disponibilidad 88 %, rendimiento 91 %, calidad 97 %',
        ayuda: 'El ejercicio del módulo sin resolver: calcula el OEE y compáralo con la clave del Apéndice C.',
        valores: { ...BASE, modo: 'factores', disp: 88, rend: 91, cal: 97 },
      },
      {
        id: 'examen', etiqueta: 'Guía, examen M8: 90 %, 85 % y 68 % (¿qué factor atacar?)',
        ayuda: 'Una planta con OEE de 52 %: el factor más bajo es el que más arrastra el resultado. La simulación lleva la calidad a 80 %.',
        valores: { ...BASE, modo: 'factores', disp: 90, rend: 85, cal: 68, mejoraFactor: 'Q', mejoraValor: 80 },
      },
    ],
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Cuál de las tres pérdidas (paros, velocidad o defectos) consume más tiempo planificado en tu equipo? ¿Ya hay una herramienta Lean trabajando sobre ella?',
      'Si el ciclo ideal fuera el de diseño del equipo y no el takt, ¿qué le pasaría al rendimiento y al OEE? ¿Cuál de los dos ritmos quieres medir?',
      'El factor más débil y la mayor pérdida no siempre coinciden. ¿Con qué criterio decidirías por dónde empezar y qué información adicional pedirías?',
      '¿Qué paros cuentas como planificados y cuáles como pérdida? ¿Cambiaría tu OEE si el mantenimiento programado se contara como paro?',
      'Si el factor más débil llegara a 95 %, ¿cuántos puntos subiría el OEE? ¿Es más fácil que subir otro factor la misma cantidad?',
    ],

    calcular(e) {
      const aviso = [];
      let A;
      let P;
      let Q;
      let resumen = null;

      if (e.modo === 'factores') {
        const f = [e.disp, e.rend, e.cal];
        if (!f.every((x) => Number.isFinite(x) && x >= 0 && x <= 100)) {
          if (f.some(Number.isFinite)) aviso.push('Captura los tres factores, cada uno entre 0 y 100 %.');
          return {
            aviso,
            vacio: 'Captura la disponibilidad, el rendimiento y la calidad (de 0 a 100 %), o cambia a captura por periodo.',
            semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Sin los tres factores no hay OEE.' }],
          };
        }
        [A, P, Q] = f.map((x) => x / 100);
      } else {
        resumen = resumenOee(e.periodos);
        if (resumen.descartadas) {
          aviso.push(`${plural(resumen.descartadas, 'fila')} con datos incompletos o incoherentes (plan y ciclo mayores que cero, paros menores que el plan, producidas mayores que cero y buenas sin pasar de las producidas) ${resumen.descartadas === 1 ? 'no se contó' : 'no se contaron'}.`);
        }
        if (!resumen.valido) {
          return {
            aviso,
            vacio: 'Captura al menos un periodo completo: tiempo planificado, paros, ciclo ideal, unidades producidas y unidades buenas.',
            semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Sin un periodo completo no hay OEE.' }],
          };
        }
        ({ A, P, Q } = resumen.total);
      }

      const total = oee(A, P, Q);
      const rendAlto = P > 1 + 1e-9;
      const casc = cascadaOee({ A, P, Q });
      const debil = factorMasDebil({ A, P, Q });
      const mayorCalculada = rendAlto ? null : mayorPerdida(casc);
      const mayor = mayorCalculada && mayorCalculada.valor > 1e-9 ? mayorCalculada : null; // sin pérdidas no hay una mayor
      const hayDebil = Math.max(A, P, Q) - debil.valor > 1e-9; // con los tres factores iguales ninguno es el más débil
      if (resumen?.rendimientoAlto) {
        aviso.push(`${plural(resumen.rendimientoAlto, 'periodo')} con rendimiento mayor que 100 %: el ciclo ideal capturado es más lento que el real. Revisa el dato.`);
      }
      if (rendAlto) aviso.push('El rendimiento total pasa de 100 %: no se dibuja la cascada de pérdidas ni se señala la mayor pérdida.');

      let sim = null;
      if (e.mejoraFactor) {
        if (Number.isFinite(e.mejoraValor) && e.mejoraValor >= 0 && e.mejoraValor <= 100) sim = { clave: e.mejoraFactor, nuevo: e.mejoraValor / 100, ...simularMejora({ A, P, Q }, e.mejoraFactor, e.mejoraValor / 100) };
        else aviso.push('Captura el valor nuevo del factor entre 0 y 100 % para simular la mejora.');
      }

      const t = resumen?.total;
      const banda = total >= 0.85 ? 0 : total >= 0.6 ? 1 : 2;

      /* ---- salidas ---- */
      const salidas = [
        { id: 'oee', etiqueta: 'OEE', valor: pc(total), color: 'teal', ancha: true, nota: `${pc(A)} × ${pc(P)} × ${pc(Q)}` },
        { id: 'disp', etiqueta: 'Disponibilidad', valor: pc(A), nota: t ? `(${corto(t.plan, 2)} − ${corto(t.paros, 2)}) ÷ ${corto(t.plan, 2)} min` : HERRAMIENTAS.A },
        { id: 'rend', etiqueta: 'Rendimiento', valor: pc(P), nota: t ? `${entero(t.prod)} producidas de ${corto(t.teoricas, 1)} posibles` : HERRAMIENTAS.P },
        { id: 'cal', etiqueta: 'Calidad', valor: pc(Q), nota: t ? `${entero(t.buenas)} buenas de ${entero(t.prod)} producidas` : HERRAMIENTAS.Q },
      ];
      if (t && !rendAlto) {
        salidas.push({ id: 'productivo', etiqueta: 'Tiempo completamente productivo', valor: minutos(resumen.perdidas.productivo), nota: `${pc(total)} de ${minutos(t.plan)} planificados` });
      }
      if (hayDebil) {
        salidas.push({
          id: 'debil', etiqueta: 'Factor más débil', valor: debil.nombre, pequeno: true, ancha: true,
          nota: `${pc(debil.valor)} · lo atacan ${HERRAMIENTAS[debil.clave]}`,
        });
      }
      if (mayor) {
        const m = resumen ? ` · ${minutos(resumen.perdidas[mayor.clave])}` : '';
        salidas.push({
          id: 'mayor-perdida', etiqueta: 'Mayor pérdida de tiempo planificado', valor: NOMBRE_CORTO[mayor.clave], pequeno: true, ancha: true, color: 'coral',
          nota: `${pc(mayor.valor)} del tiempo planificado${m} · ${HERRAMIENTAS[PERDIDA_DE[mayor.clave]]}`,
        });
      }
      if (sim) {
        salidas.push(
          { id: 'oee-futuro', etiqueta: 'OEE con la mejora', valor: pc(sim.oee), color: 'teal', nota: `${FACTORES_OEE[sim.clave]} de ${pc({ A, P, Q }[sim.clave])} a ${pc(sim.nuevo)}` },
          { id: 'ganancia', etiqueta: 'Cambio del OEE', valor: `${conSigno(sim.ganancia * 100)} puntos`, color: sim.ganancia >= 0 ? 'teal' : 'coral', nota: `de ${pc(total)} a ${pc(sim.oee)}` }
        );
      }

      /* ---- semáforos ---- */
      const TEXTO_BANDA = [
        `OEE de ${pc(total)}: clase mundial (85 % o más). La referencia de Nakajima combina disponibilidad de 90 %, rendimiento de 95 % y calidad de 99 %.`,
        `OEE de ${pc(total)}: entre 60 % y 85 %, hay margen de mejora. Está por debajo de la clase mundial (85 %); la guía ubica a las plantas que no han trabajado el tema entre 40 % y 60 %.`,
        `OEE de ${pc(total)}: bajo, hay pérdidas grandes por atacar. La guía ubica a las plantas que no han trabajado el tema entre 40 % y 60 % y la clase mundial en 85 %.`,
      ];
      const semaforos = [rendAlto
        ? { nombre: 'OEE frente a la referencia', estado: 'atencion', texto: `OEE de ${pc(total)}, pero el rendimiento pasa de 100 %: no lo compares con la clase mundial hasta corregir el ciclo ideal.` }
        : { nombre: 'OEE frente a la referencia', estado: ['cumple', 'atencion', 'critico'][banda], texto: TEXTO_BANDA[banda] }];
      if (rendAlto) {
        semaforos.push({ nombre: 'Rendimiento', estado: 'critico', texto: `El rendimiento (${pc(P)}) pasa de 100 %: se produjo más de lo que el ciclo ideal permite. Revisa el ciclo ideal antes de confiar en el OEE.` });
      }
      if (hayDebil) {
        semaforos.push({
          nombre: 'Factor más débil', estado: 'informativo',
          texto: `${debil.nombre} (${pc(debil.valor)}) es el factor más bajo y, como los tres se multiplican, el que más arrastra el OEE. Lo atacan ${HERRAMIENTAS[debil.clave]}.`,
        });
      }
      if (mayor) {
        const c = PERDIDA_DE[mayor.clave];
        semaforos.push({
          nombre: 'Mayor pérdida', estado: 'informativo',
          texto: `La pérdida más grande es la de ${NOMBRE_CORTO[mayor.clave].toLowerCase()}: consume ${pc(mayor.valor)} del tiempo planificado${resumen ? ` (${minutos(resumen.perdidas[mayor.clave])})` : ''}; la atacan ${HERRAMIENTAS[c]}.${hayDebil && c !== debil.clave ? ' No coincide con el factor más débil: la pérdida mide minutos planificados y el factor mide qué tan bien se usa el tiempo que queda; con ambos criterios decide por dónde empezar.' : ''}`,
        });
      }
      if (resumen && resumen.filas.length >= 2) {
        const orden = [...resumen.filas].sort((a, b) => a.oee - b.oee);
        const peor = orden[0];
        const mejor = orden[orden.length - 1];
        semaforos.push({
          nombre: 'Variación entre periodos', estado: 'informativo',
          texto: `El OEE va de ${pc(peor.oee)} («${recorta(nombrePeriodo(peor), 24)}») a ${pc(mejor.oee)} («${recorta(nombrePeriodo(mejor), 24)}»): ${corto((mejor.oee - peor.oee) * 100, 2)} puntos de diferencia. Si cambia mucho de un periodo a otro, busca qué cambió ese día antes de atacar el promedio.`,
        });
      }
      if (sim) {
        semaforos.push({
          nombre: 'Mejora simulada', estado: 'informativo',
          texto: `Llevar ${ARTICULO[sim.clave]} de ${pc({ A, P, Q }[sim.clave])} a ${pc(sim.nuevo)}, con los otros dos factores igual, ${sim.ganancia >= 0 ? 'sube' : 'baja'} el OEE de ${pc(total)} a ${pc(sim.oee)} (${conSigno(sim.ganancia * 100)} puntos). Solo cuantifica ese cambio; no dice si la meta es alcanzable.`,
        });
      }

      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((x, i) => ({ ...x, activa: i < 3 ? i === banda : hayDebil && debil.clave === ['A', 'P', 'Q'][i - 3] })),
      };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Comprueba que el ciclo ideal sea el de diseño del equipo y que los paros se clasifiquen igual en todos los periodos.' };

      /* ---- gráficas ---- */
      const graficas = [];
      if (!rendAlto) {
        const etiquetas = [
          `Tiempo planificado<br>100 %`, `Paros<br>−${corto(casc.paros * 100, 2)} %`, `Velocidad y microparos<br>−${corto(casc.velocidad * 100, 2)} %`,
          `Defectos y retrabajo<br>−${corto(casc.defectos * 100, 2)} %`, `Tiempo productivo<br>${corto(casc.productivo * 100, 2)} %`,
        ];
        const base = [0, 1 - casc.paros, 1 - casc.paros - casc.velocidad, casc.productivo, 0].map((x) => x * 100);
        const minutosC = resumen ? [t.plan, resumen.perdidas.paros, resumen.perdidas.velocidad, resumen.perdidas.defectos, resumen.perdidas.productivo].map((x) => minutos(x)) : null;
        const comun = { type: 'bar', x: etiquetas, showlegend: false, customdata: minutosC ?? etiquetas.map(() => ''), hovertemplate: minutosC ? '%{x}<br>%{customdata}<extra></extra>' : '%{x}<extra></extra>' };
        graficas.push({
          id: 'cascada', titulo: 'A dónde se va el tiempo planificado (% del tiempo planificado)', ancha: true,
          datos: [
            { ...comun, y: base, marker: { color: 'rgba(0,0,0,0)', line: { width: 0 } }, hoverinfo: 'skip', hovertemplate: undefined },
            { ...comun, y: [100, 0, 0, 0, casc.productivo * 100], marker: { color: [COLOR.azul, COLOR.azul, COLOR.azul, COLOR.azul, COLOR.teal], line: { width: 0 } } },
            { ...comun, y: [0, casc.paros, casc.velocidad, casc.defectos, 0].map((x) => x * 100), marker: { color: [COLOR.coral, COLOR.coral, COLOR.ambar, COLOR.violeta, COLOR.coral], line: { width: 0 } } },
          ],
          layout: { barmode: 'stack', bargap: 0.3, xaxis: { automargin: true }, yaxis: { title: { text: '% del tiempo planificado' }, range: [0, 105] } },
          respaldo: {
            columnas: resumen ? ['Concepto', '% del tiempo planificado', 'Minutos'] : ['Concepto', '% del tiempo planificado'],
            filas: [
              ['Tiempo planificado', '100', ...(resumen ? [corto(t.plan, 2)] : [])],
              ['Paros', corto(casc.paros * 100, 2), ...(resumen ? [corto(resumen.perdidas.paros, 2)] : [])],
              ['Velocidad y microparos', corto(casc.velocidad * 100, 2), ...(resumen ? [corto(resumen.perdidas.velocidad, 2)] : [])],
              ['Defectos y retrabajo', corto(casc.defectos * 100, 2), ...(resumen ? [corto(resumen.perdidas.defectos, 2)] : [])],
              ['Tiempo completamente productivo', corto(casc.productivo * 100, 2), ...(resumen ? [corto(resumen.perdidas.productivo, 2)] : [])],
            ],
          },
        });
      }
      const nombresF = ['Disponibilidad', 'Rendimiento', 'Calidad', 'OEE'];
      const valoresF = [A, P, Q, total].map((x) => x * 100);
      const refF = [REFERENCIA.A, REFERENCIA.P, REFERENCIA.Q, REFERENCIA.OEE];
      graficas.push({
        id: 'factores', titulo: 'Factores y OEE frente a la clase mundial (%)', ancha: true,
        datos: [
          {
            type: 'bar', x: nombresF, y: valoresF, name: 'Valor', showlegend: false,
            marker: { color: ['A', 'P', 'Q'].map((k) => (hayDebil && k === debil.clave ? COLOR.coral : COLOR.teal)).concat(COLOR.azul), line: { width: 0 } },
            text: valoresF.map((v) => `${corto(v, 2)} %`), textposition: 'inside', insidetextanchor: 'start', textangle: 0, insidetextfont: ETIQUETA_OSCURA,
          },
          {
            type: 'scatter', mode: 'markers', x: nombresF, y: refF, name: 'Clase mundial (Nakajima)',
            marker: { symbol: 'diamond', size: 11, color: COLOR.ambar, line: { color: '#0a1011', width: 1 } },
            hovertemplate: 'clase mundial: %{y} %<extra></extra>',
          },
        ],
        layout: { bargap: 0.5, yaxis: { title: { text: '%' }, range: [0, Math.max(105, ...valoresF.map((v) => v + 5))] }, legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.1, yanchor: 'bottom' } },
        respaldo: {
          columnas: ['Medida', 'Valor (%)', 'Clase mundial (%)'],
          filas: nombresF.map((n, i) => [n, corto(valoresF[i], 2), String(refF[i])]),
        },
      });
      if (resumen && resumen.filas.length >= 2) {
        const nombresP = resumen.filas.map((f) => recorta(nombrePeriodo(f), 14));
        const serie = (nombre, campo, color, ancho = 2) => ({
          type: 'scatter', mode: 'lines+markers', x: nombresP, y: resumen.filas.map((f) => f[campo] * 100), name: nombre,
          line: { color, width: ancho, shape: 'linear' }, marker: { size: 7, color }, hovertemplate: `${nombre}: %{y:.2f} %<extra></extra>`,
        });
        const todos = resumen.filas.flatMap((f) => [f.A, f.P, f.Q, f.oee]).map((x) => x * 100);
        graficas.push({
          id: 'periodos', titulo: 'Factores y OEE por periodo (%)', ancha: true,
          datos: [serie('Disponibilidad', 'A', COLOR.azul), serie('Rendimiento', 'P', COLOR.violeta), serie('Calidad', 'Q', COLOR.ambar), serie('OEE', 'oee', COLOR.teal, 3.2)],
          layout: {
            xaxis: { type: 'category' },
            yaxis: { title: { text: '%' }, range: [Math.max(0, Math.floor((Math.min(...todos) - 5) / 10) * 10), Math.max(105, Math.ceil(Math.max(...todos) / 5) * 5 + 2)] },
            shapes: [lineaH(85, COLOR.gris, { dash: 'dot', ancho: 1.2 })],
            annotations: [etiquetaH(85, 'clase mundial 85 %', COLOR.gris, { x: 0, ancla: 'left' })],
            legend: { orientation: 'h', y: -0.2 },
          },
          respaldo: {
            columnas: ['Periodo', 'Disponibilidad (%)', 'Rendimiento (%)', 'Calidad (%)', 'OEE (%)'],
            filas: resumen.filas.map((f) => [nombrePeriodo(f), corto(f.A * 100, 2), corto(f.P * 100, 2), corto(f.Q * 100, 2), corto(f.oee * 100, 2)]),
          },
        });
      }

      /* ---- tablas ---- */
      const tablas = [];
      const celda = (x, formula = false) => ({ texto: x, num: true, formula });
      if (resumen && resumen.filas.length >= 2) {
        tablas.push({
          titulo: 'OEE por periodo',
          columnas: ['Periodo', { t: 'Plan', num: true }, { t: 'Paros', num: true }, { t: 'Ciclo', num: true }, { t: 'Prod.', num: true }, { t: 'Buenas', num: true }, { t: 'Disp.', num: true }, { t: 'Rend.', num: true }, { t: 'Cal.', num: true }, { t: 'OEE', num: true }],
          filas: [
            ...resumen.filas.map((f) => [
              recorta(nombrePeriodo(f), 24), celda(corto(f.plan, 2)), celda(corto(f.paros, 2)), celda(corto(f.ciclo, 4)), celda(entero(f.prod)), celda(entero(f.buenas)),
              celda(pc(f.A), true), celda(pc(f.P), true), celda(pc(f.Q), true), celda(pc(f.oee), true),
            ]),
            ['Total', celda(corto(t.plan, 2), true), celda(corto(t.paros, 2), true), celda(corto(t.ciclo, 4), true), celda(entero(t.prod), true), celda(entero(t.buenas), true), celda(pc(t.A), true), celda(pc(t.P), true), celda(pc(t.Q), true), celda(pc(t.oee), true)],
          ],
          resaltar: [resumen.filas.length],
          pie: 'Plan y paros en minutos; ciclo ideal en min por unidad; prod. = unidades producidas. Disp. = (plan − paros) ÷ plan · rend. = ciclo ideal × producidas ÷ (plan − paros) · cal. = buenas ÷ producidas. El total suma los periodos y pondera el ciclo ideal por las unidades producidas.',
        });
      }
      if (!rendAlto) {
        const filaC = (concepto, valor, min, herramienta) => (resumen
          ? [concepto, celda(min), celda(pc(valor), true), herramienta]
          : [concepto, celda(pc(valor), true), herramienta]);
        const p = resumen?.perdidas;
        tablas.push({
          titulo: 'Cascada de pérdidas',
          columnas: resumen
            ? ['Concepto', { t: 'Minutos', num: true }, { t: '% del tiempo planificado', num: true }, 'Herramienta Lean que lo ataca']
            : ['Concepto', { t: '% del tiempo planificado', num: true }, 'Herramienta Lean que lo ataca'],
          filas: [
            filaC('Tiempo planificado', 1, resumen ? corto(t.plan, 2) : '', 'Línea base'),
            filaC(NOMBRE_PERDIDA.paros, casc.paros, resumen ? corto(p.paros, 2) : '', HERRAMIENTAS.A),
            filaC(NOMBRE_PERDIDA.velocidad, casc.velocidad, resumen ? corto(p.velocidad, 2) : '', HERRAMIENTAS.P),
            filaC(NOMBRE_PERDIDA.defectos, casc.defectos, resumen ? corto(p.defectos, 2) : '', HERRAMIENTAS.Q),
            filaC('Tiempo completamente productivo', casc.productivo, resumen ? corto(p.productivo, 2) : '', ''),
          ],
          resaltar: [4],
          pie: resumen
            ? `Paros = ${corto(t.paros, 2)} · velocidad = ${corto(t.plan, 2)} − ${corto(t.paros, 2)} − ${corto(t.ciclo, 4)} × ${entero(t.prod)} = ${corto(p.velocidad, 2)} · defectos = ${corto(t.ciclo, 4)} × (${entero(t.prod)} − ${entero(t.buenas)}) = ${corto(p.defectos, 2)} · productivo = ${corto(t.ciclo, 4)} × ${entero(t.buenas)} = ${corto(p.productivo, 2)} min. Suman los ${corto(t.plan, 2)} min planificados.`
            : `Paros = 1 − A · velocidad = A × (1 − P) · defectos = A × P × (1 − Q) · productivo = A × P × Q = ${pc(total)}. Suman el 100 % del tiempo planificado.`,
        });
      }

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
