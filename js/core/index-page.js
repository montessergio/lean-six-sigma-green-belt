/**
 * index-page.js — Página de inicio: índice de sesiones agrupadas por fase DMAIC.
 *
 * Todo sale de los datos: content/manifest.json (lista de sesiones, textos de uso, pie) y la «ficha»
 * de cada sesión (content/sesiones/<id>/sesion.json). Agregar una sesión = agregar su id al manifiesto.
 * La fase de cada sesión es el campo «fase» de su propio JSON, así que no hay una segunda lista que mantener.
 */
import { FASES, SITIO } from './config.js';
import { cargarManifest, cargarSesionFicha } from './loader.js';
import { crearFigura } from './figures.js';
import { h, inline, vaciar } from './dom.js';

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */

/** 300 → «5 h», 185 → «3 h 5 min», 45 → «45 min». */
export function textoDuracion(minutos) {
  if (!Number.isFinite(minutos) || minutos <= 0) return '';
  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const hrefSesion = (id, ancla = '') => `sesion.html?s=${encodeURIComponent(id)}${ancla}`;

/* ------------------------------------------------------------------ */
/* Secciones                                                            */
/* ------------------------------------------------------------------ */

function encabezado(manifest) {
  return h(
    'header',
    { class: 'portada-indice' },
    h(
      'div',
      null,
      manifest.marca ? h('p', { class: 'portada-indice__marca' }, inline(manifest.marca)) : null,
      h('h1', null, inline(manifest.titulo ?? SITIO.nombre)),
      manifest.subtitulo ? h('p', { class: 'portada-indice__sub' }, inline(manifest.subtitulo)) : null
    ),
    h('div', { class: 'portada-indice__rueda', aria: { hidden: 'true' } }, crearFigura('rueda', { etiquetas: true, centro: 'DMAIC' }))
  );
}

/** Tarjetas «Cómo usar este material». El código entre `acentos graves` se muestra como tecla (<kbd>). */
function seccionUso(manifest) {
  const tarjetas = manifest.uso ?? [];
  if (!tarjetas.length) return null;
  return h(
    'section',
    { class: 'seccion', aria: { labelledby: 'titulo-uso' } },
    h('h2', { class: 'seccion__titulo', id: 'titulo-uso' }, 'Cómo usar este material'),
    h(
      'div',
      { class: 'uso' },
      tarjetas.map((t) => {
        const texto = h('p', { class: 'uso__texto' }, inline(t.texto ?? ''));
        texto.querySelectorAll('code').forEach((c) => {
          const tecla = h('kbd', null, c.textContent);
          c.replaceWith(tecla);
        });
        return h('div', { class: 'uso__item' }, h('span', { class: 'uso__etiqueta' }, t.etiqueta ?? ''), texto);
      })
    )
  );
}

/** Orden de las fases en el índice: el de FASES (Fundamentos, Definir, Medir, Analizar, Mejorar, Controlar). */
function agruparPorFase(sesiones) {
  const grupos = new Map(Object.keys(FASES).map((f) => [f, []]));
  for (const s of sesiones) {
    const fase = grupos.has(s.fase) ? s.fase : 'general';
    grupos.get(fase).push(s);
  }
  return grupos;
}

function seccionRuta(grupos) {
  return h(
    'section',
    { class: 'seccion', aria: { labelledby: 'titulo-ruta' } },
    h('h2', { class: 'seccion__titulo', id: 'titulo-ruta' }, 'Ruta de aprendizaje · DMAIC'),
    h(
      'div',
      { class: 'ruta' },
      [...grupos].map(([fase, lista]) => {
        const contenido = [
          h('span', { class: 'ruta__nombre' }, FASES[fase].nombre),
          h(
            'span',
            { class: 'ruta__sesion' },
            lista.length ? lista.map((s, i) => [i > 0 ? ' · ' : null, h('b', null, s.id.toUpperCase())]) : 'Sin sesiones'
          ),
        ];
        const clase = `ruta__fase ruta__fase--${fase}`;
        return lista.length ? h('a', { class: clase, href: `#sesion-${lista[0].id}` }, contenido) : h('div', { class: clase }, contenido);
      })
    )
  );
}

function enlaceLab(lab, sesion) {
  const disponible = Boolean(lab.archivo) && sesion.estado !== 'planeada';
  const contenido = [h('b', null, `LAB ${lab.numero}`), lab.nombre];
  return disponible
    ? h('a', { class: 'sesion__lab', href: hrefSesion(sesion.id, `#${lab.id}`) }, contenido)
    : h('span', { class: 'sesion__lab sesion__lab--planeado', title: 'Laboratorio planeado: aún no está disponible' }, contenido);
}

function tarjetaSesion(sesion) {
  const planeada = sesion.estado === 'planeada';
  const labs = sesion.labs ?? [];
  const modulos = sesion.modulos ?? [];
  const meta = [textoDuracion(sesion.duracionMin) || sesion.duracion, labs.length ? plural(labs.length, 'laboratorio', 'laboratorios') : null].filter(Boolean).join(' · ');
  return h(
    'article',
    { class: ['sesion', planeada && 'sesion--planeada'], id: `sesion-${sesion.id}` },
    h('span', { class: 'sesion__num' }, sesion.id.toUpperCase()),
    h(
      'div',
      { class: 'sesion__cuerpo' },
      h('h3', { class: 'sesion__titulo' }, h('a', { href: hrefSesion(sesion.id) }, inline(sesion.titulo)), planeada ? h('span', { class: 'sesion__estado' }, 'Planeada') : null),
      sesion.descripcion ? h('p', { class: 'sesion__desc' }, inline(sesion.descripcion)) : null,
      h(
        'div',
        { class: 'sesion__meta' },
        modulos.length
          ? h('span', { class: 'sesion__modulos' }, modulos.map((m) => h('span', { class: `modulo-chip modulo-chip--${FASES[m.fase] ? m.fase : sesion.fase}`, title: m.nombre ?? null }, m.id)))
          : null,
        meta
      ),
      labs.length ? h('div', { class: 'sesion__labs' }, labs.map((l) => enlaceLab(l, sesion))) : null
    )
  );
}

function bloquesDeSesiones(grupos) {
  return [...grupos]
    .filter(([, lista]) => lista.length)
    .map(([fase, lista]) => {
      const minutos = lista.reduce((suma, s) => suma + (Number(s.duracionMin) || 0), 0);
      const nLabs = lista.reduce((suma, s) => suma + (s.labs?.length ?? 0), 0);
      const resumen = [textoDuracion(minutos), nLabs ? plural(nLabs, 'laboratorio', 'laboratorios') : null].filter(Boolean).join(' · ');
      return h(
        'section',
        { class: 'sesion-bloque', aria: { label: FASES[fase].nombre } },
        h('div', { class: 'sesion-bloque__encabezado' }, h('h2', { class: 'sesion-bloque__titulo' }, FASES[fase].nombre), resumen ? h('span', { class: 'sesion-bloque__duracion' }, resumen) : null),
        h('div', { class: 'sesiones-lista' }, lista.map(tarjetaSesion))
      );
    });
}

function pie(manifest, sesiones) {
  const p = manifest.pie ?? {};
  const minutos = sesiones.reduce((suma, s) => suma + (Number(s.duracionMin) || 0), 0);
  const nLabs = sesiones.reduce((suma, s) => suma + (s.labs?.length ?? 0), 0);
  const disponibles = sesiones.filter((s) => s.estado !== 'planeada').length;
  const lineas = [
    `${plural(sesiones.length, 'sesión', 'sesiones')} (${disponibles} disponibles) · ${textoDuracion(minutos)} · ${plural(nLabs, 'laboratorio', 'laboratorios')} en total.`,
    ...(p.lineas ?? []),
  ];
  return h(
    'footer',
    { class: 'indice__pie' },
    lineas.map((t) => h('p', null, inline(t))),
    p.enlaces?.length
      ? h('p', null, p.enlaces.map((e, i) => [i > 0 ? ' · ' : null, h('a', { href: e.href, target: /^https?:/.test(e.href) ? '_blank' : null, rel: /^https?:/.test(e.href) ? 'noopener noreferrer' : null }, e.texto)]))
      : null,
    h('p', null, `${manifest.autor ? `${manifest.autor} · ` : ''}Versión ${SITIO.version}`)
  );
}

/* ------------------------------------------------------------------ */
/* Arranque                                                             */
/* ------------------------------------------------------------------ */

function mostrarError(raiz, error) {
  vaciar(raiz);
  raiz.appendChild(
    h('main', { class: 'indice' }, h('div', { class: 'aviso aviso--error' }, h('strong', null, 'No se pudo cargar el índice. '), error.message ?? String(error)))
  );
}

/** Construye la página de inicio dentro de `raiz`. */
export async function iniciarIndice(raiz) {
  let manifest;
  let sesiones;
  try {
    manifest = await cargarManifest();
    sesiones = await Promise.all((manifest.sesiones ?? []).map((id) => cargarSesionFicha(id)));
  } catch (e) {
    mostrarError(raiz, e);
    return;
  }
  const grupos = agruparPorFase(sesiones);
  vaciar(raiz);
  raiz.appendChild(h('main', { class: 'indice' }, encabezado(manifest), seccionUso(manifest), seccionRuta(grupos), bloquesDeSesiones(grupos), pie(manifest, sesiones)));
  document.title = `${manifest.titulo ?? SITIO.nombre} · Sesiones y laboratorios`;
  // Enlace directo a una sesión (viene del botón «← Índice» del visor).
  if (location.hash.length > 1) {
    const destino = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    destino?.scrollIntoView({ block: 'center' });
  }
}
