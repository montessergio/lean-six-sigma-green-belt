#!/usr/bin/env node
/**
 * vendorizar.mjs — Copia KaTeX y Plotly a vendor/ para usar el sitio sin internet (aulas sin red).
 *
 *   npm install --no-save katex@0.16.11 plotly.js-cartesian-dist-min@2.35.2
 *   node tools/vendorizar.mjs
 *
 * Después pon VENDOR_LOCAL = true en js/core/config.js. El sitio intentará primero estas copias y
 * conservará los CDN como respaldo. La carpeta vendor/ está en .gitignore: para publicarla en GitHub
 * Pages, quita la línea «/vendor/» de .gitignore y súbela (pesa unos 2 MB).
 *
 * Opciones:
 *   --desde <carpeta>   node_modules de origen (por omisión ./node_modules)
 *   --a <carpeta>       carpeta de destino (por omisión ./vendor)
 *
 * Las versiones que se esperan son las de js/core/config.js; si las instaladas difieren, el script se detiene
 * (una versión distinta podría comportarse de otra forma que la probada).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEPENDENCIAS } from '../js/core/config.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valor = (opcion, porOmision) => {
  const i = args.indexOf(opcion);
  return i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : porOmision;
};
const ORIGEN = valor('--desde', path.join(RAIZ, 'node_modules'));
const DESTINO = valor('--a', path.join(RAIZ, 'vendor'));

const falla = (msg) => {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
};

/** Comprueba que el paquete exista y tenga la versión que fija config.js. */
function paquete(nombre, versionEsperada) {
  const carpeta = path.join(ORIGEN, nombre);
  const pkg = path.join(carpeta, 'package.json');
  if (!existsSync(pkg)) falla(`no encuentro «${nombre}» en ${ORIGEN}. Ejecuta: npm install --no-save ${nombre}@${versionEsperada}`);
  const { version } = JSON.parse(readFileSync(pkg, 'utf8'));
  if (version !== versionEsperada) falla(`«${nombre}» está en la versión ${version} y el sitio espera la ${versionEsperada}. Ejecuta: npm install --no-save ${nombre}@${versionEsperada}`);
  return carpeta;
}

let bytes = 0;
function copiar(desde, hacia) {
  if (!existsSync(desde)) falla(`falta el archivo ${desde}`);
  mkdirSync(path.dirname(hacia), { recursive: true });
  copyFileSync(desde, hacia);
  bytes += statSync(hacia).size;
  console.log(`  ${path.relative(DESTINO, hacia)}`);
}

const katex = paquete('katex', DEPENDENCIAS.katex.version);
const plotly = paquete('plotly.js-cartesian-dist-min', DEPENDENCIAS.plotly.version);

console.log(`Copiando a ${DESTINO}`);
// KaTeX: el CSS pide las tipografías en fonts/ (solo woff2: todos los navegadores actuales lo admiten).
copiar(path.join(katex, 'dist/katex.min.js'), path.join(DESTINO, 'katex/katex.min.js'));
copiar(path.join(katex, 'dist/katex.min.css'), path.join(DESTINO, 'katex/katex.min.css'));
for (const f of readdirSync(path.join(katex, 'dist/fonts')).filter((n) => n.endsWith('.woff2'))) {
  copiar(path.join(katex, 'dist/fonts', f), path.join(DESTINO, 'katex/fonts', f));
}
if (existsSync(path.join(katex, 'LICENSE'))) copiar(path.join(katex, 'LICENSE'), path.join(DESTINO, 'katex/LICENSE'));
// Plotly (paquete cartesian: líneas, barras, dispersión… sin pastel ni mapas).
copiar(path.join(plotly, 'plotly-cartesian.min.js'), path.join(DESTINO, 'plotly/plotly-cartesian.min.js'));
if (existsSync(path.join(plotly, 'LICENSE'))) copiar(path.join(plotly, 'LICENSE'), path.join(DESTINO, 'plotly/LICENSE'));

console.log(`\nListo: ${(bytes / 1024 / 1024).toFixed(1)} MB.`);
console.log('Siguiente paso: pon VENDOR_LOCAL = true en js/core/config.js (y quita «/vendor/» de .gitignore si vas a subirlo).');
