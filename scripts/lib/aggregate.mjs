import { normalize } from '../../src/search.js'

/** El GeoServer usa esta cadena para "sin valor" en codaglo y cmu. */
export const NA = 'N/A'

/**
 * Centinelas de ausencia por campo. El INDEC escribe dos cadenas
 * distintas para el mismo significado —"no pertenece a ningún
 * aglomerado"— en dos capas distintas: `localidades_censales` usa 'N/A'
 * y `vias_de_circulacion` usa '0000' (185.908 de sus 477.588 filas).
 * Ninguno de los dos es un código de aglomerado real, así que los dos
 * se omiten al contar.
 */
const ABSENT = {
  codaglo: new Set([NA, '0000']),
}

const DEFAULT_ABSENT = new Set([NA])

/** ¿Este valor es una ausencia y no un código? */
export function isAbsent(field, value) {
  return !value || (ABSENT[field] ?? DEFAULT_ABSENT).has(value)
}

/** Cuenta filas por valor de un campo, omitiendo vacíos y los centinelas. */
export function countBy(rows, field) {
  const counts = new Map()
  for (const row of rows) {
    const key = row[field]
    if (isAbsent(field, key)) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

const get = (map, key) => map.get(key) ?? 0

/**
 * Arma el catálogo completo a partir de las filas de cada capa.
 * Devuelve también las advertencias de códigos huérfanos, que el
 * llamador decide si son fatales.
 */
export function buildCatalog(input) {
  const {
    generated, maxFeatures,
    jurisdicciones, departamentos, localidades, gobiernosLocales, aglomerados,
    fracciones, radios, vias,
  } = input

  // Conteos por departamento (cde).
  const fracByDep = countBy(fracciones, 'cde')
  const radiosByDep = countBy(radios, 'cde')
  const locByDep = countBy(localidades, 'cde')
  const viasByDep = countBy(vias, 'cde')

  // Conteos por provincia (cpr). Es la misma columna con la que
  // `childUrl` filtra la descarga de esa capa, así que el número que ve
  // el usuario y el archivo que recibe no pueden discrepar. Derivarlo de
  // `cde.slice(0, 2)` sí discrepa: hay filas con `cpr` de una provincia y
  // `cde` de otra (radio fid 59896, localidad fid 2740).
  const depByProv = countBy(departamentos, 'cpr')
  const fracByProv = countBy(fracciones, 'cpr')
  const radiosByProv = countBy(radios, 'cpr')
  const locByProv = countBy(localidades, 'cpr')
  const viasByProv = countBy(vias, 'cpr')

  // Conteos por aglomerado y por localidad.
  const locByAglo = countBy(localidades, 'codaglo')
  const viasByAglo = countBy(vias, 'codaglo')
  const viasByLoc = countBy(vias, 'clc')

  // Provincia de cada aglomerado, derivada de sus localidades: el
  // aglomerado no trae `jur` y puede cruzar más de una provincia.
  const provsOfAglo = new Map()
  for (const loc of localidades) {
    if (isAbsent('codaglo', loc.codaglo)) continue
    if (!provsOfAglo.has(loc.codaglo)) provsOfAglo.set(loc.codaglo, new Set())
    provsOfAglo.get(loc.codaglo).add(loc.jur)
  }

  const objects = []

  for (const row of jurisdicciones) {
    objects.push({
      t: 'jur', c: row.cpr, n: row.nam, s: normalize(row.nam), p: row.nam,
      ch: {
        departamentos: get(depByProv, row.cpr),
        fracciones: get(fracByProv, row.cpr),
        radios: get(radiosByProv, row.cpr),
        localidades: get(locByProv, row.cpr),
        vias: get(viasByProv, row.cpr),
      },
    })
  }

  for (const row of departamentos) {
    objects.push({
      t: 'dep', c: row.cde, n: row.nam, s: normalize(row.nam), p: row.jur,
      ch: {
        fracciones: get(fracByDep, row.cde),
        radios: get(radiosByDep, row.cde),
        localidades: get(locByDep, row.cde),
        vias: get(viasByDep, row.cde),
      },
    })
  }

  for (const row of localidades) {
    objects.push({
      t: 'loc', c: row.clc, n: row.nam, s: normalize(row.nam), p: row.jur,
      // El aglomerado no se deduce del código: `clc` no lo contiene. Se
      // guarda para que una tarea posterior pueda armar con él la cadena
      // de padres de la localidad.
      ...(isAbsent('codaglo', row.codaglo) ? {} : { ag: row.codaglo }),
      ch: { vias: get(viasByLoc, row.clc) },
    })
  }

  for (const row of gobiernosLocales) {
    objects.push({ t: 'gl', c: row.cmu, n: row.nam, s: normalize(row.nam), p: row.jur })
  }

  for (const row of aglomerados) {
    const provs = [...(provsOfAglo.get(row.codaglo) ?? [])].sort()
    objects.push({
      t: 'aglo', c: row.codaglo, n: row.nam, s: normalize(row.nam),
      p: provs.join(' / '),
      ch: { localidades: get(locByAglo, row.codaglo), vias: get(viasByAglo, row.codaglo) },
    })
  }

  // Códigos que aparecen en una capa hija y no tienen padre en el catálogo.
  const warnings = []
  const orphans = (counts, known, what) => {
    const missing = [...counts.keys()].filter((k) => !known.has(k)).sort()
    if (missing.length) {
      warnings.push(`${what}: ${missing.length} código(s) sin padre: ${missing.join(', ')}`)
    }
  }

  const knownDep = new Set(departamentos.map((r) => r.cde))
  const knownAglo = new Set(aglomerados.map((r) => r.codaglo))
  const knownLoc = new Set(localidades.map((r) => r.clc))
  const knownJur = new Set(jurisdicciones.map((r) => r.cpr))

  orphans(fracByDep, knownDep, 'fracciones por cde')
  orphans(radiosByDep, knownDep, 'radios por cde')
  orphans(locByDep, knownDep, 'localidades por cde')
  orphans(viasByDep, knownDep, 'vias por cde')
  orphans(depByProv, knownJur, 'departamentos por cpr')
  orphans(fracByProv, knownJur, 'fracciones por cpr')
  orphans(radiosByProv, knownJur, 'radios por cpr')
  orphans(locByProv, knownJur, 'localidades por cpr')
  orphans(viasByProv, knownJur, 'vias por cpr')
  orphans(locByAglo, knownAglo, 'localidades por codaglo')
  orphans(viasByAglo, knownAglo, 'vias por codaglo')
  orphans(viasByLoc, knownLoc, 'vias por clc')

  return { catalog: { generated, maxFeatures, objects }, warnings }
}
