# Contenido: sesiones, temas y bloques

Todo el texto del sitio vive en archivos JSON dentro de `content/`. El código (`js/`) no contiene contenido:
agregar o corregir una sesión **no obliga a tocar la navegación**.

```
content/
  manifest.json                 lista ordenada de sesiones + textos de la página de inicio
  caso-arneses.json             datos del caso continuo (los laboratorios los leen con ctx.caso)
  sesiones/<id>/sesion.json     ficha de la sesión + orden de las diapositivas
  sesiones/<id>/<tema>.json     diapositivas de un módulo o tema (se incluyen desde sesion.json)
  plantilla/                    moldes para copiar (sesión, tema, diapositiva)
labs/                           un archivo .js por laboratorio (ver docs/LABS.md)
```

## 1. `sesion.json`

```jsonc
{
  "id": "s1",                         // = nombre de la carpeta
  "numero": 1,
  "estado": "disponible",             // «disponible» | «planeada»
  "titulo": "Fundamentos cuantitativos y Six Sigma",
  "fase": "general",                  // general | definir | medir | analizar | mejorar | controlar
  "duracion": "3 h", "duracionMin": 180,
  "descripcion": "1–2 frases para la tarjeta del índice.",
  "portada": { "pildora": "SESIÓN 1 · 3 H · MÓDULOS 0 Y 1", "titulo": "…", "subtitulo": "…",
               "curso": "LEAN SIX SIGMA GREEN BELT", "lineas": ["…", "…"],
               "sello": { "arriba": "CASO APLICADO", "abajo": "LABORATORIOS INTERACTIVOS", "simbolo": "σ" } },
  "modulos": [ { "id": "M0", "nombre": "…", "fase": "general" } ],
  "labs":    [ { "id": "lab01", "numero": "01", "nombre": "Estadística descriptiva", "archivo": "lab01-estadistica-descriptiva.js" } ],
  "slides": [
    { "tipo": "portada" },                       // la portada se construye con el campo «portada»
    { "incluir": "m0.json" },                    // inserta las diapositivas de ese tema
    { "tipo": "lab", "lab": "lab01" },           // diapositiva de laboratorio (debe estar en «labs»)
    { "titulo": "Una diapositiva escrita aquí mismo", "bloques": [ … ] }
  ]
}
```

* Un laboratorio **sin** `archivo` (o con `"estado": "planeada"`) aparece en el índice como «planeado» y no se abre.
* La sesión se añade al sitio agregando su `id` a `content/manifest.json → sesiones`.
* Una sesión `planeada` lleva una diapositiva con el bloque `planeada` (ver §4).

## 2. Archivo de tema (`m0.json`, `m1.json`, …)

```jsonc
{ "id": "m0", "titulo": "M0 · Fundamentos cuantitativos", "slides": [ { …diapositiva… }, { … } ] }
```

Cada diapositiva incluida recibe `tema: "m0"` automáticamente. Un tema por módulo de la guía mantiene los
archivos pequeños y revisables.

## 3. Diapositiva de contenido

```jsonc
{
  "id": "m0-normal",                  // opcional pero recomendado: ancla de enlace (sesion.html?s=s1#m0-normal); único en la sesión
  "etiqueta": "M0 · DISTRIBUCIÓN NORMAL",   // texto pequeño en verde sobre el título
  "titulo": "La regla empírica: 68 – 95 – 99.7",
  "subtitulo": "Una frase de apoyo en gris claro.",
  "clase": "mi-clase-css",            // opcional
  "bloques": [ { "tipo": "texto", … }, { "tipo": "grafica", … } ]
}
```

La página es una diapositiva de 16:10; el cuerpo **no se desplaza** en pantallas grandes, así que cada diapositiva debe
caber: **≤ 6 bloques y ≈ 110 palabras visibles**, tablas de ≤ 7 filas, listas de ≤ 6 elementos. Si no cabe, parte la
diapositiva en dos (`…-a`, `…-b`). En pantallas pequeñas el contenido se apila y sí se desplaza.

## 4. Bloques

| `tipo` | Campos | Uso |
|---|---|---|
| `texto` | `texto`, `tenue`, `ancho` | párrafo (gris claro; `tenue` más apagado) |
| `lista` | `items[]`, `ordenada`, `limpia` | viñetas o lista numerada |
| `titulo` | `texto` | subtítulo de bloque |
| `tarjeta` | `etiqueta`, `titulo`, `texto` (o `textos[]`), `items[]`, `ordenada`, `estilo` (`grande`, `sutil`, `acento`, `aviso`, `coral`; uno o varios) | caja con borde |
| `nota` | como `tarjeta`; etiqueta «NOTA» por omisión, borde ámbar | advertencia o dato clave |
| `rejilla` | `columnas`, `tarjetas[]` (campos de `tarjeta`) **o** `hijos[]` (cualquier bloque) | 2–4 tarjetas en fila |
| `columnas` | `proporcion:[1,1]`, `izq[]`, `der[]` (listas de bloques), `alinear` | texto a un lado y figura/gráfica al otro |
| `pasos` | `titulo`, `pasos[]` (texto o `{texto, sub, numero, fase}`), `columnas`, `inicio` | botones rectangulares numerados con numeral verde (como en las referencias) |
| `formula` | `tex` (KaTeX), `texto` (respaldo sin conexión, **obligatorio**), `etiqueta`, `nota` | fórmula destacada |
| `tabla` | `titulo`, `columnas[]` (texto o `{t, num:true}`), `filas[][]`, `resaltar[]` (índices), `pie` | tabla de datos |
| `leyenda` | `items[{ muestra, texto }]`; `muestra` ∈ `ejemplo`, `captura`, `formula`, `cumple`, `atencion`, `critico`, `informativo`, `sin-datos` | código de color y semáforos |
| `metricas` | `items[{ valor, etiqueta, nota, color }]`, `columnas`; `color` ∈ `teal`, `azul`, `coral`, `ambar`, `verde`, `violeta` | cifras grandes (p. ej. 300 DPMO → 162 DPMO) |
| `figura` | `figura`, `params`, `pie`, `anchoMax` | SVG generado (ver §6) |
| `grafica` | `generador` + `params`, **o** `datos[]` + `layout` + **`respaldo`** `{columnas, filas}`; `titulo`, `pie`, `alto` (px) | gráfica Plotly con tabla de respaldo |
| `imagen` | `src`, `alt`, `pie` | imagen local (evítala: todo lo posible va como figura SVG) |
| `abrirLab` | `lab`, `valores`, `texto` | botón que abre un laboratorio y le carga datos |
| `ejercicio` | `numero`, `titulo`, `texto`, `verificacion`, `etiquetaVerificacion`, `lab`, `numeroLab`, `valores`, `boton`, `etiqueta` | ejercicio vinculado a un laboratorio |
| `ejercicios` | `items[]` (campos de `ejercicio`), `columnas` | varios ejercicios en rejilla |
| `cierre` | `puntos[]` | lista numerada de ideas para llevarse |
| `referencias` | `titulo`, `items[]` | referencias bibliográficas |
| `enlaces` | `items[{ texto, href, nota }]` | enlaces |
| `planeada` | `nota`, `modulos[{id,titulo}]`, `labs[{id,titulo}]` | sesión pendiente de completar |

### Marcas en línea (cualquier texto)

`**negrita**` · `*cursiva*` · `` `código` `` · `[texto](https://…)` · `x^{2}` (superíndice) · `x_{i}` (subíndice) ·
`\n` (salto de línea). Cualquier otro HTML se muestra como texto literal. Evita un `*` suelto (cursiva accidental).
Símbolos como σ, μ, x̄, ≤, ≥, ×, ÷, √, Σ, α se escriben directamente en Unicode.

### Fórmulas

```json
{ "tipo": "formula", "etiqueta": "DPMO", "tex": "\\text{DPMO}=\\frac{D}{U\\times O}\\times 10^{6}",
  "texto": "DPMO = D ÷ (U × O) × 1,000,000", "nota": "D = defectos, U = unidades, O = oportunidades por unidad" }
```

Con conexión se renderiza con KaTeX; sin conexión se muestra `texto`, que por eso es obligatorio y debe leerse bien solo.

### Ejercicios vinculados a laboratorios

```json
{ "tipo": "ejercicio", "numero": "2", "titulo": "Costo de la mala calidad",
  "texto": ["Una planta registra costos de …", "Calcula el COPQ como porcentaje de las ventas."],
  "lab": "lab03", "numeroLab": "03", "valores": { "ventas": 8000, "conceptos": [ … ] },
  "verificacion": "La guía obtiene un COPQ de 7.5 % de las ventas.", "etiquetaVerificacion": "Comparar con la guía" }
```

* `valores` usa los **ids de entrada** del laboratorio (`docs/LABS.md`); el botón abre el laboratorio y carga esos
  datos. Si el ejercicio coincide con un preset, repite sus valores (o usa un preset dedicado en el laboratorio).
* `verificacion` es la cifra publicada en la guía para que el estudiante **contraste** su resultado; no es una
  respuesta oculta del sistema: el laboratorio calcula y muestra sus propios números.
* Sin `lab`, el ejercicio muestra la etiqueta «Con calculadora o Excel».

## 5. Figuras (`bloque figura`)

| `figura` | `params` |
|---|---|
| `rueda` | `color`, `trazo`, `resaltar` (id de fase), `etiquetas`, `centro` — ciclo DMAIC |
| `campana` | `mu`, `sigma`, `bandas:[1,2,3]`, `decimales`, `unidad` — normal con bandas ±kσ |
| `curva-sigma` | `nivel`, `desplazamiento` — curva con el desplazamiento de 1.5σ |
| `arbol` | `voz`, `necesidad`, `impulsores:[{texto, ctq}]` — árbol necesidad → impulsor → CTQ |
| `simbolos-flujo` | — símbolos del diagrama de flujo |
| `sipoc` | `proveedores[]`, `entradas[]`, `pasos[]`, `salidas[]`, `clientes[]` |
| `sello` | `arriba`, `abajo`, `simbolo` |

Para agregar una figura nueva: función `(params) → SVGElement` en `js/core/figures.js` y alta en `FIGURAS`.

## 6. Gráficas (`bloque grafica`)

Con `generador` (parámetros mínimos, ver `GENERADORES` en `js/lib/graficas.js`):

* `normal`: `{ mu, sigma, bandas, unidad }` — curva con bandas ±kσ.
* `sigma-dpmo`: `{ desplazamiento, puntos:[{ nombre, dpmo }] }` — DPMO vs. nivel sigma (eje log).
* `barras`: `{ categorias[], valores[], unidad, formato:'pct'|'num', color, horizontal }`.

O con trazas de Plotly directamente (`datos`, `layout`, `respaldo`). Reglas: el bundle es *cartesian* (sin `pie`);
la gráfica se dibuja al mostrar la diapositiva; siempre hay `respaldo` (tabla para el modo sin conexión); colores
de `js/core/config.js → COLOR`; títulos y ejes en español.

## 7. Estilo editorial

* Tono **sobrio y técnico**, español de México, tuteo, frases cortas. Nada de promesas comerciales ni signos de
  exclamación. Los términos en inglés solo cuando son de uso común (Gauge R&R, poka-yoke, *lead time*).
* **Toda cifra sale de la guía, de las plantillas Excel o del caso** (`content/caso-arneses.json`). No inventes datos.
  Un umbral que no venga de esas fuentes se rotula «referencia didáctica».
* El texto es una **condensación** de la guía (no un copia y pega): una idea por diapositiva, el porqué antes que el
  procedimiento, y siempre el vínculo con el caso de la línea de arneses cuando exista.
* Cada diapositiva con cálculo termina apuntando a su laboratorio (`abrirLab`).
* Cada sesión cierra con una diapositiva `cierre` (qué te llevas) y otra de `referencias` (las de la guía).
* Accesibilidad: no dependas solo del color (semáforos con símbolo), `alt` en imágenes, contraste alto.

## 8. Cómo agregar…

**Una sesión nueva**: crea `content/sesiones/sN/sesion.json` (copia `content/plantilla/sesion.plantilla.json`) y
agrega `"sN"` a `manifest.json`. **Un módulo a una sesión**: crea `sN/mX.json` y añade `{ "incluir": "mX.json" }` a
`slides` (y el módulo a `modulos`). **Un laboratorio**: ver `docs/LABS.md §5`. **Un tipo de bloque**: función en
`js/core/blocks.js` (`BLOQUES.mi_tipo = (bloque, ctx) => Nodo`) + estilos en `css/deck.css`.

## 9. Verificación

```
node tools/validar-contenido.mjs            # estructura, bloques, enlaces a laboratorios y valores de presets
node tools/validar-contenido.mjs --sin-labs # solo estructura (si el laboratorio aún no existe)
```

El verificador falla con un mensaje por problema (archivo, diapositiva y campo). Úsalo antes de cada subida.
