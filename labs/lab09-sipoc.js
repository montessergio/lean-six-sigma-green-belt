/**
 * LAB 09 · SIPOC y su verificación de completitud
 *
 * Guía: M3A §1. El SIPOC resume un proceso en cinco columnas (Proveedores, Entradas, Proceso, Salidas y
 * Clientes) y se construye de adentro hacia afuera: primero los 4 a 7 pasos del proceso, luego las salidas, los
 * clientes, las entradas y los proveedores. La variante SIPOC+CR agrega los requisitos del cliente, que enlazan
 * con los CTQ del M2. Plantilla Excel «SIPOC»: una fila = una línea de lectura; las columnas no necesitan
 * coincidir entre sí, y la verificación cuenta los pasos (4 a 7).
 *
 * Presets: `libro` (cinco pasos de la guía) y `excel` (siete pasos de la plantilla).
 */
import { plural } from '../js/core/format.js';

/** Procesos de ejemplo por si el caso no está disponible (guía M3A §1). */
const SIPOC_LIBRO = {
  proceso: 'Ensamble de arneses eléctricos',
  inicio: 'Corte y pelado',
  fin: 'Inspección final',
  filas: [
    { proveedor: 'Proveedor de terminales y conectores', entrada: 'Cable, terminales, conectores', paso: 'Corte y pelado', salida: 'Arnés terminado y etiquetado', cliente: 'Montaje final del vehículo (interno)', requisito: '' },
    { proveedor: 'Proveedor de cable', entrada: 'Plano de ruteo', paso: 'Engarzado de terminales', salida: 'Registro de inspección', cliente: 'Operador ferroviario (externo)', requisito: '' },
    { proveedor: '', entrada: 'Instrucción de trabajo', paso: 'Ensamble de conectores', salida: '', cliente: '', requisito: '' },
    { proveedor: '', entrada: '', paso: 'Ruteo y amarre', salida: '', cliente: '', requisito: '' },
    { proveedor: '', entrada: '', paso: 'Inspección final', salida: '', cliente: '', requisito: '' },
  ],
};

const t = (v) => String(v ?? '').trim();
const MIN_PASOS = 4;
const MAX_PASOS = 7;

const UMBRAL = {
  titulo: 'Criterios de interpretación (guía M3A §1 y plantilla «SIPOC»)',
  filas: [
    { rango: `${MIN_PASOS} a ${MAX_PASOS} pasos en Proceso`, texto: 'nivel de detalle de un SIPOC; pasar de siete lo convierte en un diagrama de flujo detallado y pierde su propósito' },
    { rango: 'Nombre, inicio y fin definidos', texto: 'delimitan el alcance: el primer paso arranca donde empieza el proceso y el último termina donde termina' },
    { rango: 'Entradas con proveedor y salidas con cliente', texto: 'cada entrada tiene quién la suministra y cada salida, quién la recibe (un proveedor o un cliente puede atender varias)' },
    { rango: 'Requisito de cada salida (SIPOC+CR)', texto: 'lo que el cliente exige de la salida; enlaza con los CTQ del árbol del M2 (LAB 06)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto: 'El SIPOC se construye con quienes hacen el proceso, no en una oficina: lo que está en el papel puede diferir de lo que ocurre en la línea. Se arma de adentro hacia afuera —proceso, salidas, clientes, entradas y proveedores—, para no arrastrar entradas y proveedores que no alimentan ningún paso real.',
};

export default function lab09(ctx = {}) {
  const libro = ctx.caso?.sipoc?.libro ?? SIPOC_LIBRO;
  const excel = ctx.caso?.sipoc?.excel ?? libro;
  const celdasVacias = { proveedor: '', entrada: '', paso: '', salida: '', cliente: '', requisito: '' };

  return {
    id: 'lab09',
    numero: '09',
    modulo: 'M3A',
    titulo: 'SIPOC',
    resumen: 'Mapea un proceso en cinco columnas, de adentro hacia afuera, y comprueba que el mapa es de alto nivel (4 a 7 pasos) y que tiene inicio, fin, proveedores, clientes y requisitos.',
    panelAncho: true,
    entradas: [
      { id: 'proceso', tipo: 'texto', etiqueta: 'Proceso', valor: libro.proceso, marcador: 'Nombre del proceso' },
      { id: 'inicio', tipo: 'texto', etiqueta: 'Inicio del proceso', valor: libro.inicio, marcador: 'Primer evento del proceso' },
      { id: 'fin', tipo: 'texto', etiqueta: 'Fin del proceso', valor: libro.fin, marcador: 'Último evento del proceso' },
      {
        id: 'filas', tipo: 'tabla', etiqueta: 'SIPOC (una fila = una línea de lectura; las columnas no necesitan coincidir entre sí)',
        columnas: [
          { id: 'proveedor', etiqueta: 'Proveedores (S)', tipo: 'texto' },
          { id: 'entrada', etiqueta: 'Entradas (I)', tipo: 'texto' },
          { id: 'paso', etiqueta: 'Paso del proceso (P)', tipo: 'texto' },
          { id: 'salida', etiqueta: 'Salidas (O)', tipo: 'texto' },
          { id: 'cliente', etiqueta: 'Clientes (C)', tipo: 'texto' },
          { id: 'requisito', etiqueta: 'Requisito de la salida', tipo: 'texto' },
        ],
        filas: libro.filas, filaNueva: celdasVacias, minFilas: 1, maxFilas: 10, filasVacias: 5,
      },
    ],
    presets: [
      { id: 'libro', etiqueta: 'Guía M3A §1: arneses, 5 pasos', ayuda: 'SIPOC de la línea de arneses de la guía: cinco pasos, dos proveedores, dos salidas y dos clientes (sin requisitos: es el SIPOC básico).', valores: { proceso: libro.proceso, inicio: libro.inicio, fin: libro.fin, filas: libro.filas } },
      { id: 'excel', etiqueta: 'Plantilla Excel: siete pasos con requisitos', ayuda: 'Hoja «SIPOC» de la plantilla: siete pasos y el requisito de cada salida (variante SIPOC+CR).', valores: { proceso: excel.proceso, inicio: excel.inicio, fin: excel.fin, filas: excel.filas } },
    ],
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Qué pasos agruparías o dividirías para quedar entre 4 y 7? ¿Qué se pierde del mapa si pasas de siete?',
      'Construye tu SIPOC en el orden de la guía: proceso, salidas, clientes, entradas y proveedores. ¿Qué entradas encontraste que no alimentan ningún paso?',
      '¿Qué requisito del cliente podrías medir en cada salida y a qué CTQ de tu árbol (LAB 06) corresponde?',
      '¿Con quién del proceso validarías este mapa antes de usarlo en la fase Medir, y qué diferencias esperas encontrar entre el papel y la línea?',
    ],

    calcular(e) {
      const filas = Array.isArray(e.filas) ? e.filas : [];
      const columna = (id) => filas.map((f) => t(f?.[id])).filter(Boolean);
      const proveedores = columna('proveedor');
      const entradas = columna('entrada');
      const pasos = columna('paso');
      const salidas = columna('salida');
      const clientes = columna('cliente');
      const requisitos = columna('requisito');
      const proceso = t(e.proceso);
      const inicio = t(e.inicio);
      const fin = t(e.fin);

      const total = proveedores.length + entradas.length + pasos.length + salidas.length + clientes.length + requisitos.length;
      if (!total && !proceso && !inicio && !fin) {
        return {
          vacio: 'Empieza por el proceso: captura sus pasos (4 a 7); después las salidas, los clientes, las entradas y los proveedores.',
          semaforos: ['Pasos del proceso', 'Nombre, inicio y fin', 'Entradas y proveedores', 'Salidas y clientes', 'Requisitos del cliente'].map((nombre) => ({ nombre, estado: 'sin-datos', texto: 'Sin datos capturados.' })),
        };
      }

      const aviso = [];
      if (filas.length > 10) aviso.push('Un SIPOC de alto nivel cabe en 10 líneas: las filas sobrantes se ignoran en la plantilla Excel.');

      const salidasUI = [
        { id: 'n-proveedores', etiqueta: 'Proveedores (S)', valor: String(proveedores.length), pequeno: true },
        { id: 'n-entradas', etiqueta: 'Entradas (I)', valor: String(entradas.length), pequeno: true },
        { id: 'n-pasos', etiqueta: 'Pasos del proceso (P)', valor: String(pasos.length), color: 'teal', pequeno: true, nota: `de ${MIN_PASOS} a ${MAX_PASOS}` },
        { id: 'n-salidas', etiqueta: 'Salidas (O)', valor: String(salidas.length), pequeno: true },
        { id: 'n-clientes', etiqueta: 'Clientes (C)', valor: String(clientes.length), pequeno: true },
        { id: 'n-requisitos', etiqueta: 'Requisitos del cliente', valor: String(requisitos.length), pequeno: true },
      ];

      /* Semáforos */
      const semaforos = [];
      const n = pasos.length;
      if (n === 0) semaforos.push({ nombre: 'Pasos del proceso', estado: 'sin-datos', texto: 'Captura los pasos del proceso.' });
      else if (n < MIN_PASOS) semaforos.push({ nombre: 'Pasos del proceso', estado: 'atencion', texto: `${plural(n, 'paso')}. Muy pocos pasos: detalla un poco más.` });
      else if (n > MAX_PASOS) semaforos.push({ nombre: 'Pasos del proceso', estado: 'atencion', texto: `${plural(n, 'paso')}. Demasiados pasos: agrupa en ${MIN_PASOS} a ${MAX_PASOS} macro-pasos.` });
      else semaforos.push({ nombre: 'Pasos del proceso', estado: 'cumple', texto: `${plural(n, 'paso')}. OK: nivel de detalle adecuado para un SIPOC.` });

      const faltan = [!proceso && 'el nombre del proceso', !inicio && 'el inicio', !fin && 'el fin'].filter(Boolean);
      if (faltan.length === 3) semaforos.push({ nombre: 'Nombre, inicio y fin', estado: 'sin-datos', texto: 'Define el nombre, el inicio y el fin del proceso.' });
      else if (faltan.length) semaforos.push({ nombre: 'Nombre, inicio y fin', estado: 'atencion', texto: `Falta definir ${faltan.join(' y ')}.` });
      else {
        const extremos = n ? ` Primer paso: «${pasos[0]}»; último: «${pasos[n - 1]}». Confirma que coinciden con el inicio y el fin.` : '';
        semaforos.push({ nombre: 'Nombre, inicio y fin', estado: 'cumple', texto: `Definidos: de «${inicio}» a «${fin}».${extremos}` });
      }

      const pareja = (nombre, lista, otra, nombreLista, nombreOtra) => {
        if (!lista.length && !otra.length) return { nombre, estado: 'sin-datos', texto: `Captura ${nombreLista} y ${nombreOtra}.` };
        if (lista.length && !otra.length) return { nombre, estado: 'atencion', texto: `Hay ${plural(lista.length, nombreLista.replace(/s$/, ''))} pero ningún ${nombreOtra.replace(/s$/, '')}.` };
        if (!lista.length) return { nombre, estado: 'atencion', texto: `Hay ${plural(otra.length, nombreOtra.replace(/s$/, ''))} pero ninguna ${nombreLista.replace(/s$/, '')}.` };
        if (otra.length < lista.length) return { nombre, estado: 'informativo', texto: `${lista.length} ${nombreLista} y ${otra.length} ${nombreOtra}: confirma que cada una tenga quién la ${nombre.startsWith('Entradas') ? 'suministre' : 'reciba'} (uno puede atender varias).` };
        return { nombre, estado: 'cumple', texto: `${lista.length} ${nombreLista} y ${otra.length} ${nombreOtra}.` };
      };
      semaforos.push(pareja('Entradas y proveedores', entradas, proveedores, 'entradas', 'proveedores'));
      semaforos.push(pareja('Salidas y clientes', salidas, clientes, 'salidas', 'clientes'));

      if (!requisitos.length) {
        semaforos.push({ nombre: 'Requisitos del cliente', estado: 'atencion', texto: 'Ninguna salida tiene requisito del cliente. Agrega la columna de requisitos (SIPOC+CR) y enlázala con los CTQ del árbol del M2.' });
      } else if (requisitos.length < salidas.length) {
        semaforos.push({ nombre: 'Requisitos del cliente', estado: 'atencion', texto: `${requisitos.length} requisito(s) para ${salidas.length} salidas: falta el requisito de ${salidas.length - requisitos.length} salida(s).` });
      } else {
        semaforos.push({ nombre: 'Requisitos del cliente', estado: 'cumple', texto: `${plural(requisitos.length, 'requisito')} del cliente; cada uno debería convertirse en un CTQ medible.` });
      }

      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((fila, i) => ({
          ...fila,
          activa: [n >= MIN_PASOS && n <= MAX_PASOS, faltan.length === 0, entradas.length > 0 && proveedores.length > 0 && salidas.length > 0 && clientes.length > 0, requisitos.length > 0 && requisitos.length >= salidas.length][i],
        })),
      };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Recorre la línea con el mapa en la mano y marca cada paso que no coincida con lo que ves.' };

      const figuras = pasos.length || proveedores.length || entradas.length || salidas.length || clientes.length
        ? [{ id: 'sipoc', titulo: proceso || 'SIPOC', figura: 'sipoc', ancha: true, params: { proveedores, entradas, pasos, salidas, clientes } }]
        : [];

      const tablas = [
        {
          titulo: 'Verificación de completitud',
          columnas: ['Elemento', { t: 'Capturados', num: true }, 'Qué se espera'],
          filas: [
            ['Proveedores (S)', { texto: String(proveedores.length), num: true, formula: true }, 'quién suministra cada entrada'],
            ['Entradas (I)', { texto: String(entradas.length), num: true, formula: true }, 'lo que consume el proceso: material, información, equipo'],
            ['Pasos del proceso (P)', { texto: String(pasos.length), num: true, formula: true }, `de ${MIN_PASOS} a ${MAX_PASOS} macro-pasos`],
            ['Salidas (O)', { texto: String(salidas.length), num: true, formula: true }, 'producto, servicio o información que entrega el proceso'],
            ['Clientes (C)', { texto: String(clientes.length), num: true, formula: true }, 'internos y externos, quienes reciben las salidas'],
            ['Requisitos del cliente', { texto: String(requisitos.length), num: true, formula: true }, 'uno por salida; cada uno enlaza con un CTQ'],
          ],
          pie: 'Se cuentan las celdas con texto de cada columna; no importa en qué fila estén (plantilla Excel «SIPOC»).',
        },
      ];

      return { aviso, salidasColumnas: 3, salidas: salidasUI, semaforos, umbral, supuesto, figuras, tablas };
    },
  };
}
