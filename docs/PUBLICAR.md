# Publicar en GitHub Pages

El sitio es estático: **no hay nada que compilar**. GitHub Pages sirve la carpeta del repositorio tal cual, así que
publicar es subir los archivos a la rama `main`.

* Repositorio: <https://github.com/montessergio/lean-six-sigma-green-belt>
* Sitio: <https://montessergio.github.io/lean-six-sigma-green-belt/>
* Configuración actual: `Settings → Pages → Deploy from a branch → main / (root)`.

## 1. Requisitos

* Una cuenta de GitHub y un repositorio **público** (en el plan gratuito, Pages solo publica repositorios públicos).
* `index.html` en la **raíz** del repositorio y un archivo vacío `.nojekyll` (ya están). Sin `.nojekyll`, Pages procesa el sitio con Jekyll
  e ignora los archivos que empiezan con `_`, como `labs/_plantilla.js`.
* Rutas **relativas** en todo el código (ya lo son). Una ruta que empiece con `/` rompe el sitio en `usuario.github.io/repositorio/`.

## 2. Subir el código por primera vez

Desde la carpeta del proyecto, con `git` instalado y sesión iniciada en GitHub:

```bash
git init -b main
git add .
git commit -m "Sitio Lean Six Sigma Green Belt"
git remote add origin https://github.com/<usuario>/<repositorio>.git
git push -u origin main
```

Sin `git`, también sirve el botón `Add file → Upload files` de la página del repositorio: arrastra **el contenido** de la
carpeta (no la carpeta contenedora) y conserva las subcarpetas. Para muchos archivos, GitHub Desktop es más cómodo.

## 3. Activar GitHub Pages (una sola vez)

1. En el repositorio, abre **Settings** (Configuración).
2. En el menú izquierdo, **Pages**.
3. En **Build and deployment → Source**, elige **Deploy from a branch**.
4. En **Branch**, elige `main` y la carpeta `/ (root)`; pulsa **Save**.
5. Espera de uno a diez minutos la primera vez. Arriba de esa misma página aparece **«Your site is live at …»** con la dirección.

## 4. Comprobar que quedó en línea

1. Pestaña **Actions**: debe haber una ejecución **«pages build and deployment»** con la palomita verde.
2. Abre la dirección del sitio. Debe verse el índice con las siete sesiones (S0 a S6) agrupadas por fase.
3. Abre la sesión 1 y avanza con `→`. Después entra directamente a `…/sesion.html?s=s1#lab04`: se abre el laboratorio de DPMO con su gráfica.
4. Recarga (F5) esa misma dirección: debe volver al mismo laboratorio (los enlaces con `#` no dependen del servidor).
5. Escribe una dirección que no exista (`…/nada`): debe aparecer la página «Esta página no existe».
6. Abre la consola del navegador (F12): no debe haber errores en rojo.

## 5. Publicar un cambio (flujo diario)

```bash
node tools/validar-contenido.mjs      # estructura, enlaces, presets y ejercicios (debe terminar con 0 errores)
node --test tests/*.test.mjs          # pruebas de estadística y laboratorios
git add -- ruta/del/archivo …
git commit -m "Describe el cambio"
git push
```

Pages vuelve a publicar solo al recibir el `push` (de uno a dos minutos; se ve en **Actions**). Los JSON se revalidan en cada
visita, pero el navegador puede guardar hasta 10 minutos las hojas de estilo y los scripts: si no ves un cambio, recarga con
`Ctrl + F5` (en Mac, `Cmd + Shift + R`). Para ver el sitio en tu computadora **antes** de subir:

```bash
node tools/servir.mjs                 # http://localhost:8000
```

## 6. Dominio propio (opcional)

1. `Settings → Pages → Custom domain`: escribe el dominio (por ejemplo, `greenbelt.midominio.com`) y guarda. GitHub crea un archivo `CNAME` en el repositorio; no lo borres.
2. En el proveedor del dominio, crea el registro DNS: para un subdominio, un `CNAME` hacia `montessergio.github.io`; para el dominio raíz,
   cuatro registros `A` hacia `185.199.108.153`, `185.199.109.153`, `185.199.110.153` y `185.199.111.153`.
3. Cuando GitHub verifique el dominio, activa **Enforce HTTPS**.
4. Actualiza las **dos URL absolutas** de las etiquetas Open Graph en `index.html` (`og:url` y `og:image`) y el enlace del README.
   Las rutas del sitio no cambian: son relativas. La imagen que se ve al compartir el enlace es `assets/vista-previa.png`
   (1200×630); si cambias el título, se regenera con `node tools/generar-vista-previa.mjs` (instrucciones al inicio de ese archivo).

## 7. Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| La dirección del sitio da **404** | Pages no está activado, o apunta a otra rama o carpeta | Repite el paso 3; confirma que `index.html` está en la raíz de `main`. |
| Pantalla en blanco o «Cargando…» | Un JSON mal escrito o un archivo no encontrado | Abre la consola (F12) y lee el mensaje; ejecuta `node tools/validar-contenido.mjs`. |
| Funciona en tu computadora pero no en Pages | Mayúsculas o minúsculas: Pages distingue `Lab01.js` de `lab01.js` | Haz que el nombre del archivo y el de la referencia coincidan exactamente. |
| Banner rojo «Abre el sitio con un servidor web» | Abriste `index.html` con doble clic (`file://`) | Usa `node tools/servir.mjs` o la dirección de Pages. |
| Sin estilos, tipografías ni imágenes | Rutas que empiezan con `/` | Cámbialas a relativas (`css/base.css`, no `/css/base.css`). |
| Fórmulas como texto y gráficas como tablas | El CDN está bloqueado o no hay internet (red escolar, avión) | Es el modo de respaldo; para aulas sin red, ver «Modo sin conexión total» en el README. |
| Tu cambio no aparece | Despliegue fallido o caché del navegador | Revisa **Actions** (si hay una cruz roja, abre el registro); recarga con `Ctrl + F5`. |
| Un laboratorio no abre | Falta el archivo en `labs/` o su `archivo` está mal escrito en `sesion.json` | El verificador indica cuál. |

## 8. Límites de uso de GitHub Pages

Según su documentación, el sitio publicado no debe pasar de 1 GB, el tráfico tiene un límite orientativo de 100 GB al mes y
se recomienda no superar 10 publicaciones por hora. Este sitio pesa alrededor de 1 MB (más unos 2 MB si publicas la carpeta opcional `vendor/`).
Si algún día el tráfico lo supera, la misma carpeta funciona sin cambios en Netlify, Cloudflare Pages o cualquier servidor
estático: no hay comando de compilación y la carpeta de publicación es la raíz.
