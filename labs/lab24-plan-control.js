/**
 * LAB 24 · Plan de control
 *
 * Guía: M10 §4 y §5 · plantilla Excel «Plan de Control» (formato inspirado en el plan de control de AIAG, Core Tools).
 *   Un plan de control es el documento vivo que convierte el proyecto en una rutina sostenible: qué se mide, cómo, con qué
 *   frecuencia, quién responde y qué hacer exactamente si el proceso se sale de control. Este laboratorio lo revisa línea por
 *   línea, como la plantilla:
 *     · «Incompleto: falta …» si una línea no tiene los ocho campos (característica, especificación, medición, muestra,
 *       frecuencia, método de control, reacción y responsable);
 *     · «Revisar clasificación (RPN alto)» si el modo de falla del AMEF al que apunta tiene RPN ≥ 100 y la línea no es Crítica
 *       ni Significativa;
 *     · «Completo» en los demás casos.
 *   Además cruza el plan con el AMEF (LAB 17): ningún modo importante (RPN alto o severidad ≥ 9) debería quedar sin una
 *   línea que lo prevenga o lo detecte, y marca los planes de reacción que se quedan en «desechar la pieza y seguir
 *   produciendo» (la advertencia de la guía §4: el plan de reacción debe apuntar a la causa, no solo al síntoma).
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: el plan de la guía M10 §4 (cuatro líneas), el de la plantilla (cinco líneas; 4 completas = 80 %), y el de la guía con
 * una reacción de «corregir y olvidar». La guía junta método y frecuencia en una columna; aquí se separaron sin cambiar su
 * contenido. Tampoco clasifica las características ni las liga al AMEF: esas dos columnas quedan para que las llenes tú
 * (la del AMEF, salvo en la guía, donde se ligaron a su modo de falla evidente).
 */
import { CLASIFICACIONES, RPN_ALTO, TIPOS_CARACTERISTICA, modosAmef, normalizarNombre, resumenPlan } from '../js/lib/controlar.js';
import { envolver, lineaV } from '../js/lib/graficas.js';
import { COLOR } from '../js/core/config.js';
import { entero, pct, plural } from '../js/core/format.js';

const MAX_MODOS = 20;
const MAX_LINEAS = 20; // la plantilla tiene 20 filas

const limpio = (t) => String(t ?? '').replace(/[<>]/g, '');
const nombreDe = (f) => (f.caracteristica ? `«${f.caracteristica}»` : `la fila ${f.indice}`);
const listaCitada = (nombres, max = 3) => {
  const citados = nombres.slice(0, max);
  if (nombres.length > max) citados.push(`${nombres.length - max} más`);
  return citados.length > 1 ? `${citados.slice(0, -1).join(', ')} y ${citados[citados.length - 1]}` : citados[0] ?? '';
};

const linea = (c) => ({
  op: '', caracteristica: '', tipo: '', clasificacion: '', especificacion: '', medicion: '', muestra: '', frecuencia: '', metodo: '', reaccion: '', responsable: '', ref: '', ...c,
});

const MODO_FUERZA = 'Fuerza de engarzado insuficiente';
const PLAN_GUIA = [
  linea({
    caracteristica: 'Fuerza de engarzado (poka-yoke)', especificacion: '≥ 173 N', medicion: 'Sensor de fuerza', muestra: '100 %', frecuencia: 'Cada ciclo', metodo: 'Poka-yoke (sensor automático)',
    reaccion: 'Si el sensor rechaza 3 piezas consecutivas, detener línea y notificar a mantenimiento', responsable: 'Operador de línea', ref: MODO_FUERZA,
  }),
  linea({
    caracteristica: 'Fuerza de engarzado (estadístico)', especificacion: 'LIC 174.02 / LSC 178.19 (recalculados)', medicion: 'Fuerza de engarzado, en N', muestra: '1 subgrupo (n = 5)', frecuencia: 'Por turno', metodo: 'Carta X̄-R',
    reaccion: 'Si un punto sale de control, aplicar 5 Porqués antes de continuar', responsable: 'Green Belt / supervisor de calidad', ref: MODO_FUERZA,
  }),
  linea({
    caracteristica: 'Longitud de pelado', especificacion: '7 mm ± 0.5 mm', medicion: 'Calibrador digital', muestra: '1 muestra', frecuencia: 'Por turno', metodo: 'Verificación por muestreo',
    reaccion: 'Ajustar la guía de pelado si se detecta desviación', responsable: 'Operador de línea',
  }),
  linea({
    caracteristica: 'Continuidad eléctrica', especificacion: '0 fallas por lote', medicion: 'Probador de continuidad', muestra: '100 %', frecuencia: 'Cada unidad', metodo: 'Prueba al 100 %',
    reaccion: 'Retener la unidad; no liberar el lote', responsable: 'Operador de línea', ref: MODO_FUERZA,
  }),
];

const PLAN_EXCEL = [
  linea({
    op: '30', caracteristica: 'Fuerza de retención del conector', tipo: 'Producto', clasificacion: 'Crítica', especificacion: '≥ 173 N', medicion: 'Dinamómetro calibrado', muestra: '5 arneses', frecuencia: 'Cada hora',
    metodo: 'Carta X̄-R', reaccion: 'Detener la línea, aislar el lote, reapretar y verificar 100 % desde la última medición buena', responsable: 'Líder de línea', ref: 'Torque bajo',
  }),
  linea({
    op: '30', caracteristica: 'Verificación del instrumento', tipo: 'Proceso', clasificacion: 'Crítica', especificacion: 'Dentro de tolerancia del fabricante', medicion: 'Patrón de torque', muestra: '1 verificación',
    frecuencia: 'Inicio de cada turno', metodo: 'Lista de verificación', reaccion: 'No iniciar producción; retirar el instrumento y usar uno calibrado', responsable: 'Operador senior', ref: 'Torque bajo',
  }),
  linea({
    op: '20', caracteristica: 'Fuerza de jalón del crimpado', tipo: 'Producto', clasificacion: 'Significativa', especificacion: 'Según especificación del terminal', medicion: 'Prueba de jalón', muestra: '3 piezas',
    frecuencia: 'Inicio de turno y cambio de aplicador', metodo: 'Hoja de verificación', reaccion: 'Ajustar la prensa; retener y revisar las piezas desde la última verificación', responsable: 'Técnico de mantenimiento', ref: 'Terminal mal crimpada',
  }),
  linea({
    op: '40', caracteristica: 'Etiqueta correcta para el tablero', tipo: 'Producto', clasificacion: 'Estándar', especificacion: '100 % correcta', medicion: 'Lectura / comparación con la orden', muestra: '100 %',
    frecuencia: 'Cada arnés', metodo: 'Poka-yoke (lector)', reaccion: 'Segregar el arnés y corregir la etiqueta', responsable: 'Operador', ref: 'Etiqueta incorrecta',
  }),
  linea({
    op: '50', caracteristica: 'Continuidad y aislamiento', tipo: 'Producto', clasificacion: 'Crítica', especificacion: 'Sin fallas', medicion: 'Probador automático', muestra: '100 %', frecuencia: 'Cada arnés',
    metodo: 'Prueba automática', reaccion: 'Segregar y enviar a retrabajo; registrar la falla', responsable: 'Inspector de calidad',
  }),
];

const PLAN_OLVIDAR = PLAN_GUIA.map((l, i) => (i === 0 ? { ...l, reaccion: 'Desechar la pieza mala y seguir produciendo' } : l));

const umbralDe = (rpnAlto) => ({
  titulo: 'Cómo se revisa el plan',
  filas: [
    {
      rango: 'Línea completa',
      texto: 'tiene los ocho campos: característica, especificación, técnica de medición, tamaño de muestra, frecuencia, método de control, plan de reacción y responsable (plantilla «Plan de Control»).',
    },
    {
      rango: `RPN ≥ ${entero(rpnAlto)}`,
      texto: 'la plantilla pide clasificar la característica como Crítica o Significativa; si queda Estándar (o sin clasificar), marca «Revisar clasificación (RPN alto)». La plantilla usa 100; la guía llama «acción requerida» a más de 100 (LAB 17).',
    },
    {
      rango: 'S ≥ 9, cualquier RPN',
      texto: 'revisión obligatoria (LAB 17): el modo debe tener una línea que lo controle o una decisión documentada de no controlarlo. La plantilla solo mira el RPN; esta regla es una referencia didáctica.',
    },
    {
      rango: 'Plan de reacción',
      texto: 'debe apuntar a encontrar y eliminar la causa, no solo a descartar la pieza: «corregir y olvidar» deja la fase Controlar sin poder cerrarse nunca (guía M10 §4). La revisión del laboratorio es por palabras clave y solo orienta.',
    },
    {
      rango: 'Auditoría cada 3 a 6 meses',
      texto: 'tres preguntas: ¿se sigue midiendo lo que el plan dice?, ¿con la frecuencia especificada?, ¿el plan de reacción se aplica cuando una señal se dispara, o se volvió una formalidad? (guía M10 §4).',
    },
  ],
});

const SUPUESTO = {
  titulo: 'Supuesto del método',
  texto:
    'El laboratorio revisa que el documento esté completo y ligado al AMEF; no sabe si la especificación es la correcta, si la frecuencia de muestreo alcanza para detectar un cambio a tiempo ni si el método de control es el adecuado. ' +
    'Un plan «completo» puede ser un mal plan. Es un documento vivo: se actualiza cuando cambia el proceso, el AMEF o el desempeño de las cartas de control (plantilla «Plan de Control»), ' +
    'y un plan que nadie audita tiende a degradarse en la práctica aunque siga vigente en el papel (guía M10 §4).',
};

export default function lab24(ctx = {}) {
  const caso = ctx.caso?.amef;
  const aModo = (f) => ({ modo: f.modo ?? '', s: f.s ?? NaN, o: f.o ?? NaN, d: f.d ?? NaN });
  const amefGuia = caso?.guia?.filas?.length ? caso.guia.filas.map(aModo) : [{ modo: MODO_FUERZA, s: 8, o: 6, d: 4 }, { modo: 'Conector mal asentado', s: 9, o: 2, d: 3 }, { modo: 'Etiqueta ilegible o mal ubicada', s: 3, o: 7, d: 2 }];
  const amefExcel = caso?.excel?.filas?.length ? caso.excel.filas.map(aModo) : [{ modo: 'Torque bajo', s: 8, o: 5, d: 6 }, { modo: 'Terminal mal crimpada', s: 9, o: 4, d: 5 }, { modo: 'Etiqueta incorrecta', s: 5, o: 3, d: 8 }];

  const presets = [
    {
      id: 'guia', etiqueta: 'Guía M10 §4: el plan de la fuerza de engarzado, el pelado y la continuidad',
      ayuda: 'Las cuatro líneas de la tabla de la guía, con el método y la frecuencia separados. La guía no clasifica las características: la plantilla pide Crítica o Significativa cuando el RPN es alto (el de la fuerza es 192), así que tres líneas quedan «por revisar» hasta que las clasifiques. Además, el conector mal asentado (S = 9) y el etiquetado quedan fuera de este plan: son los dos pendientes que la guía deja para un proyecto siguiente.',
      valores: { amef: amefGuia, plan: PLAN_GUIA, rpnAlto: RPN_ALTO },
    },
    {
      id: 'excel', etiqueta: 'Plantilla Excel «Plan de Control»: cinco líneas (80 % completo)',
      ayuda: 'Las cinco líneas de la hoja con su AMEF de tres modos. Cuatro quedan completas; la del etiquetado tiene RPN 120 pero está clasificada como Estándar: «Revisar clasificación (RPN alto)». La prueba eléctrica final no cita ningún modo del AMEF.',
      valores: { amef: amefExcel, plan: PLAN_EXCEL, rpnAlto: RPN_ALTO },
    },
    {
      id: 'corregir-olvidar', etiqueta: 'Guía con «corregir y olvidar» en el poka-yoke',
      ayuda: 'El plan de la guía con una reacción que solo desecha la pieza y sigue produciendo, el anti-ejemplo que advierte la sección 4. Compara el semáforo «Plan de reacción» con el del preset de la guía.',
      valores: { amef: amefGuia, plan: PLAN_OLVIDAR, rpnAlto: RPN_ALTO },
    },
  ];

  const opcionesDe = (lista) => [{ valor: '', texto: '—' }, ...lista.map((v) => ({ valor: v, texto: v }))];
  const modosDe = (estado) => modosAmef(estado.amef).modos;
  const estadoFila = (estado, fila) => resumenPlan([fila], modosDe(estado), { rpnAlto: estado.rpnAlto >= 1 ? estado.rpnAlto : RPN_ALTO }).lineas[0];

  return {
    id: 'lab24',
    numero: '24',
    modulo: 'M10',
    titulo: 'Plan de control',
    resumen: 'Revisa un plan de control línea por línea: que cada característica tenga especificación, medición, muestra, frecuencia, método, reacción y responsable; que apunte a un modo de falla del AMEF y que ningún modo importante quede sin control.',
    panelAncho: true,
    entradas: [
      {
        id: 'amef', tipo: 'tabla', etiqueta: 'AMEF resumido (modo de falla y calificaciones, como en el LAB 17)',
        columnas: [
          { id: 'modo', etiqueta: 'Modo de falla', tipo: 'texto', ancho: '190px', ayuda: 'CÓMO falla el proceso o la pieza. El plan lo cita por este nombre en «Ref. AMEF».' },
          { id: 's', etiqueta: 'S', tipo: 'numero', min: 1, max: 10, ancho: '38px', ayuda: 'Severidad, de 1 a 10.' },
          { id: 'o', etiqueta: 'O', tipo: 'numero', min: 1, max: 10, ancho: '38px', ayuda: 'Ocurrencia, de 1 a 10.' },
          { id: 'd', etiqueta: 'D', tipo: 'numero', min: 1, max: 10, ancho: '38px', ayuda: 'Detección, de 1 a 10 (escala invertida: 10 = prácticamente indetectable).' },
          {
            id: 'rpn', etiqueta: 'RPN', tipo: 'fijo', ancho: '52px', ayuda: 'S × O × D (de 1 a 1,000).',
            texto: (estado, fila) => {
              const v = fila.s * fila.o * fila.d;
              return [fila.s, fila.o, fila.d].every((x) => Number.isInteger(x) && x >= 1 && x <= 10) ? String(v) : '';
            },
          },
        ],
        filas: amefGuia, filaNueva: { modo: '', s: NaN, o: NaN, d: NaN }, minFilas: 1, maxFilas: MAX_MODOS, filasVacias: 3, etiquetaAgregar: '+ Modo de falla',
        ayuda: 'Los modos que quieras controlar, con S, O y D como en el AMEF del LAB 17. Con ellos se calcula el RPN de cada línea del plan.',
      },
      {
        id: 'plan', tipo: 'tabla', etiqueta: 'Plan de control: una fila por característica a controlar',
        columnas: [
          { id: 'op', etiqueta: 'Op.', tipo: 'texto', ancho: '46px', ayuda: 'Número de operación o proceso (opcional).' },
          { id: 'caracteristica', etiqueta: 'Característica', tipo: 'texto', ancho: '168px', ayuda: 'Qué se controla: una característica del producto o del proceso (p. ej. «Fuerza de engarzado»).' },
          { id: 'tipo', etiqueta: 'Tipo', tipo: 'opcion', ancho: '96px', opciones: opcionesDe(TIPOS_CARACTERISTICA), ayuda: 'Producto o proceso (opcional).' },
          { id: 'clasificacion', etiqueta: 'Clasif.', tipo: 'opcion', ancho: '112px', opciones: opcionesDe(CLASIFICACIONES), ayuda: 'Crítica, Significativa o Estándar. Con RPN alto en el AMEF la plantilla espera Crítica o Significativa.' },
          { id: 'especificacion', etiqueta: 'Especificación', tipo: 'texto', ancho: '150px', ayuda: 'El valor o la tolerancia que debe cumplirse (p. ej. «≥ 173 N»).' },
          { id: 'medicion', etiqueta: 'Técnica de medición', tipo: 'texto', ancho: '150px', ayuda: 'Con qué se mide o verifica.' },
          { id: 'muestra', etiqueta: 'Muestra', tipo: 'texto', ancho: '104px', ayuda: 'Tamaño de muestra (p. ej. «5 arneses» o «100 %»).' },
          { id: 'frecuencia', etiqueta: 'Frecuencia', tipo: 'texto', ancho: '118px', ayuda: 'Cada cuánto se mide (p. ej. «Por turno» o «Cada ciclo»).' },
          { id: 'metodo', etiqueta: 'Método de control', tipo: 'texto', ancho: '140px', ayuda: 'Cómo se previene o detecta: carta de control, poka-yoke, lista de verificación, prueba automática…' },
          { id: 'reaccion', etiqueta: 'Plan de reacción', tipo: 'texto', ancho: '250px', ayuda: 'Qué hacer exactamente si el proceso se sale de control; debe apuntar a la causa, no solo a descartar la pieza.' },
          { id: 'responsable', etiqueta: 'Responsable', tipo: 'texto', ancho: '140px', ayuda: 'Quién mide y quién reacciona.' },
          { id: 'ref', etiqueta: 'Ref. AMEF', tipo: 'texto', ancho: '190px', ayuda: 'El nombre del modo de falla de la tabla de arriba que esta línea previene o detecta (no importan acentos ni mayúsculas).' },
          {
            id: 'rpn', etiqueta: 'RPN AMEF', tipo: 'fijo', ancho: '96px', ayuda: 'El RPN del modo citado en «Ref. AMEF».',
            texto: (estado, fila) => {
              const l = estadoFila(estado, fila);
              if (!l || l.refEstado === 'sin-ref') return '';
              return l.refEstado === 'no-encontrada' ? 'no está en el AMEF' : String(l.rpn);
            },
          },
          { id: 'estado', etiqueta: 'Estado', tipo: 'fijo', ancho: '230px', ayuda: 'Completo, Incompleto (con lo que falta) o Revisar clasificación.', texto: (estado, fila) => estadoFila(estado, fila)?.estadoTexto ?? '' },
        ],
        filas: PLAN_GUIA, filaNueva: linea({}), minFilas: 1, maxFilas: MAX_LINEAS, filasVacias: 4, etiquetaAgregar: '+ Característica',
        ayuda: `Hasta ${MAX_LINEAS} líneas (como la plantilla). Una línea necesita los ocho campos obligatorios; Op., Tipo y Ref. AMEF son opcionales, aunque sin Ref. AMEF no hay RPN ni cobertura.`,
      },
      {
        id: 'rpnAlto', tipo: 'numero', etiqueta: 'RPN que se considera alto', valor: RPN_ALTO, min: 1, max: 1000, ancho: '90px',
        ayuda: 'La plantilla usa 100 («Con RPN ≥ 100 en el AMEF»). Cámbialo para ver cuántas líneas dependen del umbral.',
      },
    ],
    presets,
    umbral: umbralDe(RPN_ALTO),
    supuesto: SUPUESTO,
    preguntas: [
      'Un plan de reacción que dice «desechar la pieza y continuar» no incluye ninguna acción sobre la causa. Reescribe la reacción de una línea para que ataque la causa y explica por qué, sin eso, la fase Controlar no podría cerrarse.',
      'En el plan de la guía, el conector mal asentado (S = 9, RPN 54) no tiene línea de control. ¿Qué documentarías para que esa decisión no se pierda cuando el Green Belt pase a otro proyecto? ¿Y quién debería ser su dueño?',
      'Clasifica las cuatro líneas del plan de la guía como Crítica, Significativa o Estándar. ¿Qué criterio usaste: el RPN, la severidad o el requisito del cliente? ¿Cambia alguna clasificación al bajar el RPN alto a 50?',
      'La longitud de pelado de 7 mm sale del experimento del módulo 9, no del AMEF. ¿Qué modo de falla agregarías al AMEF para que el plan tenga de dónde colgar esa característica?',
      'Audita este plan con las tres preguntas de la guía (§4): ¿se sigue midiendo lo que dice?, ¿con la frecuencia especificada?, ¿la reacción se aplica? ¿Qué evidencia pedirías para cada una?',
    ],

    calcular(e) {
      const aviso = [];
      const rpnValido = Number.isFinite(e.rpnAlto) && e.rpnAlto >= 1 && e.rpnAlto <= 1000;
      const rpnAlto = rpnValido ? e.rpnAlto : RPN_ALTO;
      if (!rpnValido) aviso.push(`El RPN que se considera alto debe estar entre 1 y 1,000: se usó ${entero(RPN_ALTO)} (plantilla).`);
      const { modos, descartadas, repetidos } = modosAmef(e.amef);
      if (descartadas) aviso.push(`Filas del AMEF sin nombre o sin S, O y D (enteros de 1 a 10): ${entero(descartadas)}. Se ignoraron.`);
      if (repetidos) aviso.push(`Modos del AMEF con el mismo nombre: ${entero(repetidos)}. Solo cuenta el primero.`);
      const r = resumenPlan(e.plan, modos, { rpnAlto });
      const umbral = umbralDe(rpnAlto);

      if (!r.nLineas) {
        return {
          aviso,
          umbral,
          vacio: 'Captura al menos una línea del plan (empieza por la característica y su especificación) para revisarla.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'El plan no tiene líneas.' }],
        };
      }

      const lineas = r.lineas;
      const conTodos = lineas.filter((f) => f.faltan.length === 0).length;

      /* ---- salidas ---- */
      const notaCompletas = [
        r.nIncompletas ? `${plural(r.nIncompletas, 'incompleta')}` : null,
        r.nReclasificar ? `${plural(r.nReclasificar, 'por clasificar', 'por clasificar')}` : null,
      ].filter(Boolean);
      const salidas = [
        { id: 'lineas', etiqueta: 'Líneas del plan', valor: entero(r.nLineas), color: 'teal', nota: `${entero(conTodos)} con los ocho campos` },
        {
          id: 'completas', etiqueta: 'Líneas completas', valor: `${entero(r.nCompletas)} de ${entero(r.nLineas)}`, color: r.nCompletas === r.nLineas ? 'verde' : 'ambar',
          nota: `${pct(r.pctCompleto, 0)}${notaCompletas.length ? ` · ${notaCompletas.join(' · ')}` : ''}`,
        },
        { id: 'criticas', etiqueta: 'Características críticas', valor: entero(r.nCriticas), color: 'azul', nota: 'clasificadas como Crítica' },
        { id: 'rpn-alto', etiqueta: `Con RPN ≥ ${entero(rpnAlto)} en el AMEF`, valor: entero(r.nRpnAlto), color: r.nRpnAlto ? 'coral' : undefined, nota: r.nRpnAlto ? 'líneas ligadas a un modo de riesgo alto' : 'ninguna línea apunta a un modo de riesgo alto' },
        {
          id: 'sin-ligar', etiqueta: 'Sin ligar al AMEF', valor: entero(r.nSinRef + r.nNoLigadas), color: r.nSinRef + r.nNoLigadas ? 'ambar' : undefined,
          nota: `${entero(r.nSinRef)} sin referencia · ${entero(r.nNoLigadas)} con un nombre que no está en el AMEF`,
        },
      ];
      if (modos.length) {
        salidas.push({
          id: 'sin-control', etiqueta: 'Modos importantes sin control', valor: entero(r.sinControl.length), color: r.sinControl.length ? 'coral' : 'verde',
          nota: r.sinControl.length ? listaCitada(r.sinControl.map((c) => `«${c.modo.modo}»`)) : `de ${plural(modos.length, 'modo')} del AMEF, todos los importantes tienen línea`,
        });
      }

      /* ---- semáforos ---- */
      const semaforos = [];
      const incompletas = lineas.filter((f) => f.estado === 'incompleto');
      if (incompletas.length) {
        const lista = listaCitada(incompletas.map((f) => `${nombreDe(f)} (${f.estadoTexto.replace('Incompleto: ', '')})`));
        semaforos.push({
          nombre: 'Completitud', estado: 'atencion',
          texto: `${plural(incompletas.length, 'línea', 'líneas')} sin los ocho campos: ${lista}. Un plan solo se sostiene sin el Green Belt si cada línea dice qué medir, cómo, cada cuánto, quién y qué hacer.`,
        });
      } else {
        semaforos.push({ nombre: 'Completitud', estado: 'cumple', texto: `Las ${entero(r.nLineas)} líneas tienen los ocho campos obligatorios.` });
      }

      const porClasificar = lineas.filter((f) => f.estado === 'clasificacion');
      if (porClasificar.length) {
        semaforos.push({
          nombre: 'Clasificación', estado: 'atencion',
          texto: `${listaCitada(porClasificar.map((f) => `${nombreDe(f)} (RPN ${entero(f.rpn)})`))}: el AMEF ${porClasificar.length === 1 ? 'la ubica' : 'las ubica'} en RPN ≥ ${entero(rpnAlto)} pero ${porClasificar.length === 1 ? 'no está clasificada' : 'no están clasificadas'} como Crítica ni Significativa. Decide su clasificación (plantilla «Plan de Control»).`,
        });
      } else if (r.nRpnAlto) {
        semaforos.push({ nombre: 'Clasificación', estado: 'cumple', texto: `Las ${plural(r.nRpnAlto, 'línea')} con RPN ≥ ${entero(rpnAlto)} están clasificadas como Crítica o Significativa.` });
      }

      if (!modos.length) {
        semaforos.push({ nombre: 'Vínculo con el AMEF', estado: 'informativo', texto: 'Captura el AMEF resumido (tabla de arriba, como en el LAB 17) para ligar cada línea a su modo de falla, ver su RPN y revisar la cobertura.' });
      } else {
        const noLigadas = lineas.filter((f) => f.refEstado === 'no-encontrada');
        const sinRef = lineas.filter((f) => f.refEstado === 'sin-ref');
        if (noLigadas.length) {
          semaforos.push({
            nombre: 'Vínculo con el AMEF', estado: 'atencion',
            texto: `${listaCitada(noLigadas.map((f) => `${nombreDe(f)} → «${limpio(f.ref)}»`))}: ese nombre no está en el AMEF. Escríbelo igual que en la tabla de arriba (no importan acentos ni mayúsculas) o agrega el modo.`,
          });
        }
        if (sinRef.length) {
          semaforos.push({
            nombre: 'Líneas sin modo de falla', estado: 'informativo',
            texto: `${listaCitada(sinRef.map(nombreDe))} no cita ningún modo del AMEF. Puede ser correcto —una característica que salió de un experimento o del cliente—, pero conviene preguntarse qué falla previene o detecta.`,
          });
        }
        if (!noLigadas.length && !sinRef.length) {
          semaforos.push({ nombre: 'Vínculo con el AMEF', estado: 'cumple', texto: 'Todas las líneas apuntan a un modo de falla del AMEF.' });
        }

        if (r.sinControl.length) {
          const hayRpnAlto = r.sinControl.some((c) => c.modo.rpn >= rpnAlto);
          const lista = listaCitada(r.sinControl.map((c) => `«${c.modo.modo}» (RPN ${entero(c.modo.rpn)}, S = ${c.modo.s})`));
          semaforos.push({
            nombre: 'Cobertura del AMEF', estado: hayRpnAlto ? 'critico' : 'atencion',
            texto: `${plural(r.sinControl.length, 'modo importante', 'modos importantes')} sin línea en el plan: ${lista}. Si ${r.sinControl.length === 1 ? 'queda' : 'quedan'} fuera del alcance del proyecto, déjalo documentado con un dueño y una fecha; si no, agrega su control.`,
          });
        } else {
          semaforos.push({ nombre: 'Cobertura del AMEF', estado: 'cumple', texto: `Los modos con RPN ≥ ${entero(rpnAlto)} o severidad ≥ 9 tienen al menos una línea de control.` });
        }
      }

      if (r.soloDescartan.length) {
        semaforos.push({
          nombre: 'Plan de reacción', estado: 'atencion',
          texto: `${listaCitada(r.soloDescartan.map(nombreDe))}: ${r.soloDescartan.length === 1 ? 'la reacción se queda' : 'las reacciones se quedan'} en desechar la pieza y seguir. Sin atacar la causa el síntoma se repite y la fase Controlar no se cierra (guía M10 §4). Revisión por palabras clave: orientativa.`,
        });
      } else {
        semaforos.push({ nombre: 'Plan de reacción', estado: 'cumple', texto: 'Ninguna reacción se limita a desechar y seguir produciendo (revisión por palabras clave: léelas tú también).' });
      }

      /* ---- gráfica: cobertura del AMEF ---- */
      const graficas = [];
      if (modos.length) {
        const orden = [...r.cobertura].sort((a, b) => b.modo.rpn - a.modo.rpn || a.modo.indice - b.modo.indice);
        const etiquetas = orden.map((c, i) => envolver(limpio(`${i + 1}. ${c.modo.modo}`), 28, 2));
        const hover = orden.map((c) => [
          `<b>${limpio(c.modo.modo)}</b>`,
          `S=${c.modo.s} · O=${c.modo.o} · D=${c.modo.d} → RPN ${c.modo.rpn}`,
          c.cubierto ? `Controlado por: ${c.lineas.map((n) => `fila ${n}`).join(', ')}` : c.importante ? 'Importante y sin línea de control' : 'Sin línea de control (riesgo menor)',
        ].join('<br>'));
        const clase = (c) => (c.cubierto ? 0 : c.importante ? 1 : 2);
        const serie = (nombre, color, k) => ({
          type: 'bar', orientation: 'h', name: nombre, y: etiquetas, x: orden.map((c) => (clase(c) === k ? c.modo.rpn : null)),
          marker: { color, line: { width: 0 } },
          text: orden.map((c) => (clase(c) === k ? `${entero(c.modo.rpn)} · ${plural(c.lineas.length, 'línea')}` : '')), textposition: 'outside', textfont: { color: COLOR.blanco, size: 11 }, cliponaxis: false,
          customdata: hover, hovertemplate: '%{customdata}<extra></extra>',
        });
        const datos = [serie('Con línea de control', COLOR.teal, 0), serie('Importante y sin control', COLOR.coral, 1), serie('Sin línea, riesgo menor', COLOR.gris, 2)];
        const severos = orden.map((c, i) => (c.modo.severa ? i : -1)).filter((i) => i >= 0);
        if (severos.length) {
          datos.push({
            type: 'scatter', mode: 'markers', name: 'Severidad ≥ 9', y: severos.map((i) => etiquetas[i]), x: severos.map((i) => orden[i].modo.rpn),
            marker: { symbol: 'diamond', size: 11, color: COLOR.blanco, line: { color: '#0a1011', width: 1 } },
            customdata: severos.map((i) => hover[i]), hovertemplate: '%{customdata}<extra></extra>',
          });
        }
        const xMax = Math.max(...orden.map((c) => c.modo.rpn), rpnAlto) * 1.3;
        graficas.push({
          id: 'cobertura', titulo: 'Cobertura del AMEF: RPN de cada modo y líneas del plan que lo controlan', ancha: true, alta: orden.length > 6,
          datos,
          layout: {
            barmode: 'overlay', bargap: orden.length <= 2 ? 0.55 : 0.32,
            shapes: [lineaV(rpnAlto, COLOR.ambar)],
            xaxis: { title: { text: 'RPN = S × O × D' }, range: [0, xMax], rangemode: 'tozero', zeroline: false },
            yaxis: { type: 'category', autorange: 'reversed', automargin: true, tickfont: { size: 11, color: COLOR.gris } },
            margin: { l: 56, r: 40, t: 18, b: 48 },
          },
          respaldo: {
            columnas: ['#', 'Modo de falla', 'S', 'O', 'D', 'RPN', 'Líneas del plan'],
            filas: orden.map((c, i) => [String(i + 1), c.modo.modo, String(c.modo.s), String(c.modo.o), String(c.modo.d), entero(c.modo.rpn), c.lineas.length ? c.lineas.map((n) => `fila ${n}`).join(', ') : 'ninguna']),
          },
        });
      }

      /* ---- tablas ---- */
      const estadoChip = { completo: 'cumple', clasificacion: 'atencion', incompleto: 'critico' };
      const tablas = [
        {
          titulo: 'El plan, línea por línea',
          columnas: [{ t: '#', num: true }, 'Característica', 'Clasif.', 'Modo del AMEF', { t: 'RPN', num: true }, 'Estado'],
          filas: lineas.map((f) => [
            { texto: String(f.indice), num: true }, f.caracteristica || '—', f.clasificacion || '—', f.modo ? f.modo.modo : f.refEstado === 'no-encontrada' ? `«${f.ref}» no está en el AMEF` : '—',
            { texto: Number.isFinite(f.rpn) ? entero(f.rpn) : '—', num: true, formula: true }, { estado: estadoChip[f.estado], texto: f.estadoTexto },
          ]),
          resaltar: lineas.map((f, i) => (f.estado === 'completo' ? -1 : i)).filter((i) => i >= 0),
          pie: `Se revisan los ocho campos obligatorios y, si la línea apunta a un modo con RPN ≥ ${entero(rpnAlto)}, su clasificación. Resaltadas: las líneas que piden atención.`,
        },
      ];
      if (modos.length) {
        tablas.push({
          titulo: 'Cobertura del AMEF',
          columnas: ['Modo de falla', { t: 'S', num: true }, { t: 'RPN', num: true }, 'Importante', 'Líneas que lo controlan', 'Estado'],
          filas: [...r.cobertura].sort((a, b) => b.modo.rpn - a.modo.rpn || a.modo.indice - b.modo.indice).map((c) => [
            c.modo.modo, { texto: String(c.modo.s), num: true }, { texto: entero(c.modo.rpn), num: true, formula: true },
            c.importante ? (c.modo.rpn >= rpnAlto && c.modo.severa ? `RPN ≥ ${entero(rpnAlto)} y S ≥ 9` : c.modo.severa ? 'S ≥ 9' : `RPN ≥ ${entero(rpnAlto)}`) : 'no',
            c.lineas.length ? c.lineas.map((n) => `fila ${n}`).join(', ') : 'ninguna',
            c.cubierto ? { estado: 'cumple', texto: 'Con control' } : c.importante ? { estado: c.modo.rpn >= rpnAlto ? 'critico' : 'atencion', texto: 'Sin control' } : { estado: 'informativo', texto: 'Sin línea' },
          ]),
          pie: `Un modo es importante si su RPN es ≥ ${entero(rpnAlto)} (plantilla) o su severidad es ≥ 9 (revisión obligatoria, LAB 17). Una línea cubre un modo cuando su «Ref. AMEF» lleva su nombre.`,
        });
      }

      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: `Los nombres se comparan sin acentos ni mayúsculas (por ejemplo «${normalizarNombre('Torque Bajo')}»).` };
      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
