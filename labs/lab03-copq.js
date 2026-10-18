/**
 * LAB 03 · Costo de la mala calidad (COPQ)
 *
 * Guía: M1 §5 (modelo PAF de Juran) y plantilla Excel «COPQ (PAF)».
 *   COGQ = prevención + evaluación · COPQ = falla interna + falla externa · COQ = COGQ + COPQ.
 * El COPQ en manufactura suele ser de 5 % a 20 % de las ventas (hasta 35 % en los casos más débiles).
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: costos mensuales de la línea de arneses (caso) y el ejercicio 2 del módulo 1 (COPQ = 7.5 %).
 */
import { costoCalidad } from '../js/lib/stats.js';
import { entero, num, pct } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { trazaBarras } from '../js/lib/graficas.js';

const CATEGORIAS = [
  { valor: 'prevencion', texto: 'Prevención', color: COLOR.teal },
  { valor: 'evaluacion', texto: 'Evaluación', color: COLOR.azul },
  { valor: 'fallaInterna', texto: 'Falla interna', color: COLOR.ambar },
  { valor: 'fallaExterna', texto: 'Falla externa', color: COLOR.coral },
];
const FACTOR = { mensual: 12, trimestral: 4, anual: 1 };

/** Ejercicio 2 del M1: costos del último año en miles de dólares. */
const FILAS_GUIA = [
  { categoria: 'prevencion', concepto: 'Prevención', costo: 180 },
  { categoria: 'evaluacion', concepto: 'Evaluación', costo: 220 },
  { categoria: 'fallaInterna', concepto: 'Falla interna', costo: 340 },
  { categoria: 'fallaExterna', concepto: 'Falla externa', costo: 260 },
];

const UMBRAL = {
  titulo: 'Umbrales de interpretación (guía M1 §5)',
  filas: [
    { rango: 'COPQ ≤ 5 % de las ventas', texto: 'por debajo del rango habitual en manufactura' },
    { rango: '5 % a 20 %', texto: 'rango habitual en manufactura: hay oportunidad de reducirlo' },
    { rango: 'COPQ > 20 %', texto: 'por encima de lo habitual; en los casos más débiles llega a 35 %' },
    { rango: 'COPQ > COGQ', texto: 'las fallas pesan más que la prevención y la evaluación: patrón habitual sin un programa de calidad maduro (referencia didáctica para el semáforo)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto: 'Los costos de falla están completos (retrabajo, scrap, paros, garantías, reclamos) y las ventas y los costos son del mismo periodo y de la misma moneda. Medir solo el gasto del departamento de calidad subestima el COPQ.',
};

export default function lab03(ctx = {}) {
  const copq = ctx.caso?.copq;
  const filasCaso = (copq?.conceptos ?? []).map((c) => ({ categoria: c.categoria, concepto: c.concepto, costo: c.costo }));
  const filasEjemplo = filasCaso.length ? filasCaso : FILAS_GUIA;
  const periodoCaso = (copq?.periodo ?? 'mensual').toLowerCase();

  return {
    id: 'lab03',
    numero: '03',
    modulo: 'M1',
    titulo: 'Costo de la mala calidad (COPQ)',
    resumen: 'Clasifica los costos en las cuatro categorías del modelo PAF y obtén el COGQ, el COPQ y el COQ, y qué parte de las ventas se va en fallas.',
    panelAncho: true,
    entradas: [
      { id: 'moneda', tipo: 'texto', etiqueta: 'Moneda y unidad', valor: copq?.moneda ?? 'MXN', marcador: 'MXN, USD, miles de USD…' },
      { id: 'ventas', tipo: 'numero', etiqueta: 'Ventas del mismo periodo', valor: copq?.ventas ?? 1500000, min: 0 },
      {
        id: 'periodo', tipo: 'opcion', etiqueta: 'Los costos y las ventas son…', valor: periodoCaso in FACTOR ? periodoCaso : 'mensual',
        opciones: [
          { valor: 'mensual', texto: 'Mensuales', ayuda: 'el COPQ anualizado se multiplica por 12' },
          { valor: 'trimestral', texto: 'Trimestrales', ayuda: '× 4' },
          { valor: 'anual', texto: 'Anuales', ayuda: '× 1' },
        ],
      },
      {
        id: 'conceptos', tipo: 'tabla', etiqueta: 'Costos de calidad por concepto',
        columnas: [
          { id: 'categoria', etiqueta: 'Categoría', tipo: 'opcion', opciones: CATEGORIAS.map(({ valor, texto }) => ({ valor, texto })) },
          { id: 'concepto', etiqueta: 'Concepto', tipo: 'texto' },
          { id: 'costo', etiqueta: 'Costo', tipo: 'numero', min: 0 },
        ],
        filas: filasEjemplo, filaNueva: { categoria: 'fallaInterna', concepto: '', costo: NaN }, minFilas: 1, maxFilas: 24,
      },
    ],
    presets: [
      { id: 'arneses', etiqueta: 'Caso: línea de arneses (MXN)', ayuda: 'Costos mensuales de la hoja «COPQ (PAF)» de la plantilla; ventas de 1,500,000 MXN.', valores: { moneda: copq?.moneda ?? 'MXN', ventas: copq?.ventas ?? 1500000, periodo: periodoCaso in FACTOR ? periodoCaso : 'mensual', conceptos: filasEjemplo } },
      { id: 'guia-ej2', etiqueta: 'Guía M1: ejercicio 2', ayuda: 'Prevención 180, evaluación 220, falla interna 340 y falla externa 260 (miles de dólares) con ventas de 8,000: COPQ = 7.5 %.', valores: { moneda: 'miles de USD', ventas: 8000, periodo: 'anual', conceptos: FILAS_GUIA } },
    ],
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Qué categoría pesa más en tu captura? ¿Qué pasaría con el COPQ si duplicaras la prevención y bajaras las fallas a la mitad?',
      '¿Qué costos de falla suelen quedar fuera de los registros (paros, reclamos, tiempo de ingeniería) y cómo cambiaría el COPQ al incluirlos?',
      'El COPQ en manufactura suele ser de 5 % a 20 % de las ventas: ¿dónde queda tu proceso y qué dato necesitarías para confiar en esa cifra?',
      'Si el COPQ se anualiza, ¿qué proyecto de mejora cabría pagar con una reducción de 25 %?',
    ],

    calcular(e) {
      const sumas = { prevencion: 0, evaluacion: 0, fallaInterna: 0, fallaExterna: 0 };
      const cuenta = { prevencion: 0, evaluacion: 0, fallaInterna: 0, fallaExterna: 0 };
      let sinCosto = 0;
      let negativos = 0;
      for (const fila of e.conceptos ?? []) {
        const costo = fila.costo;
        if (!(fila.categoria in sumas)) continue;
        if (!Number.isFinite(costo)) {
          if ((fila.concepto ?? '').trim()) sinCosto += 1; // fila con nombre pero sin costo
          continue;
        }
        if (costo < 0) { negativos += 1; continue; }
        sumas[fila.categoria] += costo;
        cuenta[fila.categoria] += 1;
      }
      const registros = Object.values(cuenta).reduce((s, n) => s + n, 0);
      if (registros === 0) {
        return { vacio: 'Captura al menos un concepto con su costo para calcular el COGQ, el COPQ y el COQ.', semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Sin costos capturados.' }] };
      }
      const aviso = [];
      if (sinCosto) aviso.push(`${sinCosto} concepto(s) sin costo numérico no se incluyeron en el cálculo.`);
      if (negativos) aviso.push(`${negativos} concepto(s) con costo negativo no se incluyeron: captura los costos como cantidades positivas.`);

      const moneda = (e.moneda ?? '').trim();
      const din = (v) => `${entero(v)}${moneda ? ` ${moneda}` : ''}`;
      const q = costoCalidad({ ...sumas, ventas: e.ventas });
      const factor = FACTOR[e.periodo] ?? 1;
      const hayVentas = Number.isFinite(q.copqSobreVentas);

      const salidas = [
        ...CATEGORIAS.map((c) => ({ id: c.valor, etiqueta: c.texto, valor: din(sumas[c.valor]), pequeno: true, nota: `${cuenta[c.valor]} concepto(s)` })),
        { id: 'cogq', etiqueta: 'Costo de la buena calidad (COGQ)', valor: din(q.cogq), nota: 'prevención + evaluación' },
        { id: 'copq', etiqueta: 'Costo de la mala calidad (COPQ)', valor: din(q.copq), color: 'teal', nota: 'falla interna + falla externa' },
        { id: 'coq', etiqueta: 'Costo total de calidad (COQ)', valor: din(q.coq), nota: 'COGQ + COPQ' },
        { id: 'copq-ventas', etiqueta: 'COPQ como % de las ventas', valor: hayVentas ? pct(q.copqSobreVentas, 2) : '—', color: 'azul', nota: hayVentas ? 'COPQ ÷ ventas' : 'captura las ventas' },
        { id: 'coq-ventas', etiqueta: 'COQ como % de las ventas', valor: hayVentas ? pct(q.coqSobreVentas, 2) : '—', nota: 'COQ ÷ ventas' },
        { id: 'copq-anual', etiqueta: 'COPQ anualizado', valor: din(q.copq * factor), nota: factor === 1 ? 'los datos ya son anuales' : `COPQ × ${factor}` },
        { id: 'relacion', etiqueta: 'COGQ por cada unidad de COPQ', valor: num(q.relacionBuenaMala, 2), nota: 'COGQ ÷ COPQ; menos de 1 = las fallas pesan más' },
        { id: 'fallas-coq', etiqueta: 'Fallas como % del COQ', valor: pct(q.fallasSobreCoq, 1), nota: 'COPQ ÷ COQ' },
      ];

      const semaforos = [];
      if (!hayVentas) {
        semaforos.push({ nombre: 'COPQ / ventas', estado: 'sin-datos', texto: 'Captura las ventas del periodo (mayores que cero) para compararlas con el rango de la guía.' });
      } else if (q.copqSobreVentas <= 0.05) {
        semaforos.push({ nombre: 'COPQ / ventas', estado: 'cumple', texto: `${pct(q.copqSobreVentas, 2)} de las ventas: por debajo del 5 % a 20 % habitual en manufactura.` });
      } else if (q.copqSobreVentas <= 0.2) {
        semaforos.push({ nombre: 'COPQ / ventas', estado: 'atencion', texto: `${pct(q.copqSobreVentas, 2)} de las ventas: dentro del 5 % a 20 % habitual en manufactura.` });
      } else {
        semaforos.push({ nombre: 'COPQ / ventas', estado: 'critico', texto: `${pct(q.copqSobreVentas, 2)} de las ventas: por encima del 20 % habitual (hasta 35 % en los casos más débiles).` });
      }
      semaforos.push(
        q.copq > q.cogq
          ? { nombre: 'Estructura del COQ', estado: 'atencion', texto: `Las fallas (${din(q.copq)}) superan a la prevención y la evaluación (${din(q.cogq)}).` }
          : { nombre: 'Estructura del COQ', estado: 'cumple', texto: 'La prevención y la evaluación pesan igual o más que las fallas.' }
      );
      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((fila, i) => ({ ...fila, activa: [hayVentas && q.copqSobreVentas <= 0.05, hayVentas && q.copqSobreVentas > 0.05 && q.copqSobreVentas <= 0.2, hayVentas && q.copqSobreVentas > 0.2, q.copq > q.cogq][i] })),
      };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Revisa que no falte ningún costo de falla y que ventas y costos cubran el mismo periodo.' };

      const nombres = CATEGORIAS.map((c) => c.texto);
      const valores = CATEGORIAS.map((c) => sumas[c.valor]);
      const graficas = [
        {
          id: 'categorias', titulo: `Costo por categoría${moneda ? ` (${moneda})` : ''}`,
          datos: [trazaBarras(nombres, valores, { colores: CATEGORIAS.map((c) => c.color), texto: valores.map((v) => entero(v)), mostrarLeyenda: false })],
          layout: { yaxis: { rangemode: 'tozero', tickformat: ',d' }, showlegend: false },
          respaldo: { columnas: ['Categoría', 'Costo'], filas: CATEGORIAS.map((c) => [c.texto, entero(sumas[c.valor])]) },
        },
        {
          id: 'buena-mala', titulo: 'Buena calidad frente a mala calidad',
          datos: [trazaBarras(['COGQ', 'COPQ'], [q.cogq, q.copq], { colores: [COLOR.teal, COLOR.coral], texto: [entero(q.cogq), entero(q.copq)], mostrarLeyenda: false })],
          layout: { yaxis: { rangemode: 'tozero', tickformat: ',d' }, showlegend: false },
          respaldo: { columnas: ['Concepto', 'Costo'], filas: [['COGQ (prevención + evaluación)', entero(q.cogq)], ['COPQ (falla interna + externa)', entero(q.copq)]] },
        },
      ];

      const filas = CATEGORIAS.map((c) => [
        c.texto,
        { texto: String(cuenta[c.valor]), num: true },
        { texto: entero(sumas[c.valor]), num: true, formula: true },
        { texto: q.coq > 0 ? pct(sumas[c.valor] / q.coq, 1) : '—', num: true, formula: true },
        { texto: hayVentas ? pct(sumas[c.valor] / e.ventas, 2) : '—', num: true, formula: true },
      ]);
      filas.push(['Total (COQ)', { texto: String(registros), num: true }, { texto: entero(q.coq), num: true, formula: true }, { texto: q.coq > 0 ? '100.0 %' : '—', num: true, formula: true }, { texto: hayVentas ? pct(q.coqSobreVentas, 2) : '—', num: true, formula: true }]);
      const tablas = [
        {
          titulo: 'Costos por categoría (modelo PAF)',
          columnas: ['Categoría', { t: 'Conceptos', num: true }, { t: `Costo${moneda ? ` (${moneda})` : ''}`, num: true }, { t: '% del COQ', num: true }, { t: '% de ventas', num: true }],
          filas, resaltar: [4],
          pie: 'COGQ = prevención + evaluación · COPQ = falla interna + falla externa · COQ = COGQ + COPQ.',
        },
      ];

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
