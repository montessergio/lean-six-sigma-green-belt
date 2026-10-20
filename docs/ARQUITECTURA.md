# Decisiones de arquitectura

Resumen breve de **por qué** el sitio está construido así. Cada decisión dice el problema, lo que se eligió, lo
que se descartó y lo que cuesta. Para **cómo** agregar contenido, ver el [README](../README.md),
[CONTENIDO.md](CONTENIDO.md) y [LABS.md](LABS.md).

## Vista general

```
content/ (JSON)  ──►  loader.js  ──►  deck.js ──► blocks.js / figures.js     (teoría en diapositivas)
                                          └────► lab-ui.js ──► labs/labNN.js  (laboratorios)
                                                      └─ calcular() puro ──► js/lib/stats.js
```

* **Datos** (`content/`): todo el texto, el orden de las diapositivas y las cifras del caso. Ningún dato vive en el código.
* **Motor** (`js/core/`): lee los datos y los pinta. No conoce estadística ni el contenido de ninguna sesión.
* **Cálculo** (`js/lib/` y `labs/`): módulos puros, sin DOM, que se prueban en Node y corren igual en el navegador.

## 1. Sitio estático sin compilación (HTML, CSS y JavaScript sin frameworks)

* **Problema.** El material debe publicarse gratis en GitHub Pages y poder mantenerlo una sola persona durante años.
* **Decisión.** Archivos estáticos con módulos ES nativos. No hay `npm install`, empaquetador ni paso de compilación:
  lo que se edita es lo que se publica.
* **Descartado.** Jekyll/Hugo/Astro (añaden una cadena de herramientas que envejece) y React/Vue (poco que ganar en un
  visor de diapositivas y calculadoras, y mucho que mantener).
* **Costo.** Sin plantillas ni componentes con reactividad: el motor construye el DOM con una utilidad mínima
  (`js/core/dom.js`). A cambio, cualquier navegador moderno lo ejecuta y el repositorio entero se lee en una tarde.

## 2. El contenido son datos (JSON), separados de la presentación

* **Problema.** Agregar una sesión o un módulo no debe obligar a tocar la navegación ni arriesgar lo que ya funciona.
* **Decisión.** `manifest.json` lista las sesiones; cada `sesion.json` es su ficha y el orden de sus diapositivas;
  cada módulo es un archivo de tema que se incluye con una línea (`{ "incluir": "m2.json" }`). La fase DMAIC de una
  sesión sale de su propio JSON: no hay una segunda lista que mantener.
* **Descartado.** Markdown con *front matter*: es más cómodo de escribir, pero exige un intérprete y no impone
  estructura. JSON permite **verificar** el contenido (decisión 7) y lo hace predecible para el motor.
* **Costo.** Editar JSON es menos amable que escribir prosa. Se compensa con los moldes de `content/plantilla/`, las marcas
  en línea (`**negrita**`, `x_{i}`) y el verificador.
* **Límite conocido.** Una cifra del caso aparece en `caso-arneses.json` (la leen los laboratorios) **y** escrita en el
  texto de algunas diapositivas. Si cambia un dato, hay que revisar ambos sitios.

## 3. Bloques tipificados en lugar de HTML libre

* **Decisión.** Una diapositiva es una lista de bloques (`texto`, `tarjeta`, `tabla`, `formula`, `metricas`, `figura`,
  `abrirLab`, `ejercicio`…). Cada tipo es una función registrada en `js/core/blocks.js`.
* **Por qué.** Mantiene un diseño uniforme y obliga a que cada diapositiva sea corta y revisable. Además es más
  seguro: el texto entra por `textContent` o por `inline()`, que solo admite unas pocas marcas; **nunca** se asigna
  `innerHTML` con contenido de los JSON, de modo que un error de dedo no rompe la página.
* **Costo.** Un diseño que no encaje en un bloque pide crear uno nuevo (una función y su CSS). Es intencional.

## 4. Laboratorios como módulos puros y declarativos

* **Problema.** Cada laboratorio debe ser fiel a su plantilla de Excel, editable con recálculo inmediato, sin respuestas
  ocultas, y verificable.
* **Decisión.** Un laboratorio es un archivo en `labs/` que **describe** sus entradas, presets, umbral de interpretación,
  supuesto estadístico y preguntas, y expone `calcular(estado, ctx)`, una función pura que devuelve salidas,
  semáforos, tablas y gráficas **como datos**. La interfaz (`lab-ui.js`) es genérica: pinta campos, recalcula en cada
  cambio y dibuja lo que reciba. El laboratorio nunca toca el DOM.
* **Consecuencias.** (a) Se prueba en Node sin navegador, con valores de referencia de SciPy y cifras publicadas en la guía.
  (b) Un laboratorio nuevo no toca el motor. (c) El código de color de Excel (amarillo = ejemplo, blanco = captura,
  azul claro = fórmula) y los semáforos se aplican igual en todos.
* **Regla editorial.** Todo laboratorio muestra su **umbral** y su **supuesto**, y ninguno dice «correcto/incorrecto».
  Los umbrales que no vienen de la guía ni de Excel se rotulan «referencia didáctica».

## 5. Capa de datos única y caso continuo

* `js/core/loader.js` es el único lugar que conoce rutas de archivos y el único que lee `fetch`. Sus errores explican qué
  archivo falló y se muestran tal cual en pantalla.
* `content/caso-arneses.json` concentra las cifras de práctica (la línea de arneses: 300 → 162 DPMO, torque, fuerza de
  engarzado, COPQ, charter, CTQ, SIPOC…) y llega a los laboratorios como `ctx.caso`. Cada cifra declara su fuente (guía o
  plantilla Excel) en un campo `_fuente`.

## 6. Dependencias externas opcionales, con degradación

* **Decisión.** KaTeX (fórmulas) y Plotly (gráficas) se cargan desde CDN con varios espejos y tiempo límite. El contenido y
  **todos los cálculos** no dependen de ellas. Sin conexión: la fórmula se ve como texto (`texto` es obligatorio en el
  bloque `formula`), cada gráfica es una tabla con los mismos datos (`respaldo` obligatorio) y el pie avisa del modo.
* **Respaldo para aulas sin red.** `node tools/vendorizar.mjs` copia ambas bibliotecas a `vendor/`; con
  `VENDOR_LOCAL = true` se usan primero y los CDN quedan de respaldo.
* **Sin SRI.** Las versiones están fijadas (KaTeX 0.16.11, Plotly 2.35.2, paquete *cartesian*). Un hash desactualizado
  bloquearía la carga por completo, que es peor que el riesgo que evita en un sitio sin datos de usuarios.
* **Costo.** Plotly *cartesian* no dibuja pasteles, mapas ni 3D; los laboratorios se diseñan con barras, líneas y dispersión.

## 7. Verificación automática del contenido y del cálculo

* `tools/validar-contenido.mjs` lee los JSON como lo haría el motor y comprueba tipos de bloque, campos obligatorios,
  ids únicos, enlaces diapositiva → laboratorio y que **cada preset y cada `valores` de un ejercicio** use entradas
  reales y produzca un resultado válido (ejecuta el laboratorio). También valida los moldes de `content/plantilla/`, así
  que no se desactualizan. Avisa de diapositivas demasiado densas.
* `tests/` prueba la estadística contra SciPy y cada laboratorio con las cifras de la guía y de las plantillas Excel.
* Las revisiones de navegador (recorrido de diapositivas en escritorio y móvil, modo sin conexión) se hicieron con Playwright
  y no forman parte del repositorio para que no exija instalar nada.

## 8. Publicación en GitHub Pages: rutas relativas y enlaces con `#`

* Todas las rutas son **relativas**, así que el sitio funciona en `usuario.github.io/repositorio/`, en un dominio propio o
  en cualquier carpeta de un servidor estático. `.nojekyll` evita que Pages ignore archivos que empiezan con `_`.
* Los enlaces profundos usan `#` (`sesion.html?s=s2#lab07`): Pages no reescribe rutas, y así no se necesita un enrutador.
  `404.html` muestra una página de error con el mismo diseño.
* Para compartir el enlace, `index.html` lleva etiquetas Open Graph con **dos URL absolutas** (`og:url` y `og:image`):
  si cambias el dominio, actualízalas.

## 9. Visor con formato de presentación

* Una sesión es un conjunto de diapositivas navegables con teclado, botones y gesto táctil; cada diapositiva y cada
  laboratorio tiene dirección propia, y las diapositivas de teoría se pueden imprimir (una por página). Los laboratorios se
  descargan al llegar a ellos, así que abrir una sesión no pide todo el código.
* En pantallas bajas el espaciado se compacta; si una diapositiva aun así no cabe, se desplaza dentro de su marco. La
  regla editorial es una idea por diapositiva (≈110 palabras, ≤ 6 bloques).

## 10. Roadmap visible: sesiones «planeadas»

Las sesiones 3 a 6 ya aparecen en el índice con su fase, sus módulos y los laboratorios previstos, pero no se abren.
Completarlas no cambia el motor: se escribe su contenido y los laboratorios con el mismo patrón y se cambia su `estado`
a `disponible`.

## Lo que se dejó fuera a propósito

* **El libro y las plantillas de Excel** no se publican en el repositorio: son el producto; el sitio es su complemento.
* **Cuentas, analítica y base de datos:** el sitio no recoge datos de nadie; lo que el estudiante captura vive solo en su navegador.
* **Búsqueda y varios idiomas:** no hacen falta con siete sesiones; el índice agrupa por fase y cada sesión tiene su contenido.
