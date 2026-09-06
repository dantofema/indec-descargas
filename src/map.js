import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { GEOSERVER, assertCode, selfUrl } from './download.js'

/**
 * Basemap del IGN. Es TMS, que numera el eje Y al revés que XYZ:
 * sin `tms: true` el mapa sale espejado verticalmente.
 */
const IGN_TILES = 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{y}.png'

const ARGENTINA = [[-55.5, -74], [-21.5, -53]]

let map = null
let layer = null
let featureCallback = () => {}
let pending = 0

export function initMap(containerId) {
  map = L.map(containerId, { scrollWheelZoom: false })
  L.tileLayer(IGN_TILES, {
    tms: true,
    maxZoom: 18,
    attribution: 'Instituto Geográfico Nacional, OpenStreetMap',
  }).addTo(map)
  map.fitBounds(ARGENTINA)
}

/** Registra a quién avisarle cuando llegan las propiedades del objeto. */
export function onFeature(callback) {
  featureCallback = callback
}

/**
 * Arma la URL de un GetFeature en GeoJSON a partir de capa, campo y código
 * sueltos —lo que necesita dibujar una fila cualquiera de una capa hija—.
 * El código pasa por `assertCode`: es lo único que se interpola en el CQL.
 */
function featureQueryUrl(layerName, field, code) {
  const p = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typenames: layerName,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    CQL_FILTER: `${field}='${assertCode(code)}'`,
  })
  return `${GEOSERVER}?${p}`
}

/** El mapa se creó con `#detail` oculto: Leaflet midió altura cero y hay
 * que avisarle recién ahora que ya es visible. También limpia lo dibujado
 * antes, y arranca la marca de carrera que comparten showObject y
 * showFeature —son la misma pelea por "quién es la última selección"—. */
function beginRequest() {
  const request = ++pending
  map.invalidateSize()
  if (layer) {
    layer.remove()
    layer = null
  }
  return request
}

/**
 * Pide el GeoJSON de `url` y lo dibuja, si para cuando llega sigue siendo
 * la petición vigente. Es la parte que showObject y showFeature comparten
 * entera: sólo cambia de dónde sale la URL, no qué se hace con ella.
 *
 * Una petición superada no escribe nada: ni el mapa, ni la línea de
 * estado. El chequeo va antes de mirar el status, y el try/catch cubre
 * la otra puerta —que se caiga el fetch— porque con el GeoServer del
 * INDEC el corte de conexión es más probable que un 500.
 */
async function drawFromUrl(request, url) {
  try {
    const res = await fetch(url)
    if (request !== pending) return

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const geojson = await res.json()

    if (!geojson.features?.length) throw new Error('el servidor no devolvió geometría')

    layer = L.geoJSON(geojson, {
      style: { color: '#1f6feb', weight: 2, fillOpacity: 0.12 },
    }).addTo(map)

    map.fitBounds(layer.getBounds(), { padding: [16, 16] })
    featureCallback(geojson.features[0].properties)
  } catch (err) {
    if (request !== pending) return
    throw err
  }
}

export async function showObject(obj) {
  if (!map) return
  return drawFromUrl(beginRequest(), selfUrl(obj, 'application/json'))
}

/** Dibuja un feature suelto de una capa hija: la fila que se está "viendo"
 * desde la tabla de la fila 3, no el objeto de la búsqueda. */
export async function showFeature(layerName, field, code) {
  if (!map) return
  return drawFromUrl(beginRequest(), featureQueryUrl(layerName, field, code))
}
