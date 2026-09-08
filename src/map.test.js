// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Leaflet necesita un browser de verdad para medir y pintar. Acá se prueba
// el orden de la carga —quién gana, quién dibuja, quién avisa del error—,
// que es lógica propia del módulo.
const capa = { addTo: () => capa, getBounds: () => 'bounds', remove: vi.fn() }
const mapa = { invalidateSize: vi.fn(), fitBounds: vi.fn(), attributionControl: { setPrefix: vi.fn() } }
const geoJSON = vi.fn(() => capa)
const tileLayer = vi.fn(() => ({ addTo: () => {} }))

vi.mock('leaflet', () => ({
  default: {
    map: () => mapa,
    tileLayer: (...args) => tileLayer(...args),
    geoJSON: (...args) => geoJSON(...args),
  },
}))

const objeto = { t: 'dep', c: '06840', n: 'Tres de Febrero' }
const otro = { t: 'dep', c: '82084', n: 'Rosario' }
const geometria = { features: [{ properties: { fna: 'Tres de Febrero' } }] }
const respuesta = (body = geometria) => ({ ok: true, status: 200, json: async () => body })

let pendientes
let showObject

/** Un fetch que no resuelve hasta que el test lo decide. */
function fetchDiferido() {
  pendientes = []
  return vi.fn(() => new Promise((resolve, reject) => pendientes.push({ resolve, reject })))
}

beforeEach(async () => {
  vi.resetModules()
  geoJSON.mockClear()
  capa.remove.mockClear()
  tileLayer.mockClear()
  mapa.attributionControl.setPrefix.mockClear()
  global.fetch = fetchDiferido()
  const map = await import('./map.js')
  map.initMap('map')
  showObject = map.showObject
})

// El prefijo por defecto del attributionControl es el enlace a Leaflet, y
// desde 1.9 trae adentro una bandera de Ucrania: no es la atribución del
// dato que se está mostrando, así que no tiene lugar en la interfaz.
describe('initMap: la interfaz acredita al IGN, no a Leaflet', () => {
  it('no acredita a Leaflet: ni el enlace ni la bandera que viaja en ese prefijo', () => {
    expect(mapa.attributionControl.setPrefix).toHaveBeenCalledWith(false)
  })

  it('la atribución del IGN queda: es la del basemap, no la de la librería', () => {
    const opcionesDelTileLayer = tileLayer.mock.calls[0][1]
    expect(opcionesDelTileLayer.attribution).toBe('Instituto Geográfico Nacional, OpenStreetMap')
  })
})

describe('showObject: la selección más nueva manda', () => {
  it('dibuja la que gana', async () => {
    const p = showObject(objeto)
    pendientes[0].resolve(respuesta())
    await p
    expect(geoJSON).toHaveBeenCalledTimes(1)
    expect(mapa.fitBounds).toHaveBeenCalledWith('bounds', { padding: [16, 16] })
  })

  it('la superada no dibuja, aunque su respuesta llegue bien', async () => {
    const vieja = showObject(objeto)
    const nueva = showObject(otro)
    pendientes[1].resolve(respuesta())
    await nueva
    pendientes[0].resolve(respuesta())
    await vieja
    expect(geoJSON).toHaveBeenCalledTimes(1)
  })

  // Las tres formas de fallar tienen que callarse igual cuando la petición
  // ya fue superada: si no, el error de la vieja pisa la línea de estado de
  // la nueva, que se dibujó bien.
  it('la superada se calla si se le cae la red', async () => {
    const vieja = showObject(objeto)
    const nueva = showObject(otro)
    pendientes[1].resolve(respuesta())
    await nueva
    pendientes[0].reject(new TypeError('Failed to fetch'))
    await expect(vieja).resolves.toBeUndefined()
  })

  it('la superada se calla si el servidor contesta con error', async () => {
    const vieja = showObject(objeto)
    const nueva = showObject(otro)
    pendientes[1].resolve(respuesta())
    await nueva
    pendientes[0].resolve({ ok: false, status: 500 })
    await expect(vieja).resolves.toBeUndefined()
  })

  it('la superada se calla si el cuerpo no se puede leer', async () => {
    const vieja = showObject(objeto)
    const nueva = showObject(otro)
    pendientes[1].resolve(respuesta())
    await nueva
    pendientes[0].resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError('JSON roto') } })
    await expect(vieja).resolves.toBeUndefined()
  })
})

describe('showObject: la que está vigente sí avisa del error', () => {
  it('propaga la caída de red', async () => {
    const p = showObject(objeto)
    pendientes[0].reject(new TypeError('Failed to fetch'))
    await expect(p).rejects.toThrow(/Failed to fetch/)
  })

  it('propaga el error HTTP con su status', async () => {
    const p = showObject(objeto)
    pendientes[0].resolve({ ok: false, status: 503 })
    await expect(p).rejects.toThrow(/503/)
  })

  it('propaga la respuesta sin geometría', async () => {
    const p = showObject(objeto)
    pendientes[0].resolve(respuesta({ features: [] }))
    await expect(p).rejects.toThrow(/geometría/)
  })
})
