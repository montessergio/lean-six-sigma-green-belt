/**
 * Pruebas del LAB 17 (AMEF y RPN). Los valores esperados salen de la guía (M6 §4: 8·6·4 = 192, 9·2·3 = 54, 3·7·2 = 42;
 * Ejercicios 2 y 3: 7·5·6 = 210 → 7·5·2 = 70, −67 %; pregunta de reflexión: D de 3 a 1 → 18; examen: 9·2·2 = 36 contra
 * 4·8·7 = 224), de la hoja «AMEF» de la plantilla (8·5·6 = 240, 9·4·5 = 180, 5·3·8 = 120; umbrales 100 y 200) o de cuentas
 * hechas a mano y escritas como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOR } from '../js/core/config.js';
import { ejecutar, ejecutarVacio, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab17-amef-rpn.js';
const lab = (preset, extra = {}) => ejecutar(ARCHIVO, preset, extra);
const texto = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const grafica = (r, id) => r.resultado.graficas.find((g) => g.id === id);
const tabla = (r, titulo) => r.resultado.tablas.find((t) => (titulo instanceof RegExp ? titulo.test(t.titulo) : t.titulo === titulo));
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const fila = (modo, s, o, d, { paso = '', efecto = '', causa = '' } = {}) => ({ paso, modo, efecto, causa, s, o, d });
const prioridades = (r) => celdas0(tabla(r, 'El AMEF ordenado por RPN')).map((f) => f[8]);
const celdas0 = (t) => t.filas.map(celdas);

const ENTRADAS = ['criterio', 'dNueva', 'mejoraFila', 'modos', 'oNueva', 'sNueva'];

test('LAB17: los presets son válidos y fijan las seis entradas', async () => {
  for (const p of ['guia', 'empaque', 'excel']) {
    const r = await lab(p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
    const preset = r.def.presets.find((x) => x.id === p);
    assert.deepEqual(Object.keys(preset.valores).sort(), ENTRADAS, `preset ${p} fija todas las entradas`);
  }
  const { def } = await lab('guia');
  assert.equal(def.entradas.find((e) => e.id === 'modos').maxFilas, 20); // la plantilla evalúa 20 filas
  assert.equal(def.entradas.find((e) => e.id === 'mejoraFila').opciones.length, 21); // (ninguna) + filas 1 a 20
});

test('LAB17: guía M6 §4 → RPN 192, 54 y 42, en ese orden', async () => {
  const r = await lab('guia');
  const t = tabla(r, 'El AMEF ordenado por RPN');
  assert.deepEqual(t.filas.map((f) => celdas(f).slice(0, 8)), [
    ['1', 'Engarzado de terminales', 'Fuerza de engarzado insuficiente', 'Falla de continuidad eléctrica', '8', '6', '4', '192'],
    ['2', 'Ensamble de conectores', 'Conector mal asentado', 'Desconexión en servicio', '9', '2', '3', '54'],
    ['3', 'Colocación de etiquetado', 'Etiqueta ilegible o mal ubicada', 'Error de identificación', '3', '7', '2', '42'],
  ]);
  assert.deepEqual(t.resaltar, [0]);
  assert.equal(texto(r, 'evaluados'), '3');
  assert.equal(texto(r, 'rpnMax'), '192');
  assert.equal(nota(r, 'rpnMax'), '8 × 6 × 4 · «Fuerza de engarzado insuficiente»');
  assert.equal(salida(r.resultado, 'mejora'), undefined); // el simulador queda vacío en este ejemplo
  assert.equal(r.resultado.tablas.length, 1);
});

test('LAB17: guía → prioridades por RPN (192 acción requerida, 54 revisar, 42 bajo) y S ≥ 9 manda sobre el RPN', async () => {
  const r = await lab('guia');
  assert.deepEqual(prioridades(r), [
    'Acción requerida',
    'Revisión independiente (S ≥ 9) · por RPN: Revisar y priorizar', // 54 está entre 50 y 100, pero S = 9
    'Bajo: monitorear',
  ]);
  assert.equal(texto(r, 'acciones'), '1 de 3');
  assert.equal(salida(r.resultado, 'acciones').etiqueta, 'Piden acción (RPN > 100)');
  assert.equal(nota(r, 'acciones'), '1 modo por revisar (RPN de 50 a 100)');
  assert.equal(texto(r, 'severos'), '1');
  const rpn = semaforo(r.resultado, 'Prioridad por RPN');
  assert.equal(rpn.estado, 'critico');
  assert.match(rpn.texto, /«Fuerza de engarzado insuficiente» tiene el mayor RPN \(192 = 8 × 6 × 4\): acción requerida según la guía/);
  const sev = semaforo(r.resultado, 'Severidad ≥ 9');
  assert.equal(sev.estado, 'critico');
  assert.match(sev.texto, /1 modo tiene severidad de 9 o 10: «Conector mal asentado» \(S=9, RPN 54\)\. Revisión independiente obligatoria, sin importar el RPN; por RPN solo, ese modo no pediría acción/);
  assert.deepEqual(activas(r), ['Más de 100', 'S ≥ 9, cualquier RPN']);
});

test('LAB17: guía → el etiquetado es el segundo más frecuente (O = 7) pero queda con el RPN más bajo: frecuencia y riesgo son distintos', async () => {
  const r = await lab('guia');
  const s = semaforo(r.resultado, 'Frecuencia y riesgo');
  assert.equal(s.estado, 'informativo');
  assert.match(s.texto, /«Etiqueta ilegible o mal ubicada», O=7\) no es el de mayor RPN \(«Fuerza de engarzado insuficiente», 192\)/);
  // si el modo más frecuente también tiene el mayor RPN, no hay nada que advertir
  const r2 = await lab('guia', { modos: [fila('A', 8, 7, 4), fila('B', 3, 2, 2)] });
  assert.equal(semaforo(r2.resultado, 'Frecuencia y riesgo'), undefined);
});

test('LAB17: plantilla Excel → 240 acción inmediata, 180 con S ≥ 9 (revisar) y 120 acción; criterio de la plantilla', async () => {
  const r = await lab('excel');
  assert.equal(r.estado.criterio, 'excel');
  const t = tabla(r, 'El AMEF ordenado por RPN');
  assert.deepEqual(t.filas.map((f) => celdas(f).slice(1, 8)), [
    ['Atornillado', 'Torque bajo', 'Conector flojo', '8', '5', '6', '240'],
    ['Crimpado', 'Terminal mal crimpada', 'Circuito abierto', '9', '4', '5', '180'],
    ['Etiquetado', 'Etiqueta incorrecta', 'Mezcla de arneses', '5', '3', '8', '120'],
  ]);
  assert.deepEqual(prioridades(r), ['Acción inmediata', 'Revisar (S≥9) · por RPN: Acción', 'Acción']);
  assert.equal(salida(r.resultado, 'acciones').etiqueta, 'Piden acción (RPN ≥ 100)');
  assert.equal(texto(r, 'acciones'), '3 de 3');
  assert.equal(nota(r, 'acciones'), '1 de acción inmediata (RPN ≥ 200)');
  assert.equal(texto(r, 'severos'), '1');
  assert.match(semaforo(r.resultado, 'Prioridad por RPN').texto, /«Torque bajo» tiene el mayor RPN \(240 = 8 × 5 × 6\): acción inmediata según la plantilla/);
  // el crimpado ya pide acción por RPN (180): la severidad no se «esconde» y el aviso no lo dice
  assert.doesNotMatch(semaforo(r.resultado, 'Severidad ≥ 9').texto, /se esconde/);
  assert.deepEqual(activas(r), ['200 o más', 'S ≥ 9, cualquier RPN']);
});

test('LAB17: guía Ej. 2 y 3 → 7 × 5 × 6 = 210; con D de 6 a 2 el RPN cae a 70 (−67 %) sin tocar la Ocurrencia', async () => {
  const r = await lab('empaque');
  assert.equal(texto(r, 'rpnMax'), '210');
  assert.equal(texto(r, 'mejora'), '210 → 70');
  assert.equal(nota(r, 'mejora'), '−67 % · «Sellado incompleto de bolsa»');
  const s = semaforo(r.resultado, 'Mejora simulada');
  assert.equal(s.estado, 'informativo'); // solo cambió la Detección
  assert.match(s.texto, /Con D de 6 a 2, el RPN de «Sellado incompleto de bolsa» pasa de 210 a 70 \(−67 %\): revisar y priorizar\./);
  assert.match(s.texto, /Mejorar solo la Detección reduce el riesgo de que el defecto llegue al cliente, pero no la frecuencia con que ocurre/);
  const t = tabla(r, /^¿Y si mejoramos\?/);
  assert.match(t.titulo, /Fila 1: «Sellado incompleto de bolsa»/);
  assert.deepEqual(t.filas.map(celdas), [
    ['Ahora', '7', '5', '6', '210', 'Acción requerida'],
    ['Con la mejora', '7', '5', '2', '70', 'Revisar y priorizar'],
  ]);
  assert.match(t.pie, /Cambio del RPN: −67 %/);
});

test('LAB17: pregunta de reflexión de la guía → conector mal asentado (9·2·3 = 54), D de 3 a 1 → 18; sigue en revisión por S = 9', async () => {
  const r = await lab('guia', { mejoraFila: '2', dNueva: 1 });
  assert.equal(texto(r, 'mejora'), '54 → 18');
  assert.match(nota(r, 'mejora'), /^−67 % · «Conector mal asentado»/);
  const s = semaforo(r.resultado, 'Mejora simulada');
  assert.equal(s.estado, 'atencion');
  assert.match(s.texto, /pasa de 54 a 18 \(−67 %\): revisión independiente \(S ≥ 9\)\./); // la S de la severidad conserva su mayúscula
  assert.match(s.texto, /La severidad sigue en 9: el modo continúa en revisión obligatoria aunque el RPN baje/);
  const t = tabla(r, /^¿Y si mejoramos\?/);
  assert.deepEqual(t.filas.map(celdas), [
    ['Ahora', '9', '2', '3', '54', 'Revisión independiente (S ≥ 9)'],
    ['Con la mejora', '9', '2', '1', '18', 'Revisión independiente (S ≥ 9)'],
  ]);
});

test('LAB17: simulador → el Ejercicio 6 de la guía (7·4·6 = 168, D de 6 a 3 → 84, −50 %); atacar la Ocurrencia (5 → 2) da 84, −60 %', async () => {
  const base = [fila('Modo del ejercicio', 7, 4, 6)];
  const r = await lab(null, { modos: base, mejoraFila: '1', dNueva: 3 });
  assert.equal(texto(r, 'rpnMax'), '168');
  assert.equal(texto(r, 'mejora'), '168 → 84');
  assert.match(nota(r, 'mejora'), /^−50 %/);
  const r2 = await lab('empaque', { dNueva: NaN, oNueva: 2 }); // 7 × 2 × 6 = 84 frente a 210
  assert.equal(texto(r2, 'mejora'), '210 → 84');
  assert.match(nota(r2, 'mejora'), /^−60 %/);
  const s = semaforo(r2.resultado, 'Mejora simulada');
  assert.equal(s.estado, 'cumple'); // atacar la causa no lleva la advertencia de «solo Detección»
  assert.doesNotMatch(s.texto, /solo la Detección/);
  const r3 = await lab('empaque', { dNueva: 4, oNueva: 4 }); // dos cambios: 7 × 4 × 4 = 112 (−47 %)
  assert.equal(texto(r3, 'mejora'), '210 → 112');
  assert.match(semaforo(r3.resultado, 'Mejora simulada').texto, /Con O de 5 a 4 y D de 6 a 4, el RPN/);
});

test('LAB17: simulador → un RPN que sube, calificaciones iguales o sin calificaciones nuevas', async () => {
  const sube = await lab('empaque', { dNueva: 9 }); // 7 × 5 × 9 = 315 (+50 %)
  assert.equal(texto(sube, 'mejora'), '210 → 315');
  assert.equal(semaforo(sube.resultado, 'Mejora simulada').estado, 'atencion');
  assert.match(semaforo(sube.resultado, 'Mejora simulada').texto, /\(\+50 %\).*El RPN sube/);
  const igual = await lab('empaque', { dNueva: 6 });
  assert.equal(semaforo(igual.resultado, 'Mejora simulada').estado, 'informativo');
  assert.match(semaforo(igual.resultado, 'Mejora simulada').texto, /mismo RPN \(210\)/);
  const sinNuevas = await lab('empaque', { dNueva: NaN });
  assert.equal(salida(sinNuevas.resultado, 'mejora').valor, '210 → 210');
  assert.match(semaforo(sinNuevas.resultado, 'Mejora simulada').texto, /Escribe una calificación nueva \(S, O o D\)/);
});

test('LAB17: simulador → avisos por fila inexistente, calificaciones nuevas inválidas o falta de fila', async () => {
  const fuera = await lab('guia', { mejoraFila: '7', dNueva: 2 });
  assert.match(avisos(fuera), /La fila 7 no tiene S, O y D válidos \(o no existe\)/);
  assert.equal(salida(fuera.resultado, 'mejora'), undefined);
  const invalida = await lab('empaque', { dNueva: 11 });
  assert.match(avisos(invalida), /Las calificaciones nuevas deben ser enteros de 1 a 10\./);
  assert.equal(salida(invalida.resultado, 'mejora'), undefined);
  const decimal = await lab('empaque', { dNueva: 2.5 });
  assert.match(avisos(decimal), /enteros de 1 a 10/);
  const sinFila = await lab('guia', { dNueva: 2 });
  assert.match(avisos(sinFila), /Elige el modo que se mejora/);
  assert.equal(salida(sinFila.resultado, 'mejora'), undefined);
  // una fila elegida pero incompleta tampoco se puede simular
  const incompleta = await lab(null, { modos: [fila('Completo', 5, 5, 5), fila('Incompleto', 6, NaN, 4)], mejoraFila: '2', dNueva: 2 });
  assert.match(avisos(incompleta), /La fila 2 no tiene S, O y D válidos/);
});

test('LAB17: examen → 9·2·2 = 36 contra 4·8·7 = 224: el de severidad 9 queda bajo por RPN y aun así se revisa', async () => {
  const r = await lab(null, { modos: [fila('Severo y raro', 9, 2, 2), fila('Frecuente y menor', 4, 8, 7)] });
  assert.deepEqual(celdas0(tabla(r, 'El AMEF ordenado por RPN')).map((f) => [f[2], f[7]]), [['Frecuente y menor', '224'], ['Severo y raro', '36']]);
  assert.deepEqual(prioridades(r), ['Acción requerida', 'Revisión independiente (S ≥ 9) · por RPN: Bajo: monitorear']);
  const sev = semaforo(r.resultado, 'Severidad ≥ 9');
  assert.equal(sev.estado, 'critico');
  assert.match(sev.texto, /«Severo y raro» \(S=9, RPN 36\)/);
  assert.match(sev.texto, /por RPN solo, ese modo no pediría acción/);
  // el examen también da S5 O4 D9 = 180 (con D de 9 a 3 → 60) y S6 O7 D5 = 210
  const r2 = await lab(null, { modos: [fila('Examen 5', 5, 4, 9), fila('Examen 6', 6, 7, 5)], mejoraFila: '1', dNueva: 3 });
  assert.equal(texto(r2, 'rpnMax'), '210');
  assert.equal(texto(r2, 'mejora'), '180 → 60');
});

test('LAB17: los umbrales de la guía (50 y 100) y de la plantilla (100 y 200) caen donde dicen; el RPN de 100 depende del criterio', async () => {
  // 49 = 7·7·1 · 50 = 5·5·2 · 100 = 4·5·5 · 105 = 3·5·7 · 196 = 4·7·7 · 200 = 5·5·8 · 96 = 4·4·6
  const modos = [fila('49', 7, 7, 1), fila('50', 5, 5, 2), fila('100', 4, 5, 5), fila('105', 3, 5, 7), fila('96', 4, 4, 6), fila('196', 4, 7, 7), fila('200', 5, 5, 8)];
  const guia = await lab(null, { criterio: 'guia', modos });
  const porNombre = (r) => Object.fromEntries(celdas0(tabla(r, 'El AMEF ordenado por RPN')).map((f) => [f[2], f[8]]));
  assert.deepEqual(porNombre(guia), {
    49: 'Bajo: monitorear', 50: 'Revisar y priorizar', 96: 'Revisar y priorizar', 100: 'Revisar y priorizar', 105: 'Acción requerida', 196: 'Acción requerida', 200: 'Acción requerida',
  });
  const excel = await lab(null, { criterio: 'excel', modos });
  assert.deepEqual(porNombre(excel), {
    49: 'Monitorear', 50: 'Monitorear', 96: 'Monitorear', 100: 'Acción', 105: 'Acción', 196: 'Acción', 200: 'Acción inmediata',
  });
  assert.equal(texto(guia, 'acciones'), '3 de 7'); // 105, 196 y 200
  assert.equal(texto(excel, 'acciones'), '4 de 7'); // 100, 105, 196 y 200
  assert.equal(nota(excel, 'acciones'), '1 de acción inmediata (RPN ≥ 200)');
});

test('LAB17: el ranking ordena de mayor a menor y los empates quedan en el orden de captura; se avisa del empate', async () => {
  // 72 = 9·2·4 = 3·4·6 · 30 = 5·3·2
  const r = await lab(null, { modos: [fila('Pequeño', 5, 3, 2), fila('Primero 72', 3, 4, 6), fila('Segundo 72', 9, 2, 4)] });
  assert.deepEqual(celdas0(tabla(r, 'El AMEF ordenado por RPN')).map((f) => f[2]), ['Primero 72', 'Segundo 72', 'Pequeño']);
  const s = semaforo(r.resultado, 'RPN empatados');
  assert.equal(s.estado, 'informativo');
  assert.match(s.texto, /2 modos comparten el RPN 72 \(3·4·6 y 9·2·4\)/);
  assert.match(s.texto, /Desempata por severidad.*referencia didáctica/);
  // sin empates no hay aviso
  assert.equal(semaforo((await lab('guia')).resultado, 'RPN empatados'), undefined);
});

test('LAB17: filas incompletas o con calificaciones fuera de 1–10 no tienen RPN y se avisa; las filas vacías se ignoran', async () => {
  const r = await lab(null, {
    modos: [
      fila('Completo', 4, 5, 6), // 120
      fila('Solo S', 8, NaN, NaN),
      fila('Sin números', NaN, NaN, NaN),
      fila('Fuera de rango', 11, 5, 5),
      fila('Decimal', 5, 2.5, 4),
      fila('Cero', 0, 5, 5),
      fila('', NaN, NaN, NaN), // fila vacía
      { paso: '', modo: '', efecto: '', causa: '', s: 5, o: 5, d: 5 }, // solo números: sí cuenta (la plantilla calcula con S, O y D)
    ],
  });
  assert.equal(texto(r, 'evaluados'), '2');
  assert.equal(nota(r, 'evaluados'), '5 sin RPN (ver el aviso)');
  assert.match(avisos(r), /Filas con texto pero sin las tres calificaciones \(no tienen RPN\): 2\./);
  assert.match(avisos(r), /Filas con calificaciones que no son enteros de 1 a 10 \(se ignoraron\): 3\./);
  assert.equal(texto(r, 'rpnMax'), '125'); // 5·5·5 = 125 supera a 4·5·6 = 120
  assert.deepEqual(celdas0(tabla(r, 'El AMEF ordenado por RPN')).map((f) => f[2]), ['—', 'Completo']); // la fila sin texto se muestra «—»
});

test('LAB17: sin modos calificados → mensaje de vacío; con la captura vacía no lanza excepciones', async () => {
  const r = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(r.problemas, []);
  assert.match(r.resultado.vacio, /Captura al menos un modo de falla con sus tres calificaciones/);
  assert.equal(semaforo(r.resultado, 'Datos').estado, 'sin-datos');
  assert.equal(r.resultado.graficas, undefined);
  const soloTexto = await lab(null, { modos: [fila('Sin calificar', NaN, NaN, NaN)] });
  assert.match(soloTexto.resultado.vacio, /Captura al menos un modo/);
  assert.match(avisos(soloTexto), /sin las tres calificaciones/);
});

test('LAB17: modo y efecto con el mismo texto → aviso (error más común del AMEF: confundir modo y efecto)', async () => {
  const r = await lab(null, { modos: [fila('Falla de continuidad eléctrica', 8, 6, 4, { efecto: 'falla de continuidad eléctrica ' }), fila('Otro modo', 3, 3, 3, { efecto: 'Otro efecto' })] });
  const s = semaforo(r.resultado, 'Modo de falla y efecto');
  assert.equal(s.estado, 'atencion');
  assert.match(s.texto, /1 fila repite el mismo texto en el modo y en el efecto \(«Falla de continuidad eléctrica»\)/);
  assert.equal(semaforo((await lab('guia')).resultado, 'Modo de falla y efecto'), undefined);
});

test('LAB17: todos los RPN bajos → prioridad «cumple»; con severidad 9 o 10 se activa el semáforo crítico aunque el RPN sea bajo', async () => {
  const bajo = await lab(null, { modos: [fila('Menor', 2, 3, 4), fila('Otro menor', 3, 3, 3)] }); // 24 y 27
  assert.equal(semaforo(bajo.resultado, 'Prioridad por RPN').estado, 'cumple');
  assert.match(semaforo(bajo.resultado, 'Prioridad por RPN').texto, /Todos los RPN quedan por debajo del umbral de revisión; el mayor es 27 = 3 × 3 × 3/);
  assert.equal(semaforo(bajo.resultado, 'Severidad ≥ 9').estado, 'cumple');
  assert.equal(texto(bajo, 'severos'), '0');
  const diez = await lab(null, { modos: [fila('Seguridad', 10, 1, 1)] }); // RPN 10, severidad 10
  assert.equal(semaforo(diez.resultado, 'Severidad ≥ 9').estado, 'critico');
  assert.equal(prioridades(diez)[0], 'Revisión independiente (S ≥ 9) · por RPN: Bajo: monitorear');
  const rev = await lab(null, { modos: [fila('A', 5, 4, 3)] }); // 60: revisar (guía)
  assert.equal(semaforo(rev.resultado, 'Prioridad por RPN').estado, 'atencion');
});

test('LAB17: el gráfico del RPN → una traza por clase, línea en cada umbral, marca de S ≥ 9 y barra de la mejora', async () => {
  const guia = await lab('guia');
  const g = grafica(guia, 'rpn');
  assert.deepEqual(g.datos.map((t) => t.name), ['Bajo · menos de 50', 'Revisar y priorizar · 50 a 100', 'Acción requerida · más de 100', 'Severidad ≥ 9 (revisión obligatoria)']);
  assert.deepEqual(g.datos.map((t) => t.marker.color), [COLOR.verde, COLOR.ambar, COLOR.coral, COLOR.blanco]);
  // las barras comparten las categorías; cada modo está en la traza de su clase por RPN
  const y = g.datos[0].y;
  assert.equal(y.length, 3);
  assert.match(y[0], /^1\. Fuerza de engarzado/);
  assert.deepEqual(g.datos[0].x, [null, null, 42]);
  assert.deepEqual(g.datos[1].x, [null, 54, null]); // el conector (S = 9) conserva su color por RPN (54: revisar)
  assert.deepEqual(g.datos[2].x, [192, null, null]);
  assert.deepEqual(g.datos[3].x, [54]);
  assert.deepEqual(g.layout.shapes.map((s) => s.x0), [50, 100]);
  assert.equal(g.layout.yaxis.autorange, 'reversed');
  assert.ok(g.layout.xaxis.range[1] > 192 && g.layout.xaxis.range[1] >= 130);
  assert.deepEqual(g.respaldo.filas.map((f) => f.slice(0, 6)), [['1', 'Fuerza de engarzado insuficiente', '8', '6', '4', '192'], ['2', 'Conector mal asentado', '9', '2', '3', '54'], ['3', 'Etiqueta ilegible o mal ubicada', '3', '7', '2', '42']]);
  // plantilla: las líneas van en 100 y 200
  const ex = grafica(await lab('excel'), 'rpn');
  assert.deepEqual(ex.layout.shapes.map((s) => s.x0), [100, 200]);
  assert.deepEqual(ex.datos.map((t) => t.name).slice(0, 3), ['Monitorear · menos de 100', 'Acción · 100 a 199', 'Acción inmediata · 200 o más']);
  // con el simulador aparece la barra «con la mejora» justo debajo del modo que se mejora
  const em = grafica(await lab('empaque'), 'rpn');
  const mejora = em.datos.find((t) => t.name === 'Con la mejora (simulada)');
  assert.deepEqual(mejora.x, [null, 70]);
  assert.match(mejora.y[1], /^↳ con la mejora \(D 6→2\)$/);
  assert.equal(em.respaldo.filas.length, 2);
  assert.deepEqual(em.respaldo.filas[1].slice(0, 6), ['', 'con la mejora: D de 6 a 2', '7', '5', '2', '70']);
});

test('LAB17: los modos con el mismo nombre no se fusionan en el gráfico (las etiquetas llevan el lugar)', async () => {
  const r = await lab(null, { modos: [fila('Torque bajo', 8, 5, 6), fila('Torque bajo', 7, 4, 3), fila('Torque bajo', 2, 2, 2)] });
  const y = grafica(r, 'rpn').datos[0].y;
  assert.equal(new Set(y).size, 3);
  assert.deepEqual(y.map((e) => e.slice(0, 2)), ['1.', '2.', '3.']);
  assert.deepEqual(grafica(r, 'perfil').datos[0].x.length, 3);
  assert.equal(new Set(grafica(r, 'perfil').datos[0].x).size, 3);
});

test('LAB17: el perfil muestra S, O y D de cada modo; el gráfico crece con más de seis barras; las etiquetas no rompen el HTML de Plotly', async () => {
  const guia = await lab('guia');
  const p = grafica(guia, 'perfil');
  assert.deepEqual(p.datos.map((t) => t.name), ['Severidad (S)', 'Ocurrencia (O)', 'Detección (D)']);
  assert.deepEqual(p.datos.map((t) => t.y), [[8, 9, 3], [6, 2, 7], [4, 3, 2]]);
  assert.equal(grafica(guia, 'rpn').alta, false);
  const muchos = await lab(null, { modos: Array.from({ length: 8 }, (_, i) => fila(`Modo ${i + 1}`, 5, 4, i + 1)) });
  assert.equal(grafica(muchos, 'rpn').alta, true);
  const raro = await lab(null, { modos: [fila('<b>Hola</b> & <script>', 5, 5, 5, { paso: '<i>x</i>', efecto: '<u>y</u>' })] });
  const hover = grafica(raro, 'rpn').datos.flatMap((t) => t.customdata ?? []).join('|');
  assert.doesNotMatch(hover, /<script|<i>|<u>/); // solo quedan las etiquetas que pone el laboratorio (<b> y <br>)
});

test('LAB17: el umbral y el supuesto explican la debilidad del RPN y la Prioridad de Acción (AP) sin calcularla', async () => {
  const r = await lab('guia');
  const filas = r.resultado.umbral.filas;
  assert.equal(r.resultado.umbral.titulo, 'Cómo leer el RPN (criterio de la guía)');
  assert.deepEqual(filas.map((f) => f.rango), ['S, O y D', 'Menos de 50', '50 a 100', 'Más de 100', 'S ≥ 9, cualquier RPN', 'Prioridad de Acción (AP)']);
  assert.match(filas.at(-1).texto, /no incluye la tabla, y este laboratorio no la calcula/);
  assert.match(r.resultado.supuesto.texto, /72 = 9 × 2 × 4 = 3 × 4 × 6/);
  assert.match(r.resultado.supuesto.texto, /Severidad se califica sobre el efecto más grave/);
  const ex = await lab('excel');
  assert.deepEqual(ex.resultado.umbral.filas.map((f) => f.rango).slice(1, 4), ['Menos de 100', '100 a 199', '200 o más']);
});
