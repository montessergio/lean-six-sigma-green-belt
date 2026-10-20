#!/usr/bin/env node
/**
 * exportar-datos.mjs — Genera los CSV de recursos/datos/ a partir de content/caso-arneses.json.
 *
 *   node tools/exportar-datos.mjs               # escribe (o actualiza) los archivos
 *   node tools/exportar-datos.mjs --comprobar   # solo verifica que estén al día (código 1 si no)
 *
 * La fuente única de las cifras del caso es el JSON que leen los laboratorios; los CSV se derivan de él para que
 * el estudiante pueda practicar en Excel con los mismos datos y nunca se desincronicen
 * (tests/recursos.test.mjs lo comprueba). Formato: UTF-8 con BOM (Excel lo abre con acentos), coma como separador,
 * punto decimal.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOM = '﻿';

/** Una celda CSV (comillas solo cuando hacen falta). */
const celda = (v) => {
  const t = String(v ?? '');
  return /[",\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
};
const csv = (filas) => `${BOM}${filas.map((f) => f.map(celda).join(',')).join('\n')}\n`;

const CATEGORIAS = {
  prevencion: 'Prevención',
  evaluacion: 'Evaluación',
  fallaInterna: 'Falla interna',
  fallaExterna: 'Falla externa',
};

/** Devuelve un Map «ruta relativa → contenido» con todos los CSV a partir del caso. */
export function generar(caso = JSON.parse(readFileSync(path.join(RAIZ, 'content/caso-arneses.json'), 'utf8'))) {
  const salida = new Map();

  salida.set('recursos/datos/arneses-torque.csv', csv([
    ['medicion', `torque_${caso.torque.unidad.replace('·', '')}`],
    ...caso.torque.valores.map((v, i) => [i + 1, v]),
  ]));

  salida.set('recursos/datos/arneses-fuerza-engarzado.csv', csv([
    ['medicion', `fuerza_${caso.fuerza.unidad}`],
    ...caso.fuerza.valores.map((v, i) => [i + 1, v]),
  ]));

  salida.set('recursos/datos/arneses-copq-mensual.csv', csv([
    ['categoria', 'concepto', `costo_${caso.copq.moneda.toLowerCase()}`],
    ...caso.copq.conceptos.map((c) => [CATEGORIAS[c.categoria] ?? c.categoria, c.concepto, c.costo]),
  ]));

  const d = caso.defectos;
  salida.set('recursos/datos/arneses-defectos.csv', csv([
    ['escenario', 'unidades', 'oportunidades_por_unidad', 'defectos', 'fuente', 'nota'],
    [d.antes.etiqueta, d.antes.unidades, d.antes.oportunidades, d.antes.defectos, 'Guía M1 §7', ''],
    [d.despues.etiqueta, d.despues.unidades, d.despues.oportunidades, d.despues.defectos, 'Guía M10 §3 y §5', d.despues.nota ?? ''],
    ['Plantilla Excel: antes', d.plantillaExcel.antes.unidades, d.plantillaExcel.antes.oportunidades, d.plantillaExcel.antes.defectos, 'Plantilla Excel «DPMO y Sigma»', ''],
    ['Plantilla Excel: después', d.plantillaExcel.despues.unidades, d.plantillaExcel.despues.oportunidades, d.plantillaExcel.despues.defectos, 'Plantilla Excel «DPMO y Sigma»', ''],
  ]));

  return salida;
}

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (esPrincipal) {
  const comprobar = process.argv.includes('--comprobar');
  let atrasados = 0;
  for (const [ruta, contenido] of generar()) {
    const abs = path.join(RAIZ, ruta);
    if (comprobar) {
      if (!existsSync(abs) || readFileSync(abs, 'utf8') !== contenido) {
        atrasados += 1;
        console.error(`DESACTUALIZADO  ${ruta}`);
      }
    } else {
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, contenido, 'utf8');
      console.log(`escrito  ${ruta}`);
    }
  }
  if (comprobar) {
    console.log(atrasados ? `${atrasados} archivo(s) desactualizado(s): ejecuta node tools/exportar-datos.mjs` : 'recursos/datos al día.');
    process.exit(atrasados ? 1 : 0);
  }
}
