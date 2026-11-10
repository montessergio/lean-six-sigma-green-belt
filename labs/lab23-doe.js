/**
 * LAB 23 · Diseño factorial 2² (efectos, interacción y significancia)
 *
 * Guía: M9 §3 (por qué un factor a la vez no basta) y §4 (factorial 2² de fuerza de engarzado y longitud de pelado con dos réplicas:
 * efectos por la tabla de signos, prueba t con el error que dan las réplicas y decisión técnica: 173 N y 7 mm), ejercicios 2 y 3 ·
 * plantilla Excel «DOE 2x2» (hasta cinco réplicas por corrida, suma de cuadrados, % de contribución, mejor combinación según
 * maximizar o minimizar, predicción con niveles propios y aviso de extrapolación).
 *   Efecto = promedio de la respuesta con el factor en nivel alto − promedio con el factor en nivel bajo; AB usa el producto de los signos.
 *   Error = variación entre réplicas: SCE = Σ (nᵢ − 1) sᵢ², gl = N − 4, CME = SCE ÷ gl; error estándar del efecto = 2 √CME ÷ √N.
 *   t = efecto ÷ error estándar, valor p con t de Student de gl grados (dos colas); SC = N × efecto² ÷ 4; % de contribución = SC ÷ SC total.
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Ojo con el error estándar: 0.05 es el del coeficiente (efecto ÷ 2); el del efecto, una diferencia de promedios, es 0.10 y el margen ±0.278
 * en lugar de ±0.14. Las tres conclusiones no cambian y el estadístico t es el mismo (−9, −4, −1). (El libro ya usa 0.10 y ±0.28 en la tabla
 * de efectos, pero conserva 0.05 y ±0.14 en la fórmula del margen y en la fila de la interacción.)
 * Diferencias con la plantilla: pide el mismo número de réplicas en las cuatro corridas; aquí se aceptan réplicas desiguales (efectos y prueba t sí, sumas de
 * cuadrados no) y también una sola réplica (solo efectos, sin prueba, como el ejercicio 2 de la guía). La predicción con 173 N y 7 mm la calcula el
 * laboratorio con el modelo de la plantilla; la guía solo decide esos valores.
 *
 * Presets: la guía (2 réplicas), la plantilla (3 réplicas), el ejercicio 2 (una réplica), el ejercicio 3 (sin resultado impreso: clave en el
 * Apéndice C) y una variante didáctica con interacción fuerte (datos inventados).
 */
import { CORRIDAS_2X2, SIGNOS_2X2, factorial2x2, mejorCorrida, predecir2x2 } from '../js/lib/mejorar.js';
import { corto, entero, num, pct, plural, valorP } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { lineaH } from '../js/lib/graficas.js';

const REPLICAS = 5; // columnas Y1…Y5 de la plantilla
const IDS_Y = Array.from({ length: REPLICAS }, (_, i) => `y${i + 1}`);
const fila = (...y) => Object.fromEntries(IDS_Y.map((id, i) => [id, y[i] ?? NaN]));
const ETIQUETA_OSCURA = { color: '#0a1011', size: 11 };
const SIGNOS_EFECTO = { A: [-1, 1, -1, 1], B: [-1, -1, 1, 1], AB: [1, -1, -1, 1] }; // sobre (1), a, b, ab
const GL_REFERENCIA = 4; // dos réplicas por combinación, como la guía

const FACTORES_GUIA = [
  { nombre: 'Fuerza de engarzado (N)', bajo: 165, alto: 178 },
  { nombre: 'Longitud de pelado (mm)', bajo: 5, alto: 7 },
];
const FACTORES_EXCEL = [
  { nombre: 'Presión de crimpado (bar)', bajo: 5, alto: 7 },
  { nombre: 'Velocidad de alimentación (%)', bajo: 80, alto: 100 },
];
const FACTORES_EJ2 = [
  { nombre: 'Velocidad de máquina', bajo: -1, alto: 1 },
  { nombre: 'Temperatura de sellado', bajo: -1, alto: 1 },
];
const FACTORES_EJ3 = [
  { nombre: 'Factor A', bajo: -1, alto: 1 },
  { nombre: 'Factor B', bajo: -1, alto: 1 },
];
const FACTORES_INTERACCION = [
  { nombre: 'Temperatura (°C)', bajo: 150, alto: 170 },
  { nombre: 'Concentración de catalizador (%)', bajo: 1, alto: 2 },
];
const CORRIDAS_GUIA = [fila(2.1, 1.9), fila(1.3, 1.1), fila(1.8, 1.6), fila(0.8, 0.6)];
const CORRIDAS_EXCEL = [fila(97.7, 101, 101.3), fila(115.9, 118.3, 119.8), fila(103.9, 102, 106), fila(132.2, 128.3, 129.4)];
const CORRIDAS_EJ2 = [fila(12), fila(18), fila(14), fila(22)];
const CORRIDAS_EJ3 = [fila(15), fila(22), fila(19), fila(30)];
const CORRIDAS_INTERACCION = [fila(60, 62, 61), fila(80, 82, 81), fila(78, 80, 79), fila(60, 62, 61)];

const BASE = {
  respuesta: 'Resistencia de contacto (mΩ)', objetivo: 'min', factores: FACTORES_GUIA, corridas: CORRIDAS_GUIA, alfa: 0.05, predA: 173, predB: 7,
};

const UMBRAL = {
  titulo: 'Cómo leer el diseño factorial 2² (guía M9 y plantilla «DOE 2x2»)',
  filas: [
    { rango: 'p < α', texto: 'el efecto es distinto de cero con la significancia elegida: su intervalo no incluye 0' },
    { rango: 'p ≥ α', texto: 'con estos datos no se distingue de cero; no prueba que sea cero, sobre todo con pocas réplicas' },
    { rango: 'AB significativa', texto: 'el efecto de un factor depende del nivel del otro (las líneas de la gráfica se cruzan o se abren): interpreta los efectos principales con cuidado y decide con la combinación' },
    { rango: 'Sin réplicas', texto: 'no hay error estimado: ni prueba t ni intervalos; solo se comparan los tamaños de los efectos (ejercicio 2 de la guía)' },
    { rango: 'Pocos gl', texto: 'con menos de 4 grados de libertad el t crítico es grande y solo se detectan efectos grandes (referencia didáctica: 2 réplicas por combinación, como la guía)' },
    { rango: 'Efecto', texto: 'promedio de la respuesta con el factor en nivel alto (+) menos el promedio con el factor en nivel bajo (−): lo que cambia la respuesta al pasar de un nivel al otro' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto del método',
  texto:
    'El análisis supone que las corridas se hicieron en orden aleatorio, que las réplicas son repeticiones verdaderas del experimento (se reajustan los niveles y se vuelve a producir; medir dos veces la misma pieza no es una réplica y subestima el error), ' +
    'que la variación dentro de las cuatro combinaciones es parecida y que los errores siguen una distribución normal; con dos o tres réplicas esos dos últimos supuestos casi no se pueden comprobar. ' +
    'El modelo solo tiene dos niveles por factor: describe una línea entre ellos y no puede ver curvatura, así que la predicción vale dentro del rango estudiado y fuera de él es una extrapolación. ' +
    'Los efectos dependen de los niveles elegidos: con otros niveles pueden cambiar de tamaño.',
};

const SIN_PRUEBA = {
  replicas: 'Sin réplicas no hay prueba: solo puedes comparar su tamaño con el de los otros efectos y repetir las corridas para confirmarlo.',
  identicas: 'Las réplicas idénticas dan un error de 0: no hay prueba. Revisa si los datos están redondeados o copiados.',
  alfa: 'Sin un α válido no se prueba la significancia.',
};
const NOTA_SIN_PRUEBA = { replicas: 'sin réplicas, sin prueba', identicas: 'réplicas idénticas, sin prueba', alfa: 'α no válido, sin prueba' };

const recorta = (texto, n = 38) => (texto.length > n ? `${texto.slice(0, n - 1)}…` : texto);
const pTexto = (p) => (p < 0.0001 ? 'p < 0.0001' : `p = ${num(p, 4)}`);
const lista = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`);
/** «2 réplicas por corrida» o, si no son iguales, «3, 3, 2 y 3 réplicas en (1), a, b y ab». */
const replicasTxt = (reps) => (reps.every((n) => n === reps[0])
  ? `${reps[0]} ${reps[0] === 1 ? 'réplica' : 'réplicas'} por corrida`
  : `${lista(reps.map(String))} réplicas en ${lista([...CORRIDAS_2X2])}`);
const codificado = (f) => f?.bajo === -1 && f?.alto === 1; // niveles escritos solo como signos
const nivelTxt = (f, cual) => {
  if (codificado(f)) return cual === 'bajo' ? 'bajo (−)' : 'alto (+)';
  const v = cual === 'bajo' ? f?.bajo : f?.alto;
  return Number.isFinite(v) ? corto(v, 4) : cual;
};
/** «A bajo (165)», «A bajo (−)» o «A bajo» según cómo se escribieron los niveles (para ejes y leyendas). */
const etiquetaNivel = (letra, f, cual) => {
  if (codificado(f)) return `${letra} ${cual} (${cual === 'bajo' ? '−' : '+'})`;
  const v = cual === 'bajo' ? f?.bajo : f?.alto;
  return Number.isFinite(v) ? `${letra} ${cual} (${corto(v, 4)})` : `${letra} ${cual}`;
};
/** «165 y 178», «− y +» o «bajo y alto». */
const parNiveles = (f) => (codificado(f) ? '− y +' : Number.isFinite(f?.bajo) && Number.isFinite(f?.alto) ? `${corto(f.bajo, 4)} y ${corto(f.alto, 4)}` : 'bajo y alto');
/** «A = 165 · B = 5» para la corrida i (con niveles −1/+1: «A − · B −»; sin niveles: «A bajo · B bajo»). */
function nivelesTexto(est, i) {
  const [sa, sb] = SIGNOS_2X2[i] ?? [0, 0];
  const parte = (letra, f, s) => {
    if (codificado(f)) return `${letra} ${s < 0 ? '−' : '+'}`;
    const v = s < 0 ? f?.bajo : f?.alto;
    return Number.isFinite(v) ? `${letra} = ${corto(v, 4)}` : `${letra} ${s < 0 ? 'bajo' : 'alto'}`;
  };
  return `${parte('A', est.factores?.[0], sa)} · ${parte('B', est.factores?.[1], sb)}`;
}
const combinar = (signos, textos) => signos.map((s, i) => (i === 0 ? `${s < 0 ? '−' : ''}${textos[i]}` : ` ${s < 0 ? '−' : '+'} ${textos[i]}`)).join('');
const textoMedia = (v) => (v < 0 ? `(${corto(v, 4)})` : corto(v, 4));
const fueraDe = (v, f) => Number.isFinite(f?.bajo) && Number.isFinite(f?.alto) && (v < Math.min(f.bajo, f.alto) || v > Math.max(f.bajo, f.alto));

export default function lab23() {
  return {
    id: 'lab23',
    numero: '23',
    modulo: 'M9',
    titulo: 'Diseño factorial 2²: efectos e interacción',
    resumen: 'Captura las respuestas de un experimento con dos factores y dos niveles, calcula los efectos y la interacción con su significancia, mira la gráfica de interacción, elige la mejor combinación y predice con otros niveles.',
    panelAncho: true,
    entradas: [
      { id: 'respuesta', tipo: 'texto', etiqueta: 'Variable de respuesta (con unidades)', valor: BASE.respuesta, marcador: 'p. ej. Resistencia de contacto (mΩ)' },
      {
        id: 'objetivo', tipo: 'opcion', etiqueta: 'Objetivo de la respuesta', valor: BASE.objetivo,
        opciones: [{ valor: 'min', texto: 'Minimizar' }, { valor: 'max', texto: 'Maximizar' }],
        ayuda: 'Decide qué combinación se señala como la mejor: la de menor o la de mayor promedio.',
      },
      {
        id: 'factores', tipo: 'tabla', etiqueta: 'Factores y niveles',
        columnas: [
          { id: 'factor', etiqueta: 'Factor', tipo: 'fijo', texto: (est, f, i) => ['A', 'B'][i] ?? '' },
          { id: 'nombre', etiqueta: 'Nombre (con unidades)', tipo: 'texto', ancho: '250px' },
          { id: 'bajo', etiqueta: 'Nivel bajo (−)', tipo: 'numero', ancho: '84px', ayuda: 'El nivel que lleva el signo − en la tabla de signos.' },
          { id: 'alto', etiqueta: 'Nivel alto (+)', tipo: 'numero', ancho: '84px', ayuda: 'El nivel que lleva el signo + en la tabla de signos.' },
        ],
        filas: BASE.factores, filaNueva: { nombre: '', bajo: NaN, alto: NaN }, minFilas: 2, maxFilas: 2, agregar: false, numerar: false,
        ayuda: 'Si solo te importan los signos, escribe −1 y 1. Los niveles se usan para nombrar las corridas y para predecir.',
      },
      {
        id: 'corridas', tipo: 'tabla', etiqueta: 'Respuestas por corrida (una columna por réplica)',
        columnas: [
          { id: 'corrida', etiqueta: 'Corrida', tipo: 'fijo', texto: (est, f, i) => CORRIDAS_2X2[i] ?? '' },
          { id: 'niveles', etiqueta: 'Niveles', tipo: 'fijo', texto: (est, f, i) => nivelesTexto(est, i) },
          ...IDS_Y.map((id, i) => ({ id, etiqueta: `Y${i + 1}`, tipo: 'numero', ancho: '58px', ayuda: `Respuesta de la réplica ${i + 1} de esa combinación. Déjala en blanco si no la hiciste.` })),
        ],
        filas: BASE.corridas, filaNueva: fila(), minFilas: 4, maxFilas: 4, agregar: false, numerar: false,
        ayuda: 'Cada fila es una combinación de niveles: (1) = A y B en bajo, a = A en alto, b = B en alto, ab = ambos en alto. Una réplica es repetir el experimento completo, no medir otra vez la misma pieza. Se aceptan de 1 a 5 réplicas.',
      },
      {
        id: 'alfa', tipo: 'numero', etiqueta: 'Nivel de significancia α', valor: BASE.alfa, min: 0.001, max: 0.2, marcador: 'p. ej. 0.05',
        ayuda: 'La plantilla acepta de 0.001 a 0.2; la guía usa 0.05.',
      },
      { tipo: 'seccion', etiqueta: 'Opcional · predecir con niveles propios' },
      { id: 'predA', tipo: 'numero', etiqueta: 'Valor de A para predecir', valor: BASE.predA, marcador: 'p. ej. 173', ayuda: 'En las mismas unidades que los niveles de A.' },
      { id: 'predB', tipo: 'numero', etiqueta: 'Valor de B para predecir', valor: BASE.predB, marcador: 'p. ej. 7', ayuda: 'En las mismas unidades que los niveles de B.' },
    ],
    presets: [
      {
        id: 'guia', etiqueta: 'Guía M9: fuerza de engarzado y longitud de pelado (2 réplicas)',
        ayuda: 'Las ocho corridas del módulo: resistencia de contacto en mΩ, a minimizar. Efectos de −0.90, −0.40 y −0.10. El error estándar del efecto es 0.10 mΩ y el margen ±0.278; el 0.05 (y un margen de ±0.14) sería el del coeficiente, efecto ÷ 2. Las conclusiones no cambian. La predicción con 173 N y 7 mm (la decisión de la guía) la calcula el laboratorio; la guía no da ese número.',
        valores: { ...BASE },
      },
      {
        id: 'excel', etiqueta: 'Plantilla Excel «DOE 2x2»: presión y velocidad (3 réplicas)',
        ayuda: 'Datos de ejemplo de la plantilla: fuerza de jalón en N, a maximizar, con tres réplicas por corrida. Los tres efectos resultan significativos. La predicción en el centro de los niveles (6 bar y 90 %) coincide con la media de las cuatro corridas.',
        valores: { ...BASE, respuesta: 'Fuerza de jalón (N)', objetivo: 'max', factores: FACTORES_EXCEL, corridas: CORRIDAS_EXCEL, predA: 6, predB: 90 },
      },
      {
        id: 'ej2', etiqueta: 'Guía M9 ej. 2: sellado con una réplica (12, 18, 14 y 22)',
        ayuda: 'Ejercicio 2 resuelto de la guía: velocidad de máquina y temperatura de sellado, resistencia del sellado en N, una réplica por combinación. Efectos de 7, 3 y 1. Con una sola réplica no hay error estimado: no se puede probar la significancia.',
        valores: { ...BASE, respuesta: 'Resistencia del sellado (N)', objetivo: 'max', factores: FACTORES_EJ2, corridas: CORRIDAS_EJ2, predA: NaN, predB: NaN },
      },
      {
        id: 'ej3', etiqueta: 'Guía M9 ej. 3: (1) = 15, a = 22, b = 19 y ab = 30',
        ayuda: 'Ejercicio 3 de la guía, sin resolver: calcula a mano el efecto principal de B y compáralo con la clave del Apéndice C.',
        valores: { ...BASE, respuesta: 'Respuesta', objetivo: 'max', factores: FACTORES_EJ3, corridas: CORRIDAS_EJ3, predA: NaN, predB: NaN },
      },
      {
        id: 'interaccion', etiqueta: 'Variante didáctica: interacción fuerte (datos inventados)',
        ayuda: 'Datos inventados con tres réplicas: los dos efectos principales casi no se ven porque se cancelan, pero la interacción es enorme. Observa las líneas que se cruzan en la gráfica y la mejor combinación.',
        valores: { ...BASE, respuesta: 'Rendimiento de la reacción (%)', objetivo: 'max', factores: FACTORES_INTERACCION, corridas: CORRIDAS_INTERACCION, predA: NaN, predB: NaN },
      },
    ],
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Qué efecto domina y cuánto pesa frente a los demás (% de contribución)? Si el efecto menor fuera cero, ¿cambiaría tu decisión?',
      'Con una sola réplica por combinación, ¿qué puedes afirmar de cada efecto y qué no? ¿Cuántas corridas más necesitarías para probarlos y cuántos grados de libertad te darían?',
      'Si la interacción fuera significativa, ¿cómo cambiaría la forma de ajustar los dos factores? Dibuja cómo se verían las líneas de la gráfica.',
      '¿Qué diferencia hay entre una réplica (volver a ajustar el proceso y producir) y medir dos veces la misma pieza? ¿Qué error estimarías en cada caso?',
      'La combinación que quieres implementar, ¿está dentro del rango estudiado? ¿Qué corrida de confirmación harías antes de cambiar la instrucción de trabajo?',
    ],

    calcular(e) {
      const aviso = [];
      const fac = [0, 1].map((i) => e.factores?.[i] ?? {});
      const [fa, fb] = fac;
      const nombreDe = (i) => String(fac[i].nombre ?? '').trim() || `Factor ${'AB'[i]}`;
      const nombreA = nombreDe(0);
      const nombreB = nombreDe(1);
      const respuesta = String(e.respuesta ?? '').trim() || 'Respuesta';
      const minimizar = e.objetivo === 'min';

      const y = [0, 1, 2, 3].map((i) => IDS_Y.map((id) => e.corridas?.[i]?.[id]).filter(Number.isFinite));
      const faltan = CORRIDAS_2X2.filter((_, i) => !y[i].length);
      if (faltan.length) {
        if (faltan.length < 4) aviso.push(`Falta al menos una respuesta en ${faltan.length === 1 ? 'la corrida' : 'las corridas'} ${lista(faltan)}: las cuatro combinaciones necesitan una.`);
        return {
          aviso,
          vacio: 'Captura al menos una respuesta en cada una de las cuatro corridas: (1), a, b y ab.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Sin una respuesta en cada combinación no se pueden calcular los efectos.' }],
        };
      }

      const alfaOk = Number.isFinite(e.alfa) && e.alfa >= 0.001 && e.alfa <= 0.2;
      if (!alfaOk) aviso.push('Captura α entre 0.001 y 0.2 (la guía usa 0.05): sin un α válido se calculan los efectos pero no se prueba su significancia.');
      const alfaTxt = corto(e.alfa, 4);
      const res = factorial2x2(y, { alfa: alfaOk ? e.alfa : NaN });
      const [A, B, AB] = res.efectos;
      const m = res.medias;
      const reps = res.corridas.map((c) => c.n);
      const motivo = res.prueba ? null : res.gl < 1 ? 'replicas' : !(res.se > 0) ? 'identicas' : 'alfa';
      if (!res.balanceado) {
        aviso.push(`Hay ${replicasTxt(reps)}: se calculan los efectos y las pruebas t con la fórmula general del error estándar, pero no las sumas de cuadrados ni el % de contribución. La plantilla pide el mismo número de réplicas en las cuatro corridas.`);
      }

      const difMedias = Math.max(...m) - Math.min(...m);
      const mejor = difMedias > 1e-12 ? mejorCorrida(m, e.objetivo) : null;
      const empates = mejor ? m.filter((v) => Math.abs(v - mejor.media) < 1e-9).length : 0;

      let pred = null;
      if ([e.predA, e.predB].some(Number.isFinite)) {
        const niveles = [fa.bajo, fa.alto, fb.bajo, fb.alto];
        if (!Number.isFinite(e.predA) || !Number.isFinite(e.predB)) aviso.push('Captura los dos valores (A y B) para predecir la respuesta.');
        else if (!niveles.every(Number.isFinite) || fa.bajo === fa.alto || fb.bajo === fb.alto) aviso.push('Para predecir, el nivel bajo y el alto de cada factor deben ser números distintos.');
        else pred = predecir2x2(res, { bajoA: fa.bajo, altoA: fa.alto, bajoB: fb.bajo, altoB: fb.alto }, e.predA, e.predB);
      }

      /* ---- salidas ---- */
      const salidas = [];
      const notaEfecto = (x) => (res.prueba ? `${pTexto(x.p)} · ${x.significativo ? 'significativo' : 'no significativo'}` : NOTA_SIN_PRUEBA[motivo]);
      [[A, 'A'], [B, 'B'], [AB, 'AB']].forEach(([x, letra]) => {
        salidas.push({
          id: `efecto-${letra.toLowerCase()}`, etiqueta: letra === 'AB' ? 'Interacción AB' : `Efecto de ${letra}`, valor: corto(x.efecto, 4), nota: notaEfecto(x),
          ...(x.significativo ? { color: 'teal' } : {}),
        });
      });
      if (res.prueba) {
        salidas.push(
          {
            id: 'se', etiqueta: 'Error estándar del efecto', valor: corto(res.se, 4),
            nota: res.balanceado ? `2 × √CME ÷ √N = 2 × ${corto(res.sp, 4)} ÷ √${entero(res.N)}` : '½ √(CME × Σ 1/nᵢ) con réplicas desiguales',
          },
          { id: 'margen', etiqueta: `Margen ± (α = ${alfaTxt})`, valor: `± ${corto(res.margen, 4)}`, nota: `t crítico ${corto(res.tcrit, 4)} con ${entero(res.gl)} gl × error estándar` }
        );
      }
      salidas.push({
        id: 'gl', etiqueta: 'Grados de libertad del error', valor: entero(res.gl),
        nota: res.gl >= 1 ? `${plural(res.N, 'respuesta')} − 4 parámetros` : 'sin réplicas no hay error estimado',
      });
      if (res.balanceado && res.gl >= 1 && Number.isFinite(res.r2)) {
        salidas.push({ id: 'r2', etiqueta: 'Variación explicada (R²)', valor: pct(res.r2, 2), nota: `el error (réplicas) es ${pct(res.pctError, 2)}` });
      }
      if (mejor) {
        salidas.push({
          id: 'mejor', etiqueta: `Mejor combinación (la ${minimizar ? 'más baja' : 'más alta'})`, valor: mejor.corrida, color: 'teal',
          nota: `${nivelesTexto(e, mejor.indice)} · promedio ${corto(mejor.media, 4)}`,
        });
      }
      if (pred && Number.isFinite(pred.y)) {
        salidas.push({
          id: 'prediccion', etiqueta: 'Respuesta predicha', valor: corto(pred.y, 4), color: pred.extrapola ? 'coral' : 'azul',
          nota: pred.extrapola ? `A = ${corto(e.predA, 4)} · B = ${corto(e.predB, 4)} · extrapolación` : `A = ${corto(e.predA, 4)} · B = ${corto(e.predB, 4)}`,
        });
      }

      /* ---- semáforos ---- */
      const semaforos = [];
      const cambio = (x) => (x.efecto === 0 ? 'la respuesta no cambia en promedio' : `la respuesta ${x.efecto > 0 ? 'sube' : 'baja'} ${corto(Math.abs(x.efecto), 4)} en promedio`);
      const veredicto = (x) => {
        if (!res.prueba) return { estado: 'informativo', fin: SIN_PRUEBA[motivo] };
        const ic = `(${corto(x.ic[0], 4)}; ${corto(x.ic[1], 4)})`;
        return x.significativo
          ? { estado: 'atencion', fin: `(t = ${num(x.t, 2)}, ${pTexto(x.p)}). Como p < α (${alfaTxt}), el intervalo ${ic} no incluye 0: el efecto es distinto de cero.` }
          : {
            estado: 'informativo',
            fin: `(t = ${num(x.t, 2)}, ${pTexto(x.p)}). Como p ≥ α (${alfaTxt}), el intervalo ${ic} incluye 0: con estos datos no se distingue de cero. Eso no prueba que sea cero: con pocas réplicas solo se detectan efectos grandes.${AB.significativo ? ' Ojo: la interacción sí es significativa, así que este promedio puede ocultar efectos de signo contrario en cada nivel del otro factor.' : ''}`,
          };
      };
      [[A, 0], [B, 1]].forEach(([x, i]) => {
        const v = veredicto(x);
        const f = fac[i];
        const frase = `${nombreDe(i)}: al pasar de ${nivelTxt(f, 'bajo')} a ${nivelTxt(f, 'alto')}, ${cambio(x)}`;
        semaforos.push({ nombre: `Efecto de ${'AB'[i]}`, estado: v.estado, texto: res.prueba ? `${frase} ${v.fin}` : `${frase}. ${v.fin}` });
      });
      {
        const mayorPrincipal = Math.max(Math.abs(A.efecto), Math.abs(B.efecto));
        const razon = mayorPrincipal > 0 ? Math.abs(AB.efecto) / mayorPrincipal : NaN;
        const relacion = !Number.isFinite(razon) ? '' : razon >= 2 ? `, ${corto(razon, 2)} veces el mayor efecto principal` : `, el ${pct(razon, 0)} del mayor efecto principal`;
        if (res.prueba) {
          semaforos.push(AB.significativo
            ? {
              nombre: 'Interacción AB', estado: 'atencion',
              texto: `La interacción es de ${corto(AB.efecto, 4)}${relacion} (t = ${num(AB.t, 2)}, ${pTexto(AB.p)}): significativa. El efecto de cada factor depende del nivel del otro y las líneas de la gráfica no son paralelas: decide con la combinación y no con cada factor por separado, e interpreta los efectos principales con cuidado.`,
            }
            : {
              nombre: 'Interacción AB', estado: 'informativo',
              texto: `La interacción es de ${corto(AB.efecto, 4)}${relacion} (t = ${num(AB.t, 2)}, ${pTexto(AB.p)}): no se distingue de cero. Las líneas son casi paralelas y los factores se pueden ajustar por separado. Eso no prueba que no exista: con pocas réplicas solo se detectan interacciones grandes.`,
            });
        } else {
          semaforos.push({
            nombre: 'Interacción AB', estado: 'informativo',
            texto: `La interacción es de ${corto(AB.efecto, 4)}${relacion}. ${SIN_PRUEBA[motivo]} Si las líneas de la gráfica no son paralelas, el efecto de un factor depende del nivel del otro.`,
          });
        }
      }
      if (res.gl < 1) {
        semaforos.push({
          nombre: 'Réplicas', estado: 'atencion',
          texto: `Hay una sola respuesta por combinación: se calculan los efectos, pero no el error experimental, ni la prueba t ni los intervalos. Con 2 réplicas por combinación (${GL_REFERENCIA} gl, como la guía) ya se puede probar.`,
        });
      } else if (motivo === 'identicas') {
        semaforos.push({
          nombre: 'Réplicas', estado: 'atencion',
          texto: `Las réplicas de cada corrida son idénticas: el error experimental es 0 y no hay error estándar que usar en la prueba t. Revisa si los datos están redondeados, copiados o en la columna equivocada.`,
        });
      } else if (!res.balanceado) {
        semaforos.push({
          nombre: 'Réplicas', estado: 'atencion',
          texto: `Hay ${replicasTxt(reps)}: ${entero(res.N)} respuestas dan ${entero(res.gl)} ${res.gl === 1 ? 'grado' : 'grados'} de libertad del error. El diseño no está balanceado, que es lo que pide la plantilla; los efectos y la prueba t siguen siendo válidos, pero no se calculan las sumas de cuadrados.`,
        });
      } else if (res.gl < GL_REFERENCIA) {
        semaforos.push({
          nombre: 'Réplicas', estado: 'atencion',
          texto: `${plural(res.N, 'respuesta')} dan ${entero(res.gl)} ${res.gl === 1 ? 'grado' : 'grados'} de libertad del error${res.prueba ? ` y un t crítico de ${corto(res.tcrit, 4)}` : ''}: solo se detectan efectos grandes. La referencia didáctica de la guía es de 2 réplicas por combinación (${GL_REFERENCIA} gl).`,
        });
      } else {
        semaforos.push({
          nombre: 'Réplicas', estado: 'cumple',
          texto: `${replicasTxt(reps).replace(/^./, (c) => c.toUpperCase())} (${entero(res.N)} respuestas) dan ${entero(res.gl)} grados de libertad del error${res.prueba ? ` y un t crítico de ${corto(res.tcrit, 4)}` : ''}. Alcanza la referencia didáctica de la guía: 2 réplicas por combinación (${GL_REFERENCIA} gl).`,
        });
      }
      if (mejor) {
        semaforos.push({
          nombre: 'Mejor combinación', estado: 'informativo',
          texto: `La corrida ${mejor.corrida} (${nivelesTexto(e, mejor.indice)}) tiene el promedio ${minimizar ? 'más bajo' : 'más alto'}: ${corto(mejor.media, 4)}. Es la mejor de las cuatro combinaciones probadas, no necesariamente el óptimo del proceso.${empates > 1 ? ` Hay un empate entre ${empates} corridas: decide con otro criterio (costo, facilidad, riesgo).` : ''}`,
        });
      } else {
        semaforos.push({ nombre: 'Mejor combinación', estado: 'informativo', texto: 'Las cuatro combinaciones tienen el mismo promedio: ninguna es mejor que otra con estos datos.' });
      }
      if (pred && Number.isFinite(pred.y)) {
        const fuera = [];
        if (fueraDe(e.predA, fa)) fuera.push(`A = ${corto(e.predA, 4)} (estudiado de ${corto(Math.min(fa.bajo, fa.alto), 4)} a ${corto(Math.max(fa.bajo, fa.alto), 4)})`);
        if (fueraDe(e.predB, fb)) fuera.push(`B = ${corto(e.predB, 4)} (estudiado de ${corto(Math.min(fb.bajo, fb.alto), 4)} a ${corto(Math.max(fb.bajo, fb.alto), 4)})`);
        semaforos.push(pred.extrapola
          ? {
            nombre: 'Predicción fuera de rango', estado: 'atencion',
            texto: `${lista(fuera)} queda${fuera.length > 1 ? 'n' : ''} fuera del rango estudiado: la predicción (${corto(pred.y, 4)}) es una extrapolación y el modelo de dos niveles no dice qué pasa más allá. Confírmala con una corrida antes de cambiar el proceso.`,
          }
          : {
            nombre: 'Predicción', estado: 'informativo',
            texto: `Con A = ${corto(e.predA, 4)} y B = ${corto(e.predB, 4)} el modelo predice ${corto(pred.y, 4)}: el promedio global (${corto(res.gm, 4)}) más lo que aportan cada factor y la interacción en esos niveles. Está dentro del rango estudiado y es un promedio esperado: una pieza suelta varía alrededor de él.`,
          });
      }

      const sig = [A, B, AB].map((x) => x.significativo === true);
      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((x, i) => ({
          ...x,
          activa: [
            res.prueba && sig.some(Boolean),
            res.prueba && sig.some((s) => !s),
            res.prueba && sig[2],
            res.gl < 1,
            res.gl >= 1 && res.gl < GL_REFERENCIA,
            false,
          ][i],
        })),
      };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Comprueba que el orden de las corridas fue aleatorio y que cada réplica incluye volver a ajustar el proceso.' };

      /* ---- gráficas ---- */
      const graficas = [];
      {
        const xa = (i) => (SIGNOS_2X2[i][0] < 0 ? 0 : 1);
        const mB0 = [m[0], m[1]]; // B en nivel bajo: A bajo, A alto
        const mB1 = [m[2], m[3]]; // B en nivel alto
        const linea = (nombre, ys, color) => ({
          type: 'scatter', mode: 'lines+markers+text', x: [0, 1], y: ys, name: nombre, text: ys.map((v, i) => (i === 0 ? `${corto(v, 3)}\u00A0\u00A0\u00A0` : `\u00A0\u00A0\u00A0${corto(v, 3)}`)), textposition: ['middle left', 'middle right'],
          line: { color, width: 3 }, marker: { size: 10, color }, textfont: { color, size: 12 }, hovertemplate: `${nombre}: %{y}<extra></extra>`,
        });
        // Las réplicas se dibujan del lado de adentro de cada punto (hacia el otro nivel de A) para no tapar las etiquetas de los promedios.
        const replicas = (indices, separacion, color) => ({
          type: 'scatter', mode: 'markers', showlegend: false, name: 'Réplicas',
          x: indices.flatMap((i) => res.corridas[i].y.map(() => xa(i) + (xa(i) === 0 ? separacion : -separacion))), y: indices.flatMap((i) => res.corridas[i].y),
          marker: { size: 7, symbol: 'x-thin-open', color, opacity: 0.9, line: { width: 1.8, color } }, hovertemplate: 'réplica: %{y}<extra></extra>',
        });
        // El anillo de la mejor combinación va debajo de las líneas para no tapar la etiqueta de su promedio; en la leyenda queda al final.
        const anillo = mejor
          ? [{
            type: 'scatter', mode: 'markers', x: [xa(mejor.indice)], y: [mejor.media], name: 'Mejor combinación', legendrank: 1100,
            marker: { symbol: 'circle-open', size: 22, color: COLOR.teal, line: { width: 3, color: COLOR.teal } }, hoverinfo: 'skip',
          }]
          : [];
        const datos = [
          replicas([0, 1], 0.035, COLOR.azul),
          replicas([2, 3], 0.07, COLOR.ambar),
          ...anillo,
          linea(etiquetaNivel('B', fb, 'bajo'), mB0, COLOR.azul),
          linea(etiquetaNivel('B', fb, 'alto'), mB1, COLOR.ambar),
        ];
        graficas.push({
          id: 'interaccion', titulo: 'Gráfica de interacción: promedios de cada combinación', ancha: true,
          datos,
          layout: {
            xaxis: { tickmode: 'array', tickvals: [0, 1], ticktext: [etiquetaNivel('A', fa, 'bajo'), etiquetaNivel('A', fa, 'alto')], range: [-0.4, 1.4], zeroline: false, title: { text: recorta(nombreA) } },
            yaxis: { title: { text: recorta(respuesta) }, automargin: true },
            legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.1, yanchor: 'bottom' },
          },
          respaldo: {
            columnas: ['Combinación', 'Niveles', 'Promedio'],
            filas: CORRIDAS_2X2.map((c, i) => [c, nivelesTexto(e, i), corto(m[i], 4)]),
          },
        });
      }
      {
        const orden = [[A, 'A (principal)'], [B, 'B (principal)'], [AB, 'AB (interacción)']]
          .map(([x, nombre]) => ({ x, nombre, valor: res.prueba ? Math.abs(x.t) : Math.abs(x.efecto) }))
          .sort((p, q) => q.valor - p.valor);
        const tope = Math.max(...orden.map((o) => o.valor), res.prueba ? res.tcrit : 0);
        const colores = orden.map((o) => (res.prueba ? (o.x.significativo ? COLOR.teal : COLOR.gris) : COLOR.azul));
        const nombreTcrit = res.prueba ? `t crítico ${corto(res.tcrit, 3)} (α = ${alfaTxt}, ${entero(res.gl)} gl)` : '';
        graficas.push({
          id: 'efectos', ancha: true,
          titulo: res.prueba ? 'Efectos estandarizados (|t|) frente al t crítico' : 'Tamaño de los efectos (valor absoluto; sin error estimado no hay prueba)',
          datos: [
            {
              type: 'bar', x: orden.map((o) => o.nombre), y: orden.map((o) => o.valor), showlegend: false, marker: { color: colores, line: { width: 0 } },
              text: orden.map((o) => corto(o.valor, 2)), textposition: 'outside', cliponaxis: false, hovertemplate: `%{x}: %{y:.4f}<extra></extra>`,
            },
            ...(res.prueba ? [{ type: 'scatter', mode: 'lines', x: [null], y: [null], name: nombreTcrit, line: { color: COLOR.coral, width: 2, dash: 'dash' }, hoverinfo: 'skip' }] : []),
          ],
          layout: {
            bargap: 0.5,
            yaxis: { title: { text: res.prueba ? '|t| = |efecto| ÷ error estándar' : '|efecto|' }, range: [0, tope * 1.25 || 1] },
            ...(res.prueba ? { shapes: [lineaH(res.tcrit, COLOR.coral, { ancho: 2 })], legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.1, yanchor: 'bottom' } } : {}),
          },
          respaldo: {
            columnas: ['Efecto', res.prueba ? '|t|' : '|Efecto|', res.prueba ? '¿Significativo?' : 'Prueba'],
            filas: orden.map((o) => [o.nombre, corto(o.valor, 4), res.prueba ? (o.x.significativo ? 'Sí' : 'No') : 'sin error estimado']),
          },
        });
      }

      /* ---- tablas ---- */
      const celda = (x, formula = false) => ({ texto: x, num: true, formula });
      const signo = (s) => (s < 0 ? '−' : '+');
      const tablas = [];
      tablas.push({
        titulo: 'Corridas y promedios',
        columnas: ['Corrida', 'A', 'B', 'AB', 'Respuestas', { t: 'n', num: true }, { t: 'Promedio', num: true }, { t: 's', num: true }],
        filas: res.corridas.map((c) => [
          c.corrida, signo(c.signos[0]), signo(c.signos[1]), signo(c.signos[0] * c.signos[1]), c.y.map((v) => corto(v, 4)).join(' · '),
          celda(entero(c.n)), celda(corto(c.media, 4), true), celda(c.n > 1 ? corto(c.s, 4) : '—', c.n > 1),
        ]),
        pie: `Signos: + es el nivel alto y − el nivel bajo; la columna AB es el producto de los signos de A y B. A = ${nombreA}, niveles ${parNiveles(fa)}; B = ${nombreB}, niveles ${parNiveles(fb)}. s = desviación estándar de las réplicas.`,
      });
      const ic = (x) => (res.prueba ? `(${corto(x.ic[0], 4)};\u00A0${corto(x.ic[1], 4)})` : '—');
      const formulaEfecto = (clave, x) => `Efecto ${clave} = [${combinar(SIGNOS_EFECTO[clave], CORRIDAS_2X2)}] ÷ 2 = [${combinar(SIGNOS_EFECTO[clave], m.map(textoMedia))}] ÷ 2 = ${corto(x.efecto, 4)}`;
      const filasEfecto = [[A, 'A'], [B, 'B'], [AB, 'AB']];
      tablas.push({
        titulo: res.prueba ? 'Efectos y prueba t' : 'Efectos (sin prueba: no hay error estimado)',
        columnas: res.prueba
          ? [
            'Efecto', { t: 'Estimación', num: true }, { t: 'Error est.', num: true }, { t: 't', num: true }, { t: 'Valor p', num: true },
            { t: `Intervalo ${corto((1 - e.alfa) * 100, 4)} %`, num: true }, '¿Signif.?',
          ]
          : ['Efecto', { t: 'Estimación', num: true }, { t: 'Coeficiente', num: true }],
        filas: filasEfecto.map(([x, nombre]) => (res.prueba
          ? [nombre, celda(corto(x.efecto, 4), true), celda(corto(x.se, 4), true), celda(num(x.t, 2), true), celda(valorP(x.p), true), celda(ic(x), true), x.significativo ? 'Sí' : 'No']
          : [nombre, celda(corto(x.efecto, 4), true), celda(corto(x.coef, 4), true)])),
        pie: `${[[A, 'A'], [B, 'B'], [AB, 'AB']].map(([x, clave]) => formulaEfecto(clave, x)).join(' · ')}.${res.prueba ? ` Coeficiente = efecto ÷ 2 (A: ${corto(A.coef, 4)}, B: ${corto(B.coef, 4)}, AB: ${corto(AB.coef, 4)}). El error estándar es el del efecto (½ √(CME × Σ 1/nᵢ), que con réplicas iguales es 2 √CME ÷ √N); el del coeficiente es la mitad.` : ' Coeficiente = efecto ÷ 2.'}`,
      });
      if (res.balanceado) {
        const filasSc = [[A, 'A (principal)'], [B, 'B (principal)'], [AB, 'AB (interacción)']].map(([x, nombre]) => [
          nombre, celda(corto(x.sc, 4), true), celda('1'), celda(corto(x.sc, 4), true), celda(pct(x.pct, 2), true),
        ]);
        if (res.gl >= 1) filasSc.push(['Error (réplicas)', celda(corto(res.sce, 4), true), celda(entero(res.gl)), celda(corto(res.cme, 4), true), celda(pct(res.pctError, 2), true)]);
        filasSc.push(['Total', celda(corto(res.sct, 4), true), celda(entero(res.N - 1)), celda('—'), celda('100 %', true)]);
        tablas.push({
          titulo: 'Descomposición de la variación',
          columnas: ['Fuente', { t: 'SC', num: true }, { t: 'gl', num: true }, { t: 'CM', num: true }, { t: '% de contribución', num: true }],
          filas: filasSc,
          resaltar: [filasSc.length - 1],
          pie: res.gl >= 1
            ? 'SC de un efecto = N × efecto² ÷ 4 · SC del error = Σ (nᵢ − 1) sᵢ² · CM = SC ÷ gl · % de contribución = SC ÷ SC total.'
            : 'Sin réplicas no hay SC del error: el % reparte la variación entre los tres efectos para ordenarlos; no prueba que sean reales.',
        });
      }

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
