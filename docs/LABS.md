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

Presets obligatorios (ids): 01 `guia`,`rechazos`,`fuerza`,`torque` · 02 `guia`,`tres-sigma`,`seis-sigma`,`fuerza`,`torque` ·
03 `arneses`,`guia-ej2` · 04 `guia`,`excel`,`empaque`,`lineas-ab` (+ ejercicios del M1) · 05 `guia`,`excel` · 06 `libro`,`excel` ·
07 `libro`,`excel` · 08 `guia`,`inconsistente` · 09 `libro`,`excel` · 10 `guia`,`excel`,`credito` · 11 `guia`,`excel` ·
12 `guia`,`excel`,`sesgo` · 13 `guia`,`ej2`,`ej4`,`excel` · 14 `guia`,`excel`.
