/**
 * lab-ui.js — Interfaz de un laboratorio a partir de su definición declarativa.
 *
 * Esta capa NO calcula estadística: lee los campos, llama a def.calcular(entradas) y pinta lo
 * que devuelve (salidas, semáforos, umbral, supuesto, gráficas, tablas). El contrato completo
 * está documentado en lab-contrato.js.
 *
 * Código de color de los campos (igual que las plantillas Excel):
 *   amarillo = ejemplo · blanco = captura propia · azul claro = fórmula (resultados).
 */
import { h, vaciar, inline, debounce, porCuadro } from './dom.js';
import { ESTADOS, CELDAS } from './config.js';
import { num, leerNumero } from './format.js';
import { dibujar, redimensionar, liberar } from './plot.js';
import { alCambiarDeps } from './deps.js';
import { crearFigura } from './figures.js';
import { parsearNumeros } from '../lib/stats.js';
import {
  aplicarValores, columnasDe, copiarEstado, estadoInicial, estadoVacio, filaVacia, tieneEstado, validarDefinicion, validarResultado,
} from './lab-contrato.js';

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */

function igual(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => igual(a[k], b[k]));
}

const decimalesDe = (paso) => {
  const t = String(paso);
  return t.includes('.') ? t.split('.')[1].length : 0;
};

/** Número → texto para un campo editable (sin ruido de coma flotante). */
const textoNumero = (v) => (Number.isFinite(v) ? String(+Number(v).toPrecision(12)) : '');

const comoLista = (x) => (Array.isArray(x) ? x : x ? [x] : []);

/** Aplica el color de celda: amarillo (ejemplo) o blanco (captura). */
function pintarCelda(el, spec, esEjemplo) {
  const forzadaCaptura = spec.celda === 'captura';
  el.classList.toggle('celda--ejemplo', !forzadaCaptura && esEjemplo);
  el.classList.toggle('celda--captura', forzadaCaptura || !esEjemplo);
}

const chipEstado = (estado) => {
  const e = ESTADOS[estado] ?? ESTADOS['sin-datos'];
  return h('span', { class: `chip-estado chip-estado--${ESTADOS[estado] ? estado : 'sin-datos'}` }, h('span', { aria: { hidden: 'true' } }, e.simbolo), e.nombre);
};

/* ------------------------------------------------------------------ */
/* Campos de entrada                                                    */
/* ------------------------------------------------------------------ */

function cabeceraCampo(spec, idDom, extra = null) {
  return h(
    'div',
    { class: 'campo__fila' },
    h('label', { class: 'campo__etiqueta', for: idDom }, inline(spec.etiqueta), spec.unidad ? h('small', null, `(${spec.unidad})`) : null),
    extra
  );
}

const ayudaCampo = (spec) => (spec.ayuda ? h('span', { class: 'campo__ayuda' }, inline(spec.ayuda)) : null);

function campoSlider(spec, api) {
  const idDom = `${api.prefijo}-${spec.id}`;
  const dec = spec.dec ?? decimalesDe(spec.paso ?? 1);
  const rango = h('input', { type: 'range', id: idDom, class: 'slider', min: spec.min, max: spec.max, step: spec.paso ?? 'any' });
  const caja = h('input', { type: 'text', class: 'campo__valor', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', aria: { label: `${spec.etiqueta}: valor exacto` } });
  const mostrar = (v) => `${num(v, dec)}${spec.unidad ? ` ${spec.unidad}` : ''}`;
  const acotar = (v) => Math.min(spec.max, Math.max(spec.min, v));
  const poner = (v) => {
    rango.value = String(v);
    caja.value = mostrar(v);
  };
  rango.addEventListener('input', () => {
    const v = Number(rango.value);
    caja.value = mostrar(v);
    api.cambiar(spec.id, v);
  });
  caja.addEventListener('change', () => {
    let v = leerNumero(caja.value.replace(/[^\d.,\-−/]/g, ''));
    if (!Number.isFinite(v)) v = api.estado()[spec.id];
    v = acotar(v);
    poner(v);
    api.cambiar(spec.id, v);
  });
  caja.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      caja.blur();
    }
  });
  caja.addEventListener('focus', () => caja.select());
  const el = h('div', { class: ['campo', spec.color && `campo--c-${spec.color}`] }, cabeceraCampo({ ...spec, unidad: null }, idDom, caja), rango, ayudaCampo(spec));
  return { el, fijar: (v) => poner(acotar(Number.isFinite(v) ? v : spec.valor)), refrescar() {} };
}

function campoNumero(spec, api) {
  const idDom = `${api.prefijo}-${spec.id}`;
  const entrada = h('input', { type: 'text', id: idDom, class: 'entrada', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', placeholder: spec.marcador ?? '' });
  entrada.addEventListener('input', () => {
    const t = entrada.value.trim();
    const v = t === '' ? NaN : leerNumero(t);
    entrada.setAttribute('aria-invalid', String(t !== '' && !Number.isFinite(v)));
    api.cambiar(spec.id, v);
  });
  const el = h('div', { class: ['campo', spec.color && `campo--c-${spec.color}`] }, cabeceraCampo(spec, idDom), entrada, ayudaCampo(spec));
  return {
    el,
    fijar: (v) => {
      entrada.value = textoNumero(v);
      entrada.setAttribute('aria-invalid', 'false');
    },
    refrescar(estado, ejemplo) {
      const v = estado[spec.id];
      pintarCelda(entrada, spec, igual(v, ejemplo[spec.id]));
      const fuera = Number.isFinite(v) && ((spec.min !== undefined && v < spec.min) || (spec.max !== undefined && v > spec.max));
      entrada.classList.toggle('entrada--invalida', fuera);
    },
  };
}

function campoTexto(spec, api, area = false) {
  const idDom = `${api.prefijo}-${spec.id}`;
  const entrada = area
    ? h('textarea', { id: idDom, class: 'entrada', rows: spec.filasTexto ?? 4, spellcheck: 'false', placeholder: spec.marcador ?? '' })
    : h('input', { type: 'text', id: idDom, class: 'entrada', autocomplete: 'off', placeholder: spec.marcador ?? '' });
  entrada.addEventListener('input', () => api.cambiar(spec.id, entrada.value));
  const el = h('div', { class: 'campo' }, cabeceraCampo(spec, idDom), entrada, ayudaCampo(spec));
  return {
    el,
    fijar: (v) => {
      entrada.value = v ?? '';
    },
    refrescar(estado, ejemplo) {
      pintarCelda(entrada, spec, igual(estado[spec.id], ejemplo[spec.id]));
    },
  };
}

function campoDatos(spec, api) {
  const idDom = `${api.prefijo}-${spec.id}`;
  const area = h('textarea', {
    id: idDom, class: 'entrada', rows: spec.filasTexto ?? 6, spellcheck: 'false', autocomplete: 'off',
    placeholder: spec.marcador ?? 'Pega o escribe los valores separados por espacios, comas o saltos de línea',
  });
  const resumen = h('div', { class: 'campo__resumen' });
  const alerta = h('span', { class: 'campo__ayuda campo__ayuda--alerta', hidden: true });
  const pintarResumen = (valores, invalidos) => {
    vaciar(resumen);
    resumen.append(h('b', null, 'n'), ` = ${valores.length}`);
    alerta.hidden = invalidos.length === 0;
    alerta.textContent = invalidos.length ? `⚠ ${invalidos.length} valor(es) no numérico(s) ignorado(s): ${invalidos.slice(0, 4).join(', ')}${invalidos.length > 4 ? '…' : ''}` : '';
  };
  area.addEventListener('input', () => {
    const { valores, invalidos } = parsearNumeros(area.value);
    pintarResumen(valores, invalidos);
    api.cambiar(spec.id, valores);
  });
  const el = h('div', { class: 'campo' }, cabeceraCampo(spec, idDom), area, resumen, alerta, ayudaCampo(spec));
  return {
    el,
    fijar: (v) => {
      const lista = Array.isArray(v) ? v : [];
      area.value = lista.join(' ');
      pintarResumen(lista, []);
    },
    refrescar(estado, ejemplo) {
      pintarCelda(area, spec, igual(estado[spec.id], ejemplo[spec.id]));
    },
  };
}

function campoOpcion(spec, api) {
  const idDom = `${api.prefijo}-${spec.id}`;
  const usaSegmentos = spec.opciones.length <= 4 && spec.estilo !== 'lista';
  if (!usaSegmentos) {
    const sel = h('select', { id: idDom, class: 'entrada' }, spec.opciones.map((o) => h('option', { value: o.valor }, o.texto)));
    sel.addEventListener('change', () => api.cambiar(spec.id, sel.value));
    return {
      el: h('div', { class: 'campo' }, cabeceraCampo(spec, idDom), sel, ayudaCampo(spec)),
      fijar: (v) => {
        sel.value = String(v);
      },
      refrescar() {},
    };
  }
  const botones = spec.opciones.map((o) =>
    h('button', { type: 'button', class: 'btn', dataset: { valor: o.valor }, 'aria-pressed': 'false', title: o.ayuda ?? null, onclick: () => api.cambiar(spec.id, o.valor, true) }, o.texto)
  );
  const marcar = (v) => botones.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.valor === String(v))));
  return {
    el: h('div', { class: 'campo' }, h('div', { class: 'campo__fila' }, h('span', { class: 'campo__etiqueta' }, inline(spec.etiqueta))), h('div', { class: 'segmentos', role: 'group', aria: { label: spec.etiqueta } }, botones), ayudaCampo(spec)),
    fijar: marcar,
    refrescar(estado) {
      marcar(estado[spec.id]);
    },
  };
}

function campoCasilla(spec, api) {
  const idDom = `${api.prefijo}-${spec.id}`;
  const caja = h('input', { type: 'checkbox', id: idDom });
  caja.addEventListener('change', () => api.cambiar(spec.id, caja.checked));
  return {
    el: h('div', { class: 'campo' }, h('label', { class: 'casilla', for: idDom }, caja, h('span', null, inline(spec.etiqueta))), ayudaCampo(spec)),
    fijar: (v) => {
      caja.checked = Boolean(v);
    },
    refrescar() {},
  };
}

/** Tabla editable: filas = objetos { idColumna: valor }; columnas pueden depender del estado. */
function campoTabla(spec, api) {
  const idDom = `${api.prefijo}-${spec.id}`;
  const thead = h('thead');
  const tbody = h('tbody');
  const envoltura = h('div', { class: 'tabla-edit-wrap' }, h('table', { class: 'tabla-edit', id: idDom }, thead, tbody));
  const pie = h('div', { class: 'tabla-edit-pie' });
  const tituloEl = spec.etiqueta ? h('div', { class: 'campo__fila' }, h('span', { class: 'campo__etiqueta' }, inline(spec.etiqueta))) : null;
  const maxFilas = spec.maxFilas ?? 12;
  const minFilas = spec.minFilas ?? 1;
  const permiteFilas = spec.agregar !== false;
  let firma = '';
  let celdas = []; // { nodo, fila, col }
  let fijas = []; // celdas de solo lectura: { nodo, fila, col }
  let cabeceras = []; // { nodo, col }

  const filas = () => api.estado()[spec.id];
  const columnas = () => columnasDe(spec, api.estado());
  const firmaDe = (cols) => JSON.stringify(cols.map((c) => [c.id, c.tipo, c.min ?? null, c.max ?? null, c.ancho ?? null])) + filas().length;
  const etiquetaDe = (c) => (typeof c.etiqueta === 'function' ? c.etiqueta(api.estado()) : c.etiqueta ?? c.id);

  function celdaDom(col, fila, i) {
    const comun = { class: 'entrada', style: col.ancho ? { minWidth: col.ancho } : null, aria: { label: `${etiquetaDe(col)}, fila ${i + 1}` } };
    let nodo;
    if (col.tipo === 'fijo') {
      nodo = h('span', { class: 'celda-fija' });
      fijas.push({ nodo, fila: i, col });
      return h('td', null, nodo);
    }
    if (col.tipo === 'opcion') {
      nodo = h('select', comun, (col.opciones ?? []).map((o) => h('option', { value: o.valor }, o.texto)));
      nodo.value = String(fila[col.id]);
      nodo.addEventListener('change', () => {
        fila[col.id] = nodo.value;
        api.cambiar(spec.id, filas());
      });
    } else if (col.tipo === 'numero') {
      nodo = h('input', { ...comun, type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', value: textoNumero(fila[col.id]) });
      nodo.addEventListener('input', () => {
        const t = nodo.value.trim();
        fila[col.id] = t === '' ? NaN : leerNumero(t);
        api.cambiar(spec.id, filas());
      });
    } else {
      nodo = h('input', { ...comun, type: 'text', autocomplete: 'off', value: fila[col.id] ?? '' });
      nodo.addEventListener('input', () => {
        fila[col.id] = nodo.value;
        api.cambiar(spec.id, filas());
      });
    }
    celdas.push({ nodo, fila: i, col });
    return h('td', null, nodo);
  }

  function actualizarPie() {
    vaciar(pie);
    if (!permiteFilas) return;
    pie.appendChild(
      h('button', { type: 'button', class: 'btn', disabled: filas().length >= maxFilas, onclick: agregar }, spec.etiquetaAgregar ?? '+ Fila')
    );
  }

  function agregar() {
    if (filas().length >= maxFilas) return;
    filas().push(filaVacia(spec, api.estado()));
    construir();
    const ultima = tbody.lastElementChild?.querySelector('input,select');
    ultima?.focus();
    api.cambiar(spec.id, filas());
  }

  function quitar(i) {
    if (filas().length <= minFilas) return;
    filas().splice(i, 1);
    construir();
    api.cambiar(spec.id, filas());
  }

  function construir() {
    const cols = columnas();
    firma = firmaDe(cols);
    vaciar(thead);
    vaciar(tbody);
    celdas = [];
    fijas = [];
    cabeceras = [];
    const numerar = spec.numerar !== false;
    thead.appendChild(
      h(
        'tr',
        null,
        numerar ? h('th', null, '#') : null,
        cols.map((c) => {
          const th = h('th', { title: c.ayuda ?? null }, etiquetaDe(c));
          cabeceras.push({ nodo: th, col: c });
          return th;
        }),
        permiteFilas ? h('th') : null
      )
    );
    filas().forEach((fila, i) => {
      tbody.appendChild(
        h(
          'tr',
          null,
          numerar ? h('td', { class: 'col-n' }, String(i + 1)) : null,
          cols.map((c) => celdaDom(c, fila, i)),
          permiteFilas
            ? h('td', { class: 'col-x' }, filas().length > minFilas ? h('button', { type: 'button', class: 'btn-x', aria: { label: `Quitar la fila ${i + 1}` }, onclick: () => quitar(i) }, '×') : null)
            : null
        )
      );
    });
    actualizarPie();
  }

  return {
    el: h('div', { class: 'campo' }, tituloEl, envoltura, pie, ayudaCampo(spec)),
    fijar() {
      construir();
    },
    refrescar(estado, ejemplo) {
      const cols = columnas();
      if (firmaDe(cols) !== firma) {
        construir();
        return;
      }
      cabeceras.forEach(({ nodo, col }) => {
        const t = etiquetaDe(col);
        if (nodo.textContent !== t) nodo.textContent = t;
      });
      fijas.forEach(({ nodo, fila, col }) => {
        const t = col.texto ? col.texto(estado, estado[spec.id][fila], fila) : '';
        if (nodo.textContent !== t) nodo.textContent = t;
      });
      const base = ejemplo[spec.id] ?? [];
      celdas.forEach(({ nodo, fila, col }) => {
        const actual = estado[spec.id][fila]?.[col.id];
        const orig = base[fila]?.[col.id];
        pintarCelda(nodo, { celda: col.celda ?? spec.celda }, fila < base.length && igual(actual, orig));
        if (col.tipo === 'numero') {
          const fuera = Number.isFinite(actual) && ((col.min !== undefined && actual < col.min) || (col.max !== undefined && actual > col.max));
          nodo.classList.toggle('entrada--invalida', fuera);
        }
      });
    },
  };
}

function campoNota(spec) {
  return { el: h('p', { class: 'campo__ayuda' }, inline(spec.texto ?? '')), fijar() {}, refrescar() {} };
}

function campoSeccion(spec) {
  return { el: h('span', { class: 'etiqueta' }, inline(spec.etiqueta ?? '')), fijar() {}, refrescar() {} };
}

const FABRICAS = {
  slider: campoSlider,
  numero: campoNumero,
  texto: (s, a) => campoTexto(s, a, false),
  area: (s, a) => campoTexto(s, a, true),
  datos: campoDatos,
  opcion: campoOpcion,
  casilla: campoCasilla,
  tabla: campoTabla,
  nota: campoNota,
  seccion: campoSeccion,
};

/* ------------------------------------------------------------------ */
/* Pintado de resultados                                                */
/* ------------------------------------------------------------------ */

function bloqueCriterio(spec, clase, tituloPorDefecto) {
  if (!spec) return null;
  const el = h('div', { class: ['criterio', clase] });
  el.appendChild(h('span', { class: 'criterio__titulo' }, spec.titulo ?? tituloPorDefecto));
  if (spec.estado) el.appendChild(h('div', null, chipEstado(spec.estado)));
  if (spec.texto) el.appendChild(h('p', { class: 'criterio__texto' }, inline(spec.texto)));
  if (spec.filas?.length) {
    el.appendChild(
      h('table', null, h('tbody', null, spec.filas.map((f) => h('tr', { class: f.activa ? 'is-activa' : null }, h('td', null, inline(f.rango)), h('td', null, inline(f.texto))))))
    );
  }
  if (spec.detalle) el.appendChild(h('p', { class: 'criterio__texto' }, inline(spec.detalle)));
  return el;
}

function celdaTabla(c) {
  if (c !== null && typeof c === 'object') {
    if (c.estado) return h('td', null, chipEstado(c.estado), c.texto ? ` ${c.texto}` : null);
    return h('td', { class: [c.num && 'num', c.formula && 'celda-formula'] }, inline(String(c.texto ?? '')));
  }
  return h('td', null, inline(String(c ?? '')));
}

function pintarTabla(nodo, t) {
  vaciar(nodo);
  const cols = t.columnas.map((c) => (typeof c === 'string' ? { t: c } : c));
  const tabla = h('table', { class: 'tabla' });
  if (t.pie) tabla.appendChild(h('caption', null, inline(t.pie)));
  tabla.appendChild(h('thead', null, h('tr', null, cols.map((c) => h('th', { class: c.num ? 'num' : null }, inline(c.t))))));
  const resaltar = new Set(t.resaltar ?? []);
  tabla.appendChild(
    h(
      'tbody',
      null,
      t.filas.map((fila, i) => {
        const tr = h('tr', { class: resaltar.has(i) ? 'is-resaltada' : null });
        fila.forEach((c, j) => {
          const td = celdaTabla(c);
          if (cols[j]?.num) td.classList.add('num');
          if (cols[j]?.formula) td.classList.add('celda-formula');
          tr.appendChild(td);
        });
        return tr;
      })
    )
  );
  if (t.titulo) nodo.appendChild(h('p', { class: 'grafica__titulo' }, inline(t.titulo)));
  nodo.appendChild(h('div', { class: 'tabla-wrap' }, tabla));
}

/* ------------------------------------------------------------------ */
/* Montaje                                                              */
/* ------------------------------------------------------------------ */

/**
 * Construye el laboratorio dentro de `contenedor` (el <section> de la diapositiva).
 * Devuelve la instancia { cargar, reiniciar, limpiar, activar, destruir, estado } o null si la
 * definición no cumple el contrato (en cuyo caso se muestra el detalle en pantalla).
 */
export function montarLab(contenedor, def, ctx = {}) {
  vaciar(contenedor);
  const problemas = validarDefinicion(def);
  if (problemas.length) {
    contenedor.appendChild(
      h('div', { class: 'slide__contenido' }, h('div', { class: 'aviso aviso--error' }, h('strong', null, `El laboratorio «${def?.id ?? '?'}» no cumple el contrato: `), h('ul', { class: 'lista' }, problemas.map((p) => h('li', null, p)))))
    );
    return null;
  }

  const valoresIniciales = estadoInicial(def);
  let estado = copiarEstado(valoresIniciales);
  let ejemplo = copiarEstado(valoresIniciales);
  let ultimoResultado = null;
  let presetActivo = null;
  const campos = new Map(); // id → campo
  const botonesPreset = new Map();
  const nodosVisuales = new Map(); // id → { caja, lienzo, tipo }
  const nodosTabla = [];

  const api = {
    prefijo: def.id,
    estado: () => estado,
    ejemplo: () => ejemplo,
    cambiar(id, valor, sincronizar = false) {
      estado[id] = valor;
      if (sincronizar) campos.get(id)?.fijar(valor);
      marcarPreset(null);
      refrescarCampos();
      programar();
    },
  };

  /* ---- panel ---- */
  const nodos = {
    salidas: h('div', { class: 'lab__salidas', 'aria-live': 'off' }),
    semaforos: h('div', { class: 'lab__semaforos' }),
    criterios: h('div', { class: 'lab__seccion' }),
    avisos: h('div', { class: 'lab__avisos' }),
  };

  const seccion = (etiqueta, ...hijos) => h('section', { class: 'lab__seccion' }, h('span', { class: 'etiqueta' }, etiqueta), ...hijos);

  const cabecera = h(
    'header',
    { class: 'lab__cabecera' },
    h('span', { class: 'pildora' }, `LABORATORIO ${def.numero}${def.modulo ? ` · ${def.modulo}` : ''}`),
    def.antetitulo ? h('div', { class: 'lab__antetitulo' }, def.antetitulo) : null,
    h('h2', { class: 'lab__titulo' }, def.titulo),
    h('p', { class: 'lab__desc' }, inline(def.resumen))
  );

  const presets = def.presets ?? [];
  const barraPresets = presets.length
    ? seccion('EJEMPLOS', h('div', { class: 'presets' }, presets.map((p) => {
        const b = h('button', { type: 'button', class: 'btn', title: p.ayuda ?? null, onclick: () => cargar(p.valores, p.id) }, p.etiqueta);
        botonesPreset.set(p.id, b);
        return b;
      })))
    : null;

  const acciones = h(
    'div',
    { class: 'lab__acciones' },
    h('button', { type: 'button', class: 'btn', onclick: () => reiniciar() }, 'Restablecer ejemplo'),
    def.permiteLimpiar === false ? null : h('button', { type: 'button', class: 'btn', onclick: () => limpiar() }, 'Limpiar captura')
  );

  const codigoColor = h(
    'div',
    { class: 'codigo-color', aria: { label: 'Código de color de las celdas' } },
    ['ejemplo', 'captura', 'formula'].map((k) => h('span', null, h('i', { class: `muestra muestra--${k}` }), CELDAS[k]))
  );

  const seccionEntradas = h('section', { class: 'lab__seccion' }, h('span', { class: 'etiqueta' }, 'ENTRADAS'));
  for (const spec of def.entradas) {
    const fabrica = FABRICAS[spec.tipo];
    const campo = fabrica(spec, api);
    if (tieneEstado(spec)) campos.set(spec.id, campo);
    seccionEntradas.appendChild(campo.el);
  }
  seccionEntradas.append(acciones, codigoColor);

  const preguntas = def.preguntas?.length
    ? h('section', { class: 'lab__pregunta' }, h('span', { class: 'etiqueta' }, 'PREGUNTAS PARA EL ANALISTA'), def.preguntas.map((q) => h('p', null, inline(q))))
    : null;

  const panel = h(
    'aside',
    { class: 'lab__panel', aria: { label: `Panel de control del laboratorio ${def.numero}` } },
    cabecera,
    barraPresets,
    seccionEntradas,
    h('section', { class: 'lab__seccion' }, h('span', { class: 'etiqueta' }, 'RESULTADOS (FÓRMULAS)'), nodos.salidas),
    h('section', { class: 'lab__seccion' }, h('span', { class: 'etiqueta' }, 'SEMÁFOROS'), nodos.semaforos),
    nodos.criterios,
    preguntas
  );

  const area = h('div', { class: 'lab__area', aria: { label: 'Gráficas y tablas del laboratorio' } });
  const raiz = h('div', { class: ['lab', def.panelAncho && 'lab--panel-ancho'], dataset: { lab: def.id } }, panel, area);
  contenedor.appendChild(raiz);

  /* ---- sincronización ---- */
  function sincronizarCampos() {
    for (const [id, campo] of campos) campo.fijar(estado[id]);
    refrescarCampos();
  }

  function refrescarCampos() {
    for (const campo of campos.values()) campo.refrescar(estado, ejemplo);
  }

  function marcarPreset(id) {
    presetActivo = id;
    for (const [pid, b] of botonesPreset) b.classList.toggle('is-activo', pid === id);
  }

  /** Carga valores (de un preset o de un ejercicio): quedan como nuevo «ejemplo» (amarillo). */
  function cargar(valores, idPreset = null) {
    estado = aplicarValores(def, estado, valores);
    ejemplo = copiarEstado(estado);
    sincronizarCampos();
    marcarPreset(idPreset);
    recalcular();
  }

  function reiniciar() {
    estado = copiarEstado(valoresIniciales);
    ejemplo = copiarEstado(valoresIniciales);
    sincronizarCampos();
    marcarPreset(null);
    recalcular();
  }

  function limpiar() {
    estado = estadoVacio(def, estado);
    sincronizarCampos();
    marcarPreset(null);
    recalcular();
  }

  /* ---- cálculo y pintado ---- */
  const programar = porCuadro(() => recalcular());

  function avisosDeCampos() {
    const msgs = [];
    for (const spec of def.entradas) {
      if (spec.tipo !== 'numero' && spec.tipo !== 'slider') continue;
      const v = estado[spec.id];
      if (!Number.isFinite(v)) continue;
      if ((spec.min !== undefined && v < spec.min) || (spec.max !== undefined && v > spec.max)) {
        const lim = spec.min !== undefined && spec.max !== undefined ? `entre ${num(spec.min, 6).replace(/\.?0+$/, '')} y ${num(spec.max, 6).replace(/\.?0+$/, '')}` : spec.min !== undefined ? `≥ ${spec.min}` : `≤ ${spec.max}`;
        msgs.push(`«${spec.etiqueta}» debe estar ${lim}.`);
      }
    }
    return msgs;
  }

  function recalcular() {
    let resultado;
    try {
      resultado = def.calcular(copiarEstado(estado), ctx) ?? {};
    } catch (e) {
      console.error(`[lab ${def.id}] error en calcular()`, e);
      resultado = { aviso: [`Error de cálculo: ${e.message}`] };
    }
    if (ctx.depurar) {
      const p = validarResultado(resultado, def);
      if (p.length) console.warn(`[lab ${def.id}] resultado fuera de contrato:`, p);
    }
    ultimoResultado = resultado;
    pintarResultado(resultado);
  }

  function pintarResultado(r) {
    // Salidas (celdas de fórmula)
    vaciar(nodos.salidas);
    nodos.salidas.className = r.salidasColumnas === 2 ? 'lab__salidas salidas-rejilla' : 'lab__salidas';
    for (const s of r.salidas ?? []) {
      nodos.salidas.appendChild(
        h(
          'div',
          { class: ['salida', s.color && `salida--c-${s.color}`, s.vacia && 'salida--vacia', s.ancha && 'salida--ancha'] },
          h('span', { class: 'salida__etiqueta' }, inline(s.etiqueta), s.detalle ? h('small', null, s.detalle) : null),
          h('span', { class: ['salida__valor', s.pequeno && 'salida__valor--s'] }, s.valor),
          s.nota ? h('span', { class: 'salida__nota' }, inline(s.nota)) : null
        )
      );
    }
    // Semáforos
    vaciar(nodos.semaforos);
    for (const sm of r.semaforos ?? []) {
      nodos.semaforos.appendChild(h('div', { class: 'semaforo' }, h('span', { class: 'semaforo__nombre' }, sm.nombre), chipEstado(sm.estado), h('span', { class: 'semaforo__texto' }, inline(sm.texto))));
    }
    // Umbral y supuesto
    vaciar(nodos.criterios);
    nodos.criterios.append(
      bloqueCriterio(r.umbral ?? def.umbral, '', 'Umbral de interpretación'),
      bloqueCriterio(r.supuesto ?? def.supuesto, 'criterio--supuesto', 'Supuesto estadístico')
    );
    pintarArea(r);
  }

  function nodoVisual(id, tipo, titulo, { ancha, alta }) {
    let n = nodosVisuales.get(id);
    if (!n || n.tipo !== tipo) {
      const lienzo = h('div', { class: 'grafica__lienzo', dataset: { id } });
      const tituloEl = h('p', { class: 'grafica__titulo' });
      const caja = h('div', { class: 'grafica', dataset: { grafica: id } }, tituloEl, lienzo);
      n = { caja, lienzo, tituloEl, tipo };
      nodosVisuales.set(id, n);
    }
    n.tituloEl.textContent = titulo ?? '';
    n.caja.classList.toggle('grafica--figura', tipo === 'figura');
    n.caja.classList.toggle('grafica--ancha', Boolean(ancha));
    n.caja.classList.toggle('grafica--alta', Boolean(alta));
    return n;
  }

  function pintarArea(r) {
    const deseados = [nodos.avisos];
    // Avisos
    vaciar(nodos.avisos);
    for (const msg of [...avisosDeCampos(), ...comoLista(r.aviso)]) nodos.avisos.appendChild(h('div', { class: 'aviso' }, inline(msg)));
    // Gráficas (Plotly) y figuras (SVG)
    const vivos = new Set();
    for (const g of r.graficas ?? []) {
      vivos.add(g.id);
      const n = nodoVisual(g.id, 'grafica', g.titulo, g);
      deseados.push(n.caja);
      dibujar(n.lienzo, g);
    }
    for (const f of r.figuras ?? []) {
      vivos.add(f.id);
      const n = nodoVisual(f.id, 'figura', f.titulo, f);
      deseados.push(n.caja);
      vaciar(n.lienzo);
      n.lienzo.classList.add('grafica__lienzo--figura');
      n.lienzo.appendChild(crearFigura(f.figura, f.params ?? {}));
    }
    for (const [id, n] of nodosVisuales) {
      if (!vivos.has(id)) {
        if (n.tipo === 'grafica') liberar(n.lienzo);
        nodosVisuales.delete(id);
      }
    }
    // Tablas
    (r.tablas ?? []).forEach((t, i) => {
      nodosTabla[i] ??= h('div', { class: 'lab__tabla' });
      pintarTabla(nodosTabla[i], t);
      deseados.push(nodosTabla[i]);
    });
    nodosTabla.length = (r.tablas ?? []).length;
    if (deseados.length === 1 && !nodos.avisos.childElementCount) {
      deseados.push(h('div', { class: 'lab__vacio' }, r.vacio ?? 'Captura datos para ver los resultados.'));
    }
    const actuales = Array.from(area.children);
    if (actuales.length !== deseados.length || actuales.some((nodo, i) => nodo !== deseados[i])) area.replaceChildren(...deseados);
  }

  // Cuando Plotly termina de cargar (o falla), se vuelve a pintar para pasar de tabla a gráfica.
  const darseDeBaja = alCambiarDeps(() => {
    if (ultimoResultado) pintarArea(ultimoResultado);
  });

  sincronizarCampos();
  recalcular();

  const instancia = {
    def,
    cargar: (valores) => cargar(valores, null),
    reiniciar,
    limpiar,
    estado: () => copiarEstado(estado),
    activar() {
      for (const n of nodosVisuales.values()) if (n.tipo === 'grafica') redimensionar(n.lienzo);
    },
    destruir() {
      darseDeBaja();
      for (const n of nodosVisuales.values()) if (n.tipo === 'grafica') liberar(n.lienzo);
      programar.cancelar?.();
      vaciar(contenedor);
    },
  };
  void debounce;
  void presetActivo;
  return instancia;
}
