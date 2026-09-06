import { GEOSERVER, CHILD_LAYERS, TYPES, assertCode } from './download.js'
import { specOf, queryFields } from './columns.js'

/**
 * Una página de objetos hijos, leída del GeoServer en vivo: el catálogo tiene
 * los conteos, no los objetos —las vías del país son 477.588 filas—.
 *
 * El pedido va sin geometría: la tabla no la usa y es lo que pesa. Una página
 * de 20 filas de vías pesa 3,1 KB, así que cuesta lo mismo paginar un partido
 * que una provincia. La geometría se pide aparte, de a un feature, al verlo
 * en el mapa.
 */
export const PAGE_SIZE = 20

export function pageUrl(obj, childKey, page) {
  const child = CHILD_LAYERS[childKey]
  if (!child) throw new Error(`capa hija desconocida: ${JSON.stringify(childKey)}`)
  const parent = TYPES[obj?.t]
  if (!parent) throw new Error(`tipo de objeto desconocido: ${JSON.stringify(obj?.t)}`)

  const p = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typenames: child.layer,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    CQL_FILTER: `${parent.field}='${assertCode(obj.c)}'`,
    propertyName: queryFields(childKey).join(','),
    sortBy: specOf(childKey).sortBy,
    count: String(PAGE_SIZE),
    startIndex: String(page * PAGE_SIZE),
  })
  return `${GEOSERVER}?${p}`
}

/** Las filas de una página y el total que dice el servidor. */
export async function fetchPage(obj, childKey, page) {
  const res = await fetch(pageUrl(obj, childKey, page))
  if (!res.ok) throw new Error(`el GeoServer respondió HTTP ${res.status}`)
  const body = await res.json()
  return {
    rows: (body.features ?? []).map((f) => f.properties),
    total: body.totalFeatures ?? 0,
  }
}
