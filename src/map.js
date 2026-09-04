import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { selfUrl } from './download.js'

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

export async function showObject(obj) {
  if (!map) return
  const request = ++pending

  // El mapa se creó con `#detail` oculto, así que Leaflet midió un
  // contenedor de altura cero. Ahora ya es visible: hay que avisarle.
  map.invalidateSize()

  if (layer) {
    layer.remove()
    layer = null
  }

  const res = await fetch(selfUrl(obj, 'application/json'))

  // Otra selección ganó de mano a ésta mientras viajaba la respuesta.
  // El chequeo va antes de mirar el status: una petición superada que
  // falla no tiene por qué pisar la línea de estado de una selección
  // más nueva que sí se dibujó bien.
  if (request !== pending) return

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const geojson = await res.json()

  if (!geojson.features?.length) throw new Error('el servidor no devolvió geometría')

  layer = L.geoJSON(geojson, {
    style: { color: '#1f6feb', weight: 2, fillOpacity: 0.12 },
  }).addTo(map)

  map.fitBounds(layer.getBounds(), { padding: [16, 16] })
  featureCallback(geojson.features[0].properties)
}
