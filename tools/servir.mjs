#!/usr/bin/env node
/**
 * servir.mjs — Servidor local para ver el sitio antes de publicarlo (Node ≥ 18, sin dependencias).
 *
 *   node tools/servir.mjs              # http://localhost:8000
 *   node tools/servir.mjs 3000         # otro puerto
 *
 * Hace falta un servidor porque los navegadores no leen JSON ni módulos ES desde file://.
 * Escucha solo en esta computadora (127.0.0.1) y no guarda nada en caché, para ver cada cambio al recargar.
 * Se comporta como GitHub Pages: sirve index.html en las carpetas y 404.html cuando no existe la ruta.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.argv[2] ?? process.env.PORT ?? 8000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/** Devuelve la ruta de archivo a servir, o null si no existe o se sale de la carpeta del sitio. */
function resolver(urlPath) {
  let ruta;
  try { ruta = decodeURIComponent(urlPath); } catch { return null; }
  const abs = path.join(RAIZ, ruta);
  if (abs !== RAIZ && !abs.startsWith(RAIZ + path.sep)) return null;
  if (!existsSync(abs)) return null;
  const st = statSync(abs);
  if (st.isDirectory()) {
    const indice = path.join(abs, 'index.html');
    return existsSync(indice) ? indice : null;
  }
  return abs;
}

const servidor = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const archivo = resolver(pathname);
  const estado = archivo ? 200 : 404;
  const destino = archivo ?? path.join(RAIZ, '404.html');
  res.writeHead(estado, {
    'content-type': MIME[path.extname(destino).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(destino).pipe(res);
  console.log(`${estado} ${pathname}`);
});

servidor.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `El puerto ${PUERTO} está ocupado. Prueba con otro: node tools/servir.mjs 3000` : e.message);
  process.exit(1);
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Sirviendo ${RAIZ}\nAbre http://localhost:${PUERTO}  (Ctrl+C para salir)\n`);
});
