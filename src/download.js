export const GEOSERVER = 'https://geonode.indec.gob.ar/geoserver/ows'

/** Capa propia y campo de filtro de cada tipo de objeto buscable. */
export const TYPES = {
  jur:  { layer: 'geonode:jurisdicciones',        field: 'cpr',     label: 'Jurisdicción' },
  dep:  { layer: 'geonode:departamentos',         field: 'cde',     label: 'Departamento' },
  loc:  { layer: 'geonode:localidades_censales',  field: 'clc',     label: 'Localidad censal' },
  gl:   { layer: 'geonode:gobiernos_locales4',    field: 'cmu',     label: 'Gobierno local' },
  aglo: { layer: 'geonode:aglomerados',           field: 'codaglo', label: 'Aglomerado' },
}

/** Capas que un objeto puede ofrecer como hijas. */
export const CHILD_LAYERS = {
  departamentos: { layer: 'geonode:departamentos',        label: 'Departamentos' },
  fracciones:    { layer: 'geonode:fracciones_censales',  label: 'Fracciones censales' },
  radios:        { layer: 'geonode:radios_censales2',     label: 'Radios censales' },
  localidades:   { layer: 'geonode:localidades_censales', label: 'Localidades censales' },
  vias:          { layer: 'geonode:vias_de_circulacion',  label: 'Vías de circulación' },
}

/**
 * Los códigos del INDEC son siempre dígitos con ceros a la izquierda.
 * Validarlos acá evita interpolar cualquier otra cosa dentro del CQL.
 */
function assertCode(code) {
  if (typeof code !== 'string' || !/^\d+$/.test(code)) {
    throw new Error(`código inválido: ${JSON.stringify(code)}`)
  }
  return code
}

function typeOf(obj) {
  const type = TYPES[obj?.t]
  if (!type) throw new Error(`tipo de objeto desconocido: ${JSON.stringify(obj?.t)}`)
  return type
}

function wfsUrl(typename, cql, format) {
  const p = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typenames: typename,
    outputFormat: format,
    srsName: 'EPSG:4326',
    CQL_FILTER: cql,
  })
  return `${GEOSERVER}?${p}`
}

/** URL de descarga del objeto en sí. */
export function selfUrl(obj, format = 'geopackage') {
  const type = typeOf(obj)
  return wfsUrl(type.layer, `${type.field}='${assertCode(obj.c)}'`, format)
}

/** URL de descarga de una capa hija, filtrada por el campo del padre. */
export function childUrl(obj, childKey, format = 'geopackage') {
  const type = typeOf(obj)
  const child = CHILD_LAYERS[childKey]
  if (!child) throw new Error(`capa hija desconocida: ${JSON.stringify(childKey)}`)
  return wfsUrl(child.layer, `${type.field}='${assertCode(obj.c)}'`, format)
}

/** El tope habilita si hay algo que bajar y no lo supera. */
export function canDownload(count, maxFeatures) {
  return Number.isFinite(count) && count > 0 && count <= maxFeatures
}

/** Nombre sugerido del archivo descargado. */
export function filename(obj, childKey) {
  const base = TYPES[obj.t].layer.replace('geonode:', '')
  return childKey ? `${childKey}-de-${base}-${obj.c}.gpkg` : `${base}-${obj.c}.gpkg`
}
