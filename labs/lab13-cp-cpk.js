/**
 * LAB 13 · Capacidad del proceso: Cp y Cpk
 *
 * Guía: M5 §5 y plantilla Excel «Cp-Cpk».
 *   Cp  = (USL − LSL) ÷ 6σ                       capacidad potencial (supone el proceso centrado)
 *   Cpk = mín[(USL − x̄) ÷ 3σ, (x̄ − LSL) ÷ 3σ]    capacidad real (considera el centrado)
 *   Cp y Cpk usan σ dentro de subgrupos (corto plazo: R̄ ÷ d2); Pp y Ppk usan σ global (s de todos los datos).
 *   Con solo la media y σ (los ejemplos de la guía) σ hace las dos veces de σ de corto plazo.
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: torque de los arneses (Cp 1.47, Cpk 1.42), ejercicios 2 y 4 del módulo 5 y las 50 fuerzas de engarzado de la
 * plantilla Excel (LSL 173 N, R̄ 4.4 con subgrupos de 5: Cpk 1.58, Ppk 1.42, 10.27 PPM).
 */
import { D2, dictamenGRR, fraccionFuera, indicesCapacidad, nivelCapacidad, sigmaDentro } from '../js/lib/medir.js';
import { asimetria, desviacion, media, normalPdf } from '../js/lib/stats.js';
import { corto, entero, num, plural } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { etiquetaV, hexARgba, lineaH, lineaV, malla, trazaBarras } from '../js/lib/graficas.js';

/** Ejercicios del módulo 5 de la guía (se cargan tal cual los publica). */
const EJERCICIO_2 = { lsl: 9.5, usl: 10.5, media: 10.15, sigma: 0.12 }; // «10.0 ± 0.5, x̄ = 10.15 y s = 0.12»
const EJERCICIO_4 = { lsl: 195, usl: 205, media: 202, sigma: 1.5 }; // «límites 205 y 195, σ = 1.5, media real 202»

const LECTURA = {
  'no-capaz': 'no capaz (genera piezas fuera de especificación)',
  marginal: 'capacidad marginal',
  capaz: 'capaz (mínimo aceptado en la mayoría de la manufactura)',
  alta: 'alta capacidad (típico para características de seguridad)',
  'clase-mundial': 'capacidad de clase mundial (nivel Six Sigma)',
};
const FILA = { 'no-capaz': 0, marginal: 1, capaz: 2, alta: 3, 'clase-mundial': 4 };
const COLOR_ESTADO = { critico: COLOR.coral, atencion: COLOR.ambar, cumple: COLOR.teal };

const UMBRAL = {
  titulo: 'Interpretación del Cpk (guía M5 §5)',
  filas: [
    { rango: '< 1.00', texto: 'proceso no capaz; genera piezas fuera de especificación' },
    { rango: '1.00 – 1.33', texto: 'capacidad marginal' },
    { rango: '1.33 – 1.67', texto: 'capaz: mínimo aceptado en la mayoría de la manufactura' },
    { rango: '1.67 – 2.00', texto: 'alta capacidad: típico para características de seguridad' },
    { rango: '≥ 2.00', texto: 'capacidad de clase mundial (nivel Six Sigma)' },
    { rango: 'Cp ≥ 1.33 y Cpk < 1.33', texto: 'proceso descentrado: centrarlo suele ser una mejora más rápida y barata que reducir la variación (guía M5, error común y pregunta 6)' },
    { rango: 'n < 30', texto: 'pocas observaciones: un estudio real pide 30 a 100+ para que s sea una estimación estable de σ (guía M5 §5)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto:
    'El proceso es estable (sin causas especiales durante el estudio), los datos son aproximadamente normales y vienen de un sistema de medición ya validado con un Gauge R&R. ' +
    'Cp y Cpk miden solo la variación dentro de subgrupos; Pp y Ppk incluyen la de turnos, lotes o días. Con pocas observaciones los índices tienen una incertidumbre considerable.',
};

const idx = (x) => num(x, 2);
const f4 = (x) => corto(x, 4);

/** Fracción → «0.135 %», «6.68 %», «0.00034 %»: los decimales necesarios para ver colas pequeñas. */
function pctFino(p) {
  if (!Number.isFinite(p)) return '—';
  if (p === 0) return '0 %';
  const x = p * 100;
  if (x < 0.00001) return '< 0.00001 %';
  return `${num(x, x >= 1 ? 2 : x >= 0.01 ? 3 : 5)} %`;
}

/** Fracción → «10.27 PPM», «2,700 PPM». */
function ppmTexto(p) {
  if (!Number.isFinite(p)) return '—';
  const ppm = p * 1e6;
  return `${num(ppm, ppm >= 100 ? 0 : ppm >= 1 ? 2 : 4)} PPM`;
}

export default function lab13(ctx = {}) {
  const cap = ctx.caso?.capacidad;
  const g = cap?.guia ?? { unidad: 'N·m', media: 1.355, sigma: 0.034, lsl: 1.2, usl: 1.5 };
  const x = cap?.excel;
  const vacio = { unidad: '', lsl: NaN, usl: NaN, media: NaN, sigma: NaN, nResumen: NaN, datos: [], rBarra: NaN, nSubgrupo: NaN, sigmaDentro: NaN, grr: NaN };

  const presets = [
    {
      id: 'guia', etiqueta: 'Guía M5 §5: torque de los arneses',
      ayuda: 'Especificación de 1.2 a 1.5 N·m, x̄ = 1.355 N·m y s = 0.034 N·m (10 mediciones): Cp = 1.47, Cpk = mín[1.42, 1.52] = 1.42. La guía usa s como σ. La propia guía advierte que 10 observaciones son pocas para un estudio real.',
      valores: { ...vacio, unidad: g.unidad, lsl: g.lsl, usl: g.usl, media: g.media, sigma: g.sigma, nResumen: 10 },
    },
    {
      id: 'ej2', etiqueta: 'Guía M5: ejercicio 2 (proceso descentrado)',
      ayuda: 'Especificación 10.0 ± 0.5, x̄ = 10.15 y s = 0.12. Compara el Cp con el Cpk y decide si el problema es de variación o de centrado.',
      valores: { ...vacio, ...EJERCICIO_2 },
    },
    {
      id: 'ej4', etiqueta: 'Guía M5: ejercicio 4 (límites 195 y 205)',
      ayuda: 'σ = 1.5 y la media real en 202 en vez de 200. Cambia la media a 200 y mira qué pasa con el Cpk.',
      valores: { ...vacio, ...EJERCICIO_4 },
    },
    ...(x?.valores?.length
      ? [{
        id: 'excel', etiqueta: 'Plantilla Excel: 50 fuerzas de engarzado',
        ayuda: 'Hoja «Cp-Cpk»: 50 mediciones en N con solo LSL = 173 N (especificación unilateral), R̄ = 4.4 de una carta X̄-R con subgrupos de 5. σ dentro = 4.4 ÷ 2.326 = 1.8917 → Cpk 1.58; con σ global s = 2.10 → Ppk 1.42; 10.27 PPM esperados.',
        valores: { ...vacio, unidad: x.unidad ?? 'N', lsl: x.lsl, datos: x.valores, rBarra: x.rBarra, nSubgrupo: x.nSubgrupo },
      }]
      : []),
  ];

  return {
    id: 'lab13',
    numero: '13',
    modulo: 'M5',
    titulo: 'Capacidad del proceso: Cp y Cpk',
    resumen: 'Compara la variación del proceso con la especificación del cliente: Cp (capacidad potencial), Cpk (capacidad real, con el centrado), Pp y Ppk (con la variación global) y las piezas que se esperan fuera de especificación.',
    panelAncho: true,
    entradas: [
      { tipo: 'seccion', etiqueta: 'Especificación' },
      { id: 'unidad', tipo: 'texto', etiqueta: 'Unidad de medida (opcional)', valor: g.unidad ?? '', marcador: 'p. ej. N·m' },
      { id: 'lsl', tipo: 'numero', etiqueta: 'Límite inferior de especificación (LSL)', valor: g.lsl, ayuda: 'Déjalo en blanco si no existe (especificación unilateral).' },
      { id: 'usl', tipo: 'numero', etiqueta: 'Límite superior de especificación (USL)', valor: g.usl, ayuda: 'Déjalo en blanco si no existe (especificación unilateral).' },
      { tipo: 'seccion', etiqueta: 'Opción 1 · Resumen de la muestra' },
      { tipo: 'nota', texto: 'Úsala si solo tienes la media y la desviación estándar, como en los ejemplos de la guía. Si capturas datos en la opción 2, se usan los datos.' },
      { id: 'media', tipo: 'numero', etiqueta: 'Media x̄', valor: g.media },
      { id: 'sigma', tipo: 'numero', etiqueta: 'Desviación estándar σ (s)', valor: g.sigma, min: 0 },
      { id: 'nResumen', tipo: 'numero', etiqueta: 'Observaciones de las que salen (opcional)', valor: 10, min: 0, ayuda: 'Solo sirve para avisarte si son pocas.' },
      { tipo: 'seccion', etiqueta: 'Opción 2 · Datos medidos (tienen prioridad)' },
      { id: 'datos', tipo: 'datos', etiqueta: 'Mediciones', valor: [], filasTexto: 5, marcador: 'Pega aquí la columna de Excel (mínimo 2 valores; lo recomendable son 30 o más)', ayuda: 'Separa los valores con espacios, comas o saltos de línea.' },
      { id: 'rBarra', tipo: 'numero', etiqueta: 'R̄ de la carta X̄-R (opcional)', valor: NaN, min: 0, ayuda: 'Con R̄ y el tamaño del subgrupo se estima σ dentro = R̄ ÷ d2 para Cp y Cpk.' },
      { id: 'nSubgrupo', tipo: 'numero', etiqueta: 'Tamaño del subgrupo de la carta (2 a 10)', valor: NaN, min: 2, max: 10 },
      { id: 'sigmaDentro', tipo: 'numero', etiqueta: 'σ dentro capturada (opcional)', valor: NaN, min: 0, ayuda: 'Si ya la tienes, tiene prioridad sobre R̄. Sin R̄ ni σ dentro solo se calculan Pp y Ppk.' },
      { tipo: 'seccion', etiqueta: 'Sistema de medición (opcional)' },
      { id: 'grr', tipo: 'numero', etiqueta: '%GRR del sistema de medición', valor: NaN, min: 0, ayuda: 'Del estudio del LAB 12. Los índices valen solo lo que valga la medición que los produjo.' },
    ],
    presets,
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      'Si un proceso tiene Cp = 1.8 y Cpk = 0.9, ¿dónde enfocarías la mejora: en reducir la variación o en centrar el proceso? ¿Qué te dice la diferencia entre los dos índices?',
      'Con los datos de tu proceso, ¿cuánto separa σ dentro de σ global? ¿Qué causas (turnos, lotes, días) explicarían que Ppk quede por debajo de Cpk?',
      '¿Cuántas observaciones usaste? ¿Qué le pasaría a la conclusión si fueran 10 en vez de 100?',
      'Si el %GRR de tu sistema de medición fuera de 35 %, ¿por qué un Cpk que «se ve bien» no sería confiable? ¿Qué harías antes de reportarlo?',
      'Con el Cpk del torque de los arneses, ¿dónde buscarías la causa de los defectos que sustentan los 300 DPMO del caso, si el torque ya es capaz?',
    ],

    calcular(e) {
      const aviso = [];
      const unidad = String(e.unidad ?? '').trim();
      const u = unidad ? ` ${unidad}` : '';
      const { lsl, usl } = e;
      const hayLsl = Number.isFinite(lsl);
      const hayUsl = Number.isFinite(usl);
      const bilateral = hayLsl && hayUsl;
      const sinDatos = (texto) => ({ aviso, vacio: texto, semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: aviso.length ? 'Revisa los avisos sobre la captura.' : 'Sin datos capturados.' }] });

      const datos = e.datos ?? [];
      if (datos.length === 1) aviso.push('Con un solo dato no se puede estimar σ: captura al menos 2 (mejor 30 o más).');
      if (bilateral && lsl >= usl) {
        aviso.push('El LSL debe ser menor que el USL.');
        return sinDatos('Corrige los límites de especificación para calcular los índices.');
      }
      if (!hayLsl && !hayUsl) return sinDatos('Captura al menos un límite de especificación (LSL, USL o los dos), y la media y σ o tus datos.');

      /* ---- de dónde salen la media y las σ ---- */
      const modoDatos = datos.length >= 2;
      let mu;
      let sGlobal;
      let n;
      let sDentro = NaN;
      let origenDentro = '';
      if (modoDatos) {
        mu = media(datos);
        sGlobal = desviacion(datos);
        n = datos.length;
        if (!(sGlobal > 0)) {
          aviso.push('Todos los datos son iguales: σ = 0 y los índices no están definidos.');
          return sinDatos('Los datos no varían: captura mediciones reales para calcular la capacidad.');
        }
        if (Number.isFinite(e.media) || Number.isFinite(e.sigma)) aviso.push('Se usaron los datos de la opción 2; la media y σ de la opción 1 se ignoraron.');
        if (Number.isFinite(e.sigmaDentro) && !(e.sigmaDentro > 0)) aviso.push('σ dentro debe ser mayor que cero: se ignoró.');
        if (e.sigmaDentro > 0) {
          sDentro = e.sigmaDentro;
          origenDentro = 'capturada';
        } else if (Number.isFinite(e.rBarra)) {
          if (!(e.rBarra > 0)) aviso.push('R̄ debe ser mayor que cero: se ignoró.');
          else {
            sDentro = sigmaDentro(e.rBarra, e.nSubgrupo);
            if (Number.isFinite(sDentro)) origenDentro = `R̄ ÷ d2 = ${f4(e.rBarra)} ÷ ${f4(D2[e.nSubgrupo])}`;
            else aviso.push('Para convertir R̄ en σ el tamaño del subgrupo debe ser un entero de 2 a 10.');
          }
        }
      } else {
        mu = e.media;
        sGlobal = e.sigma;
        n = Number.isFinite(e.nResumen) && e.nResumen >= 1 ? e.nResumen : NaN;
        if (Number.isFinite(e.sigma) && !(e.sigma > 0)) aviso.push('σ debe ser mayor que cero.');
        if (!Number.isFinite(mu) || !(sGlobal > 0)) return sinDatos('Captura la media y σ (opción 1) o al menos dos mediciones (opción 2).');
      }
      if (Number.isFinite(e.grr) && e.grr < 0) aviso.push('El %GRR no puede ser negativo: se ignoró.');
      const grr = Number.isFinite(e.grr) && e.grr >= 0 ? e.grr : NaN;

      /* ---- índices ---- */
      const sCorto = modoDatos ? sDentro : sGlobal; // σ de Cp y Cpk
      const cc = Number.isFinite(sCorto) ? indicesCapacidad({ media: mu, sigma: sCorto, lsl, usl }) : null; // Cp, Cpk
      const pp = modoDatos ? indicesCapacidad({ media: mu, sigma: sGlobal, lsl, usl }) : null; // Pp, Ppk
      const fuera = fraccionFuera({ media: mu, sigma: sGlobal, lsl, usl });
      const bloque = cc ?? pp; // el que manda la lectura: Cp/Cpk si existen; si no, Pp/Ppk
      const nomK = cc ? 'Cpk' : 'Ppk';
      const nomP = cc ? 'Cp' : 'Pp';
      const cpkVal = bloque.cpk;
      const cpVal = bloque.cp;
      const nivel = nivelCapacidad(cpkVal);

      /* ---- salidas ---- */
      const salidas = [
        { id: 'media', etiqueta: 'Media x̄', valor: `${f4(mu)}${u}`, nota: modoDatos ? `de ${plural(n, 'dato')}` : 'capturada' },
        { id: 'sigma-global', etiqueta: modoDatos ? 'σ global (s)' : 'σ (desviación estándar)', valor: `${f4(sGlobal)}${u}`, nota: modoDatos ? 'desviación muestral de todos los datos' : 'la guía usa s como estimación de σ' },
      ];
      if (modoDatos && Number.isFinite(sDentro)) salidas.push({ id: 'sigma-dentro', etiqueta: 'σ dentro (corto plazo)', valor: `${f4(sDentro)}${u}`, nota: origenDentro });
      if (Number.isFinite(n)) salidas.push({ id: 'n', etiqueta: 'Observaciones', valor: entero(n), nota: n < 30 ? 'menos de 30: pocas para un estudio real' : 'dentro de los 30 a 100+ que pide la guía' });
      if (cc) {
        salidas.push(
          { id: 'cp', etiqueta: 'Cp', valor: bilateral ? idx(cc.cp) : '—', nota: bilateral ? `(USL − LSL) ÷ 6σ${modoDatos ? ' con σ dentro' : ''}` : 'necesita LSL y USL' },
          { id: 'cpk', etiqueta: 'Cpk', valor: idx(cc.cpk), color: 'teal', nota: bilateral ? `mín[Cpu ${idx(cc.cpu)}, Cpl ${idx(cc.cpl)}]` : hayUsl ? `Cpu = (USL − x̄) ÷ 3σ` : `Cpl = (x̄ − LSL) ÷ 3σ` }
        );
      }
      if (pp) {
        salidas.push(
          { id: 'pp', etiqueta: 'Pp', valor: bilateral ? idx(pp.cp) : '—', nota: bilateral ? '(USL − LSL) ÷ 6s con σ global' : 'necesita LSL y USL' },
          { id: 'ppk', etiqueta: 'Ppk', valor: idx(pp.cpk), color: cc ? undefined : 'teal', nota: bilateral ? `mín[Ppu ${idx(pp.cpu)}, Ppl ${idx(pp.cpl)}] con σ global` : 'con σ global' }
        );
      }
      salidas.push({ id: 'ppm', etiqueta: 'PPM esperado fuera de especificación', valor: ppmTexto(fuera.total), color: 'azul', nota: `${pctFino(fuera.total)} · modelo normal con ${modoDatos ? 'σ global' : 'σ'}` });
      let observados = NaN;
      if (modoDatos) {
        observados = datos.filter((v) => (hayLsl && v < lsl) || (hayUsl && v > usl)).length;
        salidas.push({ id: 'fuera-obs', etiqueta: 'Fuera de especificación observado', valor: `${entero(observados)} de ${entero(n)}`, nota: `${num((100 * observados) / n, 1)} % de los datos` });
      }

      /* ---- semáforos ---- */
      const semaforos = [{ nombre: nomK, estado: nivel.estado, texto: `${nomK} = ${idx(cpkVal)}: ${LECTURA[nivel.nivel]}.${cc ? '' : ' Sin R̄ ni σ dentro solo se calculan Pp y Ppk, como en la plantilla.'}` }];
      if (cc && pp) {
        const nv = nivelCapacidad(pp.cpk);
        semaforos.push({ nombre: 'Ppk', estado: nv.estado, texto: `Ppk = ${idx(pp.cpk)}: ${LECTURA[nv.nivel]} (con la variación de largo plazo).` });
      }
      let descentrado = false;
      if (!bilateral) {
        semaforos.push({ nombre: 'Diagnóstico: centrado o variación', estado: 'informativo', texto: `Especificación unilateral: solo existe ${nomK} (el lado ${hayUsl ? 'superior' : 'inferior'}); ${nomP} necesita los dos límites.` });
      } else {
        const centro = (lsl + usl) / 2;
        const desvio = mu - centro;
        const detalle = `La media (${f4(mu)}${u}) está ${f4(Math.abs(desvio))}${u} ${desvio >= 0 ? 'por encima' : 'por debajo'} del centro de la especificación (${f4(centro)}${u}): ${num((Math.abs(desvio) / ((usl - lsl) / 2)) * 100, 0)} % de la semitolerancia.`;
        if (cpVal < 1.33) {
          semaforos.push({ nombre: 'Diagnóstico: centrado o variación', estado: cpVal < 1 ? 'critico' : 'atencion', texto: `${nomP} = ${idx(cpVal)} (menor que 1.33): la variación ya ocupa casi toda la tolerancia; centrar el proceso no basta, hay que reducir la variación. ${detalle}` });
        } else if (cpkVal < 1.33) {
          descentrado = true;
          semaforos.push({ nombre: 'Diagnóstico: centrado o variación', estado: 'atencion', texto: `${nomP} = ${idx(cpVal)} es alto pero ${nomK} = ${idx(cpkVal)} no: el problema es el centrado, no la variación. Centrar suele ser más rápido y barato que reducirla (guía M5). ${detalle}` });
        } else {
          semaforos.push({ nombre: 'Diagnóstico: centrado o variación', estado: 'cumple', texto: `${nomP} y ${nomK} son ≥ 1.33: la variación cabe en la tolerancia y el proceso está bien centrado. ${detalle}` });
        }
      }
      if (cc && pp) {
        const razon = sGlobal / sDentro;
        semaforos.push(
          razon >= 1
            ? { nombre: 'Variación de largo plazo', estado: 'informativo', texto: `σ global (${f4(sGlobal)}${u}) es ${num(razon, 2)} veces σ dentro (${f4(sDentro)}${u}): Ppk = ${idx(pp.cpk)} frente a Cpk = ${idx(cc.cpk)}. La variación de largo plazo incluye diferencias entre subgrupos, turnos o lotes (guía M5 §5).` }
            : { nombre: 'Variación de largo plazo', estado: 'atencion', texto: `σ global (${f4(sGlobal)}${u}) es menor que σ dentro (${f4(sDentro)}${u}): lo habitual es lo contrario. Revisa R̄, el tamaño del subgrupo y que los datos estén en el orden de producción.` }
        );
      }
      const pocos = Number.isFinite(n) && n < 30;
      semaforos.push(
        Number.isFinite(n)
          ? n >= 30
            ? { nombre: 'Observaciones', estado: 'cumple', texto: `n = ${entero(n)}: está dentro del rango de 30 a 100+ que pide un estudio de capacidad real (guía M5 §5).` }
            : { nombre: 'Observaciones', estado: 'atencion', texto: `n = ${entero(n)} (menos de 30): s es una estimación inestable de σ y los índices tienen una incertidumbre considerable (guía M5 §5).` }
          : { nombre: 'Observaciones', estado: 'informativo', texto: 'No indicaste de cuántas observaciones salen la media y σ: un estudio real pide 30 a 100+ (guía M5 §5).' }
      );
      if (modoDatos && n >= 3) {
        const asim = asimetria(datos);
        if (Number.isFinite(asim)) {
          semaforos.push(
            Math.abs(asim) > 1
              ? { nombre: 'Forma de los datos', estado: 'atencion', texto: `|asimetría| = ${num(Math.abs(asim), 2)} > 1: la distribución es sesgada y el modelo normal de los índices y del PPM puede engañar (referencia didáctica).` }
              : { nombre: 'Forma de los datos', estado: 'cumple', texto: `|asimetría| = ${num(Math.abs(asim), 2)} ≤ 1: forma aproximadamente simétrica, compatible con el supuesto de normalidad (referencia didáctica).` }
          );
        }
      }
      if (Number.isFinite(grr)) {
        const d = dictamenGRR(grr);
        const texto = {
          cumple: `%GRR = ${num(grr, 1)} %: menor que 10 %; el sistema de medición casi no distorsiona los índices.`,
          atencion: `%GRR = ${num(grr, 1)} %: entre 10 % y 30 %; la medición agrega incertidumbre a los índices. Confirma que la aplicación lo admite.`,
          critico: `%GRR = ${num(grr, 1)} %: mayor que 30 %; no confíes en estos índices hasta mejorar el sistema de medición (guía M5).`,
        }[d];
        semaforos.push({ nombre: 'Sistema de medición', estado: d, texto });
      } else {
        semaforos.push({ nombre: 'Sistema de medición', estado: 'informativo', texto: 'Sin %GRR capturado: valida antes el sistema de medición (LAB 12); un %GRR alto puede hacer parecer incapaz a un proceso capaz, o esconder un problema real.' });
      }

      const umbral = { ...UMBRAL, filas: UMBRAL.filas.map((f, i) => ({ ...f, activa: i < 5 ? i === FILA[nivel.nivel] : i === 5 ? descentrado : pocos })) };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: modoDatos ? 'Revisa el histograma: el modelo normal debe seguir de cerca a los datos, sin colas ni dos jorobas.' : 'Con la media y σ capturadas no hay datos que revisar: confirma la forma con un histograma antes de creer el PPM.' };

      /* ---- gráfica 1: distribución frente a la especificación ---- */
      const dec = Math.max(2, Math.min(4, 2 - Math.floor(Math.log10(Math.abs(sGlobal) || 1))));
      const f = (v) => corto(v, dec);
      const formas = [lineaV(mu, COLOR.teal, { dash: 'dash', ancho: 1.6 })];
      const notas = [etiquetaV(mu, ' x̄', COLOR.teal)];
      if (hayLsl) { formas.push(lineaV(lsl, COLOR.coral, { dash: 'solid', ancho: 2 })); notas.push(etiquetaV(lsl, ' LSL', COLOR.coral, { desplazarY: 16 })); }
      if (hayUsl) { formas.push(lineaV(usl, COLOR.coral, { dash: 'solid', ancho: 2 })); notas.push(etiquetaV(usl, 'USL ', COLOR.coral, { ancla: 'right', desplazarY: 16 })); }
      const ejeX = { title: { text: `Valor${unidad ? ` (${unidad})` : ''}` } };
      const graficas = [];
      if (modoDatos) {
        const K = 12;
        const lo = Math.min(...datos, ...(hayLsl ? [lsl] : []));
        const hi = Math.max(...datos, ...(hayUsl ? [usl] : []));
        const ancho = (hi - lo) / K;
        const dentro = Array(K).fill(0);
        const afuera = Array(K).fill(0);
        for (const v of datos) {
          const k = Math.min(K - 1, Math.floor((v - lo) / ancho));
          const mal = (hayLsl && v < lsl) || (hayUsl && v > usl);
          (mal ? afuera : dentro)[k] += 1;
        }
        const centros = Array.from({ length: K }, (_, i) => lo + (i + 0.5) * ancho);
        const esperado = (c) => n * ancho * normalPdf(c, mu, sGlobal);
        const xs = malla(lo, hi, 240);
        graficas.push({
          id: 'distribucion', titulo: 'Histograma de los datos, curva normal y límites de especificación', ancha: true, alta: true,
          datos: [
            { type: 'bar', name: 'Dentro de especificación', x: centros, y: dentro, width: ancho * 0.94, marker: { color: hexARgba(COLOR.teal, 0.8), line: { width: 0 } }, hovertemplate: '%{y} datos<extra>dentro</extra>' },
            { type: 'bar', name: 'Fuera de especificación', x: centros, y: afuera, width: ancho * 0.94, marker: { color: hexARgba(COLOR.coral, 0.9), line: { width: 0 } }, hovertemplate: '%{y} datos<extra>fuera</extra>' },
            { type: 'scatter', mode: 'lines', name: 'Curva normal (σ global)', x: xs, y: xs.map((v) => esperado(v)), line: { color: COLOR.blanco, width: 2 }, hoverinfo: 'skip' },
          ],
          layout: { barmode: 'stack', xaxis: ejeX, yaxis: { title: { text: 'Frecuencia' }, rangemode: 'tozero' }, shapes: formas, annotations: notas },
          respaldo: {
            columnas: ['Clase', 'Dentro', 'Fuera', 'Esperado con la curva normal'],
            filas: centros.map((c, i) => [`${f(lo + i * ancho)} a ${f(lo + (i + 1) * ancho)}`, entero(dentro[i]), entero(afuera[i]), num(esperado(c), 1)]),
          },
        });
      } else {
        let xMin = mu - 4 * sGlobal;
        let xMax = mu + 4 * sGlobal;
        if (hayLsl) xMin = Math.min(xMin, lsl - 0.5 * sGlobal);
        if (hayUsl) xMax = Math.max(xMax, usl + 0.5 * sGlobal);
        const xs = malla(xMin, xMax, 320);
        const cola = (desde, hasta, mostrar) => {
          const cx = malla(desde, hasta, 90);
          return {
            type: 'scatter', mode: 'lines', x: [cx[0], ...cx, cx[cx.length - 1]], y: [0, ...cx.map((v) => normalPdf(v, mu, sGlobal)), 0], fill: 'toself',
            fillcolor: hexARgba(COLOR.coral, 0.45), line: { width: 0 }, name: 'Fuera de especificación', showlegend: mostrar, hoverinfo: 'skip',
          };
        };
        const trazas = [];
        let colaMostrada = false;
        if (hayLsl && lsl > xMin) { trazas.push(cola(xMin, lsl, true)); colaMostrada = true; }
        if (hayUsl && usl < xMax) trazas.push(cola(usl, xMax, !colaMostrada));
        trazas.push({ type: 'scatter', mode: 'lines', x: xs, y: xs.map((v) => normalPdf(v, mu, sGlobal)), name: 'Proceso', line: { color: COLOR.teal, width: 2.4 }, hoverinfo: 'x' });
        graficas.push({
          id: 'distribucion', titulo: 'Distribución normal del proceso y límites de especificación', ancha: true, alta: true,
          datos: trazas,
          layout: { xaxis: ejeX, yaxis: { title: { text: 'Densidad' }, rangemode: 'tozero', showticklabels: false }, shapes: formas, annotations: notas },
          respaldo: {
            columnas: ['Concepto', 'Valor'],
            filas: [
              ['Media x̄', `${f(mu)}${u}`], ['σ', `${f(sGlobal)}${u}`],
              ...(hayLsl ? [['LSL', `${f(lsl)}${u}`], ['% por debajo del LSL', pctFino(fuera.bajo)]] : []),
              ...(hayUsl ? [['USL', `${f(usl)}${u}`], ['% por encima del USL', pctFino(fuera.sobre)]] : []),
            ],
          },
        });
      }

      /* ---- gráfica 2: índices frente a los mínimos de la guía ---- */
      const lista = [];
      if (cc && bilateral) lista.push(['Cp', cc.cp]);
      if (cc) lista.push(['Cpk', cc.cpk]);
      if (pp && bilateral) lista.push(['Pp', pp.cp]);
      if (pp) lista.push(['Ppk', pp.cpk]);
      const maximo = Math.max(2.2, ...lista.map(([, v]) => v * 1.12));
      graficas.push({
        id: 'indices', titulo: 'Índices frente a los mínimos de la guía',
        datos: [{ ...trazaBarras(lista.map(([nombre]) => nombre), lista.map(([, v]) => v), { colores: lista.map(([, v]) => COLOR_ESTADO[nivelCapacidad(v).estado] ?? COLOR.gris), texto: lista.map(([, v]) => idx(v)), mostrarLeyenda: false }), hovertemplate: '%{x} = %{y:.3f}<extra></extra>' }],
        layout: {
          showlegend: false, bargap: 0.55,
          yaxis: { title: { text: 'Índice' }, range: [0, maximo] },
          shapes: [lineaH(1, COLOR.gris, { dash: 'dot', ancho: 1.2 }), lineaH(1.33, COLOR.ambar, { dash: 'dash', ancho: 1.6 }), lineaH(1.67, COLOR.teal, { dash: 'dash', ancho: 1.4 })],
          annotations: [
            { x: 1, y: 1, xref: 'paper', yref: 'y', text: '1.00', showarrow: false, xanchor: 'right', yanchor: 'bottom', font: { color: COLOR.gris, size: 11 } },
            { x: 1, y: 1.33, xref: 'paper', yref: 'y', text: '1.33 mínimo', showarrow: false, xanchor: 'right', yanchor: 'bottom', font: { color: COLOR.ambar, size: 11 } },
            { x: 1, y: 1.67, xref: 'paper', yref: 'y', text: '1.67 seguridad', showarrow: false, xanchor: 'right', yanchor: 'bottom', font: { color: COLOR.teal, size: 11 } },
          ],
        },
        respaldo: { columnas: ['Índice', 'Valor', 'Lectura'], filas: lista.map(([nombre, v]) => [nombre, num(v, 3), nivelCapacidad(v).texto]) },
      });

      /* ---- tabla de cálculos ---- */
      const filasBloque = (prefijo, ind, sigma) => {
        const fila = (nombre, formula, calculo, valor, lectura = '—') => [nombre, formula, calculo, { texto: num(valor, 3), num: true, formula: true }, lectura];
        const calcU = `(${f4(usl)} − ${f4(mu)}) ÷ (3 × ${f4(sigma)})`;
        const calcL = `(${f4(mu)} − ${f4(lsl)}) ÷ (3 × ${f4(sigma)})`;
        const lecturaK = nivelCapacidad(ind.cpk).texto;
        if (!bilateral) return [fila(`${prefijo}pk`, hayUsl ? '(USL − x̄) ÷ 3σ' : '(x̄ − LSL) ÷ 3σ', hayUsl ? calcU : calcL, ind.cpk, lecturaK)];
        return [
          fila(`${prefijo}p`, '(USL − LSL) ÷ 6σ', `(${f4(usl)} − ${f4(lsl)}) ÷ (6 × ${f4(sigma)})`, ind.cp),
          fila(`${prefijo}pl`, '(x̄ − LSL) ÷ 3σ', calcL, ind.cpl),
          fila(`${prefijo}pu`, '(USL − x̄) ÷ 3σ', calcU, ind.cpu),
          fila(`${prefijo}pk`, `mín(${prefijo}pu, ${prefijo}pl)`, `mín(${num(ind.cpu, 3)}, ${num(ind.cpl, 3)})`, ind.cpk, lecturaK),
        ];
      };
      const filasTabla = [...(cc ? filasBloque('C', cc, sCorto) : []), ...(pp ? filasBloque('P', pp, sGlobal) : [])];
      const tablas = [
        {
          titulo: 'Cómo salió cada índice',
          columnas: ['Índice', 'Fórmula', 'Cálculo', { t: 'Valor', num: true }, 'Lectura'],
          filas: filasTabla,
          resaltar: filasTabla.map((fila, i) => (/pk$/.test(fila[0]) ? i : -1)).filter((i) => i >= 0),
          pie: `${origenDentro && modoDatos ? `σ dentro = ${origenDentro} = ${f4(sDentro)}${u}. ` : ''}Cp y Cpk usan ${modoDatos ? 'σ dentro de subgrupos' : 'la σ capturada'}${pp ? '; Pp y Ppk, la σ global de todos los datos' : ''}.`,
        },
      ];

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
