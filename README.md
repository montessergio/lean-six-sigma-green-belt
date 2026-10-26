# Lean Six Sigma Green Belt · Sesiones y laboratorios

Sitio web estático con el material interactivo de la guía **Lean Six Sigma Green Belt** para estudiantes de
Ingeniería Industrial: sesiones por fase DMAIC (teoría condensada en diapositivas), laboratorios que recalculan al
instante y ejercicios vinculados. El hilo conductor es un caso continuo: una **línea de ensamble de arneses eléctricos
para material rodante ferroviario** (300 DPMO → 162 DPMO).

* **Sitio publicado:** <https://montessergio.github.io/lean-six-sigma-green-belt/>
* **Tecnología:** HTML, CSS y JavaScript sin frameworks ni paso de compilación. El contenido está en archivos JSON.
* **Dependencias externas (opcionales):** KaTeX (fórmulas) y Plotly (gráficas), desde CDN. Sin conexión el sitio sigue
  funcionando: las fórmulas se ven como texto y cada gráfica como una tabla con los mismos datos.

## Qué contiene hoy

| Sesión | Fase | Estado | Módulos de la guía | Laboratorios |
|---|---|---|---|---|
| **S0** Cómo usar el material | general | disponible | — | — |
| **S1** Fundamentos cuantitativos y Six Sigma (3 h) | general | disponible | M0, M1 | 01 Estadística descriptiva · 02 Distribución normal · 03 Costo de la mala calidad · 04 DPMO y nivel sigma |
| **S2** Definir: proyecto, VOC, CTQ, mapeo y equipo (4 h) | definir | disponible | M2, M3A, M3B | 05 Project Charter · 06 Árbol CTQ · 07 Matriz de selección ponderada · 08 AHP · 09 SIPOC |
| **S3** Medir: proceso, datos y sistema de medición (4 h) | medir | disponible | M4, M5 | 10 PCE y desperdicios · 11 Tamaño de muestra · 12 Gauge R&R · 13 Cp y Cpk · 14 Hoja de verificación |
| **S4** Analizar: causas raíz e inferencia | analizar | planeada | M6, M7 | 15 Pareto · 16 Ishikawa y 5 Porqués · 17 AMEF · 18 ANOVA · 19 Correlación y regresión |
| **S5** Mejorar: Lean y diseño de experimentos | mejorar | planeada | M8, M9 | 20 VSM · 21 Takt time · 22 OEE · 23 Diseño 2² |
| **S6** Controlar, integrar y sostener | controlar | planeada | M10, M11, M12 | 24 Plan de control · 25 Carta X̄-R · 26 Carta u |

Las sesiones «planeadas» ya tienen su lugar en el índice, su ficha y sus laboratorios previstos; se completan con el
mismo patrón (ver [Cómo agregar contenido](#cómo-agregar-contenido)). El libro y las plantillas de Excel **no** se
publican en este repositorio.

## Cómo usarlo

* Navegación: `←` `→` o `Espacio` cambian de diapositiva, `Inicio` / `Fin` saltan al principio o al final, `i`
  vuelve al índice. En el celular se desliza o se usan los botones redondos.
* Cada diapositiva y cada laboratorio tiene dirección propia: `sesion.html?s=s2#lab07` abre el laboratorio 07.
* Laboratorios: celdas **amarillas** = ejemplo que se puede sobrescribir, **blancas** = tus datos, **azul claro** =
  fórmula. Todos muestran su umbral de interpretación y el supuesto estadístico que hay que revisar, y ninguno
  esconde una respuesta: calculan y muestran sus propios números.
* Imprimir una sesión (Ctrl/Cmd + P) genera una diapositiva por página (los laboratorios no se imprimen).

## Verlo en tu computadora

Los navegadores no leen JSON ni módulos desde `file://`, así que hace falta un servidor local. Con Node 18 o superior:

```bash
node tools/servir.mjs              # y abre http://localhost:8000   (otro puerto: node tools/servir.mjs 3000)
```

Cualquier servidor estático sirve igual (`python3 -m http.server 8000`, por ejemplo). Si abres `index.html` con doble
clic, el sitio lo avisa en pantalla.

## Estructura del repositorio

```
index.html · sesion.html · 404.html   páginas (índice, visor de sesión, error)
content/
  manifest.json                        orden de las sesiones y textos del índice
  caso-arneses.json                    datos del caso continuo (los laboratorios los leen)
  sesiones/<id>/sesion.json            ficha de la sesión + orden de diapositivas
  sesiones/<id>/<módulo>.json          diapositivas de un módulo (se incluyen desde sesion.json)
  plantilla/                           moldes para copiar: sesión, tema y catálogo de diapositivas
labs/                                  un archivo .js por laboratorio (+ _plantilla.js)
js/core/                               motor: visor, bloques, figuras SVG, interfaz de laboratorios, carga
js/lib/                                estadística y generadores de gráficas (módulos puros, sin DOM)
css/                                   tokens de diseño, base, visor, laboratorios, índice
assets/                                fuentes locales, favicon y vista-previa.png (imagen al compartir el enlace)
tests/                                 pruebas de Node (estadística, laboratorios, recursos) y datos de referencia
tools/                                 verificador de contenido, servidor local, exportador de CSV, vendorizador, imagen de vista previa y generador de referencias
docs/                                  CONTENIDO.md · LABS.md · ARQUITECTURA.md · PUBLICAR.md
recursos/                              datos de práctica descargables (CSV generados desde el caso)
```

## Cómo agregar contenido

Todo el texto vive en JSON; el código no contiene contenido. Agregar o corregir una sesión no obliga a tocar la
navegación. Antes de cada subida corre el verificador (ver [Verificación](#verificación)).

| Quiero agregar… | Pasos |
|---|---|
| **Una sesión** | Copia `content/plantilla/sesion.plantilla.json` a `content/sesiones/<id>/sesion.json`, cambia `sN` por el id y agrega el id a `content/manifest.json → sesiones`. |
| **Un módulo (tema)** a una sesión | Copia `content/plantilla/tema.plantilla.json` a `content/sesiones/<id>/<módulo>.json` y añade `{ "incluir": "<módulo>.json" }` a `slides` de la sesión (y el módulo a `modulos`). |
| **Una diapositiva** | Copia la que más se parezca de `content/plantilla/diapositiva.plantilla.json` (catálogo con un ejemplo de cada tipo de bloque) dentro de `slides` de un tema. |
| **Un laboratorio** | Copia `labs/_plantilla.js` a `labs/labNN-nombre.js`, decláralo en `labs` de la sesión, añade `{ "tipo": "lab", "lab": "labNN" }` a `slides` y escribe su `tests/labNN.test.mjs`. Contrato y catálogo en [docs/LABS.md](docs/LABS.md). |
| **Un botón o ejercicio que abre un laboratorio con datos** | Bloques `abrirLab` y `ejercicio` con `valores` (los ids de entrada del laboratorio están en docs/LABS.md §6). |
| **Un tipo de bloque nuevo** | `BLOQUES.mi_tipo = (bloque, ctx) => Nodo` en `js/core/blocks.js` y sus estilos en `css/deck.css`. |
| **Una figura SVG nueva** | Función `(params) → SVGElement` en `js/core/figures.js` y alta en `FIGURAS`. |
| **Un generador de gráfica** | Función en `js/lib/graficas.js` y alta en `GENERADORES`. |

Reglas editoriales (tono, qué cifras se pueden usar, tamaño de una diapositiva) en
[docs/CONTENIDO.md §7](docs/CONTENIDO.md). Una sesión se publica sola al subir los cambios a `main`.

## Verificación

Node 18 o superior; no hay dependencias que instalar.

```bash
node tools/validar-contenido.mjs               # estructura, bloques, enlaces a laboratorios, presets y valores de ejercicios, moldes
node tools/validar-contenido.mjs s2            # solo una sesión
node tools/validar-contenido.mjs --plantillas  # solo los moldes de content/plantilla/
node --test tests/*.test.mjs                   # pruebas de estadística, de cada laboratorio y de recursos/
node tools/exportar-datos.mjs                  # regenera recursos/datos/*.csv si cambia content/caso-arneses.json
```

Atajos con npm (solo ejecutan los mismos comandos; no instalan nada): `npm run verificar` (validador + pruebas), `npm run servir`,
`npm run validar`, `npm test`.

Las pruebas de estadística comparan contra valores de referencia calculados con SciPy
(`tests/referencias-scipy.json`; se regeneran con `python3 tools/generar-referencias.py`, que requiere SciPy).
`node --test` sin argumentos (lo que usa `npm test`) encuentra solas las pruebas de `tests/`; con Node 22 no pases la carpeta
(`node --test tests/` busca un archivo con ese nombre).

## Publicar

GitHub Pages sirve el sitio directamente desde la rama `main` (sin compilar). Los pasos, con la comprobación de
que quedó en línea y qué hacer si algo falla, están en [docs/PUBLICAR.md](docs/PUBLICAR.md).
Todas las rutas son relativas, así que el sitio funciona igual en `usuario.github.io/repositorio/` que en un dominio
propio o en una carpeta de cualquier servidor estático.

## Sin conexión y bibliotecas externas

KaTeX `0.16.11` y Plotly `2.35.2` (paquete *cartesian*) se descargan de jsDelivr y, si falla, de cdnjs/unpkg
(`js/core/config.js`). Sin conexión, el texto, las tablas y **todos los cálculos** siguen funcionando; las fórmulas
se muestran como texto plano y cada gráfica como una tabla con los mismos datos, y un aviso en el pie lo explica.

### Modo sin conexión total

Para un aula sin internet se pueden alojar las dos bibliotecas dentro del propio sitio (unos 2 MB):

```bash
npm install --no-save katex@0.16.11 plotly.js-cartesian-dist-min@2.35.2
node tools/vendorizar.mjs              # copia los archivos a vendor/ (se detiene si las versiones no coinciden)
```

Después pon `VENDOR_LOCAL = true` en `js/core/config.js`. Se usan primero las copias locales y los CDN quedan de respaldo.
Si además vas a publicar `vendor/` en GitHub Pages, quita la línea `/vendor/` de `.gitignore` para poder subirlo.

## Decisiones de arquitectura

Resumen de por qué el sitio es así (datos separados de la presentación, laboratorios como módulos puros,
degradación sin conexión, rutas relativas): [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Licencia y autoría

Material complementario de la guía *Lean Six Sigma Green Belt*. La licencia del código y del contenido está
pendiente de definir por el autor; mientras tanto, todos los derechos reservados. Las tipografías locales
(Inter, Roboto, Montserrat, JetBrains Mono) mantienen su licencia SIL OFL; ver `assets/fuentes/LICENCIAS.txt`.
