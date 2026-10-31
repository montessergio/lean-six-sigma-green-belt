/**
 * LAB 19 · Correlación, regresión, chi-cuadrada e intervalo de confianza
 *
 * Guía: M7 §1 (intervalos de confianza, «una idea complementaria»), §3 (correlación), §4 (regresión lineal simple) y §5
 * (chi-cuadrada para datos de atributo) · plantillas Excel «Correlacion y Regresion» y «Chi-cuadrada».
 *   Tres herramientas de la fase Analizar en un solo laboratorio, con un selector:
 *   · Regresión. El coeficiente de correlación r (−1 a 1) mide la fuerza y la dirección de una relación LINEAL entre dos
 *     variables continuas. La regresión por mínimos cuadrados traza la recta que hace mínima la suma de cuadrados de los
 *     errores de predicción y permite estimar Y a partir de X; R² = r² es la proporción de la variación de Y que explica la
 *     recta. Correlación no es causalidad, r solo detecta relaciones lineales y fuera del rango observado (extrapolación) la
 *     recta no es confiable.
 *   · Chi-cuadrada de independencia. Es el equivalente del ANOVA para datos de atributo (pasa / no pasa): compara lo observado
 *     con lo que se esperaría si las variables fueran independientes. Con pocos eventos tiene poco poder estadístico.
 *   · Intervalo de confianza de una media: x̄ ± crítico × s / √n, con z (el ejemplo de la guía) y con t de Student (lo más
 *     correcto con n < 30).
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Reglas de la plantilla que se conservan: fuerza |r| ≥ 0.8 fuerte, ≥ 0.5 moderada, si no débil; aviso de extrapolación;
 * «correlación no implica causalidad»; tabla de hasta 5 × 5 en la chi-cuadrada; las filas y columnas sin conteos se ignoran;
 * aviso de esperados menores que 5; V de Cramér; corrección de Yates en 2 × 2. Añadidos: el nivel de confianza sigue a α,
 * intervalos de la recta y de predicción, gráficas de residuos, la prueba exacta de Fisher en 2 × 2, los residuos
 * estandarizados y las tasas con intervalo de Wilson.
 *
 * Presets: la plantilla (12 pares; la guía publica su recta a partir de diez pares que solo aparecen en una figura), una
 * relación curva inventada (r = 0), la chi-cuadrada de la guía (2, 2 y 6 fallas en 5,340 arneses por turno), la de la
 * plantilla, dos derivados (torque contra el resto, tomado del LAB 14, y turnos 1 y 3 de la guía en 2 × 2) y el torque del
 * Módulo 5 y el ejemplo del examen para el intervalo de confianza.
 */
import { MIN_ESPERADO_CHI, chiCuadrada, intervaloMedia, intervaloWilson, prediccion, regresionLineal, xParaY } from '../js/lib/analizar.js';
import { bandaV, envolver, etiquetaH, etiquetaV, hexARgba, lineaH, lineaV, malla } from '../js/lib/graficas.js';
import { lgamma, normalCdf, normalPpf, tPpf } from '../js/lib/stats.js';
import { COLOR } from '../js/core/config.js';
import { cientifica, cifras, conSigno, corto, entero, num, pct, plural, valorP } from '../js/core/format.js';

const MAX_FILAS = 5; // la plantilla acepta una tabla de hasta 5 × 5
const MAX_COLUMNAS = 5;
const ALFA_DEFECTO = 0.05;
const MIN_PARES = 10; // referencia didáctica: la guía usa 10 pares y la plantilla 12
const COLUMNAS = Array.from({ length: MAX_COLUMNAS }, (_, j) => `c${j + 1}`);
const PALETA = [COLOR.azul, COLOR.coral, COLOR.teal, COLOR.violeta, COLOR.ambar];
/** Percentiles que se rotulan en la gráfica de probabilidad normal, con su cuantil z. */
const PERCENTILES = [1, 5, 25, 50, 75, 95, 99].map((p) => ({ p, z: normalPpf(p / 100) }));
/** Tamaño del efecto de la V de Cramér (Cohen): w de 0.1, 0.3 y 0.5, entre √(menor dimensión − 1). */
const COHEN_W = [0.1, 0.3, 0.5];

/* Respaldo si no llega el caso (los mismos datos del caso de los arneses). */
const EXCEL_X = [160, 162.3, 164.5, 166.8, 169.1, 171.4, 173.6, 175.9, 178.2, 180.5, 182.7, 185];
const EXCEL_Y = [2.21, 2.01, 1.94, 1.53, 1.48, 1.13, 1.17, 0.9, 0.78, 0.45, 0.32, 0.07];
const CURVA_X = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];

const esRegresion = (e) => e.herramienta !== 'chi' && e.herramienta !== 'ic';
const esChi = (e) => e.herramienta === 'chi';
const esIc = (e) => e.herramienta === 'ic';

const limpio = (t) => String(t ?? '').replace(/[<>]/g, '');
const recorta = (texto, n = 34) => (texto.length > n ? `${texto.slice(0, n - 1)}…` : texto);
const textoP = (p) => (p < 0.0001 ? 'p < 0.0001' : `p = ${num(p, 4)}`);
const conU = (texto, unidad) => (unidad ? `${texto} ${unidad}` : texto);
/** Decimales para mostrar una variable según su dispersión (desviación estándar). */
const decimalesDe = (sd) => (!(sd > 0) ? 2 : sd >= 10 ? 1 : sd >= 1 ? 2 : sd >= 0.1 ? 3 : sd >= 0.01 ? 4 : 5);
/** Coeficientes de la recta: tres decimales si valen 1 o más, tres cifras significativas si no (0.0840). */
const coef = (x) => (Math.abs(x) >= 1 ? num(x, 3) : cifras(x, 3));
const rangoDe = (valores) => [Math.min(...valores), Math.max(...valores)];
/** A lo más `max` elementos repartidos a lo largo de la lista (para las tablas de respaldo). */
const muestra = (lista, max = 60) => (lista.length <= max ? lista : lista.filter((_, i) => i % Math.ceil(lista.length / max) === 0));
const listaCitada = (items, max = 3) => {
  const citados = items.slice(0, max);
  if (items.length > max) citados.push(`${items.length - max} más`);
  return citados.length > 1 ? `${citados.slice(0, -1).join(', ')} y ${citados[citados.length - 1]}` : citados[0] ?? '';
};
const alfaDe = (e, aviso) => {
  if (!Number.isFinite(e.alfa)) return ALFA_DEFECTO;
  if (e.alfa > 0 && e.alfa < 1) return e.alfa;
  aviso.push(`El nivel de significancia α debe estar entre 0 y 1 (capturaste ${corto(e.alfa, 4)}): se usó α = ${ALFA_DEFECTO}.`);
  return ALFA_DEFECTO;
};
const calc = (texto) => ({ texto, num: true, formula: true });
const celdaNum = (texto) => ({ texto, num: true });
const guion = { texto: '—', num: true };

/** Número de columnas de la tabla de la chi-cuadrada (2 a 5). */
const cuantasDe = (e) => {
  const k = Number(e?.numCols);
  return Number.isInteger(k) && k >= 2 && k <= MAX_COLUMNAS ? k : 3;
};
/** Nombres de las columnas: la lista separada por comas que escribió el usuario y, si falta alguno, «Columna j». */
const nombresDe = (e, k) => {
  const dados = String(e?.nombresCols ?? '').split(',').map((t) => limpio(t).trim());
  return Array.from({ length: k }, (_, j) => dados[j] || `Columna ${j + 1}`);
};

/** Columnas de la tabla de la chi-cuadrada: la categoría (fila) y un conteo por columna; los rótulos siguen a los nombres. */
const columnasTabla = (estado) => [
  { id: 'categoria', etiqueta: 'Categoría (fila)', tipo: 'texto', ancho: '168px' },
  ...COLUMNAS.slice(0, cuantasDe(estado)).map((id, j) => ({
    id, etiqueta: (est) => nombresDe(est, cuantasDe(est))[j], tipo: 'numero', min: 0, ancho: '84px', ayuda: `Conteo de esta fila en la columna ${j + 1}; escribe 0 si no hubo`,
  })),
];
const filaNueva = { categoria: '', ...Object.fromEntries(COLUMNAS.map((id) => [id, NaN])) };
const aFila = (categoria, conteos) => ({ categoria, ...Object.fromEntries(COLUMNAS.map((id, j) => [id, conteos?.[j] ?? NaN])) });

/** Clase del tamaño del efecto de la V de Cramér según la menor dimensión de la tabla (referencia didáctica de Cohen). */
const umbralesV = (dfMin) => COHEN_W.map((w) => w / Math.sqrt(dfMin));
const claseV = (v, dfMin) => {
  const [pequeno, mediano, grande] = umbralesV(dfMin);
  return v < pequeno ? 'muy pequeño' : v < mediano ? 'pequeño' : v < grande ? 'mediano' : 'grande';
};

/* ------------------------------------------------------------------ */
/* Umbrales de interpretación, supuestos y preguntas de cada herramienta */
/* ------------------------------------------------------------------ */

const umbralRegresion = (est = {}) => ({
  titulo: 'Cómo leer la correlación y la regresión',
  filas: [
    { rango: '|r| ≥ 0.8', texto: 'relación lineal fuerte (regla de la plantilla): X y Y se mueven juntas casi en línea recta. El signo da la dirección: negativo, cuando una sube la otra baja', activa: est.fuerza === 'Fuerte' },
    { rango: '0.5 ≤ |r| < 0.8', texto: 'relación lineal moderada: hay tendencia, pero con bastante dispersión alrededor de la recta', activa: est.fuerza === 'Moderada' },
    { rango: '|r| < 0.5', texto: 'relación lineal débil. No descarta una relación curva: una curva fuerte puede dar r cercano a 0, por eso se mira siempre el diagrama de dispersión', activa: est.fuerza === 'Débil' },
    { rango: 'p de la pendiente < α', texto: 'la pendiente no es cero: hay evidencia de relación lineal. Con muchos pares hasta una pendiente minúscula sale significativa: mira también b en unidades del proceso y R²', activa: est.significativo === true },
    { rango: 'R² = r²', texto: 'proporción de la variación de Y que explica la recta (guía M7 §4: 98.5 % en el ejemplo de fuerza y resistencia). El resto es dispersión que X no explica' },
    { rango: 'X fuera del rango observado', texto: 'extrapolación: la recta no está respaldada por datos y puede dar valores sin sentido (guía M7, ejercicio 2). No la uses ahí sin nuevas mediciones', activa: est.extrapolacion === true },
  ],
});

const SUPUESTO_REGRESION = {
  titulo: 'Supuestos de la regresión lineal simple',
  texto:
    'Cuatro supuestos que el software no valida por sí solo (guía M7): (1) la relación es lineal, (2) las observaciones son independientes, (3) los residuos —cada Y menos el valor que predice la recta— son aproximadamente normales y ' +
    '(4) su dispersión es parecida a lo largo de X. Las gráficas de residuos de abajo los revisan de un vistazo: una curva, un embudo o un punto muy alejado donde debería haber una nube sin forma son la alerta. ' +
    'Y la advertencia de la guía: correlación no es causalidad, y r solo detecta relaciones lineales.',
};

const PREGUNTAS_REGRESION = [
  'Con los 12 pares de la plantilla, r = −0.994 y R² = 0.988. ¿Qué dice cada uno? Si la fuerza de engarzado subiera 10 N, ¿cuánto esperas que cambie la resistencia, y con qué margen según el intervalo de la pendiente?',
  'Predice la resistencia con 170 N y luego con 190 N. ¿Por qué la segunda predicción no es confiable aunque salga de la misma recta? Fíjate en las bandas de la gráfica fuera del rango observado y en el signo del resultado.',
  'El límite de la guía es 1.2 mΩ: ¿qué fuerza mínima pide la recta? El Turno 3 trabaja con unos 165 N (LAB 18): ¿qué resistencia espera la recta para ese turno y qué harías con esa información? ¿Qué te falta para afirmar que la fuerza CAUSA la resistencia?',
  'Carga la relación curva inventada (y = x²): r sale 0 y aun así Y depende por completo de X. ¿Qué te muestran el diagrama de dispersión y los residuos que r no te dice? ¿Qué harías antes de usar una recta en un caso real?',
  'Agrega un par atípico a los datos de la plantilla (por ejemplo, X = 170 y Y = 3): ¿cómo se mueven la pendiente, r y R²? ¿Qué verificarías antes de borrar ese dato?',
];

const umbralChi = (est = {}) => ({
  titulo: 'Cómo leer la chi-cuadrada',
  filas: [
    { rango: 'p < α', texto: 'se rechaza H₀: las variables no son independientes, hay asociación (por ejemplo, la proporción de fallas no es igual entre turnos). No dice cuál celda ni de cuánto: mira las contribuciones y los residuos estandarizados', activa: est.significativo === true },
    { rango: 'p ≥ α', texto: 'no hay evidencia de asociación. No prueba que las proporciones sean iguales; con pocos eventos la prueba casi no tiene poder (guía M7 §5)', activa: est.significativo === false },
    { rango: 'Esperado < 5', texto: 'la aproximación chi-cuadrada pierde validez (plantilla «Chi-cuadrada»): agrupa categorías o reúne más datos; en una tabla 2 × 2 usa la prueba exacta de Fisher', activa: est.bajas === true },
    { rango: 'V de Cramér', texto: 'tamaño del efecto de 0 a 1, que no depende del número de datos. Referencia didáctica (Cohen): 0.1, 0.3 y 0.5 son efecto pequeño, mediano y grande en tablas con una dimensión de 2; en tablas mayores esos umbrales se dividen entre √(menor dimensión − 1)' },
    { rango: 'Yates y Fisher', texto: 'solo en tablas 2 × 2: Yates resta 0.5 a cada |O − E| y es conservadora; Fisher calcula el valor p exacto y no necesita esperados grandes' },
  ],
});

const SUPUESTO_CHI = {
  titulo: 'Supuestos de la chi-cuadrada de independencia',
  texto:
    'Observaciones independientes (cada unidad se cuenta una sola vez y en una sola celda), categorías que no se traslapan, conteos reales —no porcentajes ni tasas— y frecuencias esperadas de al menos 5 en casi todas las celdas. ' +
    'Es para datos de atributo (pasa / no pasa, defecto / sin defecto): con datos continuos, como la fuerza de engarzado, se usa el ANOVA (LAB 18). ' +
    'No es la prueba de proporción de una muestra, que compara una proporción contra un estándar fijo y no necesita un segundo grupo.',
};

const PREGUNTAS_CHI = [
  'Con los datos de la guía (2, 2 y 6 fallas en 5,340 arneses por turno) la chi-cuadrada no encuentra diferencia entre turnos. ¿Quiere decir que los tres turnos fallan igual? Mira los intervalos de las tasas y el aviso sobre los esperados menores que 5.',
  'Multiplica por 4 todos los conteos de la guía (las proporciones no cambian): ¿qué pasa con χ² y con el valor p? ¿Qué te enseña eso sobre el poder de la prueba cuando hay pocos eventos?',
  'Compara este resultado con el ANOVA del LAB 18 sobre los mismos turnos (p < 0.001). ¿Por qué no se contradicen? ¿Por qué conviene medir un dato continuo cuando se puede?',
  'En el ejemplo de la plantilla (285 · 15, 280 · 20 y 262 · 38), ¿qué celda aporta más a χ²? ¿Qué te dice V de Cramér que no te dice el valor p?',
  'En «torque contra el resto», agrupar las cinco categorías pequeñas resolvió el problema de los esperados menores que 5. ¿Qué pregunta responde ahora la prueba y cuál NO responde (¿qué turno produce más defectos?) si no conoces cuántos arneses hizo cada turno?',
];

const umbralIc = (est = {}) => ({
  titulo: 'Cómo leer el intervalo de confianza',
  filas: [
    { rango: 'z (n ≥ 30)', texto: 'con σ conocida o con muchos datos: 1.96 para 95 % de confianza (guía M7 §1, el mismo principio de la regla empírica del Módulo 0)', activa: est.grande === true },
    { rango: 't de Student (n < 30)', texto: 'lo más correcto con pocos datos, porque s es solo una estimación de σ: un poco más ancho para compensar esa incertidumbre extra. Con n = 30 la diferencia con z ya es de solo 4 %', activa: est.grande === false },
    { rango: 'Margen = crítico × s / √n', texto: 'para reducir el margen a la mitad hacen falta unas cuatro veces más datos; más confianza (99 % en lugar de 95 %) también ensancha el intervalo' },
    { rango: 'Interpretación', texto: 'si se repitiera el muestreo muchas veces, el 95 % de los intervalos construidos así contendría la media verdadera. No es el rango donde cae el 95 % de las piezas' },
  ],
});

const SUPUESTO_IC = {
  titulo: 'Supuestos del intervalo de confianza de una media',
  texto:
    'Observaciones independientes de un proceso estable y datos aproximadamente normales, o una muestra grande (con n grande la media muestral es casi normal aunque los datos no lo sean). ' +
    'Con n pequeño y datos muy sesgados el intervalo puede ser engañoso. El intervalo habla de la MEDIA del proceso, no de las piezas individuales: para ellas están los límites naturales del proceso o los límites de tolerancia.',
};

const PREGUNTAS_IC = [
  'Con los diez torques del Módulo 5 (x̄ = 1.355, s = 0.034), ¿qué significa «95 % de confianza»? ¿Es correcto decir que hay 95 % de probabilidad de que la media verdadera esté dentro de este intervalo en particular?',
  'Compara el intervalo con z y el de t para n = 10. ¿Por qué el de t es más ancho? ¿A partir de qué tamaño de muestra casi coinciden y por qué la guía recomienda t cuando n < 30?',
  'Mira la gráfica del margen contra n: si duplicas n, ¿cuánto se angosta el intervalo? ¿Cuántas veces más datos necesitas para reducir el margen a la mitad? (Relaciónalo con el LAB 11.)',
  'Sube la confianza de 95 % a 99 % (α = 0.01): ¿qué le pasa al ancho del intervalo? ¿Qué ganas y qué pierdes?',
  '¿El intervalo de la media dice entre qué valores caen las piezas individuales? ¿En qué se distingue de los límites de especificación y de los límites naturales del proceso?',
];

/* ------------------------------------------------------------------ */
/* Herramienta 3 · intervalo de confianza de una media                  */
/* ------------------------------------------------------------------ */

const N_GRANDE = 30; // guía M7 §1: con n < 30 lo más correcto es la t de Student
const N_POCOS = 5; // referencia didáctica: con menos de 5 datos el intervalo con t es enorme
/** Decimales de un intervalo según su error estándar: los límites se leen con la precisión del margen. */
const decimalesIc = (ee) => (!(ee > 0) || ee >= 0.5 ? 2 : ee >= 0.05 ? 3 : ee >= 0.005 ? 4 : 5);
const enteros = (desde, hasta, paso = 1) => {
  const lista = [];
  for (let v = desde; v <= hasta; v += paso) lista.push(v);
  return lista;
};

function calcularIc(e) {
  const aviso = [];
  const alfa = alfaDe(e, aviso);
  const base = { aviso, umbral: umbralIc(), supuesto: SUPUESTO_IC, preguntas: PREGUNTAS_IC };
  const { icN: n, icMedia: media, icS: s } = e;
  const sinDatos = (texto) => ({ ...base, vacio: texto, semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto }] });
  if (![n, media, s].every(Number.isFinite)) return sinDatos('Captura el tamaño de la muestra n, la media x̄ y la desviación estándar s para ver el intervalo de confianza.');
  if (!Number.isInteger(n) || n < 2) return sinDatos('El tamaño de la muestra n debe ser un entero de al menos 2: la desviación estándar necesita al menos 2 datos.');
  if (s < 0) return sinDatos('La desviación estándar s no puede ser negativa.');

  const confianza = 1 - alfa;
  const r = intervaloMedia({ n, media, s, confianza });
  const nivelTxt = corto(confianza * 100, 2);
  const u = limpio(e.icUnidad).trim();
  const uTxt = u ? ` ${u}` : '';
  const dec = decimalesIc(r.ee);
  const grande = n >= N_GRANDE;
  const angosto = r.semiT > 0 ? 1 - r.semiZ / r.semiT : 0; // cuánto más angosto sale el intervalo con z
  const limites = (ic) => `${num(ic[0], dec)} a ${num(ic[1], dec)}`;

  /* ---- salidas ---- */
  const salidas = [
    { id: 'icT', etiqueta: `IC de ${nivelTxt} % de la media · t de Student`, valor: limites(r.icT), color: 'azul', ancha: true, nota: `x̄ ± t · s/√n = ${corto(media, dec)} ± ${num(r.semiT, dec)}${uTxt} · t = ${num(r.t, 3)} con ${r.gl} gl` },
    { id: 'icZ', etiqueta: `IC de ${nivelTxt} % de la media · z (como la guía)`, valor: limites(r.icZ), color: 'teal', ancha: true, nota: `x̄ ± z · s/√n = ${corto(media, dec)} ± ${num(r.semiZ, dec)}${uTxt} · z = ${num(r.z, 3)}` },
    { id: 'ee', etiqueta: 'Error estándar s / √n', valor: num(r.ee, dec + 1), nota: `${corto(s, dec + 1)} ÷ √${entero(n)}` },
    { id: 'margen', etiqueta: 'Margen de error con t', valor: `± ${num(r.semiT, dec)}`, color: 'violeta', nota: s > 0 ? `${pct(r.semiT / Math.abs(media || NaN), 1)} de la media` : 'sin variación' },
  ];

  /* ---- semáforos ---- */
  const semaforos = [];
  if (s === 0) {
    semaforos.push({ nombre: 'Sin variación', estado: 'atencion', texto: 's = 0: todos los datos serían iguales y el intervalo se reduce a un punto. Revisa si los datos están redondeados, copiados o en la columna equivocada.' });
  } else if (!grande) {
    semaforos.push({
      nombre: 'z o t', estado: 'atencion',
      texto: `Con n = ${entero(n)} (menos de ${N_GRANDE}) lo más correcto es el intervalo con t (guía M7 §1): s es solo una estimación de σ y t paga esa incertidumbre. El intervalo con z queda ${pct(angosto, 0)} más angosto: promete más precisión de la que hay.`,
    });
  } else {
    semaforos.push({
      nombre: 'z o t', estado: 'cumple',
      texto: `Con n = ${entero(n)} (${N_GRANDE} o más) z y t casi coinciden (${num(r.z, 3)} contra ${num(r.t, 3)}): el margen con t es solo ${pct(r.semiT / r.semiZ - 1, 1)} mayor.`,
    });
  }
  if (n < N_POCOS) {
    semaforos.push({
      nombre: 'Tamaño de la muestra', estado: 'atencion',
      texto: `Con ${plural(n, 'dato')} el valor crítico de t es ${num(r.t, 2)} y el intervalo sale enorme: la estimación casi no dice nada. Es una mecánica para entender, no una base para decidir (referencia didáctica).`,
    });
  }
  semaforos.push({
    nombre: 'Qué significa', estado: 'informativo',
    texto: `${nivelTxt} % de confianza: si se repitiera el muestreo muchas veces, ${nivelTxt} % de los intervalos construidos así contendría la media verdadera del proceso (guía M7 §1). No es el rango donde cae el ${nivelTxt} % de las piezas.`,
  });

  /* ---- gráficas ---- */
  const metodos = [
    { id: 't', nombre: `Con t (${r.gl} gl)`, semi: r.semiT, ic: r.icT, color: COLOR.azul },
    { id: 'z', nombre: 'Con z (guía)', semi: r.semiZ, ic: r.icZ, color: COLOR.teal },
  ];
  const mayor = Math.max(r.semiT, r.semiZ) || Math.abs(media) * 0.01 || 1;
  const tituloX = u ? `Media (${u})` : 'Media';
  const trazasIc = metodos.map((m) => ({
    type: 'scatter', mode: 'markers', name: m.nombre, showlegend: false, x: [media], y: [m.nombre],
    marker: { color: m.color, size: 11, line: { color: '#0a1011', width: 1 } },
    error_x: { type: 'data', array: [m.semi], visible: true, color: m.color, thickness: 2.6, width: 9 },
    text: [`<b>${m.nombre}</b><br>x̄ = ${num(media, dec)}${uTxt}<br>margen ± ${num(m.semi, dec)}<br>IC de ${nivelTxt} %: ${limites(m.ic)}`], hovertemplate: '%{text}<extra></extra>',
  }));

  const cola = 1 - alfa / 2;
  const nTop = Math.max(60, Math.min(400, n * 5));
  const ns = [...enteros(2, Math.min(30, nTop)), ...enteros(32, nTop, 2)];
  const margenT = (k) => (tPpf(cola, k - 1) * s) / Math.sqrt(k);
  const margenZ = (k) => (r.z * s) / Math.sqrt(k);
  const cuatro = 4 * n;
  const margen4 = margenT(cuatro);
  const filasN = [...new Set([2, 3, 5, 10, 20, 30, 50, 100, n, cuatro])].sort((a, b) => a - b);

  const graficas = [
    {
      id: 'intervalos', titulo: `Intervalo de ${nivelTxt} % para la media: t y z`, ancha: true,
      datos: trazasIc,
      layout: {
        shapes: [lineaV(media, COLOR.blanco, { dash: 'dot', ancho: 1.2 })],
        xaxis: { title: { text: tituloX }, range: [media - mayor * 1.25, media + mayor * 1.25], zeroline: false },
        yaxis: { type: 'category', categoryorder: 'array', categoryarray: metodos.map((m) => m.nombre), autorange: 'reversed', automargin: true, tickfont: { size: 12, color: COLOR.gris } },
        margin: { l: 56, r: 24, t: 18, b: 52 },
      },
      respaldo: {
        columnas: ['Método', 'Límite inferior', 'Límite superior', 'Margen (±)'],
        filas: metodos.map((m) => [m.nombre, num(m.ic[0], dec), num(m.ic[1], dec), num(m.semi, dec)]),
      },
    },
  ];
  if (s > 0) {
    graficas.push({
      id: 'margen', titulo: 'El margen de error se angosta con la raíz de n', ancha: true,
      datos: [
        { type: 'scatter', mode: 'lines', name: 'Con t', x: ns, y: ns.map(margenT), line: { color: COLOR.azul, width: 2.4 }, hovertemplate: 'n = %{x}<br>margen con t: ± %{y:.4g}<extra></extra>' },
        { type: 'scatter', mode: 'lines', name: 'Con z', x: ns, y: ns.map(margenZ), line: { color: COLOR.teal, width: 1.8, dash: 'dot' }, hovertemplate: 'n = %{x}<br>margen con z: ± %{y:.4g}<extra></extra>' },
        {
          type: 'scatter', mode: 'markers', name: 'Tu muestra', x: [n], y: [r.semiT], marker: { symbol: 'diamond', size: 12, color: COLOR.ambar, line: { color: '#0a1011', width: 1 } },
          text: [`<b>n = ${entero(n)}</b><br>margen con t: ± ${num(r.semiT, dec)}`], hovertemplate: '%{text}<extra></extra>',
        },
        ...(cuatro <= nTop ? [{
          type: 'scatter', mode: 'markers', name: '4 veces más datos', x: [cuatro], y: [margen4], marker: { symbol: 'diamond-open', size: 12, color: COLOR.coral, line: { width: 2 } },
          text: [`<b>n = ${entero(cuatro)}</b><br>margen con t: ± ${num(margen4, dec)}<br>${pct(margen4 / r.semiT, 0)} del margen actual`], hovertemplate: '%{text}<extra></extra>',
        }] : []),
      ],
      layout: {
        xaxis: { title: { text: 'Tamaño de la muestra n' }, zeroline: false, rangemode: 'tozero' },
        yaxis: { title: { text: `Margen de error (±${u ? ` ${u}` : ''})` }, rangemode: 'tozero', zeroline: false },
        margin: { l: 66, r: 18, t: 18, b: 52 },
      },
      respaldo: {
        columnas: ['n', 'Margen con t (±)', 'Margen con z (±)'],
        filas: filasN.map((k) => [entero(k), num(margenT(k), dec), num(margenZ(k), dec)]),
      },
    });
  }

  /* ---- tabla paso a paso ---- */
  const calcTxt = (texto) => ({ texto, num: true, formula: true });
  const tablas = [{
    titulo: 'Cálculo paso a paso',
    columnas: ['Paso', { t: 'Con z (guía)', num: true }, { t: 'Con t de Student', num: true }],
    filas: [
      ['Grados de libertad (n − 1)', guion, calcTxt(entero(r.gl))],
      [`Valor crítico (área central de ${nivelTxt} %)`, calcTxt(num(r.z, 4)), calcTxt(num(r.t, 4))],
      ['Error estándar s / √n', calcTxt(num(r.ee, dec + 1)), calcTxt(num(r.ee, dec + 1))],
      ['Margen = crítico × s / √n', calcTxt(num(r.semiZ, dec)), calcTxt(num(r.semiT, dec))],
      ['Límite inferior', calcTxt(num(r.icZ[0], dec)), calcTxt(num(r.icT[0], dec))],
      ['Límite superior', calcTxt(num(r.icZ[1], dec)), calcTxt(num(r.icT[1], dec))],
      ['Ancho del intervalo', calcTxt(num(2 * r.semiZ, dec)), calcTxt(num(2 * r.semiT, dec))],
    ],
    pie: `n = ${entero(n)}, x̄ = ${corto(media, dec)}${uTxt}, s = ${corto(s, dec + 1)}${uTxt}. Valor crítico: z de la normal estándar y t de Student con n − 1 gl, para el área central de ${nivelTxt} % (α = ${corto(alfa, 4)} repartido en dos colas).`,
  }];

  const umbral = umbralIc({ grande });
  return { ...base, salidasColumnas: 2, salidas, semaforos, umbral, graficas, tablas };
}

/* ------------------------------------------------------------------ */
/* Herramienta 2 · chi-cuadrada de independencia                        */
/* ------------------------------------------------------------------ */

const N_EVENTOS_POCOS = 30; // referencia didáctica: con menos de 30 eventos la prueba casi no tiene poder
const RESIDUO_NOTABLE = 2; // referencia didáctica: un residuo estandarizado de más de 2 en valor absoluto llama la atención
const cuenta = (v) => (Number.isInteger(v) ? entero(v) : corto(v, 2));
/** Los nombres repetidos se distinguen con un número entre paréntesis. */
const unicos = (nombres) => {
  const visto = new Map();
  return nombres.map((n) => {
    const veces = (visto.get(n) ?? 0) + 1;
    visto.set(n, veces);
    return veces > 1 ? `${n} (${veces})` : n;
  });
};
/** Densidad de la chi-cuadrada con k grados de libertad. */
const densidadChi = (x, k) => (x > 0 ? Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - lgamma(k / 2)) : k === 2 ? 0.5 : 0);
/** Una proporción como porcentaje con dos cifras significativas si es pequeña (0.037 %). */
const porcentaje = (p) => `${p >= 0.001 ? num(100 * p, p >= 0.1 ? 1 : 2) : cifras(100 * p, 2)} %`;

function calcularChi(e) {
  const aviso = [];
  const alfa = alfaDe(e, aviso);
  const k = cuantasDe(e);
  const nombres = unicos(nombresDe(e, k));
  const filasEntrada = (Array.isArray(e.observadas) ? e.observadas : []).slice(0, MAX_FILAS);
  const crudos = filasEntrada.map((f) => COLUMNAS.slice(0, k).map((id) => f?.[id]));
  const base = { aviso, umbral: umbralChi(), supuesto: SUPUESTO_CHI, preguntas: PREGUNTAS_CHI };
  const sinDatos = (texto) => ({ ...base, vacio: texto, semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto }] });

  const valores = crudos.flat().filter(Number.isFinite);
  if (valores.some((v) => v < 0)) aviso.push('Hay conteos negativos: se tomaron como 0.');
  if (valores.some((v) => v > 0 && !Number.isInteger(v))) aviso.push('Hay conteos con decimales: la chi-cuadrada necesita conteos reales (enteros), no porcentajes ni tasas.');

  const c = chiCuadrada(crudos, { alfa });
  const filasSin = filasEntrada.map((f, i) => ({ f, i })).filter(({ f, i }) => !c.filas?.includes(i) && String(f?.categoria ?? '').trim());
  if (filasSin.length) aviso.push(`${plural(filasSin.length, 'fila tiene', 'filas tienen')} nombre pero ningún conteo (${listaCitada(filasSin.map(({ f }) => `«${limpio(f.categoria).trim()}»`))}): no ${filasSin.length > 1 ? 'cuentan' : 'cuenta'}.`);
  if (!c.valido) {
    return sinDatos('Captura una tabla de al menos 2 filas × 2 columnas con conteos mayores que cero (las filas y columnas sin conteos se ignoran, como en la plantilla) para ver χ², el valor p y las gráficas.');
  }
  const colsSin = nombres.map((n, j) => ({ n, j })).filter(({ j }) => !c.columnas.includes(j));
  if (colsSin.length) aviso.push(`${plural(colsSin.length, 'columna no tiene', 'columnas no tienen')} conteos (${listaCitada(colsSin.map(({ n }) => `«${n}»`))}): ${colsSin.length > 1 ? 'se ignoran' : 'se ignora'}.`);

  const { nFilas: nF, nColumnas: nC, gl, observadas: obs, esperadas: esp } = c;
  const etiquetasFilas = unicos(c.filas.map((i) => limpio(filasEntrada[i]?.categoria).trim() || `Fila ${i + 1}`));
  const etiquetasCols = c.columnas.map((j) => nombres[j]);
  const sig = c.significativo;
  const alfaTxt = corto(alfa, 4);
  const nivelTxt = corto((1 - alfa) * 100, 2);
  const dfMin = Math.min(nF - 1, nC - 1);
  const clase = claseV(c.cramerV, dfMin);
  const umbralesTxt = umbralesV(dfMin).map((v) => num(v, 2));
  const es2x2 = nF === 2 && nC === 2;
  const dosFilas = nF === 2;
  const iEvento = dosFilas ? (c.totalesFila[1] < c.totalesFila[0] ? 1 : 0) : -1; // el evento es la fila con menos conteos
  const evento = iEvento >= 0 ? etiquetasFilas[iEvento] : '';
  const eventos = iEvento >= 0 ? c.totalesFila[iEvento] : NaN;
  const wilson = dosFilas ? etiquetasCols.map((_, j) => intervaloWilson(obs[iEvento][j], c.totalesColumna[j], 1 - alfa)) : [];
  const hayWilson = dosFilas && wilson.every((w) => w.valido);
  const decide = (p) => (p < alfa ? 'Rechaza H₀' : 'No rechaza H₀');

  /* ---- salidas ---- */
  const salidas = [
    { id: 'chi2', etiqueta: 'χ² calculado', valor: num(c.chi2, 2), color: 'azul', nota: `gl = ${gl} · crítico ${num(c.critico, 3)} (α = ${alfaTxt})` },
    { id: 'p', etiqueta: 'Valor p', valor: valorP(c.p), color: sig ? 'ambar' : 'teal', nota: `${c.p < 0.0001 ? `${cientifica(c.p, 3)} · ` : ''}${sig ? 'p < α' : 'p ≥ α'} (α = ${alfaTxt})` },
    { id: 'V', etiqueta: 'V de Cramér', valor: num(c.cramerV, 3), color: 'violeta', nota: `efecto ${clase}` },
    { id: 'minE', etiqueta: 'Esperado mínimo', valor: num(c.minEsperado, 2), color: c.bajas ? 'ambar' : 'verde', nota: c.bajas ? `${c.bajas} de ${c.celdas} celdas con esperado < ${MIN_ESPERADO_CHI}` : `todas las celdas ≥ ${MIN_ESPERADO_CHI}` },
    { id: 'N', etiqueta: 'Total N · tabla', valor: `${entero(c.N)} · ${nF} × ${nC}`, nota: `gl = (${nF} − 1)(${nC} − 1) = ${gl}` },
  ];
  if (es2x2) {
    salidas.push(
      { id: 'yates', etiqueta: 'χ² con corrección de Yates', valor: num(c.yates, 3), nota: textoP(c.pYates) },
      { id: 'fisher', etiqueta: 'Prueba exacta de Fisher', valor: valorP(c.fisher), nota: 'valor p exacto, dos colas' },
    );
  }

  /* ---- semáforos ---- */
  const semaforos = [];
  const estadistico = `χ² = ${num(c.chi2, 2)} con ${gl} gl y ${textoP(c.p)}`;
  if (sig) {
    semaforos.push({
      nombre: 'Conclusión de la prueba', estado: 'atencion',
      texto: `${estadistico}. Como p < α (${alfaTxt}), se rechaza H₀: las variables no son independientes, hay asociación${dosFilas ? ` (la proporción de «${evento}» no es igual en todas las columnas)` : ''}. No dice cuál celda ni de cuánto: mira las contribuciones y los residuos.`,
    });
  } else {
    semaforos.push({
      nombre: 'Conclusión de la prueba', estado: 'informativo',
      texto: `${estadistico}. Como p ≥ α (${alfaTxt}), no hay evidencia de asociación. Eso no prueba que las proporciones sean iguales: con pocos eventos la prueba casi no tiene poder para detectar una diferencia real (guía M7 §5).`,
    });
  }
  semaforos.push(c.bajas > 0
    ? {
      nombre: 'Frecuencias esperadas', estado: 'atencion',
      texto: `${plural(c.bajas, 'celda tiene', 'celdas tienen')} un esperado menor que ${MIN_ESPERADO_CHI} (mínimo ${num(c.minEsperado, 2)}): la aproximación chi-cuadrada pierde validez (plantilla «Chi-cuadrada»). Agrupa categorías, reúne más datos${es2x2 ? ' o apóyate en la prueba exacta de Fisher' : ''}.`,
    }
    : { nombre: 'Frecuencias esperadas', estado: 'cumple', texto: `Todas las celdas tienen un esperado de ${MIN_ESPERADO_CHI} o más (mínimo ${num(c.minEsperado, 2)}): la aproximación chi-cuadrada es razonable.` });
  const matizV = sig && c.cramerV < umbralesV(dfMin)[0]
    ? ' Una asociación significativa pero de efecto muy pequeño puede carecer de importancia práctica.'
    : !sig && c.cramerV >= umbralesV(dfMin)[1] ? ' Un efecto mediano o grande sin significancia suele indicar pocos datos: el azar podría explicarlo.' : '';
  semaforos.push({
    nombre: 'Tamaño del efecto', estado: 'informativo',
    texto: `V de Cramér = ${num(c.cramerV, 3)}: efecto ${clase} según la referencia didáctica de Cohen (en esta tabla: pequeño desde ${umbralesTxt[0]}, mediano desde ${umbralesTxt[1]} y grande desde ${umbralesTxt[2]}).${matizV}`,
  });
  if (!sig) {
    const pocos = dosFilas && eventos < N_EVENTOS_POCOS;
    semaforos.push({
      nombre: 'Poder de la prueba', estado: pocos ? 'atencion' : 'informativo',
      texto: pocos
        ? `Solo hay ${cuenta(eventos)} ${eventos === 1 ? 'evento' : 'eventos'} de «${evento}» repartidos en ${entero(c.N)} unidades: con tan pocos eventos la prueba casi no puede detectar una diferencia real aunque exista (guía M7 §5, referencia didáctica de ${N_EVENTOS_POCOS} eventos). Un dato continuo medido en pocas piezas suele tener más poder.`
        : 'No rechazar H₀ no prueba que los grupos sean iguales; solo dice que estos datos no alcanzan para afirmar lo contrario. Más datos, o un dato continuo, aumentarían el poder (guía M7 §5).',
    });
  }
  if (es2x2) {
    const decisiones = [c.p < alfa, c.pYates < alfa, c.fisher < alfa];
    const coinciden = decisiones.every((d) => d === decisiones[0]);
    semaforos.push({
      nombre: 'Yates y Fisher', estado: coinciden ? 'informativo' : 'atencion',
      texto: `En una tabla 2 × 2: Pearson ${textoP(c.p)}, con corrección de Yates ${textoP(c.pYates)} y exacta de Fisher ${textoP(c.fisher)}. ${coinciden ? `Las tres llegan a la misma decisión${c.bajas ? ', pero con esperados menores que 5 la de Fisher es la confiable' : ''}.` : 'Las pruebas no coinciden en la decisión: con tablas chicas o esperados bajos manda la exacta de Fisher.'}`,
    });
  }

  const umbral = umbralChi({ significativo: sig, bajas: c.bajas > 0 });
  const supuesto = {
    ...SUPUESTO_CHI,
    estado: c.bajas > 0 ? 'atencion' : 'informativo',
    detalle: c.bajas > 0
      ? `${c.bajas} de ${c.celdas} celdas esperadas son menores que ${MIN_ESPERADO_CHI}: el valor p de la chi-cuadrada es solo aproximado. Agrupa categorías o usa la exacta de Fisher en 2 × 2.`
      : 'Frecuencias esperadas suficientes. Falta lo que no se ve en la tabla: que cada unidad se haya contado una sola vez.',
  };

  /* ---- gráficas ---- */
  const xMax = Math.max(c.critico * 1.7, c.chi2 * 1.15, gl + 5 * Math.sqrt(2 * gl));
  const xMin = gl === 1 ? 0.02 : 0;
  const xs = malla(xMin, xMax, 240);
  const ys = xs.map((x) => densidadChi(x, gl));
  const yTop = gl === 1 ? 1.2 : gl === 2 ? 0.55 : Math.max(...ys) * 1.2;
  const xsCola = [c.chi2, ...xs.filter((x) => x > c.chi2)];
  const izquierda = c.chi2 < c.critico; // la etiqueta de cada línea se pone hacia donde hay lugar
  const graficas = [
    {
      id: 'distribucion', titulo: `χ² observado contra el crítico · distribución con ${gl} ${gl === 1 ? 'grado' : 'grados'} de libertad`,
      datos: [
        { type: 'scatter', mode: 'lines', name: `χ² con ${gl} gl (si H₀ fuera cierta)`, x: xs, y: ys, line: { color: COLOR.azul, width: 2.4 }, hoverinfo: 'skip' },
        {
          type: 'scatter', mode: 'lines', name: `Área a la derecha del observado (${textoP(c.p)})`, x: xsCola, y: xsCola.map((x) => densidadChi(x, gl)), fill: 'tozeroy',
          fillcolor: hexARgba(COLOR.coral, 0.4), line: { color: COLOR.coral, width: 0 }, hoverinfo: 'skip',
        },
      ],
      layout: {
        shapes: [lineaV(c.critico, COLOR.ambar, { dash: 'dash', ancho: 1.6 }), lineaV(c.chi2, COLOR.coral, { dash: 'solid', ancho: 2 })],
        annotations: [
          etiquetaV(c.critico, ` crítico ${num(c.critico, 2)} `, COLOR.ambar, { y: 1, ancla: izquierda ? 'left' : 'right' }),
          etiquetaV(c.chi2, ` observado ${num(c.chi2, 2)} `, COLOR.coral, { y: 0.88, ancla: izquierda ? 'right' : 'left' }),
        ],
        xaxis: { title: { text: 'χ²' }, range: [xMin, xMax], zeroline: false },
        yaxis: { title: { text: 'Densidad' }, range: [0, yTop], zeroline: false },
        margin: { l: 56, r: 18, t: 18, b: 48 },
      },
      respaldo: {
        columnas: ['Elemento', 'χ²', 'Densidad', 'Área a la derecha'],
        filas: [
          ['Observado', num(c.chi2, 3), num(densidadChi(c.chi2, gl), 4), valorP(c.p)],
          [`Crítico (α = ${alfaTxt})`, num(c.critico, 3), num(densidadChi(c.critico, gl), 4), num(alfa, 4)],
        ],
      },
    },
  ];

  const celdas = [];
  c.filas.forEach((_, i) => c.columnas.forEach((__, j) => celdas.push({ i, j, nombre: `${etiquetasFilas[i]} · ${etiquetasCols[j]}`, o: obs[i][j], e: esp[i][j], contribucion: c.contribuciones[i][j], z: c.residuos[i][j] })));
  const top = [...celdas].sort((a, b) => b.contribucion - a.contribucion).slice(0, 10);
  const etiquetasTop = top.map((x) => envolver(x.nombre, 30, 2));
  const barras = (signo, nombre, color) => {
    const ps = top.map((x, i) => ({ x, i })).filter(({ x }) => (signo > 0 ? x.z >= 0 : x.z < 0));
    return {
      type: 'bar', orientation: 'h', name: nombre, x: ps.map(({ x }) => x.contribucion), y: ps.map(({ i }) => etiquetasTop[i]), marker: { color },
      textposition: 'none', // el texto solo sirve para el globo; sin esto Plotly lo dibuja dentro de las barras y se desborda
      text: ps.map(({ x }) => `<b>${x.nombre}</b><br>observado ${cuenta(x.o)} · esperado ${num(x.e, 2)}<br>contribución ${num(x.contribucion, 3)} · z = ${conSigno(x.z, 2)}`), hovertemplate: '%{text}<extra></extra>',
    };
  };
  graficas.push({
    id: 'contribuciones', titulo: top.length < celdas.length ? `Las ${top.length} celdas que más aportan a χ²` : 'Aporte de cada celda a χ²', alta: top.length > 6,
    datos: [barras(1, 'Más de lo esperado', COLOR.coral), barras(-1, 'Menos de lo esperado', COLOR.azul)],
    layout: {
      barmode: 'overlay',
      xaxis: { title: { text: 'Contribución (O − E)² / E' }, zeroline: false, rangemode: 'tozero' },
      yaxis: { type: 'category', categoryorder: 'array', categoryarray: etiquetasTop, autorange: 'reversed', automargin: true, tickfont: { size: 11, color: COLOR.gris } },
      margin: { l: 56, r: 18, t: 18, b: 52 },
    },
    respaldo: {
      columnas: ['Celda', 'Observado', 'Esperado', 'Contribución', 'Residuo estandarizado'],
      filas: top.map((x) => [x.nombre, cuenta(x.o), num(x.e, 2), num(x.contribucion, 3), conSigno(x.z, 2)]),
    },
  });

  if (hayWilson) {
    const p0 = eventos / c.N;
    const textoW = (j) => `<b>${etiquetasCols[j]}</b><br>${cuenta(obs[iEvento][j])} de ${cuenta(c.totalesColumna[j])}: ${porcentaje(wilson[j].p)}<br>IC de Wilson de ${nivelTxt} %: ${porcentaje(wilson[j].ic[0])} a ${porcentaje(wilson[j].ic[1])}`;
    graficas.push({
      id: 'tasas', titulo: `Proporción de «${recorta(evento, 40)}» por columna, con intervalo de Wilson de ${nivelTxt} %`, ancha: true,
      datos: [{
        type: 'scatter', mode: 'markers', name: 'Proporción observada', x: etiquetasCols, y: wilson.map((w) => 100 * w.p),
        marker: { color: COLOR.coral, size: 11, line: { color: '#0a1011', width: 1 } },
        error_y: { type: 'data', symmetric: false, array: wilson.map((w) => 100 * (w.ic[1] - w.p)), arrayminus: wilson.map((w) => 100 * (w.p - w.ic[0])), visible: true, color: COLOR.coral, thickness: 2.4, width: 8 },
        text: etiquetasCols.map((_, j) => textoW(j)), hovertemplate: '%{text}<extra></extra>',
      }, {
        // entrada de leyenda para la línea punteada (que es una forma): sin datos, solo el nombre y el estilo
        type: 'scatter', mode: 'lines', name: `Proporción global ${porcentaje(p0)} (lo que supone H₀)`, x: [null], y: [null],
        line: { color: COLOR.gris, dash: 'dot', width: 1.5 }, hoverinfo: 'skip',
      }],
      layout: {
        shapes: [lineaH(100 * p0, COLOR.gris, { dash: 'dot', ancho: 1.5 })],
        xaxis: { type: 'category', categoryorder: 'array', categoryarray: etiquetasCols, zeroline: false },
        yaxis: { title: { text: 'Proporción (%)' }, ticksuffix: ' %', rangemode: 'tozero', zeroline: false },
        margin: { l: 66, r: 18, t: 18, b: 52 },
      },
      respaldo: {
        columnas: ['Columna', 'Eventos', 'Total', 'Proporción', `IC de Wilson de ${nivelTxt} %`],
        filas: etiquetasCols.map((n, j) => [n, cuenta(obs[iEvento][j]), cuenta(c.totalesColumna[j]), porcentaje(wilson[j].p), `${porcentaje(wilson[j].ic[0])} a ${porcentaje(wilson[j].ic[1])}`]),
      },
    });
  }

  /* ---- tablas ---- */
  const encabezadosColumnas = etiquetasCols.map((n) => ({ t: n, num: true }));
  const tablas = [
    {
      titulo: 'Frecuencias observadas, con totales',
      columnas: ['Categoría (fila)', ...encabezadosColumnas, { t: 'Total fila', num: true }],
      filas: [
        ...c.filas.map((_, i) => [etiquetasFilas[i], ...obs[i].map((v) => celdaNum(cuenta(v))), calc(cuenta(c.totalesFila[i]))]),
        ['Total columna', ...c.totalesColumna.map((v) => calc(cuenta(v))), calc(cuenta(c.N))],
      ],
      pie: 'Frecuencias observadas: conteos, no porcentajes. Las filas y columnas sin ningún conteo no entran al cálculo.',
    },
    {
      titulo: 'Frecuencias esperadas bajo H₀ (total de fila × total de columna ÷ N)',
      columnas: ['Categoría (fila)', ...encabezadosColumnas],
      filas: c.filas.map((_, i) => [etiquetasFilas[i], ...esp[i].map((v) => calc(`${num(v, 2)}${v < MIN_ESPERADO_CHI ? ' *' : ''}`))]),
      pie: `Lo que se vería si las filas y las columnas fueran independientes. * esperado menor que ${MIN_ESPERADO_CHI}: la aproximación chi-cuadrada pierde validez.`,
    },
    {
      titulo: 'Contribución a χ² y residuo estandarizado',
      columnas: ['Categoría (fila)', ...encabezadosColumnas, { t: 'Suma', num: true }],
      filas: [
        ...c.filas.map((_, i) => [
          etiquetasFilas[i],
          ...c.contribuciones[i].map((v, j) => calc(`${num(v, 3)} (z ${conSigno(c.residuos[i][j], 2)})${Math.abs(c.residuos[i][j]) >= RESIDUO_NOTABLE ? ' *' : ''}`)),
          calc(num(c.contribuciones[i].reduce((a, v) => a + v, 0), 3)),
        ]),
        ['Suma', ...c.columnas.map((_, j) => calc(num(c.contribuciones.reduce((a, fila) => a + fila[j], 0), 3))), calc(num(c.chi2, 3))],
      ],
      pie: `Contribución = (O − E)² / E; su suma es χ² = ${num(c.chi2, 3)}. Residuo estandarizado z = (O − E) / √E: positivo, más de lo esperado; negativo, menos. * marca |z| ≥ ${RESIDUO_NOTABLE} (referencia didáctica).`,
    },
  ];
  if (es2x2) {
    tablas.push({
      titulo: 'Tabla 2 × 2: Pearson, Yates y Fisher',
      columnas: ['Prueba', { t: 'Estadístico', num: true }, { t: 'gl', num: true }, { t: 'Valor p', num: true }, 'Decisión'],
      filas: [
        ['χ² de Pearson', calc(num(c.chi2, 3)), calc('1'), calc(valorP(c.p)), { texto: decide(c.p), formula: true }],
        ['χ² con corrección de Yates', calc(num(c.yates, 3)), calc('1'), calc(valorP(c.pYates)), { texto: decide(c.pYates), formula: true }],
        ['Exacta de Fisher', guion, guion, calc(valorP(c.fisher)), { texto: decide(c.fisher), formula: true }],
      ],
      pie: `Decisión con α = ${alfaTxt}. Yates resta 0.5 a cada |O − E| y es conservadora. Fisher calcula el valor p exacto con los márgenes fijos (dos colas, como SciPy y R) y no necesita esperados grandes.`,
    });
  }
  if (hayWilson) {
    tablas.push({
      titulo: `Proporción de «${recorta(evento, 40)}» con intervalo de Wilson de ${nivelTxt} %`,
      columnas: ['Columna', { t: 'Eventos', num: true }, { t: 'Total', num: true }, { t: 'Proporción', num: true }, { t: 'IC de Wilson', num: true }],
      filas: etiquetasCols.map((n, j) => [n, celdaNum(cuenta(obs[iEvento][j])), celdaNum(cuenta(c.totalesColumna[j])), calc(porcentaje(wilson[j].p)), calc(`${porcentaje(wilson[j].ic[0])} a ${porcentaje(wilson[j].ic[1])}`)]),
      pie: 'Se toma como evento la fila con menos conteos. El intervalo de Wilson funciona bien con pocos eventos (el normal puede salirse de 0 %). Si los intervalos de dos columnas no se traslapan, la diferencia suele ser real; si se traslapan mucho, los datos no distinguen las columnas.',
    });
  }

  return { ...base, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
}

/* ------------------------------------------------------------------ */
/* Herramienta 1 · correlación y regresión lineal simple                */
/* ------------------------------------------------------------------ */

const PARES_EN_TABLA = 100; // la plantilla acepta hasta 100 pares
const RESIDUO_ATIPICO = 2; // referencia didáctica: un residuo de más de 2 errores estándar llama la atención
const MEJORA_CURVA = 0.2; // referencia didáctica: si un término cuadrático sube R² más de 0.2, la relación parece curva
const PARES_PARA_CURVA = 6; // con menos pares el ajuste cuadrático casi siempre «mejora» solo por tener más parámetros
const rangoPrediccion = 1; // se dibuja la extrapolación hasta una vez el rango de X a cada lado

/** Resuelve un sistema lineal 3 × 3 por eliminación con pivote; null si es singular. */
function resolver3(A, b) {
  const m = A.map((fila, i) => [...fila, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-10) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = c + 1; r < 3; r++) {
      const f = m[r][c] / m[c][c];
      for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k];
    }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let resto = m[i][3];
    for (let k = i + 1; k < 3; k++) resto -= m[i][k] * x[k];
    x[i] = resto / m[i][i];
  }
  return x;
}

/** R² del ajuste cuadrático Y = c₀ + c₁u + c₂u² (u = X centrada y escalada); NaN si no se puede ajustar. */
function r2Cuadratico(x, y) {
  const n = x.length;
  if (n < PARES_PARA_CURVA) return NaN;
  const mx = x.reduce((a, v) => a + v, 0) / n;
  const my = y.reduce((a, v) => a + v, 0) / n;
  const sd = Math.sqrt(x.reduce((a, v) => a + (v - mx) ** 2, 0) / (n - 1));
  if (!(sd > 0)) return NaN;
  const u = x.map((v) => (v - mx) / sd);
  const S = (p) => u.reduce((a, v) => a + v ** p, 0);
  const T = (p) => u.reduce((a, v, i) => a + v ** p * y[i], 0);
  const c = resolver3([[n, S(1), S(2)], [S(1), S(2), S(3)], [S(2), S(3), S(4)]], [T(0), T(1), T(2)]);
  const sct = y.reduce((a, v) => a + (v - my) ** 2, 0);
  if (!c || !(sct > 0)) return NaN;
  const sce = u.reduce((a, v, i) => a + (y[i] - (c[0] + c[1] * v + c[2] * v * v)) ** 2, 0);
  return Math.max(0, 1 - sce / sct);
}

function calcularRegresion(e) {
  const aviso = [];
  const alfa = alfaDe(e, aviso);
  const x = Array.isArray(e.datosX) ? e.datosX : [];
  const y = Array.isArray(e.datosY) ? e.datosY : [];
  const base = { aviso, umbral: umbralRegresion(), supuesto: SUPUESTO_REGRESION, preguntas: PREGUNTAS_REGRESION };
  const sinDatos = (texto) => ({ ...base, vacio: texto, semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto }] });
  if (!x.length && !y.length) return sinDatos('Captura los pares (X, Y): una lista de valores de X y otra de Y, del mismo largo y en el mismo orden (como las columnas de la plantilla).');
  if (x.length !== y.length) return sinDatos(`X tiene ${plural(x.length, 'dato')} y Y tiene ${plural(y.length, 'dato')}: deben ser el mismo número de pares, en el mismo orden.`);
  if (x.length < 3) return sinDatos('Captura al menos 3 pares (X, Y) para ver la correlación y la recta; la plantilla pide 3 y la guía trabaja con 10.');

  const nivel = 1 - alfa;
  const reg = regresionLineal(x, y, { nivel });
  if (!reg.valido) return sinDatos('Todos los valores de X son iguales: no hay recta que ajustar, porque la pendiente se calcula dividiendo entre la variación de X.');

  const n = reg.n;
  const nx = limpio(e.nombreX).trim() || 'X';
  const ny = limpio(e.nombreY).trim() || 'Y';
  const ux = limpio(e.unidadX).trim();
  const uy = limpio(e.unidadY).trim();
  const uxTxt = ux ? ` ${ux}` : '';
  const uyTxt = uy ? ` ${uy}` : '';
  const tituloX = ux ? `${nx} (${ux})` : nx;
  const tituloY = uy ? `${ny} (${uy})` : ny;
  const sdX = Math.sqrt(reg.sxx / (n - 1));
  const sdY = Math.sqrt(reg.syy / (n - 1));
  const decX = decimalesDe(sdX);
  const decY = decimalesDe(sdY);
  const alfaTxt = corto(alfa, 4);
  const nivelTxt = corto(nivel * 100, 2);
  const { pendiente: b, intercepto: a, r, r2, s, p, t, glRes } = reg;
  const sig = Number.isFinite(p) && p < alfa;
  const sinDireccion = Number.isFinite(r) && Math.abs(r) < 0.0005; // r = 0.000 al redondear: ni positiva ni negativa
  const ecuacion = `${ny} = ${coef(a)} ${b < 0 ? '−' : '+'} ${coef(Math.abs(b))} × ${nx}`;
  const [xMin, xMax] = [reg.xMin, reg.xMax];
  const rangoX = xMax - xMin;
  const conSigno3 = (v) => `${v >= 0 ? '+' : ''}${coef(v)}`;

  /* ---- predicción y objetivo ---- */
  const x0 = Number.isFinite(e.xPred) ? e.xPred : NaN;
  const pr = prediccion(reg, x0, nivel);
  const y0 = Number.isFinite(e.yObjetivo) ? e.yObjetivo : NaN;
  const objetivo = xParaY(reg, y0);
  const yPositivos = y.every((v) => v >= 0);
  const imposible = pr.valido && pr.extrapolacion && yPositivos && pr.yh < 0;
  const intervalo = (ic) => `${num(ic[0], decY)} a ${num(ic[1], decY)}`;

  /* ---- salidas ---- */
  const salidas = [
    { id: 'r', etiqueta: 'Correlación r', valor: Number.isFinite(r) ? num(r, 3) : '—', color: 'azul', nota: Number.isFinite(r) ? `${reg.fuerza}${sinDireccion ? ' · sin dirección' : ` · ${r < 0 ? 'negativa' : 'positiva'}`}` : 'Y no varía' },
    { id: 'r2', etiqueta: 'R² (= r²)', valor: Number.isFinite(r2) ? num(r2, 3) : '—', color: 'violeta', nota: Number.isFinite(r2) ? `${pct(r2, 1)} de la variación de Y` : 'sin variación en Y' },
    { id: 'ecuacion', etiqueta: 'Recta de mínimos cuadrados', valor: ecuacion, ancha: true, nota: `Ŷ = a + b · X con a = ${coef(a)}${uyTxt} y b = ${coef(b)}${uy ? ` ${uy}` : ''}${ux ? ` por ${ux}` : ''}` },
    { id: 'pendiente', etiqueta: 'Pendiente b', valor: coef(b), nota: `IC de ${nivelTxt} %: ${coef(reg.icPendiente[0])} a ${coef(reg.icPendiente[1])}` },
    { id: 'p', etiqueta: 'Valor p de la pendiente', valor: valorP(p), color: sig ? 'ambar' : 'teal', nota: s === 0 && b !== 0 ? `ajuste perfecto (s = 0) · ${glRes} gl · ${sig ? 'p < α' : 'p ≥ α'}` : `t = ${num(t, 2)} · ${glRes} gl${p < 0.0001 ? ` · ${cientifica(p, 2)}` : ''} · ${sig ? 'p < α' : 'p ≥ α'}` },
    { id: 's', etiqueta: 'Error estándar de la estimación', valor: num(s, decY + 1), nota: `típico de un par respecto a la recta${uyTxt ? ` (${uy})` : ''}` },
    { id: 'n', etiqueta: 'Pares (n)', valor: entero(n), nota: `X de ${num(xMin, decX)} a ${num(xMax, decX)}${uxTxt}` },
  ];
  if (pr.valido) {
    salidas.push({
      id: 'pred', etiqueta: 'Ŷ esperado', valor: `${num(pr.yh, decY)}${uyTxt}`, color: pr.extrapolacion ? 'ambar' : 'teal',
      nota: `con ${nx} = ${num(x0, decX)}${uxTxt} · predicción de ${nivelTxt} %: ${intervalo(pr.icPred)}${pr.extrapolacion ? ' · extrapolación' : ''}`,
    });
  }
  if (Number.isFinite(y0)) {
    salidas.push(objetivo.valido
      ? { id: 'xobj', etiqueta: 'X necesaria para ese Y', valor: `${num(objetivo.x, decX)}${uxTxt}`, color: objetivo.extrapolacion ? 'ambar' : 'azul', nota: `para ${ny} = ${num(y0, decY)}${uyTxt}${objetivo.extrapolacion ? ' · fuera del rango observado' : ''}` }
      : { id: 'xobj', etiqueta: 'X necesaria para ese Y', valor: '—', nota: 'la pendiente es 0: ninguna X cambia Y' });
  }

  /* ---- ajuste cuadrático (¿la relación es curva?) ---- */
  const r2q = r2Cuadratico(x, y);
  const curva = Number.isFinite(r2q) && Number.isFinite(r2) && r2q - r2 >= MEJORA_CURVA;

  /* ---- residuos ---- */
  const estandar = reg.residuos.map((v) => (s > 0 ? v / s : 0));
  const iMax = estandar.reduce((m, v, i) => (Math.abs(v) > Math.abs(estandar[m]) ? i : m), 0);
  const maxZ = Math.abs(estandar[iMax]);
  const atipicos = estandar.map((v, i) => (Math.abs(v) >= RESIDUO_ATIPICO ? i : -1)).filter((i) => i >= 0);

  /* ---- semáforos ---- */
  const semaforos = [];
  if (Number.isFinite(r)) {
    semaforos.push({
      nombre: 'Correlación', estado: 'informativo',
      texto: sinDireccion
        ? `r = ${num(r, 3)}: no hay relación LINEAL entre ${nx} y ${ny} (la recta queda horizontal y explica ${pct(r2, 1)} de la variación). Ojo: r solo mide relaciones lineales; una relación curva puede dar r ≈ 0. Mira siempre el diagrama de dispersión.`
        : `r = ${num(r, 3)}: relación lineal ${reg.fuerza.toLowerCase()} y ${r < 0 ? 'negativa (cuando una variable sube, la otra baja)' : 'positiva (las dos suben y bajan juntas)'}. R² = ${num(r2, 3)}: la recta explica ${pct(r2, 1)} de la variación de ${ny}; el resto es dispersión que ${nx} no explica.`,
    });
  } else {
    semaforos.push({ nombre: 'Correlación', estado: 'atencion', texto: `${ny} no varía (todos los valores de Y son iguales): no hay correlación que medir. Revisa que Y sea la columna correcta.` });
  }
  semaforos.push(sig
    ? {
      nombre: 'Pendiente', estado: 'atencion',
      texto: `La pendiente es ${coef(b)}${uyTxt}${ux ? ` por ${ux}` : ''} (IC de ${nivelTxt} %: ${coef(reg.icPendiente[0])} a ${coef(reg.icPendiente[1])}) y ${textoP(p)}. Como p < α (${alfaTxt}), hay evidencia de relación lineal: por cada${ux ? ` ${ux}` : ' unidad'} más de ${nx}, ${ny} cambia en promedio ${conSigno3(b)}${uyTxt}.`,
    }
    : {
      nombre: 'Pendiente', estado: 'informativo',
      texto: `La pendiente es ${coef(b)}${uyTxt} (IC de ${nivelTxt} %: ${coef(reg.icPendiente[0])} a ${coef(reg.icPendiente[1])}, incluye el 0) y ${textoP(p)}. Como p ≥ α (${alfaTxt}), no hay evidencia de relación lineal. Con pocos pares la prueba solo detecta pendientes grandes.`,
    });
  if (Number.isFinite(r2q)) {
    semaforos.push(curva
      ? {
        nombre: 'Forma de la relación', estado: 'atencion',
        texto: `Un término cuadrático subiría R² de ${num(r2, 3)} a ${num(r2q, 3)}: la relación parece curva y la recta no la describe bien (r solo mide relaciones lineales). Mira el diagrama de dispersión y los residuos: una curva es la alerta (referencia didáctica).`,
      }
      : {
        nombre: 'Forma de la relación', estado: 'cumple',
        texto: `Un término cuadrático casi no mejora el ajuste (R² de ${num(r2, 3)} a ${num(r2q, 3)}): no hay señal de curvatura. Confírmalo con el diagrama de dispersión y los residuos (referencia didáctica).`,
      });
  }
  if (s > 0) {
    semaforos.push(atipicos.length
      ? {
        nombre: 'Residuos', estado: 'atencion',
        texto: `${atipicos.length > 1 ? `${atipicos.length} pares tienen` : 'Un par tiene'} un residuo de ${RESIDUO_ATIPICO} o más errores estándar (el mayor, el par ${iMax + 1}: X = ${num(x[iMax], decX)}, Y = ${num(y[iMax], decY)}, ${num(maxZ, 1)} s). Revisa si es un error de captura o un caso especial antes de decidir; con muchos pares es normal que alguno pase de 2 (referencia didáctica).`,
      }
      : { nombre: 'Residuos', estado: 'cumple', texto: `Ningún residuo llega a ${RESIDUO_ATIPICO} errores estándar (el mayor es ${num(maxZ, 1)}, en el par ${iMax + 1}). Revisa de todos modos que no haya patrón en la gráfica de residuos.` });
  }
  if (n < MIN_PARES) {
    semaforos.push({
      nombre: 'Número de pares', estado: 'atencion',
      texto: `Con ${plural(n, 'par', 'pares')} la correlación es poco confiable: con pocos pares un r alto aparece por azar con facilidad (con 3 pares casi siempre). La guía trabaja con 10 pares y la plantilla con 12 (referencia didáctica: ${MIN_PARES} o más).`,
    });
  }
  if (pr.valido) {
    semaforos.push(imposible
      ? {
        nombre: 'Extrapolación', estado: 'critico',
        texto: `${nx} = ${num(x0, decX)}${uxTxt} cae fuera del rango observado (${num(xMin, decX)} a ${num(xMax, decX)}${uxTxt}) y la recta predice ${num(pr.yh, decY)}${uyTxt}, un valor negativo aunque todos los Y observados son positivos: la señal de una extrapolación sin sentido (guía M7, ejercicio 2). No uses la recta ahí sin nuevas mediciones.`,
      }
      : pr.extrapolacion
        ? {
          nombre: 'Extrapolación', estado: 'atencion',
          texto: `Cuidado: ${nx} = ${num(x0, decX)}${uxTxt} queda fuera del rango observado (${num(xMin, decX)} a ${num(xMax, decX)}${uxTxt}), así que es una extrapolación (plantilla). La recta no está respaldada por datos ahí y las bandas se abren.`,
        }
        : { nombre: 'Interpolación', estado: 'cumple', texto: `${nx} = ${num(x0, decX)}${uxTxt} está dentro del rango observado (${num(xMin, decX)} a ${num(xMax, decX)}${uxTxt}): la predicción es una interpolación. Ŷ = ${num(pr.yh, decY)}${uyTxt}, con ${nivelTxt} % de confianza de que la media está en ${intervalo(pr.icMedia)}.` });
  }
  if (objetivo.valido && objetivo.extrapolacion) {
    semaforos.push({ nombre: 'X necesaria', estado: 'atencion', texto: `El X que despeja la recta para ${ny} = ${num(y0, decY)}${uyTxt} (${num(objetivo.x, decX)}${uxTxt}) queda fuera del rango observado: es una extrapolación.` });
  }
  semaforos.push({
    nombre: 'Causalidad', estado: 'informativo',
    texto: 'Correlación no implica causalidad (plantilla y guía M7): una relación fuerte puede deberse a una tercera variable o al azar. Para afirmar que X causa Y hace falta un experimento (DOE) o una razón física del proceso, como la que hay entre la fuerza de engarzado y la resistencia de contacto.',
  });

  const umbral = umbralRegresion({ fuerza: reg.fuerza, significativo: Number.isFinite(p) ? sig : undefined, extrapolacion: pr.valido ? pr.extrapolacion : undefined });
  const supuesto = {
    ...SUPUESTO_REGRESION,
    estado: curva || atipicos.length ? 'atencion' : 'informativo',
    detalle: curva
      ? 'La relación parece curva: una recta no cumple el supuesto de linealidad. Transforma las variables, ajusta una curva o limita el rango.'
      : 'Si los residuos muestran una curva, un embudo o un punto muy alejado, no te quedes con el valor p ni con R²: revisa los datos antes de usar la recta.',
  };

  /* ---- gráfica 1: dispersión, recta y bandas ---- */
  const cercano = (v) => Number.isFinite(v) && v >= xMin - rangoPrediccion * rangoX && v <= xMax + rangoPrediccion * rangoX;
  const extremos = [xMin, xMax, ...(pr.valido && cercano(x0) ? [x0] : []), ...(objetivo.valido && cercano(objetivo.x) ? [objetivo.x] : [])];
  const relleno = rangoX * 0.06;
  const lo = Math.min(...extremos) - relleno;
  const hi = Math.max(...extremos) + relleno;
  const cuadricula = malla(lo, hi, 90);
  const bandas = cuadricula.map((v) => prediccion(reg, v, nivel));
  const recta = cuadricula.map((v) => a + b * v);
  const banda = (nombre, ys, extra = {}) => ({ type: 'scatter', mode: 'lines', name: nombre, showlegend: nombre !== '', x: cuadricula, y: ys, line: { width: 0 }, hoverinfo: 'skip', ...extra });
  const textoPar = (i) => `<b>Par ${i + 1}</b><br>${nx}: ${num(x[i], decX)}${uxTxt}<br>${ny}: ${num(y[i], decY)}${uyTxt}<br>Ŷ = ${num(reg.ajustados[i], decY)} · residuo ${conSigno(reg.residuos[i], decY)}`;
  const datosDisp = [
    banda('', bandas.map((q) => q.icPred[0])),
    banda(`Intervalo de predicción de ${nivelTxt} %`, bandas.map((q) => q.icPred[1]), { fill: 'tonexty', fillcolor: hexARgba(COLOR.azul, 0.1) }),
    banda('', bandas.map((q) => q.icMedia[0])),
    banda(`IC de la recta de ${nivelTxt} %`, bandas.map((q) => q.icMedia[1]), { fill: 'tonexty', fillcolor: hexARgba(COLOR.azul, 0.24) }),
    { type: 'scatter', mode: 'lines', name: 'Recta de mínimos cuadrados', x: cuadricula, y: recta, line: { color: COLOR.azul, width: 2.4 }, hoverinfo: 'skip' },
    {
      type: 'scatter', mode: 'markers', name: 'Pares observados', x, y, marker: { color: COLOR.blanco, size: 8, line: { color: '#0a1011', width: 1 } },
      text: x.map((_, i) => textoPar(i)), hovertemplate: '%{text}<extra></extra>',
    },
  ];
  if (pr.valido && cercano(x0)) {
    datosDisp.push({
      type: 'scatter', mode: 'markers', name: `Predicción en ${nx} = ${num(x0, decX)}`, x: [x0], y: [pr.yh], marker: { symbol: 'diamond', size: 13, color: COLOR.ambar, line: { color: '#0a1011', width: 1 } },
      error_y: { type: 'data', array: [pr.icPred[1] - pr.yh], visible: true, color: COLOR.ambar, thickness: 2.2, width: 7 },
      text: [`<b>Predicción</b><br>${nx}: ${num(x0, decX)}${uxTxt}<br>Ŷ = ${num(pr.yh, decY)}${uyTxt}<br>IC de la recta: ${intervalo(pr.icMedia)}<br>Predicción de ${nivelTxt} %: ${intervalo(pr.icPred)}${pr.extrapolacion ? '<br><b>extrapolación</b>' : ''}`], hovertemplate: '%{text}<extra></extra>',
    });
  }
  const formas = [];
  const notas = [];
  const zona = (desde, hasta) => {
    formas.push(bandaV(desde, hasta, COLOR.gris, 0.1));
    notas.push(etiquetaV((desde + hasta) / 2, 'extrapolación', COLOR.gris, { y: 1, ancla: 'center' }));
  };
  if (lo < xMin - relleno * 1.01) zona(lo, xMin);
  if (hi > xMax + relleno * 1.01) zona(xMax, hi);
  if (objetivo.valido && Number.isFinite(y0)) {
    formas.push(lineaH(y0, COLOR.coral, { dash: 'dot', ancho: 1.2 }));
    notas.push(etiquetaH(y0, ` objetivo ${num(y0, decY)} `, COLOR.coral));
    if (cercano(objetivo.x)) {
      formas.push(lineaV(objetivo.x, COLOR.coral, { dash: 'dot', ancho: 1.2 }));
      notas.push(etiquetaV(objetivo.x, ` X = ${num(objetivo.x, decX)} `, COLOR.coral, { y: 0.9, ancla: objetivo.x > (lo + hi) / 2 ? 'right' : 'left' }));
    }
  }
  const graficas = [
    {
      id: 'dispersion', titulo: `Diagrama de dispersión, recta y bandas de ${nivelTxt} %`, ancha: true, alta: true,
      datos: datosDisp,
      layout: {
        shapes: formas, annotations: notas,
        xaxis: { title: { text: tituloX }, range: [lo, hi], zeroline: false },
        yaxis: { title: { text: tituloY }, zeroline: false },
        margin: { l: 66, r: 18, t: 18, b: 52 },
      },
      respaldo: {
        columnas: ['Par', nx, ny, 'Ajustado', 'Residuo'],
        filas: muestra(x.map((_, i) => i)).map((i) => [String(i + 1), num(x[i], decX), num(y[i], decY), num(reg.ajustados[i], decY), conSigno(reg.residuos[i], decY)]),
      },
    },
  ];

  /* ---- gráficas 2 y 3: residuos ---- */
  const dosS = 2 * s;
  const [rMin, rMax] = rangoDe(reg.residuos);
  graficas.push({
    id: 'residuos', titulo: `Residuos contra ${nx}`,
    datos: [{
      type: 'scatter', mode: 'markers', name: 'Residuos', showlegend: false, x, y: reg.residuos,
      marker: { color: x.map((_, i) => (Math.abs(estandar[i]) >= RESIDUO_ATIPICO ? COLOR.coral : COLOR.azul)), size: 8, line: { color: '#0a1011', width: 1 } },
      text: x.map((_, i) => `${textoPar(i)}<br>${num(estandar[i], 2)} errores estándar`), hovertemplate: '%{text}<extra></extra>',
    }],
    layout: {
      shapes: [lineaH(0, COLOR.blanco, { dash: 'solid', ancho: 1 }), lineaH(dosS, COLOR.ambar, { dash: 'dot', ancho: 1.2 }), lineaH(-dosS, COLOR.ambar, { dash: 'dot', ancho: 1.2 })],
      annotations: [
        { x: 1, y: dosS, xref: 'paper', yref: 'y', text: '+2 s', showarrow: false, xanchor: 'right', yanchor: 'bottom', font: { color: COLOR.ambar, size: 10 } },
        { x: 1, y: -dosS, xref: 'paper', yref: 'y', text: '−2 s', showarrow: false, xanchor: 'right', yanchor: 'top', font: { color: COLOR.ambar, size: 10 } },
      ],
      xaxis: { title: { text: tituloX }, zeroline: false },
      yaxis: { title: { text: 'Residuo (Y − Ŷ)' }, zeroline: false, range: [Math.min(rMin, -dosS) * 1.15, Math.max(rMax, dosS) * 1.15] },
      margin: { l: 66, r: 18, t: 18, b: 52 },
    },
    respaldo: {
      columnas: ['Par', nx, 'Residuo', 'Residuo / s'],
      filas: muestra(x.map((_, i) => i)).map((i) => [String(i + 1), num(x[i], decX), conSigno(reg.residuos[i], decY + 1), conSigno(estandar[i], 2)]),
    },
  });

  if (s > 0) {
    const orden = reg.residuos.map((v, i) => ({ v, i })).sort((p1, p2) => p1.v - p2.v || p1.i - p2.i);
    const posiciones = orden.map(({ v, i }, k) => ({ v, i, z: normalPpf((k + 1 - 0.375) / (n + 0.25)) }));
    const sdRes = Math.sqrt(reg.residuos.reduce((acc, v) => acc + v * v, 0) / (n - 1));
    const margenR = (rMax - rMin) * 0.06 || sdRes || 1;
    graficas.push({
      id: 'normal', titulo: 'Probabilidad normal de los residuos',
      datos: [
        { type: 'scatter', mode: 'lines', name: 'Normal esperada', showlegend: false, x: [rMin - margenR, rMax + margenR], y: [(rMin - margenR) / sdRes, (rMax + margenR) / sdRes], line: { color: COLOR.gris, width: 1.5, dash: 'dot' }, hoverinfo: 'skip' },
        {
          type: 'scatter', mode: 'markers', name: 'Residuos', showlegend: false, x: posiciones.map((q) => q.v), y: posiciones.map((q) => q.z),
          marker: { color: COLOR.azul, size: 8, line: { color: '#0a1011', width: 1 } },
          text: posiciones.map((q) => `<b>Par ${q.i + 1}</b><br>residuo: ${conSigno(q.v, decY + 1)}<br>percentil normal esperado: ${num(100 * normalCdf(q.z), 1)} %`), hovertemplate: '%{text}<extra></extra>',
        },
      ],
      layout: {
        xaxis: { title: { text: 'Residuo' }, zeroline: false, range: [rMin - margenR, rMax + margenR] },
        yaxis: { title: { text: 'Percentil normal esperado' }, tickvals: PERCENTILES.map((q) => q.z), ticktext: PERCENTILES.map((q) => `${q.p} %`), zeroline: false },
        margin: { l: 66, r: 18, t: 18, b: 52 },
      },
      respaldo: {
        columnas: ['#', 'Par', 'Residuo', 'Cuantil normal (z)'],
        filas: muestra(posiciones).map((q, k) => [String(k + 1), String(q.i + 1), conSigno(q.v, decY + 1), num(q.z, 2)]),
      },
    });
  }

  /* ---- tablas ---- */
  const guionTabla = '—';
  const filasResumen = [
    ['Pares (n)', calc(entero(n))],
    ['Media de X · media de Y', calc(`${num(reg.mediaX, decX + 1)} · ${num(reg.mediaY, decY + 1)}`)],
    ['Coeficiente de correlación r', calc(Number.isFinite(r) ? num(r, 4) : guionTabla)],
    ['R² (coeficiente de determinación)', calc(Number.isFinite(r2) ? num(r2, 4) : guionTabla)],
    ['Pendiente b', calc(num(b, 5))],
    ['Intercepto a', calc(num(a, 4))],
    ['Error estándar de la estimación s', calc(num(s, decY + 2))],
    ['Error estándar de la pendiente', calc(num(reg.eePendiente, 5))],
    ['Estadístico t de la pendiente', calc(num(t, 3))],
    ['Valor p (prueba de la pendiente)', calc(p > 0 && p < 0.0001 ? `${valorP(p)} (${cientifica(p, 2)})` : p === 0 ? `${valorP(p)} (ajuste perfecto)` : valorP(p))],
    [`IC de ${nivelTxt} % de la pendiente`, calc(`${num(reg.icPendiente[0], 5)} a ${num(reg.icPendiente[1], 5)}`)],
    ['Fuerza de la relación', calc(reg.fuerza || guionTabla)],
    ['Ecuación', calc(ecuacion)],
  ];
  const tablas = [{
    titulo: 'Resumen de la regresión',
    columnas: ['Resultado', { t: 'Valor', num: true }],
    filas: filasResumen,
    pie: `r y b se calculan con las sumas de cuadrados de X y de Y (SC X = ${num(reg.sxx, 3)}, SC Y = ${num(reg.syy, 3)}). Error estándar de la estimación s = √(SC de los residuos / (n − 2)) con ${glRes} gl; t = b / EE de b; el IC de b usa t con ${glRes} gl.`,
  }];
  if (pr.valido || Number.isFinite(y0)) {
    const filasUso = [];
    if (pr.valido) {
      filasUso.push(
        [`${nx} a evaluar`, calc(`${num(x0, decX)}${uxTxt}`)],
        ['Ŷ esperado', calc(`${num(pr.yh, decY)}${uyTxt}`)],
        [`IC de ${nivelTxt} % de la recta (respuesta media)`, calc(intervalo(pr.icMedia))],
        [`Intervalo de predicción de ${nivelTxt} % (una unidad nueva)`, calc(intervalo(pr.icPred))],
        ['Posición frente al rango observado', calc(pr.extrapolacion ? 'fuera: extrapolación' : 'dentro')],
      );
    }
    if (Number.isFinite(y0)) {
      filasUso.push([`${ny} objetivo`, calc(`${num(y0, decY)}${uyTxt}`)]);
      filasUso.push(objetivo.valido
        ? [`${nx} necesaria para ese objetivo`, calc(`${num(objetivo.x, decX)}${uxTxt}${objetivo.extrapolacion ? ' (fuera del rango)' : ''}`)]
        : [`${nx} necesaria para ese objetivo`, calc('no hay: la pendiente es 0')]);
    }
    tablas.push({
      titulo: 'Predicción y objetivo',
      columnas: ['Concepto', { t: 'Valor', num: true }],
      filas: filasUso,
      pie: 'Ŷ = a + b · X. El IC de la recta acota la respuesta MEDIA; el intervalo de predicción, un valor individual nuevo (más ancho). La «X necesaria» solo despeja la ecuación: no es un intervalo y no garantiza el resultado (la guía: «al menos 173 N» para 1.2 mΩ).',
    });
  }
  const filasDatos = x.slice(0, PARES_EN_TABLA).map((_, i) => [
    celdaNum(String(i + 1)), celdaNum(num(x[i], decX)), celdaNum(num(y[i], decY)), calc(num(reg.ajustados[i], decY + 1)), calc(conSigno(reg.residuos[i], decY + 1)), calc(conSigno(estandar[i], 2)),
  ]);
  tablas.push({
    titulo: 'Datos, valores ajustados y residuos',
    columnas: [{ t: 'Par', num: true }, { t: nx, num: true }, { t: ny, num: true }, { t: 'Ŷ ajustado', num: true }, { t: 'Residuo', num: true }, { t: 'Residuo / s', num: true }],
    filas: filasDatos,
    resaltar: atipicos.filter((i) => i < PARES_EN_TABLA),
    pie: `Residuo = Y − Ŷ; «Residuo / s» lo expresa en errores estándar de la estimación (${num(s, decY + 2)}). Se resaltan los pares con |residuo / s| ≥ ${RESIDUO_ATIPICO}.${n > PARES_EN_TABLA ? ` Se muestran los primeros ${PARES_EN_TABLA} de ${entero(n)} pares.` : ''}`,
  });

  return { ...base, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
}

/* ------------------------------------------------------------------ */
/* Definición del laboratorio                                           */
/* ------------------------------------------------------------------ */

export default function lab19(ctx = {}) {
  const caso = ctx.caso ?? {};
  const regCaso = caso.regresion ?? {};
  const xPlantilla = regCaso.excel?.x ?? EXCEL_X;
  const yPlantilla = regCaso.excel?.y ?? EXCEL_Y;
  const nombreX = regCaso.x?.nombre ?? 'Fuerza de engarzado';
  const unidadX = regCaso.x?.unidad ?? 'N';
  const nombreY = regCaso.y?.nombre ?? 'Resistencia de contacto';
  const unidadY = regCaso.y?.unidad ?? 'mΩ';
  const xPred = regCaso.excel?.xPrediccion ?? 170;
  const yObjetivo = regCaso.excel?.yObjetivo ?? 1.5;

  const chiCaso = caso.chi ?? {};
  const estratos = chiCaso.estratos?.length >= 3 ? chiCaso.estratos : ['Turno 1', 'Turno 2', 'Turno 3'];
  const fallas = chiCaso.guia?.fallas ?? [2, 2, 6];
  const porTurno = chiCaso.guia?.unidadesPorTurno ?? 5340;
  const filasPlantilla = chiCaso.excel?.filas?.length ? chiCaso.excel.filas : [{ categoria: 'Conforme', conteos: [285, 280, 262] }, { categoria: 'Defecto', conteos: [15, 20, 38] }];
  // «Torque contra el resto»: la fila de torque de la hoja de verificación del LAB 14 contra la suma de las demás categorías.
  const hoja = caso.hojaVerificacion?.excel?.categorias ?? [];
  const filaTorque = hoja.find((c) => /^torque/i.test(c.categoria));
  const torque = filaTorque?.conteos?.slice(0, 3) ?? [6, 8, 21];
  const resto = filaTorque ? estratos.map((_, j) => hoja.filter((c) => c !== filaTorque).reduce((a, c) => a + (c.conteos?.[j] ?? 0), 0)) : [25, 22, 21];
  const guiaFilas = [aFila('Falla de continuidad', fallas), aFila('Sin falla', fallas.map((f) => porTurno - f))];
  const nombresTres = estratos.slice(0, 3).join(', ');

  const icCaso = caso.ic?.torque ?? {};
  const icTorque = { icN: icCaso.n ?? 10, icMedia: icCaso.media ?? 1.355, icS: icCaso.s ?? 0.034, icUnidad: icCaso.unidad ?? 'N·m' };

  const base = { alfa: ALFA_DEFECTO };
  const presets = [
    {
      id: 'reg-plantilla', etiqueta: 'Plantilla Excel: fuerza y resistencia (12 pares)', visibleSi: esRegresion,
      ayuda: 'Los 12 pares de la hoja «Correlacion y Regresion» (la plantilla no rotula las variables: se leen como fuerza de engarzado y resistencia de contacto). r = −0.994 y R² = 0.988. La guía publica Resistencia = 16.37 − 0.088 × Fuerza (R² = 0.985), que sale de diez pares que solo aparecen en una figura: aquí la recta es 15.662 − 0.084 × Fuerza, parecida pero no idéntica.',
      valores: { ...base, herramienta: 'regresion', nombreX, unidadX, nombreY, unidadY, datosX: xPlantilla, datosY: yPlantilla, xPred, yObjetivo },
    },
    {
      id: 'reg-curva', etiqueta: 'Relación curva inventada: Y = X² (r = 0)', visibleSi: esRegresion,
      ayuda: 'Una relación inventada para ver el límite de r: Y = X² con X de −5 a 5. Y depende por completo de X y aun así r = 0, porque r solo detecta relaciones lineales. No son datos del proceso: sirve para entender por qué se mira siempre el diagrama de dispersión.',
      valores: { ...base, herramienta: 'regresion', nombreX: 'X', unidadX: '', nombreY: 'Y', unidadY: '', datosX: CURVA_X, datosY: CURVA_X.map((v) => v * v), xPred: NaN, yObjetivo: NaN },
    },
    {
      id: 'chi-guia', etiqueta: 'Guía M7 §5: fallas por turno (2, 2 y 6 en 5,340 arneses)', visibleSi: esChi,
      ayuda: 'Las fallas de continuidad eléctrica de las ocho semanas: 2, 2 y 6 en 5,340 arneses por turno (16,020 en total). χ² = 3.20, gl = 2, p = 0.20: no se rechaza H₀ aunque el Turno 3 tenga el triple de fallas. Los esperados son 3.33 (menos de 5) y la prueba casi no tiene poder: no concluyas que los turnos fallan igual.',
      valores: { ...base, herramienta: 'chi', numCols: '3', nombresCols: nombresTres, observadas: guiaFilas },
    },
    {
      id: 'chi-plantilla', etiqueta: 'Plantilla Excel: conforme y defecto por turno (900)', visibleSi: esChi,
      ayuda: 'Hoja «Chi-cuadrada»: conforme y defecto por turno en 900 arneses (285 · 15, 280 · 20 y 262 · 38). χ² = 13.09, gl = 2, p = 0.0014: la proporción de defectos no es igual entre turnos y el Turno 3 aporta la mayor parte de χ².',
      valores: { ...base, herramienta: 'chi', numCols: '3', nombresCols: nombresTres, observadas: filasPlantilla.map((f) => aFila(f.categoria, f.conteos)) },
    },
    {
      id: 'chi-torque', etiqueta: 'Derivado del LAB 14: torque contra el resto, por turno', visibleSi: esChi,
      ayuda: 'Defectos de torque contra las otras cinco categorías de la hoja de verificación (LAB 14), por turno. Agrupar resuelve los esperados menores que 5. χ² = 8.48, p = 0.014: la mezcla de defectos no es igual entre turnos (el torque pesa más en el Turno 3). Ojo: cuenta defectos, no arneses producidos.',
      valores: { ...base, herramienta: 'chi', numCols: '3', nombresCols: nombresTres, observadas: [aFila('Torque fuera de especificación', torque), aFila('Las otras cinco categorías', resto)] },
    },
    {
      id: 'chi-2x2', etiqueta: 'Derivado de la guía: turnos 1 y 3 en una tabla 2 × 2', visibleSi: esChi,
      ayuda: 'Solo los turnos 1 y 3 de la guía (2 contra 6 fallas en 5,340 arneses cada uno). En una tabla 2 × 2 aparecen la corrección de Yates y la prueba exacta de Fisher; con esperados de 4.0 la chi-cuadrada ya no es confiable.',
      valores: { ...base, herramienta: 'chi', numCols: '2', nombresCols: `${estratos[0]}, ${estratos[2]}`, observadas: [aFila('Falla de continuidad', [fallas[0], fallas[2]]), aFila('Sin falla', [porTurno - fallas[0], porTurno - fallas[2]])] },
    },
    {
      id: 'ic-torque', etiqueta: 'Guía M7 §1: diez torques del Módulo 5', visibleSi: esIc,
      ayuda: 'x̄ = 1.355 N·m y s = 0.034 N·m con n = 10. La guía calcula con z: [1.334, 1.376]. Con t de Student, que es lo más correcto con n < 30, sale [1.331, 1.379]: un poco más ancho.',
      valores: { ...base, herramienta: 'ic', ...icTorque },
    },
    {
      id: 'ic-examen', etiqueta: 'Examen M7: n = 16, x̄ = 50, s = 8', visibleSi: esIc,
      ayuda: 'Pregunta 7 del examen de la guía: con z = 1.96 el intervalo es [46.08, 53.92]; con t de Student (15 gl) sale [45.74, 54.26].',
      valores: { ...base, herramienta: 'ic', icN: 16, icMedia: 50, icS: 8, icUnidad: '' },
    },
  ];

  const entradas = [
    {
      id: 'herramienta', tipo: 'opcion', etiqueta: 'Herramienta', valor: 'regresion',
      opciones: [
        { valor: 'regresion', texto: 'Correlación y regresión', ayuda: 'Fuerza de la relación entre dos variables continuas, recta de mínimos cuadrados y predicción (guía M7 §3 y §4).' },
        { valor: 'chi', texto: 'Chi-cuadrada', ayuda: 'Compara conteos o proporciones de atributo entre grupos (guía M7 §5).' },
        { valor: 'ic', texto: 'IC de una media', ayuda: 'Intervalo de confianza de una media, con z y con t de Student (guía M7 §1).' },
      ],
      ayuda: 'Tres herramientas de la fase Analizar: cada una muestra solo sus propios datos.',
    },
    {
      id: 'alfa', tipo: 'numero', etiqueta: 'Nivel de significancia α (confianza = 1 − α)', valor: ALFA_DEFECTO, min: 0.0001, max: 0.9999, marcador: '0.05',
      ayuda: 'Se fija antes de ver los datos; casi siempre es 0.05 (95 % de confianza). Debe estar entre 0 y 1. Gobierna la decisión de la prueba y el ancho de los intervalos.',
    },
    /* regresión */
    { tipo: 'seccion', etiqueta: 'Variables · pares (X, Y)', visibleSi: esRegresion },
    { id: 'nombreX', tipo: 'texto', etiqueta: 'Variable X (entrada) · nombre', valor: nombreX, marcador: 'p. ej. Fuerza de engarzado', visibleSi: esRegresion },
    { id: 'unidadX', tipo: 'texto', etiqueta: 'X · unidad (opcional)', valor: unidadX, marcador: 'p. ej. N', visibleSi: esRegresion },
    { id: 'nombreY', tipo: 'texto', etiqueta: 'Variable Y (respuesta) · nombre', valor: nombreY, marcador: 'p. ej. Resistencia de contacto', visibleSi: esRegresion },
    { id: 'unidadY', tipo: 'texto', etiqueta: 'Y · unidad (opcional)', valor: unidadY, marcador: 'p. ej. mΩ', visibleSi: esRegresion },
    {
      id: 'datosX', tipo: 'datos', etiqueta: 'Valores de X', valor: xPlantilla, filasTexto: 4, marcador: 'Pega la columna de Excel o escribe los valores', visibleSi: esRegresion,
      ayuda: 'Un valor por par. Separa con espacios, comas o saltos de línea. X y Y deben tener el mismo número de datos, en el mismo orden.',
    },
    { id: 'datosY', tipo: 'datos', etiqueta: 'Valores de Y (mismo orden que X)', valor: yPlantilla, filasTexto: 4, visibleSi: esRegresion },
    { tipo: 'seccion', etiqueta: 'Opcional · usar la recta', visibleSi: esRegresion },
    {
      id: 'xPred', tipo: 'numero', etiqueta: 'X a evaluar (predicción)', valor: xPred, marcador: 'p. ej. 170', visibleSi: esRegresion,
      ayuda: 'Calcula el Y que espera la recta y sus intervalos. Fuera del rango de los datos es extrapolación y se avisa.',
    },
    {
      id: 'yObjetivo', tipo: 'numero', etiqueta: 'Y objetivo', valor: yObjetivo, marcador: 'p. ej. 1.5', visibleSi: esRegresion,
      ayuda: 'Despeja la ecuación para ver qué X corresponde a ese Y. No es un intervalo: solo la recta puesta al revés.',
    },
    /* chi-cuadrada */
    { tipo: 'seccion', etiqueta: 'Tabla de frecuencias observadas', visibleSi: esChi },
    {
      id: 'numCols', tipo: 'opcion', etiqueta: 'Número de columnas', valor: '3', visibleSi: esChi,
      opciones: ['2', '3', '4', '5'].map((k) => ({ valor: k, texto: k })),
      ayuda: 'Las columnas son los grupos que se comparan (turnos, máquinas, proveedores…); las filas, las categorías de atributo (falla o sin falla). Hasta 5 × 5, como la plantilla.',
    },
    { id: 'nombresCols', tipo: 'texto', etiqueta: 'Nombres de las columnas (separados por comas)', valor: nombresTres, marcador: 'Turno 1, Turno 2, Turno 3', visibleSi: esChi },
    {
      id: 'observadas', tipo: 'tabla', etiqueta: 'Conteos observados', columnas: columnasTabla, filas: guiaFilas, filaNueva, minFilas: 2, maxFilas: MAX_FILAS, filasVacias: 3, etiquetaAgregar: '+ Fila', visibleSi: esChi,
      ayuda: 'Una fila por categoría y un conteo por columna: enteros desde 0, no porcentajes. Las filas y columnas sin conteos se ignoran, como en la plantilla.',
    },
    /* intervalo de confianza */
    { tipo: 'seccion', etiqueta: 'Resumen de la muestra', visibleSi: esIc },
    { id: 'icN', tipo: 'numero', etiqueta: 'Tamaño de la muestra n', valor: icTorque.icN, min: 2, marcador: 'p. ej. 10', visibleSi: esIc, ayuda: 'Entero de al menos 2.' },
    { id: 'icMedia', tipo: 'numero', etiqueta: 'Media muestral x̄', valor: icTorque.icMedia, marcador: 'p. ej. 1.355', visibleSi: esIc },
    { id: 'icS', tipo: 'numero', etiqueta: 'Desviación estándar muestral s', valor: icTorque.icS, min: 0, marcador: 'p. ej. 0.034', visibleSi: esIc, ayuda: 'La desviación estándar de la muestra (n − 1 en el denominador), no la de la población.' },
    { id: 'icUnidad', tipo: 'texto', etiqueta: 'Unidad (opcional)', valor: icTorque.icUnidad, marcador: 'p. ej. N·m', visibleSi: esIc },
  ];

  return {
    id: 'lab19',
    numero: '19',
    modulo: 'M7',
    titulo: 'Regresión, chi-cuadrada e intervalo de confianza',
    resumen: 'Tres herramientas de la fase Analizar con un selector: correlación y regresión lineal simple (con predicción, bandas y residuos), chi-cuadrada de independencia para datos de atributo, e intervalo de confianza de una media con z y con t.',
    panelAncho: true,
    entradas,
    presets,
    umbral: umbralRegresion(),
    supuesto: SUPUESTO_REGRESION,
    preguntas: PREGUNTAS_REGRESION,

    calcular(e) {
      if (esChi(e)) return calcularChi(e);
      if (esIc(e)) return calcularIc(e);
      return calcularRegresion(e);
    },
  };
}
