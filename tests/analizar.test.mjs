/**
 * Pruebas de js/lib/analizar.js (fase Analizar). Los valores esperados salen de SciPy/NumPy (tests/referencias-scipy.json,
 * generado por tools/generar-referencias.py), de las cifras de la guía (M6 y M7) y de las plantillas Excel, o de cuentas
 * hechas a mano y escritas como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as A from '../js/lib/analizar.js';

const ref = JSON.parse(readFileSync(new URL('./referencias-scipy.json', import.meta.url), 'utf8'));

function cerca(actual, esperado, { rel = 1e-9, abs = 1e-12 } = {}, etiqueta = '') {
  const tol = Math.max(abs, rel * Math.abs(esperado));
  assert.ok(Math.abs(actual - esperado) <= tol, `${etiqueta} obtenido ${actual}, esperado ${esperado} (|Δ|=${Math.abs(actual - esperado)} > tol ${tol})`);
}
const filas = (...pares) => pares.map(([categoria, frecuencia]) => ({ categoria, frecuencia }));
const porcentajes = (r) => r.categorias.map((c) => Math.round(c.pct * 1000) / 10);
const acumulados = (r) => r.categorias.map((c) => Math.round(c.acum * 1000) / 10);

/* ------------------------------------------------------------------ */
/* Pareto                                                              */
/* ------------------------------------------------------------------ */

test('Pareto: arneses de la guía M6 §1 (25 defectos en ocho semanas) → 84 % con tres categorías', () => {
  const r = A.pareto(filas(['Continuidad eléctrica', 10], ['Etiquetado', 7], ['Torque fuera de especificación', 4], ['Conector mal asentado', 3], ['Ruteo', 1]));
  assert.equal(r.total, 25);
  assert.deepEqual(r.categorias.map((c) => c.categoria), ['Continuidad eléctrica', 'Etiquetado', 'Torque fuera de especificación', 'Conector mal asentado', 'Ruteo']);
  assert.deepEqual(porcentajes(r), [40, 28, 16, 12, 4]);
  assert.deepEqual(acumulados(r), [40, 68, 84, 96, 100]);
  assert.deepEqual(r.categorias.map((c) => c.vital), [true, true, true, false, false]);
  assert.equal(r.nVitales, 3);
  cerca(r.pctVitales, 0.84);
  cerca(r.pctCategoriasVitales, 0.6);
  assert.equal(r.categorias.at(-1).acum, 1);
});

test('Pareto: tickets de soporte de la guía (Ej. 1) → 88 % con tres categorías y «Otros» al final', () => {
  const r = A.pareto(filas(['Problemas de acceso', 45], ['Lentitud del sistema', 28], ['Errores de sincronización', 15], ['Errores de interfaz', 8], ['Otros', 4]));
  assert.deepEqual(acumulados(r), [45, 73, 88, 96, 100]);
  assert.equal(r.nVitales, 3);
  cerca(r.pctVitales, 0.88);
  assert.equal(r.categorias[0].categoria, 'Problemas de acceso');
  assert.equal(r.otros.frecuencia, 4);
  assert.equal(r.otros.mayorQueNombradas, false);
});

test('Pareto: pregunta 7 del examen (45 · 20 · 15 · 10 · 10) → A + B = 65 % y el 80 % exacto cierra las vitales', () => {
  const r = A.pareto(filas(['A', 45], ['B', 20], ['C', 15], ['D', 10], ['E', 10]));
  assert.deepEqual(acumulados(r), [45, 65, 80, 90, 100]);
  // C llega justo al 80 %: es vital (el acumulado antes de sumarla era 65 %) y D ya es trivial
  assert.deepEqual(r.categorias.map((c) => c.vital), [true, true, true, false, false]);
  assert.equal(r.nVitales, 3);
  cerca(r.pctVitales, 0.8);
});

test('Pareto: ejemplo de la plantilla Excel (100 registros) → 42 / 67 / 82 / 91 / 97 / 100 %', () => {
  const r = A.pareto(filas(['Herramienta descalibrada', 42], ['Sin verificación al inicio de turno', 25], ['Método de apriete inconsistente', 15], ['Capacitación incompleta', 9], ['Variación de material', 6], ['Otros', 3]));
  assert.equal(r.total, 100);
  assert.deepEqual(acumulados(r), [42, 67, 82, 91, 97, 100]);
  assert.deepEqual(r.categorias.map((c) => c.vital), [true, true, true, false, false, false]);
  cerca(r.pctVitales, 0.82);
});

test('Pareto: ordena de mayor a menor, los empates siguen el orden de captura y «Otro(s)» va al final aunque sea el mayor', () => {
  const r = A.pareto(filas(['Otro', 30], ['A', 5], ['B', 5], ['C', 20], ['D', 5]));
  assert.deepEqual(r.categorias.map((c) => c.categoria), ['C', 'A', 'B', 'D', 'Otro']);
  assert.equal(r.otros.mayorQueNombradas, true); // «Otro» (30) reúne más que la mayor categoría con nombre (20)
  cerca(r.otros.pct, 30 / 65);
});

test('Pareto: una categoría sola o ≥ 80 % deja una vital; el umbral es configurable', () => {
  assert.equal(A.pareto(filas(['A', 90], ['B', 10])).nVitales, 1);
  assert.equal(A.pareto(filas(['Única', 7])).nVitales, 1);
  const r = A.pareto(filas(['A', 50], ['B', 30], ['C', 20]));
  assert.equal(r.nVitales, 2); // 50 % + 30 % llegan justo al 80 %: la tercera ya es trivial
  assert.equal(A.pareto(filas(['A', 50], ['B', 30], ['C', 20]), { umbral: 0.9 }).nVitales, 3);
  assert.equal(A.pareto(filas(['A', 50], ['B', 30], ['C', 20]), { umbral: 0.5 }).nVitales, 1);
});

test('Pareto: filas vacías, con frecuencia 0, negativa o ausente, sin nombre y repetidas', () => {
  const r = A.pareto([
    { categoria: '', frecuencia: NaN }, // vacía: se ignora sin avisar
    { categoria: 'Cero', frecuencia: 0 },
    { categoria: 'Negativa', frecuencia: -2 },
    { categoria: 'Sin número', frecuencia: NaN },
    { categoria: '', frecuencia: 4 },
    { categoria: 'A', frecuencia: 6 },
    { categoria: 'A', frecuencia: 3 },
  ]);
  assert.deepEqual(r.descartadas, { ceros: 1, negativas: 1, sinFrecuencia: 1 });
  assert.equal(r.sinNombre, 1);
  assert.equal(r.repetidas, true);
  assert.deepEqual(r.categorias.map((c) => c.etiqueta), ['A', '(sin nombre)', 'A (2)']);
  assert.equal(r.total, 13);
  assert.equal(A.pareto([]).valido, false);
  assert.equal(A.pareto(filas(['X', 0])).valido, false);
});

test('Pareto: frecuencias decimales (costos) y acumulado que llega a 1 sin error de redondeo', () => {
  const r = A.pareto(filas(['A', 0.1], ['B', 0.2], ['C', 0.3], ['D', 0.4]));
  assert.deepEqual(r.categorias.map((c) => c.categoria), ['D', 'C', 'B', 'A']);
  assert.equal(r.categorias.at(-1).acum, 1);
  // 0.4 + 0.3 + 0.2 = 0.9 ≥ 80 % después de la tercera: vitales D, C, B
  assert.equal(r.nVitales, 3);
});

/* ------------------------------------------------------------------ */
/* Ishikawa y 5 Porqués                                                */
/* ------------------------------------------------------------------ */

const ISHIKAWA_EXCEL = [
  ['Mano de obra', 'Turno 3 con menor experiencia', 5], ['Mano de obra', 'Capacitación incompleta en torque', 6],
  ['Método', 'Sin verificación de torque al inicio de turno', 9], ['Método', 'Secuencia de apriete inconsistente', 4],
  ['Máquina', 'Torquímetro descalibrado', 8], ['Máquina', 'Desgaste de herramienta', 3],
  ['Material', 'Variación de terminales', 2],
  ['Medición', 'Resolución del instrumento mayor que el rango', 7], ['Medición', 'Sin patrón de verificación', 5],
  ['Medio ambiente', 'Iluminación deficiente en T3', 2],
].map(([categoria, causa, votos]) => ({ categoria, causa, votos }));

test('Ishikawa: ejemplo de la plantilla Excel → 10 causas, 51 votos y la causa más votada por categoría', () => {
  const r = A.resumenIshikawa(ISHIKAWA_EXCEL);
  assert.equal(r.nCausas, 10);
  assert.equal(r.votosTotal, 51);
  const por = Object.fromEntries(r.porCategoria.map((c) => [c.categoria, [c.nCausas, c.votos, c.top, c.topVotos]]));
  assert.deepEqual(por, {
    'Mano de obra': [2, 11, 'Capacitación incompleta en torque', 6],
    Método: [2, 13, 'Sin verificación de torque al inicio de turno', 9],
    Máquina: [2, 11, 'Torquímetro descalibrado', 8],
    Material: [1, 2, 'Variación de terminales', 2],
    Medición: [2, 12, 'Resolución del instrumento mayor que el rango', 7],
    'Medio ambiente': [1, 2, 'Iluminación deficiente en T3', 2],
  });
  assert.deepEqual(r.ordenadas.slice(0, 3).map((c) => c.votos), [9, 8, 7]);
  assert.deepEqual(r.categoriasVacias, []);
});

test('Ishikawa: las 10 causas de la guía M6 §2 (sin votos), categorías vacías y votos inválidos', () => {
  const guia = [
    ['Mano de obra', 'Capacitación insuficiente en técnica de engarzado'], ['Mano de obra', 'Alta rotación en el turno nocturno'],
    ['Máquina', 'Prensa de engarzado sin mantenimiento preventivo al día'],
    ['Material', 'Lote de terminales fuera de especificación'], ['Material', 'Aislamiento de cable dañado en el carrete'],
    ['Método', 'Instrucción de trabajo sin valor numérico de fuerza de engarzado'], ['Método', 'Sin punto de verificación intermedio'],
    ['Medición', 'Probador de continuidad sin calibración vigente'], ['Medición', 'Criterio de aceptación no estandarizado entre turnos'],
    ['Medio ambiente', 'Variación de temperatura en planta'],
  ].map(([categoria, causa]) => ({ categoria, causa, votos: NaN }));
  const r = A.resumenIshikawa(guia);
  assert.equal(r.nCausas, 10);
  assert.equal(r.votosTotal, 0);
  assert.equal(r.sinVotos, 10);
  assert.equal(r.porCategoria.find((c) => c.categoria === 'Método').top, ''); // sin votos no hay causa más votada

  const parcial = A.resumenIshikawa([
    { categoria: 'Método', causa: 'A', votos: 3 },
    { categoria: 'Método', causa: 'B', votos: 3 }, // empate: gana la primera
    { categoria: 'Máquina', causa: 'C', votos: 2.5 }, // no entero: se cuenta como causa con 0 votos y se avisa
    { categoria: 'Máquina', causa: 'D', votos: -1 },
    { categoria: 'Otra M', causa: 'E', votos: 1 }, // categoría que no es de las 6M
    { categoria: 'Método', causa: '', votos: 4 }, // sin causa: se ignora
  ]);
  assert.equal(parcial.nCausas, 4);
  assert.equal(parcial.votosInvalidos, 2);
  assert.equal(parcial.sinCategoria, 1);
  assert.equal(parcial.porCategoria.find((c) => c.categoria === 'Método').top, 'A');
  assert.deepEqual(parcial.categoriasVacias, ['Mano de obra', 'Material', 'Medición', 'Medio ambiente']);
  assert.equal(A.resumenIshikawa([]).valido, false);
});

test('5 Porqués: estado de la cadena como la plantilla (corta, verificada, pendiente)', () => {
  const f = (respuesta, evidencia, verificada) => ({ respuesta, evidencia, verificada });
  const cadena = [
    f('El conector no se aprieta hasta el valor requerido', 'Mediciones de fuerza por turno', 'Sí'),
    f('El operador no tiene forma de saber cuándo alcanzó el valor', 'Observación en estación; sin indicador', 'Sí'),
    f('El torquímetro no se verifica al inicio del turno', 'Bitácora de verificación sin registros', 'Sí'),
    f('El arranque de turno no incluye la verificación del instrumento', 'Revisión de la instrucción de trabajo', 'Sí'),
    f('El plan de control no define frecuencia ni responsable', 'Revisión del plan de control', 'No'),
  ];
  const r = A.estadoCadena(cadena);
  assert.equal(r.n, 5);
  assert.equal(r.verificadas, 4);
  assert.equal(r.estado, 'pendiente');
  assert.equal(r.texto, 'Pasos sin verificar: 1 de 5.');
  assert.deepEqual(r.personas, []); // «El operador no tiene forma de saber…» habla del sistema, no culpa a nadie
  assert.equal(A.estadoCadena(cadena.map((x) => ({ ...x, verificada: 'Sí' }))).texto, 'Cadena verificada con evidencia en todos los pasos.');
  assert.equal(A.estadoCadena(cadena.slice(0, 2)).texto, 'Cadena corta: sigue preguntando hasta una causa de proceso o sistema.');
  assert.equal(A.estadoCadena([f('', '', 'Sí')]).estado, 'vacia');
  assert.equal(A.estadoCadena([]).n, 0);
  assert.equal(A.estadoCadena([f('Respuesta sin evidencia', '', 'No'), f('Otra', 'x', 'Sí'), f('Tercera', 'y', 'Sí')]).sinEvidencia, 1);
});

test('5 Porqués: detecta frases que culpan a una persona (indicio, sin acentos ni mayúsculas)', () => {
  assert.deepEqual(A.frasesPersona('El operador se equivocó al torquear'), ['se equivocó']);
  assert.deepEqual(A.frasesPersona('NO SE FIJO en la lectura'), ['no se fijó']);
  assert.deepEqual(A.frasesPersona('El técnico se olvidó de calibrar'), ['se olvidó']);
  assert.deepEqual(A.frasesPersona('Hubo descuido y negligencia'), ['descuido', 'negligencia']);
  assert.deepEqual(A.frasesPersona('El operador no tiene forma de saber cuándo alcanzó el valor'), []);
  assert.deepEqual(A.frasesPersona('La instrucción dice «engarzar firmemente», sin valor numérico'), []);
  assert.deepEqual(A.frasesPersona(''), []);
  const cadena = A.estadoCadena([{ respuesta: 'Porque se descuidó', evidencia: '', verificada: 'No' }]);
  assert.deepEqual(cadena.personas, [{ paso: 1, frases: ['se descuidó'] }]);
});

/* ------------------------------------------------------------------ */
/* AMEF y RPN                                                          */
/* ------------------------------------------------------------------ */

test('RPN: cuentas de la guía M6 (192, 54, 42, 210, 70, 168 → 84) y del examen (36, 224, 210, 180 → 60)', () => {
  assert.equal(A.rpn(8, 6, 4), 192);
  assert.equal(A.rpn(9, 2, 3), 54);
  assert.equal(A.rpn(3, 7, 2), 42);
  assert.equal(A.rpn(7, 5, 6), 210);
  assert.equal(A.rpn(7, 5, 2), 70);
  assert.equal(A.rpn(9, 2, 2), 36);
  assert.equal(A.rpn(4, 8, 7), 224);
  assert.equal(A.rpn(6, 7, 5), 210);
  assert.equal(A.rpn(5, 4, 9), 180);
  assert.equal(A.rpn(10, 10, 10), A.RPN_MAXIMO);
  for (const malo of [[0, 5, 5], [11, 5, 5], [5, 5.5, 5], [5, NaN, 5], [5, 5, '5']]) assert.ok(Number.isNaN(A.rpn(...malo)), JSON.stringify(malo));
});

test('RPN: ¿y si mejoramos? Ej. 3 (210 → 70, −67 %), Ej. 6 (168 → 84, −50 %), examen 6 (180 → 60) y reflexión (54 → 18)', () => {
  const ej3 = A.mejoraAmef({ s: 7, o: 5, d: 6 }, { d: 2 });
  assert.equal(ej3.antes, 210);
  assert.equal(ej3.despues, 70);
  cerca(ej3.reduccion, 2 / 3);
  assert.deepEqual(ej3.cambios, [{ factor: 'D', de: 6, a: 2 }]);
  const ej6 = A.mejoraAmef({ s: 7, o: 4, d: 6 }, { d: 3 });
  assert.deepEqual([ej6.antes, ej6.despues, ej6.reduccion], [168, 84, 0.5]);
  const ex6 = A.mejoraAmef({ s: 5, o: 4, d: 9 }, { d: 3 });
  assert.deepEqual([ex6.antes, ex6.despues], [180, 60]);
  assert.equal(A.mejoraAmef({ s: 9, o: 2, d: 3 }, { d: 1 }).despues, 18);
  const sinCambio = A.mejoraAmef({ s: 7, o: 5, d: 6 }, {});
  assert.equal(sinCambio.huboCambio, false);
  assert.equal(sinCambio.reduccion, 0);
  assert.equal(A.mejoraAmef({ s: 7, o: 5, d: 6 }, { d: 11 }).valido, false);
  assert.equal(A.mejoraAmef({ s: 7, o: 5, d: NaN }, { d: 3 }).motivo, 'actual');
});

test('AMEF: cortes del criterio de la guía (< 50 · 50 a 100 · > 100) y del Excel (< 100 · 100 a 199 · ≥ 200)', () => {
  const guia = (v, s = 5) => A.prioridadAmef(s, v, 'guia').nivel;
  assert.deepEqual([49, 50, 100, 101].map((v) => guia(v)), ['bajo', 'revisar', 'revisar', 'accion']);
  const excel = (v, s = 5) => A.prioridadAmef(s, v, 'excel').nivel;
  assert.deepEqual([99, 100, 199, 200].map((v) => excel(v)), ['bajo', 'accion', 'accion', 'inmediata']);
  // S ≥ 9 manda sin importar el RPN, pero se conserva lo que diría el RPN
  const severa = A.prioridadAmef(9, 54, 'guia');
  assert.deepEqual([severa.nivel, severa.severa, severa.porRpn.nivel, severa.etiqueta], ['revision', true, 'revisar', 'Revisión independiente (S ≥ 9)']);
  assert.equal(A.prioridadAmef(9, 180, 'excel').etiqueta, 'Revisar (S≥9)');
  assert.equal(A.prioridadAmef(8, 240, 'excel').etiqueta, 'Acción inmediata');
  assert.equal(A.prioridadAmef(8, 192, 'guia').etiqueta, 'Acción requerida');
  assert.equal(A.prioridadAmef(3, 42, 'guia').etiqueta, 'Bajo: monitorear');
  assert.equal(A.prioridadAmef(5, 120, 'excel').etiqueta, 'Acción');
});

test('AMEF: tres modos de la guía M6 §4 → RPN 192 / 54 / 42, el conector exige revisión y el orden es 192 > 54 > 42', () => {
  const r = A.resumenAmef([
    { paso: 'Engarzado de terminales', modo: 'Fuerza de engarzado insuficiente', efecto: 'Falla de continuidad eléctrica', s: 8, o: 6, d: 4 },
    { paso: 'Ensamble de conectores', modo: 'Conector mal asentado', efecto: 'Desconexión en servicio', s: 9, o: 2, d: 3 },
    { paso: 'Colocación de etiquetado', modo: 'Etiqueta ilegible o mal ubicada', efecto: 'Error de identificación', s: 3, o: 7, d: 2 },
  ]);
  assert.deepEqual(r.filas.map((f) => f.rpn), [192, 54, 42]);
  assert.deepEqual(r.ranking.map((f) => f.rpn), [192, 54, 42]);
  assert.deepEqual(r.filas.map((f) => f.nivel), ['accion', 'revision', 'bajo']);
  assert.equal(r.rpnMax, 192);
  assert.equal(r.nSeveridad, 1);
  assert.deepEqual(r.porRpn, { inmediata: 0, accion: 1, revisar: 1, bajo: 1 }); // por RPN solo: 54 cae en «revisar»
});

test('AMEF: ejemplo de la plantilla Excel (8·5·6, 9·4·5, 5·3·8) con el criterio del Excel', () => {
  const r = A.resumenAmef(
    [
      { paso: 'Atornillado', modo: 'Torque bajo', efecto: 'Conector flojo', causa: 'Herramienta descalibrada', control: 'Verificación inicio de turno', s: 8, o: 5, d: 6 },
      { paso: 'Crimpado', modo: 'Terminal mal crimpada', efecto: 'Circuito abierto', causa: 'Desgaste de aplicador', control: 'Inspección visual', s: 9, o: 4, d: 5 },
      { paso: 'Etiquetado', modo: 'Etiqueta incorrecta', efecto: 'Mezcla de arneses', causa: 'Falta de poka-yoke', control: 'Ninguno', s: 5, o: 3, d: 8 },
    ],
    { criterio: 'excel' }
  );
  assert.deepEqual(r.filas.map((f) => [f.rpn, f.etiqueta]), [[240, 'Acción inmediata'], [180, 'Revisar (S≥9)'], [120, 'Acción']]);
  assert.equal(r.rpnMax, 240);
  assert.equal(r.nSeveridad, 1);
  // los conteos de la plantilla son por RPN: ≥ 200 · 100 a 199 · < 100 (el modo con S = 9 y RPN 180 cuenta en «100 a 199»)
  assert.deepEqual(r.porRpn, { inmediata: 1, accion: 2, revisar: 0, bajo: 0 });
  assert.deepEqual(r.ranking.map((f) => f.modo), ['Torque bajo', 'Terminal mal crimpada', 'Etiqueta incorrecta']);
});

test('AMEF: filas incompletas, calificaciones inválidas, filas vacías y empates por orden de captura', () => {
  const r = A.resumenAmef([
    { modo: 'Vacía' }, // con texto y sin calificaciones: sin RPN
    { s: 5, o: 5, d: NaN, modo: 'Falta D' },
    { modo: 'Mala S', s: 11, o: 2, d: 2 },
    { modo: 'No entera', s: 5, o: 2.5, d: 2 },
    {}, // totalmente vacía: se ignora
    { modo: 'Primero', s: 5, o: 4, d: 5 },
    { modo: 'Segundo', s: 4, o: 5, d: 5 }, // mismo RPN: queda después
  ]);
  assert.equal(r.incompletas, 2);
  assert.equal(r.invalidas, 2);
  assert.deepEqual(r.ranking.map((f) => f.modo), ['Primero', 'Segundo']);
  assert.equal(A.resumenAmef([]).valido, false);
  assert.ok(Number.isNaN(A.resumenAmef([]).rpnMax));
});

/* ------------------------------------------------------------------ */
/* ANOVA                                                               */
/* ------------------------------------------------------------------ */

const grupos = (listas) => listas.map((datos, i) => ({ nombre: `Turno ${i + 1}`, datos }));

test('ANOVA: ejemplo mínimo de la guía M7 (A 10·12, B 14·16, C 18·20) → SC 64 + 6 = 70, F = 16', () => {
  const r = A.anovaUnFactor(grupos([[10, 12], [14, 16], [18, 20]]));
  assert.deepEqual([r.scEntre, r.scDentro, r.scTotal], [64, 6, 70]);
  assert.deepEqual([r.glEntre, r.glDentro, r.cmEntre, r.cmDentro, r.F], [2, 3, 32, 2, 16]);
  assert.deepEqual(r.usados.map((g) => g.media), [11, 15, 19]);
  assert.equal(r.mediaGlobal, 15);
});

test('ANOVA: cinco fuerzas por turno de la guía M7 §2 → F(2, 12) = 14.22, p < 0.001', () => {
  const r = A.anovaUnFactor(grupos([[172, 175, 178, 174, 176], [173, 176, 171, 177, 173], [165, 168, 158, 170, 164]]));
  cerca(r.scEntre, 303.33, { rel: 1e-4 });
  cerca(r.scDentro, 128, { rel: 1e-12 });
  cerca(r.scTotal, 431.33, { rel: 1e-4 });
  assert.deepEqual([r.glEntre, r.glDentro, r.glTotal], [2, 12, 14]);
  cerca(r.cmEntre, 151.67, { rel: 1e-4 });
  cerca(r.cmDentro, 10.67, { rel: 1e-3 });
  assert.equal(r.F.toFixed(2), '14.22');
  assert.ok(r.p < 0.001);
  assert.deepEqual(r.usados.map((g) => g.media), [175, 174, 165]);
  assert.equal(r.significativo, true);
});

for (const caso of ref.anova) {
  test(`ANOVA: «${caso.nombre}» coincide con SciPy (tabla, F, p, F crítico, η², IC y comparaciones por pares)`, () => {
    const r = A.anovaUnFactor(grupos(caso.grupos), { alfa: caso.alfa });
    assert.equal(r.valido, true);
    assert.equal(r.k, caso.k);
    assert.equal(r.N, caso.N);
    assert.deepEqual([r.glEntre, r.glDentro], [caso.glEntre, caso.glDentro]);
    for (const [clave, esperado] of [['mediaGlobal', caso.mediaGlobal], ['scEntre', caso.scEntre], ['scDentro', caso.scDentro], ['cmEntre', caso.cmEntre], ['cmDentro', caso.cmDentro], ['F', caso.F], ['fCritico', caso.fCritico], ['eta2', caso.eta2], ['razonS', caso.razonS], ['tCritico', caso.tCritico]]) {
      cerca(r[clave], esperado, { rel: 1e-9 }, clave);
    }
    cerca(r.p, caso.p, { rel: 1e-8, abs: 1e-300 }, 'p');
    cerca(r.qCritico, caso.qCritico, { rel: 1e-6 }, 'q crítico de Tukey');
    r.usados.forEach((g, i) => {
      const e = caso.gruposRef[i];
      assert.equal(g.n, e.n);
      cerca(g.media, e.media, { rel: 1e-12 }, `media ${i}`);
      cerca(g.s, e.s, { rel: 1e-9 }, `s ${i}`);
      cerca(g.semi, e.semi, { rel: 1e-9 }, `± IC ${i}`);
      cerca(g.ic[0], e.media - e.semi, { rel: 1e-9 });
      cerca(g.ic[1], e.media + e.semi, { rel: 1e-9 });
    });
    assert.equal(r.pares.length, caso.pares.length);
    r.pares.forEach((p, idx) => {
      const e = caso.pares[idx];
      assert.deepEqual([p.i, p.j], [e.i, e.j]);
      cerca(p.dif, e.dif, { rel: 1e-9, abs: 1e-12 }, 'dif');
      cerca(p.ee, e.se, { rel: 1e-9 }, 'ee');
      cerca(p.lsd, e.lsd, { rel: 1e-9 }, 'LSD');
      cerca(p.hsd, e.hsd, { rel: 1e-6 }, 'HSD');
      cerca(p.pLsd, e.p_lsd, { rel: 1e-7, abs: 1e-12 }, 'p LSD');
      cerca(p.pTukey, e.p_tukey, { rel: 1e-5, abs: 1e-7 }, 'p Tukey');
      assert.equal(p.difiereLsd, e.p_lsd < caso.alfa, 'decisión LSD');
      assert.equal(p.difiereTukey, e.p_tukey < caso.alfa, 'decisión Tukey');
    });
  });
}

test('ANOVA: plantilla Excel → F = 54.13, η² = 0.80; T3 difiere de T1 y de T2 y T1 de T2 no (LSD 2.94)', () => {
  const caso = ref.anova.find((c) => c.nombre === 'excel');
  const r = A.anovaUnFactor(grupos(caso.grupos));
  assert.equal(r.F.toFixed(2), '54.13');
  assert.equal(r.eta2.toFixed(2), '0.80');
  assert.equal(r.fCritico.toFixed(3), '3.354');
  assert.equal(r.pares[0].lsd.toFixed(2), '2.94'); // T1–T2: |0.79| < 2.94 → no difiere
  assert.deepEqual(r.pares.map((p) => p.difiereLsd), [false, true, true]);
  assert.deepEqual(r.pares.map((p) => p.difiereTukey), [false, true, true]);
  assert.ok(r.razonS < 1.01); // las tres s son casi iguales (3.21, 3.19, 3.20)
  // la guía usa solo 5 datos por turno y su razón s máx / s mín es 2.05: la regla de «menos de 2» de la plantilla avisa
  const guia = A.anovaUnFactor(grupos([[172, 175, 178, 174, 176], [173, 176, 171, 177, 173], [165, 168, 158, 170, 164]]));
  cerca(guia.razonS, 2.049390153, { rel: 1e-8 });
});

test('ANOVA: solo cuentan los grupos con al menos 2 datos, valores no numéricos se ignoran y α inválido no truena', () => {
  const r = A.anovaUnFactor([
    { nombre: 'A', datos: [5.1, 4.8, 5.4, 5.0] },
    { nombre: 'B', datos: [5.9, 6.3, 6.1] },
    { nombre: 'C', datos: [5.2, 5.5, 5.0, 5.3, 5.6, NaN] },
    { nombre: 'Solo uno', datos: [9] },
    { nombre: 'Vacío', datos: [] },
  ]);
  assert.equal(r.k, 3);
  assert.deepEqual(r.ignorados, [{ nombre: 'Solo uno', n: 1 }]);
  cerca(r.F, 17.35671039354188, { rel: 1e-9 }); // SciPy f_oneway sobre los tres grupos con datos
  cerca(r.p, 0.0008153136659906443, { rel: 1e-7 });
  const sinAlfa = A.anovaUnFactor(grupos([[1, 2, 3], [2, 3, 4]]), { alfa: 0 });
  assert.equal(sinAlfa.alfaValida, false);
  assert.ok(Number.isNaN(sinAlfa.fCritico));
  assert.equal(sinAlfa.significativo, false);
  assert.equal(A.anovaUnFactor(grupos([[1, 2, 3]])).valido, false);
  assert.equal(A.anovaUnFactor([]).valido, false);
});

test('ANOVA: sin variación dentro de los grupos la F no está definida (como la plantilla, que la deja en blanco)', () => {
  const r = A.anovaUnFactor(grupos([[5, 5, 5], [7, 7, 7]]));
  assert.equal(r.valido, true);
  assert.equal(r.sinVariacion, true);
  assert.ok(Number.isNaN(r.F));
  assert.ok(Number.isNaN(r.p));
  assert.equal(r.significativo, false);
  assert.equal(r.razonS, NaN);
  assert.deepEqual(r.pares.map((p) => [p.pLsd, p.pTukey]), [[0, 0]]);
});

/* ------------------------------------------------------------------ */
/* Regresión y correlación                                             */
/* ------------------------------------------------------------------ */

for (const caso of ref.regresion) {
  test(`Regresión: «${caso.nombre}» coincide con SciPy (pendiente, intercepto, r, R², errores, t, p, IC, predicciones)`, () => {
    const r = A.regresionLineal(caso.x, caso.y);
    assert.equal(r.valido, true);
    assert.equal(r.n, caso.n);
    for (const [clave, esperado] of [['pendiente', caso.pendiente], ['intercepto', caso.intercepto], ['r', caso.r], ['r2', caso.r2], ['s', caso.s], ['eePendiente', caso.eePendiente], ['eeIntercepto', caso.eeIntercepto], ['t', caso.t]]) {
      cerca(r[clave], esperado, { rel: 1e-9 }, clave);
    }
    cerca(r.p, caso.p, { rel: 1e-7, abs: 1e-300 }, 'p');
    cerca(r.icPendiente[0], caso.icPendiente[0], { rel: 1e-9 });
    cerca(r.icPendiente[1], caso.icPendiente[1], { rel: 1e-9 });
    r.residuos.forEach((e, i) => cerca(e, caso.residuos[i], { rel: 1e-8, abs: 1e-12 }, `residuo ${i}`));
    for (const e of caso.predicciones) {
      const pr = A.prediccion(r, e.x0);
      cerca(pr.yh, e.yh, { rel: 1e-9, abs: 1e-12 }, `Ŷ(${e.x0})`);
      cerca(pr.icMedia[0], e.icMedia[0], { rel: 1e-8, abs: 1e-12 });
      cerca(pr.icMedia[1], e.icMedia[1], { rel: 1e-8, abs: 1e-12 });
      cerca(pr.icPred[0], e.icPred[0], { rel: 1e-8, abs: 1e-12 });
      cerca(pr.icPred[1], e.icPred[1], { rel: 1e-8, abs: 1e-12 });
      assert.equal(pr.extrapolacion, e.fuera, `extrapolación en ${e.x0}`);
    }
    for (const e of caso.xParaY) cerca(A.xParaY(r, e.y0).x, e.x, { rel: 1e-9, abs: 1e-12 }, `X para Y = ${e.y0}`);
  });
}

test('Regresión: 12 pares de la plantilla Excel → Y = 15.662 − 0.0840 X, r = −0.994, R² = 0.988, fuerza «Fuerte»', () => {
  const caso = ref.regresion.find((c) => c.nombre === 'excel');
  const r = A.regresionLineal(caso.x, caso.y);
  assert.equal(r.intercepto.toFixed(3), '15.662');
  assert.equal(r.pendiente.toFixed(4), '-0.0840');
  assert.equal(r.r.toFixed(3), '-0.994');
  assert.equal(r.r2.toFixed(3), '0.988');
  assert.equal(r.s.toFixed(4), '0.0797');
  assert.equal(r.fuerza, 'Fuerte');
  assert.ok(r.p < 1e-9);
  // la plantilla pregunta Ŷ en X = 170 (1.376) y la X para Y = 1.5 (168.5)
  assert.equal(A.prediccion(r, 170).yh.toFixed(3), '1.376');
  assert.equal(A.xParaY(r, 1.5).x.toFixed(1), '168.5');
  // 190 N queda fuera del rango (160 a 185) y la resistencia sale negativa: extrapolación sin sentido físico (guía Ej. 2)
  const fuera = A.prediccion(r, 190);
  assert.equal(fuera.extrapolacion, true);
  assert.ok(fuera.yh < 0);
  assert.equal(A.prediccion(r, 185).extrapolacion, false); // el extremo del rango no es extrapolar
  // la banda se ensancha al alejarse del centro del rango
  assert.ok(A.prediccion(r, 190).seMedia > A.prediccion(r, r.mediaX).seMedia);
  // 173 N: la fuerza para 1.2 mΩ con esta recta (172.1 N) es consistente con el «al menos 173 N» de la guía
  assert.equal(A.xParaY(r, 1.2).x.toFixed(1), '172.1');
});

test('Regresión: la ecuación publicada en la guía (16.37 − 0.088 F) da 0.97 mΩ a 175 N, 0.53 a 180 N y −0.35 a 190 N', () => {
  const ecuacion = (f) => 16.37 - 0.088 * f;
  assert.equal(ecuacion(175).toFixed(2), '0.97');
  assert.equal(ecuacion(180).toFixed(2), '0.53');
  assert.equal(ecuacion(190).toFixed(2), '-0.35');
  assert.equal(((16.37 - 1.2) / 0.088).toFixed(1), '172.4'); // «al menos 173 N» (se redondea hacia arriba)
});

test('Regresión: ajuste perfecto, Y constante, X constante, largos distintos y pocos pares', () => {
  const perfecta = A.regresionLineal([1, 2, 3, 4], [2, 4, 6, 8]);
  assert.deepEqual([perfecta.pendiente, perfecta.intercepto, perfecta.r, perfecta.r2, perfecta.s, perfecta.p], [2, 0, 1, 1, 0, 0]);
  assert.deepEqual(perfecta.icPendiente, [2, 2]);
  const constante = A.regresionLineal([1, 2, 3, 4], [5, 5, 5, 5]);
  assert.equal(constante.yConstante, true);
  assert.equal(constante.pendiente, 0);
  assert.ok(Number.isNaN(constante.r));
  assert.equal(constante.p, 1);
  assert.deepEqual([A.regresionLineal([2, 2, 2], [1, 2, 3]).motivo, A.regresionLineal([1, 2, 3], [1, 2]).motivo, A.regresionLineal([1, 2], [1, 2]).motivo], ['x-constante', 'largos', 'pocos']);
  assert.equal(A.regresionLineal([1, 2, 3], [1, 2, 3.5]).glRes, 1);
  assert.equal(A.prediccion({ valido: false }, 1).valido, false);
  assert.equal(A.xParaY(constante, 5).valido, false); // pendiente 0: no se puede despejar X
});

test('Correlación: fuerza según la plantilla (≥ 0.8 fuerte, ≥ 0.5 moderada, si no débil) y ejemplos de la guía', () => {
  assert.deepEqual([-0.99, 0.8, 0.79, 0.5, 0.49, 0.15, -0.85, 0].map(A.fuerzaCorrelacion), ['Fuerte', 'Fuerte', 'Moderada', 'Moderada', 'Débil', 'Débil', 'Fuerte', 'Débil']);
  assert.equal(A.fuerzaCorrelacion(NaN), '');
});

/* ------------------------------------------------------------------ */
/* Chi-cuadrada y Fisher                                               */
/* ------------------------------------------------------------------ */

for (const caso of ref.chi2) {
  test(`Chi-cuadrada: «${caso.nombre}» coincide con SciPy (χ², gl, p, crítico, V de Cramér, esperadas y contribuciones)`, () => {
    const r = A.chiCuadrada(caso.observadas);
    assert.equal(r.valido, true);
    assert.equal(r.N, caso.N);
    assert.equal(r.gl, caso.gl);
    cerca(r.chi2, caso.chi2, { rel: 1e-9 }, 'χ²');
    cerca(r.p, caso.p, { rel: 1e-7, abs: 1e-300 }, 'p');
    cerca(r.critico, caso.critico, { rel: 1e-9 }, 'crítico');
    cerca(r.cramerV, caso.cramerV, { rel: 1e-9 }, 'V de Cramér');
    cerca(r.minEsperado, caso.minEsperado, { rel: 1e-12 }, 'esperado mínimo');
    assert.equal(r.bajas, caso.bajas);
    caso.esperadas.forEach((fila, i) => fila.forEach((e, j) => cerca(r.esperadas[i][j], e, { rel: 1e-12 }, `E[${i}][${j}]`)));
    caso.contribuciones.forEach((fila, i) => fila.forEach((e, j) => cerca(r.contribuciones[i][j], e, { rel: 1e-9, abs: 1e-15 }, `contribución[${i}][${j}]`)));
    if (caso.fisher !== undefined) {
      cerca(r.yates, caso.yates, { rel: 1e-9, abs: 1e-14 }, 'χ² con Yates');
      cerca(r.pYates, caso.pYates, { rel: 1e-7 }, 'p con Yates');
      cerca(r.fisher, caso.fisher, { rel: 1e-6, abs: 1e-12 }, 'Fisher');
    } else {
      assert.equal(r.fisher, undefined); // Yates y Fisher solo en tablas 2 × 2
    }
  });
}

test('Chi-cuadrada: plantilla Excel (285/15, 280/20, 262/38) → χ² = 13.09, gl = 2, p = 0.0014, V = 0.12; sí hay asociación', () => {
  const r = A.chiCuadrada([[285, 280, 262], [15, 20, 38]]);
  assert.equal(r.chi2.toFixed(2), '13.09');
  assert.equal(r.p.toFixed(4), '0.0014');
  assert.equal(r.critico.toFixed(2), '5.99');
  assert.equal(r.cramerV.toFixed(2), '0.12');
  assert.equal(r.significativo, true);
  assert.equal(r.bajas, 0);
  assert.equal(r.totalesFila.join(), '827,73');
  assert.equal(r.totalesColumna.join(), '300,300,300');
  assert.equal(r.esperadas[1][0].toFixed(2), '24.33');
});

test('Chi-cuadrada: fallas de continuidad de la guía M7 §5 (2 · 2 · 6 de 5,340) → χ² ≈ 3.20, p ≈ 0.20, no se rechaza H₀; esperados 3.33 < 5', () => {
  const r = A.chiCuadrada([[2, 2, 6], [5340 - 2, 5340 - 2, 5340 - 6]]);
  assert.equal(r.N, 16020);
  assert.equal(r.gl, 2);
  assert.equal(r.chi2.toFixed(2), '3.20');
  assert.equal(r.p.toFixed(2), '0.20');
  assert.equal(r.critico.toFixed(2), '5.99');
  assert.equal(r.significativo, false);
  assert.equal(r.esperadas[0][0].toFixed(2), '3.33');
  // la guía no lo dice, pero las tres celdas de fallas esperan 3.33 < 5: la aproximación chi-cuadrada es dudosa
  assert.equal(r.bajas, 3);
});

test('Chi-cuadrada: las filas y columnas sin conteos se ignoran (como la plantilla) y una tabla < 2 × 2 no es válida', () => {
  const r = A.chiCuadrada([[10, 0, 20], [5, 0, 15], [0, 0, 0]]);
  assert.equal(r.valido, true);
  assert.deepEqual([r.nFilas, r.nColumnas, r.filas, r.columnas], [2, 2, [0, 1], [0, 2]]);
  cerca(r.chi2, 0.39682539682539675, { rel: 1e-12 }); // SciPy sobre [[10, 20], [5, 15]]
  cerca(r.p, 0.5287333251214301, { rel: 1e-9 });
  cerca(r.yates, 0.09920634920634919, { rel: 1e-9 });
  cerca(r.pYates, 0.7527841326498471, { rel: 1e-9 });
  cerca(r.fisher, 0.7536263339838003, { rel: 1e-9 });
  assert.equal(A.chiCuadrada([[5, 6, 7]]).valido, false);
  assert.equal(A.chiCuadrada([[5, 0], [6, 0]]).valido, false);
  assert.equal(A.chiCuadrada([]).valido, false);
  assert.equal(A.chiCuadrada([[NaN, -3], [0, 0]]).valido, false);
});

test('Fisher exacto 2 × 2: tablas pequeñas de SciPy y casos simétricos', () => {
  cerca(A.fisherExacto2x2(3, 1, 1, 3), 0.4857142857142857, { rel: 1e-9 });
  cerca(A.fisherExacto2x2(8, 2, 1, 5), 0.03496503496503497, { rel: 1e-9 });
  assert.equal(A.fisherExacto2x2(5, 5, 5, 5), 1);
  assert.equal(A.fisherExacto2x2(0, 5, 5, 0) < 0.01, true);
  // el valor es el mismo si se trasponen filas o columnas
  cerca(A.fisherExacto2x2(8, 2, 1, 5), A.fisherExacto2x2(2, 8, 5, 1), { rel: 1e-9 });
  cerca(A.fisherExacto2x2(8, 2, 1, 5), A.fisherExacto2x2(1, 5, 8, 2), { rel: 1e-9 });
});

/* ------------------------------------------------------------------ */
/* Intervalo de confianza de una media                                 */
/* ------------------------------------------------------------------ */

for (const caso of ref.ic_media) {
  test(`IC de una media: n = ${caso.n}, x̄ = ${caso.media}, s = ${caso.s}, ${caso.confianza * 100} % coincide con SciPy (z y t)`, () => {
    const r = A.intervaloMedia({ n: caso.n, media: caso.media, s: caso.s, confianza: caso.confianza });
    assert.equal(r.valido, true);
    assert.equal(r.gl, caso.n - 1);
    cerca(r.z, caso.z, { rel: 1e-9 });
    cerca(r.t, caso.t, { rel: 1e-9 });
    cerca(r.ee, caso.ee, { rel: 1e-12 });
    cerca(r.icZ[0], caso.icZ[0], { rel: 1e-9 });
    cerca(r.icZ[1], caso.icZ[1], { rel: 1e-9 });
    cerca(r.icT[0], caso.icT[0], { rel: 1e-9 });
    cerca(r.icT[1], caso.icT[1], { rel: 1e-9 });
  });
}

test('IC de una media: ejemplos de la guía (torque [1.334, 1.376], n = 16 [46.08, 53.92], n = 25 [76.08, 83.92]) y entradas inválidas', () => {
  const torque = A.intervaloMedia({ n: 10, media: 1.355, s: 0.034 });
  assert.deepEqual(torque.icZ.map((v) => v.toFixed(3)), ['1.334', '1.376']);
  assert.deepEqual(torque.icT.map((v) => v.toFixed(3)), ['1.331', '1.379']); // con t el intervalo es un poco más ancho
  assert.ok(torque.semiT > torque.semiZ);
  assert.deepEqual(A.intervaloMedia({ n: 16, media: 50, s: 8 }).icZ.map((v) => v.toFixed(2)), ['46.08', '53.92']);
  assert.deepEqual(A.intervaloMedia({ n: 25, media: 80, s: 10 }).icZ.map((v) => v.toFixed(2)), ['76.08', '83.92']);
  for (const malo of [{ n: 1, media: 5, s: 1 }, { n: 10.5, media: 5, s: 1 }, { n: 10, media: NaN, s: 1 }, { n: 10, media: 5, s: -1 }, { n: 10, media: 5, s: 1, confianza: 1 }, { n: 10, media: 5, s: 1, confianza: 0 }]) {
    assert.equal(A.intervaloMedia(malo).valido, false, JSON.stringify(malo));
  }
  assert.deepEqual(A.intervaloMedia({ n: 5, media: 10, s: 0 }).icT, [10, 10]); // sin variación el intervalo se reduce a un punto
});
