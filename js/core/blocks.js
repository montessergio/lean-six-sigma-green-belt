/**
 * blocks.js — Registro de bloques de contenido.
 *
 * Una diapositiva de contenido es una lista de bloques ({ "tipo": "...", ... }) escritos en
 * JSON. Cada tipo se resuelve aquí con una función (bloque, ctx) → Nodo. Para crear un tipo
 * nuevo: escribe su función, regístrala en BLOQUES (o con registrarBloque) y dale estilo en
 * css/deck.css. No hay que tocar la navegación.
 *
 * ctx = { irALab(idLab, valores), katex(), laboratorios: Set<string>, sesion }
 */
import { agregar, h, inline, sinMarcas } from './dom.js';
import { crearFigura } from './figures.js';
import { ESTADOS, FASES } from './config.js';

export const BLOQUES = {};

export function registrarBloque(tipo, fn) {
  BLOQUES[tipo] = fn;
}

export function construirBloque(bloque, ctx) {
  const fn = BLOQUES[bloque?.tipo];
  if (!fn) {
    return h('div', { class: 'aviso aviso--error' }, h('strong', null, 'Bloque desconocido: '), `«${bloque?.tipo ?? '(sin tipo)'}». Revisa el JSON de la diapositiva.`);
  }
  try {
    return fn(bloque, ctx);
  } catch (e) {
    console.error(`[blocks] error en bloque «${bloque.tipo}»`, e);
    return h('div', { class: 'aviso aviso--error' }, h('strong', null, `Error en el bloque «${bloque.tipo}»: `), e.message);
  }
}

export function construirBloques(lista, ctx) {
  const frag = document.createDocumentFragment();
  (lista ?? []).forEach((b) => frag.appendChild(construirBloque(b, ctx)));
  return frag;
}

const parrafos = (valor) => (Array.isArray(valor) ? valor : valor ? [valor] : []);

/* ------------------------------------------------------------------ */
/* Texto y listas                                                       */
/* ------------------------------------------------------------------ */

BLOQUES.texto = (b) =>
  h('p', { class: ['texto', b.tenue && 'texto--tenue', b.ancho && 'texto--ancho'] }, inline(b.texto));

BLOQUES.lista = (b) => {
  const el = h(b.ordenada ? 'ol' : 'ul', { class: ['lista', b.limpia && 'lista--limpia'] });
  (b.items ?? []).forEach((t) => el.appendChild(h('li', null, inline(t))));
  return el;
};

BLOQUES.titulo = (b) => h('h3', { class: 'bloque__titulo' }, inline(b.texto));

/* ------------------------------------------------------------------ */
/* Tarjetas                                                             */
/* ------------------------------------------------------------------ */

function tarjeta(b) {
  const clases = ['tarjeta'];
  (parrafos(b.estilo)).forEach((e) => clases.push(`tarjeta--${e}`));
  const el = h('div', { class: clases });
  if (b.etiqueta) el.appendChild(h('span', { class: 'tarjeta__etiqueta' }, inline(b.etiqueta)));
  if (b.titulo) el.appendChild(h('h4', { class: 'tarjeta__titulo' }, inline(b.titulo)));
  parrafos(b.texto ?? b.textos).forEach((t) => el.appendChild(h('p', { class: 'tarjeta__texto' }, inline(t))));
  if (b.items) {
    const ul = h(b.ordenada ? 'ol' : 'ul', { class: 'lista' });
    b.items.forEach((t) => ul.appendChild(h('li', null, inline(t))));
    el.appendChild(ul);
  }
  return el;
}
BLOQUES.tarjeta = tarjeta;

BLOQUES.nota = (b) => tarjeta({ estilo: 'aviso', etiqueta: b.etiqueta ?? 'NOTA', ...b });

BLOQUES.rejilla = (b, ctx) => {
  const hijos = b.hijos ?? (b.tarjetas ?? []).map((t) => ({ tipo: 'tarjeta', ...t }));
  const el = h('div', { class: 'rejilla', style: { '--cols': b.columnas ?? Math.min(3, Math.max(1, hijos.length)) } });
  hijos.forEach((x) => el.appendChild(construirBloque(x, ctx)));
  return el;
};

BLOQUES.columnas = (b, ctx) => {
  const [izq, der] = b.proporcion ?? [1, 1];
  const col = (lista) => h('div', { class: 'columnas__col' }, construirBloques(lista, ctx));
  return h('div', { class: 'columnas', style: { '--izq': `${izq}fr`, '--der': `${der}fr`, alignItems: b.alinear ?? null } }, col(b.izq), col(b.der));
};

/* ------------------------------------------------------------------ */
/* Pasos numerados (botones rectangulares con numeral verde)            */
/* ------------------------------------------------------------------ */

BLOQUES.pasos = (b) => {
  const pasos = b.pasos ?? [];
  const lista = h('ol', { class: 'pasos', style: { '--n': b.columnas ?? pasos.length } });
  pasos.forEach((p, i) => {
    const paso = typeof p === 'string' ? { texto: p } : p;
    const fase = paso.fase && FASES[paso.fase] ? paso.fase : null;
    lista.appendChild(
      h(
        'li',
        { class: ['paso', fase && `paso--${fase}`] },
        h('span', { class: 'paso__num' }, paso.numero ?? String((b.inicio ?? 1) + i)),
        h('span', { class: 'paso__txt' }, inline(paso.texto)),
        paso.sub ? h('span', { class: 'paso__sub' }, inline(paso.sub)) : null
      )
    );
  });
  return h('div', { class: 'pasos-bloque' }, b.titulo ? h('h3', { class: 'bloque__titulo' }, inline(b.titulo)) : null, lista);
};

/* ------------------------------------------------------------------ */
/* Fórmulas (KaTeX con respaldo en texto)                               */
/* ------------------------------------------------------------------ */

BLOQUES.formula = (b, ctx) => {
  const raiz = h('div', { class: 'formula', role: 'math', aria: { label: sinMarcas(b.texto ?? b.tex ?? '') } });
  if (b.etiqueta) raiz.appendChild(h('span', { class: 'etiqueta formula__etiqueta' }, inline(b.etiqueta)));
  const texto = h('div', { class: 'formula__texto' }, b.texto ?? b.tex ?? '');
  const tex = h('div', { class: 'formula__tex' });
  raiz.append(texto, tex);
  if (b.nota) raiz.appendChild(h('p', { class: 'figura__pie' }, inline(b.nota)));
  if (b.tex && ctx.katex) {
    ctx.katex().then((katex) => {
      if (!katex) return; // sin conexión: queda el texto plano
      try {
        katex.render(b.tex, tex, { displayMode: true, throwOnError: true });
        raiz.classList.add('is-katex');
      } catch (e) {
        console.warn('[blocks] KaTeX no pudo con la fórmula, se deja el texto:', b.tex, e.message);
      }
    });
  }
  return raiz;
};

/* ------------------------------------------------------------------ */
/* Tablas y leyendas                                                    */
/* ------------------------------------------------------------------ */

BLOQUES.tabla = (b) => {
  const columnas = (b.columnas ?? []).map((c) => (typeof c === 'string' ? { t: c } : c));
  const tabla = h('table', { class: 'tabla' });
  if (b.pie) tabla.appendChild(h('caption', null, inline(b.pie)));
  tabla.appendChild(h('thead', null, h('tr', null, columnas.map((c) => h('th', { class: c.num ? 'num' : null }, inline(c.t))))));
  const resaltar = new Set(b.resaltar ?? []);
  tabla.appendChild(
    h(
      'tbody',
      null,
      (b.filas ?? []).map((fila, i) =>
        h('tr', { class: resaltar.has(i) ? 'is-resaltada' : null }, fila.map((celda, j) => h('td', { class: columnas[j]?.num ? 'num' : null }, inline(String(celda)))))
      )
    )
  );
  return h('div', { class: 'bloque-tabla' }, b.titulo ? h('h3', { class: 'bloque__titulo' }, inline(b.titulo)) : null, h('div', { class: 'tabla-wrap' }, tabla));
};

const MUESTRAS = new Set(['ejemplo', 'captura', 'formula']);

BLOQUES.leyenda = (b) =>
  h(
    'div',
    { class: 'leyenda' },
    (b.items ?? []).map((it) => {
      const m = it.muestra;
      let muestra;
      if (MUESTRAS.has(m)) muestra = h('span', { class: `muestra muestra--${m}` });
      else if (ESTADOS[m]) muestra = h('span', { class: `chip-estado chip-estado--${m}` }, h('span', { 'aria-hidden': 'true' }, ESTADOS[m].simbolo), ESTADOS[m].nombre);
      else muestra = null;
      return h('span', { class: 'leyenda__item' }, muestra, inline(it.texto ?? ''));
    })
  );

BLOQUES.metricas = (b) =>
  h(
    'div',
    { class: 'metricas', style: { '--cols': b.columnas ?? (b.items ?? []).length } },
    (b.items ?? []).map((m) =>
      h(
        'div',
        { class: ['metrica', m.color && `metrica--${m.color}`] },
        h('span', { class: 'metrica__valor' }, inline(m.valor)),
        h('span', { class: 'metrica__etiqueta' }, inline(m.etiqueta ?? '')),
        m.nota ? h('span', { class: 'metrica__nota' }, inline(m.nota)) : null
      )
    )
  );

/* ------------------------------------------------------------------ */
/* Figuras e imágenes                                                   */
/* ------------------------------------------------------------------ */

BLOQUES.figura = (b) => {
  const fig = h('figure', { class: 'figura', style: b.anchoMax ? { maxWidth: b.anchoMax, margin: '0 auto' } : null }, crearFigura(b.figura, b.params ?? {}));
  if (b.pie) fig.appendChild(h('figcaption', { class: 'figura__pie' }, inline(b.pie)));
  return fig;
};

BLOQUES.imagen = (b) => {
  const fig = h('figure', { class: 'figura' }, h('img', { src: b.src, alt: b.alt ?? '', loading: 'lazy', style: { maxHeight: '56vh', width: 'auto' } }));
  if (b.pie) fig.appendChild(h('figcaption', { class: 'figura__pie' }, inline(b.pie)));
  return fig;
};

/* ------------------------------------------------------------------ */
/* Enlaces a laboratorios y ejercicios                                  */
/* ------------------------------------------------------------------ */

function botonLab(lab, valores, ctx, texto) {
  const existe = !ctx.laboratorios || ctx.laboratorios.has(lab);
  return h(
    'button',
    {
      type: 'button',
      class: 'btn',
      disabled: !existe,
      title: existe ? null : 'Este laboratorio aún no está disponible',
      onclick: () => ctx.irALab(lab, valores ?? null),
    },
    texto
  );
}

BLOQUES.abrirLab = (b, ctx) => h('div', { class: 'enlace-lab' }, botonLab(b.lab, b.valores, ctx, b.texto ?? `Abrir LAB ${b.numero ?? ''} →`));

function ejercicio(b, ctx) {
  const el = h('article', { class: 'ejercicio' });
  if (b.numero) el.appendChild(h('span', { class: 'etiqueta' }, `EJERCICIO ${b.numero}`));
  el.appendChild(h('h4', { class: 'ejercicio__titulo' }, inline(b.titulo ?? '')));
  parrafos(b.texto).forEach((t) => el.appendChild(h('p', { class: 'ejercicio__texto' }, inline(t))));
  if (b.verificacion) {
    el.appendChild(
      h('details', { class: 'verificacion' }, h('summary', null, b.etiquetaVerificacion ?? 'Comparar con la guía'), parrafos(b.verificacion).map((t) => h('p', null, inline(t))))
    );
  }
  const pie = h('div', { class: 'ejercicio__pie' });
  if (b.lab) {
    pie.appendChild(h('span', { class: 'ejercicio__tag' }, `LAB ${b.numeroLab ?? ''}`.trim()));
    pie.appendChild(botonLab(b.lab, b.valores, ctx, b.boton ?? `Cargar en LAB ${b.numeroLab ?? ''} →`.replace('  ', ' ')));
  } else {
    pie.appendChild(h('span', { class: 'ejercicio__tag' }, b.etiqueta ?? 'Con calculadora o Excel'));
  }
  el.appendChild(pie);
  return el;
}
BLOQUES.ejercicio = ejercicio;

BLOQUES.ejercicios = (b, ctx) =>
  h(
    'div',
    { class: 'rejilla', style: { '--cols': b.columnas ?? 3 } },
    (b.items ?? []).map((e) => ejercicio(e, ctx))
  );

/* ------------------------------------------------------------------ */
/* Cierre, referencias, enlaces y sesiones planeadas                    */
/* ------------------------------------------------------------------ */

BLOQUES.cierre = (b) => h('ol', { class: 'cierre__lista' }, (b.puntos ?? []).map((p) => h('li', null, inline(p))));

BLOQUES.referencias = (b) =>
  h('div', { class: 'referencias' }, b.titulo ? h('span', { class: 'etiqueta' }, inline(b.titulo)) : null, (b.items ?? []).map((r) => h('p', null, inline(r))));

BLOQUES.enlaces = (b) =>
  h(
    'ul',
    { class: 'lista lista--limpia enlaces' },
    (b.items ?? []).map((e) => h('li', null, h('a', { href: e.href }, inline(e.texto)), e.nota ? h('span', { class: 'texto--tenue' }, ' — ', inline(e.nota)) : null))
  );

BLOQUES.planeada = (b) => {
  const lista = (titulo, items) =>
    items?.length
      ? h(
          'div',
          { class: 'tarjeta' },
          h('span', { class: 'tarjeta__etiqueta' }, titulo),
          h('ul', { class: 'planeada-lista' }, items.map((x) => h('li', null, h('b', null, x.id), inline(x.titulo))))
        )
      : null;
  return h(
    'div',
    { class: 'planeada' },
    h('p', { class: 'texto texto--tenue' }, inline(b.nota ?? 'Esta sesión ya tiene su lugar en la ruta DMAIC. Su contenido se agrega con el mismo patrón que las sesiones 1 y 2 (consulta el README).')),
    h('div', { class: 'rejilla', style: { '--cols': 2 } }, lista('MÓDULOS DE LA GUÍA', b.modulos), lista('LABORATORIOS PLANEADOS', b.labs))
  );
};

/** Escape hatch: un bloque con HTML ya construido por código (no se usa desde JSON). */
export function bloqueDeNodos(nodos) {
  const cont = h('div');
  agregar(cont, nodos);
  return cont;
}
