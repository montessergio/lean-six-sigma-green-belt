# Recursos: datos de práctica

Archivos para practicar en Excel (o en cualquier hoja de cálculo) con **los mismos datos** que cargan los laboratorios del
sitio. Todos pertenecen al caso continuo: una línea de ensamble de arneses eléctricos para material rodante ferroviario.

| Archivo | Contenido | Dónde se usa |
|---|---|---|
| `datos/arneses-torque.csv` | 10 mediciones de torque de terminales (N·m). Especificación: LSL 1.2 · USL 1.5. | Sesión 1 · LAB 01 y 02; Sesión 3 · LAB 13 (Cp y Cpk del torque) |
| `datos/arneses-fuerza-engarzado.csv` | 40 mediciones de fuerza de engarzado (N). El poka-yoke rechaza lo que queda por debajo de 173 N. | Sesión 1 · LAB 01 |
| `datos/arneses-copq-mensual.csv` | 11 conceptos de costo mensual (MXN) por categoría PAF. Ventas mensuales de referencia: 1,500,000 MXN. | Sesión 1 · LAB 03 |
| `datos/arneses-defectos.csv` | Unidades, oportunidades y defectos de la línea base, del resultado final y de las plantillas Excel. | Sesión 1 · LAB 04 |
| `datos/arneses-gauge-rr-asentamiento.csv` | Estudio Gauge R&R de la guía (M5 §4): 60 lecturas de fuerza de asentamiento (N), 10 piezas × 3 operadores × 2 repeticiones, en formato largo (pieza, operador, repetición, fuerza), listo para Minitab o para una tabla dinámica. | Sesión 3 · LAB 12 |
| `datos/arneses-capacidad-engarzado.csv` | 50 mediciones de fuerza de engarzado (N) del ejemplo de la plantilla «Cp-Cpk». Límite inferior de especificación: 173 N. | Sesión 3 · LAB 13 |
| `datos/arneses-hoja-verificacion.csv` | Conteos de defectos por categoría y turno: la semana de la guía (3 defectos) y la plantilla «Hoja de Verificacion» (103 defectos). | Sesión 3 · LAB 14 |

## Cómo abrirlos en Excel

`Datos → Obtener datos → Desde un archivo → Desde texto o CSV`, origen `UTF-8` y delimitador `coma`. Los números usan punto decimal.
Con doble clic también se abren, y el archivo incluye la marca UTF-8 (BOM) para que los acentos se vean bien.

## Cómo se mantienen

Los CSV **no se editan a mano**: se generan desde `content/caso-arneses.json`, la fuente única de las cifras del caso, con

```bash
node tools/exportar-datos.mjs               # escribe o actualiza los archivos
node tools/exportar-datos.mjs --comprobar   # solo verifica que estén al día
```

Una prueba (`tests/recursos.test.mjs`) falla si el JSON cambia y los CSV no se regeneran.

Nota sobre `arneses-defectos.csv`: la guía reporta 162 DPMO tras la mejora (8 semanas × 2,000 arneses × 5 oportunidades);
el conteo entero compatible es 13 defectos, que da 162.5 DPMO sin redondear. El archivo lo señala en la columna `nota`.

Nota sobre `arneses-capacidad-engarzado.csv`: la plantilla «Cp-Cpk» captura el rango medio R̄ = 4.4 y el tamaño de subgrupo 5
como datos aparte (de una carta X̄-R); no se obtienen de estas 50 lecturas agrupadas en orden (darían R̄ = 5.03), por eso el
archivo no trae columna de subgrupo.
