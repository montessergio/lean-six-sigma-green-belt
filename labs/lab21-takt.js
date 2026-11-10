/**
 * LAB 21 · Takt time y balanceo de estaciones
 *
 * Guía: M8 §1 («Takt Time: el ritmo del cliente» y su conexión con el PCE), §5 (SMED) y ejercicios 1 y 3 · plantilla Excel «Takt Time».
 *   Takt = tiempo neto disponible ÷ demanda del cliente. El tiempo neto es el de los turnos menos los descansos y las juntas, 5S
 *   y mantenimiento planeado de cada turno. Una estación sigue el ritmo del cliente si su tiempo de ciclo no pasa del takt.
 *   Balancear es repartir el contenido de trabajo para acercar todas las estaciones al takt sin rebasarlo: la plantilla calcula
 *   los operadores mínimos (⌈contenido ÷ takt⌉) y la eficiencia de balanceo (contenido ÷ (n × tiempo de ciclo máximo)).
 *   Opcionales: la demanda anterior (la guía compara 67.5 s con 56.25 s), el pitch (takt × cantidad por contenedor), el reparto
 *   del takt con el PCE (lectura de §1) y el tiempo que libera el SMED en el cambio de modelo (ej. 3).
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Diferencias con la plantilla: añade la demanda semanal, la comparación con la demanda anterior, la holgura de cada estación en
 * segundos y las dos cifras de la guía (PCE × takt y SMED), que la plantilla no trae.
 *
 * Presets: la línea de arneses de la guía (450 min y 2,400 piezas por semana: 56.25 s frente a 67.5 s), el ejercicio 1 (60 s),
 * el ejercicio 3 (37.5 min por turno), el reparto del takt con el PCE de §1 (15.36 s de valor agregado) y las seis estaciones de la plantilla (54.375 s).
 */
import { ahorroSmed, balancearEstaciones, demandaDiaria, ritmoCliente, tiempoNeto, valorEnTakt } from '../js/lib/mejorar.js';
import { corto, entero, pct, plural } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';
import { etiquetaH, lineaH, trazaBarras } from '../js/lib/graficas.js';

const MAX_ESTACIONES = 12;
const ETIQUETA_OSCURA = { color: '#0a1011', size: 11 };
const finito = Number.isFinite;

const EST_EXCEL = [
  { estacion: 'Corte y pelado', tc: 0.4 },
  { estacion: 'Crimpado', tc: 0.7 },
  { estacion: 'Ensamble A', tc: 0.85 },
  { estacion: 'Ensamble B', tc: 0.8 },
  { estacion: 'Apriete y verificación', tc: 0.9 },
  { estacion: 'Prueba eléctrica', tc: 0.6 },
];

/** Estado de la guía (M8 §1): un turno de 8 h con 30 min de descanso y 2,400 arneses por semana en 5 días. */
const BASE = {
  minTurno: 480, turnos: 1, descansos: 30, paros: 0,
  demanda: 2400, periodo: 'semana', diasSemana: 5, demandaAnterior: NaN, contenedor: NaN,
  estaciones: [],
  pce: NaN, cambioMin: NaN, reduccionSmed: NaN, cambiosTurno: NaN,
};

const UMBRAL = {
  titulo: 'Cómo leer el takt y el balanceo (guía M8 §1 y plantilla «Takt Time»)',
  filas: [
    { rango: 'Takt', texto: 'tiempo neto ÷ demanda: cada cuántos minutos consume el cliente una unidad; el tiempo neto ya descuenta descansos, juntas, 5S y mantenimiento planeado de cada turno' },
    { rango: 'Ciclo ≤ takt', texto: 'la estación sigue el ritmo del cliente (la plantilla la marca «OK»)' },
    { rango: 'Ciclo > takt', texto: 'la estación no sigue el ritmo del cliente aunque nunca se detenga («Excede takt»): reparte su trabajo, quítale desperdicio o duplícala' },
    { rango: 'Operadores', texto: '⌈contenido ÷ takt⌉: mínimo teórico para cubrir el contenido de trabajo al ritmo del cliente con el trabajo repartido sin sobrantes' },
    { rango: 'Eficiencia', texto: 'contenido ÷ (n × ciclo máximo): qué parte del tiempo que impone la estación más lenta se usa trabajando; 100 % es una línea perfectamente balanceada' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto del método',
  texto:
    'El takt supone una demanda estable y un día de trabajo típico: si la demanda o los turnos cambian, el takt cambia y la línea debe poder moverse con él. ' +
    'Los tiempos de ciclo son por unidad y de cada estación, medidos y no de diseño; el lead time de punta a punta se estudia con el VSM (LAB 20). ' +
    'Los operadores mínimos y la eficiencia de balanceo suponen que el trabajo se puede repartir sin límite entre las estaciones, lo que en la práctica frenan las herramientas, la secuencia y las habilidades. ' +
    'PCE × takt (lectura de la sección 1 de la guía) es una lectura aproximada: reparte el takt con la proporción del PCE, que se define sobre el lead time. El ejercicio 4 del módulo 8 calcula el PCE donde corresponde, sobre el lead time del flujo (LAB 20).',
};

const recorta = (texto, n = 30) => (texto.length > n ? `${texto.slice(0, n - 1)}…` : texto);
const conSigno = (x, dec = 3) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${corto(Math.abs(x), dec)}`;
const turnosTexto = (n) => `${corto(n, 2)} ${n === 1 ? 'turno' : 'turnos'}`;

export default function lab21() {
  return {
    id: 'lab21',
    numero: '21',
    modulo: 'M8',
    titulo: 'Takt time y balanceo de estaciones',
    resumen: 'Calcula el takt a partir del tiempo neto y la demanda, compáralo con el tiempo de ciclo de cada estación y obtén los operadores mínimos, la eficiencia de balanceo, el pitch y el tiempo que libera el SMED.',
    entradas: [
      { tipo: 'seccion', etiqueta: 'Tiempo disponible' },
      { id: 'minTurno', tipo: 'numero', etiqueta: 'Minutos por turno', valor: BASE.minTurno, min: 0, marcador: 'p. ej. 480' },
      { id: 'turnos', tipo: 'numero', etiqueta: 'Turnos por día', valor: BASE.turnos, min: 0, marcador: 'p. ej. 1' },
      { id: 'descansos', tipo: 'numero', etiqueta: 'Descansos planeados por turno (min)', valor: BASE.descansos, min: 0, marcador: 'p. ej. 30' },
      { id: 'paros', tipo: 'numero', etiqueta: 'Juntas, 5S y mantenimiento planeado por turno (min)', valor: BASE.paros, min: 0, marcador: 'p. ej. 15', ayuda: 'Tiempo del turno que se dedica a algo distinto de producir. Se resta en cada turno.' },
      { tipo: 'seccion', etiqueta: 'Demanda del cliente' },
      { id: 'demanda', tipo: 'numero', etiqueta: 'Demanda (unidades)', valor: BASE.demanda, min: 0, marcador: 'p. ej. 2400' },
      {
        id: 'periodo', tipo: 'opcion', etiqueta: 'La demanda es…', valor: BASE.periodo,
        opciones: [{ valor: 'dia', texto: 'por día' }, { valor: 'semana', texto: 'por semana' }],
      },
      { id: 'diasSemana', tipo: 'numero', etiqueta: 'Días de operación por semana', valor: BASE.diasSemana, min: 0, marcador: 'p. ej. 5', visibleSi: (e) => e.periodo === 'semana' },
      { id: 'demandaAnterior', tipo: 'numero', etiqueta: 'Opcional · demanda anterior (mismo periodo)', valor: NaN, min: 0, marcador: 'p. ej. 2000', ayuda: 'Compara el takt de antes con el de ahora. En la guía el pedido pasa de 2,000 a 2,400 por semana.' },
      { id: 'contenedor', tipo: 'numero', etiqueta: 'Opcional · cantidad por contenedor', valor: NaN, min: 0, marcador: 'p. ej. 50', ayuda: 'Pitch = takt × cantidad por contenedor: cada cuántos minutos se retira o se entrega un contenedor.' },
      { tipo: 'seccion', etiqueta: 'Opcional · estaciones de la línea' },
      {
        id: 'estaciones', tipo: 'tabla', etiqueta: 'Estaciones en el orden del flujo',
        columnas: [
          { id: 'estacion', etiqueta: 'Estación', tipo: 'texto', ancho: '170px' },
          { id: 'tc', etiqueta: 'Ciclo (min/unidad)', tipo: 'numero', min: 0, ancho: '110px', ayuda: 'Tiempo de ciclo: minutos que tarda la estación por unidad.' },
        ],
        filas: BASE.estaciones, filaNueva: { estacion: '', tc: NaN }, minFilas: 0, maxFilas: MAX_ESTACIONES,
        ayuda: 'Una fila por estación. Con el takt verás cuáles lo cumplen y con la más lenta, qué tan balanceada está la línea.',
      },
      { tipo: 'seccion', etiqueta: 'Opcional · PCE y cambio de modelo' },
      { id: 'pce', tipo: 'numero', etiqueta: 'PCE de la línea (%)', valor: NaN, min: 0, max: 100, marcador: 'p. ej. 27.3', ayuda: 'Eficiencia del ciclo del proceso, del VSM (LAB 20). Reparte el takt en valor agregado y desperdicio, como lo plantea la sección 1 de la guía.' },
      { id: 'cambioMin', tipo: 'numero', etiqueta: 'Tiempo del cambio de modelo (min)', valor: NaN, min: 0, marcador: 'p. ej. 25' },
      { id: 'reduccionSmed', tipo: 'numero', etiqueta: 'Reducción con SMED (%)', valor: NaN, min: 0, max: 100, marcador: 'p. ej. 50', ayuda: 'La guía toma 50 % como la reducción típica más conservadora.' },
      { id: 'cambiosTurno', tipo: 'numero', etiqueta: 'Cambios de modelo por turno', valor: NaN, min: 0, marcador: 'p. ej. 3' },
    ],
    presets: [
      {
        id: 'guia', etiqueta: 'Guía M8 §1: 2,400 arneses por semana (56.25 s)',
        ayuda: 'Un turno de 8 h con 30 min de descanso (450 min), 5 días a la semana. El pedido sube de 2,000 a 2,400 por semana: el takt baja de 67.5 s a 56.25 s.',
        valores: { ...BASE, demandaAnterior: 2000 },
      },
      {
        id: 'ej1', etiqueta: 'Guía M8 ej. 1: dos turnos de 7 h y 5,040 piezas (60 s)',
        ayuda: 'Dos turnos de 7 horas efectivas, 6 días a la semana y 5,040 piezas por semana: 5,040 min ÷ 5,040 piezas = 1 min = 60 s.',
        valores: { ...BASE, minTurno: 420, turnos: 2, descansos: 0, paros: 0, demanda: 5040, diasSemana: 6 },
      },
      {
        id: 'ej3', etiqueta: 'Guía M8 ej. 3: SMED de 25 min con 3 cambios por turno',
        ayuda: 'Un cambio de modelo de 25 min baja 50 % con SMED y ocurre 3 veces por turno: libera 37.5 min por turno.',
        valores: { ...BASE, cambioMin: 25, reduccionSmed: 50, cambiosTurno: 3 },
      },
      {
        id: 'pce', etiqueta: 'Guía M8 §1: takt de 56.25 s y PCE de 27.3 %',
        ayuda: 'Con el takt de la línea de arneses y el PCE del módulo 4, 15.36 s de cada takt son valor agregado y 40.89 s son desperdicio. Es una lectura aproximada: el PCE se define sobre el lead time (ejercicio 4, en el LAB 20).',
        valores: { ...BASE, pce: 27.3 },
      },
      {
        id: 'excel', etiqueta: 'Plantilla Excel «Takt Time»: seis estaciones (54.375 s)',
        ayuda: '480 min por turno con 30 de descanso y 15 de juntas, 5S y mantenimiento (435 min netos) y 480 unidades por día; contenedores de 50 unidades.',
        valores: { ...BASE, paros: 15, demanda: 480, periodo: 'dia', contenedor: 50, estaciones: EST_EXCEL },
      },
    ],
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿Qué pasa con el takt si la demanda sube 20 % y no cambias turnos ni descansos? ¿Qué estaciones dejarían de cumplirlo?',
      '¿Qué estación marca el ritmo de la línea? Si le quitaras 0.1 min de trabajo y lo repartieras entre las demás, ¿cuánto sube la eficiencia de balanceo?',
      'El tiempo neto descuenta descansos, juntas, 5S y mantenimiento planeado: ¿cuáles de esos minutos recuperarías sin afectar la seguridad ni la calidad, y cuáles son una inversión?',
      'Si el tiempo de ciclo de una estación casi iguala el takt, ¿qué margen le queda ante un paro corto o un retrabajo? ¿Cómo la protegerías?',
      '¿Cuántas estaciones tiene hoy tu línea y cuántos operadores indica el cálculo? ¿Qué impide repartir el trabajo tan parejo como supone la fórmula?',
    ],

    calcular(e) {
      const d = finito(e.descansos) ? e.descansos : 0;
      const p = finito(e.paros) ? e.paros : 0;
      const neto = tiempoNeto({ minTurno: e.minTurno, turnos: e.turnos, descansos: e.descansos, paros: e.paros });
      const dia = demandaDiaria(e.demanda, e.periodo, e.diasSemana);
      const ritmo = ritmoCliente({ neto, demanda: dia, contenedor: e.contenedor });
      const t = ritmo.takt;
      const hayTakt = t > 0;
      const est = balancearEstaciones(e.estaciones, t);
      const smed = ahorroSmed({ cambio: e.cambioMin, reduccion: e.reduccionSmed, cambiosTurno: e.cambiosTurno });
      const haySmed = finito(smed.porTurno);

      const aviso = [];
      if (!hayTakt && (finito(e.demanda) || finito(e.minTurno) || finito(e.turnos))) {
        if (!(e.minTurno > 0) || !(e.turnos > 0)) aviso.push('Para el takt captura los minutos por turno y los turnos por día, ambos mayores que cero.');
        else if (!finito(neto)) aviso.push(`Los descansos y paros por turno (${corto(d + p, 1)} min) igualan o superan el turno de ${corto(e.minTurno, 1)} min, o son negativos: no queda tiempo disponible.`);
        else if (e.periodo === 'semana' && e.demanda > 0 && !(e.diasSemana > 0)) aviso.push('Captura los días de operación por semana, mayor que cero.');
        else aviso.push('Captura la demanda del cliente, mayor que cero.');
      }
      let anterior = null;
      let diaAnterior = NaN;
      if (finito(e.demandaAnterior)) {
        diaAnterior = demandaDiaria(e.demandaAnterior, e.periodo, e.diasSemana);
        if (!(diaAnterior > 0)) aviso.push('La demanda anterior debe ser mayor que cero para comparar el takt.');
        else if (hayTakt) anterior = ritmoCliente({ neto, demanda: diaAnterior });
      }
      if (finito(e.contenedor) && !(e.contenedor > 0)) aviso.push('La cantidad por contenedor debe ser mayor que cero para calcular el pitch.');
      const hayPce = finito(e.pce);
      if (hayPce && !(e.pce >= 0 && e.pce <= 100)) aviso.push('El PCE debe estar entre 0 y 100 %.');
      const vt = hayPce && hayTakt && e.pce >= 0 && e.pce <= 100 ? valorEnTakt(e.pce / 100, ritmo.segundos) : null;
      if (hayPce && e.pce >= 0 && e.pce <= 100 && !hayTakt) aviso.push('Para repartir el takt con el PCE falta el takt (tiempo disponible y demanda).');
      if ([e.cambioMin, e.reduccionSmed, e.cambiosTurno].some(finito) && !haySmed) {
        aviso.push('Para el SMED captura el tiempo del cambio (mayor que cero), la reducción (de 0 a 100 %) y los cambios por turno (0 o más).');
      }
      if (est.descartadas) aviso.push(`${plural(est.descartadas, 'fila')} sin un tiempo de ciclo mayor que cero ${est.descartadas === 1 ? 'no se contó' : 'no se contaron'}.`);

      if (!hayTakt && !est.valido && !haySmed) {
        return {
          aviso,
          vacio: 'Captura el tiempo disponible y la demanda para calcular el takt, o las estaciones para ver su balance.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Sin datos suficientes para el takt ni para el balanceo.' }],
        };
      }

      /* ---- salidas ---- */
      const salidas = [];
      const porTurnoNeto = finito(neto) ? neto / e.turnos : NaN;
      if (hayTakt) {
        salidas.push(
          { id: 'takt', etiqueta: 'Takt time', valor: `${corto(t, 5)} min`, color: 'teal', nota: `${corto(ritmo.segundos, 3)} s por unidad · ${corto(neto, 2)} min ÷ ${corto(dia, 2)} unidades` },
          { id: 'neto', etiqueta: 'Tiempo neto disponible', valor: `${corto(neto, 2)} min por día`, nota: `${turnosTexto(e.turnos)} × (${corto(e.minTurno, 1)} − ${corto(d, 1)} − ${corto(p, 1)}) min` }
        );
        if (e.periodo === 'semana') salidas.push({ id: 'demanda-dia', etiqueta: 'Demanda por día', valor: `${corto(dia, 2)} unidades`, nota: `${corto(e.demanda, 2)} por semana ÷ ${corto(e.diasSemana, 2)} días` });
        salidas.push({ id: 'por-hora', etiqueta: 'Unidades por hora requeridas', valor: corto(ritmo.porHora, 2), nota: `${corto(dia, 2)} unidades en ${corto(neto / 60, 2)} h netas` });
        if (finito(ritmo.pitch)) salidas.push({ id: 'pitch', etiqueta: 'Pitch', valor: `${corto(ritmo.pitch, 4)} min`, nota: `${corto(e.contenedor, 2)} unidades × ${corto(t, 5)} min` });
        if (anterior) {
          const dif = ritmo.segundos - anterior.segundos;
          salidas.push(
            { id: 'takt-anterior', etiqueta: 'Takt con la demanda anterior', valor: `${corto(anterior.segundos, 3)} s`, nota: `${corto(anterior.takt, 5)} min · ${corto(diaAnterior, 2)} unidades por día` },
            { id: 'cambio-takt', etiqueta: 'Cambio del takt', valor: `${conSigno(dif)} s`, color: dif < 0 ? 'coral' : 'teal', nota: `${conSigno(dif / anterior.segundos * 100, 1)} % por unidad · demanda ${conSigno((dia / diaAnterior - 1) * 100, 1)} %` }
          );
        }
        if (vt) {
          salidas.push(
            { id: 'va-takt', etiqueta: 'Valor agregado dentro del takt', valor: `${corto(vt.va, 2)} s`, color: 'teal', nota: `PCE ${corto(e.pce, 2)} % × ${corto(ritmo.segundos, 3)} s` },
            { id: 'desperdicio-takt', etiqueta: 'Desperdicio dentro del takt', valor: `${corto(vt.desperdicio, 2)} s`, color: 'coral', nota: `${corto(ritmo.segundos, 3)} − ${corto(vt.va, 2)} s` }
          );
        }
      }
      if (est.valido) {
        const n = est.filas.length;
        const nombreLenta = est.lenta.estacion || `Estación ${est.lenta.indice}`;
        salidas.push({ id: 'contenido', etiqueta: 'Contenido de trabajo total', valor: `${corto(est.contenido, 3)} min`, nota: `por unidad, en ${plural(n, 'estación', 'estaciones')}` });
        if (hayTakt) {
          salidas.push({ id: 'operadores', etiqueta: 'Operadores mínimos', valor: entero(est.operadores), nota: `⌈${corto(est.contenido, 3)} ÷ ${corto(t, 5)}⌉ · hay ${plural(n, 'estación', 'estaciones')}` });
        }
        salidas.push({ id: 'eficiencia', etiqueta: 'Eficiencia de balanceo', valor: pct(est.eficiencia, 1), color: 'teal', nota: `${corto(est.contenido, 3)} ÷ (${n} × ${corto(est.lenta.tc, 3)})` });
        if (hayTakt) {
          salidas.push({
            id: 'exceden', etiqueta: 'Estaciones que exceden el takt', valor: entero(est.exceden.length), color: est.exceden.length ? 'coral' : 'teal',
            nota: est.exceden.length ? `de ${n}: no siguen el ritmo del cliente` : `ninguna de ${n}`,
          });
        }
        salidas.push({
          id: 'lenta', etiqueta: 'Estación más lenta', valor: nombreLenta, pequeno: true, ancha: true,
          nota: `${corto(est.lenta.tc, 3)} min por unidad${hayTakt ? ` · ${pct(est.lenta.uso, 1)} del takt · capacidad de ${entero(neto / est.lenta.tc)} unidades por día` : ''}`,
        });
      }
      if (haySmed) {
        salidas.push(
          { id: 'ahorro-cambio', etiqueta: 'Ahorro por cambio de modelo', valor: `${corto(smed.porCambio, 2)} min`, nota: `de ${corto(e.cambioMin, 2)} a ${corto(smed.nuevo, 2)} min · ${corto(e.reduccionSmed, 1)} % menos` },
          {
            id: 'ahorro-turno', etiqueta: 'Tiempo liberado por turno', valor: `${corto(smed.porTurno, 2)} min`, color: 'teal',
            nota: `${corto(smed.porCambio, 2)} × ${corto(e.cambiosTurno, 2)} cambios${finito(porTurnoNeto) ? ` · ${pct(smed.porTurno / porTurnoNeto, 1)} del tiempo neto del turno` : ''}`,
          }
        );
      }

      /* ---- semáforos ---- */
      const semaforos = [];
      if (hayTakt) {
        semaforos.push({
          nombre: 'Takt', estado: 'informativo',
          texto: `El cliente consume una unidad cada ${corto(ritmo.segundos, 3)} s (${corto(t, 5)} min): ${corto(dia, 2)} unidades en ${corto(neto, 2)} min netos. Cada estación debe terminar su trabajo en ese tiempo o menos.`,
        });
      }
      if (anterior) {
        const sube = dia > diaAnterior;
        const igual = Math.abs(dia - diaAnterior) < 1e-9;
        const dif = Math.abs(ritmo.segundos - anterior.segundos);
        semaforos.push({
          nombre: 'Cambio de demanda', estado: 'informativo',
          texto: igual
            ? `La demanda no cambia: el takt sigue en ${corto(ritmo.segundos, 3)} s por unidad.`
            : `La demanda ${sube ? 'sube' : 'baja'} ${pct(Math.abs(dia / diaAnterior - 1), 1)} y el takt pasa de ${corto(anterior.segundos, 3)} s a ${corto(ritmo.segundos, 3)} s (${corto(dif, 3)} s ${sube ? 'menos' : 'más'} por unidad). ${sube ? 'Con los mismos turnos y el mismo personal, la línea debe producir más rápido: la guía propone subir el PCE eliminando desperdicio y no pedirle más velocidad a los operadores.' : 'La línea tiene más tiempo por unidad: revisa si conviene rebalancear con menos operadores o conservar la holgura.'}`,
        });
      }
      if (est.valido && hayTakt) {
        const m = est.lenta;
        if (est.exceden.length) {
          const lista = est.exceden.map((f) => `«${recorta(f.estacion || `estación ${f.indice}`, 24)}» (${corto(f.tc, 3)} min)`).join(', ');
          semaforos.push({ nombre: 'Cumplimiento del takt', estado: 'critico', texto: `${plural(est.exceden.length, 'estación', 'estaciones')} con tiempo de ciclo mayor que el takt de ${corto(t, 5)} min: ${lista}. No siguen el ritmo del cliente; la línea entrega como máximo ${entero(neto / m.tc)} unidades por día frente a las ${corto(dia, 2)} que se piden.` });
        } else {
          const holgura = (t - m.tc) * 60;
          semaforos.push({ nombre: 'Cumplimiento del takt', estado: 'cumple', texto: `Ninguna estación excede el takt de ${corto(t, 5)} min. La más cargada, «${recorta(m.estacion || `estación ${m.indice}`, 30)}», usa ${pct(m.uso, 1)} del takt y le quedan ${corto(holgura, 3)} s de holgura por unidad; la capacidad de la línea es de ${entero(neto / m.tc)} unidades por día.` });
        }
      }
      if (est.valido) {
        const n = est.filas.length;
        semaforos.push({
          nombre: 'Balanceo', estado: 'informativo',
          texto: est.ocio < 1e-9
            ? `Todas las estaciones tardan lo mismo (${corto(est.lenta.tc, 3)} min): la línea está perfectamente balanceada, con eficiencia de 100 %.`
            : `La estación más lenta (${corto(est.lenta.tc, 3)} min) marca el ritmo y las demás esperan: de los ${corto(n * est.lenta.tc, 3)} min por unidad que ocupan las ${n} estaciones, ${corto(est.ocio, 3)} min son espera (eficiencia de ${pct(est.eficiencia, 1)}). Para subirla, reparte trabajo de «${recorta(est.lenta.estacion || `estación ${est.lenta.indice}`, 30)}» hacia estaciones con holgura.`,
        });
      }
      if (est.valido && hayTakt) {
        const n = est.filas.length;
        semaforos.push({
          nombre: 'Operadores mínimos', estado: 'informativo',
          texto: `Con ${corto(est.contenido, 3)} min de contenido de trabajo y un takt de ${corto(t, 5)} min hacen falta al menos ${est.operadores} operadores si el trabajo se repartiera sin sobrantes. ${n > est.operadores ? `Hoy hay ${n} estaciones: existe margen para rebalancear, aunque repartir el trabajo sin sobrantes rara vez es posible.` : n === est.operadores ? 'Hoy hay justo ese número de estaciones.' : `Hoy hay solo ${n} estaciones: aunque el trabajo se repartiera perfecto no se alcanzaría el takt; hay que reducir contenido de trabajo o agregar capacidad.`}`,
        });
      }
      if (vt) {
        semaforos.push({
          nombre: 'PCE y takt', estado: 'informativo',
          texto: `De cada ${corto(ritmo.segundos, 3)} s del takt, ${corto(vt.va, 2)} s son valor agregado (PCE de ${corto(e.pce, 2)} %) y ${corto(vt.desperdicio, 2)} s son desperdicio: la oportunidad de mejora. Es la lectura de la guía; el PCE se define sobre el lead time del flujo, así que úsalo como proporción y no como medición.`,
        });
      }
      if (haySmed) {
        semaforos.push({
          nombre: 'Cambio de modelo (SMED)', estado: 'informativo',
          texto: `Bajar el cambio de ${corto(e.cambioMin, 2)} a ${corto(smed.nuevo, 2)} min libera ${corto(smed.porTurno, 2)} min por turno${finito(porTurnoNeto) ? ` (${pct(smed.porTurno / porTurnoNeto, 1)} del tiempo neto)` : ''}: tiempo de producción recuperado sin comprar equipo (guía M8 §5).`,
        });
      }

      const umbral = {
        ...UMBRAL,
        filas: UMBRAL.filas.map((x, i) => ({
          ...x,
          activa: [
            hayTakt,
            est.valido && hayTakt && est.exceden.length < est.filas.length,
            est.valido && hayTakt && est.exceden.length > 0,
            est.valido && hayTakt,
            est.valido,
          ][i],
        })),
      };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Comprueba que la demanda sea la que el cliente consume y no la que la planta produce, y que los tiempos de ciclo sean medidos.' };

      /* ---- gráficas ---- */
      const graficas = [];
      if (est.valido) {
        const nombres = est.filas.map((f, i) => `${i + 1}. ${recorta(f.estacion || `Estación ${f.indice}`, 22)}`);
        const maxTc = est.lenta.tc;
        const techo = Math.max(maxTc, hayTakt ? t : 0) * 1.22;
        graficas.push({
          id: 'estaciones', titulo: hayTakt ? 'Tiempo de ciclo de cada estación frente al takt (min por unidad)' : 'Tiempo de ciclo de cada estación (min por unidad)', ancha: true, alta: est.filas.length > 8,
          datos: [{
            ...trazaBarras(nombres, est.filas.map((f) => f.tc), {
              colores: est.filas.map((f) => (f.excede ? COLOR.coral : hayTakt ? COLOR.teal : COLOR.azul)),
              texto: est.filas.map((f) => corto(f.tc, 3)), mostrarLeyenda: false,
            }),
            textposition: 'inside', insidetextanchor: 'end', insidetextfont: ETIQUETA_OSCURA,
          }],
          layout: {
            bargap: 0.35,
            xaxis: { automargin: true },
            yaxis: { title: { text: 'minutos por unidad' }, range: [0, techo] },
            shapes: hayTakt ? [lineaH(t, COLOR.ambar)] : [],
            annotations: hayTakt ? [etiquetaH(t, `takt ${corto(t, 5)} min`, COLOR.ambar, { x: 0 , ancla: 'left' })] : [],
          },
          respaldo: {
            columnas: hayTakt ? ['Estación', 'Tiempo de ciclo (min)', 'Utilización vs takt'] : ['Estación', 'Tiempo de ciclo (min)'],
            filas: est.filas.map((f, i) => (hayTakt ? [nombres[i], corto(f.tc, 3), pct(f.uso, 1)] : [nombres[i], corto(f.tc, 3)])),
          },
        });
        const chico = (v) => v < 0.07 * maxTc;
        graficas.push({
          id: 'balance', titulo: 'Trabajo y espera de cada estación frente a la más lenta (min por unidad)', ancha: true, alta: est.filas.length > 8,
          datos: [
            { ...trazaBarras(nombres, est.filas.map((f) => f.tc), { nombre: 'Trabajo', color: COLOR.teal, texto: est.filas.map((f) => (chico(f.tc) ? '' : corto(f.tc, 3))) }), textposition: 'inside', insidetextfont: ETIQUETA_OSCURA },
            { ...trazaBarras(nombres, est.filas.map((f) => maxTc - f.tc), { nombre: 'Espera a la más lenta', color: COLOR.gris, texto: est.filas.map((f) => (chico(maxTc - f.tc) ? '' : corto(maxTc - f.tc, 3))) }), textposition: 'inside', insidetextfont: ETIQUETA_OSCURA },
          ],
          layout: { barmode: 'stack', bargap: 0.35, xaxis: { automargin: true }, yaxis: { title: { text: 'minutos por unidad' }, rangemode: 'tozero' } },
          respaldo: {
            columnas: ['Estación', 'Trabajo (min)', 'Espera a la más lenta (min)'],
            filas: est.filas.map((f, i) => [nombres[i], corto(f.tc, 3), corto(maxTc - f.tc, 3)]),
          },
        });
      }

      /* ---- tablas ---- */
      const tablas = [];
      if (hayTakt) {
        const celda = (x, formula = true) => ({ texto: x, num: true, formula });
        tablas.push({
          titulo: 'Del tiempo disponible al takt',
          columnas: ['Concepto', { t: 'Valor', num: true }],
          filas: [
            ['Minutos por turno', celda(corto(e.minTurno, 2), false)],
            ['− Descansos planeados por turno', celda(corto(d, 2), false)],
            ['− Juntas, 5S y mantenimiento planeado por turno', celda(corto(p, 2), false)],
            ['= Tiempo neto por turno (min)', celda(corto(porTurnoNeto, 2))],
            ['× Turnos por día', celda(corto(e.turnos, 2), false)],
            ['= Tiempo neto por día (min)', celda(corto(neto, 2))],
            [e.periodo === 'semana' ? `Demanda por día (${corto(e.demanda, 2)} ÷ ${corto(e.diasSemana, 2)} días)` : 'Demanda por día (unidades)', celda(corto(dia, 2), e.periodo === 'semana')],
            ['Takt time (min por unidad)', celda(corto(t, 5))],
            ['Takt time (s por unidad)', celda(corto(ritmo.segundos, 3))],
          ],
          resaltar: [7, 8],
          pie: `Takt = ${corto(neto, 2)} ÷ ${corto(dia, 2)} = ${corto(t, 5)} min = ${corto(ritmo.segundos, 3)} s.`,
        });
      }
      if (anterior) {
        const celda = (x, formula = false) => ({ texto: x, num: true, formula });
        tablas.push({
          titulo: 'Takt con la demanda anterior y la actual',
          columnas: ['', { t: 'Demanda por día', num: true }, { t: 'Takt (min)', num: true }, { t: 'Takt (s)', num: true }],
          filas: [
            ['Anterior', celda(corto(diaAnterior, 2)), celda(corto(anterior.takt, 5), true), celda(corto(anterior.segundos, 3), true)],
            ['Actual', celda(corto(dia, 2)), celda(corto(t, 5), true), celda(corto(ritmo.segundos, 3), true)],
            ['Cambio', celda(conSigno(dia - diaAnterior, 2), true), celda(conSigno(t - anterior.takt, 5), true), celda(conSigno(ritmo.segundos - anterior.segundos), true)],
          ],
          resaltar: [2],
        });
      }
      if (est.valido) {
        const celda = (x, formula = false) => ({ texto: x, num: true, formula });
        const filas = est.filas.map((f) => {
          const nombre = recorta(f.estacion || `Estación ${f.indice}`, 40);
          if (!hayTakt) return [nombre, celda(corto(f.tc, 3)), celda(pct(f.tc / est.lenta.tc, 1), true)];
          return [
            nombre, celda(corto(f.tc, 3)), celda(pct(f.uso, 1), true),
            { texto: f.excede ? 'Excede takt' : 'OK', num: false, estado: f.excede ? 'critico' : 'cumple' },
            celda(conSigno((t - f.tc) * 60, 3), true),
          ];
        });
        const total = hayTakt ? ['Contenido total', celda(corto(est.contenido, 3), true), '', '', ''] : ['Contenido total', celda(corto(est.contenido, 3), true), ''];
        tablas.push({
          titulo: hayTakt ? 'Estaciones frente al takt' : 'Estaciones frente a la más lenta',
          columnas: hayTakt
            ? ['Estación', { t: 'Ciclo (min)', num: true }, { t: 'Utilización vs takt', num: true }, '¿Cumple takt?', { t: 'Holgura (s)', num: true }]
            : ['Estación', { t: 'Ciclo (min)', num: true }, { t: '% de la más lenta', num: true }],
          filas: [...filas, total], resaltar: [filas.length],
          pie: `Utilización = ciclo ÷ takt; holgura = (takt − ciclo) × 60. Contenido = ${corto(est.contenido, 3)} min${hayTakt ? ` · operadores mínimos = ⌈${corto(est.contenido, 3)} ÷ ${corto(t, 5)}⌉ = ${est.operadores}` : ''} · eficiencia de balanceo = ${corto(est.contenido, 3)} ÷ (${est.filas.length} × ${corto(est.lenta.tc, 3)}) = ${pct(est.eficiencia, 1)}.`,
        });
      }

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
