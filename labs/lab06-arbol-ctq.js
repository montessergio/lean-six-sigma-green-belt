/**
 * LAB 06 · Árbol CTQ (críticos para la calidad)
 *
 * Guía: M2 §3 (necesidad → impulsor → CTQ con especificación numérica) y M2 §6 (árbol de los arneses).
 * Plantilla Excel «Arbol CTQ»: un CTQ es medible cuando tiene unidad y al menos un valor de especificación
 * (LSL, objetivo o USL); «LSL ≥ USL» y las ramas incompletas se marcan en la columna «Estado».
 * Una fila = una rama del árbol; la necesidad se repite en cada fila de sus impulsores.
 *
 * Presets: `libro` (árbol de la guía) y `excel` (hoja «Arbol CTQ», con una rama incompleta a propósito).
 */
import { corto } from '../js/core/format.js';

/** Árbol de la guía (M2 §6), por si el caso no está disponible. */
const FILAS_LIBRO = [
  { necesidad: 'Arnés funcional en la primera prueba, sin excepción', impulsor: 'Continuidad eléctrica', ctq: 'Fallas de continuidad por lote entregado', unidad: 'fallas', lsl: null, objetivo: null, usl: 0, metodo: 'Probador de continuidad, 100 %' },
  { necesidad: 'Arnés funcional en la primera prueba, sin excepción', impulsor: 'Integridad de terminales', ctq: 'Torque de terminal', unidad: 'N·m', lsl: 1.2, objetivo: null, usl: 1.5, metodo: 'Llave de torque calibrada' },
];

const t = (v) => String(v ?? '').trim();
const hay = (v) => Number.isFinite(v);

/** Especificación en una línea: «1.2 a 1.5 N·m», «≥ 173 N», «≥ 95 %, objetivo 98 %». */
function especificacion(f) {
  const u = t(f.unidad);
  const conU = (v) => `${corto(v)}${u ? ` ${u}` : ''}`;
  const partes = [];
  if (hay(f.lsl) && hay(f.usl)) partes.push(`${corto(f.lsl)} a ${conU(f.usl)}`);
  else if (hay(f.lsl)) partes.push(`≥ ${conU(f.lsl)}`);
  else if (hay(f.usl)) partes.push(`≤ ${conU(f.usl)}`);
  if (hay(f.objetivo)) partes.push(`objetivo ${conU(f.objetivo)}`);
  return partes.join(', ');
}

/**
 * Diagnóstico de una fila. Devuelve null si la fila está vacía; si no, { texto, nivel, medible }.
 * El orden de las revisiones sigue la columna «Estado» de la plantilla Excel.
 */
function diagnostico(f) {
  const ctq = t(f.ctq);
  const impulsor = t(f.impulsor);
  const necesidad = t(f.necesidad);
  if (!ctq && !impulsor && !necesidad) return null;
  if (!ctq) {
    return impulsor
      ? { texto: 'Impulsor sin CTQ', nivel: 'atencion', medible: false, codigo: 'impulsor-sin-ctq' }
      : { texto: 'Necesidad sin impulsor', nivel: 'atencion', medible: false, codigo: 'necesidad-sin-impulsor' };
  }
  const conEspec = hay(f.lsl) || hay(f.objetivo) || hay(f.usl);
  if (!conEspec) return { texto: 'Falta especificación', nivel: 'atencion', medible: false, codigo: 'sin-especificacion' };
  if (hay(f.lsl) && hay(f.usl) && f.lsl >= f.usl) return { texto: 'LSL ≥ USL: revisar', nivel: 'critico', medible: false, codigo: 'limites-invertidos' };
  if (hay(f.objetivo) && ((hay(f.lsl) && f.objetivo < f.lsl) || (hay(f.usl) && f.objetivo > f.usl))) return { texto: 'Objetivo fuera de los límites', nivel: 'atencion', medible: false, codigo: 'objetivo-fuera' };
  if (!necesidad || !impulsor) return { texto: 'Falta rama del árbol', nivel: 'atencion', medible: false, codigo: 'rama-incompleta' };
  if (!t(f.unidad)) return { texto: 'Falta unidad', nivel: 'atencion', medible: false, codigo: 'sin-unidad' };
  if (!t(f.metodo)) return { texto: 'Falta método de medición', nivel: 'atencion', medible: false, codigo: 'sin-metodo' };
  return { texto: 'Listo', nivel: 'cumple', medible: true, codigo: 'listo' };
}

const UMBRAL = {
  titulo: 'Criterios de interpretación (guía M2 §3 y plantilla «Arbol CTQ»)',
  filas: [
    { rango: 'CTQ medible', texto: 'tiene unidad, método de medición y al menos un valor de especificación: límite inferior (LSL), objetivo o límite superior (USL)' },
    { rango: 'LSL < USL', texto: 'si hay límites en ambos lados, el inferior debe ser menor que el superior; el objetivo queda entre ellos' },
    { rango: 'Rama completa', texto: 'necesidad → impulsor → CTQ: un impulsor sin CTQ, o un CTQ sin impulsor, deja la rama incompleta' },
    { rango: '«Servicio rápido» no es un CTQ', texto: '«Pedido procesado en menos de 4 h» sí: lleva una unidad y un límite verificable (ejemplo de la guía M2 §3)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto: 'La necesidad viene de la voz del cliente (VOC) —encuestas, entrevistas, observación, quejas y garantías—, no de una suposición del equipo. Los límites de especificación los fija el cliente o una norma, no la capacidad actual del proceso.',
};

export default function lab06(ctx = {}) {
  const libro = ctx.caso?.ctq?.libro ?? FILAS_LIBRO;
  const excel = ctx.caso?.ctq?.excel ?? libro;

  return {
    id: 'lab06',
    numero: '06',
    modulo: 'M2',
    titulo: 'Árbol CTQ',
    resumen: 'Traduce una necesidad del cliente en impulsores y en CTQ con unidad, límites y método de medición, y detecta las ramas que quedaron incompletas.',
    panelAncho: true,
    entradas: [
      { tipo: 'nota', texto: 'Una fila = una rama del árbol (necesidad → impulsor → CTQ). Repite la necesidad en cada fila de sus impulsores; deja vacíos los límites que no apliquen.' },
      {
        id: 'ctq', tipo: 'tabla', etiqueta: 'Árbol CTQ',
        columnas: [
          { id: 'necesidad', etiqueta: 'Necesidad del cliente', tipo: 'texto' },
          { id: 'impulsor', etiqueta: 'Impulsor (driver)', tipo: 'texto' },
          { id: 'ctq', etiqueta: 'CTQ medible', tipo: 'texto' },
          { id: 'unidad', etiqueta: 'Unidad', tipo: 'texto', ancho: 70 },
          { id: 'lsl', etiqueta: 'LSL', tipo: 'numero', ancho: 80 },
          { id: 'objetivo', etiqueta: 'Objetivo', tipo: 'numero', ancho: 80 },
          { id: 'usl', etiqueta: 'USL', tipo: 'numero', ancho: 80 },
          { id: 'metodo', etiqueta: 'Método de medición', tipo: 'texto' },
          { id: 'estado', etiqueta: 'Estado', tipo: 'fijo', texto: (estado, fila) => diagnostico(fila)?.texto ?? '' },
        ],
        filas: libro,
        filaNueva: { necesidad: '', impulsor: '', ctq: '', unidad: '', lsl: NaN, objetivo: NaN, usl: NaN, metodo: '' },
        minFilas: 1, maxFilas: 12, filasVacias: 3,
      },
    ],
    presets: [
      { id: 'libro', etiqueta: 'Guía M2 §6: arneses', ayuda: 'Necesidad «arnés funcional en la primera prueba» con dos impulsores: continuidad eléctrica y torque de terminal (1.2 a 1.5 N·m).', valores: { ctq: libro } },
      { id: 'excel', etiqueta: 'Plantilla Excel: conexión confiable', ayuda: 'Ejemplo de la hoja «Arbol CTQ»: tres necesidades; la rama «Crimpado del terminal» queda sin especificación a propósito.', valores: { ctq: excel } },
    ],
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Qué ramas quedaron sin especificación o sin método de medición? ¿Qué dato o qué conversación con el cliente te falta para completarlas?',
      '¿De dónde sale cada límite: del cliente, de una norma o de una costumbre interna? ¿Quién lo firmaría?',
      'Para cada CTQ, ¿con qué instrumento lo medirías y qué tan confiable es esa medición? (el módulo 4 lo evalúa con el estudio R&R).',
      'Si el cliente dice «quiero que no falle», ¿qué impulsores propones y qué CTQ medibles cuelgan de cada uno?',
    ],

    calcular(e) {
      const filas = (Array.isArray(e.ctq) ? e.ctq : []).map((f) => ({ f, d: diagnostico(f) })).filter((x) => x.d);
      if (!filas.length) {
        return {
          vacio: 'Captura al menos una rama del árbol: necesidad, impulsor y CTQ con su especificación.',
          semaforos: ['CTQ medibles', 'Límites', 'Ramas del árbol'].map((nombre) => ({ nombre, estado: 'sin-datos', texto: 'Sin datos capturados.' })),
        };
      }
      const conCtq = filas.filter(({ f }) => t(f.ctq));
      const nombreCtq = ({ f }) => t(f.ctq) || t(f.impulsor) || t(f.necesidad);
      const medibles = conCtq.filter(({ d }) => d.medible);
      const necesidades = [...new Set(filas.map(({ f }) => t(f.necesidad)).filter(Boolean))];
      const impulsores = new Set(filas.filter(({ f }) => t(f.impulsor)).map(({ f }) => `${t(f.necesidad)}\u0001${t(f.impulsor)}`));
      const lista = (arr) => arr.map((x) => `«${x}»`).join(', ');

      const salidas = [
        { id: 'n-ctq', etiqueta: 'CTQ capturados', valor: String(conCtq.length), pequeno: true },
        { id: 'n-listos', etiqueta: 'CTQ medibles y completos', valor: `${medibles.length} de ${conCtq.length}`, color: 'teal', nota: 'unidad, especificación, método y rama completa' },
        { id: 'n-necesidades', etiqueta: 'Necesidades', valor: String(necesidades.length), pequeno: true },
        { id: 'n-impulsores', etiqueta: 'Impulsores', valor: String(impulsores.size), pequeno: true },
      ];

      const semaforos = [];
      if (!conCtq.length) {
        semaforos.push({ nombre: 'CTQ medibles', estado: 'sin-datos', texto: 'Todavía no hay ningún CTQ: baja de cada impulsor a una característica con número.' });
      } else if (medibles.length === conCtq.length) {
        semaforos.push({ nombre: 'CTQ medibles', estado: 'cumple', texto: `Los ${conCtq.length} CTQ tienen unidad, especificación y método de medición.` });
      } else {
        const faltas = conCtq.filter(({ d }) => !d.medible && d.codigo !== 'limites-invertidos').map(({ f, d }) => `${nombreCtq({ f })} (${d.texto.toLowerCase()})`);
        semaforos.push({ nombre: 'CTQ medibles', estado: 'atencion', texto: `${medibles.length} de ${conCtq.length} CTQ son medibles.${faltas.length ? ` Falta: ${faltas.join('; ')}.` : ''}` });
      }

      const invertidos = conCtq.filter(({ d }) => d.codigo === 'limites-invertidos');
      const fuera = conCtq.filter(({ d }) => d.codigo === 'objetivo-fuera');
      const pares = conCtq.filter(({ f }) => hay(f.lsl) && hay(f.usl));
      if (invertidos.length) {
        semaforos.push({ nombre: 'Límites', estado: 'critico', texto: `LSL ≥ USL en ${lista(invertidos.map(nombreCtq))}: el límite inferior debe ser menor que el superior.` });
      } else if (fuera.length) {
        semaforos.push({ nombre: 'Límites', estado: 'atencion', texto: `El objetivo queda fuera de los límites en ${lista(fuera.map(nombreCtq))}.` });
      } else if (pares.length) {
        semaforos.push({ nombre: 'Límites', estado: 'cumple', texto: `${pares.length} CTQ con límites en ambos lados, todos con LSL < USL.` });
      } else {
        semaforos.push({ nombre: 'Límites', estado: 'informativo', texto: 'Ningún CTQ tiene LSL y USL a la vez; con un solo límite no hay nada que comparar.' });
      }

      const sinCtq = filas.filter(({ d }) => d.codigo === 'impulsor-sin-ctq').map(({ f }) => t(f.impulsor));
      const sinImpulsor = filas.filter(({ d }) => d.codigo === 'necesidad-sin-impulsor').map(({ f }) => t(f.necesidad));
      const ramas = filas.filter(({ d }) => d.codigo === 'rama-incompleta').map(nombreCtq);
      const partes = [];
      if (sinCtq.length) partes.push(`impulsores sin CTQ: ${lista(sinCtq)}`);
      if (sinImpulsor.length) partes.push(`necesidades sin impulsor: ${lista(sinImpulsor)}`);
      if (ramas.length) partes.push(`CTQ sin necesidad o sin impulsor: ${lista(ramas)}`);
      semaforos.push(partes.length
        ? { nombre: 'Ramas del árbol', estado: 'atencion', texto: `${partes.join('; ')}.` }
        : { nombre: 'Ramas del árbol', estado: 'cumple', texto: 'Cada necesidad tiene impulsores y cada impulsor tiene al menos un CTQ.' });

      const porNecesidad = new Map();
      for (const { f } of filas) {
        if (!t(f.necesidad) || !t(f.impulsor)) continue;
        const k = t(f.necesidad);
        if (!porNecesidad.has(k)) porNecesidad.set(k, new Set());
        porNecesidad.get(k).add(t(f.impulsor));
      }
      const unSolo = [...porNecesidad.entries()].filter(([, s]) => s.size === 1).map(([n]) => n);
      if (porNecesidad.size) {
        semaforos.push(unSolo.length
          ? { nombre: 'Impulsores por necesidad', estado: 'informativo', texto: `Con un solo impulsor: ${lista(unSolo)}. En el ejercicio de la guía cada necesidad lleva al menos dos; pregúntate qué otro factor decide si el cliente queda satisfecho.` }
          : { nombre: 'Impulsores por necesidad', estado: 'informativo', texto: 'Cada necesidad tiene dos o más impulsores.' });
      }

      /* Una figura por necesidad */
      const figuras = [];
      const grupos = new Map();
      for (const { f } of filas) {
        const k = t(f.necesidad) || '(sin necesidad)';
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(f);
      }
      let n = 0;
      for (const [necesidad, rows] of grupos) {
        n += 1;
        figuras.push({
          id: `arbol-${n}`, titulo: necesidad, figura: 'arbol', ancha: true,
          params: {
            necesidad,
            impulsores: rows.map((f) => {
              const espec = especificacion(f);
              const nombre = t(f.ctq);
              return { texto: t(f.impulsor) || '(sin impulsor)', ctq: nombre ? `${nombre}${espec ? ` (${espec})` : ''}` : '(sin CTQ)' };
            }),
          },
        });
      }

      const tablas = [
        {
          titulo: 'Especificaciones de los CTQ',
          columnas: ['CTQ', 'Unidad', { t: 'LSL', num: true }, { t: 'Objetivo', num: true }, { t: 'USL', num: true }, 'Método de medición', 'Estado'],
          filas: filas.map(({ f, d }) => [
            t(f.ctq) || '—', t(f.unidad) || '—',
            { texto: hay(f.lsl) ? corto(f.lsl) : '—', num: true }, { texto: hay(f.objetivo) ? corto(f.objetivo) : '—', num: true }, { texto: hay(f.usl) ? corto(f.usl) : '—', num: true },
            t(f.metodo) || '—', { texto: d.texto, estado: d.nivel },
          ]),
          pie: 'LSL: límite inferior de especificación · USL: límite superior. Una especificación con un solo límite es válida (p. ej. «≤ 0 fallas»).',
        },
      ];

      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((fila, i) => ({
          ...fila,
          activa: [conCtq.length > 0 && medibles.length === conCtq.length, pares.length > 0 && !invertidos.length && !fuera.length, partes.length === 0, undefined][i],
        })),
      };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Anota junto a cada necesidad su fuente de VOC (entrevista, queja, observación en el Gemba) para poder defenderla.' };

      return { salidasColumnas: 2, salidas, semaforos, umbral, supuesto, figuras, tablas };
    },
  };
}
