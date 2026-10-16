/**
 * dom.js — Utilidades mínimas para construir DOM sin plantillas HTML en cadenas.
 *
 * Todo texto del contenido entra por textContent o por `inline()`, que solo admite un
 * puñado de marcas seguras; nunca se asigna innerHTML con contenido del JSON.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Agrega hijos de cualquier tipo: nodos, cadenas, números, arreglos anidados; ignora null/false. */
export function agregar(padre, hijo) {
  if (hijo === null || hijo === undefined || hijo === false) return padre;
  if (Array.isArray(hijo)) {
    hijo.forEach((x) => agregar(padre, x));
  } else if (hijo instanceof Node) {
    padre.appendChild(hijo);
  } else {
    padre.appendChild(document.createTextNode(String(hijo)));
  }
  return padre;
}

function aplicarProps(el, props) {
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class' || k === 'clase') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'texto') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith('--')) el.style.setProperty(p, val);
        else el.style[p] = val;
      }
    } else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'aria') for (const [a, val] of Object.entries(v)) el.setAttribute(`aria-${a}`, val);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
}

/** h('div', { class: 'x', dataset: { a: 1 } }, hijo1, hijo2) → HTMLElement */
export function h(etiqueta, props = null, ...hijos) {
  const el = document.createElement(etiqueta);
  if (props) aplicarProps(el, props);
  hijos.forEach((x) => agregar(el, x));
  return el;
}

/** Igual que h() pero para elementos SVG. */
export function s(etiqueta, props = null, ...hijos) {
  const el = document.createElementNS(SVG_NS, etiqueta);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class' || k === 'clase') el.setAttribute('class', v);
      else if (k === 'texto') el.textContent = v;
      else el.setAttribute(k, v);
    }
  }
  hijos.forEach((x) => agregar(el, x));
  return el;
}

export function vaciar(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Agrupa llamadas repetidas: ejecuta fn solo cuando pasan `ms` sin nuevas llamadas. */
export function debounce(fn, ms = 80) {
  let t = null;
  const f = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  f.cancelar = () => clearTimeout(t);
  return f;
}

/** Ejecuta fn como máximo una vez por cuadro de animación (para deslizadores). */
export function porCuadro(fn) {
  let pendiente = false;
  let ultimo = [];
  return (...args) => {
    ultimo = args;
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      fn(...ultimo);
    });
  };
}

/* ------------------------------------------------------------------ */
/* Texto con marcas mínimas                                            */
/* ------------------------------------------------------------------ */

/**
 * Marcas admitidas en los textos del contenido:
 *   **negrita**   *cursiva*   `código`   [texto](enlace)   x^{2} (superíndice)   x_{i} (subíndice)
 * Un salto de línea (\n) se convierte en <br>. Cualquier otro HTML se muestra como texto literal.
 */
const MARCAS = new RegExp(
  [
    '\\*\\*(?=\\S)(.+?)(?<=\\S)\\*\\*', // 1 negrita
    '\\*(?=[^\\s*])(.+?)(?<=[^\\s*])\\*', // 2 cursiva
    '`([^`]+)`', // 3 código
    '\\[([^\\]]+)\\]\\(([^)\\s]+)\\)', // 4 y 5 enlace
    '\\^\\{([^}]+)\\}', // 6 superíndice
    '_\\{([^}]+)\\}', // 7 subíndice
  ].join('|'),
  'g'
);

const ENLACE_SEGURO = /^(https?:\/\/|mailto:|#|\.{0,2}\/|[A-Za-z0-9_\-./]+(\?|#|$))/i;

function cuerpoInline(texto, destino) {
  let ultimo = 0;
  for (const m of texto.matchAll(MARCAS)) {
    if (m.index > ultimo) destino.appendChild(document.createTextNode(texto.slice(ultimo, m.index)));
    if (m[1] !== undefined) destino.appendChild(h('strong', null, cuerpoInlineFrag(m[1])));
    else if (m[2] !== undefined) destino.appendChild(h('em', null, cuerpoInlineFrag(m[2])));
    else if (m[3] !== undefined) destino.appendChild(h('code', null, m[3]));
    else if (m[4] !== undefined) {
      const url = m[5];
      if (ENLACE_SEGURO.test(url) && !/^javascript:/i.test(url)) {
        const externo = /^https?:\/\//i.test(url);
        destino.appendChild(h('a', { href: url, target: externo ? '_blank' : null, rel: externo ? 'noopener noreferrer' : null }, m[4]));
      } else destino.appendChild(document.createTextNode(m[4]));
    } else if (m[6] !== undefined) destino.appendChild(h('sup', null, m[6]));
    else if (m[7] !== undefined) destino.appendChild(h('sub', null, m[7]));
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) destino.appendChild(document.createTextNode(texto.slice(ultimo)));
  return destino;
}

function cuerpoInlineFrag(texto) {
  return cuerpoInline(texto, document.createDocumentFragment());
}

/** Convierte un texto con marcas en un fragmento de DOM seguro. */
export function inline(texto) {
  const frag = document.createDocumentFragment();
  const lineas = String(texto ?? '').split('\n');
  lineas.forEach((linea, i) => {
    if (i > 0) frag.appendChild(document.createElement('br'));
    cuerpoInline(linea, frag);
  });
  return frag;
}

/** Texto plano sin marcas (para atributos como aria-label o title). */
export function sinMarcas(texto) {
  return String(texto ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\^\{([^}]+)\}/g, '$1')
    .replace(/_\{([^}]+)\}/g, '$1');
}

/** ¿El foco está en un campo donde las flechas y letras deben escribirse, no navegar? */
export function enCampoDeEdicion(el = document.activeElement) {
  if (!el) return false;
  const t = el.tagName;
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable === true;
}
