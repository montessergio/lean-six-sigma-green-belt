/**
 * Pruebas del LAB 16 (Ishikawa 6M y 5 Porqués). Los valores esperados salen de la guía (M6 §2–3: diez causas en las seis M,
 * cadena de cinco porqués sin evidencias; examen 3: «el operador se equivocó al torquear»), de las plantillas Excel
 * «Ishikawa» (10 causas, 51 votos, 9 votos la más votada) y «5 Porques» (cuatro pasos verificados y uno no) o de cuentas
 * hechas a mano y escritas como constantes; no del propio código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOR } from '../js/core/config.js';
import { ejecutar, ejecutarVacio, salida, semaforo } from './helpers.mjs';

const ARCHIVO = 'lab16-ishikawa-porques.js';
const texto = (r, id) => salida(r.resultado, id)?.valor;
const nota = (r, id) => salida(r.resultado, id)?.nota;
const activas = (r) => (r.resultado.umbral?.filas ?? []).filter((f) => f.activa).map((f) => f.rango);
const avisos = (r) => [r.resultado.aviso].flat().filter(Boolean).join(' | ');
const figura = (r, id) => r.resultado.figuras.find((f) => f.id === id);
const tabla = (r) => r.resultado.tablas.find((t) => t.titulo === 'Resumen por categoría');
const celdas = (fila) => fila.map((c) => (typeof c === 'object' ? c.texto : c));
const causa = (categoria, causa, votos = NaN) => ({ categoria, causa, votos });
const paso = (respuesta, evidencia = '', verificada = 'No') => ({ respuesta, evidencia, verificada });
const lab = (preset, extra = {}) => ejecutar(ARCHIVO, preset, extra);

const ENTRADAS = ['cadena', 'categoriaRaiz', 'causaRaiz', 'causas', 'contramedida', 'efecto', 'fecha', 'problema', 'pruebaInversa', 'responsable'];

test('LAB16: los presets son válidos y fijan las diez entradas', async () => {
  for (const p of ['guia', 'excel', 'persona']) {
    const r = await lab(p);
    assert.deepEqual(r.problemas, [], `preset ${p}`);
    const preset = r.def.presets.find((x) => x.id === p);
    assert.deepEqual(Object.keys(preset.valores).sort(), ENTRADAS, `preset ${p} fija todas las entradas`);
  }
  const { def } = await lab('guia');
  assert.equal(def.entradas.find((e) => e.id === 'causas').maxFilas, 30); // seis por categoría, como la plantilla
  assert.equal(def.entradas.find((e) => e.id === 'cadena').maxFilas, 8); // «algunos problemas necesitan tres preguntas, otros ocho»
});

test('LAB16: Ishikawa de la guía → 10 causas en las 6 M, sin votos; los 5 porqués quedan como hipótesis por verificar', async () => {
  const r = await lab('guia');
  assert.equal(texto(r, 'causas'), '10');
  assert.equal(nota(r, 'causas'), 'en 6 de 6 M');
  assert.equal(salida(r.resultado, 'votos'), undefined);
  assert.equal(salida(r.resultado, 'masVotada'), undefined);
  assert.equal(texto(r, 'cadena'), '5 pasos');
  assert.equal(nota(r, 'cadena'), '0 verificados');
  assert.match(texto(r, 'raiz'), /^No existe un proceso de control de cambios/);
  assert.equal(nota(r, 'raiz'), 'Método / sistema');
  assert.equal(semaforo(r.resultado, 'Las seis M').estado, 'cumple');
  assert.equal(semaforo(r.resultado, 'Votos').estado, 'informativo');
  const cadena = semaforo(r.resultado, 'Cadena de porqués');
  assert.equal(cadena.estado, 'atencion');
  assert.match(cadena.texto, /Pasos sin verificar: 5 de 5\. Una respuesta sin evidencia es una hipótesis\./);
  assert.equal(semaforo(r.resultado, 'Sin culpar a personas').estado, 'cumple'); // la cadena de la guía termina en el sistema
  assert.equal(semaforo(r.resultado, 'Causa raíz').estado, 'cumple');
  assert.equal(semaforo(r.resultado, 'Prueba inversa').estado, 'informativo');
  assert.equal(semaforo(r.resultado, 'Contramedida').estado, 'informativo');
  assert.deepEqual(activas(r), ['Las seis M', 'Pasos sin verificar (tres porqués o más)']);
  assert.equal(avisos(r), '');
});

test('LAB16: plantilla «Ishikawa» → 51 votos; la más votada (9) es «Sin verificación de torque al inicio de turno»', async () => {
  const r = await lab('excel');
  assert.equal(texto(r, 'causas'), '10');
  assert.equal(texto(r, 'votos'), '51'); // 5 + 6 + 9 + 4 + 8 + 3 + 2 + 7 + 5 + 2
  assert.equal(nota(r, 'votos'), 'todas las causas con voto');
  assert.equal(salida(r.resultado, 'masVotada').etiqueta, 'Causa más votada');
  assert.equal(texto(r, 'masVotada'), 'Sin verificación de torque al inicio de turno');
  assert.equal(nota(r, 'masVotada'), '9 votos · Método');
  const votos = semaforo(r.resultado, 'Votos');
  assert.equal(votos.estado, 'informativo');
  assert.match(votos.texto, /Más votada: «Sin verificación de torque al inicio de turno» \(9 votos, Método\)\. Verifícala con datos: una causa votada no es una causa comprobada\./);
});

test('LAB16: el resumen por categoría repite la hoja «Ishikawa» (11 / 13 / 11 / 2 / 12 / 2 votos)', async () => {
  const r = await lab('excel');
  const t = tabla(r);
  assert.deepEqual(t.filas.map(celdas), [
    ['Mano de obra', '2', '11', 'Capacitación incompleta en torque'],
    ['Método', '2', '13', 'Sin verificación de torque al inicio de turno'],
    ['Máquina', '2', '11', 'Torquímetro descalibrado'],
    ['Material', '1', '2', 'Variación de terminales'],
    ['Medición', '2', '12', 'Resolución del instrumento mayor que el rango'],
    ['Medio ambiente', '1', '2', 'Iluminación deficiente en T3'],
    ['Total', '10', '51', ''],
  ]);
  assert.deepEqual(t.resaltar, [1, 6]); // la M con más votos (Método) y el total
  const g = tabla(await lab('guia'));
  assert.deepEqual(g.filas.map((f) => celdas(f).slice(1, 3)), [['2', '—'], ['2', '—'], ['1', '—'], ['2', '—'], ['2', '—'], ['1', '—'], ['10', '—']]);
  assert.deepEqual(g.resaltar, [6]); // sin votos solo se resalta el total
});

test('LAB16: la cadena de la plantilla «5 Porques» tiene cuatro pasos verificados y uno no', async () => {
  const r = await lab('excel');
  assert.equal(texto(r, 'cadena'), '5 pasos');
  assert.equal(nota(r, 'cadena'), '4 verificados');
  const c = semaforo(r.resultado, 'Cadena de porqués');
  assert.equal(c.estado, 'atencion');
  assert.match(c.texto, /Pasos sin verificar: 1 de 5/);
  assert.equal(nota(r, 'raiz'), 'Método / sistema · prueba inversa: Sí');
  const inv = semaforo(r.resultado, 'Prueba inversa');
  assert.equal(inv.estado, 'cumple');
  assert.match(inv.texto, /El equipo espera que al eliminar la causa raíz desaparezca el problema/);
  const cm = semaforo(r.resultado, 'Contramedida'); // la plantilla trae contramedida y responsable, pero no fecha
  assert.equal(cm.estado, 'atencion');
  assert.match(cm.texto, /^Falta fecha compromiso:/);
  assert.deepEqual(activas(r), ['Las seis M', 'Votos', 'Pasos sin verificar (tres porqués o más)', 'Prueba inversa']);
});

test('LAB16: una cadena que se detiene en una persona se señala (guía, examen 3)', async () => {
  const r = await lab('persona');
  assert.equal(texto(r, 'cadena'), '2 pasos');
  assert.equal(semaforo(r.resultado, 'Cadena de porqués').estado, 'atencion'); // cadena corta
  assert.match(semaforo(r.resultado, 'Cadena de porqués').texto, /^Cadena corta: sigue preguntando hasta una causa de proceso o sistema\./);
  const p = semaforo(r.resultado, 'Sin culpar a personas');
  assert.equal(p.estado, 'atencion');
  assert.match(p.texto, /paso 1: «se equivocó»; paso 2: «se descuidó», «no puso atención»; causa raíz: «se descuidó»/);
  assert.match(p.texto, /Pregunta por qué el proceso permitió el error/);
  const raiz = semaforo(r.resultado, 'Causa raíz'); // Mano de obra casi siempre esconde una causa de sistema
  assert.equal(raiz.estado, 'informativo');
  assert.match(raiz.texto, /Una causa de mano de obra casi siempre tiene detrás una causa de sistema/);
  assert.deepEqual(activas(r), ['Las seis M', 'Votos', 'Cadena corta (menos de 3 porqués)', 'Señala a una persona']);
});

test('LAB16: la revisión de frases ignora acentos y mayúsculas, y mira también la causa raíz', async () => {
  const r = await lab('excel', {
    cadena: [paso('NO SE FIJO en la lectura'), paso('El torquímetro no se verifica'), paso('El arranque no lo incluye')],
    causaRaiz: 'Fue un error humano',
  });
  const p = semaforo(r.resultado, 'Sin culpar a personas');
  assert.equal(p.estado, 'atencion');
  assert.match(p.texto, /paso 1: «no se fijó»; causa raíz: «error humano»/);
  const limpio = await lab('guia', { causaRaiz: 'El proceso permite engarzar sin tope mecánico' });
  assert.equal(semaforo(limpio.resultado, 'Sin culpar a personas').estado, 'cumple');
});

test('LAB16: la lista de frases se muestra en «Cómo leer» y viene de la lista pública', async () => {
  const { def } = await lab('guia');
  const fila = def.umbral.filas.find((f) => f.rango === 'Señala a una persona');
  for (const frase of ['no se fijó', 'se descuidó', 'se equivocó', 'error humano']) assert.ok(fila.texto.includes(frase), frase);
  assert.match(fila.texto, /las dos primeras, de la plantilla; el resto, referencia didáctica/);
});

test('LAB16: una M sin causas se avisa como posible punto ciego', async () => {
  const r = await lab('guia', { causas: [causa('Mano de obra', 'Capacitación insuficiente'), causa('Método', 'Sin punto de verificación'), causa('Máquina', 'Prensa sin mantenimiento')] });
  assert.equal(texto(r, 'causas'), '3');
  assert.equal(nota(r, 'causas'), 'en 3 de 6 M');
  const m = semaforo(r.resultado, 'Las seis M');
  assert.equal(m.estado, 'atencion');
  assert.match(m.texto, /Sin causas en Material, Medición, Medio ambiente\. ¿De verdad no aplican o es un punto ciego del equipo\?/);
  assert.deepEqual(tabla(r).filas.map((f) => celdas(f)[1]), ['1', '1', '1', '0', '0', '0', '3']);
});

test('LAB16: empate en la cima de los votos y causas sin voto', async () => {
  const r = await lab('excel', {
    causas: [causa('Método', 'Sin verificación de torque', 9), causa('Máquina', 'Torquímetro descalibrado', 9), causa('Medición', 'Sin patrón', 3), causa('Material', 'Variación de terminales')],
  });
  assert.equal(salida(r.resultado, 'masVotada').etiqueta, 'Causa más votada (empate)');
  assert.equal(texto(r, 'masVotada'), 'Sin verificación de torque'); // la primera capturada
  assert.equal(nota(r, 'masVotada'), '9 votos cada una · «Sin verificación de torque» y «Torquímetro descalibrado»');
  assert.equal(texto(r, 'votos'), '21');
  assert.equal(nota(r, 'votos'), '1 causa sin votos');
  const v = semaforo(r.resultado, 'Votos');
  assert.match(v.texto, /Empate en la cima: «Sin verificación de torque» y «Torquímetro descalibrado» \(9 votos cada una\)\. Verifica todas con datos antes de elegir una\. 1 causa sin votos\./);
  assert.deepEqual(tabla(r).resaltar, [1, 2, 6]); // Método y Máquina empatan con 9 votos; el 6 es la fila del total
});

test('LAB16: los votos deben ser enteros desde 0; los demás se cuentan como 0 y se avisa', async () => {
  const r = await lab('excel', { causas: [causa('Método', 'A', 2.5), causa('Método', 'B', -1), causa('Máquina', 'C', 4)] });
  assert.match(avisos(r), /Votos no válidos \(decimales o negativos\): 2\. Un voto es un entero desde 0; se contaron como 0\./);
  assert.equal(texto(r, 'votos'), '4');
  const f = figura(r, 'ishikawa');
  assert.deepEqual(f.params.causas.map((c) => c.votos), [null, null, 4]); // lo no válido no se dibuja como voto
});

test('LAB16: filas sin texto de causa se ignoran y una causa sin M válida se avisa', async () => {
  const r = await lab('excel', { causas: [causa('Método', 'Real', 3), causa('Máquina', '', 7), causa('', 'Sin M', 2)] });
  assert.equal(texto(r, 'causas'), '1');
  assert.equal(texto(r, 'votos'), '3');
  assert.match(avisos(r), /Causas sin una M válida \(se ignoraron\): 1\./);
});

test('LAB16: cadena corta, con evidencia y verificada', async () => {
  const corta = await lab('excel', { cadena: [paso('Porque sí', 'Dato', 'Sí'), paso('Porque no', 'Dato', 'Sí')] });
  assert.equal(semaforo(corta.resultado, 'Cadena de porqués').estado, 'atencion');
  assert.deepEqual(activas(corta), ['Las seis M', 'Votos', 'Cadena corta (menos de 3 porqués)', 'Prueba inversa']);
  const completa = await lab('excel', { cadena: [paso('A', 'Dato 1', 'Sí'), paso('B', 'Dato 2', 'Sí'), paso('C', 'Dato 3', 'Sí')] });
  const c = semaforo(completa.resultado, 'Cadena de porqués');
  assert.equal(c.estado, 'cumple');
  assert.equal(c.texto, 'Cadena verificada con evidencia en todos los pasos.');
  assert.equal(nota(completa, 'cadena'), '3 verificados');
  assert.deepEqual(activas(completa), ['Las seis M', 'Votos', 'Cadena verificada', 'Prueba inversa']);
  const sola = await lab('excel', { cadena: [paso('A', 'Dato', 'Sí')] });
  assert.equal(nota(sola, 'cadena'), '1 verificado');
  assert.equal(texto(sola, 'cadena'), '1 paso');
});

test('LAB16: marcar «Sí» sin escribir cómo se verificó no basta', async () => {
  const r = await lab('excel', { cadena: [paso('A', 'Dato 1', 'Sí'), paso('B', '', 'Sí'), paso('C', 'Dato 3', 'Sí')] });
  const c = semaforo(r.resultado, 'Cadena de porqués');
  assert.equal(c.estado, 'atencion');
  assert.match(c.texto, /Marcaste «Sí» en 1 paso sin escribir cómo se verificó\./);
  assert.ok(activas(r).includes('Pasos sin verificar (tres porqués o más)'));
  assert.ok(!activas(r).includes('Cadena verificada'));
});

test('LAB16: evidencia sin respuesta y problema sin escribir generan avisos', async () => {
  const r = await lab('excel', { problema: '', cadena: [paso('', 'Una evidencia suelta'), paso('A'), paso('B'), paso('C')] });
  assert.match(avisos(r), /1 fila tiene evidencia pero ninguna respuesta: no cuenta en la cadena\./);
  assert.match(avisos(r), /Escribe el problema de partida de los 5 Porqués/);
  assert.equal(texto(r, 'cadena'), '3 pasos'); // la fila sin respuesta no cuenta
  const sinEfecto = await lab('excel', { efecto: '' });
  assert.match(avisos(sinEfecto), /Escribe el efecto \(el problema\) para completar la cabeza del pez\./);
});

test('LAB16: causa raíz, prueba inversa y contramedida', async () => {
  const sinRaiz = await lab('excel', { causaRaiz: '', categoriaRaiz: '' });
  assert.equal(semaforo(sinRaiz.resultado, 'Causa raíz').estado, 'atencion'); // cinco porqués y ninguna causa raíz
  assert.match(semaforo(sinRaiz.resultado, 'Causa raíz').texto, /^Falta la causa raíz/);
  assert.equal(semaforo(sinRaiz.resultado, 'Prueba inversa'), undefined); // sin causa raíz no hay qué probar
  assert.equal(semaforo(sinRaiz.resultado, 'Contramedida'), undefined);

  const sinCategoria = await lab('excel', { categoriaRaiz: '' });
  assert.equal(semaforo(sinCategoria.resultado, 'Causa raíz').estado, 'informativo');
  assert.match(semaforo(sinCategoria.resultado, 'Causa raíz').texto, /Elige la categoría de la causa raíz/);

  const cortaSinRaiz = await lab('excel', { cadena: [paso('A'), paso('B')], causaRaiz: '', categoriaRaiz: '' });
  assert.equal(semaforo(cortaSinRaiz.resultado, 'Causa raíz'), undefined); // con menos de tres porqués todavía no toca la causa raíz

  const lecturas = { Sí: 'cumple', No: 'atencion', 'No sé': 'atencion', '': 'informativo' };
  for (const [valor, estado] of Object.entries(lecturas)) {
    const r = await lab('excel', { pruebaInversa: valor });
    assert.equal(semaforo(r.resultado, 'Prueba inversa').estado, estado, `prueba inversa «${valor}»`);
  }
  assert.match(semaforo((await lab('excel', { pruebaInversa: 'No' })).resultado, 'Prueba inversa').texto, /no es la causa raíz: hay otra rama o falta un porqué/);

  const completa = await lab('excel', { fecha: '2026-11-30' });
  assert.equal(semaforo(completa.resultado, 'Contramedida').estado, 'cumple');
  const nadie = await lab('excel', { responsable: '', fecha: '' });
  assert.match(semaforo(nadie.resultado, 'Contramedida').texto, /^Falta responsable y fecha compromiso:/);
  const ninguna = await lab('excel', { contramedida: '', responsable: '', fecha: '' });
  assert.equal(semaforo(ninguna.resultado, 'Contramedida').estado, 'informativo');
});

test('LAB16: las figuras llevan las causas, los votos y la cadena tal como se capturaron', async () => {
  const r = await lab('excel');
  assert.deepEqual(r.resultado.figuras.map((f) => f.figura), ['ishikawa', 'porques']);
  const ish = figura(r, 'ishikawa');
  assert.equal(ish.params.efecto, 'Fuerza de retención por debajo del límite en Turno 3');
  assert.deepEqual(ish.params.causas.map((c) => c.votos), [5, 6, 9, 4, 8, 3, 2, 7, 5, 2]);
  assert.equal(ish.params.causas[2].categoria, 'Método');
  const por = figura(r, 'porques');
  assert.equal(por.params.problema, 'Fuerza de retención promedio de 165 N en Turno 3 (límite: 173 N)');
  assert.deepEqual(por.params.pasos.map((p) => p.verificada), ['Sí', 'Sí', 'Sí', 'Sí', 'No']);
  assert.equal(por.params.categoria, 'Método / sistema');
  const g = figura(await lab('guia'), 'ishikawa');
  assert.ok(g.params.causas.every((c) => c.votos === null)); // sin votos no se dibuja ningún paréntesis
});

test('LAB16: solo Ishikawa o solo 5 Porqués también se pueden usar', async () => {
  const soloIshikawa = await lab('excel', { problema: '', cadena: [], causaRaiz: '', categoriaRaiz: '', pruebaInversa: '', contramedida: '', responsable: '', fecha: '' });
  assert.deepEqual(soloIshikawa.resultado.figuras.map((f) => f.id), ['ishikawa']);
  assert.equal(semaforo(soloIshikawa.resultado, 'Cadena de porqués').estado, 'sin-datos');
  assert.equal(semaforo(soloIshikawa.resultado, 'Causa raíz'), undefined);
  const soloPorques = await lab('excel', { efecto: '', causas: [] });
  assert.deepEqual(soloPorques.resultado.figuras.map((f) => f.id), ['porques']);
  assert.equal(semaforo(soloPorques.resultado, 'Las seis M').estado, 'sin-datos');
  assert.equal(texto(soloPorques, 'causas'), undefined);
  assert.equal(tabla(soloPorques), undefined);
});

test('LAB16: sin datos hay un mensaje claro y ningún cálculo', async () => {
  const r = await ejecutarVacio(ARCHIVO);
  assert.deepEqual(r.problemas, []);
  assert.match(r.resultado.vacio, /Captura al menos una causa del Ishikawa o una respuesta de la cadena de porqués/);
  assert.equal(semaforo(r.resultado, 'Datos').estado, 'sin-datos');
  assert.equal(r.resultado.figuras, undefined);
});

/* ------------------------------------------------------------------ */
/* Las figuras SVG (con un DOM mínimo de mentira)                      */
/* ------------------------------------------------------------------ */

function instalarDomFalso() {
  const nodo = (tag) => ({
    tag, attrs: {}, hijos: [], style: { setProperty() {} },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(h) { this.hijos.push(h); return h; },
    set textContent(v) { this.propio = String(v); },
    get textContent() { return this.propio ?? this.hijos.map((h) => h.textContent).join(''); },
  });
  globalThis.document = { createElementNS: (_ns, tag) => nodo(tag) };
}
const recorrer = (n, f) => { f(n); n.hijos.forEach((h) => recorrer(h, f)); };
const textosDe = (svg) => { const t = []; recorrer(svg, (n) => { if (n.tag === 'text') t.push(n.textContent); }); return t; };
const titulosDe = (svg) => { const t = []; recorrer(svg, (n) => { if (n.tag === 'title') t.push(n.textContent); }); return t; };

test('LAB16: la figura del Ishikawa dibuja las seis M, cada causa con sus votos y destaca la más votada', async () => {
  instalarDomFalso();
  const { crearFigura } = await import('../js/core/figures.js');
  const r = await lab('excel');
  const ish = figura(r, 'ishikawa');
  const svg = crearFigura(ish.figura, ish.params);
  assert.equal(svg.tag, 'svg');
  assert.match(svg.attrs['aria-label'], /Diagrama de Ishikawa \(6M\) del efecto «Fuerza de retención por debajo del límite en Turno 3»: 10 causas en las 6M/);
  const textos = textosDe(svg).join('\n');
  for (const m of ['Mano de obra', 'Método', 'Máquina', 'Material', 'Medición', 'Medio ambiente']) assert.ok(textos.includes(m), m);
  assert.ok(textos.includes('EFECTO (PROBLEMA)'));
  assert.ok(textos.includes('(9)') && textos.includes('(8)') && textos.includes('(7)'));
  assert.ok(textos.includes('(n) = votos del equipo'));
  // el texto completo de cada causa está en el tooltip, aunque la etiqueta se acorte
  const tips = titulosDe(svg);
  assert.equal(tips.length, 10);
  assert.ok(tips.includes('Sin verificación de torque al inicio de turno · 9 votos · Método'));
  // solo la más votada va en ámbar (y, si hay empate, todas las empatadas)
  const enAmbar = (s) => { let n = 0; recorrer(s, (x) => { if (x.tag === 'text' && x.attrs.fill === COLOR.ambar) n += 1; }); return n; };
  assert.equal(enAmbar(svg), 1);
  const empate = crearFigura('ishikawa', { efecto: 'E', causas: [{ categoria: 'Método', causa: 'A', votos: 5 }, { categoria: 'Máquina', causa: 'B', votos: 5 }, { categoria: 'Material', causa: 'C', votos: 1 }] });
  assert.equal(enAmbar(empate), 2);
  const ceros = crearFigura('ishikawa', { efecto: 'E', causas: [{ categoria: 'Método', causa: 'A', votos: 0 }, { categoria: 'Máquina', causa: 'B', votos: 0 }] });
  assert.equal(enAmbar(ceros), 0); // con todos los votos en 0 no hay «más votada»
});

test('LAB16: el Ishikawa sin votos no dibuja paréntesis ni la nota de votos, y una M vacía se rotula', async () => {
  instalarDomFalso();
  const { crearFigura } = await import('../js/core/figures.js');
  const r = await lab('guia', { causas: [causa('Método', 'Sin tope mecánico'), causa('Máquina', 'Prensa sin mantenimiento')] });
  const ish = figura(r, 'ishikawa');
  const svg = crearFigura(ish.figura, ish.params);
  const textos = textosDe(svg);
  assert.ok(!textos.some((t) => t.includes('votos del equipo')));
  assert.equal(textos.filter((t) => t === 'sin causas').length, 4); // Mano de obra, Material, Medición y Medio ambiente
  assert.ok(!textos.some((t) => /\(\d+\)/.test(t)));
});

test('LAB16: el Ishikawa recorta las causas muy largas a tres líneas con «…» y deja el texto completo en el tooltip', async () => {
  instalarDomFalso();
  const { crearFigura } = await import('../js/core/figures.js');
  const larga = 'Variación de temperatura en planta que afecta la consistencia del engarzado durante todo el turno nocturno de la semana';
  const svg = crearFigura('ishikawa', { efecto: 'Efecto', causas: [{ categoria: 'Medio ambiente', causa: larga, votos: null }] });
  const t = [];
  recorrer(svg, (n) => { if (n.tag === 'tspan') t.push(n.textContent); });
  assert.ok(t.some((x) => x.endsWith('…')), 'la última línea termina en «…»');
  assert.ok(titulosDe(svg).some((x) => x.startsWith(larga)));
});

test('LAB16: la figura de los porqués numera los pasos, marca los verificados y termina con la causa raíz', async () => {
  instalarDomFalso();
  const { crearFigura } = await import('../js/core/figures.js');
  const r = await lab('excel');
  const por = figura(r, 'porques');
  const svg = crearFigura(por.figura, por.params);
  assert.match(svg.attrs['aria-label'], /5 pasos del problema a la causa raíz/);
  const t = textosDe(svg);
  assert.deepEqual(t.filter((x) => /^¿Por qué\? \d$/.test(x)), ['¿Por qué? 1', '¿Por qué? 2', '¿Por qué? 3', '¿Por qué? 4', '¿Por qué? 5']);
  assert.ok(t.includes('Conclusión'));
  assert.ok(t.includes('PROBLEMA') && t.includes('CAUSA RAÍZ'));
  assert.equal(t.filter((x) => x.startsWith('Verificada')).length, 4);
  assert.equal(t.filter((x) => x.startsWith('Sin verificar')).length, 1);
  assert.ok(t.includes('Categoría: Método / sistema'));
  // sin problema ni causa raíz, solo los pasos
  const solo = crearFigura('porques', { pasos: [{ respuesta: 'A', verificada: 'No' }] });
  assert.ok(!textosDe(solo).includes('PROBLEMA'));
  assert.ok(textosDe(solo).some((x) => x.startsWith('Sin verificar')));
});
