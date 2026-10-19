#!/usr/bin/env node
/**
 * validar-contenido.mjs — Verificador de contenido del sitio (Node ≥ 18, sin dependencias).
 *
 *   node tools/validar-contenido.mjs              # estructura + laboratorios (presets y valores de ejercicios)
 *   node tools/validar-contenido.mjs --sin-labs   # solo estructura (útil si el laboratorio aún no existe)
 *   node tools/validar-contenido.mjs s1 s2        # solo esas sesiones
 *
 * Comprueba: manifiesto, fichas de sesión, temas incluidos, tipos y campos de cada bloque, ids únicos,
 * enlaces diapositiva → laboratorio, y (con laboratorios) que cada preset y cada `valores` de un ejercicio
 * o botón «abrirLab» use ids de entrada reales y produzca un resultado válido. Termina con código 1 si hay errores.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERADORES } from '../js/lib/graficas.js';
import { FASES } from '../js/core/config.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const SIN_LABS = args.includes('--sin-labs');
const SOLO = args.filter((a) => !a.startsWith('--'));

const errores = [];
const avisos = [];
const error = (donde, msg) => errores.push(`ERROR  ${donde}: ${msg}`);
const aviso = (donde, msg) => avisos.push(`AVISO  ${donde}: ${msg}`);

const leer = (ruta) => {
  const abs = path.join(RAIZ, ruta);
  if (!existsSync(abs)) { error(ruta, 'no existe el archivo'); return null; }
  try { return JSON.parse(readFileSync(abs, 'utf8')); } catch (e) { error(ruta, `JSON no válido: ${e.message}`); return null; }
};

/* ---------- Registros leídos del código (sin importar módulos con DOM) ---------- */
const textoBloques = readFileSync(path.join(RAIZ, 'js/core/blocks.js'), 'utf8');
const TIPOS = new Set([...textoBloques.matchAll(/^BLOQUES\.([A-Za-z_]+)\s*=/gm)].map((m) => m[1]));
const textoFiguras = readFileSync(path.join(RAIZ, 'js/core/figures.js'), 'utf8');
const bloqueFiguras = /export const FIGURAS = \{([\s\S]*?)\n\};/.exec(textoFiguras)?.[1] ?? '';
const FIGURAS = new Set([...bloqueFiguras.matchAll(/^\s*(?:'([a-z-]+)'|([a-zA-Z]+))\s*[:,]/gm)].map((m) => m[1] ?? m[2]));
const ESTILOS_TARJETA = new Set(['grande', 'sutil', 'acento', 'aviso', 'coral']);
const MUESTRAS = new Set(['ejemplo', 'captura', 'formula', 'cumple', 'atencion', 'critico', 'informativo', 'sin-datos']);

/** Campos obligatorios por tipo de bloque (además de que el tipo exista en BLOQUES). */
const REQUERIDOS = {
  texto: ['texto'], lista: ['items'], titulo: ['texto'], pasos: ['pasos'], formula: ['tex', 'texto'],
  tabla: ['columnas', 'filas'], leyenda: ['items'], metricas: ['items'], figura: ['figura'], imagen: ['src', 'alt'],
  abrirLab: ['lab'], ejercicio: ['titulo'], ejercicios: ['items'], cierre: ['puntos'], referencias: ['items'], enlaces: ['items'],
};
const IGNORAR_PALABRAS = new Set(['tipo', 'tex', 'src', 'href', 'lab', 'valores', 'figura', 'params', 'generador', 'datos', 'layout', 'respaldo', 'id', 'estilo', 'color', 'muestra', 'clase', 'numeroLab', 'boton']);

/* ---------- Utilidades de texto ---------- */
const palabras = (s) => (String(s).match(/[\p{L}\p{N}]+/gu) ?? []).length;

function contarPalabras(nodo, clave = '') {
  if (IGNORAR_PALABRAS.has(clave)) return 0; // incluye objetos y listas completos (p. ej. «valores» de un laboratorio)
  if (typeof nodo === 'string') return palabras(nodo);
  if (Array.isArray(nodo)) return nodo.reduce((s, x) => s + contarPalabras(x, clave), 0);
  if (nodo && typeof nodo === 'object') return Object.entries(nodo).reduce((s, [k, v]) => s + contarPalabras(v, k), 0);
  return 0;
}

/** Cada cadena visible: revisa asteriscos sueltos (cursiva accidental). */
function revisarMarcas(nodo, donde, clave = '') {
  if (IGNORAR_PALABRAS.has(clave)) return;
  if (typeof nodo === 'string') {
    const sinNegritas = nodo.replace(/\*\*[^*]+\*\*/g, '').replace(/\*[^*\s][^*]*\*/g, '');
    if (sinNegritas.includes('*')) aviso(donde, `asterisco suelto en «${nodo.slice(0, 50)}…» (se mostraría como cursiva o negrita rota)`);
    if (/<\/?[a-z][^>]*>/i.test(nodo)) aviso(donde, `contiene HTML («${nodo.slice(0, 40)}…»): se mostrará como texto literal`);
  } else if (Array.isArray(nodo)) nodo.forEach((x) => revisarMarcas(x, donde, clave));
  else if (nodo && typeof nodo === 'object') Object.entries(nodo).forEach(([k, v]) => revisarMarcas(v, donde, k));
}

/* ---------- Laboratorios ---------- */
const helpers = SIN_LABS ? null : await import('../tests/helpers.mjs');
const contrato = SIN_LABS ? null : await import('../js/core/lab-contrato.js');
const defsLab = new Map(); // archivo → definición (o null si falló)
const trabajoLabs = [];

async function definicion(archivo, donde) {
  if (defsLab.has(archivo)) return defsLab.get(archivo);
  let def = null;
  if (!existsSync(path.join(RAIZ, 'labs', archivo))) error(donde, `no existe labs/${archivo}`);
  else {
    try { def = await helpers.cargarLab(archivo); } catch (e) { error(donde, `labs/${archivo} no se pudo importar: ${e.message}`); }
  }
  defsLab.set(archivo, def);
  return def;
}

async function probarLab(lab, donde) {
  const def = await definicion(lab.archivo, donde);
  if (!def) return;
  const dl = `${donde} · labs/${lab.archivo}`;
  if (def.id !== lab.id) error(dl, `el laboratorio declara id «${def.id}» pero la sesión lo llama «${lab.id}»`);
  if (def.numero !== lab.numero) error(dl, `el laboratorio declara numero «${def.numero}» pero la sesión dice «${lab.numero}»`);
  for (const p of contrato.validarDefinicion(def)) error(dl, `definición: ${p}`);
  if (!(def.presets ?? []).length) aviso(dl, 'no tiene presets');
  for (const preset of def.presets ?? []) {
    const ids = new Set((def.entradas ?? []).filter((e) => contrato.tieneEstado(e)).map((e) => e.id));
    for (const k of Object.keys(preset.valores ?? {})) if (!ids.has(k)) error(dl, `preset «${preset.id}»: «${k}» no es una entrada del laboratorio`);
    try {
      const r = await helpers.ejecutar(lab.archivo, preset.id);
      for (const p of r.problemas) error(dl, `preset «${preset.id}»: ${p}`);
    } catch (e) { error(dl, `preset «${preset.id}» lanzó una excepción: ${e.message}`); }
  }
  try {
    const r = await helpers.ejecutarVacio(lab.archivo);
    for (const p of r.problemas) error(dl, `captura vacía: ${p}`);
  } catch (e) { error(dl, `la captura vacía lanzó una excepción: ${e.message}`); }
}

/** Un botón/ejercicio que carga `valores` en un laboratorio. */
async function probarValores(labId, valores, sesion, donde) {
  const lab = (sesion.labs ?? []).find((l) => l.id === labId);
  if (!lab) { error(donde, `«${labId}» no está en la lista «labs» de la sesión ${sesion.id}`); return; }
  if (SIN_LABS || !lab.archivo || lab.estado === 'planeada') return;
  const def = await definicion(lab.archivo, donde);
  if (!def || !valores) return;
  const ids = new Set((def.entradas ?? []).filter((e) => contrato.tieneEstado(e)).map((e) => e.id));
  for (const k of Object.keys(valores)) if (!ids.has(k)) error(donde, `valores: «${k}» no es una entrada de ${labId} (${[...ids].join(', ')})`);
  try {
    const r = await helpers.ejecutar(lab.archivo, null, valores);
    for (const p of r.problemas) error(donde, `valores de ${labId}: ${p}`);
  } catch (e) { error(donde, `valores de ${labId} lanzaron una excepción: ${e.message}`); }
}

/* ---------- Bloques ---------- */
function validarBloque(b, donde, sesion) {
  if (!b || typeof b !== 'object') return error(donde, 'el bloque no es un objeto');
  if (!TIPOS.has(b.tipo)) return error(donde, `tipo de bloque desconocido: «${b.tipo}» (válidos: ${[...TIPOS].join(', ')})`);
  const d = `${donde} (${b.tipo})`;
  for (const campo of REQUERIDOS[b.tipo] ?? []) {
    const v = b[campo];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) error(d, `falta «${campo}»`);
  }
  switch (b.tipo) {
    case 'tarjeta':
    case 'nota':
      if (!(b.titulo || b.texto || b.textos || b.items)) error(d, 'la tarjeta no tiene titulo, texto, textos ni items');
      for (const e of [].concat(b.estilo ?? [])) if (!ESTILOS_TARJETA.has(e)) error(d, `estilo desconocido «${e}»`);
      break;
    case 'rejilla':
      if (!(b.tarjetas?.length || b.hijos?.length)) error(d, 'falta «tarjetas» o «hijos»');
      (b.hijos ?? []).forEach((h, i) => validarBloque(h, `${d} hijo ${i + 1}`, sesion));
      for (const [i, t] of (b.tarjetas ?? []).entries()) if (!(t.titulo || t.texto || t.textos || t.items)) error(`${d} tarjeta ${i + 1}`, 'vacía');
      break;
    case 'columnas':
      if (!(b.izq?.length || b.der?.length)) error(d, 'falta «izq» o «der»');
      (b.izq ?? []).forEach((h, i) => validarBloque(h, `${d} izq ${i + 1}`, sesion));
      (b.der ?? []).forEach((h, i) => validarBloque(h, `${d} der ${i + 1}`, sesion));
      break;
    case 'tabla': {
      const n = (b.columnas ?? []).length;
      (b.filas ?? []).forEach((f, i) => { if (!Array.isArray(f) || f.length !== n) error(d, `la fila ${i + 1} tiene ${f?.length ?? '?'} celdas y hay ${n} columnas`); });
      for (const i of b.resaltar ?? []) if (!(i >= 0 && i < (b.filas ?? []).length)) error(d, `«resaltar» apunta a la fila ${i}, que no existe`);
      if ((b.filas ?? []).length > 8) aviso(d, `${b.filas.length} filas: podría no caber en la diapositiva`);
      break;
    }
    case 'leyenda':
      for (const it of b.items ?? []) if (!MUESTRAS.has(it.muestra)) error(d, `muestra desconocida «${it.muestra}»`);
      break;
    case 'figura':
      if (b.figura && !FIGURAS.has(b.figura)) error(d, `figura desconocida «${b.figura}» (válidas: ${[...FIGURAS].join(', ')})`);
      break;
    case 'grafica':
      if (b.generador) {
        if (!GENERADORES[b.generador]) error(d, `generador desconocido «${b.generador}» (válidos: ${Object.keys(GENERADORES).join(', ')})`);
      } else {
        if (!Array.isArray(b.datos) || !b.datos.length) error(d, 'sin «generador»: faltan «datos»');
        if (!b.respaldo?.columnas || !b.respaldo?.filas) error(d, 'falta «respaldo» {columnas, filas} (tabla para el modo sin conexión)');
      }
      break;
    case 'formula':
      if (b.tex && !b.texto) error(d, 'la fórmula necesita «texto» de respaldo sin KaTeX');
      break;
    case 'abrirLab':
      probarValoresPendiente(b.lab, b.valores, sesion, d);
      break;
    case 'ejercicio':
      if (b.lab) probarValoresPendiente(b.lab, b.valores, sesion, d);
      break;
    case 'ejercicios':
      (b.items ?? []).forEach((e, i) => {
        if (!e.titulo) error(`${d} ejercicio ${i + 1}`, 'falta «titulo»');
        if (e.lab) probarValoresPendiente(e.lab, e.valores, sesion, `${d} ejercicio ${i + 1}`);
      });
      break;
    case 'pasos':
      if ((b.pasos ?? []).length > 8) aviso(d, `${b.pasos.length} pasos: podría no caber`);
      break;
    case 'planeada':
      break;
    default:
  }
}
const probarValoresPendiente = (labId, valores, sesion, donde) => trabajoLabs.push(() => probarValores(labId, valores, sesion, donde));

/* ---------- Sesiones ---------- */
function validarSesion(id) {
  const rutaS = `content/sesiones/${id}/sesion.json`;
  const s = leer(rutaS);
  if (!s) return null;
  const d = `${id}/sesion.json`;
  if (s.id !== id) error(d, `«id» es «${s.id}» y la carpeta se llama «${id}»`);
  if (!['disponible', 'planeada'].includes(s.estado)) error(d, `«estado» debe ser disponible o planeada (es «${s.estado}»)`);
  if (!FASES[s.fase]) error(d, `«fase» desconocida «${s.fase}» (válidas: ${Object.keys(FASES).join(', ')})`);
  for (const campo of ['titulo', 'descripcion', 'duracion']) if (!s[campo]) error(d, `falta «${campo}»`);
  if (!(Number(s.duracionMin) > 0)) error(d, 'falta «duracionMin» (minutos, número)');
  if (!s.portada?.titulo) error(d, 'falta «portada.titulo»');
  for (const m of s.modulos ?? []) if (!m.id || !m.nombre || !FASES[m.fase]) error(d, `módulo incompleto o con fase desconocida: ${JSON.stringify(m)}`);
  const labs = s.labs ?? [];
  const idsLab = new Set();
  for (const l of labs) {
    if (!/^lab\d{2}$/.test(l.id ?? '')) error(d, `id de laboratorio no válido «${l.id}» (debe ser labNN)`);
    if (idsLab.has(l.id)) error(d, `laboratorio repetido «${l.id}»`);
    idsLab.add(l.id);
    if (!l.numero || !l.nombre) error(d, `el laboratorio ${l.id} necesita numero y nombre`);
    if (l.archivo && !/^lab\d{2}-[a-z0-9-]+\.js$/.test(l.archivo)) error(d, `nombre de archivo de laboratorio no válido «${l.archivo}»`);
    if (l.archivo && l.estado !== 'planeada' && !existsSync(path.join(RAIZ, 'labs', l.archivo))) error(d, `no existe labs/${l.archivo} (declarado en ${l.id})`);
    if (l.archivo && l.estado !== 'planeada' && !SIN_LABS) trabajoLabs.push(() => probarLab(l, d));
  }
  if (!Array.isArray(s.slides) || !s.slides.length) { error(d, 'la lista «slides» está vacía'); return s; }

  const idsDiapositiva = new Set();
  const labsConDiapositiva = new Set();
  let n = 0;
  const registrarId = (sid, donde) => {
    if (!sid) return;
    if (idsDiapositiva.has(sid)) error(donde, `id de diapositiva repetido «${sid}»`);
    idsDiapositiva.add(sid);
  };
  const diapositiva = (sl, donde) => {
    n += 1;
    if (sl.tipo === 'portada') return;
    if (sl.tipo === 'lab') {
      if (!idsLab.has(sl.lab)) error(donde, `la diapositiva de laboratorio usa «${sl.lab}», que no está en «labs»`);
      labsConDiapositiva.add(sl.lab);
      registrarId(sl.lab, donde);
      return;
    }
    const dd = `${donde} «${sl.titulo ?? '(sin título)'}»`;
    if (!sl.titulo) error(dd, 'falta «titulo»');
    if (!Array.isArray(sl.bloques) || !sl.bloques.length) { error(dd, 'falta «bloques»'); return; }
    registrarId(sl.id, dd);
    if (sl.id && !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(sl.id)) error(dd, `id no válido «${sl.id}» (solo letras, números, - y _)`);
    sl.bloques.forEach((b, i) => validarBloque(b, `${dd} · bloque ${i + 1}`, s));
    revisarMarcas(sl, dd);
    const pal = contarPalabras({ t: sl.titulo, st: sl.subtitulo, b: sl.bloques });
    if (pal > 150) aviso(dd, `${pal} palabras visibles (recomendado ≤ ≈110): considera partirla en dos`);
    if (sl.bloques.length > 7) aviso(dd, `${sl.bloques.length} bloques (recomendado ≤ 6)`);
  };

  s.slides.forEach((sl, i) => {
    const donde = `${id}/sesion.json · diapositiva ${i + 1}`;
    if (sl && typeof sl.incluir === 'string') {
      const t = leer(`content/sesiones/${id}/${sl.incluir}`);
      if (!t) return;
      if (!Array.isArray(t.slides) || !t.slides.length) return error(`${id}/${sl.incluir}`, 'falta la lista «slides»');
      t.slides.forEach((x, j) => diapositiva(x, `${id}/${sl.incluir} · diapositiva ${j + 1}`));
    } else if (sl) diapositiva(sl, donde);
    else error(donde, 'entrada vacía');
  });
  for (const l of labs) {
    if (l.archivo && l.estado !== 'planeada' && !labsConDiapositiva.has(l.id)) aviso(d, `el laboratorio ${l.id} está declarado pero ninguna diapositiva lo muestra`);
  }
  if (s.estado === 'disponible' && s.slides[0]?.tipo !== 'portada') aviso(d, 'la primera diapositiva no es la portada');
  return { ...s, _n: n };
}

/* ---------- Ejecución ---------- */
const manifest = leer('content/manifest.json');
let totalSesiones = 0;
let totalSlides = 0;
if (manifest) {
  if (!manifest.titulo) error('manifest.json', 'falta «titulo»');
  const ids = manifest.sesiones ?? [];
  if (!ids.length) error('manifest.json', 'la lista «sesiones» está vacía');
  if (new Set(ids).size !== ids.length) error('manifest.json', 'hay ids de sesión repetidos');
  for (const id of ids) {
    if (SOLO.length && !SOLO.includes(id)) continue;
    const s = validarSesion(id);
    if (s) { totalSesiones += 1; totalSlides += s._n ?? 0; }
  }
}
for (const tarea of trabajoLabs) await tarea();

const nLabs = defsLab.size;
for (const l of avisos) console.log(l);
for (const l of errores) console.log(l);
console.log(`\n${totalSesiones} sesión(es), ${totalSlides} diapositiva(s)${SIN_LABS ? ' · laboratorios NO comprobados (--sin-labs)' : `, ${nLabs} laboratorio(s) comprobados`} → ${errores.length} error(es), ${avisos.length} aviso(s).`);
process.exit(errores.length ? 1 : 0);
