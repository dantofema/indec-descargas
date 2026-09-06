#!/usr/bin/env node
import { writeFile, mkdir, readFile, access, rename } from 'node:fs/promises'
import { parse } from 'csv-parse/sync'
import { buildCatalog } from './lib/aggregate.mjs'
import { assertMinRows } from './lib/dump.mjs'

const GEOSERVER = 'https://geonode.indec.gob.ar/geoserver/ows'
const CACHE_DIR = new URL('./.cache/', import.meta.url)
const OUT = new URL('../public/catalog.json', import.meta.url)

/** Qué columnas se piden de cada capa. Menos columnas, menos bytes. */
const DUMPS = {
  jurisdicciones:   { layer: 'jurisdicciones',        props: 'cpr,nam' },
  departamentos:    { layer: 'departamentos',         props: 'cpr,cde,nam,jur' },
  localidades:      { layer: 'localidades_censales',  props: 'cpr,clc,cde,nam,jur,dpto,codaglo' },
  gobiernosLocales: { layer: 'gobiernos_locales4',    props: 'cmu,nam,jur' },
  aglomerados:      { layer: 'aglomerados',           props: 'codaglo,nam' },
  fracciones:       { layer: 'fracciones_censales',   props: 'cpr,cde' },
  radios:           { layer: 'radios_censales2',      props: 'cpr,cde' },
  vias:             { layer: 'vias_de_circulacion',   props: 'cpr,cde,cmu,clc,codaglo' },
}

/** Piso de filas por volcado, holgado por debajo de los reales. */
const MIN_ROWS = {
  jurisdicciones: 24,
  departamentos: 500,
  localidades: 3900,
  gobiernosLocales: 2200,
  aglomerados: 110,
  fracciones: 6000,
  radios: 60000,
  vias: 450000,
}

function dumpUrl({ layer, props }) {
  const p = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typenames: `geonode:${layer}`,
    outputFormat: 'csv',
    propertyName: props,
  })
  return `${GEOSERVER}?${p}`
}

const exists = (url) => access(url).then(() => true, () => false)

/**
 * Baja el CSV de una capa, con caché en disco: el volcado de vías tarda
 * casi un minuto y no hace falta repetirlo mientras se itera.
 */
async function fetchCsv(key, spec, useCache) {
  const cached = new URL(`${key}.csv`, CACHE_DIR)
  if (useCache && (await exists(cached))) {
    console.error(`  ${key}: desde caché`)
    return readFile(cached, 'utf8')
  }
  const started = Date.now()
  const res = await fetch(dumpUrl(spec), { signal: AbortSignal.timeout(300_000) })
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status} ${res.statusText}`)
  const text = await res.text()
  // Temp + rename: un write interrumpido deja el `.tmp` a medio escribir,
  // nunca un `.csv` truncado que la próxima corrida leería como bueno.
  // El rename dentro del mismo directorio es atómico.
  const tmp = new URL(`${key}.csv.tmp`, CACHE_DIR)
  await writeFile(tmp, text)
  await rename(tmp, cached)
  console.error(`  ${key}: ${text.length} bytes en ${((Date.now() - started) / 1000).toFixed(1)}s`)
  return text
}

async function main() {
  const useCache = !process.argv.includes('--no-cache')
  if (!useCache) console.error('(--no-cache: se vuelve a bajar todo)')
  await mkdir(CACHE_DIR, { recursive: true })

  console.error('Volcando capas del GeoServer del INDEC...')
  const rows = {}
  for (const [key, spec] of Object.entries(DUMPS)) {
    // `columns: true` lee por nombre de encabezado: el GeoServer no
    // respeta el orden de propertyName y agrega FID/fid por su cuenta.
    rows[key] = parse(await fetchCsv(key, spec, useCache), { columns: true, skip_empty_lines: true })
  }

  assertMinRows(rows, MIN_ROWS)

  const { catalog, warnings } = buildCatalog({
    generated: new Date().toISOString().slice(0, 10),
    ...rows,
  })

  if (warnings.length) {
    console.error('\nInconsistencias en los datos del INDEC:')
    for (const w of warnings) console.error(`  - ${w}`)
  }

  const counts = catalog.objects.reduce((acc, o) => ({ ...acc, [o.t]: (acc[o.t] ?? 0) + 1 }), {})
  console.error(`\nObjetos: ${catalog.objects.length}`, counts)

  if (catalog.objects.length < 6000) {
    throw new Error(`sólo ${catalog.objects.length} objetos; se esperaban ~6900. Abortando.`)
  }

  await mkdir(new URL('../public/', import.meta.url), { recursive: true })
  await writeFile(OUT, JSON.stringify(catalog))
  const size = JSON.stringify(catalog).length
  console.error(`Escrito public/catalog.json (${(size / 1024).toFixed(0)} KB)`)
}

main().catch((err) => {
  console.error(`\nFalló el build del índice: ${err.message}`)
  process.exit(1)
})
