/**
 * loader.js — Capa de datos: lee manifest, sesiones, temas, caso y laboratorios.
 *
 * Toda lectura de contenido pasa por aquí; los demás módulos no conocen rutas de
 * archivos. Los errores se lanzan como ErrorCarga con un mensaje que explica qué
 * archivo falló, para mostrarlo tal cual en pantalla.
 */
import { RUTAS } from './config.js';

export class ErrorCarga extends Error {
  constructor(mensaje, { ruta = '', causa = null } = {}) {
    super(mensaje);
    this.name = 'ErrorCarga';
    this.ruta = ruta;
    this.causa = causa;
  }
}

/** Los navegadores bloquean fetch() y los módulos ES desde file://; hace falta un servidor HTTP. */
export const enArchivo = () => location.protocol === 'file:';

/** Lee y analiza un JSON. `no-cache` revalida con el servidor (ETag) para ver cambios al publicar. */
export async function cargarJSON(ruta) {
  let r;
  try {
    r = await fetch(ruta, { cache: 'no-cache' });
  } catch (e) {
    throw new ErrorCarga(`No se pudo leer «${ruta}». ¿Estás abriendo el sitio con un servidor (GitHub Pages o python -m http.server)?`, { ruta, causa: e });
  }
  if (!r.ok) throw new ErrorCarga(`No se encontró «${ruta}» (HTTP ${r.status}).`, { ruta });
  try {
    return await r.json();
  } catch (e) {
    throw new ErrorCarga(`El archivo «${ruta}» no es un JSON válido: ${e.message}`, { ruta, causa: e });
  }
}

/** Identificadores permitidos (ids de sesión, nombres de archivo): sin rutas ni caracteres raros. */
const ID_SEGURO = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const ARCHIVO_JSON = /^[A-Za-z0-9][A-Za-z0-9_.-]*\.json$/;
const ARCHIVO_LAB = /^[A-Za-z0-9][A-Za-z0-9_.-]*\.js$/;

export const esIdValido = (id) => typeof id === 'string' && ID_SEGURO.test(id);

export const cargarManifest = () => cargarJSON(RUTAS.manifest);

/** Datos compartidos del caso de la línea de arneses (usados por los laboratorios). */
export const cargarCaso = () => cargarJSON(RUTAS.caso);

/** Solo la ficha de la sesión (sin resolver los temas); es lo que necesita el índice. */
export async function cargarSesionFicha(id) {
  if (!esIdValido(id)) throw new ErrorCarga(`Identificador de sesión no válido: «${id}».`);
  const sesion = await cargarJSON(`${RUTAS.sesiones}${id}/sesion.json`);
  if (sesion.id !== id) {
    throw new ErrorCarga(`La sesión de «${RUTAS.sesiones}${id}/sesion.json» declara id «${sesion.id}», pero se esperaba «${id}».`);
  }
  return sesion;
}

/**
 * Sesión completa: sustituye cada `{ "incluir": "tema.json" }` por las diapositivas de ese
 * archivo de tema. Cada diapositiva incluida recibe `tema` (id del módulo) si no lo trae.
 */
export async function cargarSesion(id) {
  const sesion = await cargarSesionFicha(id);
  const lista = Array.isArray(sesion.slides) ? sesion.slides : [];
  const partes = await Promise.all(
    lista.map(async (entrada) => {
      if (!entrada || typeof entrada.incluir !== 'string') return [entrada];
      if (!ARCHIVO_JSON.test(entrada.incluir)) {
        throw new ErrorCarga(`Nombre de tema no válido en la sesión ${id}: «${entrada.incluir}».`);
      }
      const ruta = `${RUTAS.sesiones}${id}/${entrada.incluir}`;
      const tema = await cargarJSON(ruta);
      if (!Array.isArray(tema.slides)) throw new ErrorCarga(`El tema «${ruta}» no tiene la lista «slides».`, { ruta });
      return tema.slides.map((s) => ({ ...s, tema: s.tema ?? tema.id ?? entrada.incluir.replace(/\.json$/, '') }));
    })
  );
  return { ...sesion, slides: partes.flat() };
}

/**
 * Importa el módulo de un laboratorio por el nombre de archivo declarado en la sesión.
 * El módulo exporta por defecto la definición del laboratorio o una función (ctx) => definición.
 */
export async function importarLab(archivo) {
  if (typeof archivo !== 'string' || !ARCHIVO_LAB.test(archivo)) {
    throw new ErrorCarga(`Nombre de laboratorio no válido: «${archivo}».`);
  }
  try {
    const modulo = await import(`${RUTAS.labs}${archivo}`);
    return modulo.default;
  } catch (e) {
    throw new ErrorCarga(`No se pudo cargar el laboratorio «${archivo}»: ${e.message}`, { ruta: archivo, causa: e });
  }
}
