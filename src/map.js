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
let pending = 0

export function initMap(containerId) {
  map = L.map(containerId, { scrollWheelZoom: false })
  L.tileLayer(IGN_TILES, {
    tms: true,
    maxZoom: 18,
    attribution: 'Instituto Geográfico Nacional, OpenStreetMap',
  }).addTo(map)
  map.fitBounds(ARGENTINA)
  // El prefijo por defecto del control de atribución es el enlace a Leaflet,
  // y desde 1.9 se lleva adentro una bandera de Ucrania (leaflet-src.js:5762).
  // Se saca entero: la licencia BSD-2-Clause de Leaflet no pide crédito en la
  // interfaz, sólo el aviso de copyright en el código, que sigue donde estaba.
  // La atribución del IGN no se toca: esa sí es del dato que se está viendo.
  map.attributionControl.setPrefix(false)
}

/** El mapa se creó con `#detail` oculto: Leaflet midió altura cero y hay
 * que avisarle recién ahora que ya es visible. También arranca la marca de
 * carrera que decide "quién es la última selección" (ver drawFromUrl).
 *
 * Lo que había dibujado no se toca acá: se borra recién cuando hay con qué
 * reemplazarlo (ver drawFromUrl). */
function beginRequest() {
  const request = ++pending
  map.invalidateSize()
  return request
}

/**
 * Pide el GeoJSON de `url`, lo dibuja si para cuando llega sigue siendo la
 * petición vigente, y devuelve las propiedades del primer feature junto con
 * cuántos vinieron —quien llama decide qué hacer con ellas, ver más abajo
 * por qué—.
 *
 * Una petición superada no escribe nada: ni el mapa, ni la línea de
 * estado. El chequeo va antes de mirar el status, y el try/catch cubre
 * la otra puerta —que se caiga el fetch— porque con el GeoServer del
 * INDEC el corte de conexión es más probable que un 500.
 *
 * Por eso mismo borrar lo dibujado es lo último que pasa antes de dibujar,
 * y no lo primero: hasta que la geometría nueva no está en la mano, lo que
 * el mapa muestra sigue siendo cierto.
 */
async function drawFromUrl(request, url) {
  try {
    const res = await fetch(url)
    if (request !== pending) return undefined

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const geojson = await res.json()

    if (!geojson.features?.length) throw new Error('el servidor no devolvió geometría')

    // Recién acá: un dibujo que falla deja el mapa como estaba, y uno que
    // tarda lo deja como estaba mientras tanto, en vez de mostrar un mapa
    // vacío que parece un error.
    if (layer) {
      layer.remove()
      layer = null
    }

    layer = L.geoJSON(geojson, {
      style: { color: '#1f6feb', weight: 2, fillOpacity: 0.12 },
    }).addTo(map)

    map.fitBounds(layer.getBounds(), { padding: [16, 16] })
    // El conteo, además de las propiedades del primero: en vías un código no
    // identifica un tramo sino una calle entera, y sus tramos comparten el
    // código —80 filas en el caso más partido medido, la AUTOPISTA DEL OESTE
    // (`0684001002660`)—. Sin este número la ficha describiría el tramo 1
    // mientras el mapa dibuja los 80, que es justo la contradicción que
    // NAV-R11 vino a eliminar.
    return { props: geojson.features[0].properties, count: geojson.features.length }
  } catch (err) {
    if (request !== pending) return undefined
    throw err
  }
}

/**
 * Dibuja el objeto de la ficha, sea de catálogo o resuelto contra el
 * GeoServer: la ficha de un objeto sin catálogo se construye entera con lo
 * que esto devuelve —no tiene un nombre que venga del catálogo—. Una
 * petición superada devuelve `undefined` (ver `drawFromUrl`).
 */
export async function showObject(obj) {
  if (!map) return undefined
  return drawFromUrl(beginRequest(), selfUrl(obj, 'application/json'))
}
