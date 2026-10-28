/**
 * LAB 16 · Ishikawa (6M) y 5 Porqués
 *
 * Guía: M6 §2 y §3 · plantillas Excel «Ishikawa» y «5 Porques».
 *   El Ishikawa organiza la lluvia de ideas de causas en seis categorías (mano de obra, método, máquina, material, medición
 *   y medio ambiente): enumera sospechosos, no los condena. Los 5 Porqués profundizan en UNA causa hasta una falla de
 *   proceso o de sistema, nunca «la persona se equivocó». El cinco es orientativo: algunos problemas necesitan tres
 *   preguntas y otros ocho. Ninguna de las dos herramientas prueba nada: cada causa y cada respuesta se verifican con datos.
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: la cadena de la guía (fallas de continuidad eléctrica, sin votos ni evidencias), el ejemplo de las plantillas
 * (fuerza de retención en el Turno 3, con votos y evidencias) y una cadena que se detiene en una persona (variante
 * didáctica de la pregunta 3 del examen del módulo; no está en la guía).
 */
import { CATEGORIAS_6M, LISTA_FRASES_PERSONA, estadoCadena, frasesPersona, resumenIshikawa } from '../js/lib/analizar.js';
import { entero, plural } from '../js/core/format.js';

const MAX_CAUSAS = 30; // seis filas por categoría, como la plantilla
const MAX_PASOS = 8; // «algunos problemas necesitan tres preguntas, otros ocho» (guía M6 §3)
const CATEGORIAS_RAIZ = ['Método / sistema', 'Mano de obra', 'Máquina', 'Material', 'Medición', 'Medio ambiente']; // lista de la plantilla «5 Porques»
const PRUEBAS = ['Sí', 'No', 'No sé'];

const UMBRAL = {
  titulo: 'Cómo leer el Ishikawa y los 5 Porqués',
  filas: [
    { rango: 'Las seis M', texto: 'mano de obra, método, máquina, material, medición y medio ambiente tienen al menos una causa. Si falta una, pregunta si de verdad no aplica o si es un punto ciego del equipo (revisión cruzada de la guía M6 §2)' },
    { rango: 'Votos', texto: 'solo ordenan qué causas verificar primero con datos (Pareto, hipótesis, 5 Porqués): una causa votada no es una causa comprobada (plantilla «Ishikawa»)' },
    { rango: 'Cadena corta (menos de 3 porqués)', texto: 'sigue preguntando hasta una causa de proceso o de sistema; el cinco es orientativo: algunos problemas necesitan tres porqués y otros ocho (guía M6 §3; plantilla «5 Porques»)' },
    { rango: 'Pasos sin verificar (tres porqués o más)', texto: 'una respuesta sin evidencia es una hipótesis: la cadena solo se sostiene si cada paso se comprobó con un dato, un registro o una observación (plantilla «5 Porques»: «Pasos sin verificar: N de M»)' },
    { rango: 'Cadena verificada', texto: 'tres porqués o más, cada uno con su evidencia («¿Verificada?» = Sí): entonces la cadena es un hecho, no una hipótesis (plantilla «5 Porques»)' },
    {
      rango: 'Señala a una persona',
      texto: `si una respuesta dice «se descuidó» o «no se fijó», pregunta por qué el proceso permitió el error: la causa raíz es de proceso o de sistema, nunca «la persona se equivocó» (guía M6 §3). Frases que se buscan: ${LISTA_FRASES_PERSONA.join(', ')} (las dos primeras, de la plantilla; el resto, referencia didáctica)`,
    },
    { rango: 'Prueba inversa', texto: 'si se elimina la causa raíz, ¿desaparece el problema? «Sí»: la cadena se sostiene; «No» o «No sé»: falta un porqué, hay otra rama o falta evidencia (pregunta de la plantilla «5 Porques»; la lectura de cada respuesta es referencia didáctica)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto del método',
  texto:
    'Ninguna de las dos herramientas prueba nada por sí sola: son formas estructuradas de generar y priorizar hipótesis, no de confirmarlas (guía M6). ' +
    'El Ishikawa enumera sospechosos, no los condena: cada causa listada debe verificarse con datos antes de invertir en una solución, y los votos miden la opinión del equipo, no evidencia. ' +
    'En los 5 Porqués, lo que convierte cada respuesta en un hecho es la evidencia que la sostiene, y la cadena debe terminar en una falla de proceso o de sistema, no en una persona.',
};

const textoVotos = (n) => `${entero(n)} ${n === 1 ? 'voto' : 'votos'}`;
/** ««A», «B» y «C»» con comillas angulares y, si sobran, «y N más». */
function listaCitada(textos, max = 3) {
  const citados = textos.slice(0, max).map((t) => `«${t}»`);
  const resto = textos.length - citados.length;
  if (resto > 0) citados.push(`${resto} más`);
  return citados.length > 1 ? `${citados.slice(0, -1).join(', ')} y ${citados[citados.length - 1]}` : citados[0] ?? '';
}

const filaCausa = (c) => ({ categoria: c.categoria, causa: c.causa ?? '', votos: Number.isFinite(c.votos) ? c.votos : NaN });
const filaPaso = (p) => ({ respuesta: p.respuesta ?? '', evidencia: p.evidencia ?? '', verificada: p.verificada === 'Sí' ? 'Sí' : 'No' });
/** Valores completos de los diez campos a partir de un ejemplo del caso: cada preset fija todas las entradas. */
const valoresDe = (ish = {}, por = {}) => ({
  efecto: ish.efecto ?? '',
  causas: (ish.causas ?? []).map(filaCausa),
  problema: por.problema ?? '',
  cadena: (por.cadena ?? []).map(filaPaso),
  causaRaiz: por.causaRaiz ?? '',
  categoriaRaiz: por.categoria ?? '',
  pruebaInversa: por.pruebaInversa ?? '',
  contramedida: por.contramedida ?? '',
  responsable: por.responsable ?? '',
  fecha: por.fecha ?? '',
});

export default function lab16(ctx = {}) {
  const ish = ctx.caso?.ishikawa;
  const por = ctx.caso?.porques;
  const guia = valoresDe(ish?.guia, por?.guia);
  const excel = ish?.excel && por?.excel ? valoresDe(ish.excel, por.excel) : null;

  const presets = [
    {
      id: 'guia', etiqueta: 'Guía M6 §2–3: fallas de continuidad eléctrica',
      ayuda: 'El Ishikawa y la cadena de cinco porqués de la guía, del problema a la falta de un control de cambios. La guía no da votos ni evidencias: la cadena queda como hipótesis por verificar, que es el siguiente paso de Analizar.',
      valores: guia,
    },
    ...(excel
      ? [{
        id: 'excel', etiqueta: 'Plantillas Excel: fuerza baja en el Turno 3',
        ayuda: 'Ejemplo de las hojas «Ishikawa» y «5 Porques»: diez causas votadas y una cadena con evidencias; la última respuesta (el plan de control) queda sin verificar. Termina en una causa de sistema, con contramedida y responsable.',
        valores: excel,
      }]
      : []),
    {
      id: 'persona', etiqueta: 'Cadena que se detiene en una persona (didáctico)',
      ayuda: 'Variante didáctica de la pregunta 3 del examen: sobre el Ishikawa de las plantillas, la cadena llega a «el operador se equivocó al torquear» y se detiene. El laboratorio señala las frases que apuntan a una persona; sigue preguntando por qué el proceso lo permitió. La cadena no está en la guía.',
      valores: {
        ...(excel ?? guia), // el mismo Ishikawa y el mismo problema de partida; cambia la cadena
        cadena: [
          { respuesta: 'El operador se equivocó al torquear el conector', evidencia: '', verificada: 'No' },
          { respuesta: 'Se descuidó y no puso atención', evidencia: '', verificada: 'No' },
        ],
        causaRaiz: 'El operador se descuidó.',
        categoriaRaiz: 'Mano de obra',
        pruebaInversa: '',
        contramedida: '',
        responsable: '',
        fecha: '',
      },
    },
  ];

  return {
    id: 'lab16',
    numero: '16',
    modulo: 'M6',
    titulo: 'Ishikawa (6M) y 5 Porqués',
    resumen: 'Explora las causas posibles de un problema con las 6M, vota cuáles verificar primero y profundiza en una con los 5 Porqués hasta una causa de proceso o de sistema, sin señalar a personas.',
    panelAncho: true,
    entradas: [
      { tipo: 'seccion', etiqueta: 'Ishikawa · causas posibles' },
      {
        id: 'efecto', tipo: 'texto', etiqueta: 'Efecto (el problema)', valor: guia.efecto, marcador: 'p. ej. Fallas de continuidad eléctrica',
        ayuda: 'Va en la cabeza del pez. Dilo medible y sin causa ni solución (viene del Pareto del LAB 15).',
      },
      {
        id: 'causas', tipo: 'tabla', etiqueta: 'Causas por categoría (6M)',
        columnas: [
          { id: 'categoria', etiqueta: 'M', tipo: 'opcion', opciones: CATEGORIAS_6M.map((c) => ({ valor: c, texto: c })), ancho: '124px' },
          { id: 'causa', etiqueta: 'Causa potencial', tipo: 'texto', ancho: '212px' },
          { id: 'votos', etiqueta: 'Votos', tipo: 'numero', min: 0, ancho: '58px', ayuda: 'Votos del equipo a esa causa: un entero desde 0 (la plantilla los valida así). Opcional.' },
        ],
        filas: guia.causas, filaNueva: { categoria: 'Mano de obra', causa: '', votos: NaN }, minFilas: 1, maxFilas: MAX_CAUSAS, filasVacias: 4, etiquetaAgregar: '+ Causa',
        ayuda: `Hasta ${MAX_CAUSAS} causas (seis por categoría, como la plantilla). Cada una es una sospechosa, no una culpable: las votadas se verifican con datos.`,
      },
      { tipo: 'seccion', etiqueta: '5 Porqués · de la causa aparente a la causa raíz' },
      {
        id: 'problema', tipo: 'texto', etiqueta: 'Problema que se analiza', valor: guia.problema, marcador: 'p. ej. la causa más votada',
        ayuda: 'Lo que se observa (el síntoma de partida), con el dato que lo respalda cuando lo hay.',
      },
      {
        id: 'cadena', tipo: 'tabla', etiqueta: 'Cadena de porqués (fila n = ¿por qué? n)',
        columnas: [
          { id: 'respuesta', etiqueta: 'Respuesta: porque…', tipo: 'texto', ancho: '230px' },
          { id: 'evidencia', etiqueta: 'Evidencia: ¿cómo se verificó?', tipo: 'texto', ancho: '168px' },
          { id: 'verificada', etiqueta: '¿Verificada?', tipo: 'opcion', opciones: [{ valor: 'Sí', texto: 'Sí' }, { valor: 'No', texto: 'No' }], ancho: '72px' },
        ],
        filas: guia.cadena, filaNueva: { respuesta: '', evidencia: '', verificada: 'No' }, minFilas: 1, maxFilas: MAX_PASOS, filasVacias: 5, etiquetaAgregar: '+ Porqué',
        ayuda: `Hasta ${MAX_PASOS} pasos: el cinco es orientativo. Cada respuesta contesta «¿por qué?» a la anterior y se sostiene con evidencia.`,
      },
      { id: 'causaRaiz', tipo: 'area', etiqueta: 'Causa raíz', valor: guia.causaRaiz, filasTexto: 2, marcador: 'la falla de proceso o de sistema donde termina la cadena', ayuda: 'Debe ser de proceso o de sistema y accionable: nadie necesita ser sancionado, pero sí corregir el sistema.' },
      {
        id: 'categoriaRaiz', tipo: 'opcion', etiqueta: 'Categoría de la causa raíz', valor: guia.categoriaRaiz,
        opciones: [{ valor: '', texto: '(sin elegir)' }, ...CATEGORIAS_RAIZ.map((c) => ({ valor: c, texto: c }))],
      },
      {
        id: 'pruebaInversa', tipo: 'opcion', etiqueta: 'Prueba inversa: si se elimina esta causa, ¿desaparece el problema?', valor: guia.pruebaInversa,
        opciones: [{ valor: '', texto: '—' }, ...PRUEBAS.map((p) => ({ valor: p, texto: p }))],
      },
      { id: 'contramedida', tipo: 'area', etiqueta: 'Contramedida (opcional)', valor: guia.contramedida, filasTexto: 2, marcador: 'qué cambia en el proceso para que no vuelva' },
      { id: 'responsable', tipo: 'texto', etiqueta: 'Responsable (opcional)', valor: guia.responsable, marcador: 'p. ej. Jefe de producción' },
      { id: 'fecha', tipo: 'texto', etiqueta: 'Fecha compromiso (opcional)', valor: guia.fecha, marcador: 'AAAA-MM-DD' },
    ],
    presets,
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Falta alguna de las 6M en tu diagrama? ¿Es porque de verdad no aplica o es un punto ciego del equipo? Intercambia el diagrama con otro equipo y pídele diez minutos de revisión cruzada.',
      '¿Alguna de las causas es en realidad un síntoma (algo que se observa) y no una causa (algo que lo produce)? Reescríbela con un porqué más.',
      'De las causas más votadas, ¿qué dato o medición confirmaría o descartaría cada una? ¿Cuál puedes verificar mañana mismo con lo que ya tienes?',
      '¿En qué porqué te habrías detenido si no hubieras seguido la disciplina? ¿Esa respuesta era de proceso o culpaba a una persona?',
      'Si eliminas tu causa raíz, ¿desaparece el problema? ¿Cómo lo comprobarías antes de invertir en la contramedida?',
    ],

    calcular(e) {
      const aviso = [];
      const efecto = String(e.efecto ?? '').trim();
      const problema = String(e.problema ?? '').trim();
      const raiz = String(e.causaRaiz ?? '').trim();
      const categoriaRaiz = String(e.categoriaRaiz ?? '').trim();
      const prueba = String(e.pruebaInversa ?? '').trim();
      const contramedida = String(e.contramedida ?? '').trim();
      const responsable = String(e.responsable ?? '').trim();
      const fecha = String(e.fecha ?? '').trim();

      /* ---- Ishikawa ---- */
      const ishi = resumenIshikawa(e.causas);
      if (ishi.votosInvalidos) aviso.push(`Votos no válidos (decimales o negativos): ${entero(ishi.votosInvalidos)}. Un voto es un entero desde 0; se contaron como 0.`);
      if (ishi.sinCategoria) aviso.push(`Causas sin una M válida (se ignoraron): ${entero(ishi.sinCategoria)}.`);
      if (ishi.valido && !efecto) aviso.push('Escribe el efecto (el problema) para completar la cabeza del pez.');
      const hayVotos = ishi.votosTotal > 0;
      const maximo = hayVotos ? Math.max(...ishi.causas.map((c) => c.votos)) : 0;
      const masVotadas = hayVotos ? ishi.ordenadas.filter((c) => c.votos === maximo) : [];

      /* ---- 5 Porqués ---- */
      const filas = (e.cadena ?? []).map((f) => ({
        respuesta: String(f?.respuesta ?? '').trim(), evidencia: String(f?.evidencia ?? '').trim(), verificada: f?.verificada === 'Sí' ? 'Sí' : 'No',
      }));
      const usadas = filas.filter((f) => f.respuesta);
      const cad = estadoCadena(filas);
      const siSinEvidencia = usadas.filter((f) => f.verificada === 'Sí' && !f.evidencia).length;
      const huerfanas = filas.filter((f) => !f.respuesta && f.evidencia).length;
      if (huerfanas) aviso.push(`${plural(huerfanas, 'fila tiene evidencia', 'filas tienen evidencia')} pero ninguna respuesta: no cuenta${huerfanas === 1 ? '' : 'n'} en la cadena.`);
      if (cad.n > 0 && !problema) aviso.push('Escribe el problema de partida de los 5 Porqués (la cadena arranca de él).');
      const fraseRaiz = frasesPersona(raiz);
      const personasTotal = cad.personas.length + (fraseRaiz.length ? 1 : 0);

      if (!ishi.valido && cad.n === 0 && !raiz) {
        return {
          aviso,
          vacio: 'Captura al menos una causa del Ishikawa o una respuesta de la cadena de porqués para ver el diagrama, el resumen por categoría y las revisiones.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: aviso.length ? 'Revisa el aviso sobre la captura.' : 'Sin causas ni respuestas capturadas.' }],
        };
      }

      /* ---- salidas ---- */
      const salidas = [];
      if (ishi.valido) {
        salidas.push({ id: 'causas', etiqueta: 'Causas en el diagrama', valor: entero(ishi.nCausas), color: 'teal', nota: `en ${entero(CATEGORIAS_6M.length - ishi.categoriasVacias.length)} de ${entero(CATEGORIAS_6M.length)} M` });
        if (hayVotos) {
          salidas.push({ id: 'votos', etiqueta: 'Votos emitidos', valor: entero(ishi.votosTotal), color: 'azul', nota: ishi.sinVotos ? `${plural(ishi.sinVotos, 'causa')} sin votos` : 'todas las causas con voto' });
          salidas.push({
            id: 'masVotada', etiqueta: masVotadas.length > 1 ? 'Causa más votada (empate)' : 'Causa más votada', valor: masVotadas[0].causa, pequeno: true, ancha: true,
            nota: masVotadas.length > 1 ? `${textoVotos(maximo)} cada una · ${listaCitada(masVotadas.map((c) => c.causa))}` : `${textoVotos(maximo)} · ${masVotadas[0].categoria}`,
          });
        }
      }
      if (cad.n > 0) salidas.push({ id: 'cadena', etiqueta: 'Cadena de porqués', valor: plural(cad.n, 'paso'), color: 'azul', nota: `${entero(cad.verificadas)} ${cad.verificadas === 1 ? 'verificado' : 'verificados'}` });
      if (raiz) {
        salidas.push({ id: 'raiz', etiqueta: 'Causa raíz', valor: raiz, pequeno: true, ancha: true, nota: [categoriaRaiz, prueba ? `prueba inversa: ${prueba}` : ''].filter(Boolean).join(' · ') || undefined });
      }

      /* ---- semáforos ---- */
      const semaforos = [];
      if (!ishi.valido) {
        semaforos.push({ nombre: 'Las seis M', estado: 'sin-datos', texto: 'Sin causas en el Ishikawa: lista las causas posibles de cada M para elegir cuál profundizar con los 5 Porqués.' });
      } else if (ishi.categoriasVacias.length === 0) {
        semaforos.push({ nombre: 'Las seis M', estado: 'cumple', texto: `Las seis M tienen al menos una causa (${plural(ishi.nCausas, 'causa')} en total).` });
      } else {
        semaforos.push({
          nombre: 'Las seis M', estado: 'atencion',
          texto: `Sin causas en ${ishi.categoriasVacias.join(', ')}. ¿De verdad no aplican o es un punto ciego del equipo? Pide una revisión cruzada a otro equipo.`,
        });
      }
      if (ishi.valido) {
        if (!hayVotos) {
          semaforos.push({ nombre: 'Votos', estado: 'informativo', texto: 'Sin votos: el diagrama enumera sospechosos. Vota (un entero desde 0 por causa) para decidir cuáles verificar primero con datos.' });
        } else {
          const cola = ishi.sinVotos ? ` ${plural(ishi.sinVotos, 'causa')} sin votos.` : '';
          semaforos.push(
            masVotadas.length === 1
              ? { nombre: 'Votos', estado: 'informativo', texto: `Más votada: «${masVotadas[0].causa}» (${textoVotos(maximo)}, ${masVotadas[0].categoria}). Verifícala con datos: una causa votada no es una causa comprobada.${cola}` }
              : { nombre: 'Votos', estado: 'informativo', texto: `Empate en la cima: ${listaCitada(masVotadas.map((c) => c.causa))} (${textoVotos(maximo)} cada una). Verifica todas con datos antes de elegir una.${cola}` }
          );
        }
      }

      if (cad.n === 0 && !raiz) {
        semaforos.push({ nombre: 'Cadena de porqués', estado: 'sin-datos', texto: 'Sin respuestas: toma la causa más votada y pregunta «¿por qué?» hasta llegar a una causa de proceso o de sistema.' });
      } else {
        let estado = { corta: 'atencion', pendiente: 'atencion', verificada: 'cumple', vacia: 'sin-datos' }[cad.estado];
        let texto = cad.estado === 'pendiente' ? `${cad.texto} Una respuesta sin evidencia es una hipótesis.` : cad.texto;
        if (cad.estado === 'vacia') texto = 'Escribe las respuestas de la cadena: cada una contesta «¿por qué?» a la anterior.';
        if (siSinEvidencia) {
          estado = 'atencion';
          if (cad.estado === 'verificada') texto = 'Todos los pasos están marcados como verificados, pero sin evidencia escrita la cadena sigue siendo una hipótesis.';
          texto += ` Marcaste «Sí» en ${plural(siSinEvidencia, 'paso')} sin escribir cómo se verificó.`;
        }
        semaforos.push({ nombre: 'Cadena de porqués', estado, texto });
        if (personasTotal > 0) {
          const partes = cad.personas.map((p) => `paso ${p.paso}: ${p.frases.map((fr) => `«${fr}»`).join(', ')}`);
          if (fraseRaiz.length) partes.push(`causa raíz: ${fraseRaiz.map((fr) => `«${fr}»`).join(', ')}`);
          semaforos.push({
            nombre: 'Sin culpar a personas', estado: 'atencion',
            texto: `Señalan a una persona — ${partes.join('; ')}. Pregunta por qué el proceso permitió el error y sigue la cadena hasta una causa de proceso o de sistema.`,
          });
        } else {
          semaforos.push({ nombre: 'Sin culpar a personas', estado: 'cumple', texto: 'Ninguna respuesta usa frases que señalen a una persona (revisión por frases clave, visibles en «Cómo leer»; no sustituye la lectura del equipo).' });
        }
      }

      if (raiz || cad.n >= 3) {
        if (!raiz) {
          semaforos.push({ nombre: 'Causa raíz', estado: 'atencion', texto: 'Falta la causa raíz: escribe la respuesta del último porqué que sea de proceso o de sistema, la que se puede corregir.' });
        } else if (!categoriaRaiz) {
          semaforos.push({ nombre: 'Causa raíz', estado: 'informativo', texto: 'Elige la categoría de la causa raíz (Método / sistema, Mano de obra, Máquina…): orienta quién debe corregirla.' });
        } else if (categoriaRaiz === 'Mano de obra') {
          semaforos.push({ nombre: 'Causa raíz', estado: 'informativo', texto: 'Una causa de mano de obra casi siempre tiene detrás una causa de sistema (capacitación, estándar, carga de trabajo): ¿falta un porqué? (referencia didáctica).' });
        } else {
          semaforos.push({ nombre: 'Causa raíz', estado: 'cumple', texto: `Causa raíz capturada, categoría «${categoriaRaiz}».` });
        }
      }
      if (raiz) {
        const lectura = {
          '': { estado: 'informativo', texto: 'Pendiente: si se elimina la causa raíz, ¿desaparece el problema? Respóndelo antes de proponer la contramedida.' },
          Sí: { estado: 'cumple', texto: 'El equipo espera que al eliminar la causa raíz desaparezca el problema. Compruébalo con datos o con un piloto en Mejorar.' },
          No: { estado: 'atencion', texto: 'Si al eliminarla el problema no desaparece, no es la causa raíz: hay otra rama o falta un porqué.' },
          'No sé': { estado: 'atencion', texto: 'Sin respuesta, la causa raíz sigue siendo una hipótesis: define cómo comprobarla (datos, experimento).' },
        }[prueba] ?? { estado: 'informativo', texto: 'Elige Sí, No o No sé.' };
        semaforos.push({ nombre: 'Prueba inversa', ...lectura });
        if (!contramedida) {
          semaforos.push({ nombre: 'Contramedida', estado: 'informativo', texto: 'Sin contramedida: se define en Mejorar; si ya la tienes, anótala con su responsable y fecha.' });
        } else if (responsable && fecha) {
          semaforos.push({ nombre: 'Contramedida', estado: 'cumple', texto: 'Contramedida con responsable y fecha compromiso.' });
        } else {
          const faltan = [!responsable && 'responsable', !fecha && 'fecha compromiso'].filter(Boolean).join(' y ');
          semaforos.push({ nombre: 'Contramedida', estado: 'atencion', texto: `Falta ${faltan}: una contramedida sin dueño ni fecha suele quedarse en intención (referencia didáctica).` });
        }
      }

      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((fila, i) => ({
          ...fila,
          activa: [
            ishi.valido, hayVotos, cad.estado === 'corta', cad.estado === 'pendiente' || (cad.estado === 'verificada' && siSinEvidencia > 0),
            cad.estado === 'verificada' && !siSinEvidencia, personasTotal > 0, Boolean(raiz && prueba),
          ][i],
        })),
      };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Antes de comprometer recursos, verifica con datos las causas más votadas y la causa raíz (Pareto, LAB 15; ANOVA, LAB 18; correlación y regresión, LAB 19).' };

      /* ---- figuras ---- */
      const figuras = [];
      if (ishi.valido) {
        figuras.push({
          id: 'ishikawa', titulo: 'Diagrama de Ishikawa (6M)', figura: 'ishikawa', ancha: true,
          params: { efecto, causas: ishi.causas.map((c) => ({ categoria: c.categoria, causa: c.causa, votos: c.capturado ? c.votos : null })) },
        });
      }
      if (cad.n > 0 || raiz) {
        figuras.push({
          id: 'porques', titulo: 'Cadena de porqués', figura: 'porques', ancha: true,
          params: { problema, pasos: usadas, causaRaiz: raiz, categoria: categoriaRaiz },
        });
      }

      /* ---- tabla: resumen por categoría (como la hoja «Ishikawa») ---- */
      const tablas = [];
      if (ishi.valido) {
        const calc = (texto) => ({ texto, num: true, formula: true });
        const maxCategoria = hayVotos ? Math.max(...ishi.porCategoria.map((c) => c.votos)) : 0;
        const filasTabla = ishi.porCategoria.map((c) => [
          c.categoria, calc(entero(c.nCausas)), calc(hayVotos ? entero(c.votos) : '—'), { texto: c.top || '—', formula: true },
        ]);
        filasTabla.push(['Total', calc(entero(ishi.nCausas)), calc(hayVotos ? entero(ishi.votosTotal) : '—'), '']);
        tablas.push({
          titulo: 'Resumen por categoría',
          columnas: ['M', { t: '# causas', num: true }, { t: 'Votos', num: true }, 'Causa con más votos'],
          filas: filasTabla,
          resaltar: [...(maxCategoria > 0 ? ishi.porCategoria.map((c, i) => (c.votos === maxCategoria ? i : -1)).filter((i) => i >= 0) : []), filasTabla.length - 1],
          pie: 'Mismo cálculo que la hoja «Ishikawa»: número de causas, suma de votos y causa con más votos de cada M (la primera si hay empate). Resaltadas: la(s) M con más votos y el total. Una M con muchos votos es un lugar por donde empezar a verificar, no una conclusión.',
        });
      }

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, figuras, tablas };
    },
  };
}
