import { specOf } from './columns.js'

export const GEOSERVER = 'https://geonode.indec.gob.ar/geoserver/ows'

/**
 * Capa propia y campo de filtro de cada tipo de objeto buscable. `det` es
 * el determinante que le corresponde al `label`: la interfaz está en
 * castellano y dos de los cinco tipos son femeninos. `plural` es la
 * etiqueta con la que el tipo aparece en el filtro del buscador.
 */
export const TYPES = {
  jur:  { layer: 'geonode:jurisdicciones',        field: 'cpr',     label: 'Jurisdicción',     plural: 'Jurisdicciones',       det: 'esta' },
  dep:  { layer: 'geonode:departamentos',         field: 'cde',     label: 'Departamento',     plural: 'Departamentos',        det: 'este' },
  loc:  { layer: 'geonode:localidades_censales',  field: 'clc',     label: 'Localidad censal', plural: 'Localidades censales', det: 'esta' },
  gl:   { layer: 'geonode:gobiernos_locales4',    field: 'cmu',     label: 'Gobierno local',   plural: 'Gobiernos locales',    det: 'este' },
  aglo: { layer: 'geonode:aglomerados',           field: 'codaglo', label: 'Aglomerado',       plural: 'Aglomerados',          det: 'este' },
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

const GPKG = 'geopackage'

function wfsUrl(typename, cql, format, downloadName) {
  const p = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typenames: typename,
    outputFormat: format,
    srsName: 'EPSG:4326',
    CQL_FILTER: cql,
  })
  // El atributo `download` del `<a>` sólo lo respeta el browser cuando el
  // href es del mismo origen; para un href cross-origin —que es lo que son
  // todas estas URLs— manda el `Content-Disposition` del servidor, y
  // GeoServer lo arma desde `format_options`. Sin esto, tres departamentos
  // de radios llegan como tres `radios_censales2.gpkg` iguales.
  // Sólo en las descargas: el GeoJSON del mapa se lee en JS y no se guarda.
  if (downloadName) p.set('format_options', `filename:${downloadName}`)
  return `${GEOSERVER}?${p}`
}

/** URL de descarga del objeto en sí. */
export function selfUrl(obj, format = GPKG) {
  const type = typeOf(obj)
  return wfsUrl(
    type.layer,
    `${type.field}='${assertCode(obj.c)}'`,
    format,
    format === GPKG ? filename(obj) : null,
  )
}

/** URL de descarga de una capa hija, filtrada por el campo del padre. */
export function childUrl(obj, childKey, format = GPKG) {
  const type = typeOf(obj)
  const child = CHILD_LAYERS[childKey]
  if (!child) throw new Error(`capa hija desconocida: ${JSON.stringify(childKey)}`)
  return wfsUrl(
    child.layer,
    `${type.field}='${assertCode(obj.c)}'`,
    format,
    format === GPKG ? filename(obj, childKey) : null,
  )
}

/**
 * URL de descarga de un objeto hijo suelto. En vías el filtro es por
 * `cod_indec`, que agrupa todos los tramos de una calle: se baja la calle
 * entera, no el tramo de la fila.
 */
export function featureUrl(childKey, code, format = GPKG) {
  const child = CHILD_LAYERS[childKey]
  if (!child) throw new Error(`capa hija desconocida: ${JSON.stringify(childKey)}`)
  const base = child.layer.replace('geonode:', '')
  return wfsUrl(
    child.layer,
    `${specOf(childKey).idField}='${assertCode(code)}'`,
    format,
    format === GPKG ? `${base}-${assertCode(code)}.gpkg` : null,
  )
}

/** Nombre del archivo descargado. Va en `format_options`, no en el `<a>`. */
export function filename(obj, childKey) {
  const base = typeOf(obj).layer.replace('geonode:', '')
  // El nombre viaja en `format_options`, donde `;` separa pares: un
  // código sin validar inyecta opciones en la URL de descarga.
  const code = assertCode(obj.c)
  return childKey ? `${childKey}-de-${base}-${code}.gpkg` : `${base}-${code}.gpkg`
}
