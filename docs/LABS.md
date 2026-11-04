# Laboratorios: contrato y catálogo

Un laboratorio es **un archivo JavaScript en `labs/`** que describe campos editables y una función pura
`calcular(estado)`. La interfaz (`js/core/lab-ui.js`) pinta los campos, recalcula en cada cambio y dibuja el
resultado; el laboratorio no toca el DOM. Referencia viva: `labs/lab01-estadistica-descriptiva.js`.

## 1. Reglas de oro

1. **Sin respuestas ocultas.** El laboratorio muestra resultados, el *umbral de interpretación* y el *supuesto
   estadístico* que se debe revisar; nunca dice «correcto/incorrecto» ni esconde una solución.
2. **Cálculo puro y de datos a resultado.** `calcular(estado, ctx)` devuelve siempre un objeto; con datos
   incompletos devuelve `vacio`/`aviso` y semáforos «sin-datos», jamás lanza excepciones.
3. **Importa solo módulos puros**: `../js/lib/stats.js`, `../js/lib/graficas.js`, `../js/core/format.js`,
   `../js/core/config.js`. Nunca `plot.js`, `dom.js`, `lab-ui.js` ni nada que use `document`.
4. **Datos de práctica = datos de la guía o del caso de los arneses** (`ctx.caso`, que viene de
   `content/caso-arneses.json`). No inventes cifras: toda cifra sale de la guía (`GUIA_GREEN_BELT.docx`), de las
   plantillas Excel o del caso. Los umbrales que **no** vengan de la guía ni de Excel se rotulan
   «referencia didáctica» en el texto del umbral.
5. **Código de color Excel**: ejemplo = amarillo (se vuelve blanco al editar), captura = blanco, fórmula = azul
   claro; semáforos `cumple`, `atencion`, `critico`, `informativo`, `sin-datos`.
6. **Gráficas Plotly siempre con `respaldo`** (tabla con los mismos datos para el modo sin conexión).
   El bundle de Plotly es *cartesian*: no hay trazas `pie`, `sunburst`, `sankey`, mapas ni 3D.
   Usa `scatter`, `bar`, `box`, `histogram`, `heatmap`, `waterfall`... y los ayudantes de `js/lib/graficas.js`.
7. Números mostrados como **texto ya formateado** (`salidas[].valor` es string) con `js/core/format.js`
   (`num`, `entero`, `pct`, `mon`, `dpmo`, `rendimiento`, `cifras`…). Español de México: separador de miles
   «,» y decimal «.».
8. **Cada preset fija todas las entradas con estado** (los presets se aplican sobre el estado actual, no sobre el inicial).
9. Comentarios breves en español; nombres de identificadores en español, coherentes con `lab01`.

## 2. Forma de un laboratorio

```js
export default function labNN(ctx = {}) {          // o un objeto directamente
  return {
    id: 'labNN', numero: 'NN', modulo: 'M1', titulo: '…', resumen: '1–2 frases',
    antetitulo: '…',                 // opcional
    panelAncho: false,               // true si el panel de captura necesita más ancho (tablas)
    entradas: [ …campos… ],          // ver tipos abajo
    presets: [ { id, etiqueta, ayuda?, valores: { idEntrada: valor, … } } ],
    umbral:   { titulo, filas: [{ rango, texto }] },   // estático; calcular() puede devolver otro con filas[].activa
    supuesto: { titulo, texto },                       // ídem (calcular() puede añadir estado/detalle)
    preguntas: ['…', '…'],           // 3–5 preguntas abiertas al analista (no hay respuestas)
    calcular(e, ctx) { return { aviso, salidas, salidasColumnas, semaforos, umbral, supuesto, graficas, figuras, tablas, vacio }; },
  };
}
```

`ctx = { caso, depurar }` (`caso` = `content/caso-arneses.json` ya leído). Un laboratorio puede ser una
función `(ctx) => definición` para construir sus presets con los datos del caso (como `lab01`).

### Tipos de entrada (`js/core/lab-contrato.js`, `js/core/lab-ui.js`)

| tipo | estado que recibe `calcular` | opciones principales |
|---|---|---|
| `numero` | `number` (`NaN` si está vacío) | `etiqueta`, `valor`, `min`, `max`, `unidad`, `marcador`, `ayuda` |
| `slider` | `number` | `min`, `max`, `paso`, `valor`, `dec`, `unidad` |
| `texto` / `area` | `string` | `valor`, `marcador`, `filasTexto` (area) |
| `datos` | `number[]` (parsea espacios/comas/saltos) | `valor` (arreglo), `filasTexto` |
| `opcion` | `string` (el `valor` de la opción elegida) | `opciones: [{ valor, texto, ayuda }]` |
| `casilla` | `boolean` | |
| `tabla` | `Array<fila>` (cada fila = objeto por `id` de columna) | `columnas` (arreglo o `(estado) => arreglo`), `filas` (ejemplo), `filaNueva`, `minFilas`, `maxFilas`, `agregar:false`, `filasVacias` |
| `nota` / `seccion` | (sin estado) | `texto` / `etiqueta` |

Columnas de `tabla`: `{ id, etiqueta, tipo: 'numero'|'texto'|'opcion'|'fijo', min, max, ancho, opciones,
texto: (estado, fila, i) => string }` (`fijo` = columna calculada, azul claro, no editable).

**Laboratorios con varias herramientas** (LAB 19). Cualquier entrada y cualquier preset pueden llevar
`visibleSi: (estado) => boolean`: la interfaz los oculta mientras devuelva `false` (un campo oculto tampoco avisa de
errores), de modo que el selector `herramienta` muestre solo los campos y los ejemplos de la herramienta elegida. Los
rótulos de columna de una `tabla` pueden depender del estado (`columnas` como función) y `calcular()` puede devolver
`preguntas` (lista de textos) que sustituyen a las de la definición.

### Resultado de `calcular`

```
{ aviso?: string|string[], vacio?: string,
  salidas?: [{ id, etiqueta, valor:'texto', nota?, detalle?, color?:'teal'|'azul'|…, pequeno?, ancha? }], salidasColumnas?: 2,
  semaforos?: [{ nombre, estado, texto }],
  umbral?:  { titulo?, texto?, filas?: [{ rango, texto, activa? }] },
  supuesto?:{ titulo?, texto, estado?, detalle? },
  graficas?: [{ id, titulo, datos:[trazas Plotly], layout?, respaldo:{columnas,filas}, ancha?, alta? }],
  figuras?:  [{ id, titulo, figura:'arbol'|'sipoc'|…, params, ancha? }],
  tablas?:   [{ titulo, columnas:[ 'txt' | { t, num } ], filas:[[celda|{texto,num,formula,estado}]], pie?, resaltar?:[i] }] }
```

`validarDefinicion(def)` y `validarResultado(res, def)` (en `lab-contrato.js`) comprueban todo esto; el verificador
de contenido (`node tools/validar-contenido.mjs`) y las pruebas los ejecutan con cada preset.

## 3. Pruebas obligatorias (Node)

Cada laboratorio lleva `tests/labNN.test.mjs` (formato `node:test`, ejecútalo con
`node --test tests/labNN.test.mjs`) que usa `tests/helpers.mjs`:

* `ejecutar('lab05-project-charter.js', 'guia')` → `{ def, estado, resultado, problemas }` con `problemas === []`.
* Comprueba cifras clave con tolerancias (valores de la guía/Excel o calculados a mano y escritos como constantes).
* Prueba el camino vacío (`estadoVacio`) y un caso con un campo inválido: no debe lanzar excepciones.

## 4. Catálogo y compromisos de interfaz

Los **ids de entrada y de presets** de esta tabla son el contrato con el contenido (`ejercicio.valores` y
`abrirLab.valores` los usan): no los cambies sin actualizar el contenido. Puedes **añadir** entradas y presets.

| Lab | Archivo | Módulo | Qué practica |
|---|---|---|---|
| 01 | `lab01-estadistica-descriptiva.js` | M0 | resumen de una muestra: media, mediana, moda, SC, s/σ, cuartiles, atípicos |
| 02 | `lab02-distribucion-normal.js` | M0 | regla empírica, Z, % fuera de especificación, efecto del desplazamiento de 1.5σ |
| 03 | `lab03-copq.js` | M1 | costo de la calidad (PAF): COQ, COPQ, % de ventas |
| 04 | `lab04-dpmo-sigma.js` | M1 | DPU/DPO/DPMO, rendimiento, nivel sigma, antes vs. después, conversión σ↔DPMO |
| 05 | `lab05-project-charter.js` | M2 | Project Charter: SMART, cronograma, ROI y recuperación |
| 06 | `lab06-arbol-ctq.js` | M2 | árbol CTQ: necesidad → impulsor → CTQ medible |
| 07 | `lab07-matriz-seleccion.js` | M2 | matriz de selección ponderada y sensibilidad |
| 08 | `lab08-ahp.js` | M2 | AHP: pesos por comparación por pares y razón de consistencia |
| 09 | `lab09-sipoc.js` | M3A | SIPOC y su verificación de completitud |
| 10 | `lab10-pce-desperdicios.js` | M4 | PCE, lead time y desperdicio por tipo (VA / SVA / desperdicio), meta de PCE y Ley de Little |
| 11 | `lab11-tamano-muestra.js` | M4 | tamaño de muestra: media, proporción y diferencia entre dos medias, con población finita y sensibilidad |
| 12 | `lab12-gauge-rr.js` | M5 | Gauge R&R por promedios y rangos: EV, AV, %GRR y ndc |
| 13 | `lab13-cp-cpk.js` | M5 | capacidad del proceso: Cp, Cpk, Pp y Ppk, con diagnóstico de centrado y de variación |
| 14 | `lab14-hoja-verificacion.js` | M4 | hoja de verificación de conteo por estrato (turno, máquina…), concentración y DPMO |
| 15 | `lab15-pareto.js` | M6 | diagrama de Pareto: frecuencia, porcentaje acumulado, «pocas vitales» con línea de corte y «Otros» al final |
| 16 | `lab16-ishikawa-porques.js` | M6 | Ishikawa (6M) con votos y 5 Porqués con evidencia, causa raíz, prueba inversa y contramedida |
| 17 | `lab17-amef-rpn.js` | M6 | AMEF: RPN = S × O × D con el criterio de la guía o el de la plantilla, severidad ≥ 9 y simulador de mejora |
| 18 | `lab18-anova.js` | M7 | ANOVA de un factor (hasta seis grupos): F, p, η², Tukey–Kramer o LSD y diagnóstico de residuos |
| 19 | `lab19-regresion-chi-ic.js` | M7 | selector de herramienta: correlación y regresión lineal, chi-cuadrada de independencia o intervalo de confianza de una media |
| 20 | `lab20-vsm.js` | M8 | mapa de flujo de valor: lead time, valor agregado, esperas, PCE, etapa más lenta y estado futuro; con inventarios, takt, RTY e inventario en proceso |
| 21 | `lab21-takt.js` | M8 | takt time (tiempo neto, demanda por día o por semana, pitch), cambio frente a la demanda anterior, balanceo de estaciones, PCE × takt y ahorro del SMED |
| 22 | `lab22-oee.js` | M8 | OEE por periodos o por factores, cascada de pérdidas con su herramienta Lean, factor más débil frente a mayor pérdida y simulador de mejora |
| 23 | `lab23-doe.js` | M9 | diseño factorial 2² con réplicas: efectos por la tabla de signos, error estándar, t, p, suma de cuadrados, mejor combinación y predicción |

### LAB 02 · Distribución normal (`lab02-distribucion-normal.js`)
Entradas: `mu` (numero, 50), `sigma` (numero >0, 4), `lsl` (numero, 38), `usl` (numero, 62),
`desplazamiento` (slider 0–2, paso 0.1, 0; «desplazamiento de la media hacia el límite de especificación más cercano, en σ»),
`unidad` (texto).
Presets: `guia` (50/4, 38–62, 0), `tres-sigma` (50/4, 38–62, 1.5 → ≈ 66,807 DPMO), `seis-sigma` (50/4, 26–74, 1.5 →
3.4 DPMO), `fuerza` (μ y σ de las 40 fuerzas del caso, LSL 173), `torque` (μ y σ de las 10 mediciones, 1.2–1.5).
Salidas: bandas ±1σ/±2σ/±3σ con intervalo y % (68.27, 95.45, 99.73), Z a cada límite, % por debajo/por encima,
DPMO fuera, rendimiento, nivel sigma de corto plazo (Z mínimo sin desplazar) y Z de largo plazo.
Semáforo de DPMO: ≤3.4 cumple · ≤66,807 atención · mayor crítico. Gráfica: curva, límites y colas sombreadas
(curva original punteada cuando hay desplazamiento). Supuesto: normalidad (remite a LAB 01 para comprobarla).

### LAB 03 · Costo de la mala calidad (`lab03-copq.js`)
Orden de la sesión 1: el COPQ (M1 §5) va antes que el DPMO (M1 §6), por eso llevan los números 03 y 04.
Entradas: `moneda` (texto, «MXN»), `ventas` (numero), `periodo` (opcion: `mensual`, `trimestral`, `anual`; anualiza ×12,
×4, ×1), `conceptos` (tabla: `categoria` opcion `prevencion|evaluacion|fallaInterna|fallaExterna`, `concepto` texto,
`costo` numero; `maxFilas` ≥ 20). Presets: `arneses` (`ctx.caso.copq`), `guia-ej2` (ejercicio 2 del M1 de la guía:
COPQ = 7.5 % de las ventas). Salidas: totales por categoría, costo de buena calidad (prevención + evaluación), COPQ
(fallas internas + externas), COQ total, COPQ/ventas y COQ/ventas, COPQ anualizado, relación buena:mala calidad.
Semáforo COPQ/ventas: ≤5 % cumple · ≤20 % atención · mayor crítico (referencia didáctica). Gráfica de barras (sin pastel).

### LAB 04 · DPMO y nivel sigma (`lab04-dpmo-sigma.js`)
Entradas: `antes_unidades`, `antes_oportunidades`, `antes_defectos`, `despues_unidades`, `despues_oportunidades`,
`despues_defectos` (numero; el bloque «después» puede quedar vacío), `desplazamiento` (slider 0–2, 1.5),
`meta` (numero, DPMO objetivo, ejemplo 100), `sigmaEntrada` (slider 1–6, paso 0.1, 4: convierte un nivel sigma a DPMO).
Presets: `guia` (2000/5/3 → 16000/5/13), `excel` (2000/25/15 → 4000/25/16), `empaque`, `lineas-ab`, y los
ejercicios resueltos del M1 de la guía (`ej1`, `ej2`… con el id que corresponda; consulta las líneas 1184–1231 de
`guia.txt`). Salidas: DPU, DPO, DPMO, rendimiento (1 − DPO) y de primera pasada, Z, nivel sigma, reducción de DPMO y
cambio de σ entre antes y después, DPMO de `sigmaEntrada`. Semáforos: contra la `meta` y contra 3.4 (informativo).
Gráfica: `GENERADORES['sigma-dpmo']` con los puntos antes/después. Umbral: tabla 6σ…1σ de la guía.
Verificación: antes = **300 DPMO**; después = **162.5 DPMO** (13 defectos, la guía redondea a 162).

### LAB 05 · Project Charter (`lab05-project-charter.js`)
Entradas: `nombre`, `problema` (area), `metrica`, `unidadMetrica`, `lineaBase`, `meta`, `plazoMeses` (slider 1–12),
`beneficioAnual`, `costoProyecto`, `dentro` (area), `fuera` (area), `moneda`, `cronograma` (tabla con columna fija
«fase» Definir/Medir/Analizar/Mejorar/Controlar y `meses` numero; `agregar:false`).
Presets: `guia` (M2 §6 de la guía: 300 → 100 DPMO en 4 meses), `excel` (ejemplo de la plantilla «Project Charter»).
Salidas: reducción absoluta y %, beneficio neto del primer año, ROI, recuperación (meses), suma del cronograma vs. plazo.
Semáforos SMART (específico, medible, alcanzable, relevante, temporal) y una revisión heurística del planteamiento
del problema con **listas de palabras visibles** (causa/solución/culpable), nunca una caja negra. Supuesto: la
línea base viene de datos reales del proceso (no de una estimación).

### LAB 06 · Árbol CTQ (`lab06-arbol-ctq.js`)
Entradas: `ctq` (tabla: `necesidad`, `impulsor`, `ctq`, `unidad` texto; `lsl`, `objetivo`, `usl` numero; `metodo`
texto; columna fija `estado`). Presets: `libro` (`ctx.caso.ctq.libro`), `excel` (`ctx.caso.ctq.excel`).
Figura `arbol` (una por necesidad). Semáforos: cada CTQ debe ser medible (unidad + al menos un límite + método),
LSL < USL, impulsores sin CTQ, necesidades sin impulsor. Supuesto: la necesidad viene de la voz del cliente (VOC), no
de una suposición del equipo.

### LAB 07 · Matriz de selección ponderada (`lab07-matriz-seleccion.js`)
Entradas: `criterios` (tabla `nombre`, `peso` en %; 2–6 filas), `opciones` (tabla con `nombre` y una columna numérica
por criterio, con encabezados dinámicos; escala 1–5). Presets: `libro` (40/35/25; A = **4.40**, B = **3.00**, C =
**2.75**), `excel` (4 criterios 40/25/20/15 y 3 opciones, `ctx.caso.matriz`). Salidas: puntaje ponderado, ranking,
margen entre 1.º y 2.º, sensibilidad con pesos iguales. Semáforos: pesos suman 100 % (si no, crítico), margen
<0.25 atención (referencia didáctica), ranking estable ante pesos iguales. Gráfica: barras apiladas (aporte por criterio).

### LAB 08 · AHP (`lab08-ahp.js`)
Cuatro criterios (como en la guía M2 §5). Entradas: `criterios` (tabla de 4 nombres), `pares` (tabla de 6 filas con
columnas fijas «criterio A» y «criterio B» tomadas de `criterios` y `valor` texto que acepta `3`, `1/3`, `0.5`;
escala de Saaty 1–9 y sus recíprocos). Presets: `guia` (triángulo `[3,4,7,2,5,4]`, `ctx.caso.ahp`) y `inconsistente`.
Salidas: matriz recíproca, pesos (prioridades), λmax, IC, IR (0.90 para n = 4), RC. Semáforo: RC < 0.10 cumple · <0.20
atención (referencia didáctica) · mayor crítico. Usa `ahp()` y `matrizReciproca()` de `js/lib/stats.js`.

### LAB 09 · SIPOC (`lab09-sipoc.js`)
Entradas: `proceso`, `inicio`, `fin` (texto), `filas` (tabla: `proveedor`, `entrada`, `paso`, `salida`, `cliente`,
`requisito`; hasta 10 filas). Presets: `libro` (5 pasos), `excel` (7 pasos), de `ctx.caso.sipoc`. Figura `sipoc`.
Semáforos: 4–7 pasos (alto nivel; fuera de ese rango = atención), inicio y fin definidos, cada entrada con proveedor,
cada salida con cliente, al menos un requisito del cliente (CTQ). Supuesto: el SIPOC se construye con quienes hacen
el proceso, no en una oficina.

### LAB 10 · PCE y desperdicios (`lab10-pce-desperdicios.js`)
Entradas: `actividades` (tabla: `actividad` texto, `minutos` numero, `clase` opcion `VA|SVA|Desperdicio`, `tipo` opcion con los
ocho desperdicios de la plantilla o vacío; hasta 24 filas, el orden es el de la línea de tiempo), `meta` (numero, PCE objetivo
en %), `wip` y `tasaSalida` (numero; Ley de Little: lead time = WIP ÷ tasa × 60). Presets: `guia` (6 pasos, 15 de 55 min =
**27.3 %**), `excel` (12 actividades, meta 40 %, WIP 40 y 48 piezas por hora), `credito` (ejercicio 1 del M4: 23 ÷ 155 = **14.8 %**).
Salidas: lead time, minutos por clase, PCE, tiempo sin valor agregado, paso que más consume y, con meta, lead time necesario y
tiempo a eliminar; con WIP y tasa, lead time de Little y PCE con él. Semáforos (informativos salvo la meta): PCE frente a las
referencias (5–15 % típico, > 25 % mejorado), meta de PCE, bloque sin valor más largo, desperdicio sin tipo, Little frente a la
suma de pasos. Gráficas: `linea-tiempo` (barras sobre el tiempo, sin pastel) y `tipos`. Supuesto: el lead time incluye
esperas y transportes (si no, el PCE sale siempre 100 %).

### LAB 11 · Tamaño de muestra (`lab11-tamano-muestra.js`)
Tres secciones con ids propios. A, media: `confianzaA`, `sigma`, `margen`, `unidad`, `poblacionA` (opcional), `estratos`.
B, proporción: `confianzaB`, `p`, `margenP`, `poblacionB`. C, diferencia entre dos medias: `confianzaC`, `potencia`, `sigmaC`,
`delta`. Todo número ≥ 0 en las unidades que indica la etiqueta (confianza y potencia en %). Siempre se redondea hacia
arriba. Presets: `guia` (A: 11.10 → **12 por turno**, 36 con tres estratos; B: 456.17 → **457**; C: 46 por turno y 92 en total,
combinación didáctica que la guía no calcula) y `excel` (35 · 385 · 36 por grupo). Semáforos: σ de una muestra piloto (la
referencia con t de Student pide algo más que la fórmula con Z), aproximación normal de la proporción (n·p y n·(1 − p) ≥ 10;
referencia didáctica) y potencia (< 80 % atención). Gráficas: `sensibilidad` (n según el margen de error, sección A) y `proporcion` (n según la proporción esperada, sección B).

### LAB 12 · Gauge R&R (`lab12-gauge-rr.js`)
Entradas: `operadores` (`2|3`), `repeticiones` (`2|3`), `unidad`, `tolerancia` (opcional) y `mediciones` (tabla: una fila por
pieza, de 2 a 10, con una columna por operador y repetición: `A1 A2 A3 B1 B2 B3 C1 C2 C3`; las sobrantes se ocultan). Método de
promedios y rangos con las constantes K1, K2 y K3 del AIAG. Presets: `guia` (10 × 3 × 2 N, %GRR **16.9 %**, ndc **8**), `excel` (5 ×
3 × 2 N·m, 12.9 %, ndc 10) y `sesgo` (variante didáctica con 1.5 N de sesgo en el operador C; no está en la guía). Salidas: %GRR, ndc, %EV, %AV y %PV; la tabla «Cálculo paso a paso» muestra R̄, EV, AV, R&R, PV y TV. Semáforos: %GRR (< 10 % cumple · 10–30 % atención · > 30 % crítico), ndc ≥ 5, fuente dominante,
operador con más variación, rangos frente a D4 × R̄ (referencia didáctica) y diseño del estudio. %Tolerancia = R&R ÷ tolerancia: las
constantes ya traen el factor 5.15σ, así que no se multiplica por 6 (la plantilla Excel sí lo hace y sobrestima). Gráficas:
`componentes`, `promedios` (pieza × operador) y `rangos`.

### LAB 13 · Capacidad del proceso (`lab13-cp-cpk.js`)
Entradas: `unidad`, `lsl`, `usl` (uno puede quedar vacío: especificación unilateral), `media` y `sigma` (resumen),
`nResumen` (tamaño de la muestra del resumen), `datos` (si se capturan, de ellos salen x̄ y s), `rBarra` y `nSubgrupo` (σ dentro =
R̄ ÷ d2, para Cp y Cpk), `sigmaDentro` (σ de corto plazo dada) y `grr` (%GRR del LAB 12, opcional). Cp y Cpk usan σ dentro;
Pp y Ppk, la σ global. Presets: `guia` (torque: Cp **1.47**, Cpk **1.42**), `ej2` (Cp 1.39, Cpk 0.97), `ej4` (límites 195 y 205,
σ 1.5, media 202: Cp 1.11, Cpk 0.67) y `excel` (50 fuerzas de engarzado: Cpk 1.58, Ppk 1.42, 10.27 PPM). Salidas: media, σ global, σ dentro, n, Cp, Cpk, Pp, Ppk, PPM fuera de especificación y observaciones fuera (según los datos capturados). Semáforos: Cpk y Ppk (cortes 1.00 / 1.33 / 1.67 / 2.00 de la tabla de la guía), diagnóstico entre centrado y variación, variación de largo plazo, observaciones (n < 30: atención), forma de los datos y sistema de medición (con %GRR).
Gráficas: `distribucion` (histograma o campana con límites) e `indices`.

### LAB 14 · Hoja de verificación (`lab14-hoja-verificacion.js`)
Entradas: `estrato` (`Turno|Máquina|Operador|Proveedor`), `numEstratos` (`2|3|4|5`), `categorias` (tabla: `categoria` texto y un
conteo entero por estrato, `e1 … e5`; hasta 12 filas), `unidades` y `oportunidades` (opcionales: con ellas salen DPU, DPMO y
nivel sigma como en el LAB 04). Presets: `guia` (M4 §7: 3 defectos en 2,000 arneses con 5 oportunidades = **300 DPMO**) y `excel`
(6 categorías × 3 turnos = **103** defectos: 31 · 30 · 42 por turno). Salidas: total, defectos por estrato, categoría con más
defectos, DPMO, DPU y sigma. Semáforos informativos: reparto entre estratos (la concentración se lee como una pregunta sobre el
proceso, no sobre las personas) y «pocos defectos» (menos de 5 esperados por estrato: el reparto puede ser azar; referencia
didáctica). Gráficas: `categorias` (apilada por estrato, de mayor a menor) y `reparto`. La tabla con totales y porcentajes imita
la plantilla «Hoja de Verificacion».

### LAB 15 · Diagrama de Pareto (`lab15-pareto.js`)
Entradas: `unidad` (texto), `categorias` (tabla: `categoria` texto y `frecuencia` número; hasta 12 filas) y `corte` (número de 50
a 99: % acumulado con el que se cierran las «pocas vitales»; 80 por omisión). Presets: `guia` (M6 §1: 25 defectos en cinco
categorías, tres vitales = **84 %**), `tickets` (Ejercicio 1: 100 tickets, tres vitales, «Otros» 4 %), `excel` (plantilla «Pareto»,
100 registros) y `hoja` (los 103 defectos de la hoja de verificación del LAB 14). Salidas: total, pocas vitales (n de N), categoría
mayor y, si existe, «Otros». La categoría que cruza el corte se incluye en las vitales (así la guía obtiene 84 %); «Otros» va
siempre al final, sea cual sea su tamaño. Semáforos: «Pocas vitales» (atención si hacen falta casi todas las categorías: el
Pareto no separa nada), «Categoría Otros» y «Pocos registros» (menos de 30; referencia didáctica: el orden de las barras puede
cambiar con un periodo más de datos). Gráfica: `pareto` (barras ordenadas, línea de % acumulado y línea de corte). Tabla «El
Pareto, paso a paso». Supuesto: ordena por frecuencia, no por gravedad ni por costo; el riesgo se pondera con el LAB 17.

### LAB 16 · Ishikawa y 5 Porqués (`lab16-ishikawa-porques.js`)
Ishikawa: `efecto` (texto) y `causas` (tabla: `categoria` opción de las 6M, `causa` texto y `votos` número; hasta 30 filas).
5 Porqués: `problema` (texto), `cadena` (tabla: `respuesta`, `evidencia` y `verificada` `Sí|No`; hasta 8 pasos), `causaRaiz` (área),
`categoriaRaiz` (`Método / sistema|Mano de obra|Máquina|Material|Medición|Medio ambiente` o vacío), `pruebaInversa`
(`Sí|No|No sé` o vacío), `contramedida`, `responsable` y `fecha` (texto). Presets: `guia` (M6 §3: fallas de continuidad eléctrica,
cinco porqués), `excel` (plantillas: fuerza de retención baja en el Turno 3, con votos y evidencias) y `persona` (cadena que se
detiene en una persona; variante didáctica, no está en la guía). Salidas: causas, votos y causa más votada (si hay votos), pasos de
la cadena y causa raíz. Semáforos: «Las seis M», «Votos», «Cadena de porqués» (cuenta los pasos sin verificar: una respuesta sin
evidencia es una hipótesis), «Sin culpar a personas» (señala las respuestas que apuntan a una persona, como «se equivocó» o «se
descuidó», y pide seguir hasta una causa de proceso o de sistema), «Causa raíz», «Prueba inversa» y «Contramedida». Figuras SVG (no
Plotly): `ishikawa` y `porques`; tabla «Resumen por categoría». Supuesto: ninguna de las dos herramientas prueba nada, cada causa
se verifica con datos.

### LAB 17 · AMEF y RPN (`lab17-amef-rpn.js`)
Entradas: `criterio` (`guia|excel`), `modos` (tabla: `paso`, `modo`, `efecto`, `causa` texto y `s`, `o`, `d` número de 1 a 10;
hasta 20 filas) y el simulador de mejora: `mejoraFila` (`1`…`20` o vacío) con `sNueva`, `oNueva` y `dNueva`. Presets: `guia` (M6 §4:
tres modos, RPN **192 · 54 · 42**), `empaque` (Ejercicios 2 y 3: sellado de bolsas, **210 → 70**) y `excel` (plantilla: **240 ·
180 con S ≥ 9 · 120**). RPN = S × O × D (1 a 1,000). Los dos criterios de prioridad no coinciden y se conservan ambos: guía
(< 50 bajo, 50–100 revisar, > 100 acción) y plantilla (< 100 monitorear, 100–199 acción, ≥ 200 acción inmediata). Salidas: modos
evaluados, RPN máximo, modos que piden acción, modos con S ≥ 9 y, con la mejora, RPN antes → después. Semáforos: prioridad por
RPN, **severidad ≥ 9 (se revisa sin importar el RPN)**, frecuencia y riesgo, mejora simulada. Gráficas: `rpn` y `perfil`. Tablas:
«El AMEF ordenado por RPN» y «¿Y si mejoramos?». No calcula la Prioridad de Acción (AP) del manual AIAG-VDA 2019: la guía
la menciona sin dar su tabla.

### LAB 18 · ANOVA de un factor (`lab18-anova.js`)
Entradas: `unidad`, `nombre1`…`nombre6` (texto), `datos1`…`datos6` (`number[]`; solo cuentan los grupos con al menos 2 datos),
`alfa` (número, 0.05 por omisión) y `comparacion` (`tukey|lsd`). Presets: `guia` (M7 §2: tres turnos con cinco datos,
F(2, 12) = **14.22**, p = 0.0007, η² = 0.703), `minimo` (ejemplo mínimo A 10 · 12, B 14 · 16, C 18 · 20: F = **16.00**,
SC total 70 = 64 + 6), `excel` (plantilla: tres turnos con diez datos y LSD) y `sinDiferencia` (turnos 1 y 2 de la guía, derivado:
el ANOVA no es significativo). Salidas: F, p, η², razón de desviaciones (s máx ÷ s mín), grupos · datos y, si el ANOVA es significativo, los pares que difieren (si no, la media global). Tablas:
«Tabla ANOVA» (SC, gl, CM, F y p), «Resumen por grupo» y «Comparaciones por pares». La plantilla compara con LSD de Fisher, que
no controla el error por comparaciones múltiples; la guía recomienda Tukey, así que aquí el método por defecto es Tukey–Kramer y
LSD queda como opción. Semáforos: «Conclusión del ANOVA», «Tamaño del efecto» (informativo), «Varianzas parecidas» (razón < 2 es
razonable), «Tamaño de los grupos» (algún grupo con menos de 5 datos; referencia didáctica), «Comparaciones por pares» (solo se
interpretan si el ANOVA es significativo), «Comparaciones múltiples» (aviso al elegir LSD) y «Dos grupos» (con dos grupos el ANOVA
coincide con la prueba t de dos muestras, F = t²). Gráficas: `grupos`, `pares` (solo si el ANOVA es significativo), `residuos` y `normal`.
Supuestos: independencia, normalidad de los residuos y varianzas parecidas.

### LAB 19 · Regresión, chi-cuadrada e intervalo de confianza (`lab19-regresion-chi-ic.js`)
Un selector `herramienta` (`regresion|chi|ic`) decide qué entradas y qué ejemplos se ven (`visibleSi`); `alfa` es común y el nivel
de confianza sigue a α. **Regresión:** `nombreX`, `unidadX`, `nombreY`, `unidadY` (texto), `datosX` y `datosY` (`number[]`, mismos
pares), `xPred` (valor de X a predecir) y `yObjetivo` (valor de Y del que se quiere despejar X). **Chi-cuadrada:** `numCols`
(`2`…`5`), `nombresCols` (texto, nombres separados por comas) y `observadas` (tabla: `categoria` y `c1`…`c5`; las filas y columnas
sin conteos se ignoran). **Intervalo de confianza de una media:** `icN`, `icMedia`, `icS` y `icUnidad`. Presets: `reg-plantilla`
(plantilla: 12 pares de fuerza y resistencia, r = −0.994), `reg-curva` (Y = X², r = 0 con una relación perfecta), `chi-guia` (M7 §5:
2, 2 y 6 fallas en 5,340 arneses por turno, χ² = **3.20**, gl 2, p = 0.2017), `chi-plantilla` (900 unidades, χ² = 13.09),
`chi-torque` (derivado del LAB 14: torque contra el resto), `chi-2x2` (derivado: turnos 1 y 3 en 2 × 2, con Yates y Fisher),
`ic-torque` (M7 §1: diez torques del M5, IC 95 % de **1.334 a 1.376** con z) e `ic-examen` (n = 16, x̄ = 50, s = 8). Salidas
de la regresión: r, R², ecuación, pendiente, p, s, n, predicción y X para el Y objetivo (con bandas de confianza y de predicción);
de la chi-cuadrada: χ², p, V de Cramér, esperado mínimo y N (en 2 × 2, también Yates y Fisher); del IC: crítico t y z, error
estándar y margen. Las constantes se verifican contra SciPy (`tests/lab19.test.mjs`). Semáforos de la regresión: «Correlación»,
«Pendiente», «Forma de la relación», «Residuos», «Interpolación» (con aviso de extrapolación fuera del rango observado) y
«Causalidad»; de la chi-cuadrada: «Conclusión de la prueba», «Frecuencias esperadas» (menores que 5), «Tamaño del efecto», «Poder
de la prueba» (pocos eventos; referencia didáctica de 30) y, en 2 × 2, «Yates y Fisher»; del intervalo: «z o t» y «Qué significa».
Gráficas: `dispersion`, `residuos` y `normal` · `distribucion`, `contribuciones` y `tasas` (intervalo de Wilson) · `intervalos` y
`margen`. Supuestos: relación lineal y residuos normales (regresión); observaciones independientes y esperados ≥ 5 (chi-cuadrada);
muestra aleatoria (intervalo).

### LAB 20 · Mapa de flujo de valor (`lab20-vsm.js`)
Entradas: `etapas` (tabla de 1 a 12 filas `{etapa, tc, clase, inv, espera, fty}`: tiempo de ciclo en min, `clase` = `VA|SVA|Desperdicio`,
inventario en unidades y espera en min después de la etapa, y FTY en %), `demanda` (unidades por día), `disponible` (min netos por
día), `mejoraFila` (`""` o `"1"`…`"12"`) y `esperaNueva` (min). La espera de una fila es la capturada o, si falta y hay inventario y
takt, inventario × takt (plantilla «VSM»); si hay ambas, manda la capturada. Presets: `guia` (M8 §1: seis filas, lead time **55** min,
valor agregado **15**, PCE **27.3 %**; el buffer de 15 min entre engarzado y ensamble baja a 4 min con Kanban → lead time **44** min y
PCE **34.1 %**) y `excel` (plantilla: cinco procesos con inventario y FTY, takt 450 ÷ 480 = 0.9375 min, lead time 481.575 min, PCE
0.72 %, RTY 89.4 %, 510 unidades en proceso). Salidas: `lead`, `va`, `esperas`, `pce`, `sva`, `cuello`, `mayor-espera`, `lead-futuro`,
`pce-futuro` y, con takt, `takt`, `rty` e `inventario`. Tablas: «El mapa, etapa por etapa» y «Estado actual y estado futuro (…)».
Semáforos: «PCE frente a las referencias» (5 % de los VSM reales según la guía y 25 % de los procesos ya mejorados con Lean), «Mayor
espera», «Etapa más lenta», «Estado futuro», y con takt «Takt» (crítico si alguna etapa lo excede), «Rendimiento acumulado» e
«Inventario». Gráficas: `linea-tiempo` y `futuro`. Diferencias con la plantilla: la guía no cuenta la inspección final como valor
agregado (es SVA necesario) y la plantilla suma todos los tiempos de ciclo como VA, así que aquí cada etapa lleva su clase; la
capacidad y el tiempo de cambio de cada proceso de la plantilla no se incluyen (la disponibilidad se trata en el LAB 22).

### LAB 21 · Takt time y balanceo de estaciones (`lab21-takt.js`)
Entradas: `minTurno`, `turnos`, `descansos` y `paros` (min por turno; `paros` = juntas, 5S y mantenimiento planeado), `demanda` con
`periodo` (`dia|semana`) y `diasSemana` (solo con semana), `demandaAnterior` (misma unidad que `demanda`), `contenedor` (unidades
por contenedor, para el pitch), `estaciones` (tabla de 0 a 12 filas `{estacion, tc}` con tc en min), `pce` (%), `cambioMin`,
`reduccionSmed` (%) y `cambiosTurno`. Takt = tiempo neto por día ÷ demanda por día. Presets: `guia` (M8 §1: 450 min y 2,400 por
semana en 5 días → 480 por día, **0.9375** min = **56.25** s frente a 67.5 s con 2,000), `ej1` (2 turnos de 420 min, 6 días y 5,040
piezas → **60** s), `ej3` (25 min, 50 % y 3 cambios → **37.5** min por turno), `ej4` (PCE 27.3 % → **15.36** s de valor agregado y
**40.89** s de desperdicio) y `excel` (plantilla «Takt Time»: 435 min netos y 480 por día → **54.375** s, pitch de 50 unidades de
45.3125 min y seis estaciones con 4.25 min de contenido, **5** operadores mínimos y eficiencia de balanceo de **78.7 %**). Salidas:
`takt`, `neto`, `demanda-dia`, `por-hora` y, según lo capturado, `takt-anterior`, `cambio-takt`, `va-takt`, `desperdicio-takt`,
`ahorro-cambio`, `ahorro-turno`, `pitch`, `contenido`, `operadores`, `eficiencia`, `exceden` y `lenta`. Tablas: «Del tiempo disponible
al takt», «Takt con la demanda anterior y la actual» y «Estaciones frente al takt». Semáforos: «Takt», «Cambio de demanda», «Cambio de
modelo (SMED)», «PCE y takt», «Cumplimiento del takt» (crítico si alguna estación excede el takt), «Balanceo» y «Operadores mínimos».
Gráficas: `estaciones` y `balance`. La guía trae el takt, el PCE × takt y el SMED en párrafos; la plantilla, el balanceo y el pitch:
el laboratorio reúne todo.

### LAB 22 · OEE (`lab22-oee.js`)
Entradas: `modo` (`periodos|factores`); con `periodos`, la tabla `periodos` (1 a 14 filas `{periodo, plan, paros, ciclo, prod, buenas}`:
minutos planificados y de paros, ciclo ideal en min por unidad, unidades producidas y buenas); con `factores`, `disp`, `rend` y `cal`
(%); y el simulador `mejoraFactor` (`""|A|P|Q`) con `mejoraValor` (%). Disponibilidad = (plan − paros) ÷ plan; rendimiento = ciclo
ideal × producidas ÷ (plan − paros); calidad = buenas ÷ producidas; el total suma los periodos y pondera el ciclo ideal por las
unidades producidas. Presets: `guia` (M8: 90 × 85 × 96 = **73.44 %**), `guia-turno` (480 min, 48 de paros, ciclo de 0.9375 min, 391
producidas y 375 buenas → **73.24 %**; la guía redondea los factores), `excel` (plantilla «OEE»: cinco días de 450 min →
**75.76 %**), `ej5` (88 × 91 × 97 = 77.68 %; la guía no imprime el resultado: clave en el Apéndice C) y `examen` (90 × 85 × 68 =
**52.02 %**, con la simulación de llevar la calidad a 80 %). Salidas: `oee`, `disp`, `rend`, `cal`, `debil`, `mayor-perdida` y, según el
caso, `productivo` (min, solo con periodos), `oee-futuro` y `ganancia` (con simulación). Tablas: «Cascada de pérdidas» y «OEE por
periodo» (con dos o más periodos). Semáforos: «OEE frente a la referencia» (85 % es clase mundial según la guía; 40 a 60 % en plantas que
no han trabajado el tema), «Rendimiento» (crítico si pasa de 100 %), «Factor más débil», «Mayor pérdida» (pueden no coincidir),
«Variación entre periodos» y «Mejora simulada». Gráficas: `cascada`, `factores` (con la referencia de Nakajima: 90 × 95 × 99) y
`periodos`. La guía toma el takt como ciclo ideal de su ejemplo; con el ciclo de diseño del equipo, el rendimiento cambiaría.

### LAB 23 · Diseño factorial 2² (`lab23-doe.js`)
Entradas: `respuesta` (texto con unidades), `objetivo` (`min|max`), `factores` (tabla fija de 2 filas `{nombre, bajo, alto}`: A y B),
`corridas` (tabla fija de 4 filas en el orden (1), a, b, ab con `y1`…`y5` para las réplicas; con una sola réplica solo hay efectos, sin
prueba), `alfa` (0.001 a 0.2; 0.05 por omisión), `predA` y `predB` (valores de los factores para la predicción). Efecto = promedio con
el factor en nivel alto − promedio con el factor en nivel bajo (tabla de signos; AB usa el producto de los signos); SCE = Σ (nᵢ − 1) sᵢ²,
gl = N − 4, error estándar del efecto = ½ √(CME × Σ 1/nᵢ), t, valor p con t de Student de dos colas y SC = N × efecto² ÷ 4 (solo en
diseños balanceados). Presets: `guia` (M9 §4, dos réplicas: efectos **−0.90 / −0.40 / −0.10**, gl 4, t −9 / −4 / −1, p 0.0008 / 0.0161 /
0.3739, margen **±0.278**; predicción de 1.0846 mΩ con 173 N y 7 mm), `excel` (plantilla «DOE 2x2», tres réplicas: efectos 22.0 / 7.97 /
4.0, gl 8, SC 1,452 / 190.4 / 48), `ej2` (una réplica: 12, 18, 14, 22 → **7 / 3 / 1**, sin prueba), `ej3` (15, 22, 19, 30 → B = **6**;
clave en el Apéndice C) e `interaccion` (variante didáctica con datos inventados: efectos 1 / −1 / −19). **Diferencia con la guía:**
esta escribe 0.05 como «error estándar de cada efecto» y ±0.14 de margen; eso es el error estándar del coeficiente (efecto ÷ 2). Para
el efecto como diferencia de promedios corresponden **0.10** y **±0.278**; el estadístico t es el mismo y las conclusiones no cambian.
Salidas: `efecto-a`, `efecto-b`, `efecto-ab`, `gl`, `mejor`, `prediccion` y, con réplicas, `se` y `margen` (y `r2` si el diseño es
balanceado). Tablas: «Corridas y promedios», «Efectos y prueba t» (o «Efectos (sin prueba: no hay error estimado)») y «Descomposición de
la variación» (solo balanceado). Semáforos: «Efecto de A», «Efecto de B», «Interacción AB», «Réplicas», «Mejor combinación» y
«Predicción» (o «Predicción fuera de rango»). Gráficas: `interaccion` y `efectos` (|t| frente al t crítico, o |efecto| sin prueba).

## 5. Cómo agregar un laboratorio nuevo

1. Copia `labs/_plantilla.js` a `labs/labNN-nombre.js` y completa los campos.
2. Declara el laboratorio en la sesión (`content/sesiones/<id>/sesion.json`, lista `labs`) y colócalo en `slides`
   con `{ "tipo": "lab", "lab": "labNN" }`.
3. Escribe `tests/labNN.test.mjs` y ejecuta `node tools/validar-contenido.mjs`.

## 6. Contrato de ids de estado (los usa el contenido en `ejercicio.valores` / `abrirLab.valores`)

Estos ids son fijos; puedes **añadir** entradas, nunca renombrar ni quitar estas.

| Lab | Entradas (id → forma del estado) |
|---|---|
| 01 | `datos` number[] · `unidad` · `tipo` (`muestra`\|`poblacion`) · `clases` · `lsl` · `usl` |
| 02 | `mu` · `sigma` · `lsl` · `usl` · `desplazamiento` · `unidad` |
| 03 | `moneda` · `ventas` · `periodo` (`mensual`\|`trimestral`\|`anual`) · `conceptos` = filas `{categoria, concepto, costo}` |
| 04 | `antes_unidades` · `antes_oportunidades` · `antes_defectos` · `despues_unidades` · `despues_oportunidades` · `despues_defectos` · `desplazamiento` · `meta` · `sigmaEntrada` |
| 05 | `nombre` · `problema` · `metrica` · `unidadMetrica` · `lineaBase` · `meta` · `plazoMeses` · `beneficioAnual` · `costoProyecto` · `dentro` · `fuera` · `moneda` · `cronograma` = 5 filas `{meses}` (Definir, Medir, Analizar, Mejorar, Controlar; la fase es columna fija) |
| 06 | `ctq` = filas `{necesidad, impulsor, ctq, unidad, lsl, objetivo, usl, metodo}` |
| 07 | `criterios` = filas `{nombre, peso}` (peso en puntos porcentuales, p. ej. 40) · `opciones` = filas `{nombre, c1, c2, c3, c4, c5, c6}` (calificación 1–5 por criterio, en el orden de `criterios`; las columnas sobrantes se ocultan) |
| 08 | `criterios` = 4 filas `{nombre}` · `pares` = 6 filas `{valor}` en el orden (1,2) (1,3) (1,4) (2,3) (2,4) (3,4); `valor` es texto o número: `3`, `"1/3"`, `0.5` |
| 09 | `proceso` · `inicio` · `fin` · `filas` = filas `{proveedor, entrada, paso, salida, cliente, requisito}` |
| 10 | `actividades` = filas `{actividad, minutos, clase, tipo}` (`clase`: `VA`\|`SVA`\|`Desperdicio`; `tipo`: uno de los ocho desperdicios o vacío) · `meta` · `wip` · `tasaSalida` |
| 11 | `confianzaA` · `sigma` · `margen` · `unidad` · `poblacionA` · `estratos` · `confianzaB` · `p` · `margenP` · `poblacionB` · `confianzaC` · `potencia` · `sigmaC` · `delta` |
| 12 | `operadores` (`"2"`\|`"3"`) · `repeticiones` (`"2"`\|`"3"`) · `unidad` · `tolerancia` · `mediciones` = filas `{A1, A2, A3, B1, B2, B3, C1, C2, C3}` (una fila por pieza) |
| 13 | `unidad` · `lsl` · `usl` · `media` · `sigma` · `nResumen` · `datos` number[] · `rBarra` · `nSubgrupo` · `sigmaDentro` · `grr` |
| 14 | `estrato` (`Turno`\|`Máquina`\|`Operador`\|`Proveedor`) · `numEstratos` (`"2"`…`"5"`) · `categorias` = filas `{categoria, e1, e2, e3, e4, e5}` · `unidades` · `oportunidades` |
| 15 | `unidad` · `categorias` = filas `{categoria, frecuencia}` · `corte` (50 a 99) |
| 16 | `efecto` · `causas` = filas `{categoria, causa, votos}` (`categoria`: una de las 6M) · `problema` · `cadena` = filas `{respuesta, evidencia, verificada}` (`Sí`\|`No`) · `causaRaiz` · `categoriaRaiz` · `pruebaInversa` (`Sí`\|`No`\|`No sé`) · `contramedida` · `responsable` · `fecha` |
| 17 | `criterio` (`guia`\|`excel`) · `modos` = filas `{paso, modo, efecto, causa, s, o, d}` · `mejoraFila` (`"1"`…`"20"` o vacío) · `sNueva` · `oNueva` · `dNueva` |
| 18 | `unidad` · `nombre1`…`nombre6` · `datos1`…`datos6` number[] · `alfa` · `comparacion` (`tukey`\|`lsd`) |
| 19 | `herramienta` (`regresion`\|`chi`\|`ic`) · `alfa` · regresión: `nombreX` · `unidadX` · `nombreY` · `unidadY` · `datosX` number[] · `datosY` number[] · `xPred` · `yObjetivo` · chi: `numCols` (`"2"`…`"5"`) · `nombresCols` (nombres separados por comas) · `observadas` = filas `{categoria, c1, c2, c3, c4, c5}` · IC: `icN` · `icMedia` · `icS` · `icUnidad` |
| 20 | `etapas` = filas `{etapa, tc, clase, inv, espera, fty}` (`clase`: `VA`\|`SVA`\|`Desperdicio`; `fty` en %) · `demanda` · `disponible` · `mejoraFila` (`""`\|`"1"`…`"12"`) · `esperaNueva` |
| 21 | `minTurno` · `turnos` · `descansos` · `paros` · `demanda` · `periodo` (`dia`\|`semana`) · `diasSemana` · `demandaAnterior` · `contenedor` · `estaciones` = filas `{estacion, tc}` · `pce` · `cambioMin` · `reduccionSmed` · `cambiosTurno` |
| 22 | `modo` (`periodos`\|`factores`) · `periodos` = filas `{periodo, plan, paros, ciclo, prod, buenas}` · `disp` · `rend` · `cal` · `mejoraFactor` (`""`\|`A`\|`P`\|`Q`) · `mejoraValor` |
| 23 | `respuesta` · `objetivo` (`min`\|`max`) · `factores` = 2 filas `{nombre, bajo, alto}` (la letra A o B es columna fija) · `corridas` = 4 filas `{y1, y2, y3, y4, y5}` en el orden (1), a, b, ab (el nombre y los niveles son columnas fijas) · `alfa` · `predA` · `predB` |

Presets obligatorios (ids): 01 `guia`,`rechazos`,`fuerza`,`torque` · 02 `guia`,`tres-sigma`,`seis-sigma`,`fuerza`,`torque` ·
03 `arneses`,`guia-ej2` · 04 `guia`,`excel`,`empaque`,`lineas-ab` (+ ejercicios del M1) · 05 `guia`,`excel` · 06 `libro`,`excel` ·
07 `libro`,`excel` · 08 `guia`,`inconsistente` · 09 `libro`,`excel` · 10 `guia`,`excel`,`credito` · 11 `guia`,`excel` ·
12 `guia`,`excel`,`sesgo` · 13 `guia`,`ej2`,`ej4`,`excel` · 14 `guia`,`excel` · 15 `guia`,`tickets`,`excel`,`hoja` ·
16 `guia`,`excel`,`persona` · 17 `guia`,`empaque`,`excel` · 18 `guia`,`minimo`,`excel`,`sinDiferencia` · 19 `reg-plantilla`,`reg-curva`,
`chi-guia`,`chi-plantilla`,`chi-torque`,`chi-2x2`,`ic-torque`,`ic-examen` · 20 `guia`,`excel` · 21 `guia`,`ej1`,`ej3`,`ej4`,`excel` ·
22 `guia`,`guia-turno`,`excel`,`ej5`,`examen` · 23 `guia`,`excel`,`ej2`,`ej3`,`interaccion`.
