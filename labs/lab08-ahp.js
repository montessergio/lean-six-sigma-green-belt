/**
 * LAB 08 · AHP: pesos por comparación por pares y razón de consistencia
 *
 * Guía: M2 §5. Se comparan los criterios por pares con la escala de 1 (igual importancia) a 9 (importancia
 * extrema); se suma cada columna, se normaliza y se promedia cada fila para obtener los pesos. La razón de
 * consistencia (RC) revisa que los juicios no se contradigan: con RC < 0.10 la matriz se considera
 * suficientemente consistente. Cuatro criterios (IR de Saaty para n = 4: 0.90).
 * Los pesos se calculan con la matriz recíproca exacta (1/3 = 0.3333…); la guía muestra la matriz redondeada
 * (0.33) y por eso cita pesos aproximados (≈ 54 %, 24 %, 16 % y 5 %).
 *
 * Presets: `guia` (comparación ilustrativa de la guía) e `inconsistente` (ejemplo didáctico).
 */
import { ahp, matrizReciproca } from '../js/lib/stats.js';
import { corto, leerNumero, num, pct } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { trazaBarras } from '../js/lib/graficas.js';

const N = 4;
/** Orden de las seis comparaciones (mitad superior de la matriz, fila por fila). */
const PARES = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const COLORES = [COLOR.teal, COLOR.azul, COLOR.ambar, COLOR.violeta];
const t = (v) => String(v ?? '').trim();
const nombreCriterio = (estado, i) => t(estado.criterios?.[i]?.nombre) || `Criterio ${i + 1}`;

/** Criterios y comparación ilustrativa de la guía (M2 §5), por si el caso no está disponible. */
const CRITERIOS_GUIA = ['Impacto cliente', 'Beneficio financiero', 'Objetivos operativos', 'Factibilidad'];
const TRIANGULO_GUIA = [3, 4, 7, 2, 5, 4];

/**
 * Ejemplo didáctico (no viene de la guía): A ≫ B y B ≫ C, pero C se juzga más importante que A.
 * Los valores se eligieron para que la contradicción se note en la razón de consistencia.
 */
const TRIANGULO_INCONSISTENTE = [5, '1/5', 3, 5, '1/3', 3];

const UMBRAL = {
  titulo: 'Criterios de interpretación (guía M2 §5)',
  filas: [
    { rango: 'RC < 0.10', texto: 'la matriz es suficientemente consistente para usarse (guía M2 §5)' },
    { rango: '0.10 ≤ RC < 0.20', texto: 'consistencia dudosa: revisa los juicios más extremos antes de usar los pesos (referencia didáctica)' },
    { rango: 'RC ≥ 0.20', texto: 'los juicios se contradicen: repite la comparación (referencia didáctica)' },
    { rango: 'Escala de 1 a 9', texto: '1 = igual importancia, 9 = importancia extrema; si el segundo criterio es el más importante se usa el recíproco (1/3, 1/5, 1/7…)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto: 'Los juicios los emite un equipo que conoce el negocio, comparando cada par por separado y de forma transitiva: si A es mucho más importante que B y B mucho más que C, C no puede ser más importante que A. La RC detecta contradicciones entre juicios; no detecta juicios equivocados pero consistentes.',
};

export default function lab08(ctx = {}) {
  const criteriosGuia = ctx.caso?.ahp?.criterios ?? CRITERIOS_GUIA;
  const trianguloGuia = ctx.caso?.ahp?.triangulo ?? TRIANGULO_GUIA;
  const filasCriterios = (lista) => lista.map((nombre) => ({ nombre }));
  const filasPares = (tri) => tri.map((valor) => ({ valor }));

  return {
    id: 'lab08',
    numero: '08',
    modulo: 'M2',
    titulo: 'AHP: pesos y consistencia',
    resumen: 'Compara cuatro criterios por pares con la escala de 1 a 9 y obtén sus pesos, la matriz normalizada y la razón de consistencia que dice si tus juicios se contradicen.',
    panelAncho: true,
    entradas: [
      {
        id: 'criterios', tipo: 'tabla', etiqueta: 'Los cuatro criterios',
        columnas: [{ id: 'nombre', etiqueta: 'Criterio', tipo: 'texto' }],
        filas: filasCriterios(criteriosGuia), filaNueva: { nombre: '' }, minFilas: N, maxFilas: N, agregar: false,
      },
      {
        id: 'pares', tipo: 'tabla', etiqueta: 'Comparaciones por pares: ¿cuántas veces es más importante A que B?',
        columnas: [
          { id: 'a', etiqueta: 'Criterio A', tipo: 'fijo', texto: (estado, fila, i) => nombreCriterio(estado, PARES[i]?.[0] ?? 0) },
          { id: 'b', etiqueta: 'Criterio B', tipo: 'fijo', texto: (estado, fila, i) => nombreCriterio(estado, PARES[i]?.[1] ?? 0) },
          { id: 'valor', etiqueta: 'A respecto a B (1–9, 1/3…)', tipo: 'texto', ancho: 150 },
        ],
        filas: filasPares(trianguloGuia), filaNueva: { valor: '' }, minFilas: PARES.length, maxFilas: PARES.length, agregar: false,
      },
    ],
    presets: [
      { id: 'guia', etiqueta: 'Guía M2 §5: cuatro criterios', ayuda: 'Comparación ilustrativa de la guía (3, 4, 7, 2, 5, 4): el impacto en el cliente domina y la factibilidad queda última.', valores: { criterios: filasCriterios(criteriosGuia), pares: filasPares(trianguloGuia) } },
      { id: 'inconsistente', etiqueta: 'Ejemplo con juicios contradictorios', ayuda: 'Ejemplo didáctico (no es de la guía): el primero gana al segundo, el segundo gana al tercero y el tercero se juzga mejor que el primero.', valores: { criterios: filasCriterios(criteriosGuia), pares: filasPares(TRIANGULO_INCONSISTENTE) } },
    ],
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      'Cambia una sola comparación (por ejemplo, de 3 a 9): ¿cuánto se mueven los pesos y la razón de consistencia?',
      '¿Qué par de criterios te costó más trabajo comparar? ¿Qué dato o qué persona del equipo te ayudaría a decidir?',
      'Si la RC sale alta, ¿qué comparaciones revisarías primero: las más extremas o las que cierran un ciclo de preferencias?',
      'Los pesos exactos (matriz recíproca) y los de la guía (matriz redondeada) difieren un poco: ¿cambia el orden de los criterios?',
    ],

    calcular(e) {
      const nombres = Array.from({ length: N }, (_, i) => nombreCriterio(e, i));
      const crudos = PARES.map((_, i) => e.pares?.[i]?.valor);
      const valores = crudos.map((v) => (typeof v === 'number' ? v : leerNumero(v)));
      const invalidos = valores.map((v, i) => (Number.isFinite(v) && v > 0 ? -1 : i)).filter((i) => i >= 0);
      const semaforosSin = ['Razón de consistencia', 'Escala de 1 a 9'].map((nombre) => ({ nombre, estado: 'sin-datos', texto: 'Captura las seis comparaciones.' }));
      if (invalidos.length === PARES.length) {
        return { vacio: 'Captura las seis comparaciones por pares (por ejemplo 3, 1/3 o 0.5) para calcular los pesos.', semaforos: semaforosSin };
      }
      if (invalidos.length) {
        const faltan = invalidos.map((i) => `${nombres[PARES[i][0]]} frente a ${nombres[PARES[i][1]]}`);
        return { vacio: `Faltan comparaciones válidas (números mayores que cero): ${faltan.join('; ')}.`, aviso: 'Se necesitan las seis comparaciones para armar la matriz.', semaforos: semaforosSin };
      }

      const m = matrizReciproca(valores, N);
      const r = ahp(m);
      const orden = r.pesos.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
      const posicion = Array(N).fill(0);
      orden.forEach(({ i }, k) => { posicion[i] = k + 1; });

      const salidas = [
        ...nombres.map((nom, i) => ({ id: `peso-${i + 1}`, etiqueta: `Peso: ${nom}`, valor: pct(r.pesos[i], 1), color: i === orden[0].i ? 'teal' : undefined, nota: `prioridad ${posicion[i]}` })),
        { id: 'orden', etiqueta: 'Orden de prioridad', valor: orden.map(({ i }) => nombres[i]).join(' > '), ancha: true },
        { id: 'lambda-max', etiqueta: 'λmax', valor: num(r.lambdaMax, 3), pequeno: true, nota: `n = ${N}; con consistencia perfecta λmax = n` },
        { id: 'ic', etiqueta: 'Índice de consistencia (IC)', valor: num(r.ic, 3), pequeno: true, nota: '(λmax − n) ÷ (n − 1)' },
        { id: 'ir', etiqueta: 'Índice aleatorio (IR)', valor: num(r.ri, 2), pequeno: true, nota: `valor de Saaty para n = ${N}` },
        { id: 'rc', etiqueta: 'Razón de consistencia (RC)', valor: num(r.rc, 3), color: 'azul', nota: 'IC ÷ IR; menor que 0.10 es aceptable' },
      ];

      const semaforos = [];
      if (r.rc < 0.1) semaforos.push({ nombre: 'Razón de consistencia', estado: 'cumple', texto: `RC = ${num(r.rc, 3)}: menor que 0.10, los juicios son suficientemente consistentes.` });
      else if (r.rc < 0.2) semaforos.push({ nombre: 'Razón de consistencia', estado: 'atencion', texto: `RC = ${num(r.rc, 3)}: entre 0.10 y 0.20 (referencia didáctica); revisa los juicios más extremos.` });
      else semaforos.push({ nombre: 'Razón de consistencia', estado: 'critico', texto: `RC = ${num(r.rc, 3)}: mayor que 0.20 (referencia didáctica); los juicios se contradicen, repite la comparación.` });

      const fuera = valores.map((v, i) => (v < 1 / 9 - 1e-9 || v > 9 + 1e-9 ? i : -1)).filter((i) => i >= 0);
      semaforos.push(fuera.length
        ? { nombre: 'Escala de 1 a 9', estado: 'atencion', texto: `Fuera de la escala de 1/9 a 9: ${fuera.map((i) => `${nombres[PARES[i][0]]} frente a ${nombres[PARES[i][1]]} (${corto(valores[i], 3)})`).join('; ')}.` }
        : { nombre: 'Escala de 1 a 9', estado: 'cumple', texto: 'Las seis comparaciones están entre 1/9 y 9.' });

      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((fila, i) => ({ ...fila, activa: [r.rc < 0.1, r.rc >= 0.1 && r.rc < 0.2, r.rc >= 0.2, fuera.length === 0][i] })),
      };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Si la RC es alta, busca un ciclo de preferencias (A > B > C > A) antes de culpar a un solo juicio.' };

      const graficas = [
        {
          id: 'pesos', titulo: 'Pesos de los criterios (%)',
          datos: [trazaBarras(nombres, r.pesos.map((p) => Math.round(p * 1000) / 10), { colores: COLORES, texto: r.pesos.map((p) => pct(p, 1)), mostrarLeyenda: false })],
          layout: { showlegend: false, yaxis: { rangemode: 'tozero', ticksuffix: ' %' } },
          respaldo: { columnas: ['Criterio', 'Peso'], filas: nombres.map((nom, i) => [nom, pct(r.pesos[i], 1)]) },
        },
      ];

      const celda = (x, i, j) => ({ texto: num(x, 2), num: true, formula: j < i });
      const tablas = [
        {
          titulo: 'Matriz de comparaciones por pares (recíproca)',
          columnas: ['', ...nombres.map((nom) => ({ t: nom, num: true }))],
          filas: [
            ...m.map((fila, i) => [nombres[i], ...fila.map((x, j) => celda(x, i, j))]),
            ['Suma de la columna', ...r.sumas.map((x) => ({ texto: num(x, 2), num: true, formula: true }))],
          ],
          resaltar: [N],
          pie: 'Sobre la diagonal van tus seis juicios; debajo, sus recíprocos (azul claro).',
        },
        {
          titulo: 'Matriz normalizada y pesos',
          columnas: ['', ...nombres.map((nom) => ({ t: nom, num: true })), { t: 'Peso (promedio de la fila)', num: true }],
          filas: m.map((fila, i) => [nombres[i], ...fila.map((x, j) => ({ texto: num(x / r.sumas[j], 3), num: true, formula: true })), { texto: pct(r.pesos[i], 1), num: true, formula: true }]),
          pie: 'Cada celda se divide entre la suma de su columna y el peso es el promedio de cada fila.',
        },
      ];

      return { salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
