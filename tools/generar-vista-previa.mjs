#!/usr/bin/env node
/**
 * generar-vista-previa.mjs — Genera assets/vista-previa.png (1200×630): la imagen que aparece al compartir el
 * enlace del sitio en WhatsApp, LinkedIn o X (etiquetas og:image de index.html).
 *
 *   npm install --no-save playwright && npx playwright install chromium     # una vez; no es dependencia del sitio
 *   node tools/generar-vista-previa.mjs [salida.png]                         # por omisión assets/vista-previa.png
 *
 * Reutiliza el propio motor del sitio (rueda DMAIC y sello σ de js/core/figures.js) y los estilos de la portada, así que
 * sale con la misma identidad que el libro. Los textos se cambian en las constantes de abajo.
 *
 * Tamaño: WhatsApp ignora vistas previas de más de ≈300 KB. El PNG que sale del navegador pesa cerca de 300 KB; el publicado
 * se comprimió a 256 colores (p. ej. con Pillow: Image.quantize(256) o con TinyPNG) y pesa ≈120 KB sin pérdida visible.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.resolve(process.argv[2] ?? path.join(RAIZ, 'assets/vista-previa.png'));

/* ---- Textos de la imagen ---- */
const PILDORA = 'MATERIAL COMPLEMENTARIO DE LA GUÍA';
const TITULO = ['Lean Six Sigma', 'Green Belt'];
const SUBTITULO = 'Sesiones y laboratorios interactivos';
const CURSO = 'Para estudiantes de Ingeniería Industrial';
const LINEA = 'Fases DMAIC · Cálculos al instante · Caso: línea de arneses';

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('Falta Playwright. Instálalo con:  npm install --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const servidor = http.createServer((req, res) => {
  const ruta = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!ruta.startsWith(RAIZ + path.sep) || !existsSync(ruta) || statSync(ruta).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(ruta)] ?? 'application/octet-stream' });
  createReadStream(ruta).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${servidor.address().port}/`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="css/fuentes.css"><link rel="stylesheet" href="css/tokens.css"><link rel="stylesheet" href="css/base.css"><link rel="stylesheet" href="css/deck.css">
<style>
  body { margin: 0; overflow: hidden; }
  .slide--portada .slide__contenido { padding-top: 2.2rem; }
  .slide--portada .portada__titulo { font-size: 100px; line-height: 0.98; margin-top: 1.1rem; }
  .slide--portada .portada__subtitulo { font-size: 22px; margin-top: 1.3rem; }
  .slide--portada .portada__curso { font-size: 24px; }
  .slide--portada .portada__linea { font-size: 14px; }
  .slide--portada .portada__rueda { width: 560px; right: -40px; opacity: 0.26; }
  .slide--portada .portada__sello { width: 124px; right: 70px; bottom: 44px; }
</style></head>
<body class="deck-page"><div class="deck" id="deck"></div>
<script type="module">
  import { crearFigura } from './js/core/figures.js';
  import { h } from './js/core/dom.js';
  const titulo = ${JSON.stringify(TITULO)};
  const el = h('section', { class: 'slide slide--portada is-activa' },
    h('div', { class: 'portada__rueda' }, crearFigura('rueda', { etiquetas: false, centro: '' })),
    h('div', { class: 'slide__contenido' },
      h('span', { class: 'pildora' }, ${JSON.stringify(PILDORA)}),
      h('h1', { class: 'portada__titulo' }, titulo.flatMap((t, i) => (i ? [h('br'), t] : [t]))),
      h('p', { class: 'portada__subtitulo' }, ${JSON.stringify(SUBTITULO)}),
      h('div', { class: 'portada__barra' }),
      h('p', { class: 'portada__curso' }, ${JSON.stringify(CURSO)}),
      h('p', { class: 'portada__linea' }, ${JSON.stringify(LINEA)})
    ),
    h('div', { class: 'portada__sello' }, crearFigura('sello', {}))
  );
  document.getElementById('deck').appendChild(el);
  await document.fonts.ready;
  document.body.dataset.listo = '1';
</script></body></html>`;

const navegador = await chromium.launch();
try {
  const page = await (await navegador.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: 'es-MX' })).newPage();
  await page.route(`${url}__vista-previa.html`, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(`${url}__vista-previa.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('body[data-listo="1"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: SALIDA });
  console.log(`Escrito ${path.relative(process.cwd(), SALIDA) || SALIDA} (1200×630, ${(statSync(SALIDA).size / 1024).toFixed(0)} KB)`);
} finally {
  await navegador.close();
  servidor.close();
}
