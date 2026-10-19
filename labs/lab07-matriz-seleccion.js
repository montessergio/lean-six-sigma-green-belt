/**
 * LAB 07 · Matriz de selección ponderada
 *
 * Guía: M2 §5 (matriz de priorización ponderada) y M2 §6 (tres proyectos candidatos: 4.40 · 3.00 · 2.75),
 * ejercicio 1 del M2 (X = 3.95 frente a Y = 4.20). Plantilla Excel «Matriz de Seleccion»:
 *   puntaje = Σ peso × calificación, los pesos deben sumar 100 % y el orden es RANK (los empates comparten lugar).
 * Escala de calificación: 1 a 5. Los pesos se capturan en puntos porcentuales (40, no 0.4).
 *
 * Presets: `libro` (M2 §6), `excel` (plantilla, 4 criterios) y `ejercicio1` (M2, 5 criterios).
 */
import { corto, num } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { puntajePonderado, rangos } from '../js/lib/stats.js';
import { trazaBarras } from '../js/lib/graficas.js';

const MAX_CRITERIOS = 6;
const MARGEN_MINIMO = 0.25; // referencia didáctica
const COLORES = [COLOR.teal, COLOR.azul, COLOR.ambar, COLOR.violeta, COLOR.coral, COLOR.verde];
const redondea = (x) => Math.round(x * 1e6) / 1e6;
const t = (v) => String(v ?? '').trim();

/** Tres proyectos candidatos de la guía (M2 §6), por si el caso no está disponible. */
const MATRIZ_LIBRO = {
  criterios: [{ nombre: 'Impacto en el cliente', peso: 0.4 }, { nombre: 'Beneficio financiero', peso: 0.35 }, { nombre: 'Factibilidad', peso: 0.25 }],
  opciones: [
    { nombre: 'A. Línea de arneses', calificaciones: [5, 4, 4] },
    { nombre: 'B. Cambio de modelo (gabinetes)', calificaciones: [3, 3, 3] },
    { nombre: 'C. Facturación a proveedores', calificaciones: [2, 2, 5] },
  ],
};

/** Ejercicio 1 del M2: cinco criterios y dos proyectos. */
const MATRIZ_EJ1 = {
  criterios: [{ nombre: 'Impacto en el cliente', peso: 0.3 }, { nombre: 'Beneficio financiero', peso: 0.25 }, { nombre: 'Alineación estratégica', peso: 0.2 }, { nombre: 'Factibilidad', peso: 0.15 }, { nombre: 'Riesgo', peso: 0.1 }],
  opciones: [{ nombre: 'Proyecto X', calificaciones: [4, 5, 3, 4, 3] }, { nombre: 'Proyecto Y', calificaciones: [5, 3, 4, 5, 4] }],
};

/** Del formato del caso (pesos como fracción, calificaciones en arreglo) al estado del laboratorio. */
function aEstado(matriz) {
  return {
    criterios: matriz.criterios.map((c) => ({ nombre: c.nombre, peso: redondea(c.peso * 100) })),
    opciones: matriz.opciones.map((o) => {
      const fila = { nombre: o.nombre };
      o.calificaciones.forEach((v, i) => { fila[`c${i + 1}`] = v; });
      return fila;
    }),
  };
}

const nombreCriterio = (estado, i) => t(estado.criterios?.[i]?.nombre) || `Criterio ${i + 1}`;

const UMBRAL = {
  titulo: 'Criterios de interpretación (guía M2 §5 y plantilla «Matriz de Seleccion»)',
  filas: [
    { rango: 'Pesos = 100 %', texto: 'los pesos suman exactamente 100 %; si no, la matriz no es comparable (plantilla Excel)' },
    { rango: 'Calificaciones de 1 a 5', texto: 'cada opción se califica en cada criterio con la misma escala' },
    { rango: `Margen ≥ ${MARGEN_MINIMO.toFixed(2)} puntos`, texto: 'una ventaja menor se considera pequeña: factores que la matriz no captura (capital, ventanas de mantenimiento) pueden decidir (guía M2, pregunta 4; el valor 0.25 es referencia didáctica)' },
    { rango: 'Mismo ganador con pesos iguales', texto: 'si el primer lugar cambia al igualar los pesos, la decisión depende de los pesos y conviene discutirlos antes de decidir' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto: 'Los pesos y las calificaciones los fija el equipo con evidencia (datos, VOC) y de forma independiente antes de compararlos. Los criterios no se traslapan: dos criterios que miden lo mismo cuentan doble. La escala de 1 a 5 es ordinal: una diferencia pequeña de puntaje no es concluyente.',
};

export default function lab07(ctx = {}) {
  const libro = aEstado(ctx.caso?.matriz?.libro ?? MATRIZ_LIBRO);
  const excel = aEstado(ctx.caso?.matriz?.excel ?? ctx.caso?.matriz?.libro ?? MATRIZ_LIBRO);
  const ej1 = aEstado(MATRIZ_EJ1);
  const celdaVacia = Object.fromEntries(Array.from({ length: MAX_CRITERIOS }, (_, i) => [`c${i + 1}`, NaN]));

  return {
    id: 'lab07',
    numero: '07',
    modulo: 'M2',
    titulo: 'Matriz de selección ponderada',
    resumen: 'Pondera criterios, califica cada opción del 1 al 5 y obtén el puntaje, el orden, el margen entre el primero y el segundo, y qué tan estable es la decisión si todos los pesos fueran iguales.',
    panelAncho: true,
    entradas: [
      {
        id: 'criterios', tipo: 'tabla', etiqueta: 'Criterios y pesos (puntos porcentuales; deben sumar 100)',
        columnas: [
          { id: 'nombre', etiqueta: 'Criterio', tipo: 'texto' },
          { id: 'peso', etiqueta: 'Peso (%)', tipo: 'numero', min: 0, max: 100, ancho: 90 },
        ],
        filas: libro.criterios, filaNueva: { nombre: '', peso: NaN }, minFilas: 2, maxFilas: MAX_CRITERIOS,
      },
      {
        id: 'opciones', tipo: 'tabla', etiqueta: 'Opciones y calificaciones (1 a 5)',
        columnas: (estado) => [
          { id: 'nombre', etiqueta: 'Opción', tipo: 'texto' },
          ...Array.from({ length: Math.min(MAX_CRITERIOS, estado.criterios?.length ?? 0) }, (_, i) => ({
            id: `c${i + 1}`, etiqueta: (est) => nombreCriterio(est, i), tipo: 'numero', min: 1, max: 5, ancho: 90,
          })),
        ],
        filas: libro.opciones, filaNueva: { nombre: '', ...celdaVacia }, minFilas: 2, maxFilas: 8,
      },
    ],
    presets: [
      { id: 'libro', etiqueta: 'Guía M2 §6: tres proyectos', ayuda: 'Pesos 40/35/25. A. Línea de arneses 4.40 · B. Cambio de modelo 3.00 · C. Facturación a proveedores 2.75.', valores: { criterios: libro.criterios, opciones: libro.opciones } },
      { id: 'excel', etiqueta: 'Plantilla Excel: cuatro criterios', ayuda: 'Hoja «Matriz de Seleccion»: pesos 40/25/20/15 y tres opciones de mejora.', valores: { criterios: excel.criterios, opciones: excel.opciones } },
      { id: 'ejercicio1', etiqueta: 'Guía M2, ejercicio 1: X frente a Y', ayuda: 'Cinco criterios (30/25/20/15/10): el proyecto X obtiene 3.95 y el Y, 4.20.', valores: { criterios: ej1.criterios, opciones: ej1.opciones } },
    ],
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Qué pasa con el orden si cambias el peso del criterio dominante en 10 puntos? ¿Qué peso lo haría cambiar de ganador?',
      '¿Quién fijó los pesos y con qué evidencia? Si dos evaluadores califican por separado, ¿coincidirá el orden aunque los puntajes difieran?',
      'Si el margen entre el primero y el segundo es pequeño, ¿qué información fuera de la matriz pedirías antes de decidir?',
      '¿Algún criterio se traslapa con otro (por ejemplo, beneficio financiero y ahorro)? ¿Qué cambiaría si lo unes en uno solo?',
    ],

    calcular(e) {
      const crit = (Array.isArray(e.criterios) ? e.criterios : []).slice(0, MAX_CRITERIOS);
      const n = crit.length;
      const nombres = crit.map((c, i) => t(c.nombre) || `Criterio ${i + 1}`);
      const pesosPct = crit.map((c) => (Number.isFinite(c.peso) && c.peso >= 0 ? c.peso : NaN));
      const w = pesosPct.map((p) => (Number.isFinite(p) ? p / 100 : 0));
      const wIguales = crit.map(() => 1 / Math.max(1, n));
      const hayPesos = pesosPct.some(Number.isFinite);
      const suma = pesosPct.reduce((s, p) => s + (Number.isFinite(p) ? p : 0), 0);

      const opciones = (Array.isArray(e.opciones) ? e.opciones : [])
        .map((o, idx) => ({
          nombre: t(o.nombre) || `Opción ${idx + 1}`,
          tieneNombre: Boolean(t(o.nombre)),
          cal: crit.map((_, i) => (Number.isFinite(o[`c${i + 1}`]) ? o[`c${i + 1}`] : NaN)),
        }))
        .filter((o) => o.tieneNombre || o.cal.some(Number.isFinite));

      const sinDatos = (texto) => ({
        vacio: texto,
        semaforos: ['Suma de pesos', 'Calificaciones', 'Margen entre 1.º y 2.º', 'Ranking con pesos iguales'].map((nombre) => ({ nombre, estado: 'sin-datos', texto: 'Sin datos capturados.' })),
      });
      if (!hayPesos) return sinDatos('Captura los criterios con su peso en puntos porcentuales (deben sumar 100).');
      if (!opciones.some((o) => o.cal.some(Number.isFinite))) return sinDatos('Captura al menos una opción con sus calificaciones de 1 a 5.');

      const aviso = [];
      if (suma > 0 && suma <= 1.0001) aviso.push('Los pesos se capturan en puntos porcentuales (por ejemplo 40, no 0.4): con estos valores la suma es menor que 2 %.');

      const puntajes = opciones.map((o) => puntajePonderado(w, o.cal));
      const rangoPond = rangos(puntajes);
      const puntajesIg = opciones.map((o) => puntajePonderado(wIguales, o.cal));
      const rangoIg = rangos(puntajesIg);
      const idxGanadores = rangoPond.flatMap((r, i) => (r === 1 ? [i] : []));
      const idxGanadoresIg = rangoIg.flatMap((r, i) => (r === 1 ? [i] : []));
      const ordenados = puntajes.filter(Number.isFinite).sort((a, b) => b - a);
      const margen = ordenados.length >= 2 ? ordenados[0] - ordenados[1] : NaN;
      const nombresGan = idxGanadores.map((i) => opciones[i].nombre);

      const salidas = [
        { id: 'ganador', etiqueta: 'Opción priorizada', valor: nombresGan.join(' / ') || '—', color: 'teal', ancha: true, nota: idxGanadores.length > 1 ? 'empate en el primer lugar' : 'mayor puntaje ponderado' },
        { id: 'puntaje-ganador', etiqueta: 'Puntaje de la opción priorizada', valor: ordenados.length ? num(ordenados[0], 2) : '—', color: 'azul', nota: 'Σ peso × calificación' },
        { id: 'margen', etiqueta: 'Margen entre 1.º y 2.º', valor: Number.isFinite(margen) ? num(margen, 2) : '—', nota: 'en puntos de la escala 1–5' },
        { id: 'suma-pesos', etiqueta: 'Suma de pesos', valor: `${corto(suma)} %`, nota: 'debe ser 100 %' },
        ...opciones.map((o, i) => ({ id: `puntaje-${i + 1}`, etiqueta: o.nombre, valor: Number.isFinite(puntajes[i]) ? num(puntajes[i], 2) : '—', pequeno: true, nota: Number.isFinite(rangoPond[i]) ? `orden ${rangoPond[i]}` : 'sin calificaciones' })),
      ];

      /* Semáforos */
      const semaforos = [];
      semaforos.push(Math.abs(suma - 100) < 1e-6
        ? { nombre: 'Suma de pesos', estado: 'cumple', texto: 'Los pesos suman 100 %.' }
        : { nombre: 'Suma de pesos', estado: 'critico', texto: `Los pesos suman ${corto(suma)} %: deben sumar 100 %. Los puntajes se calcularon con los pesos tal como están capturados.` });

      const faltan = [];
      const fuera = [];
      opciones.forEach((o) => o.cal.forEach((c, i) => {
        if (!Number.isFinite(c)) faltan.push(`${o.nombre} · ${nombres[i]}`);
        else if (c < 1 || c > 5) fuera.push(`${o.nombre} · ${nombres[i]} (${corto(c)})`);
      }));
      if (faltan.length || fuera.length) {
        const partes = [];
        if (faltan.length) partes.push(`sin calificar: ${faltan.slice(0, 4).join('; ')}${faltan.length > 4 ? `… (${faltan.length} en total)` : ''}`);
        if (fuera.length) partes.push(`fuera de la escala 1–5: ${fuera.slice(0, 4).join('; ')}${fuera.length > 4 ? '…' : ''}`);
        semaforos.push({ nombre: 'Calificaciones', estado: 'atencion', texto: `${partes.join('. ')}.` });
      } else {
        semaforos.push({ nombre: 'Calificaciones', estado: 'cumple', texto: 'Todas las opciones están calificadas de 1 a 5 en todos los criterios.' });
      }

      if (idxGanadores.length > 1) {
        semaforos.push({ nombre: 'Margen entre 1.º y 2.º', estado: 'atencion', texto: `Empate en el primer lugar entre ${nombresGan.join(' y ')}: la matriz no decide por sí sola.` });
      } else if (!Number.isFinite(margen)) {
        semaforos.push({ nombre: 'Margen entre 1.º y 2.º', estado: 'informativo', texto: 'Se necesitan al menos dos opciones calificadas para medir el margen.' });
      } else if (margen < MARGEN_MINIMO - 1e-9) {
        semaforos.push({ nombre: 'Margen entre 1.º y 2.º', estado: 'atencion', texto: `Ventaja de ${num(margen, 2)} puntos: pequeña (referencia didáctica: menos de ${MARGEN_MINIMO.toFixed(2)}). Factores fuera de la matriz pueden decidir.` });
      } else {
        semaforos.push({ nombre: 'Margen entre 1.º y 2.º', estado: 'cumple', texto: `Ventaja de ${num(margen, 2)} puntos sobre la segunda opción.` });
      }

      const unicoGan = idxGanadores.length === 1 ? idxGanadores[0] : -1;
      if (unicoGan < 0) {
        semaforos.push({ nombre: 'Ranking con pesos iguales', estado: 'sin-datos', texto: 'No hay un único primer lugar con los pesos del equipo para comparar.' });
      } else if (idxGanadoresIg.length === 1 && idxGanadoresIg[0] === unicoGan) {
        semaforos.push({ nombre: 'Ranking con pesos iguales', estado: 'cumple', texto: `Con ${corto(100 / n, 1)} % para cada criterio sigue ganando ${opciones[unicoGan].nombre}.` });
      } else if (idxGanadoresIg.includes(unicoGan)) {
        semaforos.push({ nombre: 'Ranking con pesos iguales', estado: 'atencion', texto: `Con pesos iguales ${opciones[unicoGan].nombre} empata en el primer lugar con ${idxGanadoresIg.filter((i) => i !== unicoGan).map((i) => opciones[i].nombre).join(' y ')}: la ventaja depende de los pesos.` });
      } else {
        semaforos.push({ nombre: 'Ranking con pesos iguales', estado: 'atencion', texto: `Con pesos iguales el primer lugar pasa a ${idxGanadoresIg.map((i) => opciones[i].nombre).join(' / ')}: la decisión depende de los pesos que fijaste.` });
      }

      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((fila, i) => ({
          ...fila,
          activa: [Math.abs(suma - 100) < 1e-6, !faltan.length && !fuera.length, Number.isFinite(margen) && margen >= MARGEN_MINIMO - 1e-9 && idxGanadores.length === 1, unicoGan >= 0 && idxGanadoresIg.length === 1 && idxGanadoresIg[0] === unicoGan][i],
        })),
      };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Antes de comparar puntajes, compara las calificaciones de evaluadores distintos criterio por criterio.' };

      /* Gráficas */
      const nombresOp = opciones.map((o) => o.nombre);
      const aportes = nombres.map((_, i) => opciones.map((o) => (Number.isFinite(o.cal[i]) ? w[i] * o.cal[i] : 0)));
      const graficas = [
        {
          id: 'aportes', titulo: 'Aporte de cada criterio al puntaje',
          datos: nombres.map((nom, i) => trazaBarras(nombresOp, aportes[i].map(redondea), { nombre: nom, color: COLORES[i % COLORES.length] })),
          layout: { barmode: 'stack', yaxis: { rangemode: 'tozero', range: [0, 5.2], title: { text: 'Puntaje ponderado (máx. 5)' } } },
          respaldo: { columnas: ['Opción', ...nombres, 'Puntaje'], filas: opciones.map((o, i) => [o.nombre, ...nombres.map((_, k) => num(aportes[k][i], 2)), Number.isFinite(puntajes[i]) ? num(puntajes[i], 2) : '—']) },
        },
        {
          id: 'sensibilidad', titulo: 'Sensibilidad: pesos del equipo frente a pesos iguales',
          datos: [
            trazaBarras(nombresOp, puntajes.map((p) => (Number.isFinite(p) ? redondea(p) : 0)), { nombre: 'Pesos del equipo', color: COLOR.teal }),
            trazaBarras(nombresOp, puntajesIg.map((p) => (Number.isFinite(p) ? redondea(p) : 0)), { nombre: 'Pesos iguales', color: COLOR.gris }),
          ],
          layout: { barmode: 'group', yaxis: { rangemode: 'tozero', range: [0, 5.2] } },
          respaldo: { columnas: ['Opción', 'Pesos del equipo', 'Pesos iguales'], filas: opciones.map((o, i) => [o.nombre, Number.isFinite(puntajes[i]) ? num(puntajes[i], 2) : '—', Number.isFinite(puntajesIg[i]) ? num(puntajesIg[i], 2) : '—']) },
        },
      ];

      /* Tablas */
      const celdaCal = (c) => ({ texto: Number.isFinite(c) ? corto(c) : '—', num: true });
      const tablas = [
        {
          titulo: 'Puntaje ponderado',
          columnas: ['Opción', ...nombres.map((nom, i) => ({ t: `${nom} (${corto(pesosPct[i])} %)`, num: true })), { t: 'Puntaje', num: true }, { t: 'Orden', num: true }],
          filas: opciones.map((o, i) => [o.nombre, ...o.cal.map(celdaCal), { texto: Number.isFinite(puntajes[i]) ? num(puntajes[i], 2) : '—', num: true, formula: true }, { texto: Number.isFinite(rangoPond[i]) ? String(rangoPond[i]) : '—', num: true, formula: true }]),
          resaltar: idxGanadores,
          pie: 'Puntaje = Σ (peso × calificación). El orden comparte lugar en los empates, igual que RANK en Excel.',
        },
        {
          titulo: `Sensibilidad: ${corto(100 / Math.max(1, n), 1)} % para cada criterio`,
          columnas: ['Opción', { t: 'Pesos del equipo', num: true }, { t: 'Pesos iguales', num: true }, { t: 'Orden con pesos iguales', num: true }, 'Cambio de orden'],
          filas: opciones.map((o, i) => [
            o.nombre,
            { texto: Number.isFinite(puntajes[i]) ? num(puntajes[i], 2) : '—', num: true },
            { texto: Number.isFinite(puntajesIg[i]) ? num(puntajesIg[i], 2) : '—', num: true, formula: true },
            { texto: Number.isFinite(rangoIg[i]) ? String(rangoIg[i]) : '—', num: true, formula: true },
            Number.isFinite(rangoIg[i]) && Number.isFinite(rangoPond[i]) && rangoIg[i] !== rangoPond[i] ? { texto: `${rangoPond[i]} → ${rangoIg[i]}`, estado: 'atencion' } : { texto: 'sin cambio', estado: 'cumple' },
          ]),
          resaltar: idxGanadoresIg,
        },
      ];

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
