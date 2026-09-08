import { specOf } from './columns.js'

export const GEOSERVER = 'https://geonode.indec.gob.ar/geoserver/ows'

/**
 * Capa propia y campo de filtro de cada tipo de objeto. `det` es el
 * determinante que le corresponde al `label`: la interfaz está en castellano
 * y varios tipos son femeninos. `plural` es la etiqueta con la que el tipo
 * aparece en el filtro del buscador —que sale de `TYPE_ORDER`, no de acá, y
 * por eso los tres tipos sin catálogo no aparecen en él: no tienen nombre
 * que buscar (NAV-R4)—.
 *
 * `len` es el largo del código, verificado el 2026-09-08 contra el GeoServer
 * y el catálogo. Los ocho son distintos y no colisionan: es lo que deja que
 * una consulta de puros dígitos se resuelva sola (BUS-R5) y lo que separa un
 * enlace bueno de `?t=rad&c=0684042`.
 *
 * `catalogo` dice si el objeto está en `catalog.json`. Los tres que no lo
 * están se resuelven con un GetFeature por código: el catálogo hace falta
 * para buscar por nombre, no para direccionar.
 */
export const TYPES = {
  jur:  { layer: 'geonode:jurisdicciones',        field: 'cpr',       len: 2,  catalogo: true,  label: 'Jurisdicción',       plural: 'Jurisdicciones',       det: 'esta' },
  aglo: { layer: 'geonode:aglomerados',           field: 'codaglo',   len: 4,  catalogo: true,  label: 'Aglomerado',         plural: 'Aglomerados',          det: 'este' },
  dep:  { layer: 'geonode:departamentos',         field: 'cde',       len: 5,  catalogo: true,  label: 'Departamento',       plural: 'Departamentos',        det: 'este' },
  gl:   { layer: 'geonode:gobiernos_locales4',    field: 'cmu',       len: 6,  catalogo: true,  label: 'Gobierno local',     plural: 'Gobiernos locales',    det: 'este' },
  frac: { layer: 'geonode:fracciones_censales',   field: 'cod_indec', len: 7,  catalogo: false, label: 'Fracción censal',    plural: 'Fracciones censales',  det: 'esta' },
  loc:  { layer: 'geonode:localidades_censales',  field: 'clc',       len: 8,  catalogo: true,  label: 'Localidad censal',   plural: 'Localidades censales', det: 'esta' },
  rad:  { layer: 'geonode:radios_censales2',      field: 'cod_indec', len: 9,  catalogo: false, label: 'Radio censal',       plural: 'Radios censales',      det: 'este' },
  via:  { layer: 'geonode:vias_de_circulacion',   field: 'cod_indec', len: 13, catalogo: false, label: 'Vía de circulación', plural: 'Vías de circulación',  det: 'esta' },
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
 * La capa hija que corresponde a un tipo direccionable. Existe porque las
 * columnas de un objeto las decide `specOf`, que se indexa por clave de
 * `CHILD_LAYERS`, y la ficha se indexa por tipo: sin este puente, la ficha
 * de un radio no sabe qué campos mostrar.
 */
export const LAYER_OF_TYPE = {
  dep: 'departamentos',
  loc: 'localidades',
  frac: 'fracciones',
  rad: 'radios',
  via: 'vias',
}

/** La inversa: qué tipo direccionable es una fila de esta capa. La usa el "Ver" para armar el permalink. */
export const TYPE_OF_LAYER = Object.fromEntries(
  Object.entries(LAYER_OF_TYPE).map(([t, capa]) => [capa, t]),
)

/**
 * Los códigos del INDEC son siempre dígitos con ceros a la izquierda.
 * Validarlos acá evita interpolar cualquier otra cosa dentro del CQL.
 *
 * `isCode` es la misma pregunta sin explotar, para quien puede ofrecer otra
 * cosa en vez de la descarga: una fila del GeoServer sin código no es un
 * error de programa, es un dato que el INDEC no publicó (DES-R8).
 */
export const isCode = (code) => typeof code === 'string' && /^\d+$/.test(code)

export function assertCode(code) {
  if (!isCode(code)) throw new Error(`código inválido: ${JSON.stringify(code)}`)
  return code
}

export function typeOf(obj) {
  if (!Object.hasOwn(TYPES, obj?.t)) throw new Error(`tipo de objeto desconocido: ${JSON.stringify(obj?.t)}`)
  return TYPES[obj.t]
}

export function childOf(childKey) {
  if (!Object.hasOwn(CHILD_LAYERS, childKey)) throw new Error(`capa hija desconocida: ${JSON.stringify(childKey)}`)
  return CHILD_LAYERS[childKey]
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
  const child = childOf(childKey)
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
  const child = childOf(childKey)
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
