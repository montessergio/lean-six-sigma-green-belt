/**
 * deck.js — Visor de diapositivas de una sesión (sesion.html).
 *
 * Lee la sesión (JSON), construye una diapositiva por entrada y se encarga de:
 *   - la navegación: botones, teclado, gestos táctiles y URL (#número o #id de la diapositiva);
 *   - el contador «n / N» y la barra de progreso;
 *   - el montaje diferido de los laboratorios (se descargan al llegar a ellos);
 *   - el aviso del pie cuando KaTeX o Plotly no están disponibles (sin conexión).
 *
 * No conoce estadística ni el contenido: todo viene de los JSON de content/ y de los módulos de labs/.
 *
 * Tipos de diapositiva (campo «tipo» en el JSON):
 *   portada    → usa los datos «portada» de la sesión (píldora, título, subtítulo, curso, líneas, autor)
 *   contenido  → { etiqueta?, titulo, subtitulo?, bloques: [...] }   (tipo por omisión)
 *   lab        → { lab: "lab01" }  (el laboratorio se declara en la lista «labs» de la sesión)
 */
import { SITIO } from './config.js';
import { cargarCaso, cargarManifest, cargarSesion, importarLab } from './loader.js';
import { alCambiarDeps, avisoDeps, cargarKatex, cargarPlotly } from './deps.js';
import { construirBloques } from './blocks.js';
import { crearFigura } from './figures.js';
import { enCampoDeEdicion, h, inline, s, sinMarcas, vaciar } from './dom.js';
import { montarLab } from './lab-ui.js';

/* ------------------------------------------------------------------ */
/* Piezas de interfaz                                                   */
/* ------------------------------------------------------------------ */

/** Flecha de trazo fino para los botones redondos (más uniforme que un carácter de texto). */
function flecha(direccion) {
  const d = direccion === 'izq' ? 'M20 12 H4 M10 6 L4 12 L10 18' : 'M4 12 H20 M14 6 L20 12 L14 18';
  return s(
    'svg',
    { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('path', { d })
  );
}

function pantallaError(raiz, error) {
  vaciar(raiz);
  raiz.appendChild(
    h(
      'main',
      { class: 'deck-error' },
      h(
        'div',
        { class: 'slide__contenido' },
        h('div', { class: 'aviso aviso--error' }, h('strong', null, 'No se pudo abrir la sesión. '), error.message ?? String(error)),
        h('p', { class: 'texto texto--tenue' }, h('a', { href: 'index.html' }, '← Volver al índice'))
      )
    )
  );
}

/* ------------------------------------------------------------------ */
/* Construcción de diapositivas                                         */
/* ------------------------------------------------------------------ */

function construirPortada(sesion) {
  const p = sesion.portada ?? {};
  const fase = sesion.fase && sesion.fase !== 'general' ? sesion.fase : null;
  const lineas = Array.isArray(p.lineas) ? p.lineas : p.lineas ? [p.lineas] : [];
  const el = h(
    'section',
    { class: 'slide slide--portada' },
    h('div', { class: 'portada__rueda', aria: { hidden: 'true' } }, crearFigura('rueda', { etiquetas: false, centro: '', resaltar: fase })),
    h(
      'div',
      { class: 'slide__contenido' },
      p.pildora ? h('span', { class: 'pildora' }, p.pildora) : null,
      h('h1', { class: 'portada__titulo' }, inline(p.titulo ?? sesion.titulo)),
      p.subtitulo ? h('p', { class: 'portada__subtitulo' }, inline(p.subtitulo)) : null,
      h('div', { class: 'portada__barra' }),
      p.curso ? h('p', { class: 'portada__curso' }, inline(p.curso)) : null,
      lineas.map((t, i) => h('p', { class: ['portada__linea', i > 0 && 'portada__linea--fina'] }, inline(t))),
      p.autor ? h('p', { class: 'portada__autor' }, inline(p.autor)) : null
    ),
    h('div', { class: 'portada__sello', aria: { hidden: 'true' } }, crearFigura('sello', p.sello ?? {}))
  );
  return { el, titulo: sinMarcas(p.titulo ?? sesion.titulo) };
}

function construirContenido(def, ctx) {
  const alActivar = []; // funciones que los bloques registran para ejecutarse cada vez que se muestra la diapositiva
  const ctxSlide = { ...ctx, alActivar: (fn) => alActivar.push(fn) };
  const cabecera = [];
  if (def.etiqueta) cabecera.push(h('span', { class: 'etiqueta slide__etiqueta' }, inline(def.etiqueta)));
  if (def.titulo) cabecera.push(h('h2', { class: 'slide__titulo' }, inline(def.titulo)));
  if (def.subtitulo) cabecera.push(h('p', { class: 'slide__subtitulo' }, inline(def.subtitulo)));
  const el = h(
    'section',
    { class: ['slide', 'slide--contenido', def.clase] },
    h('div', { class: 'slide__contenido' }, cabecera, h('div', { class: 'slide__cuerpo' }, construirBloques(def.bloques, ctxSlide)))
  );
  return { el, titulo: sinMarcas(def.titulo ?? 'Diapositiva'), alActivar: alActivar.length ? () => alActivar.forEach((fn) => fn()) : undefined };
}

/**
 * Diapositiva de laboratorio: el módulo JS se importa y se monta la primera vez que se muestra.
 * `montar()` devuelve (siempre la misma) promesa con la instancia del laboratorio, o null si falló.
 */
function construirLab(def, ctx) {
  const meta = (ctx.sesion.labs ?? []).find((l) => l.id === def.lab);
  const el = h('section', { class: 'slide slide--lab', dataset: { lab: def.lab ?? '' } });
  const titulo = meta ? `Laboratorio ${meta.numero} · ${meta.nombre}` : `Laboratorio ${def.lab ?? ''}`;
  let promesa = null;

  const mostrarProblema = (titulo, detalle) => {
    vaciar(el);
    el.appendChild(h('div', { class: 'slide__contenido' }, h('div', { class: 'aviso aviso--error' }, h('strong', null, `${titulo} `), detalle)));
    return null;
  };

  const montar = () => {
    promesa ??= (async () => {
      if (!meta?.archivo) return mostrarProblema('Laboratorio no disponible.', `«${def.lab}» no está declarado con un archivo en la lista «labs» de la sesión ${ctx.sesion.id}.`);
      el.appendChild(h('p', { class: 'lab__cargando' }, 'Cargando laboratorio…'));
      try {
        const exportado = await importarLab(meta.archivo);
        const definicion = typeof exportado === 'function' ? exportado(ctx.lab) : exportado;
        return montarLab(el, definicion, ctx.lab);
      } catch (e) {
        console.error('[deck] no se pudo montar el laboratorio', def.lab, e);
        return mostrarProblema('No se pudo abrir el laboratorio.', e.message);
      }
    })();
    return promesa;
  };

  return { el, titulo, lab: def.lab, montar, alActivar: async () => (await montar())?.activar() };
}

/* ------------------------------------------------------------------ */
/* Visor                                                                */
/* ------------------------------------------------------------------ */

/**
 * Arranca el visor dentro de `raiz`. La sesión sale de ?s=<id> (por omisión, la primera del manifiesto).
 */
export async function iniciarVisor(raiz) {
  const params = new URLSearchParams(location.search);
  const depurar = params.has('depurar');

  // El manifiesto solo se usa para elegir la sesión por omisión; sin él, la sesión pedida sigue abriendo.
  const manifest = await cargarManifest().catch(() => null);
  const idSesion = params.get('s') ?? manifest?.sesiones?.[0] ?? 's0';

  let sesion;
  let caso = null;
  try {
    sesion = await cargarSesion(idSesion);
    if ((sesion.labs ?? []).some((l) => l.archivo)) caso = await cargarCaso();
  } catch (e) {
    pantallaError(raiz, e);
    return null;
  }

  const labsDisponibles = new Set((sesion.labs ?? []).filter((l) => l.archivo).map((l) => l.id));
  const ctx = {
    sesion,
    laboratorios: labsDisponibles,
    katex: cargarKatex,
    lab: { caso, depurar },
    irALab: (id, valores) => irALab(id, valores),
  };

  /* ---- diapositivas ---- */
  const slides = [];
  for (const def of sesion.slides ?? []) {
    if (!def || typeof def !== 'object') continue;
    const tipo = def.tipo ?? 'contenido';
    let diap;
    try {
      diap = tipo === 'portada' ? construirPortada(sesion) : tipo === 'lab' ? construirLab(def, ctx) : construirContenido(def, ctx);
    } catch (e) {
      console.error('[deck] error al construir una diapositiva', def, e);
      diap = { el: h('section', { class: 'slide' }, h('div', { class: 'slide__contenido' }, h('div', { class: 'aviso aviso--error' }, `Error al construir la diapositiva: ${e.message}`))), titulo: 'Error' };
    }
    slides.push({ id: def.id ?? null, tipo, ...diap });
  }
  if (!slides.length) {
    pantallaError(raiz, new Error(`La sesión «${idSesion}» no tiene diapositivas.`));
    return null;
  }
  const N = slides.length;
  slides.forEach((d, i) => {
    d.el.setAttribute('tabindex', '-1');
    d.el.setAttribute('role', 'region');
    d.el.setAttribute('aria-roledescription', 'diapositiva');
    d.el.setAttribute('aria-label', `Diapositiva ${i + 1} de ${N}: ${d.titulo}`);
  });

  /* ---- estructura de la página ---- */
  const barra = h('div', { class: 'progreso__barra' });
  const contador = h('span', { class: 'deck-pie__contador', aria: { hidden: 'true' } });
  const estadoDeps = h('span', { class: 'deck-pie__estado', id: 'estado-deps', role: 'status', hidden: true });
  const anuncio = h('div', { class: 'solo-lectores', role: 'status', aria: { live: 'polite' } });
  const botonAnterior = h('button', { type: 'button', class: 'btn-redondo', id: 'prev', aria: { label: 'Diapositiva anterior' }, title: 'Anterior (←)', onclick: () => ir(actual - 1, { deBoton: true }) }, flecha('izq'));
  const botonSiguiente = h('button', { type: 'button', class: 'btn-redondo', id: 'next', aria: { label: 'Diapositiva siguiente' }, title: 'Siguiente (→)', onclick: () => ir(actual + 1, { deBoton: true }) }, flecha('der'));
  const hrefIndice = `index.html#sesion-${sesion.id}`;
  const escenario = h('main', { class: 'deck', id: 'deck', dataset: { total: N, sesion: sesion.id } }, slides.map((d) => d.el));

  vaciar(raiz);
  raiz.append(
    h('div', { class: 'progreso no-imprimir', aria: { hidden: 'true' } }, barra),
    escenario,
    h(
      'footer',
      { class: 'deck-pie no-imprimir' },
      h('a', { class: 'deck-pie__indice', href: hrefIndice, title: 'Volver al índice (i)' }, '← Índice'),
      h('nav', { class: 'deck-pie__nav', aria: { label: 'Navegación entre diapositivas' } }, estadoDeps, contador, botonAnterior, botonSiguiente)
    ),
    anuncio
  );

  /* ---- navegación ---- */
  let actual = -1;

  const idDe = (d, i) => d.id ?? d.lab ?? String(i + 1);

  /** Posición a partir de la URL: #7 (número), #lab01 (laboratorio) o #id de una diapositiva. */
  function indiceDesdeHash() {
    const clave = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!clave) return 0;
    if (/^\d+$/.test(clave)) return Math.min(N, Math.max(1, Number(clave))) - 1;
    const i = slides.findIndex((d) => d.id === clave || d.lab === clave);
    return i >= 0 ? i : 0;
  }

  function escribirHash(i, empujar) {
    try {
      const url = `${location.pathname}${location.search}#${idDe(slides[i], i)}`;
      if (empujar) history.pushState(null, '', url);
      else history.replaceState(null, '', url);
    } catch { /* algunos contextos (iframes aislados) no permiten tocar el historial */ }
  }

  function precargarVecinos(i) {
    for (const d of slides.slice(i + 1, i + 3)) {
      if (d.tipo === 'lab') {
        const meta = (sesion.labs ?? []).find((l) => l.id === d.lab);
        if (meta?.archivo) importarLab(meta.archivo).catch(() => {});
      }
    }
  }

  /**
   * Muestra la diapositiva i.
   * @param {{empujar?:boolean, sinHistorial?:boolean, deBoton?:boolean}} opciones
   *   empujar: añade una entrada al historial (para que «Atrás» regrese);
   *   sinHistorial: la posición viene de la propia URL, no se vuelve a escribir;
   *   deBoton: se activó con un botón del pie, el foco se queda en él.
   */
  function ir(i, { empujar = false, sinHistorial = false, deBoton = false } = {}) {
    const destino = Math.min(N - 1, Math.max(0, i));
    if (destino === actual) return;
    const previa = slides[actual];
    previa?.el.classList.remove('is-activa');
    actual = destino;
    const d = slides[destino];
    d.el.classList.add('is-activa');
    d.el.scrollTop = 0;
    escenario.dataset.indice = String(destino + 1);
    escenario.dataset.tipo = d.tipo;

    barra.style.width = `${((destino + 1) / N) * 100}%`;
    contador.textContent = `${destino + 1} / ${N}`;
    botonAnterior.disabled = destino === 0;
    botonSiguiente.disabled = destino === N - 1;
    anuncio.textContent = `Diapositiva ${destino + 1} de ${N}: ${d.titulo}`;
    document.title = `${d.titulo} · ${sesion.titulo} · ${SITIO.nombre}`;
    if (!sinHistorial) escribirHash(destino, empujar);
    if (!deBoton) d.el.focus({ preventScroll: true });
    d.alActivar?.();
    precargarVecinos(destino);
  }

  async function irALab(id, valores) {
    const i = slides.findIndex((d) => d.tipo === 'lab' && d.lab === id);
    if (i < 0) return;
    ir(i, { empujar: true });
    if (valores) {
      const instancia = await slides[i].montar();
      instancia?.cargar(valores);
    }
  }

  /* ---- teclado ---- */
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const objetivo = e.target;
    if (e.key === 'Escape') {
      if (enCampoDeEdicion(objetivo)) objetivo.blur(); // sale del campo para volver a navegar con las flechas
      return;
    }
    if (enCampoDeEdicion(objetivo)) return;
    const enControl = objetivo instanceof Element && objetivo.closest('button, a, summary, [role="button"]');
    let destino = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        destino = actual + 1;
        break;
      case 'ArrowLeft':
      case 'PageUp':
        destino = actual - 1;
        break;
      case ' ':
        if (enControl) return;
        destino = e.shiftKey ? actual - 1 : actual + 1;
        break;
      case 'Home':
        destino = 0;
        break;
      case 'End':
        destino = N - 1;
        break;
      case 'i':
      case 'I':
        location.href = hrefIndice;
        return;
      default:
        return;
    }
    e.preventDefault();
    ir(destino);
  });

  /* ---- gestos táctiles (no en laboratorios: ahí los deslizadores usan el gesto horizontal) ---- */
  let toque = null;
  const ignorarGesto = (n) => n instanceof Element && n.closest('input, textarea, select, .tabla-wrap, .tabla-edit-wrap, .formula, .js-plotly-plot');
  escenario.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || slides[actual]?.tipo === 'lab' || ignorarGesto(e.target)) {
      toque = null;
      return;
    }
    toque = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  escenario.addEventListener('touchend', (e) => {
    if (!toque) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - toque.x;
    const dy = t.clientY - toque.y;
    const rapido = Date.now() - toque.t < 700;
    toque = null;
    if (rapido && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8) ir(actual + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* ---- URL (botón «Atrás», enlaces con #) ---- */
  const alCambiarUrl = () => ir(indiceDesdeHash(), { sinHistorial: true });
  window.addEventListener('popstate', alCambiarUrl);
  window.addEventListener('hashchange', alCambiarUrl);

  /* ---- aviso de dependencias externas ---- */
  const pintarEstado = () => {
    const texto = avisoDeps();
    estadoDeps.textContent = texto;
    estadoDeps.hidden = !texto;
  };
  alCambiarDeps(pintarEstado);
  pintarEstado();

  /* ---- arranque ---- */
  ir(indiceDesdeHash(), { sinHistorial: false });
  // Se precargan las bibliotecas externas tras el primer pintado: así el aviso sin conexión aparece pronto
  // y las gráficas están listas al llegar a un laboratorio. Una sesión sin laboratorios no pide Plotly.
  setTimeout(() => {
    if (JSON.stringify(sesion.slides).includes('"formula"')) cargarKatex();
    if (labsDisponibles.size || JSON.stringify(sesion.slides).includes('"grafica"')) cargarPlotly();
  }, 350);

  return { ir, irALab, total: N };
}
