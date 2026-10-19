/**
 * LAB 05 · Project Charter (acta del proyecto)
 *
 * Guía: M2 §1 (seis elementos del charter; el problema no lleva culpas ni soluciones; la meta es SMART),
 * M2 §4 (caso de negocio) y M2 §6 (aplicación a la línea de arneses: 300 → menos de 100 DPMO en 4 meses).
 * Plantilla Excel «Project Charter»:
 *   retorno = (beneficio − costo) ÷ costo · recuperación (meses) = costo ÷ (beneficio ÷ 12).
 * La revisión del planteamiento usa listas de palabras visibles (se muestran en una tabla): es una ayuda
 * de lectura, no un veredicto.
 *
 * Presets: `guia` (M2 §6 + beneficio y costo de la plantilla) y `excel` (ejemplo de la plantilla).
 */
import { corto, entero, num, pct } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { etiquetaV, lineaV, trazaBarras } from '../js/lib/graficas.js';

const FASES = ['Definir', 'Medir', 'Analizar', 'Mejorar', 'Controlar'];
const COLORES_FASE = [COLOR.violeta, COLOR.azul, COLOR.teal, COLOR.verde, COLOR.ambar];

/** Listas visibles de la revisión del planteamiento del problema (guía M2 §1). */
const PALABRAS = {
  culpa: {
    nombre: 'Culpas',
    lista: ['culpa', 'negligencia', 'descuido', 'incompetente', 'flojera', 'irresponsable', 'no quiere', 'no quieren', 'comete errores', 'cometen errores'],
  },
  solucion: {
    nombre: 'Soluciones',
    lista: ['hay que', 'hace falta', 'es necesario', 'se requiere', 'necesitamos', 'debemos', 'implementar', 'instalar', 'comprar', 'contratar', 'capacitar', 'rediseñar', 'automatizar', 'sustituir'],
  },
  causa: {
    nombre: 'Causas',
    lista: ['porque', 'debido a', 'a causa de', 'causado por', 'causada por', 'se debe a', 'se deben a', 'ya que'],
  },
};
const TIEMPO = ['semana', 'semanas', 'mes', 'meses', 'trimestre', 'periodo', 'año', 'años', 'día', 'días', 'turno', 'últimas', 'últimos'];

const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const aparece = (textoNormal, frase) => new RegExp(`(^|[^a-z0-9])${sinAcentos(frase)}([^a-z0-9]|$)`).test(textoNormal);

/** Qué listas de palabras aparecen en el planteamiento. */
function revisarProblema(problema) {
  const t = sinAcentos(problema);
  const hallazgos = {};
  for (const [k, { lista }] of Object.entries(PALABRAS)) hallazgos[k] = lista.filter((p) => aparece(t, p));
  const cifras = (String(problema ?? '').match(/\d+(?:[.,]\d+)?/g) ?? []).length;
  const tiempos = TIEMPO.filter((p) => aparece(t, p));
  return { hallazgos, cifras, tiempos, vacio: !String(problema ?? '').trim() };
}

const comillas = (lista) => lista.map((p) => `«${p}»`).join(', ');

const UMBRAL = {
  titulo: 'Criterios de interpretación (guía M2 §1 y plantilla «Project Charter»)',
  filas: [
    { rango: 'Planteamiento del problema', texto: 'describe la brecha con cifras y periodo, sin culpas ni soluciones (guía M2 §1)' },
    { rango: 'Meta SMART', texto: 'específica, medible, alcanzable, relevante y con plazo; no explica el «cómo» (guía M2 §1)' },
    { rango: 'Retorno = (beneficio − costo) ÷ costo > 0', texto: 'el beneficio del primer año supera al costo del proyecto (plantilla Excel)' },
    { rango: 'Recuperación ≤ 12 meses', texto: 'el proyecto se paga dentro del primer año (referencia didáctica; la guía no fija un valor)' },
    { rango: 'Suma del cronograma ≤ plazo', texto: 'las cinco fases de DMAIC caben en el plazo comprometido (plantilla Excel: «Fechas coherentes»)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto: 'La línea base proviene de datos reales del proceso —un periodo representativo, medido con un sistema de medición confiable—, no de una estimación ni de un recuerdo. Si la línea base está mal anclada, la meta también lo está y la mejora no se podrá demostrar en la fase Controlar.',
};

export default function lab05(ctx = {}) {
  const ch = ctx.caso?.charter ?? {};
  const base = {
    nombre: ch.nombre ?? 'Reducir el DPMO de la línea de arneses',
    problema: ch.problema ?? 'En las últimas 4 semanas, la línea de ensamble de arneses para material rodante ha operado en un nivel cercano a 5σ (300 DPMO), muy por encima del estándar Six Sigma de 3.4 DPMO, generando retrabajo en el 0.15 % de las unidades y dos incidencias de falla externa reportadas por el cliente en el último trimestre.',
    metrica: ch.metrica ?? 'DPMO de arnés',
    unidadMetrica: ch.unidadMetrica ?? 'DPMO',
    lineaBase: ch.lineaBase ?? 300,
    meta: ch.meta ?? 100,
    plazoMeses: ch.plazoMeses ?? 4,
    beneficioAnual: ch.beneficioAnual ?? 450000,
    costoProyecto: ch.costoProyecto ?? 80000,
    dentro: ch.dentro ?? 'Estaciones de apriete y verificación de conectores; los 3 turnos.',
    fuera: ch.fuera ?? 'Rediseño del arnés; proveedores de terminales.',
    moneda: 'MXN',
  };
  /** Reparto didáctico del plazo de 4 meses (la guía solo fija el plazo total). */
  const cronogramaGuia = [0.5, 1, 1, 1, 0.5].map((meses) => ({ meses }));
  /** Fechas de la plantilla (2 nov 2026 – 26 mar 2027) convertidas a meses (días ÷ 30.4). */
  const cronogramaExcel = [0.6, 0.9, 0.9, 1.1, 0.6].map((meses) => ({ meses }));

  const valoresGuia = { ...base, cronograma: cronogramaGuia };
  const valoresExcel = {
    nombre: 'Reducir defectos de torque en ensamble de arneses',
    problema: 'En el periodo de referencia, la línea de arneses presenta 300 DPMO; el Turno 3 concentra la mayor parte de los defectos de torque.',
    metrica: 'DPMO de arnés',
    unidadMetrica: 'DPMO',
    lineaBase: 300,
    meta: 162,
    plazoMeses: 5,
    beneficioAnual: base.beneficioAnual,
    costoProyecto: base.costoProyecto,
    dentro: base.dentro,
    fuera: base.fuera,
    moneda: 'MXN',
    cronograma: cronogramaExcel,
  };

  return {
    id: 'lab05',
    numero: '05',
    modulo: 'M2',
    titulo: 'Project Charter',
    resumen: 'Redacta la métrica, la línea base y la meta de un proyecto, revisa el planteamiento del problema y calcula el retorno y la recuperación del caso de negocio.',
    panelAncho: true,
    entradas: [
      { id: 'nombre', tipo: 'texto', etiqueta: 'Nombre del proyecto', valor: valoresGuia.nombre, marcador: 'Verbo + métrica + proceso' },
      { id: 'problema', tipo: 'area', etiqueta: 'Planteamiento del problema (qué, dónde, cuándo, cuánto; sin causas ni soluciones)', valor: valoresGuia.problema, filasTexto: 5 },
      { tipo: 'seccion', etiqueta: 'Métrica y meta' },
      { id: 'metrica', tipo: 'texto', etiqueta: 'Métrica primaria', valor: valoresGuia.metrica, marcador: 'DPMO, % de rechazo, tiempo de ciclo…' },
      { id: 'unidadMetrica', tipo: 'texto', etiqueta: 'Unidad', valor: valoresGuia.unidadMetrica, marcador: 'DPMO, %, min…' },
      { id: 'lineaBase', tipo: 'numero', etiqueta: 'Línea base (dato real del proceso)', valor: valoresGuia.lineaBase },
      { id: 'meta', tipo: 'numero', etiqueta: 'Meta', valor: valoresGuia.meta },
      { id: 'plazoMeses', tipo: 'slider', etiqueta: 'Plazo para lograr la meta', min: 1, max: 12, paso: 1, dec: 0, valor: valoresGuia.plazoMeses, unidad: 'meses' },
      { tipo: 'seccion', etiqueta: 'Caso de negocio' },
      { id: 'moneda', tipo: 'texto', etiqueta: 'Moneda', valor: valoresGuia.moneda, marcador: 'MXN, USD…' },
      { id: 'beneficioAnual', tipo: 'numero', etiqueta: 'Beneficio estimado anual', valor: valoresGuia.beneficioAnual, min: 0 },
      { id: 'costoProyecto', tipo: 'numero', etiqueta: 'Costo estimado del proyecto', valor: valoresGuia.costoProyecto, min: 0 },
      { tipo: 'seccion', etiqueta: 'Alcance' },
      { id: 'dentro', tipo: 'area', etiqueta: 'Dentro del alcance', valor: valoresGuia.dentro, filasTexto: 2 },
      { id: 'fuera', tipo: 'area', etiqueta: 'Fuera del alcance', valor: valoresGuia.fuera, filasTexto: 2 },
      { tipo: 'seccion', etiqueta: 'Cronograma DMAIC' },
      {
        id: 'cronograma', tipo: 'tabla', etiqueta: 'Duración de cada fase (meses)',
        columnas: [
          { id: 'fase', etiqueta: 'Fase', tipo: 'fijo', texto: (estado, fila, i) => FASES[i] ?? '' },
          { id: 'meses', etiqueta: 'Meses', tipo: 'numero', min: 0, max: 12 },
        ],
        filas: cronogramaGuia, filaNueva: { meses: NaN }, minFilas: 5, maxFilas: 5, agregar: false,
      },
    ],
    presets: [
      { id: 'guia', etiqueta: 'Guía M2 §6: arneses, 300 → 100 DPMO', ayuda: 'Problema y meta de la guía (menos de 100 DPMO en 4 meses). Beneficio y costo vienen de la plantilla Excel; el reparto del cronograma es un ejemplo didáctico.', valores: valoresGuia },
      { id: 'excel', etiqueta: 'Plantilla Excel: defectos de torque', ayuda: 'Ejemplo de la hoja «Project Charter» (300 → 162 DPMO); las fechas del cronograma se convirtieron a meses.', valores: valoresExcel },
    ],
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Tu planteamiento describe la brecha con cifras y periodo, sin culpables ni soluciones? Reescríbelo hasta que la revisión no encuentre palabras de las listas.',
      '¿De qué periodo y con qué sistema de medición sale la línea base? ¿Cambiaría tu meta si la línea base real fuera 20 % peor?',
      'La meta es medible, pero ¿qué evidencia tienes de que es alcanzable en ese plazo: la capacidad del proceso, proyectos parecidos, una prueba piloto?',
      'El beneficio anual ¿incluye solo ahorros que Finanzas aceptaría (retrabajo, desperdicio, reclamos) o también beneficios difíciles de comprobar?',
    ],

    calcular(e) {
      const texto = (v) => String(v ?? '').trim();
      const nombre = texto(e.nombre);
      const metrica = texto(e.metrica);
      const unidad = texto(e.unidadMetrica);
      const moneda = texto(e.moneda);
      const problema = texto(e.problema);
      const din = (v) => `${entero(v)}${moneda ? ` ${moneda}` : ''}`;

      const lineaBase = e.lineaBase;
      const meta = e.meta;
      const hayMeta = Number.isFinite(lineaBase) && Number.isFinite(meta);
      const cambio = hayMeta ? meta - lineaBase : NaN;
      const baja = cambio < 0;
      const magnitud = Math.abs(cambio);
      const magnitudPct = hayMeta && lineaBase !== 0 ? magnitud / Math.abs(lineaBase) : NaN;
      const verbo = !hayMeta ? '' : cambio < 0 ? 'Reducir' : cambio > 0 ? 'Aumentar' : 'Mantener';
      const plazo = Number.isFinite(e.plazoMeses) && e.plazoMeses > 0 ? e.plazoMeses : NaN;
      const conU = (v) => `${corto(v)}${unidad ? ` ${unidad}` : ''}`;

      const aviso = [];
      let beneficio = e.beneficioAnual;
      let costo = e.costoProyecto;
      if (Number.isFinite(beneficio) && beneficio < 0) { aviso.push('El beneficio anual es negativo: captúralo como cantidad positiva. No se usó en el cálculo.'); beneficio = NaN; }
      if (Number.isFinite(costo) && costo < 0) { aviso.push('El costo del proyecto es negativo: captúralo como cantidad positiva. No se usó en el cálculo.'); costo = NaN; }
      const hayDinero = Number.isFinite(beneficio) && Number.isFinite(costo);
      const neto = hayDinero ? beneficio - costo : NaN;
      const roi = hayDinero && costo > 0 ? (beneficio - costo) / costo : NaN;
      const recuperacion = Number.isFinite(beneficio) && beneficio > 0 && Number.isFinite(costo) ? costo / (beneficio / 12) : NaN;

      const filasCrono = Array.isArray(e.cronograma) ? e.cronograma : [];
      const duraciones = FASES.map((_, i) => {
        const m = filasCrono[i]?.meses;
        return Number.isFinite(m) && m > 0 ? m : 0;
      });
      if (filasCrono.some((f) => Number.isFinite(f?.meses) && f.meses < 0)) aviso.push('Hay fases con meses negativos: se tomaron como 0.');
      const capturadas = filasCrono.filter((f) => Number.isFinite(f?.meses)).length;
      const suma = duraciones.reduce((s, d) => s + d, 0);
      const inicios = duraciones.map((_, i) => duraciones.slice(0, i).reduce((s, d) => s + d, 0));

      const rev = revisarProblema(problema);
      const hayDatos = Boolean(nombre || metrica || problema || hayMeta || hayDinero || suma > 0);
      if (!hayDatos) {
        return {
          vacio: 'Captura el nombre, el planteamiento, la métrica con su línea base y meta, y el beneficio y costo para revisar el charter.',
          semaforos: ['Planteamiento del problema', 'Específico', 'Medible', 'Alcanzable', 'Relevante', 'Temporal'].map((n) => ({ nombre: n, estado: 'sin-datos', texto: 'Sin datos capturados.' })),
        };
      }

      /* Declaración de objetivo (se arma sola, como en la plantilla Excel). */
      let objetivo = 'Completa la métrica, la línea base y la meta.';
      if (metrica && hayMeta) {
        const porcentaje = Number.isFinite(magnitudPct) && cambio !== 0 ? ` (${Math.round(magnitudPct * 100)} % de ${baja ? 'reducción' : 'aumento'})` : '';
        const enPlazo = Number.isFinite(plazo) ? ` en un plazo de ${corto(plazo)} ${plazo === 1 ? 'mes' : 'meses'}` : '';
        objetivo = cambio === 0
          ? `Mantener ${metrica} en ${conU(lineaBase)}${enPlazo}.`
          : `${verbo} ${metrica} de ${corto(lineaBase)} a ${conU(meta)}${porcentaje}${enPlazo}.`;
      }

      const salidas = [
        { id: 'objetivo', etiqueta: 'Declaración de objetivo', valor: objetivo, ancha: true, color: 'teal', nota: 'se arma sola con tus datos' },
        { id: 'cambio-abs', etiqueta: hayMeta && !baja && cambio > 0 ? 'Aumento absoluto' : 'Reducción absoluta', valor: hayMeta ? conU(magnitud) : '—', nota: 'línea base − meta' },
        { id: 'cambio-pct', etiqueta: hayMeta && !baja && cambio > 0 ? 'Aumento relativo' : 'Reducción relativa', valor: pct(magnitudPct, 1), color: 'azul', nota: '(línea base − meta) ÷ línea base' },
        { id: 'ritmo', etiqueta: 'Ritmo requerido', valor: Number.isFinite(magnitudPct) && Number.isFinite(plazo) ? `${pct(magnitudPct / plazo, 1)} por mes` : '—', nota: 'cambio relativo ÷ plazo' },
        { id: 'beneficio-neto', etiqueta: 'Beneficio neto del primer año', valor: hayDinero ? din(neto) : '—', nota: 'beneficio anual − costo del proyecto' },
        { id: 'roi', etiqueta: 'Retorno (ROI)', valor: Number.isFinite(roi) ? pct(roi, 1) : '—', color: 'azul', nota: '(beneficio − costo) ÷ costo' },
        { id: 'recuperacion', etiqueta: 'Recuperación de la inversión', valor: Number.isFinite(recuperacion) ? `${num(recuperacion, 1)} meses` : '—', nota: 'costo ÷ (beneficio ÷ 12)' },
        { id: 'cronograma-suma', etiqueta: 'Suma del cronograma', valor: suma > 0 ? `${num(suma, 1)} meses${Number.isFinite(plazo) ? ` de ${corto(plazo)}` : ''}` : '—', nota: 'Definir + Medir + Analizar + Mejorar + Controlar' },
      ];

      /* Semáforos SMART y alcance */
      const semaforos = [];
      if (rev.vacio) {
        semaforos.push({ nombre: 'Planteamiento del problema', estado: 'sin-datos', texto: 'Escribe el planteamiento del problema: qué, dónde, cuándo y cuánto.' });
      } else {
        const partes = [];
        if (rev.hallazgos.culpa.length) partes.push(`culpas ${comillas(rev.hallazgos.culpa)}`);
        if (rev.hallazgos.solucion.length) partes.push(`soluciones ${comillas(rev.hallazgos.solucion)}`);
        if (rev.hallazgos.causa.length) partes.push(`causas ${comillas(rev.hallazgos.causa)}`);
        if (partes.length) {
          semaforos.push({ nombre: 'Planteamiento del problema', estado: 'atencion', texto: `Aparecen palabras de ${partes.join('; ')}: el problema describe la brecha, no su causa ni su remedio.` });
        } else if (!rev.cifras) {
          semaforos.push({ nombre: 'Planteamiento del problema', estado: 'atencion', texto: 'No contiene ninguna cifra: cuantifica la brecha entre el estado actual y el deseado.' });
        } else if (!rev.tiempos.length) {
          semaforos.push({ nombre: 'Planteamiento del problema', estado: 'atencion', texto: 'Tiene cifras, pero ninguna referencia de tiempo de las listas: indica el periodo al que corresponden.' });
        } else {
          semaforos.push({ nombre: 'Planteamiento del problema', estado: 'cumple', texto: 'Sin palabras de culpa, solución ni causa, con cifras y periodo. La revisión es solo una ayuda: léelo también como lo leería tu Champion.' });
        }
      }

      const faltaEspecifico = [!nombre && 'nombre', !metrica && 'métrica', !unidad && 'unidad'].filter(Boolean);
      semaforos.push(
        faltaEspecifico.length === 3
          ? { nombre: 'Específico', estado: 'sin-datos', texto: 'Captura el nombre, la métrica y su unidad.' }
          : faltaEspecifico.length
            ? { nombre: 'Específico', estado: 'atencion', texto: `Falta: ${faltaEspecifico.join(', ')}.` }
            : { nombre: 'Específico', estado: 'cumple', texto: `Una métrica concreta: ${metrica} (${unidad}).` }
      );
      semaforos.push(
        !hayMeta
          ? { nombre: 'Medible', estado: 'sin-datos', texto: 'Captura la línea base y la meta como números.' }
          : cambio === 0
            ? { nombre: 'Medible', estado: 'atencion', texto: 'La meta es igual a la línea base: no hay mejora que medir.' }
            : { nombre: 'Medible', estado: 'cumple', texto: `De ${conU(lineaBase)} a ${conU(meta)}: la mejora se puede verificar con la misma métrica.` }
      );
      if (!hayMeta) {
        semaforos.push({ nombre: 'Alcanzable', estado: 'sin-datos', texto: 'Captura la línea base y la meta.' });
      } else if (baja && meta <= 0) {
        semaforos.push({ nombre: 'Alcanzable', estado: 'atencion', texto: 'Una meta de cero elimina el defecto por completo: justifícala con la capacidad del proceso o fija un valor intermedio.' });
      } else {
        semaforos.push({ nombre: 'Alcanzable', estado: 'informativo', texto: `${pct(magnitudPct, 1)} ${baja ? 'de reducción' : 'de aumento'}${Number.isFinite(plazo) ? ` en ${corto(plazo)} ${plazo === 1 ? 'mes' : 'meses'}` : ''}. Ninguna regla fija lo decide: compáralo con la capacidad del proceso y con proyectos parecidos.` });
      }
      semaforos.push(
        !hayDinero
          ? { nombre: 'Relevante', estado: 'sin-datos', texto: 'Captura el beneficio anual y el costo del proyecto.' }
          : neto > 0
            ? { nombre: 'Relevante', estado: 'cumple', texto: `Beneficio neto de ${din(neto)} en el primer año${Number.isFinite(recuperacion) ? `; se recupera en ${num(recuperacion, 1)} meses` : ''}.` }
            : { nombre: 'Relevante', estado: 'atencion', texto: 'El beneficio del primer año no cubre el costo: revisa el caso de negocio o el alcance.' }
      );
      semaforos.push(
        !Number.isFinite(plazo)
          ? { nombre: 'Temporal', estado: 'sin-datos', texto: 'Fija el plazo para lograr la meta.' }
          : capturadas === 0
            ? { nombre: 'Temporal', estado: 'informativo', texto: `Plazo de ${corto(plazo)} meses; captura la duración de cada fase para comprobar que cabe.` }
            : suma <= plazo + 1e-9
              ? { nombre: 'Temporal', estado: 'cumple', texto: `Las cinco fases suman ${num(suma, 1)} meses y caben en el plazo de ${corto(plazo)}.` }
              : { nombre: 'Temporal', estado: 'critico', texto: `Las cinco fases suman ${num(suma, 1)} meses y rebasan el plazo de ${corto(plazo)}: ajusta el cronograma o el plazo.` }
      );
      const dentro = texto(e.dentro);
      const fuera = texto(e.fuera);
      semaforos.push(
        dentro && fuera
          ? { nombre: 'Alcance', estado: 'cumple', texto: 'Define lo que entra y lo que no entra al proyecto.' }
          : dentro || fuera
            ? { nombre: 'Alcance', estado: 'atencion', texto: `Falta definir ${dentro ? 'lo que queda fuera' : 'lo que queda dentro'} del alcance.` }
            : { nombre: 'Alcance', estado: 'sin-datos', texto: 'Define lo que queda dentro y fuera del alcance.' }
      );

      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((fila, i) => ({
          ...fila,
          activa: [
            !rev.vacio && !Object.values(rev.hallazgos).some((l) => l.length) && rev.cifras > 0,
            hayMeta && cambio !== 0 && Boolean(metrica) && Boolean(unidad) && hayDinero && Number.isFinite(plazo),
            Number.isFinite(roi) && roi > 0,
            Number.isFinite(recuperacion) && recuperacion <= 12,
            Number.isFinite(plazo) && suma > 0 && suma <= plazo + 1e-9,
          ][i],
        })),
      };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Confirma de dónde sale la línea base: periodo, tamaño de muestra y sistema de medición.' };

      /* Gráficas */
      const graficas = [];
      if (suma > 0) {
        graficas.push({
          id: 'cronograma', titulo: 'Cronograma DMAIC (meses desde el inicio)',
          datos: [
            { type: 'bar', orientation: 'h', x: inicios, y: FASES, marker: { color: 'rgba(0,0,0,0)' }, hoverinfo: 'skip', showlegend: false },
            { type: 'bar', orientation: 'h', x: duraciones, y: FASES, marker: { color: COLORES_FASE, line: { width: 0 } }, text: duraciones.map((d) => (d > 0 ? num(d, 1) : '')), textposition: 'inside', insidetextanchor: 'middle', textfont: { color: '#0a1011', size: 11 }, hovertemplate: '%{y}: %{x:.1f} meses<extra></extra>', showlegend: false },
          ],
          layout: {
            barmode: 'stack', showlegend: false, bargap: 0.3,
            xaxis: { title: { text: 'Meses desde el inicio' }, rangemode: 'tozero' },
            yaxis: { autorange: 'reversed' },
            shapes: Number.isFinite(plazo) ? [lineaV(plazo, COLOR.ambar)] : [],
            annotations: Number.isFinite(plazo) ? [etiquetaV(plazo, `Plazo: ${corto(plazo)}`, COLOR.ambar, { ancla: 'right' })] : [],
          },
          respaldo: { columnas: ['Fase', 'Inicia (mes)', 'Duración (meses)', 'Termina (mes)'], filas: FASES.map((f, i) => [f, num(inicios[i], 1), num(duraciones[i], 1), num(inicios[i] + duraciones[i], 1)]) },
        });
      }
      if (hayDinero) {
        graficas.push({
          id: 'retorno', titulo: `Caso de negocio${moneda ? ` (${moneda})` : ''}`,
          datos: [trazaBarras(['Beneficio anual', 'Costo del proyecto', 'Beneficio neto'], [beneficio, costo, neto], { colores: [COLOR.teal, COLOR.coral, COLOR.azul], texto: [entero(beneficio), entero(costo), entero(neto)], mostrarLeyenda: false })],
          layout: { showlegend: false, yaxis: { rangemode: 'tozero', tickformat: ',d' } },
          respaldo: { columnas: ['Concepto', 'Monto'], filas: [['Beneficio anual', entero(beneficio)], ['Costo del proyecto', entero(costo)], ['Beneficio neto del primer año', entero(neto)]] },
        });
      }
      if (hayMeta) {
        graficas.push({
          id: 'meta', titulo: `Línea base y meta${unidad ? ` (${unidad})` : ''}`,
          datos: [trazaBarras(['Línea base', 'Meta'], [lineaBase, meta], { colores: [COLOR.coral, COLOR.teal], texto: [corto(lineaBase), corto(meta)], mostrarLeyenda: false })],
          layout: { showlegend: false, yaxis: { rangemode: 'tozero' } },
          respaldo: { columnas: ['Concepto', 'Valor'], filas: [['Línea base', corto(lineaBase)], ['Meta', corto(meta)]] },
        });
      }

      /* Tablas: revisión del planteamiento (listas visibles) y cronograma */
      const filasRevision = Object.entries(PALABRAS).map(([k, { nombre: n, lista }]) => [
        n,
        lista.join(', '),
        rev.vacio ? { texto: 'sin texto', estado: 'sin-datos' } : rev.hallazgos[k].length ? { texto: rev.hallazgos[k].join(', '), estado: 'atencion' } : { texto: 'ninguna', estado: 'cumple' },
      ]);
      filasRevision.push(
        ['Cuánto (cifras)', 'al menos un número', rev.vacio ? { texto: 'sin texto', estado: 'sin-datos' } : rev.cifras ? { texto: `${rev.cifras} cifra(s)`, estado: 'cumple' } : { texto: 'ninguna', estado: 'atencion' }],
        ['Cuándo (periodo)', TIEMPO.join(', '), rev.vacio ? { texto: 'sin texto', estado: 'sin-datos' } : rev.tiempos.length ? { texto: rev.tiempos.join(', '), estado: 'cumple' } : { texto: 'ninguna', estado: 'atencion' }]
      );
      const tablas = [
        {
          titulo: 'Revisión del planteamiento del problema (listas de palabras)',
          columnas: ['Revisión', 'Palabras que se buscan', 'Encontradas'],
          filas: filasRevision,
          pie: 'Es una ayuda de lectura: busca esas palabras exactas y no entiende el sentido de la frase. Un planteamiento puede pasarla y aun así ser vago, o fallarla sin ser incorrecto.',
        },
      ];
      if (suma > 0) {
        tablas.push({
          titulo: 'Cronograma por fase',
          columnas: ['Fase', { t: 'Meses', num: true }, { t: 'Inicia (mes)', num: true }, { t: 'Termina (mes)', num: true }],
          filas: [
            ...FASES.map((f, i) => [f, { texto: num(duraciones[i], 1), num: true }, { texto: num(inicios[i], 1), num: true, formula: true }, { texto: num(inicios[i] + duraciones[i], 1), num: true, formula: true }]),
            ['Suma', { texto: num(suma, 1), num: true, formula: true }, { texto: '', num: true }, { texto: num(suma, 1), num: true, formula: true }],
          ],
          resaltar: [5],
          pie: 'Las fases se encadenan una tras otra (sin traslape).',
        });
      }

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
