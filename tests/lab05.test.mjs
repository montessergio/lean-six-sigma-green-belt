import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, numeroDe, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab05-project-charter.js';
const val = (r, id) => numeroDe(salida(r.resultado, id)?.valor);
const estado = (r, nombre) => semaforo(r.resultado, nombre)?.estado;

test('LAB05: todos los presets son válidos', async () => {
  for (const p of ['guia', 'excel']) assert.deepEqual((await ejecutar(ARCHIVO, p)).problemas, [], `preset ${p}`);
});

test('LAB05: guía M2 §6 → 300 a 100 DPMO, 66.7 % de reducción, ROI 462.5 % y recuperación de 2.1 meses', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(val(r, 'cambio-abs'), 200);
  assert.equal(val(r, 'cambio-pct'), 66.7);
  assert.equal(val(r, 'beneficio-neto'), 370000);
  assert.equal(val(r, 'roi'), 462.5);
  assert.equal(val(r, 'recuperacion'), 2.1);
  assert.equal(salida(r.resultado, 'recuperacion').valor, '2.1 meses');
  assert.equal(val(r, 'ritmo'), 16.7);
  assert.equal(salida(r.resultado, 'objetivo').valor, 'Reducir DPMO de arnés de 300 a 100 DPMO (67 % de reducción) en un plazo de 4 meses.');
  for (const n of ['Planteamiento del problema', 'Específico', 'Medible', 'Relevante', 'Temporal', 'Alcance']) assert.equal(estado(r, n), 'cumple', n);
  assert.equal(estado(r, 'Alcanzable'), 'informativo');
});

test('LAB05: plantilla Excel → 300 a 162 DPMO (46 %) y el cronograma cabe en 5 meses', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(val(r, 'cambio-abs'), 138);
  assert.equal(val(r, 'cambio-pct'), 46);
  assert.equal(val(r, 'roi'), 462.5);
  assert.equal(estado(r, 'Temporal'), 'cumple');
  assert.equal(estado(r, 'Planteamiento del problema'), 'cumple');
});

test('LAB05: un planteamiento con culpa, causa y solución se señala y las listas son visibles', async () => {
  const problema = 'El operador comete errores porque no está capacitado; hay que contratar un consultor externo.';
  const r = await ejecutar(ARCHIVO, 'guia', { problema });
  const s = semaforo(r.resultado, 'Planteamiento del problema');
  assert.equal(s.estado, 'atencion');
  assert.match(s.texto, /comete errores/);
  assert.match(s.texto, /porque/);
  assert.match(s.texto, /hay que/);
  assert.match(s.texto, /contratar/);
  const tabla = r.resultado.tablas.find((t) => /Revisión del planteamiento/.test(t.titulo));
  assert.ok(tabla, 'debe mostrar la tabla de revisión');
  assert.ok(tabla.filas.every((f) => typeof f[1] === 'string' && f[1].length > 0), 'cada fila muestra sus palabras buscadas');
});

test('LAB05: sin cifras o sin periodo el planteamiento pide más precisión', async () => {
  const sinCifras = await ejecutar(ARCHIVO, 'guia', { problema: 'La línea de arneses tiene muchos defectos en el ensamble.' });
  assert.equal(estado(sinCifras, 'Planteamiento del problema'), 'atencion');
  assert.match(semaforo(sinCifras.resultado, 'Planteamiento del problema').texto, /cifra/);
  const sinPeriodo = await ejecutar(ARCHIVO, 'guia', { problema: 'La línea de arneses presenta 300 DPMO.' });
  assert.match(semaforo(sinPeriodo.resultado, 'Planteamiento del problema').texto, /tiempo/);
});

test('LAB05: un cronograma que rebasa el plazo es crítico y un caso de negocio sin retorno es atención', async () => {
  const largo = await ejecutar(ARCHIVO, 'guia', { cronograma: [{ meses: 2 }, { meses: 2 }, { meses: 2 }, { meses: 2 }, { meses: 2 }] });
  assert.equal(estado(largo, 'Temporal'), 'critico');
  const caro = await ejecutar(ARCHIVO, 'guia', { beneficioAnual: 50000, costoProyecto: 80000 });
  assert.equal(estado(caro, 'Relevante'), 'atencion');
  assert.equal(val(caro, 'beneficio-neto'), -30000);
});

test('LAB05: una meta mayor que la línea base es un aumento y una meta igual es advertencia', async () => {
  const sube = await ejecutar(ARCHIVO, 'guia', { metrica: 'Rendimiento de primera pasada', unidadMetrica: '%', lineaBase: 95, meta: 98 });
  assert.match(salida(sube.resultado, 'objetivo').valor, /^Aumentar Rendimiento de primera pasada de 95 a 98 %/);
  assert.equal(salida(sube.resultado, 'cambio-abs').etiqueta, 'Aumento absoluto');
  const igual = await ejecutar(ARCHIVO, 'guia', { meta: 300 });
  assert.equal(estado(igual, 'Medible'), 'atencion');
});

test('LAB05: captura vacía, ceros y valores inválidos no lanzan excepciones', async () => {
  const v = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(v.problemas, []);
  assert.ok(v.resultado.vacio);
  for (const extra of [{ lineaBase: 0 }, { meta: NaN }, { beneficioAnual: -5 }, { costoProyecto: 0 }, { plazoMeses: NaN }, { cronograma: [] }]) {
    const r = await ejecutar(ARCHIVO, 'guia', extra);
    assert.deepEqual(r.problemas, [], JSON.stringify(extra));
  }
  const r = await ejecutar(ARCHIVO, 'guia', { costoProyecto: 0 });
  assert.equal(salida(r.resultado, 'roi').valor, '—');
});
