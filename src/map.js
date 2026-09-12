import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { selfUrl } from './download.js'

/**
 * Basemap del IGN. Es TMS, que numera el eje Y al revés que XYZ:
 * sin `tms: true` el mapa sale espejado verticalmente.
 */
const IGN_TILES = 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{y}.png'

const ARGENTINA = [[-55.5, -74], [-21.5, -53]]

/**
 * El color de la geometría sale del token del sitio y no de un literal: la
 * paleta tiene dos modos y el dibujo tiene que leerse sobre el basemap claro
 * del IGN en los dos (APAR-R5). Se resuelve al dibujar, no al importar,
 * porque el token cambia con `prefers-color-scheme`.
 *
 * El fallback es el azul que el sitio tenía antes de la consola cartográfica:
 * en jsdom el valor computado de una custom property puede venir vacío, y un
 * mapa sin color es peor que uno con el color viejo.
 */
const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1f6feb'

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

/**
 * El mapa se creó con `#detail` oculto: Leaflet midió altura cero. Quien
 * destapa el panel llama a esto para que Leaflet vuelva a medir, se dibuje
 * algo enseguida o no —la ficha de una vía (SITIO-R3) puede destaparlo sin
 * pedir nada hasta el clic en "Cargar igual", y sin este aviso se queda en
 * cero píxeles hasta entonces—.
 */
export function syncMapSize() {
  if (map) map.invalidateSize()
}

/** Arranca la marca de carrera que decide "quién es la última selección"
 * (ver drawFromUrl).
 *
 * Lo que había dibujado no se toca acá: se borra recién cuando hay con qué
 * reemplazarlo (ver drawFromUrl). */
function beginRequest() {
  return ++pending
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

    // Cero features **no** es un fallo del mapa: el servidor contestó bien y
    // ese objeto no está. Tirar acá hacía que el caso cayera en el mismo
    // `catch` que una red cortada, y la ficha avisaba «las descargas siguen
    // funcionando» sobre un objeto que no existe (DES-R11). Quien llama
    // distingue por `count`, y lo dibujado se deja como estaba: un mapa
    // vacío parece un error, y acá el error no es del mapa.
    if (!geojson.features?.length) return { props: null, count: 0 }

    // Recién acá: un dibujo que falla deja el mapa como estaba, y uno que
    // tarda lo deja como estaba mientras tanto, en vez de mostrar un mapa
    // vacío que parece un error.
    if (layer) {
      layer.remove()
      layer = null
    }

    layer = L.geoJSON(geojson, {
      style: { color: accent(), weight: 2, fillOpacity: 0.12 },
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
