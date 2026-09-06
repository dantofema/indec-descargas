/**
 * De qué forma parte un objeto. Los códigos del INDEC anidan por prefijo
 * —`cde` empieza con `cpr`, `clc` empieza con `cde`—, así que el padre se
 * deriva del código propio. La excepción es el aglomerado de una localidad,
 * que no está en su código y viaja aparte en el catálogo como `ag`.
 *
 * Todo padre derivado se busca en el catálogo antes de ofrecerlo: DES-R8
 * documenta que los códigos no cierran entre capas, así que un prefijo
 * válido puede apuntar a un objeto que no existe.
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
}

/** Los padres que existen de verdad en el catálogo. */
export function parentsOf(obj, index) {
  const chain = CHAIN[obj?.t]
  if (!chain) return []
  return chain(obj)
    .map(([t, c]) => index.get(`${t}:${c}`))
    .filter(Boolean)
}
