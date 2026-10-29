/**
 * LAB 17 · AMEF y RPN
 *
 * Guía: M6 §4 y Ejercicios 2 a 6 · plantilla Excel «AMEF».
 *   El AMEF (FMEA) califica cada modo de falla con tres escalas de 1 a 10: Severidad (gravedad del efecto más grave),
 *   Ocurrencia (probabilidad de que la falla suceda) y Detección (probabilidad de que los controles de hoy la detecten;
 *   escala invertida: 10 = prácticamente indetectable). RPN = S × O × D (de 1 a 1,000) ordena dónde actuar primero.
 *   El RPN es una referencia rápida con una debilidad conocida: una severidad alta se esconde tras una ocurrencia o una
 *   detección bajas (9 × 2 × 3 = 54), por eso S ≥ 9 exige revisión sin importar el RPN. El manual AIAG-VDA (2019) lo
 *   sustituyó por la Prioridad de Acción (AP); la guía la menciona sin dar su tabla, así que aquí no se calcula.
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Dos criterios de prioridad, porque la guía y la plantilla no coinciden:
 *   guía:      menos de 50 bajo · 50 a 100 revisar y priorizar · más de 100 acción requerida;
 *   plantilla: menos de 100 monitorear · 100 a 199 acción · 200 o más acción inmediata.
 * (Un RPN de exactamente 100 es «revisar» en la guía y «acción» en la plantilla.)
 *
 * Presets: los tres modos de falla de la guía (192 · 54 · 42), el ejemplo de empaque de los Ejercicios 2 y 3 (210 → 70)
 * y los tres de la plantilla (240 · 180 con S ≥ 9 · 120).
 */
import { mejoraAmef, prioridadAmef, resumenAmef } from '../js/lib/analizar.js';
import { envolver, lineaV } from '../js/lib/graficas.js';
import { COLOR } from '../js/core/config.js';
import { entero, num, plural } from '../js/core/format.js';

const MAX_MODOS = 20; // la plantilla evalúa hasta 20 filas
const COLOR_TIER = [COLOR.verde, COLOR.ambar, COLOR.coral];

/** Las tres clases de RPN de cada criterio, de la más baja (tier 0) a la más alta (tier 2). */
const NIVELES = {
  guia: [
    { nivel: 'bajo', rango: 'Menos de 50', leyenda: 'Bajo · menos de 50', etiqueta: 'Bajo: monitorear', texto: 'se monitorea en la siguiente revisión (guía M6 §4)' },
    { nivel: 'revisar', rango: '50 a 100', leyenda: 'Revisar y priorizar · 50 a 100', etiqueta: 'Revisar y priorizar', texto: 'se prioriza según los recursos disponibles (guía M6 §4)' },
    { nivel: 'accion', rango: 'Más de 100', leyenda: 'Acción requerida · más de 100', etiqueta: 'Acción requerida', texto: 'se actúa; si no se actúa de inmediato, se documenta la justificación (guía M6 §4)' },
  ],
  excel: [
    { nivel: 'bajo', rango: 'Menos de 100', leyenda: 'Monitorear · menos de 100', etiqueta: 'Monitorear', texto: 'se monitorea (hoja «AMEF»)' },
    { nivel: 'accion', rango: '100 a 199', leyenda: 'Acción · 100 a 199', etiqueta: 'Acción', texto: 'se actúa (hoja «AMEF»)' },
    { nivel: 'inmediata', rango: '200 o más', leyenda: 'Acción inmediata · 200 o más', etiqueta: 'Acción inmediata', texto: 'se actúa de inmediato (hoja «AMEF»)' },
  ],
};
const LINEAS = { guia: [50, 100], excel: [100, 200] };
const NOMBRE_CRITERIO = { guia: 'la guía', excel: 'la plantilla' };
const tierDe = (nivel, criterio) => Math.max(0, NIVELES[criterio].findIndex((n) => n.nivel === nivel));
const pideAccion = (nivel) => nivel === 'accion' || nivel === 'inmediata';

const SEVERIDAD_9 = 'revisión independiente obligatoria, sin importar el RPN: ningún umbral basado solo en S × O × D debería ser la última palabra (guía M6 §4; plantilla «AMEF»)';

const umbralDe = (criterio, { tierTop = -1, severos = 0 } = {}) => ({
  titulo: criterio === 'excel' ? 'Cómo leer el RPN (criterio de la plantilla)' : 'Cómo leer el RPN (criterio de la guía)',
  filas: [
    {
      rango: 'S, O y D',
      texto: 'cada una es un entero de 1 a 10 y RPN = S × O × D va de 1 a 1,000. La Detección va invertida: 1 = detección casi segura, 10 = prácticamente indetectable (guía M6 §4)',
    },
    ...NIVELES[criterio].map((n, i) => ({ rango: n.rango, texto: `RPN ${n.etiqueta.toLowerCase()}: ${n.texto}`, activa: i === tierTop })),
    { rango: 'S ≥ 9, cualquier RPN', texto: SEVERIDAD_9, activa: severos > 0 },
    {
      rango: 'Prioridad de Acción (AP)',
      texto: 'el manual AIAG-VDA (2019) sustituyó los umbrales fijos de RPN por esta tabla, que hace dominar a la Severidad. La guía la menciona pero no incluye la tabla, y este laboratorio no la calcula',
    },
  ],
});

const SUPUESTO = {
  titulo: 'Supuesto del método',
  texto:
    'Las calificaciones son un juicio del equipo cross-funcional con anclas comunes (las escalas de la guía), no mediciones: el RPN solo sirve para comparar modos de falla de un mismo AMEF calificados con las mismas escalas. ' +
    'Es un producto de escalas ordinales: no es una probabilidad ni un costo, y combinaciones distintas dan el mismo número (72 = 9 × 2 × 4 = 3 × 4 × 6). ' +
    'Su debilidad conocida es que una Severidad alta puede esconderse tras una Ocurrencia o Detección bajas; por eso S ≥ 9 se revisa siempre. Por convención, la Severidad se califica sobre el efecto más grave, no sobre el modo de falla.',
};

const ANCLAS_S = 'Severidad (S): 10 riesgo de seguridad sin aviso · 9 riesgo de seguridad con aviso · 7–8 pierde la función primaria · 5–6 función degradada · 3–4 molestia menor · 2 solo la notan clientes muy exigentes · 1 sin efecto.';
const ANCLAS_O = 'Ocurrencia (O): 9–10 casi inevitable · 7–8 frecuente, con historial repetido · 5–6 ocasional · 3–4 poco frecuente · 2 rara · 1 prevenida por el propio diseño del proceso (poka-yoke).';
const ANCLAS_D = 'Detección (D), escala invertida: 1 casi segura (poka-yoke) · 2–3 alta, verificación automática al 100 % · 4–6 moderada, inspección manual o muestreo · 7–8 baja, controles indirectos · 9–10 improbable o inexistente.';

const aFila = (f) => ({ paso: f.paso ?? '', modo: f.modo ?? '', efecto: f.efecto ?? '', causa: f.causa ?? '', s: f.s ?? NaN, o: f.o ?? NaN, d: f.d ?? NaN });
const SIN_MEJORA = { mejoraFila: '', sNueva: NaN, oNueva: NaN, dNueva: NaN };

const cambioPct = (antes, despues) => {
  const c = despues / antes - 1;
  return `${c > 0 ? '+' : c < 0 ? '−' : ''}${num(Math.abs(c) * 100, 0)} %`;
};
const nombreDe = (f) => f.modo || f.paso || `fila ${f.indice + 1}`;
/** «Revisión independiente (S ≥ 9)» → «revisión independiente (S ≥ 9)»: solo baja la primera letra (no la S de la severidad). */
const minuscula = (t) => (t ? t[0].toLowerCase() + t.slice(1) : t);
const limpio = (t) => String(t ?? '').replace(/[<>]/g, '');
const listaCitada = (nombres, max = 3) => {
  const citados = nombres.slice(0, max).map((n) => `«${n}»`);
  if (nombres.length > max) citados.push(`${nombres.length - max} más`);
  return citados.length > 1 ? `${citados.slice(0, -1).join(', ')} y ${citados[citados.length - 1]}` : citados[0] ?? '';
};

export default function lab17(ctx = {}) {
  const caso = ctx.caso?.amef;
  const guia = caso?.guia?.filas?.length ? caso.guia.filas.map(aFila) : [];
  const empaque = caso?.empaque?.filas?.length ? caso.empaque : null;
  const excel = caso?.excel?.filas?.length ? caso.excel.filas.map(aFila) : null;

  const presets = [
    {
      id: 'guia', etiqueta: 'Guía M6 §4: tres modos de la línea de arneses (192 · 54 · 42)',
      ayuda: 'Los tres modos de la guía. El etiquetado fue la segunda categoría más frecuente del Pareto (LAB 15), pero con S=3 y D=2 queda con el RPN más bajo; la falla de continuidad (192) concentra el riesgo. El conector mal asentado tiene RPN 54 y, aun así, S=9 exige revisión independiente.',
      valores: { criterio: 'guia', modos: guia, ...SIN_MEJORA },
    },
    ...(empaque
      ? [{
        id: 'empaque', etiqueta: 'Guía Ej. 2 y 3: sellado de bolsas (210 → 70)',
        ayuda: 'Ejercicio 2: sellado incompleto de bolsa, 7 × 5 × 6 = 210. El simulador ya trae la mejora del Ejercicio 3 (un sensor que verifica el 100 % de las bolsas: Detección de 6 a 2): el RPN cae a 70, pero la Ocurrencia sigue en 5, es decir, la falla ocurre con la misma frecuencia.',
        valores: {
          criterio: 'guia', modos: empaque.filas.map(aFila), mejoraFila: '1', sNueva: NaN, oNueva: NaN, dNueva: empaque.dNueva ?? 2,
        },
      }]
      : []),
    ...(excel
      ? [{
        id: 'excel', etiqueta: 'Plantilla Excel «AMEF»: atornillado, crimpado y etiquetado',
        ayuda: 'Los tres ejemplos de la hoja «AMEF», con su criterio: 100 es acción y 200 acción inmediata. El crimpado (9 × 4 × 5 = 180) sería solo «Acción» por RPN, pero S=9 lo manda a revisión obligatoria.',
        valores: { criterio: 'excel', modos: excel, ...SIN_MEJORA },
      }]
      : []),
  ];

  const opcionesFila = [{ valor: '', texto: '(ninguna)' }, ...Array.from({ length: MAX_MODOS }, (_, i) => ({ valor: String(i + 1), texto: `Fila ${i + 1}` }))];

  return {
    id: 'lab17',
    numero: '17',
    modulo: 'M6',
    titulo: 'AMEF y RPN',
    resumen: 'Califica cada modo de falla con Severidad, Ocurrencia y Detección, calcula el RPN, ordénalos por riesgo y comprueba qué cambia si mejoras una calificación, sin perder de vista que S ≥ 9 se revisa siempre.',
    panelAncho: true,
    entradas: [
      {
        id: 'criterio', tipo: 'opcion', etiqueta: 'Criterio de prioridad del RPN', valor: 'guia',
        opciones: [
          { valor: 'guia', texto: 'Guía M6 §4: menos de 50 · 50 a 100 · más de 100' },
          { valor: 'excel', texto: 'Plantilla Excel: menos de 100 · 100 a 199 · 200 o más' },
        ],
        ayuda: 'La guía y la plantilla usan umbrales distintos; un RPN de 100 es «revisar» en una y «acción» en la otra. En ambas, S ≥ 9 exige revisión.',
      },
      {
        id: 'modos', tipo: 'tabla', etiqueta: 'Modos de falla y sus calificaciones',
        columnas: [
          { id: 'paso', etiqueta: 'Paso / función', tipo: 'texto', ancho: '88px', ayuda: 'Paso o función del proceso donde puede fallar.' },
          { id: 'modo', etiqueta: 'Modo de falla', tipo: 'texto', ancho: '128px', ayuda: 'CÓMO falla el proceso o la pieza (p. ej. «fuerza de engarzado insuficiente»). No lo confundas con el efecto.' },
          { id: 'efecto', etiqueta: 'Efecto', tipo: 'texto', ancho: '112px', ayuda: 'QUÉ le pasa al cliente o al siguiente proceso (p. ej. «falla de continuidad eléctrica»).' },
          { id: 'causa', etiqueta: 'Causa', tipo: 'texto', ancho: '100px', ayuda: 'Por qué ocurre el modo de falla (viene del Ishikawa y los 5 Porqués del LAB 16). Opcional.' },
          { id: 's', etiqueta: 'S', tipo: 'numero', min: 1, max: 10, ancho: '38px', ayuda: 'Severidad, de 1 a 10: gravedad del efecto más grave (10 = riesgo de seguridad sin aviso previo).' },
          { id: 'o', etiqueta: 'O', tipo: 'numero', min: 1, max: 10, ancho: '38px', ayuda: 'Ocurrencia, de 1 a 10: qué tan probable es que la falla suceda (10 = casi inevitable).' },
          { id: 'd', etiqueta: 'D', tipo: 'numero', min: 1, max: 10, ancho: '38px', ayuda: 'Detección, de 1 a 10, escala invertida: 1 = detección casi segura, 10 = prácticamente indetectable con los controles de hoy.' },
        ],
        filas: guia, filaNueva: { paso: '', modo: '', efecto: '', causa: '', s: NaN, o: NaN, d: NaN }, minFilas: 1, maxFilas: MAX_MODOS, filasVacias: 5, etiquetaAgregar: '+ Modo de falla',
        ayuda: `Hasta ${MAX_MODOS} modos (como la plantilla). Cada calificación es un entero de 1 a 10; una fila sin las tres no tiene RPN.`,
      },
      { tipo: 'nota', texto: ANCLAS_S },
      { tipo: 'nota', texto: ANCLAS_O },
      { tipo: 'nota', texto: ANCLAS_D },
      { tipo: 'seccion', etiqueta: '¿Y si mejoramos? · simulador (opcional)' },
      {
        id: 'mejoraFila', tipo: 'opcion', etiqueta: 'Modo que se mejora', valor: '', opciones: opcionesFila,
        ayuda: 'El número de fila de la tabla de arriba. Escribe abajo solo las calificaciones que cambiarían; las demás quedan igual.',
      },
      { id: 'sNueva', tipo: 'numero', etiqueta: 'Severidad nueva (S)', valor: NaN, min: 1, max: 10, marcador: 'sin cambio', ayuda: 'Cambia solo si se modifica el efecto (rediseño), no si solo se controla.' },
      { id: 'oNueva', tipo: 'numero', etiqueta: 'Ocurrencia nueva (O)', valor: NaN, min: 1, max: 10, marcador: 'sin cambio', ayuda: 'Baja si se ataca la causa: prevención, poka-yoke, mantenimiento.' },
      { id: 'dNueva', tipo: 'numero', etiqueta: 'Detección nueva (D)', valor: NaN, min: 1, max: 10, marcador: 'sin cambio', ayuda: 'Baja si se detecta mejor (p. ej. una verificación automática al 100 %), pero la falla sigue ocurriendo con la misma frecuencia.' },
    ],
    presets,
    umbral: umbralDe('guia'),
    supuesto: SUPUESTO,
    preguntas: [
      'Si solo pudieras atacar un modo de falla, ¿cuál elegirías por RPN? ¿Y por severidad? ¿Coinciden? ¿Qué haces con los modos de S ≥ 9 aunque su RPN sea bajo?',
      'Compara el modo más frecuente (la O más alta) con el de mayor RPN. ¿Qué te dice la diferencia sobre el Pareto (LAB 15) y el AMEF como herramientas de priorización?',
      'Para «Conector mal asentado» (S=9, O=2, D=3), prueba en el simulador una prueba de fuerza automatizada al 100 % de las unidades (D de 3 a 1). ¿Cuál es el nuevo RPN? ¿Debería el equipo invertir ahí antes que en la falla de continuidad eléctrica?',
      'En el simulador, baja solo la Detección de un modo. ¿Qué cambió en el proceso real? ¿La falla ocurre con menos frecuencia o solo se detecta mejor? ¿Qué calificación bajarías, si pudieras, para atacar la causa?',
      'Un compañero califica la Severidad sobre el modo de falla («fuerza de engarzado insuficiente») y otro sobre el efecto («falla de continuidad eléctrica»). ¿Quién tiene razón y por qué puede cambiar el RPN?',
    ],

    calcular(e) {
      const aviso = [];
      const criterio = e.criterio === 'excel' ? 'excel' : 'guia';
      const niveles = NIVELES[criterio];
      const r = resumenAmef(e.modos, { criterio });
      if (r.incompletas) aviso.push(`Filas con texto pero sin las tres calificaciones (no tienen RPN): ${entero(r.incompletas)}. Escribe S, O y D (enteros de 1 a 10) o quita la fila.`);
      if (r.invalidas) aviso.push(`Filas con calificaciones que no son enteros de 1 a 10 (se ignoraron): ${entero(r.invalidas)}.`);

      if (!r.valido) {
        return {
          aviso,
          umbral: umbralDe(criterio),
          vacio: 'Captura al menos un modo de falla con sus tres calificaciones (S, O y D, enteros de 1 a 10) para ver el RPN, el ranking y la prioridad.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: aviso.length ? 'Revisa el aviso sobre la captura.' : 'Sin modos de falla calificados.' }],
        };
      }

      const n = r.filas.length;
      const top = r.ranking[0];
      const tierTop = tierDe(top.porRpn.nivel, criterio);
      const severos = r.ranking.filter((f) => f.severa);
      const nAccion = r.porRpn.accion + r.porRpn.inmediata;

      /* ---- simulador «¿y si mejoramos?» ---- */
      const filaMejora = Number.parseInt(e.mejoraFila, 10);
      const hayNuevas = [e.sNueva, e.oNueva, e.dNueva].some(Number.isFinite);
      const objetivo = Number.isFinite(filaMejora) ? r.filas.find((f) => f.indice === filaMejora - 1) : null;
      let sim = null;
      if (Number.isFinite(filaMejora) && !objetivo) {
        aviso.push(`La fila ${entero(filaMejora)} no tiene S, O y D válidos (o no existe): el simulador necesita un modo ya calificado.`);
      } else if (!Number.isFinite(filaMejora) && hayNuevas) {
        aviso.push('Elige el modo que se mejora (número de fila) para ver el RPN con las calificaciones nuevas.');
      } else if (objetivo) {
        const m = mejoraAmef({ s: objetivo.s, o: objetivo.o, d: objetivo.d }, { s: e.sNueva, o: e.oNueva, d: e.dNueva });
        if (!m.valido) aviso.push('Las calificaciones nuevas deben ser enteros de 1 a 10.');
        else sim = { objetivo, ...m, prioridad: prioridadAmef(m.nuevo.s, m.despues, criterio) };
      }

      /* ---- salidas ---- */
      const salidas = [
        { id: 'evaluados', etiqueta: 'Modos evaluados', valor: entero(n), color: 'teal', nota: r.incompletas + r.invalidas ? `${entero(r.incompletas + r.invalidas)} sin RPN (ver el aviso)` : 'con S, O y D completos' },
        { id: 'rpnMax', etiqueta: 'RPN máximo', valor: entero(r.rpnMax), color: ['verde', 'ambar', 'coral'][tierTop], nota: `${top.s} × ${top.o} × ${top.d} · «${nombreDe(top)}»` },
        criterio === 'guia'
          ? { id: 'acciones', etiqueta: 'Piden acción (RPN > 100)', valor: `${entero(nAccion)} de ${entero(n)}`, color: 'azul', nota: `${plural(r.porRpn.revisar, 'modo')} por revisar (RPN de 50 a 100)` }
          : { id: 'acciones', etiqueta: 'Piden acción (RPN ≥ 100)', valor: `${entero(nAccion)} de ${entero(n)}`, color: 'azul', nota: `${entero(r.porRpn.inmediata)} de acción inmediata (RPN ≥ 200)` },
        { id: 'severos', etiqueta: 'Severidad ≥ 9', valor: entero(r.nSeveridad), color: r.nSeveridad ? 'coral' : undefined, nota: r.nSeveridad ? 'revisión obligatoria, cualquiera que sea su RPN' : 'ninguno activa la regla de revisión' },
      ];
      if (sim) {
        salidas.push({
          id: 'mejora', etiqueta: 'RPN con la mejora', valor: `${entero(sim.antes)} → ${entero(sim.despues)}`, color: sim.despues < sim.antes ? 'verde' : 'ambar',
          nota: `${cambioPct(sim.antes, sim.despues)} · «${nombreDe(sim.objetivo)}»`,
        });
      }

      /* ---- semáforos ---- */
      const semaforos = [];
      const detalleTop = `${entero(top.rpn)} = ${top.s} × ${top.o} × ${top.d}`;
      if (tierTop === 2) {
        semaforos.push({ nombre: 'Prioridad por RPN', estado: 'critico', texto: `«${nombreDe(top)}» tiene el mayor RPN (${detalleTop}): ${minuscula(niveles[2].etiqueta)} según ${NOMBRE_CRITERIO[criterio]}. Ahí conviene concentrar la mejora, tras confirmar las calificaciones con el equipo.` });
      } else if (tierTop === 1) {
        semaforos.push({ nombre: 'Prioridad por RPN', estado: 'atencion', texto: `El mayor RPN es ${detalleTop} («${nombreDe(top)}»): ${minuscula(niveles[1].etiqueta)} según ${NOMBRE_CRITERIO[criterio]}. Prioriza según los recursos disponibles.` });
      } else {
        semaforos.push({ nombre: 'Prioridad por RPN', estado: 'cumple', texto: `Todos los RPN quedan por debajo del umbral de revisión; el mayor es ${detalleTop} («${nombreDe(top)}»). ${niveles[0].etiqueta} en la siguiente revisión.` });
      }

      if (severos.length) {
        const ocultos = severos.filter((f) => !pideAccion(f.porRpn.nivel));
        const lista = severos.slice(0, 3).map((f) => `«${nombreDe(f)}» (S=${f.s}, RPN ${entero(f.rpn)})`);
        if (severos.length > 3) lista.push(`${severos.length - 3} más`);
        semaforos.push({
          nombre: 'Severidad ≥ 9', estado: 'critico',
          texto: `${plural(severos.length, 'modo tiene', 'modos tienen')} severidad de 9 o 10: ${lista.join(', ')}. Revisión independiente obligatoria, sin importar el RPN${ocultos.length ? `; por RPN solo, ${ocultos.length === 1 ? 'ese modo' : 'esos modos'} no ${ocultos.length === 1 ? 'pediría' : 'pedirían'} acción: la severidad se esconde detrás del producto` : ''}.`,
        });
      } else {
        semaforos.push({ nombre: 'Severidad ≥ 9', estado: 'cumple', texto: 'Ningún modo tiene severidad de 9 o 10: la regla de revisión obligatoria no se activa.' });
      }

      const masFrecuente = r.filas.reduce((a, f) => (f.o > a.o ? f : a), r.filas[0]);
      if (n >= 2 && masFrecuente.indice !== top.indice && masFrecuente.o > top.o) {
        semaforos.push({
          nombre: 'Frecuencia y riesgo', estado: 'informativo',
          texto: `El modo más frecuente («${nombreDe(masFrecuente)}», O=${masFrecuente.o}) no es el de mayor RPN («${nombreDe(top)}», ${entero(top.rpn)}): frecuencia (Pareto) y riesgo (RPN) son preguntas distintas. Un modo muy frecuente pero de bajo impacto o fácil de detectar puede quedar con menor prioridad.`,
        });
      }

      const empates = [...new Set(r.ranking.map((f) => f.rpn))].find((v) => r.ranking.filter((f) => f.rpn === v).length > 1);
      if (empates !== undefined) {
        const grupo = r.ranking.filter((f) => f.rpn === empates);
        semaforos.push({
          nombre: 'RPN empatados', estado: 'informativo',
          texto: `${plural(grupo.length, 'modo comparte', 'modos comparten')} el RPN ${entero(empates)} (${grupo.map((f) => `${f.s}·${f.o}·${f.d}`).join(' y ')}): el producto no distingue combinaciones distintas de S, O y D. Desempata por severidad y revisa las tres calificaciones, no solo el producto (referencia didáctica).`,
        });
      }

      const repetidos = r.filas.filter((f) => f.modo && f.efecto && f.modo.trim().toLowerCase() === f.efecto.trim().toLowerCase());
      if (repetidos.length) {
        semaforos.push({
          nombre: 'Modo de falla y efecto', estado: 'atencion',
          texto: `${plural(repetidos.length, 'fila repite', 'filas repiten')} el mismo texto en el modo y en el efecto (${listaCitada(repetidos.map((f) => f.modo))}). El modo es CÓMO falla el proceso; el efecto, QUÉ le pasa al cliente: calificar la Severidad sobre la columna equivocada distorsiona el RPN (guía M6 §4).`,
        });
      }

      if (sim) {
        const textoCambios = sim.cambios.map((c) => `${c.factor} de ${c.de} a ${c.a}`).join(' y ');
        const soloD = sim.cambios.length === 1 && sim.cambios[0].factor === 'D';
        if (!sim.huboCambio) {
          semaforos.push({ nombre: 'Mejora simulada', estado: 'informativo', texto: `«${nombreDe(sim.objetivo)}» tiene RPN ${entero(sim.antes)}. Escribe una calificación nueva (S, O o D) para ver qué pasa si mejoras.` });
        } else if (sim.despues === sim.antes) {
          semaforos.push({ nombre: 'Mejora simulada', estado: 'informativo', texto: `Las calificaciones nuevas dan el mismo RPN (${entero(sim.antes)}): no hay mejora que medir.` });
        } else {
          const base = `Con ${textoCambios}, el RPN de «${nombreDe(sim.objetivo)}» pasa de ${entero(sim.antes)} a ${entero(sim.despues)} (${cambioPct(sim.antes, sim.despues)}): ${minuscula(sim.prioridad.etiqueta)}.`;
          if (sim.despues > sim.antes) {
            semaforos.push({ nombre: 'Mejora simulada', estado: 'atencion', texto: `${base} El RPN sube: ¿la calificación nueva es la que querías?` });
          } else if (sim.nuevo.s >= 9) {
            semaforos.push({ nombre: 'Mejora simulada', estado: 'atencion', texto: `${base} La severidad sigue en ${sim.nuevo.s}: el modo continúa en revisión obligatoria aunque el RPN baje.` });
          } else if (soloD) {
            semaforos.push({
              nombre: 'Mejora simulada', estado: 'informativo',
              texto: `${base} Mejorar solo la Detección reduce el riesgo de que el defecto llegue al cliente, pero no la frecuencia con que ocurre: si es posible, ataca también la Ocurrencia (guía M6 Ej. 3).`,
            });
          } else {
            semaforos.push({ nombre: 'Mejora simulada', estado: 'cumple', texto: base });
          }
        }
      }

      const umbral = umbralDe(criterio, { tierTop, severos: severos.length });
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Antes de invertir, verifica con datos las causas de los modos de mayor prioridad (Pareto, LAB 15; ANOVA, LAB 18; regresión, LAB 19) y confirma las calificaciones con el equipo.' };

      /* ---- gráficas ---- */
      const filas = r.ranking;
      const hoverDe = (f) => [
        `<b>${limpio(nombreDe(f))}</b>`,
        f.paso ? `Paso: ${limpio(f.paso)}` : null,
        f.efecto ? `Efecto: ${limpio(f.efecto)}` : null,
        f.causa ? `Causa: ${limpio(f.causa)}` : null,
        `S=${f.s} · O=${f.o} · D=${f.d} → RPN ${f.rpn}`,
        limpio(f.severa ? `${f.etiqueta} (por RPN: ${f.porRpn.etiqueta})` : f.etiqueta),
      ].filter(Boolean).join('<br>');
      // Elementos del ranking, en orden; con el simulador, la barra «con la mejora» va justo debajo del modo que se mejora.
      const elementos = [];
      filas.forEach((f, i) => {
        elementos.push({ mejora: false, f, tier: tierDe(f.porRpn.nivel, criterio), etiqueta: envolver(limpio(`${i + 1}. ${nombreDe(f)}`), 26, 2), hover: hoverDe(f) });
        if (sim && f.indice === sim.objetivo.indice) {
          const cambios = sim.cambios.map((c) => `${c.factor} de ${c.de} a ${c.a}`).join(' y ');
          elementos.push({
            mejora: true, rpn: sim.despues, etiqueta: envolver(`↳ con la mejora (${sim.cambios.map((c) => `${c.factor} ${c.de}→${c.a}`).join(', ')})`, 26, 2),
            hover: `<b>Con la mejora (simulada)</b><br>${limpio(cambios)}<br>S=${sim.nuevo.s} · O=${sim.nuevo.o} · D=${sim.nuevo.d} → RPN ${sim.despues} (${cambioPct(sim.antes, sim.despues)})`,
          });
        }
      });
      const etiquetas = elementos.map((el) => el.etiqueta);
      const hover = elementos.map((el) => el.hover);
      const barras = niveles.map((nv, t) => ({
        type: 'bar', orientation: 'h', name: nv.leyenda, y: etiquetas, x: elementos.map((el) => (!el.mejora && el.tier === t ? el.f.rpn : null)),
        marker: { color: COLOR_TIER[t], line: { width: 0 } },
        text: elementos.map((el) => (!el.mejora && el.tier === t && !el.f.severa ? entero(el.f.rpn) : '')), textposition: 'outside', textfont: { color: COLOR.blanco, size: 11 }, cliponaxis: false,
        customdata: hover, hovertemplate: '%{customdata}<extra></extra>',
      }));
      const datosRpn = [...barras];
      if (sim) {
        datosRpn.push({
          type: 'bar', orientation: 'h', name: 'Con la mejora (simulada)', y: etiquetas, x: elementos.map((el) => (el.mejora ? el.rpn : null)),
          marker: { color: 'rgba(255,255,255,0.16)', line: { color: COLOR.blanco, width: 1.6 } },
          text: elementos.map((el) => (el.mejora ? entero(el.rpn) : '')), textposition: 'outside', textfont: { color: COLOR.blanco, size: 11 }, cliponaxis: false,
          customdata: hover, hovertemplate: '%{customdata}<extra></extra>',
        });
      }
      const marcas = elementos.map((el, i) => (!el.mejora && el.f.severa ? i : -1)).filter((i) => i >= 0);
      if (marcas.length) {
        datosRpn.push({
          type: 'scatter', mode: 'markers+text', name: 'Severidad ≥ 9 (revisión obligatoria)', y: marcas.map((i) => etiquetas[i]), x: marcas.map((i) => elementos[i].f.rpn),
          text: marcas.map((i) => `${entero(elementos[i].f.rpn)} · S ≥ 9`), textposition: 'middle right', textfont: { color: COLOR.blanco, size: 11 }, cliponaxis: false,
          marker: { symbol: 'diamond', size: 11, color: COLOR.blanco, line: { color: '#0a1011', width: 1 } },
          customdata: marcas.map((i) => hover[i]), hovertemplate: '%{customdata}<extra></extra>',
        });
      }
      const [l1, l2] = LINEAS[criterio];
      const xMax = Math.max(r.rpnMax * 1.22, l2 * 1.3);
      const serie = (nombre, clave, color) => ({
        type: 'bar', name: nombre, x: filas.map((f, i) => envolver(limpio(`${i + 1}. ${nombreDe(f)}`), 14, 3)), y: filas.map((f) => f[clave]),
        marker: { color, line: { width: 0 } }, text: filas.map((f) => String(f[clave])), textposition: 'outside', textfont: { color: COLOR.blanco, size: 11 }, cliponaxis: false,
        hovertemplate: `%{x}<br>${nombre}: %{y}<extra></extra>`,
      });
      const graficas = [
        {
          id: 'rpn', titulo: 'RPN por modo de falla (de mayor a menor)', ancha: true, alta: elementos.length > 6,
          datos: datosRpn,
          layout: {
            barmode: 'overlay', bargap: elementos.length <= 2 ? 0.55 : 0.32,
            shapes: [lineaV(l1, COLOR.ambar), lineaV(l2, COLOR.coral)],
            xaxis: { title: { text: 'RPN = S × O × D' }, range: [0, xMax], rangemode: 'tozero', zeroline: false },
            yaxis: { type: 'category', autorange: 'reversed', automargin: true, tickfont: { size: 11, color: COLOR.gris } },
            margin: { l: 56, r: 40, t: 18, b: 48 },
          },
          respaldo: {
            columnas: ['#', 'Modo de falla', 'S', 'O', 'D', 'RPN', 'Prioridad'],
            filas: elementos.map((el, i) => (el.mejora
              ? ['', `con la mejora: ${sim.cambios.map((c) => `${c.factor} de ${c.de} a ${c.a}`).join(' y ')}`, String(sim.nuevo.s), String(sim.nuevo.o), String(sim.nuevo.d), entero(sim.despues), sim.prioridad.severa ? `${sim.prioridad.etiqueta} (por RPN: ${sim.prioridad.porRpn.etiqueta})` : sim.prioridad.etiqueta]
              : [String(elementos.slice(0, i + 1).filter((x) => !x.mejora).length), nombreDe(el.f), String(el.f.s), String(el.f.o), String(el.f.d), entero(el.f.rpn), el.f.severa ? `${el.f.etiqueta} (por RPN: ${el.f.porRpn.etiqueta})` : el.f.etiqueta])),
          },
        },
        {
          id: 'perfil', titulo: 'Perfil de cada modo: Severidad, Ocurrencia y Detección', ancha: true,
          datos: [serie('Severidad (S)', 's', COLOR.coral), serie('Ocurrencia (O)', 'o', COLOR.ambar), serie('Detección (D)', 'd', COLOR.azul)],
          layout: {
            barmode: 'group', bargap: 0.28, bargroupgap: 0.06,
            xaxis: { type: 'category', tickfont: { size: 10, color: COLOR.gris } },
            yaxis: { title: { text: 'Calificación (1 a 10)' }, range: [0, 11.6], tickvals: [0, 2, 4, 6, 8, 10], zeroline: false },
            margin: { l: 56, r: 18, t: 18, b: 70 },
          },
          respaldo: { columnas: ['#', 'Modo de falla', 'S', 'O', 'D', 'RPN'], filas: filas.map((f, i) => [String(i + 1), nombreDe(f), String(f.s), String(f.o), String(f.d), entero(f.rpn)]) },
        },
      ];

      /* ---- tablas ---- */
      const calc = (texto) => ({ texto, num: true, formula: true });
      const tablas = [
        {
          titulo: 'El AMEF ordenado por RPN',
          columnas: [{ t: '#', num: true }, 'Paso', 'Modo de falla', 'Efecto', { t: 'S', num: true }, { t: 'O', num: true }, { t: 'D', num: true }, { t: 'RPN', num: true }, 'Prioridad'],
          filas: filas.map((f, i) => [
            { texto: String(i + 1), num: true }, f.paso || '—', f.modo || '—', f.efecto || '—', { texto: String(f.s), num: true }, { texto: String(f.o), num: true }, { texto: String(f.d), num: true },
            calc(entero(f.rpn)), { texto: f.severa ? `${f.etiqueta} · por RPN: ${f.porRpn.etiqueta}` : f.etiqueta, formula: true },
          ]),
          resaltar: [0],
          pie: `RPN = S × O × D. Se ordena de mayor a menor (los empates, en el orden en que los capturaste). La prioridad usa el criterio de ${NOMBRE_CRITERIO[criterio]}; si S ≥ 9, manda la revisión obligatoria y se muestra también lo que diría el RPN solo. Resaltada: la fila de mayor RPN.`,
        },
      ];
      if (sim) {
        const prioridadAntes = sim.objetivo.severa ? sim.objetivo.etiqueta : sim.objetivo.porRpn.etiqueta;
        tablas.push({
          titulo: `¿Y si mejoramos? Fila ${entero(filaMejora)}: «${nombreDe(sim.objetivo)}»`,
          columnas: ['', { t: 'S', num: true }, { t: 'O', num: true }, { t: 'D', num: true }, { t: 'RPN', num: true }, 'Prioridad'],
          filas: [
            ['Ahora', { texto: String(sim.objetivo.s), num: true }, { texto: String(sim.objetivo.o), num: true }, { texto: String(sim.objetivo.d), num: true }, calc(entero(sim.antes)), { texto: prioridadAntes, formula: true }],
            ['Con la mejora', { texto: String(sim.nuevo.s), num: true }, { texto: String(sim.nuevo.o), num: true }, { texto: String(sim.nuevo.d), num: true }, calc(entero(sim.despues)), { texto: sim.prioridad.severa ? sim.prioridad.etiqueta : sim.prioridad.porRpn.etiqueta, formula: true }],
          ],
          resaltar: [1],
          pie: `Cambio del RPN: ${cambioPct(sim.antes, sim.despues)}. Una reducción por Detección no toca la frecuencia con que ocurre la falla; una por Ocurrencia sí. La Severidad solo baja si cambia el efecto.`,
        });
      }

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
