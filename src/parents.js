import { TYPES } from './download.js'

/**
 * De qué forma parte un objeto. Los códigos del INDEC anidan por prefijo
 * —`cde` empieza con `cpr`, `clc` empieza con `cde`, y el `cod_indec` de una
 * vía empieza con su `clc`—, así que el padre se deriva del código propio,
 * sin pedir nada. La excepción es el aglomerado de una localidad, que no
 * está en su código y viaja aparte en el catálogo como `ag`.
 *
 * Qué se hace después con cada padre derivado —buscarlo o armarlo— lo decide
 * `parentsOf`, y ahí está explicado por qué.
 */

/** Índice por tipo y código, para resolver un padre sin recorrer el catálogo. */
export function codeIndex(objects) {
  return new Map(objects.map((obj) => [`${obj.t}:${obj.c}`, obj]))
}

/** Padres derivables de cada tipo, del más cercano al más lejano. */
const CHAIN = {
  jur: () => [],
  dep: (obj) => [['jur', obj.c.slice(0, 2)]],
  loc: (obj) => [
    ['dep', obj.c.slice(0, 5)],
    ['jur', obj.c.slice(0, 2)],
    ...(obj.ag ? [['aglo', obj.ag]] : []),
  ],
  gl: (obj) => [['jur', obj.c.slice(0, 2)]],
  aglo: () => [],
  frac: (obj) => [
    ['dep', obj.c.slice(0, 5)],
    ['jur', obj.c.slice(0, 2)],
  ],
  rad: (obj) => [
    ['frac', obj.c.slice(0, 7)],
    ['dep', obj.c.slice(0, 5)],
    ['jur', obj.c.slice(0, 2)],
  ],
  // Verificado el 2026-09-08 sobre las 400 filas del departamento 06469,
  // repartidas en 11 localidades censales: el `cod_indec` de un tramo empieza
  // siempre con su `clc`, sin un contraejemplo. Es lo que deja que la ficha
  // de una vía muestre sus padres antes de pedir nada (SITIO-R3).
  via: (obj) => [
    ['loc', obj.c.slice(0, 8)],
    ['dep', obj.c.slice(0, 5)],
    ['jur', obj.c.slice(0, 2)],
  ],
}

/**
 * Los padres que se pueden ofrecer. Los de catálogo se buscan antes de
 * ofrecerlos —DES-R8: un prefijo válido puede apuntar a un objeto que no
 * existe—; los que no están en el catálogo se arman del código, porque no
 * hay dónde buscarlos y su existencia la decide el GeoServer recién cuando
 * se los abre.
 *
 * `n: null` es "este objeto no tiene nombre publicado" (NAV-R4), no "falta
 * el dato": quien dibuja la fila usa el tipo como rótulo.
 */
export function parentsOf(obj, index) {
  const chain = CHAIN[obj?.t]
  if (!chain) return []
  return chain(obj)
    .map(([t, c]) => (TYPES[t].catalogo ? index.get(`${t}:${c}`) : { t, c, n: null }))
    .filter(Boolean)
}
