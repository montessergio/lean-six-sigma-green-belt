/**
 * Pruebas del LAB 24 (plan de control). Los valores esperados salen de la guía (M10 §4: cuatro líneas, AMEF de la guía M6 con RPN
 * 192 · 54 · 42), de la plantilla Excel «Plan de Control» (5 líneas completas = 100 %, 3 críticas, 4 con RPN ≥ 100, 0 no ligadas; el
 * etiquetado, RPN 120, ya viene como Significativa) y de la lógica de la hoja; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, salida, semaforo } from './helpers.mjs';
import { COLOR } from '../js/core/config.js';

const ARCHIVO = 'lab24-plan-control.js';
const texto = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const tabla = (r, inicio) => r.resultado.tablas.find((t) => t.titulo.startsWith(inicio));
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));
const traza = (r, nombre) => r.resultado.graficas.find((g) => g.id === 'cobertura').datos.find((d) => d.name === nombre);

const ENTRADAS = ['amef', 'plan', 'rpnAlto'];
const COLUMNAS_PLAN = ['op', 'caracteristica', 'tipo', 'clasificacion', 'especificacion', 'medicion', 'muestra', 'frecuencia', 'metodo', 'reaccion', 'responsable', 'ref'];

test('LAB24: los presets son válidos y fijan todas las entradas', async () => {
  for (const p of ['guia', 'excel', 'corregir-olvidar']) {
    const r = await ejecutar(ARCHIVO, p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
    const preset = r.def.presets.find((x) => x.id === p);
    assert.deepEqual(Object.keys(preset.valores).sort(), [...ENTRADAS].sort(), `preset ${p}`);
    assert.equal(preset.valores.rpnAlto, 100);
    for (const fila of preset.valores.plan) assert.deepEqual(Object.keys(fila).sort(), [...COLUMNAS_PLAN].sort(), `preset ${p}: cada línea trae los doce campos`);
  }
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(r.def.panelAncho, true);
  assert.equal(r.def.modulo, 'M10');
  assert.equal(r.def.numero, '24');
  assert.equal(r.def.id, 'lab24');
  assert.equal(r.resultado.aviso.length, 0);
});

test('LAB24: guía M10 §4 → 4 líneas con los ocho campos, pero 3 por clasificar (RPN 192) y el conector mal asentado (S = 9) sin control', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(r.estado.plan.length, 4);
  assert.deepEqual(r.estado.amef.map((m) => [m.modo, m.s, m.o, m.d]), [
    ['Fuerza de engarzado insuficiente', 8, 6, 4],
    ['Conector mal asentado', 9, 2, 3],
    ['Etiqueta ilegible o mal ubicada', 3, 7, 2],
  ]);
  assert.equal(texto(r, 'lineas'), '4');
  assert.equal(nota(r, 'lineas'), '4 con los ocho campos');
  assert.equal(texto(r, 'completas'), '1 de 4');
  assert.equal(nota(r, 'completas'), '25 % · 3 por clasificar');
  assert.equal(salida(r.resultado, 'completas').color, 'ambar');
  assert.equal(texto(r, 'criticas'), '0');
  assert.equal(salida(r.resultado, 'rpn-alto').etiqueta, 'Con RPN ≥ 100 en el AMEF');
  assert.equal(texto(r, 'rpn-alto'), '3', 'tres líneas apuntan al modo de la fuerza (192)');
  assert.equal(texto(r, 'sin-ligar'), '1', 'la longitud de pelado no sale del AMEF');
  assert.equal(nota(r, 'sin-ligar'), '1 sin referencia · 0 con un nombre que no está en el AMEF');
  assert.equal(texto(r, 'sin-control'), '1');
  assert.equal(nota(r, 'sin-control'), '«Conector mal asentado»');
  assert.equal(semaforo(r.resultado, 'Completitud').estado, 'cumple');
  const clasif = semaforo(r.resultado, 'Clasificación');
  assert.equal(clasif.estado, 'atencion');
  assert.match(clasif.texto, /«Fuerza de engarzado \(poka-yoke\)» \(RPN 192\), «Fuerza de engarzado \(estadístico\)» \(RPN 192\) y «Continuidad eléctrica» \(RPN 192\): el AMEF las ubica en RPN ≥ 100 pero no están clasificadas como Crítica ni Significativa/);
  assert.equal(semaforo(r.resultado, 'Líneas sin modo de falla').estado, 'informativo');
  assert.match(semaforo(r.resultado, 'Líneas sin modo de falla').texto, /«Longitud de pelado» no cita ningún modo del AMEF/);
  const cob = semaforo(r.resultado, 'Cobertura del AMEF');
  assert.equal(cob.estado, 'atencion', 'S = 9 pero RPN 54: atención, no crítico');
  assert.match(cob.texto, /1 modo importante sin línea en el plan: «Conector mal asentado» \(RPN 54, S = 9\)\. Si queda fuera del alcance del proyecto/);
  assert.equal(semaforo(r.resultado, 'Plan de reacción').estado, 'cumple');
  // La tabla de cobertura usa el mismo criterio que el semáforo: S = 9 con RPN 54 es atención; solo el RPN alto sin control es crítico.
  assert.deepEqual(tabla(r, 'Cobertura del AMEF').filas.map((f) => f[5].estado), ['cumple', 'atencion', 'informativo']);
});

test('LAB24: guía → al clasificar las líneas como pide la plantilla, las cuatro quedan completas', async () => {
  const base = (await ejecutar(ARCHIVO, 'guia')).estado.plan;
  const plan = base.map((l) => ({ ...l, clasificacion: l.caracteristica.startsWith('Longitud') ? 'Significativa' : 'Crítica' }));
  const r = await ejecutar(ARCHIVO, 'guia', { plan });
  assert.equal(texto(r, 'completas'), '4 de 4');
  assert.equal(nota(r, 'completas'), '100 %');
  assert.equal(salida(r.resultado, 'completas').color, 'verde');
  assert.equal(texto(r, 'criticas'), '3');
  const clasif = semaforo(r.resultado, 'Clasificación');
  assert.equal(clasif.estado, 'cumple');
  assert.match(clasif.texto, /Las 3 líneas con RPN ≥ 100 están clasificadas como Crítica o Significativa/);
});

test('LAB24: plantilla Excel → 5 de 5 completas (100 %), 3 críticas, 4 con RPN ≥ 100 y 0 sin ligar por nombre', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(texto(r, 'lineas'), '5');
  assert.equal(texto(r, 'completas'), '5 de 5');
  assert.equal(nota(r, 'completas'), '100 %');
  assert.equal(salida(r.resultado, 'completas').color, 'verde');
  assert.equal(texto(r, 'criticas'), '3');
  assert.equal(texto(r, 'rpn-alto'), '4');
  assert.equal(nota(r, 'sin-ligar'), '1 sin referencia · 0 con un nombre que no está en el AMEF', 'la hoja cuenta 0 «no está en el AMEF»: la prueba eléctrica final no cita nada');
  assert.equal(texto(r, 'sin-control'), '0');
  assert.equal(salida(r.resultado, 'sin-control').color, 'verde');
  assert.equal(nota(r, 'sin-control'), 'de 3 modos del AMEF, todos los importantes tienen línea');
  const clasif = semaforo(r.resultado, 'Clasificación');
  assert.equal(clasif.estado, 'cumple');
  assert.match(clasif.texto, /Las 4 líneas con RPN ≥ 100 están clasificadas como Crítica o Significativa/);
  assert.equal(semaforo(r.resultado, 'Cobertura del AMEF').estado, 'cumple');
  const t = tabla(r, 'El plan, línea por línea');
  assert.deepEqual(t.filas.map((f) => celdas(f)), [
    ['1', 'Fuerza de retención del conector', 'Crítica', 'Torque bajo', '240', 'Completo'],
    ['2', 'Verificación del instrumento', 'Crítica', 'Torque bajo', '240', 'Completo'],
    ['3', 'Fuerza de jalón del crimpado', 'Significativa', 'Terminal mal crimpada', '180', 'Completo'],
    ['4', 'Etiqueta correcta para el tablero', 'Significativa', 'Etiqueta incorrecta', '120', 'Completo'],
    ['5', 'Continuidad y aislamiento', 'Crítica', '—', '—', 'Completo'],
  ]);
  assert.deepEqual(t.filas.map((f) => f[5].estado), ['cumple', 'cumple', 'cumple', 'cumple', 'cumple']);
  assert.deepEqual(t.resaltar, [], 'ninguna línea pide atención');
});

test('LAB24: plantilla Excel con el etiquetado como Estándar → 4 de 5 (80 %) y «Revisar clasificación (RPN alto)»', async () => {
  const base = (await ejecutar(ARCHIVO, 'excel')).estado.plan;
  const plan = base.map((l) => (l.caracteristica.startsWith('Etiqueta') ? { ...l, clasificacion: 'Estándar' } : l));
  const r = await ejecutar(ARCHIVO, 'excel', { plan });
  assert.equal(texto(r, 'completas'), '4 de 5');
  assert.equal(nota(r, 'completas'), '80 % · 1 por clasificar');
  assert.equal(salida(r.resultado, 'completas').color, 'ambar');
  const clasif = semaforo(r.resultado, 'Clasificación');
  assert.equal(clasif.estado, 'atencion');
  assert.match(clasif.texto, /^«Etiqueta correcta para el tablero» \(RPN 120\): el AMEF la ubica en RPN ≥ 100 pero no está clasificada como Crítica ni Significativa\./);
  const t = tabla(r, 'El plan, línea por línea');
  assert.deepEqual(celdas(t.filas[3]), ['4', 'Etiqueta correcta para el tablero', 'Estándar', 'Etiqueta incorrecta', '120', 'Revisar clasificación (RPN alto)']);
  assert.deepEqual(t.filas.map((f) => f[5].estado), ['cumple', 'cumple', 'cumple', 'atencion', 'cumple']);
  assert.deepEqual(t.resaltar, [3]);
  // Con un umbral de 200 el RPN 120 ya no obliga a reclasificar.
  assert.equal(texto(await ejecutar(ARCHIVO, 'excel', { plan, rpnAlto: 200 }), 'completas'), '5 de 5');
});

test('LAB24: «corregir y olvidar» en el poka-yoke enciende el semáforo del plan de reacción', async () => {
  const r = await ejecutar(ARCHIVO, 'corregir-olvidar');
  const s = semaforo(r.resultado, 'Plan de reacción');
  assert.equal(s.estado, 'atencion');
  assert.match(s.texto, /^«Fuerza de engarzado \(poka-yoke\)»: la reacción se queda en desechar la pieza y seguir\./);
  assert.match(s.texto, /guía M10 §4/);
  // Lo demás es igual que en el plan de la guía.
  assert.equal(texto(r, 'completas'), '1 de 4');
  // Si la reacción también ataca la causa, deja de marcarse.
  const plan = r.estado.plan.map((l, i) => (i === 0 ? { ...l, reaccion: 'Desechar la pieza y aplicar 5 Porqués para hallar la causa' } : l));
  const corregido = await ejecutar(ARCHIVO, 'corregir-olvidar', { plan });
  assert.equal(semaforo(corregido.resultado, 'Plan de reacción').estado, 'cumple');
});

test('LAB24: falta de campos → «Incompleto: falta …» en la tabla, semáforo de completitud y salidas', async () => {
  const base = (await ejecutar(ARCHIVO, 'excel')).estado.plan;
  const plan = base.map((l, i) => (i === 0 ? { ...l, especificacion: '', reaccion: '' } : i === 2 ? { ...l, responsable: '' } : l));
  const r = await ejecutar(ARCHIVO, 'excel', { plan });
  assert.equal(texto(r, 'completas'), '3 de 5');
  assert.equal(nota(r, 'completas'), '60 % · 2 incompletas');
  assert.equal(salida(r.resultado, 'completas').color, 'ambar');
  const c = semaforo(r.resultado, 'Completitud');
  assert.equal(c.estado, 'atencion');
  assert.match(c.texto, /^2 líneas sin los ocho campos: «Fuerza de retención del conector» \(falta especificación, reacción\) y «Fuerza de jalón del crimpado» \(falta responsable\)\./);
  const t = tabla(r, 'El plan, línea por línea');
  assert.equal(celdas(t.filas[0])[5], 'Incompleto: falta especificación, reacción');
  assert.equal(t.filas[0][5].estado, 'critico');
  assert.deepEqual(t.resaltar, [0, 2]);
});

test('LAB24: una referencia que no está en el AMEF se avisa; sin acentos ni mayúsculas sí se reconoce', async () => {
  const base = (await ejecutar(ARCHIVO, 'excel')).estado.plan;
  const plan = base.map((l, i) => (i === 0 ? { ...l, ref: 'TORQUE   bajo' } : i === 1 ? { ...l, ref: 'Torque' } : l));
  const r = await ejecutar(ARCHIVO, 'excel', { plan });
  assert.equal(nota(r, 'sin-ligar'), '1 sin referencia · 1 con un nombre que no está en el AMEF');
  assert.equal(texto(r, 'sin-ligar'), '2');
  const v = semaforo(r.resultado, 'Vínculo con el AMEF');
  assert.equal(v.estado, 'atencion');
  assert.match(v.texto, /«Verificación del instrumento» → «Torque»: ese nombre no está en el AMEF/);
  assert.equal(texto(r, 'rpn-alto'), '3');
  const t = tabla(r, 'El plan, línea por línea');
  assert.equal(celdas(t.filas[0])[3], 'Torque bajo');
  assert.equal(celdas(t.filas[1])[3], '«Torque» no está en el AMEF');
  assert.equal(celdas(t.filas[1])[4], '—');
});

test('LAB24: sin modo del AMEF que lo controle y con RPN alto, la cobertura es crítica', async () => {
  const base = (await ejecutar(ARCHIVO, 'excel')).estado.plan;
  const plan = base.filter((l) => l.ref !== 'Terminal mal crimpada');
  const r = await ejecutar(ARCHIVO, 'excel', { plan });
  const cob = semaforo(r.resultado, 'Cobertura del AMEF');
  assert.equal(cob.estado, 'critico', 'RPN 180 ≥ 100 sin línea');
  assert.match(cob.texto, /«Terminal mal crimpada» \(RPN 180, S = 9\)/);
  assert.equal(texto(r, 'sin-control'), '1');
  assert.equal(salida(r.resultado, 'sin-control').color, 'coral');
  const t = tabla(r, 'Cobertura del AMEF');
  assert.deepEqual(t.filas.map(celdas), [
    ['Torque bajo', '8', '240', 'RPN ≥ 100', 'fila 1, fila 2', 'Con control'],
    ['Terminal mal crimpada', '9', '180', 'RPN ≥ 100 y S ≥ 9', 'ninguna', 'Sin control'],
    ['Etiqueta incorrecta', '5', '120', 'RPN ≥ 100', 'fila 3', 'Con control'],
  ]);
  assert.deepEqual(t.filas.map((f) => f[5].estado), ['cumple', 'critico', 'cumple']);
});

test('LAB24: el RPN que se considera alto se puede cambiar, y un valor inválido vuelve a 100 con aviso', async () => {
  const r200 = await ejecutar(ARCHIVO, 'guia', { rpnAlto: 200 });
  assert.equal(salida(r200.resultado, 'rpn-alto').etiqueta, 'Con RPN ≥ 200 en el AMEF');
  assert.equal(texto(r200, 'rpn-alto'), '0');
  assert.equal(texto(r200, 'completas'), '4 de 4', 'ya nada pide clasificación');
  assert.equal(semaforo(r200.resultado, 'Clasificación'), undefined);
  assert.ok(r200.resultado.umbral.filas.some((f) => f.rango === 'RPN ≥ 200'));
  const malo = await ejecutar(ARCHIVO, 'guia', { rpnAlto: NaN });
  assert.match(avisos(malo), /El RPN que se considera alto debe estar entre 1 y 1,000: se usó 100/);
  assert.equal(texto(malo, 'completas'), '1 de 4');
  const fuera = await ejecutar(ARCHIVO, 'guia', { rpnAlto: 5000 });
  assert.match(avisos(fuera), /se usó 100/);
});

test('LAB24: filas del AMEF con datos inválidos se ignoran con aviso, y sin AMEF el plan se revisa igual', async () => {
  const amef = [
    { modo: 'Torque bajo', s: 8, o: 5, d: 6 },
    { modo: 'Fuera de escala', s: 12, o: 1, d: 1 },
    { modo: 'torque BAJO', s: 1, o: 1, d: 1 },
  ];
  const r = await ejecutar(ARCHIVO, 'excel', { amef });
  assert.match(avisos(r), /Filas del AMEF sin nombre o sin S, O y D \(enteros de 1 a 10\): 1\. Se ignoraron\./);
  assert.match(avisos(r), /Modos del AMEF con el mismo nombre: 1\. Solo cuenta el primero\./);
  assert.equal(texto(r, 'rpn-alto'), '2', 'solo las dos líneas del torque tienen modo');
  assert.equal(nota(r, 'sin-ligar'), '1 sin referencia · 2 con un nombre que no está en el AMEF');
  const estandar = (await ejecutar(ARCHIVO, 'excel')).estado.plan.map((l) => (l.caracteristica.startsWith('Etiqueta') ? { ...l, clasificacion: 'Estándar' } : l));
  const sin = await ejecutar(ARCHIVO, 'excel', { amef: [], plan: estandar });
  assert.deepEqual(sin.problemas, []);
  assert.equal(salida(sin.resultado, 'sin-control'), undefined);
  assert.equal(sin.resultado.graficas.length, 0);
  assert.equal(texto(sin, 'completas'), '5 de 5', 'sin AMEF no hay RPN que obligue a reclasificar, aunque el etiquetado sea Estándar');
  assert.equal(semaforo(sin.resultado, 'Vínculo con el AMEF').estado, 'informativo');
  assert.match(semaforo(sin.resultado, 'Vínculo con el AMEF').texto, /Captura el AMEF resumido/);
});

test('LAB24: gráfica de cobertura → barras por clase, rombos de S ≥ 9 y tabla de respaldo', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  const g = r.resultado.graficas.find((x) => x.id === 'cobertura');
  assert.equal(g.ancha, true);
  assert.deepEqual(g.datos.map((d) => d.name), ['Con línea de control', 'Importante y sin control', 'Sin línea, riesgo menor', 'Severidad ≥ 9']);
  assert.equal(traza(r, 'Con línea de control').marker.color, COLOR.teal);
  assert.equal(traza(r, 'Importante y sin control').marker.color, COLOR.coral);
  assert.equal(traza(r, 'Sin línea, riesgo menor').marker.color, COLOR.gris);
  assert.deepEqual(traza(r, 'Con línea de control').x, [192, null, null], 'ordenados de mayor a menor RPN: 192, 54 y 42');
  assert.deepEqual(traza(r, 'Importante y sin control').x, [null, 54, null]);
  assert.deepEqual(traza(r, 'Sin línea, riesgo menor').x, [null, null, 42]);
  assert.deepEqual(traza(r, 'Severidad ≥ 9').x, [54]);
  assert.deepEqual(traza(r, 'Con línea de control').text, ['192 · 3 líneas', '', '']);
  assert.deepEqual(g.respaldo.columnas, ['#', 'Modo de falla', 'S', 'O', 'D', 'RPN', 'Líneas del plan']);
  assert.deepEqual(g.respaldo.filas.map((f) => [f[1], f[5], f[6]]), [
    ['Fuerza de engarzado insuficiente', '192', 'fila 1, fila 2, fila 4'],
    ['Conector mal asentado', '54', 'ninguna'],
    ['Etiqueta ilegible o mal ubicada', '42', 'ninguna'],
  ]);
  assert.equal(g.layout.shapes.length, 1, 'línea vertical del RPN alto');
  assert.equal(g.layout.shapes[0].x0, 100);
});

test('LAB24: cada columna calculada de la tabla de captura muestra lo que dice la plantilla (RPN y estado)', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  const spec = r.def.entradas.find((e) => e.id === 'plan');
  const col = (id) => spec.columnas.find((c) => c.id === id);
  const fila = (i) => r.estado.plan[i];
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => col('rpn').texto(r.estado, fila(i), i)), ['240', '240', '180', '120', '']);
  assert.deepEqual([0, 3].map((i) => col('estado').texto(r.estado, fila(i), i)), ['Completo', 'Completo']);
  assert.equal(col('estado').texto(r.estado, { ...fila(3), clasificacion: 'Estándar' }, 3), 'Revisar clasificación (RPN alto)');
  const mala = { ...fila(0), ref: 'no existe', responsable: '' };
  assert.equal(col('rpn').texto(r.estado, mala, 0), 'no está en el AMEF');
  assert.equal(col('estado').texto(r.estado, mala, 0), 'Incompleto: falta responsable');
  const amef = r.def.entradas.find((e) => e.id === 'amef');
  assert.deepEqual(r.estado.amef.map((m) => amef.columnas.find((c) => c.id === 'rpn').texto(r.estado, m, 0)), ['240', '180', '120']);
  assert.equal(amef.columnas.find((c) => c.id === 'rpn').texto(r.estado, { s: 3, o: NaN, d: 4 }, 0), '');
});

test('LAB24: camino vacío («Limpiar captura») no lanza excepciones y pide una línea', async () => {
  const r = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(r.problemas, []);
  assert.match(r.resultado.vacio, /Captura al menos una línea del plan/);
  assert.equal(semaforo(r.resultado, 'Datos').estado, 'sin-datos');
  assert.ok(r.resultado.umbral.filas.length >= 5);
});
