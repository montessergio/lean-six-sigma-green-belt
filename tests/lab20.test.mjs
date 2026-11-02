/**
 * Pruebas del LAB 20 (mapa de flujo de valor). Los valores esperados salen de la guía (M8 §1: lead time de 55 min, PCE de
 * 27.3 %, estado futuro con Kanban de 44 min y 34.1 %), de la plantilla Excel «VSM» (takt de 0.9375 min, esperas de
 * inventario × takt, lead time de 481.575 min) o de cuentas hechas aparte y escritas como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutar, ejecutarVacio, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab20-vsm.js';
const texto = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const tabla = (r, inicio) => r.resultado.tablas.find((t) => t.titulo.startsWith(inicio));
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));

test('LAB20: los presets son válidos y fijan todas las entradas', async () => {
  for (const p of ['guia', 'excel']) {
    const r = await ejecutar(ARCHIVO, p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
    const preset = r.def.presets.find((x) => x.id === p);
    assert.deepEqual(Object.keys(preset.valores).sort(), ['demanda', 'disponible', 'esperaNueva', 'etapas', 'mejoraFila'], `preset ${p}`);
  }
});

test('LAB20: guía M8 §1 → lead time 55 min, VA 15 min, esperas 38 min y PCE 27.3 %', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(texto(r, 'lead'), '55 min');
  assert.equal(texto(r, 'va'), '15 min');
  assert.equal(nota(r, 'va'), '27.3 % del lead time');
  assert.equal(texto(r, 'esperas'), '38 min');
  assert.equal(texto(r, 'pce'), '27.3 %');
  assert.equal(nota(r, 'pce'), '15 ÷ 55');
  assert.equal(texto(r, 'sva'), '2 min'); // la inspección final es SVA necesario
  assert.equal(texto(r, 'cuello'), 'Ruteo y amarre');
  assert.equal(salida(r.resultado, 'takt'), undefined, 'sin demanda ni tiempo disponible no hay takt');
  assert.equal(salida(r.resultado, 'rty'), undefined);
  assert.equal(salida(r.resultado, 'inventario'), undefined);
  assert.equal(semaforo(r.resultado, 'Takt'), undefined);
  assert.deepEqual(activas(r), ['PCE > 25 %']);
});

test('LAB20: guía M8 §1 → con Kanban (buffer de 15 a 4 min) esperas 27, lead time 44 y PCE 34.1 %', async () => {
  const r = await ejecutar(ARCHIVO, 'guia');
  assert.equal(texto(r, 'lead-futuro'), '44 min');
  assert.equal(nota(r, 'lead-futuro'), '−11 min (−20.0 %)');
  assert.equal(texto(r, 'pce-futuro'), '34.1 %');
  assert.equal(nota(r, 'pce-futuro'), '15 ÷ 44');
  const t = tabla(r, 'Estado actual y estado futuro');
  assert.deepEqual(celdas(t.filas[0]), ['Lead time (min)', '55', '44', '−11']);
  assert.deepEqual(celdas(t.filas[1]), ['Esperas (min)', '38', '27', '−11']);
  assert.deepEqual(celdas(t.filas[2]), ['Valor agregado (min)', '15', '15', '0']);
  assert.deepEqual(celdas(t.filas[3]), ['PCE', '27.3 %', '34.1 %', '+6.8 pts']);
  assert.equal(t.pie, 'Esperas futuras = 38 − 15 + 4 = 27 min.');
  const s = semaforo(r.resultado, 'Estado futuro');
  assert.match(s.texto, /pasa de 15 min a 4 min/);
  assert.match(s.texto, /de 55 a 44 min/);
  assert.match(s.texto, /de 27\.3 % a 34\.1 %/);
  assert.ok(r.resultado.graficas.some((g) => g.id === 'futuro'));
});

test('LAB20: plantilla Excel → lead time 481.575 min, PCE 0.72 %, RTY 89.4 %, 510 unidades y 1.06 días', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  assert.equal(texto(r, 'lead'), '481.575 min');
  assert.equal(texto(r, 'va'), '3.45 min');
  assert.equal(texto(r, 'esperas'), '478.125 min');
  assert.equal(texto(r, 'pce'), '0.72 %');
  assert.equal(texto(r, 'takt'), '0.9375 min');
  assert.equal(nota(r, 'takt'), '56.25 s por unidad · 450 min ÷ 480 unidades');
  assert.equal(texto(r, 'rty'), '89.4 %');
  assert.equal(texto(r, 'inventario'), '510 unid.');
  assert.equal(nota(r, 'inventario'), '1.06 días de demanda');
  assert.equal(texto(r, 'cuello'), 'Apriete y verificación');
  assert.equal(nota(r, 'cuello'), '0.9 min por unidad · 96 % del takt');
  assert.equal(texto(r, 'mayor-espera'), '140.625 min');
  assert.equal(semaforo(r.resultado, 'Takt').estado, 'cumple');
  assert.equal(salida(r.resultado, 'lead-futuro'), undefined, 'sin etapa elegida no hay estado futuro');
  assert.deepEqual(activas(r), ['PCE < 5 %', 'Espera = inventario × takt', 'Tiempo de ciclo > takt']);
  const t = tabla(r, 'El mapa');
  assert.deepEqual(celdas(t.filas[0]), ['Corte y pelado', 'VA', '0.4', 'Sí', '150', '140.625', '29.3 %']);
  assert.deepEqual(celdas(t.filas.at(-1)), ['Total', '', '3.45', '', '510', '478.125', '100.0 %']);
});

test('LAB20: si la demanda sube a 600 por día el takt (0.75 min) lo exceden dos etapas', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { demanda: 600 });
  assert.equal(texto(r, 'takt'), '0.75 min');
  const s = semaforo(r.resultado, 'Takt');
  assert.equal(s.estado, 'critico');
  assert.match(s.texto, /2 etapas con tiempo de ciclo mayor que el takt de 0\.75 min/);
  assert.match(s.texto, /Ensamble en tablero/);
  assert.match(s.texto, /Apriete y verificación/);
  const t = tabla(r, 'El mapa');
  assert.equal(celdas(t.filas[2])[3], 'Excede');
  assert.equal(celdas(t.filas[0])[3], 'Sí');
});

test('LAB20: inventario sin takt avisa y no entra al lead time; una espera capturada manda', async () => {
  const r = await ejecutar(ARCHIVO, 'excel', { demanda: NaN, disponible: NaN });
  assert.match(avisos(r), /5 etapas con inventario pero sin espera en minutos/);
  assert.equal(texto(r, 'lead'), '3.45 min');
  assert.equal(texto(r, 'pce'), '100.0 %');
  const e = (await ejecutar(ARCHIVO, 'excel')).estado.etapas.map((f) => ({ ...f }));
  e[0].espera = 10;
  const r2 = await ejecutar(ARCHIVO, 'excel', { etapas: e });
  assert.match(avisos(r2), /1 etapa con inventario y espera en minutos: manda la espera capturada/);
  assert.equal(texto(r2, 'esperas'), '347.5 min'); // 10 + 112.5 + 75 + 56.25 + 93.75
});

test('LAB20: avisos de captura incompleta (takt a medias, etapa fuera del mapa, espera nueva faltante)', async () => {
  assert.match(avisos(await ejecutar(ARCHIVO, 'excel', { disponible: NaN })), /captura la demanda y el tiempo disponible/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'excel', { demanda: 0 })), /mayores que cero/);
  assert.match(avisos(await ejecutar(ARCHIVO, 'guia', { mejoraFila: '9' })), /La fila 9 no forma parte del mapa/);
  const r = await ejecutar(ARCHIVO, 'guia', { esperaNueva: NaN });
  assert.match(avisos(r), /Captura la espera nueva/);
  assert.equal(salida(r.resultado, 'lead-futuro'), undefined);
  const neg = await ejecutar(ARCHIVO, 'guia', { etapas: [{ etapa: 'A', tc: -2, clase: 'VA', inv: NaN, espera: NaN, fty: NaN }, { etapa: 'B', tc: 3, clase: 'VA', inv: NaN, espera: NaN, fty: NaN }] });
  assert.match(avisos(neg), /1 fila sin números válidos/);
});

test('LAB20: reducir la espera a cero deja el lead time en la suma de los tiempos de ciclo', async () => {
  const r = await ejecutar(ARCHIVO, 'guia', { mejoraFila: '6', esperaNueva: 0 });
  assert.equal(texto(r, 'lead-futuro'), '32 min'); // 17 de tiempos de ciclo + 15 del buffer
  assert.equal(texto(r, 'pce-futuro'), '46.9 %'); // 15 ÷ 32
});

test('LAB20: captura vacía no lanza y no devuelve cálculos', async () => {
  const r = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(r.problemas, []);
  assert.match(r.resultado.vacio, /Captura al menos una etapa/);
  assert.equal(semaforo(r.resultado, 'Datos').estado, 'sin-datos');
});

test('LAB20: las gráficas traen respaldo y la línea de tiempo suma el lead time', async () => {
  const r = await ejecutar(ARCHIVO, 'excel');
  const g = r.resultado.graficas.find((x) => x.id === 'linea-tiempo');
  assert.equal(g.respaldo.filas.length, 5);
  assert.deepEqual(g.respaldo.filas[1], ['2. Crimpado', 'VA', '0.7', '112.5', '141.025']);
  const total = g.datos.reduce((s, tr) => s + tr.x.reduce((a, b) => a + b, 0), 0);
  assert.ok(Math.abs(total - 481.575) < 1e-9);
});
