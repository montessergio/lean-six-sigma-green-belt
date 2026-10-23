/**
 * LAB 11 · Tamaño de muestra
 *
 * Guía: M4 §4 (cuántas unidades medir) y plantilla Excel «Tamano de Muestra».
 *   A. Estimar una media con margen de error E:   n = (Z·σ ÷ E)²
 *   B. Estimar una proporción:                    n = Z²·p·(1 − p) ÷ E²
 *   C. Detectar una diferencia δ entre dos medias: n por grupo = 2·(Zα/2 + Zβ)²·σ² ÷ δ²
 *   Siempre se redondea hacia arriba. Con la población N conocida se corrige: n ÷ (1 + (n − 1) ÷ N).
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: los dos ejemplos de la guía (torque: 11.10 → 12 por turno; falla de continuidad: 456.17 → 457) y los de la
 * plantilla Excel (35 · 385 · 36 por grupo). La sección C del preset de la guía combina el σ del torque con δ = 0.02
 * y 80 % de potencia: es una comparación didáctica que la guía no calcula.
 */
import { muestraDosMedias, muestraMedia, muestraMediaT, muestraProporcion, subeEntero } from '../js/lib/medir.js';
import { corto, entero, num, plural } from '../js/core/format.js';
import { COLOR } from '../js/core/config.js';

const FACTORES = [0.5, 1, 1.5, 2, 3, 4]; // múltiplos de E de la tabla de sensibilidad (con E = 1 son los valores de la plantilla)

const UMBRAL = {
  titulo: 'Cómo leer el tamaño de muestra (guía M4 §4 y plantilla)',
  filas: [
    { rango: 'Redondeo', texto: 'siempre hacia arriba: 11.1 se convierte en 12, nunca en 11 (guía M4 §4)' },
    { rango: 'Margen de error E', texto: 'n crece con 1 ÷ E²: la mitad de margen pide cuatro veces la muestra (guía M4 §4: «más muestra cuanto más pequeño es el margen»)' },
    { rango: 'Variabilidad', texto: 'n crece con σ² en una media y con p·(1 − p) en una proporción, que es máximo en p = 50 % (guía M4 §4); sin estimación previa se usa p = 50 %' },
    { rango: 'Población finita N', texto: 'con N conocida n se corrige a n ÷ (1 + (n − 1) ÷ N); casi no cambia si N es grande frente a n (plantilla)' },
    { rango: 'n·p ≥ 10 y n·(1 − p) ≥ 10', texto: 'condición para usar la aproximación normal en una proporción (referencia didáctica; la guía no fija el corte)' },
  ],
};

const SUPUESTO = {
  titulo: 'Supuesto estadístico',
  texto:
    'Aproximación normal y muestra aleatoria (o estratificada), con unidades independientes. σ y p son estimaciones previas —un histórico o un piloto—: si el proceso real varía más, la muestra calculada se queda corta. ' +
    'La plantilla avisa que si σ viene de una muestra pequeña conviene «agregar 1 a 2 unidades de margen»; con t de Student el cálculo exacto lo confirma (referencia didáctica).',
};

/** Todo lo que sale en las tres secciones, para que cada preset fije todas las entradas. */
const entradasDe = (A, B, C) => ({
  confianzaA: A.confianza, sigma: A.sigma, margen: A.margen, unidad: A.unidad ?? '', poblacionA: A.poblacion ?? NaN, estratos: A.estratos ?? NaN,
  confianzaB: B.confianza, p: B.p, margenP: B.margenP, poblacionB: B.poblacion ?? NaN,
  confianzaC: C.confianza, potencia: C.potencia, sigmaC: C.sigma, delta: C.delta,
});

const fraccion = (pctX) => (Number.isFinite(pctX) ? pctX / 100 : NaN);
const tocada = (...v) => v.some((x) => Number.isFinite(x));

export default function lab11(ctx = {}) {
  const m = ctx.caso?.muestreo;
  const torque = m?.guia?.torque ?? { confianza: 95, sigma: 0.034, margen: 0.02, turnos: 3 };
  const falla = m?.guia?.falla ?? { confianza: 95, p: 5, margenP: 2 };
  const excel = m?.excel ?? { confianza: 95, sigma: 3, margen: 1, p: 50, margenP: 5, potencia: 80, delta: 2 };
  const factores = m?.excel?.sensibilidad?.length && excel.margen > 0 ? m.excel.sensibilidad.map((x) => x / excel.margen) : FACTORES;

  const guia = entradasDe(
    { confianza: torque.confianza, sigma: torque.sigma, margen: torque.margen, unidad: 'N·m', estratos: torque.turnos },
    { confianza: falla.confianza, p: falla.p, margenP: falla.margenP },
    { confianza: torque.confianza, potencia: excel.potencia, sigma: torque.sigma, delta: torque.margen }
  );
  const plantilla = entradasDe(
    { confianza: excel.confianza, sigma: excel.sigma, margen: excel.margen, unidad: 'N' },
    { confianza: excel.confianza, p: excel.p, margenP: excel.margenP },
    { confianza: excel.confianza, potencia: excel.potencia, sigma: excel.sigma, delta: excel.delta }
  );

  return {
    id: 'lab11',
    numero: '11',
    modulo: 'M4',
    titulo: 'Tamaño de muestra',
    resumen: 'Calcula cuántas unidades medir para estimar una media o una proporción con un margen de error, o para detectar una diferencia entre dos grupos, y mira cómo crece la muestra al exigir más precisión.',
    panelAncho: true,
    entradas: [
      { tipo: 'seccion', etiqueta: 'A · Estimar una media' },
      { id: 'confianzaA', tipo: 'numero', etiqueta: 'Nivel de confianza (%)', valor: guia.confianzaA, min: 50, max: 99.9, ayuda: 'Lo habitual es 95 %.' },
      { id: 'sigma', tipo: 'numero', etiqueta: 'Desviación estándar estimada σ', valor: guia.sigma, min: 0, ayuda: 'De un histórico o de un piloto, en la misma unidad que E.' },
      { id: 'margen', tipo: 'numero', etiqueta: 'Margen de error E', valor: guia.margen, min: 0, ayuda: 'Cuánto error aceptas al estimar la media, en la misma unidad que σ.' },
      { id: 'unidad', tipo: 'texto', etiqueta: 'Unidad de medida (opcional)', valor: guia.unidad, marcador: 'p. ej. N·m' },
      { id: 'poblacionA', tipo: 'numero', etiqueta: 'Tamaño de la población N (opcional)', valor: guia.poblacionA, min: 0, ayuda: 'Solo si la población es pequeña y conocida: corrige n a la baja.' },
      { id: 'estratos', tipo: 'numero', etiqueta: 'Estratos entre los que se reparte (opcional)', valor: guia.estratos, min: 0, ayuda: 'p. ej. 3 turnos: n es por turno y se muestra el total.' },
      { tipo: 'seccion', etiqueta: 'B · Estimar una proporción' },
      { id: 'confianzaB', tipo: 'numero', etiqueta: 'Nivel de confianza (%)', valor: guia.confianzaB, min: 50, max: 99.9 },
      { id: 'p', tipo: 'numero', etiqueta: 'Proporción esperada p (%)', valor: guia.p, min: 0, max: 100, ayuda: 'Sin ninguna estimación previa usa 50 %: es el caso que más muestra pide.' },
      { id: 'margenP', tipo: 'numero', etiqueta: 'Margen de error E (puntos porcentuales)', valor: guia.margenP, min: 0, max: 100, ayuda: 'p. ej. 2 significa ± 2 puntos.' },
      { id: 'poblacionB', tipo: 'numero', etiqueta: 'Tamaño de la población N (opcional)', valor: guia.poblacionB, min: 0 },
      { tipo: 'seccion', etiqueta: 'C · Detectar una diferencia entre dos medias' },
      { id: 'confianzaC', tipo: 'numero', etiqueta: 'Nivel de confianza (%)', valor: guia.confianzaC, min: 50, max: 99.9 },
      { id: 'potencia', tipo: 'numero', etiqueta: 'Potencia (%)', valor: guia.potencia, min: 50, max: 99.9, ayuda: 'Probabilidad de detectar la diferencia si existe de verdad. Lo habitual es 80 %.' },
      { id: 'sigmaC', tipo: 'numero', etiqueta: 'Desviación estándar σ', valor: guia.sigmaC, min: 0 },
      { id: 'delta', tipo: 'numero', etiqueta: 'Diferencia a detectar δ (misma unidad)', valor: guia.delta, min: 0, ayuda: 'La diferencia más pequeña entre dos grupos (p. ej. dos turnos) que quieres poder notar.' },
    ],
    presets: [
      {
        id: 'guia', etiqueta: 'Guía M4 §4: torque y falla de continuidad',
        ayuda: 'Torque (σ 0.034 N·m, E 0.02 N·m, 3 turnos): 11.10 → 12 por turno. Falla de continuidad de 5 % con E = 2 %: 456.17 → 457. La sección C usa el mismo σ con δ = 0.02 y 80 % de potencia: no aparece en la guía, sirve para compararla con la A.',
        valores: guia,
      },
      {
        id: 'excel', etiqueta: 'Plantilla Excel «Tamano de Muestra»',
        ayuda: 'σ 3 y E 1 → 35 · p 50 % y E 5 % → 385 · σ 3 y δ 2 con 80 % de potencia → 36 por grupo (72 en total). Con E = 0.5, 1, 1.5, 2, 3 y 4 la sensibilidad da 139, 35, 16, 9, 4 y 3.',
        valores: plantilla,
      },
    ],
    umbral: UMBRAL,
    supuesto: SUPUESTO,
    preguntas: [
      '¿De dónde sale el σ (o el p) que usaste: un histórico, un piloto o una corazonada? ¿Cuánto cambia n si el valor real resulta 20 % mayor?',
      'Si exiges la mitad del margen de error, ¿cuántas veces crece la muestra? Compruébalo en la tabla de sensibilidad y explica por qué no es una relación lineal.',
      '¿Cuántas mediciones por turno y cuántas en total puedes pagar en tiempo y dinero? ¿Qué margen de error alcanzas con ese presupuesto?',
      '¿Por qué conviene p = 50 % cuando no tienes una estimación previa? ¿Cuándo sería un desperdicio usarlo?',
      'La guía usa la fórmula de la media (sección A) para «detectar una diferencia de 0.02 N·m». ¿Qué cambia al usar la sección C con 80 % de potencia, y cuál de las dos responde de verdad a «¿difieren los turnos?»?',
    ],

    calcular(e) {
      const aviso = [];
      const unidad = String(e.unidad ?? '').trim();
      const u = unidad ? ` ${unidad}` : '';
      const salidas = [];
      const semaforos = [];
      const graficas = [];
      const filasCalculo = [];
      let sens = null; // filas de la tabla de sensibilidad (sección A)
      let alguna = false;
      const activa = { redondeo: false, margen: false, variabilidad: false, poblacion: false, normal: false };

      /* ------------------------------------------------------------ A */
      const hayA = tocada(e.sigma, e.margen, e.poblacionA, e.estratos);
      if (hayA) {
        const conf = fraccion(e.confianzaA);
        const sigma = e.sigma;
        const margen = e.margen;
        const probs = [];
        if (!(conf > 0 && conf < 1)) probs.push('el nivel de confianza debe estar entre 0 y 100 % (lo habitual es 95)');
        if (!(sigma > 0)) probs.push('σ debe ser mayor que cero');
        if (!(margen > 0)) probs.push('E debe ser mayor que cero');
        if (probs.length) {
          aviso.push(`Sección A: ${probs.join('; ')}.`);
        } else {
          const N = Number.isFinite(e.poblacionA) && e.poblacionA !== 0 ? e.poblacionA : NaN;
          const poblacionValida = Number.isFinite(N) && N >= 1 && Number.isInteger(N);
          if (Number.isFinite(N) && !poblacionValida) aviso.push('Sección A: N debe ser un entero positivo; se ignoró.');
          const pob = poblacionValida ? N : NaN;
          const r = muestraMedia({ confianza: conf, sigma, margen, poblacion: pob });
          const estr = e.estratos;
          const estrValido = Number.isFinite(estr) && estr >= 1 && Number.isInteger(estr);
          if (Number.isFinite(estr) && estr !== 0 && !estrValido) aviso.push('Sección A: los estratos deben ser un entero positivo; se ignoró.');
          alguna = true;
          activa.redondeo = true; activa.margen = true; activa.variabilidad = true;
          salidas.push(
            { id: 'a-z', etiqueta: 'A · Z de dos colas', valor: num(r.z, 3), nota: `confianza de ${corto(e.confianzaA, 2)} %` },
            { id: 'a-n-exacto', etiqueta: 'A · n sin redondear', valor: num(r.nInfinita, 2), nota: `(Z·σ ÷ E)² = (${num(r.z, 3)} × ${corto(sigma, 4)} ÷ ${corto(margen, 4)})²` },
            {
              id: 'a-n', etiqueta: 'A · n requerido', valor: entero(r.n), color: 'teal',
              nota: r.corregida ? `con población finita N = ${entero(pob)}: ${num(r.nAjustada, 2)} → ${entero(r.n)}` : `${num(r.nInfinita, 2)} redondeado hacia arriba`,
            }
          );
          if (estrValido) salidas.push({ id: 'a-total', etiqueta: 'A · Muestra total', valor: entero(r.n * estr), color: 'azul', nota: `${entero(r.n)} por estrato × ${plural(estr, 'estrato')}` });
          filasCalculo.push([
            'A · media', 'n = (Z·σ ÷ E)²', `Z ${num(r.z, 3)} · σ ${corto(sigma, 4)}${u} · E ${corto(margen, 4)}${u}`,
            { texto: `${num(r.nInfinita, 2)} → ${entero(subeEntero(r.nInfinita))}${r.corregida ? ` · con N: ${entero(r.n)}` : ''}`, num: true, formula: true },
          ]);
          if (r.corregida) {
            activa.poblacion = true;
            semaforos.push({
              nombre: 'A · Población finita', estado: 'informativo',
              texto: `Con N = ${entero(pob)} la muestra baja de ${entero(subeEntero(r.nInfinita))} a ${entero(r.n)}: n ÷ (1 + (n − 1) ÷ N).`,
            });
          }
          const t = muestraMediaT({ confianza: conf, sigma, margen });
          if (t.valido) {
            semaforos.push({
              nombre: 'A · σ de una muestra piloto', estado: 'informativo',
              texto: t.n > r.n && !r.corregida
                ? `Si σ se estimó con una muestra pequeña, con t de Student el mínimo sube de ${entero(r.n)} a ${entero(t.n)} (referencia didáctica). La plantilla lo resume con una regla práctica: «agrega 1 a 2 unidades de margen».`
                : `Con t de Student el mínimo sería ${entero(t.n)} (referencia didáctica; compara con el n que sale con Z).`,
            });
          }

          // Sensibilidad: n según el margen de error (múltiplos de tu E). «Veces» = (E ÷ Ei)², la regla 1 ÷ E² exacta.
          sens = factores.map((f) => {
            const Ei = f * margen;
            return { f, E: Ei, n: muestraMedia({ confianza: conf, sigma, margen: Ei, poblacion: pob }).n, veces: (margen / Ei) ** 2 };
          });
          graficas.push({
            id: 'sensibilidad', titulo: 'n requerido según el margen de error (sección A)',
            datos: [
              {
                type: 'scatter', mode: 'lines+markers+text', name: 'n requerido', x: sens.map((x) => x.E), y: sens.map((x) => x.n),
                text: sens.map((x) => entero(x.n)), textposition: 'top right', textfont: { color: COLOR.blanco, size: 11 },
                line: { color: COLOR.azul, width: 2 }, marker: { color: COLOR.azul, size: 7 },
                hovertemplate: 'E = %{x}<br>n = %{y}<extra></extra>',
              },
              {
                type: 'scatter', mode: 'markers', name: 'Tu margen E', x: [margen], y: [r.n],
                marker: { color: COLOR.teal, size: 13, symbol: 'diamond', line: { color: '#0a1011', width: 1 } },
                hovertemplate: 'E = %{x}<br>n = %{y}<extra></extra>',
              },
            ],
            layout: { xaxis: { title: { text: `margen de error E${unidad ? ` (${unidad})` : ''}` }, rangemode: 'tozero' }, yaxis: { title: { text: 'n requerido' }, rangemode: 'tozero' } },
            respaldo: {
              columnas: ['Margen de error E', 'n requerido', 'Veces el n con tu E'],
              filas: sens.map((x) => [corto(x.E, 4), entero(x.n), `× ${num(x.veces, 2)}`]),
            },
          });
        }
      }

      /* ------------------------------------------------------------ B */
      const hayB = tocada(e.p, e.margenP, e.poblacionB);
      if (hayB) {
        const conf = fraccion(e.confianzaB);
        const p = fraccion(e.p);
        const margenB = fraccion(e.margenP);
        const probs = [];
        if (!(conf > 0 && conf < 1)) probs.push('el nivel de confianza debe estar entre 0 y 100 %');
        if (!(p > 0 && p < 1)) probs.push('p debe estar entre 0 y 100 % (sin estimación previa usa 50)');
        if (!(margenB > 0)) probs.push('E debe ser mayor que cero');
        if (probs.length) {
          aviso.push(`Sección B: ${probs.join('; ')}.`);
        } else {
          const N = Number.isFinite(e.poblacionB) && e.poblacionB !== 0 ? e.poblacionB : NaN;
          const poblacionValida = Number.isFinite(N) && N >= 1 && Number.isInteger(N);
          if (Number.isFinite(N) && !poblacionValida) aviso.push('Sección B: N debe ser un entero positivo; se ignoró.');
          const pob = poblacionValida ? N : NaN;
          const r = muestraProporcion({ confianza: conf, p, margen: margenB, poblacion: pob });
          const peor = muestraProporcion({ confianza: conf, p: 0.5, margen: margenB, poblacion: pob });
          alguna = true;
          activa.redondeo = true; activa.margen = true; activa.variabilidad = true; activa.normal = true;
          const esperados = r.n * p;
          const noEsperados = r.n * (1 - p);
          salidas.push(
            { id: 'b-z', etiqueta: 'B · Z de dos colas', valor: num(r.z, 3), nota: `confianza de ${corto(e.confianzaB, 2)} %` },
            { id: 'b-n-exacto', etiqueta: 'B · n sin redondear', valor: num(r.nInfinita, 2), nota: `Z²·p·(1 − p) ÷ E² con p = ${corto(e.p, 2)} % y E = ${corto(e.margenP, 2)} %` },
            {
              id: 'b-n', etiqueta: 'B · n requerido', valor: entero(r.n), color: 'teal',
              nota: r.corregida ? `con población finita N = ${entero(pob)}: ${num(r.nAjustada, 2)} → ${entero(r.n)}` : `${num(r.nInfinita, 2)} redondeado hacia arriba`,
            },
            { id: 'b-n-peor', etiqueta: 'B · n si p = 50 %', valor: entero(peor.n), color: 'azul', nota: 'el caso que más muestra pide, con el mismo E y la misma confianza' }
          );
          filasCalculo.push([
            'B · proporción', 'n = Z²·p·(1 − p) ÷ E²', `Z ${num(r.z, 3)} · p ${corto(e.p, 2)} % · E ${corto(e.margenP, 2)} %`,
            { texto: `${num(r.nInfinita, 2)} → ${entero(subeEntero(r.nInfinita))}${r.corregida ? ` · con N: ${entero(r.n)}` : ''}`, num: true, formula: true },
          ]);
          if (r.corregida) activa.poblacion = true;
          semaforos.push(
            esperados >= 10 && noEsperados >= 10
              ? { nombre: 'B · Aproximación normal', estado: 'cumple', texto: `n·p = ${num(esperados, 2)} y n·(1 − p) = ${num(noEsperados, 2)}: ambos ≥ 10 (referencia didáctica).` }
              : { nombre: 'B · Aproximación normal', estado: 'atencion', texto: `n·p = ${num(esperados, 2)} y n·(1 − p) = ${num(noEsperados, 2)}: alguno queda bajo 10, la aproximación normal es pobre (referencia didáctica).` }
          );
          if (margenB >= p) {
            semaforos.push({
              nombre: 'B · Margen frente a p', estado: 'atencion',
              texto: `E = ${corto(e.margenP, 2)} % es igual o mayor que p = ${corto(e.p, 2)} %: el intervalo llegaría hasta 0 %. Para un evento raro, pide un margen menor que p (referencia didáctica).`,
            });
          }

          // n según la proporción esperada, con el mismo E y la misma confianza.
          const ps = Array.from({ length: 99 }, (_, i) => i + 1);
          const ns = ps.map((x) => muestraProporcion({ confianza: conf, p: x / 100, margen: margenB, poblacion: pob }).nAjustada);
          const claves = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99];
          graficas.push({
            id: 'proporcion', titulo: 'n requerido según la proporción esperada (sección B)',
            datos: [
              { type: 'scatter', mode: 'lines', name: 'n según p', x: ps, y: ns, line: { color: COLOR.azul, width: 2.2 }, hovertemplate: 'p = %{x} %<br>n = %{y:.0f}<extra></extra>' },
              {
                type: 'scatter', mode: 'markers', name: 'Tu p', x: [e.p], y: [r.n],
                marker: { color: COLOR.teal, size: 13, symbol: 'diamond', line: { color: '#0a1011', width: 1 } }, hovertemplate: 'p = %{x} %<br>n = %{y}<extra></extra>',
              },
              {
                type: 'scatter', mode: 'markers', name: 'Caso p = 50 %', x: [50], y: [peor.n],
                marker: { color: COLOR.coral, size: 11, symbol: 'circle', line: { color: '#0a1011', width: 1 } }, hovertemplate: 'p = %{x} %<br>n = %{y}<extra></extra>',
              },
            ],
            layout: { xaxis: { title: { text: 'proporción esperada p (%)' }, range: [0, 100] }, yaxis: { title: { text: 'n requerido' }, rangemode: 'tozero' } },
            respaldo: {
              columnas: ['p (%)', 'n requerido'],
              filas: claves.map((x) => [String(x), entero(muestraProporcion({ confianza: conf, p: x / 100, margen: margenB, poblacion: pob }).n)]),
            },
          });
        }
      }

      /* ------------------------------------------------------------ C */
      const hayC = tocada(e.sigmaC, e.delta);
      if (hayC) {
        const conf = fraccion(e.confianzaC);
        const pot = fraccion(e.potencia);
        const probs = [];
        if (!(conf > 0 && conf < 1)) probs.push('el nivel de confianza debe estar entre 0 y 100 %');
        if (!(pot > 0 && pot < 1)) probs.push('la potencia debe estar entre 0 y 100 % (lo habitual es 80)');
        if (!(e.sigmaC > 0)) probs.push('σ debe ser mayor que cero');
        if (!(e.delta > 0)) probs.push('δ debe ser mayor que cero');
        if (probs.length) {
          aviso.push(`Sección C: ${probs.join('; ')}.`);
        } else {
          const r = muestraDosMedias({ confianza: conf, potencia: pot, sigma: e.sigmaC, delta: e.delta });
          alguna = true;
          activa.redondeo = true; activa.variabilidad = true;
          salidas.push(
            { id: 'c-suma', etiqueta: 'C · Zα/2 + Zβ', valor: num(r.suma, 3), nota: `Zα/2 = ${num(r.za, 3)} (confianza ${corto(e.confianzaC, 2)} %) · Zβ = ${num(r.zb, 3)} (potencia ${corto(e.potencia, 2)} %)` },
            { id: 'c-n-grupo', etiqueta: 'C · n por grupo', valor: entero(r.nGrupo), color: 'teal', nota: `${num(r.nGrupoExacto, 2)} redondeado hacia arriba` },
            { id: 'c-n-total', etiqueta: 'C · n total (2 grupos)', valor: entero(r.nTotal), color: 'azul', nota: `2 × ${entero(r.nGrupo)}` }
          );
          filasCalculo.push([
            'C · dos medias', 'n por grupo = 2·(Zα/2 + Zβ)²·σ² ÷ δ²', `Zα/2 + Zβ ${num(r.suma, 3)} · σ ${corto(e.sigmaC, 4)}${u} · δ ${corto(e.delta, 4)}${u}`,
            { texto: `${num(r.nGrupoExacto, 2)} → ${entero(r.nGrupo)} por grupo (${entero(r.nTotal)})`, num: true, formula: true },
          ]);
          semaforos.push(
            pot >= 0.8
              ? { nombre: 'C · Potencia', estado: 'informativo', texto: `Con ${corto(e.potencia, 2)} % de potencia, si la diferencia real es de ${corto(e.delta, 4)}${u} la detectarías en ${corto(e.potencia, 2)} de cada 100 estudios iguales.` }
              : { nombre: 'C · Potencia', estado: 'atencion', texto: `Potencia de ${corto(e.potencia, 2)} %: bajo el 80 % habitual, fallarías en notar una diferencia real con frecuencia (referencia didáctica).` }
          );
        }
      }

      /* ---- sin nada que calcular ---- */
      if (!alguna) {
        return {
          aviso,
          vacio: 'Captura σ y E (sección A), p y E (sección B) o σ y δ (sección C) para calcular el tamaño de muestra.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: aviso.length ? 'Revisa los avisos de las secciones capturadas.' : 'Sin datos capturados.' }],
        };
      }

      /* ---- tablas ---- */
      const tablas = [
        {
          titulo: 'Cómo salió cada n',
          columnas: ['Sección', 'Fórmula', 'Datos', { t: 'Resultado', num: true }],
          filas: filasCalculo,
          pie: 'Siempre se redondea hacia arriba. Con N conocida: n ÷ (1 + (n − 1) ÷ N).',
        },
      ];
      if (sens) {
        tablas.push({
          titulo: `Sensibilidad (sección A): n según el margen de error${unidad ? ` (${unidad})` : ''}`,
          columnas: [{ t: 'Margen de error E', num: true }, { t: 'n requerido', num: true }, { t: 'Veces el n con tu E', num: true }],
          filas: sens.map((x) => [
            { texto: corto(x.E, 4), num: true },
            { texto: entero(x.n), num: true, formula: true },
            { texto: `× ${num(x.veces, 2)}`, num: true, formula: true },
          ]),
          resaltar: sens.map((x, i) => (x.f === 1 ? i : -1)).filter((i) => i >= 0),
          pie: 'Los múltiplos de tu E son 0.5, 1, 1.5, 2, 3 y 4; con E = 1 coinciden con la tabla de la plantilla.',
        });
      }

      const umbral = { ...UMBRAL, filas: UMBRAL.filas.map((f, i) => ({ ...f, activa: [activa.redondeo, activa.margen, activa.variabilidad, activa.poblacion, activa.normal][i] })) };
      const supuesto = { ...SUPUESTO, estado: 'informativo', detalle: 'Antes de medir, confirma de dónde salen σ o p y cómo vas a elegir las unidades (al azar, por turno…).' };
      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral, supuesto, graficas, tablas };
    },
  };
}
