/**
 * LAB 18 · ANOVA de un factor
 *
 * Guía: M7 §2 («ANOVA: comparar tres o más grupos a la vez», con el ejemplo mínimo de seis datos y las cinco fuerzas de
 * engarzado por turno) y su paso a paso en Minitab (Tukey para saber cuáles grupos difieren; gráficas de residuos antes de
 * confiar en el resultado) · plantilla Excel «ANOVA».
 *   El ANOVA reparte la variación total (SC total) en la que hay ENTRE los grupos (SC entre, k − 1 grados de libertad) y la
 *   que hay DENTRO de ellos (SC dentro, N − k). Cada suma entre sus grados de libertad es un cuadrado medio y
 *   F = CM entre / CM dentro: si es grande, al menos una media es distinta. El valor p es la probabilidad de una F tan grande
 *   o mayor si H₀ (todas las medias iguales) fuera cierta. No dice CUÁL grupo difiere: para eso están las comparaciones por pares.
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Reglas de la plantilla que se conservan: hasta 6 grupos; solo cuentan los grupos con al menos 2 datos; η² = SC entre / SC
 * total; razón s máx / s mín menor que 2 es razonable; las comparaciones por pares solo se interpretan si el ANOVA es
 * significativo. Una decisión distinta: la plantilla compara con LSD de Fisher, que no controla el error por comparaciones
 * múltiples (ella misma recomienda Tukey para un reporte formal) y la guía recomienda Tukey; por eso aquí el método por
 * defecto es Tukey–Kramer y LSD queda como opción.
 *
 * Presets: la guía (ejemplo mínimo y los tres turnos con cinco datos), la plantilla (tres turnos con diez datos, con LSD) y un
 * caso derivado (turnos 1 y 2 de la guía) donde el ANOVA no es significativo.
 */
import { anovaUnFactor } from '../js/lib/analizar.js';
import { envolver, hexARgba, lineaH, lineaV } from '../js/lib/graficas.js';
import { normalCdf, normalPpf } from '../js/lib/stats.js';
import { COLOR } from '../js/core/config.js';
import { cientifica, cifras, conSigno, corto, entero, num, pct, plural, valorP } from '../js/core/format.js';

const MAX_GRUPOS = 6; // la plantilla tiene seis columnas de captura
const ALFA_DEFECTO = 0.05;
const RAZON_S = 2; // plantilla: «< 2 es razonable»
const PALETA = [COLOR.azul, COLOR.teal, COLOR.coral, COLOR.violeta, COLOR.ambar, COLOR.verde];
const METODOS = { tukey: 'Tukey–Kramer', lsd: 'LSD de Fisher' };
/** Percentiles que se rotulan en la gráfica de probabilidad normal, con su cuantil z. */
const PERCENTILES = [1, 5, 25, 50, 75, 95, 99].map((p) => ({ p, z: normalPpf(p / 100) }));

const UMBRAL_EFECTO = [
  { hasta: 0.01, nombre: 'muy pequeño' },
  { hasta: 0.06, nombre: 'pequeño' },
  { hasta: 0.14, nombre: 'mediano' },
  { hasta: Infinity, nombre: 'grande' },
];

const limpio = (t) => String(t ?? '').replace(/[<>]/g, '');
/** Posición horizontal determinista (sin azar) para que los puntos de un grupo no se encimen: ±0.17. */
const dispersion = (i) => (((i * 0.6180339887) % 1) - 0.5) * 0.34;
const sc = (x) => (!Number.isFinite(x) ? '—' : Math.abs(x) >= 1 || x === 0 ? num(x, 2) : cifras(x, 3));
/** Decimales para medias y diferencias según la escala de los datos (la desviación combinada). */
const decimalesDe = (s) => (!(s > 0) || s >= 0.5 ? 2 : s >= 0.05 ? 3 : 4);
const unicos = (nombres) => {
  const visto = new Map();
  return nombres.map((n) => {
    const veces = (visto.get(n) ?? 0) + 1;
    visto.set(n, veces);
    return veces > 1 ? `${n} (${veces})` : n;
  });
};
const listaCitada = (items, max = 3) => {
  const citados = items.slice(0, max);
  if (items.length > max) citados.push(`${items.length - max} más`);
  return citados.length > 1 ? `${citados.slice(0, -1).join(', ')} y ${citados[citados.length - 1]}` : citados[0] ?? '';
};

const UMBRAL = (estado = {}) => ({
  titulo: 'Cómo leer el ANOVA',
  filas: [
    { rango: 'p < α', texto: 'se rechaza H₀: al menos una media es distinta (guía M7 §2). No dice cuál grupo ni de cuánto: eso lo dicen las comparaciones por pares', activa: estado.significativo === true },
    { rango: 'p ≥ α', texto: 'no hay evidencia de que las medias sean distintas. No prueba que sean iguales: con pocos datos la prueba solo detecta diferencias grandes', activa: estado.significativo === false },
    { rango: 'Razón s máx / s mín', texto: 'menos de 2 es razonable; más de 2 es «varianzas muy distintas: revisa el supuesto» (plantilla «ANOVA»). Es una regla práctica, no una prueba', activa: estado.varianzas === false },
    { rango: 'η² = SC entre / SC total', texto: 'proporción de la variación total que separa a los grupos. Referencia didáctica (Cohen): 0.01 efecto pequeño, 0.06 mediano, 0.14 grande' },
    { rango: 'Comparaciones por pares', texto: 'solo si el ANOVA es significativo. Tukey–Kramer (guía M7) controla el error de todo el conjunto de comparaciones; LSD de Fisher (plantilla) no lo controla y puede declarar diferencias de más' },
  ],
});

const SUPUESTO = {
  titulo: 'Supuestos del ANOVA de un factor',
  texto:
    'Tres supuestos que el software no valida por sí solo (guía M7): (1) independencia, que una medición no influya en la siguiente (aleatoriza y no mezcles mediciones repetidas de la misma pieza como si fueran datos distintos); ' +
    '(2) normalidad de los residuos, que son cada dato menos la media de su grupo; (3) homogeneidad de varianzas, dispersión parecida en todos los grupos. ' +
    'Las gráficas de residuos de abajo los revisan de un vistazo: patrones, embudos o curvas donde debería haber una nube sin forma son la alerta. ' +
    'El ANOVA es para datos continuos: con conteos de defectos por turno usa la chi-cuadrada (LAB 19). Si el factor tiene solo dos grupos, F = t² y equivale a la prueba t de dos muestras.',
};

/** { nombre1, datos1, … nombre6, datos6 } con la lista de grupos; los lugares sobrantes quedan vacíos para que el preset fije todo. */
const valoresDeGrupos = (grupos = []) => {
  const v = {};
  for (let i = 0; i < MAX_GRUPOS; i++) {
    v[`nombre${i + 1}`] = grupos[i]?.nombre ?? '';
    v[`datos${i + 1}`] = grupos[i]?.datos ?? [];
  }
  return v;
};

export default function lab18(ctx = {}) {
  const caso = ctx.caso?.anova ?? {};
  const guia = caso.guia?.grupos ?? [];
  const minimo = caso.minimo?.grupos ?? [];
  const excel = caso.excel?.grupos ?? [];
  const unidad = caso.unidad ?? '';

  const presets = [
    ...(guia.length
      ? [{
        id: 'guia', etiqueta: 'Guía M7 §2: fuerza de engarzado por turno (5 datos cada uno)',
        ayuda: 'F(2, 12) = 14.22, p < 0.001: el Turno 3 (165 N) se separa de los turnos 1 y 2 (175 y 174 N), como sospechaba el Ishikawa del LAB 16. Ojo: la razón de desviaciones (2.05) apenas rebasa la referencia de 2 de la plantilla; con cinco datos por grupo esa razón es muy inestable.',
        valores: { unidad, alfa: ALFA_DEFECTO, comparacion: 'tukey', ...valoresDeGrupos(guia) },
      }]
      : []),
    ...(minimo.length
      ? [{
        id: 'minimo', etiqueta: 'Guía M7 §2: ejemplo mínimo (A 10 · 12, B 14 · 16, C 18 · 20)',
        ayuda: 'La mecánica con seis datos: SC entre 64 + SC dentro 6 = SC total 70; gl 2 y 3; CM 32 y 2; F = 16. Con dos datos por grupo sirve para ver cómo se reparte la variación, no para decidir nada.',
        valores: { unidad: caso.minimo?.unidad ?? '', alfa: ALFA_DEFECTO, comparacion: 'tukey', ...valoresDeGrupos(minimo) },
      }]
      : []),
    ...(excel.length
      ? [{
        id: 'excel', etiqueta: 'Plantilla Excel «ANOVA»: tres turnos (10 datos cada uno, LSD)',
        ayuda: 'Los datos de la hoja «ANOVA», con su método (LSD de Fisher): F(2, 27) = 54.13. El Turno 3 (165.11 N) difiere de los otros dos; los turnos 1 y 2 (178.39 y 177.60 N) no se distinguen. Cambia a Tukey–Kramer para ver el método que recomienda la guía.',
        valores: { unidad, alfa: ALFA_DEFECTO, comparacion: 'lsd', ...valoresDeGrupos(excel) },
      }]
      : []),
    ...(guia.length >= 2
      ? [{
        id: 'sinDiferencia', etiqueta: 'Derivado de la guía: solo los turnos 1 y 2 (sin diferencia)',
        ayuda: 'Los datos de los turnos 1 y 2 de la guía (175 y 174 N): F(1, 8) = 0.45, p = 0.52. El ANOVA no es significativo y no se interpretan comparaciones por pares. Con dos grupos, F es el cuadrado de la t de dos muestras.',
        valores: { unidad, alfa: ALFA_DEFECTO, comparacion: 'tukey', ...valoresDeGrupos(guia.slice(0, 2)) },
      }]
      : []),
  ];

  const entradasGrupos = [];
  for (let i = 0; i < MAX_GRUPOS; i++) {
    entradasGrupos.push(
      { id: `nombre${i + 1}`, tipo: 'texto', etiqueta: `Grupo ${i + 1} · nombre`, valor: guia[i]?.nombre ?? '', marcador: `Grupo ${i + 1}` },
      {
        id: `datos${i + 1}`, tipo: 'datos', etiqueta: `Grupo ${i + 1} · mediciones`, valor: guia[i]?.datos ?? [], filasTexto: 3,
        marcador: i === 0 ? 'Pega la columna de Excel o escribe los valores' : '',
        ayuda: i === 0 ? 'Un grupo por columna de la plantilla. Separa los valores con espacios, comas o saltos de línea. Un grupo con un solo dato se ignora.' : undefined,
      },
    );
  }

  return {
    id: 'lab18',
    numero: '18',
    modulo: 'M7',
    titulo: 'ANOVA de un factor',
    resumen: 'Compara las medias de tres o más grupos en una sola prueba: arma la tabla ANOVA (SC, gl, CM, F y valor p), mide el tamaño del efecto, averigua con Tukey o LSD cuáles grupos difieren y revisa los supuestos con las gráficas de residuos.',
    panelAncho: true,
    entradas: [
      { tipo: 'seccion', etiqueta: 'Datos · una columna por grupo (hasta 6, al menos 2 datos cada uno)' },
      { id: 'unidad', tipo: 'texto', etiqueta: 'Unidad de medida (opcional)', valor: unidad, marcador: 'p. ej. N' },
      ...entradasGrupos,
      { tipo: 'seccion', etiqueta: 'Prueba y comparaciones' },
      {
        id: 'alfa', tipo: 'numero', etiqueta: 'Nivel de significancia α', valor: ALFA_DEFECTO, min: 0.0001, max: 0.9999, marcador: '0.05',
        ayuda: 'Se fija antes de ver los datos; casi siempre es 0.05. Debe estar entre 0 y 1.',
      },
      {
        id: 'comparacion', tipo: 'opcion', etiqueta: 'Comparaciones por pares', valor: 'tukey',
        opciones: [
          { valor: 'tukey', texto: 'Tukey–Kramer (guía M7)', ayuda: 'Controla el error de todo el conjunto de comparaciones.' },
          { valor: 'lsd', texto: 'LSD de Fisher (plantilla)', ayuda: 'No controla el error por comparaciones múltiples.' },
        ],
        ayuda: 'Solo se interpretan si el ANOVA es significativo. La guía recomienda Tukey; la plantilla usa LSD, que declara diferencias con más facilidad.',
      },
    ],
    presets,
    umbral: UMBRAL(),
    supuesto: SUPUESTO,
    preguntas: [
      'En el ejemplo mínimo, comprueba a mano que SC entre (64) + SC dentro (6) = SC total (70) y que F = 32 / 2 = 16. Si las medias siguieran en 11, 15 y 19 pero los datos de cada grupo estuvieran más dispersos, ¿qué le pasaría a F y por qué?',
      'Con los tres turnos de la guía, F(2, 12) = 14.22 rechaza H₀. ¿Qué te dice esa conclusión y qué NO te dice? ¿Qué necesitas para saber cuál turno es el distinto, y por qué no basta correr tres pruebas t por pares?',
      'Corre los mismos datos con Tukey–Kramer y con LSD de Fisher. ¿Cambia alguna conclusión? ¿Cuándo esperarías que los dos métodos discrepen: con más grupos, con diferencias medianas o con más datos por grupo?',
      'En los datos de la guía la razón s máx / s mín queda apenas arriba de 2. ¿Qué harías antes de confiar en el resultado? Mira la gráfica de residuos contra valores ajustados: ¿la dispersión de los tres turnos se ve distinta?',
      'Un ANOVA puede tener un valor p diminuto y un η² pequeño. ¿Qué significa eso para la decisión práctica? ¿Qué herramienta usarías si en lugar de fuerzas medidas tuvieras el conteo de arneses defectuosos por turno?',
    ],

    calcular(e) {
      const aviso = [];
      let alfa = ALFA_DEFECTO;
      if (Number.isFinite(e.alfa)) {
        if (e.alfa > 0 && e.alfa < 1) alfa = e.alfa;
        else aviso.push(`El nivel de significancia α debe estar entre 0 y 1 (capturaste ${corto(e.alfa, 4)}): se usó α = ${ALFA_DEFECTO}.`);
      }
      const metodo = e.comparacion === 'lsd' ? 'lsd' : 'tukey';
      const grupos = Array.from({ length: MAX_GRUPOS }, (_, i) => ({ nombre: e[`nombre${i + 1}`], datos: e[`datos${i + 1}`] ?? [] }));
      const sinDatos = grupos.filter((g) => String(g.nombre ?? '').trim() && !g.datos.length).map((g) => `«${limpio(g.nombre).trim()}»`);
      if (sinDatos.length) aviso.push(`${plural(sinDatos.length, 'grupo tiene', 'grupos tienen')} nombre pero ningún dato (${listaCitada(sinDatos)}): no cuenta${sinDatos.length > 1 ? 'n' : ''}.`);

      const a = anovaUnFactor(grupos, { alfa });
      if (a.ignorados.length) {
        aviso.push(`${plural(a.ignorados.length, 'grupo tiene', 'grupos tienen')} un solo dato (${listaCitada(a.ignorados.map((g) => `«${limpio(g.nombre)}»`))}) y se ignoran: el ANOVA necesita al menos 2 datos por grupo para estimar la variación dentro de él.`);
      }
      if (!a.valido) {
        return {
          aviso,
          umbral: UMBRAL(),
          vacio: 'Captura al menos 2 grupos con 2 datos cada uno (una columna por grupo) para ver la tabla ANOVA, el valor p, las comparaciones por pares y las gráficas.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: a.k === 1 ? 'Solo un grupo tiene al menos 2 datos: el ANOVA compara grupos, necesita al menos dos.' : 'Sin grupos con al menos 2 datos.' }],
        };
      }

      const { k, N } = a;
      const nombres = unicos(a.usados.map((g) => limpio(g.nombre)));
      if (nombres.some((n, i) => n !== limpio(a.usados[i].nombre))) aviso.push('Hay grupos con el mismo nombre; en las tablas y gráficas se distinguen con un número entre paréntesis.');
      const sCombinada = Math.sqrt(a.cmDentro);
      const dec = decimalesDe(sCombinada);
      const u = String(e.unidad ?? '').trim();
      const conU = (t) => (u ? `${t} ${limpio(u)}` : t);
      const alfaTxt = corto(alfa, 4);
      const nivelTxt = corto((1 - alfa) * 100, 2);
      const gl = `F(${a.glEntre}, ${a.glDentro})`;
      const pTxt = a.p < 0.0001 ? 'p < 0.0001' : `p = ${num(a.p, 4)}`;
      const sig = a.significativo;
      const ns = a.usados.map((g) => g.n);
      const nMin = Math.min(...ns);
      const nMax = Math.max(...ns);
      const varianzasOk = !(a.razonS > RAZON_S);
      const clase = UMBRAL_EFECTO.find((c) => a.eta2 < c.hasta)?.nombre ?? 'grande';
      const nombreMetodo = METODOS[metodo];
      const difiere = (p) => (metodo === 'lsd' ? p.difiereLsd : p.difiereTukey);
      const parTexto = (p) => `${nombres[p.i]} − ${nombres[p.j]} (${conSigno(p.dif, dec)})`;
      const pares = a.pares;
      const quienes = pares.filter(difiere);
      const nadie = pares.filter((p) => !difiere(p));
      const soloLsd = pares.filter((p) => p.difiereLsd && !p.difiereTukey);

      /* ---- salidas ---- */
      const salidas = [
        { id: 'F', etiqueta: 'Estadístico F', valor: num(a.F, 2), color: 'azul', nota: a.sinVariacion ? 'CM dentro = 0: no se puede calcular' : `${gl} · crítico ${num(a.fCritico, 3)} con α = ${alfaTxt}` },
        {
          id: 'p', etiqueta: 'Valor p', valor: valorP(a.p), color: sig ? 'ambar' : 'teal',
          nota: !Number.isFinite(a.p) ? 'sin F no hay valor p' : `${a.p < 0.0001 ? `${cientifica(a.p, 3)} · ` : ''}${sig ? 'p < α' : 'p ≥ α'} (α = ${alfaTxt})`,
        },
        { id: 'eta2', etiqueta: 'Tamaño del efecto η²', valor: num(a.eta2, 3), color: 'violeta', nota: Number.isFinite(a.eta2) ? `${pct(a.eta2, 1)} de la variación total · ${clase}` : 'sin variación que repartir' },
        {
          id: 'razonS', etiqueta: 'Razón s máx / s mín', valor: a.razonS === Infinity ? '∞' : num(a.razonS, 2), color: Number.isFinite(a.razonS) ? (varianzasOk ? 'verde' : 'ambar') : undefined,
          nota: !Number.isFinite(a.razonS) && a.razonS !== Infinity ? 'sin variación en los grupos' : varianzasOk ? 'menos de 2: varianzas parecidas' : 'más de 2: revisa el supuesto',
        },
        { id: 'grupos', etiqueta: 'Grupos · datos (N)', valor: `${k} · ${entero(N)}`, nota: `gl entre = ${a.glEntre} · gl dentro = ${a.glDentro}` },
      ];
      if (sig) salidas.push({ id: 'pares', etiqueta: 'Pares que difieren', valor: `${quienes.length} de ${pares.length}`, color: 'coral', nota: `${nombreMetodo} · α = ${alfaTxt}` });
      else salidas.push({ id: 'media', etiqueta: 'Media global', valor: conU(num(a.mediaGlobal, dec)), nota: 'de todos los datos' });

      /* ---- semáforos ---- */
      const semaforos = [];
      if (a.sinVariacion) {
        semaforos.push({ nombre: 'Conclusión del ANOVA', estado: 'atencion', texto: 'Dentro de cada grupo todos los datos son iguales (CM dentro = 0): F no se puede calcular. Revisa si los datos están redondeados, copiados o en la columna equivocada.' });
      } else if (sig) {
        semaforos.push({ nombre: 'Conclusión del ANOVA', estado: 'atencion', texto: `${gl} = ${num(a.F, 2)} y ${pTxt}. Como p < α (${alfaTxt}), se rechaza H₀: al menos una media es distinta. El ANOVA no dice cuál ni de cuánto: eso lo dicen las comparaciones por pares.` });
      } else {
        semaforos.push({ nombre: 'Conclusión del ANOVA', estado: 'informativo', texto: `${gl} = ${num(a.F, 2)} y ${pTxt}. Como p ≥ α (${alfaTxt}), no hay evidencia de que las medias sean distintas. Eso no prueba que sean iguales: con pocos datos la prueba solo detecta diferencias grandes.` });
      }
      if (Number.isFinite(a.eta2) && !a.sinVariacion) {
        const matiz = sig && a.eta2 < 0.06
          ? ' Un valor p pequeño con un η² pequeño señala una diferencia real pero quizá sin importancia práctica.'
          : !sig && a.eta2 >= 0.14
            ? ' Un η² grande sin significancia suele indicar pocos datos: el efecto observado puede ser puro azar.'
            : '';
        semaforos.push({
          nombre: 'Tamaño del efecto', estado: 'informativo',
          texto: `η² = ${num(a.eta2, 3)}: la pertenencia al grupo explica ${pct(a.eta2, 1)} de la variación total; efecto ${clase} según la referencia didáctica de Cohen (0.01, 0.06 y 0.14).${matiz}`,
        });
      }
      if (a.razonS === Infinity) {
        semaforos.push({ nombre: 'Varianzas parecidas', estado: 'atencion', texto: 'Un grupo no tiene variación (s = 0) y otro sí: la razón s máx / s mín no se puede calcular. Revisa si los datos de ese grupo están redondeados o repetidos.' });
      } else if (Number.isFinite(a.razonS)) {
        semaforos.push(varianzasOk
          ? { nombre: 'Varianzas parecidas', estado: 'cumple', texto: `La razón entre la mayor y la menor desviación estándar es ${num(a.razonS, 2)} (menos de 2, referencia de la plantilla): las varianzas son parecidas.` }
          : {
            nombre: 'Varianzas parecidas', estado: 'atencion',
            texto: `Razón s máx / s mín = ${num(a.razonS, 2)}, más de 2: varianzas muy distintas; revisa el supuesto con la gráfica de residuos.${nMin <= 5 ? ' Con cinco datos o menos por grupo esta razón es muy inestable: un solo dato puede moverla mucho, y 2 es una regla práctica, no una prueba.' : ''}`,
          });
      }
      if (nMin < 5) {
        semaforos.push({
          nombre: 'Tamaño de los grupos', estado: 'atencion',
          texto: `Algún grupo tiene menos de 5 datos (n mínimo = ${nMin}): la prueba solo detecta diferencias grandes y no hay forma de revisar la normalidad ni las varianzas. Sirve para ver la mecánica, no para decidir (referencia didáctica).`,
        });
      } else if (nMin !== nMax) {
        semaforos.push({
          nombre: 'Tamaño de los grupos', estado: 'informativo',
          texto: `Los grupos tienen tamaños distintos (n de ${nMin} a ${nMax}). El ANOVA y Tukey–Kramer lo toleran, pero la prueba es más sensible a varianzas desiguales cuando los grupos más chicos son los más dispersos.`,
        });
      }
      if (a.sinVariacion) {
        // Sin F no hay prueba que proteja las comparaciones: no se dice nada de los pares.
      } else if (!sig) {
        semaforos.push({ nombre: 'Comparaciones por pares', estado: 'informativo', texto: 'Como el ANOVA no es significativo, no se interpretan comparaciones por pares (la plantilla las marca «ANOVA n/s»).' });
      } else if (!quienes.length) {
        semaforos.push({
          nombre: 'Comparaciones por pares', estado: 'informativo',
          texto: `El ANOVA es significativo pero ningún par supera el umbral de ${nombreMetodo}: puede pasar cuando la diferencia se reparte entre varios grupos. Revisa los datos y considera más mediciones.`,
        });
      } else {
        semaforos.push({
          nombre: 'Comparaciones por pares', estado: 'atencion',
          texto: `Con ${nombreMetodo} (α = ${alfaTxt}) difieren ${listaCitada(quienes.map(parTexto))}${nadie.length ? `; no se distinguen ${listaCitada(nadie.map(parTexto))}` : ''}.${metodo === 'tukey' && soloLsd.length ? ` LSD, que no controla el error global, declararía además diferencia en ${listaCitada(soloLsd.map(parTexto))}.` : ''}`,
        });
      }
      if (sig && metodo === 'lsd' && k >= 3) {
        semaforos.push({
          nombre: 'Comparaciones múltiples', estado: 'atencion',
          texto: `LSD de Fisher no controla el error por comparaciones múltiples (plantilla): con tres o más grupos puede declarar diferencias que no existen; para un reporte formal usa Tukey–Kramer (guía M7). ${soloLsd.length ? `Aquí LSD y Tukey discrepan en ${listaCitada(soloLsd.map(parTexto))}: LSD declara diferencia y Tukey no.` : 'Aquí LSD y Tukey coinciden en todos los pares.'}`,
        });
      }
      if (k === 2) {
        semaforos.push({ nombre: 'Dos grupos', estado: 'informativo', texto: `Con dos grupos el ANOVA coincide con la prueba t de dos muestras con varianza combinada (F = t²): no hay comparaciones múltiples que controlar.` });
      }

      const umbral = UMBRAL({ significativo: a.sinVariacion ? undefined : sig, varianzas: Number.isFinite(a.razonS) ? varianzasOk : undefined });
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Si los residuos no se ven normales o la dispersión cambia entre grupos, no te quedes con el valor p: transforma los datos, revisa si hay datos atípicos o usa un método robusto.' };

      /* ---- puntos, residuos y colores ---- */
      const color = (g) => PALETA[g % PALETA.length];
      const puntos = [];
      a.usados.forEach((g, gi) => g.datos.forEach((v, i) => puntos.push({ g: gi, i, valor: v, ajustado: g.media, residuo: v - g.media })));
      const rango = (xs) => [Math.min(...xs), Math.max(...xs)];
      const tickGrupo = (gi) => envolver(nombres[gi], 14, 2);
      const tituloY = u ? `Valor (${limpio(u)})` : 'Valor';
      const nivelIC = `IC de ${nivelTxt} %`;

      /* 1 · datos, medias e intervalos */
      const trazasGrupos = a.usados.map((g, gi) => ({
        type: 'scatter', mode: 'markers', name: nombres[gi], showlegend: false,
        x: g.datos.map((_, i) => gi + 1 + dispersion(i)), y: g.datos,
        marker: { color: hexARgba(color(gi), 0.85), size: 8, line: { color: '#0a1011', width: 1 } },
        text: g.datos.map((v, i) => `<b>${nombres[gi]}</b><br>dato ${i + 1}: ${conU(num(v, dec))}`), hovertemplate: '%{text}<extra></extra>',
      }));
      const trazaMedias = {
        type: 'scatter', mode: 'markers', name: `Media ± ${nivelIC}`,
        x: a.usados.map((_, gi) => gi + 1), y: a.usados.map((g) => g.media),
        marker: { symbol: 'diamond', size: 11, color: COLOR.blanco, line: { color: '#0a1011', width: 1 } },
        error_y: { type: 'data', array: a.usados.map((g) => g.semi), visible: true, color: COLOR.blanco, thickness: 2, width: 9 },
        text: a.usados.map((g, gi) => `<b>${nombres[gi]}</b><br>n = ${g.n} · media ${conU(num(g.media, dec))}<br>${nivelIC}: ${num(g.ic[0], dec)} a ${num(g.ic[1], dec)}`), hovertemplate: '%{text}<extra></extra>',
      };
      const trazaGlobal = {
        type: 'scatter', mode: 'lines', name: `Media global (${num(a.mediaGlobal, dec)})`, x: [0.45, k + 0.55], y: [a.mediaGlobal, a.mediaGlobal],
        line: { color: COLOR.gris, width: 1.5, dash: 'dot' }, hoverinfo: 'skip',
      };

      /* 3 · residuos contra valores ajustados */
      const ajustados = a.usados.map((g) => g.media);
      const [aMin, aMax] = rango(ajustados);
      const ancho = aMax > aMin ? (aMax - aMin) * 0.05 : (sCombinada || 1) * 0.5;
      const dosS = 2 * sCombinada;
      const trazasResiduos = a.usados.map((g, gi) => {
        const ps = puntos.filter((p) => p.g === gi);
        return {
          type: 'scatter', mode: 'markers', name: nombres[gi], showlegend: false,
          x: ps.map((p) => p.ajustado + (dispersion(p.i) / 0.17) * ancho), y: ps.map((p) => p.residuo),
          marker: { color: hexARgba(color(gi), 0.85), size: 8, line: { color: '#0a1011', width: 1 } },
          text: ps.map((p) => `<b>${nombres[gi]}</b><br>ajustado (media): ${num(p.ajustado, dec)}<br>residuo: ${conSigno(p.residuo, dec)}`), hovertemplate: '%{text}<extra></extra>',
        };
      });

      /* 4 · probabilidad normal de los residuos (posición de Blom) */
      const ordenados = [...puntos].sort((p, q) => p.residuo - q.residuo || p.g - q.g);
      const posiciones = ordenados.map((p, i) => ({ ...p, z: normalPpf((i + 1 - 0.375) / (N + 0.25)) }));
      const sRes = Math.sqrt(a.scDentro / (N - 1));
      const [rMin, rMax] = rango(puntos.map((p) => p.residuo));
      const margenR = (rMax - rMin) * 0.06 || sRes || 1;
      const trazasNormal = a.usados.map((g, gi) => {
        const ps = posiciones.filter((p) => p.g === gi);
        return {
          type: 'scatter', mode: 'markers', name: nombres[gi], showlegend: false, x: ps.map((p) => p.residuo), y: ps.map((p) => p.z),
          marker: { color: hexARgba(color(gi), 0.85), size: 8, line: { color: '#0a1011', width: 1 } },
          text: ps.map((p) => `<b>${nombres[gi]}</b><br>residuo: ${conSigno(p.residuo, dec)}<br>percentil normal esperado: ${num(100 * normalCdf(p.z), 1)} %`), hovertemplate: '%{text}<extra></extra>',
        };
      });

      const graficas = [
        {
          id: 'grupos', titulo: 'Datos de cada grupo, medias e intervalos', ancha: true,
          datos: [...trazasGrupos, trazaGlobal, trazaMedias],
          layout: {
            xaxis: { tickvals: a.usados.map((_, gi) => gi + 1), ticktext: a.usados.map((_, gi) => tickGrupo(gi)), range: [0.4, k + 0.6], zeroline: false, showgrid: false },
            yaxis: { title: { text: tituloY }, zeroline: false },
            margin: { l: 62, r: 18, t: 18, b: 56 },
          },
          respaldo: {
            columnas: ['Grupo', 'n', 'Media', 's', `${nivelIC}: inferior`, `${nivelIC}: superior`, 'Mínimo', 'Máximo'],
            filas: a.usados.map((g, gi) => [nombres[gi], String(g.n), num(g.media, dec), num(g.s, dec), num(g.ic[0], dec), num(g.ic[1], dec), num(Math.min(...g.datos), dec), num(Math.max(...g.datos), dec)]),
          },
        },
      ];
      if (sig && pares.length) {
        const etiquetas = pares.map((p) => envolver(`${nombres[p.i]} − ${nombres[p.j]}`, 26, 2));
        const mitad = (p) => (metodo === 'lsd' ? p.lsd : p.hsd);
        const serie = (nombre, col, filtro) => {
          const ps = pares.map((p, i) => ({ p, i })).filter(({ p }) => filtro(p));
          return {
            type: 'scatter', mode: 'markers', name: nombre, x: ps.map(({ p }) => p.dif), y: ps.map(({ i }) => etiquetas[i]),
            marker: { color: col, size: 10, line: { color: '#0a1011', width: 1 } },
            error_x: { type: 'data', array: ps.map(({ p }) => mitad(p)), visible: true, color: col, thickness: 2.2, width: 6 },
            text: ps.map(({ p }) => `<b>${nombres[p.i]} − ${nombres[p.j]}</b><br>diferencia: ${conSigno(p.dif, dec)}<br>${metodo === 'lsd' ? 'LSD' : 'HSD'}: ±${num(mitad(p), dec)}<br>intervalo: ${num(p.dif - mitad(p), dec)} a ${num(p.dif + mitad(p), dec)}`),
            hovertemplate: '%{text}<extra></extra>',
          };
        };
        const extremo = Math.max(...pares.map((p) => Math.abs(p.dif) + mitad(p)));
        graficas.push({
          id: 'pares', titulo: `Diferencias entre medias · ${metodo === 'lsd' ? `intervalos individuales de ${nivelTxt} % (LSD)` : `intervalos simultáneos de ${nivelTxt} % (Tukey–Kramer)`}`, ancha: true, alta: pares.length > 6,
          datos: [serie('Difiere (el intervalo no incluye el 0)', COLOR.coral, difiere), serie('No se distingue (el intervalo incluye el 0)', COLOR.gris, (p) => !difiere(p))],
          layout: {
            shapes: [lineaV(0, COLOR.blanco, { dash: 'solid', ancho: 1 })],
            xaxis: { title: { text: `Diferencia entre medias${u ? ` (${limpio(u)})` : ''}` }, range: [-extremo * 1.1, extremo * 1.1], zeroline: false },
            yaxis: { type: 'category', categoryorder: 'array', categoryarray: etiquetas, autorange: 'reversed', automargin: true, tickfont: { size: 11, color: COLOR.gris } },
            margin: { l: 56, r: 24, t: 18, b: 52 },
          },
          respaldo: {
            columnas: ['Comparación', 'Diferencia', `± ${metodo === 'lsd' ? 'LSD' : 'HSD'}`, 'Intervalo', 'Decisión'],
            filas: pares.map((p) => [`${nombres[p.i]} − ${nombres[p.j]}`, conSigno(p.dif, dec), num(mitad(p), dec), `${num(p.dif - mitad(p), dec)} a ${num(p.dif + mitad(p), dec)}`, difiere(p) ? 'Difiere' : 'No difiere']),
          },
        });
      }
      if (!a.sinVariacion) graficas.push(
        {
          id: 'residuos', titulo: 'Residuos contra valores ajustados',
          datos: trazasResiduos,
          layout: {
            shapes: [lineaH(0, COLOR.blanco, { dash: 'solid', ancho: 1 }), lineaH(dosS, COLOR.ambar, { dash: 'dot', ancho: 1.2 }), lineaH(-dosS, COLOR.ambar, { dash: 'dot', ancho: 1.2 })],
            annotations: [
              { x: 1, y: dosS, xref: 'paper', yref: 'y', text: '+2 s', showarrow: false, xanchor: 'right', yanchor: 'bottom', font: { color: COLOR.ambar, size: 10 } },
              { x: 1, y: -dosS, xref: 'paper', yref: 'y', text: '−2 s', showarrow: false, xanchor: 'right', yanchor: 'top', font: { color: COLOR.ambar, size: 10 } },
            ],
            xaxis: { title: { text: 'Valor ajustado (media del grupo)' }, zeroline: false },
            yaxis: { title: { text: 'Residuo (dato − media del grupo)' }, zeroline: false, range: [Math.min(rMin, -dosS) * 1.15, Math.max(rMax, dosS) * 1.15] },
            margin: { l: 62, r: 18, t: 18, b: 52 },
          },
          respaldo: {
            columnas: ['Grupo', 'Valor ajustado', 'Residuo mínimo', 'Residuo máximo', 's del grupo'],
            filas: a.usados.map((g, gi) => {
              const rs = puntos.filter((p) => p.g === gi).map((p) => p.residuo);
              return [nombres[gi], num(g.media, dec), conSigno(Math.min(...rs), dec), conSigno(Math.max(...rs), dec), num(g.s, dec)];
            }),
          },
        },
        {
          id: 'normal', titulo: 'Probabilidad normal de los residuos',
          datos: [
            { type: 'scatter', mode: 'lines', name: 'Normal esperada', x: [rMin - margenR, rMax + margenR], y: [(rMin - margenR) / sRes, (rMax + margenR) / sRes], line: { color: COLOR.gris, width: 1.5, dash: 'dot' }, hoverinfo: 'skip', showlegend: false },
            ...trazasNormal,
          ],
          layout: {
            xaxis: { title: { text: 'Residuo' }, zeroline: false, range: [rMin - margenR, rMax + margenR] },
            yaxis: { title: { text: 'Percentil normal esperado' }, tickvals: PERCENTILES.map((x) => x.z), ticktext: PERCENTILES.map((x) => `${x.p} %`), zeroline: false },
            margin: { l: 62, r: 18, t: 18, b: 52 },
          },
          respaldo: {
            columnas: ['#', 'Grupo', 'Residuo', 'Cuantil normal (z)'],
            filas: posiciones.filter((_, i) => posiciones.length <= 60 || i % Math.ceil(posiciones.length / 60) === 0).map((p, i) => [String(i + 1), nombres[p.g], conSigno(p.residuo, dec), num(p.z, 2)]),
          },
        },
      );

      /* ---- tablas ---- */
      const calc = (texto) => ({ texto, num: true, formula: true });
      const tablas = [
        {
          titulo: 'Tabla ANOVA',
          columnas: ['Fuente de variación', { t: 'SC', num: true }, { t: 'gl', num: true }, { t: 'CM', num: true }, { t: 'F', num: true }, { t: 'Valor p', num: true }],
          filas: [
            ['Entre grupos', calc(sc(a.scEntre)), calc(entero(a.glEntre)), calc(sc(a.cmEntre)), calc(num(a.F, 2)), calc(valorP(a.p))],
            ['Dentro de los grupos (error)', calc(sc(a.scDentro)), calc(entero(a.glDentro)), calc(sc(a.cmDentro)), { texto: '—', num: true }, { texto: '—', num: true }],
            ['Total', calc(sc(a.scTotal)), calc(entero(a.glTotal)), { texto: '—', num: true }, { texto: '—', num: true }, { texto: '—', num: true }],
          ],
          resaltar: [0],
          pie: `SC = suma de cuadrados · gl = grados de libertad (k − 1 = ${a.glEntre} y N − k = ${a.glDentro}) · CM = SC / gl · F = CM entre / CM dentro. F crítico con α = ${alfaTxt}: ${num(a.fCritico, 3)}; una F mayor que el crítico equivale a p < α. SC entre + SC dentro = SC total${a.sinVariacion ? '; sin variación dentro de los grupos no hay F' : ''}.`,
        },
        {
          titulo: 'Resumen por grupo',
          columnas: ['Grupo', { t: 'n', num: true }, { t: 'Media', num: true }, { t: 's', num: true }, { t: `${nivelIC} de la media`, num: true }],
          filas: a.usados.map((g, gi) => [nombres[gi], { texto: String(g.n), num: true }, calc(num(g.media, dec)), calc(num(g.s, dec)), calc(`${num(g.ic[0], dec)} a ${num(g.ic[1], dec)}`)]),
          pie: `Media global = ${num(a.mediaGlobal, dec)}${u ? ` ${limpio(u)}` : ''} · desviación estándar combinada = ${num(sCombinada, dec)} (raíz del CM dentro). Como en la plantilla, el intervalo de cada media usa el CM dentro de todos los grupos (t con ${a.glDentro} gl), no solo la s del grupo.`,
        },
        ...(a.sinVariacion ? [] : [{
          titulo: `Comparaciones por pares · ${nombreMetodo}`,
          columnas: ['Comparación', { t: 'Diferencia', num: true }, { t: `Umbral ${metodo === 'lsd' ? 'LSD' : 'HSD'}`, num: true }, { t: 'p Tukey', num: true }, { t: 'p LSD', num: true }, 'Decisión'],
          filas: pares.map((p) => [
            `${nombres[p.i]} − ${nombres[p.j]}`, calc(conSigno(p.dif, dec)), calc(num(metodo === 'lsd' ? p.lsd : p.hsd, dec)), calc(valorP(p.pTukey)), calc(valorP(p.pLsd)),
            { texto: sig ? (difiere(p) ? 'Difiere' : 'No difiere') : 'ANOVA n/s', formula: true },
          ]),
          resaltar: sig ? pares.map((p, i) => (difiere(p) ? i : -1)).filter((i) => i >= 0) : [],
          pie: `Diferencia = media del primer grupo − media del segundo. Se declara diferencia cuando |diferencia| supera el umbral (HSD de Tukey–Kramer o LSD de Fisher, con ${a.glDentro} gl del error, α = ${alfaTxt}). «p Tukey» es el valor p de Tukey–Kramer, ajustado por el número de comparaciones; «p LSD» no se ajusta, así que sale más pequeño.${sig ? '' : ' Como el ANOVA no es significativo, las comparaciones no se interpretan: la plantilla escribe «ANOVA n/s».'}`,
        }]),
      ];

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
