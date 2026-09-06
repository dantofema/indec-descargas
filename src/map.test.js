// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Leaflet necesita un browser de verdad para medir y pintar. Acá se prueba
// el orden de la carga —quién gana, quién dibuja, quién avisa del error—,
// que es lógica propia del módulo.
const capa = { addTo: () => capa, getBounds: () => 'bounds', remove: vi.fn() }
const mapa = { invalidateSize: vi.fn(), fitBounds: vi.fn() }
const geoJSON = vi.fn(() => capa)

vi.mock('leaflet', () => ({
  default: {
    map: () => mapa,
    tileLayer: () => ({ addTo: () => {} }),
    geoJSON: (...args) => geoJSON(...args),
  },
}))

const objeto = { t: 'dep', c: '06840', n: 'Tres de Febrero' }
const otro = { t: 'dep', c: '82084', n: 'Rosario' }
const geometria = { features: [{ properties: { fna: 'Tres de Febrero' } }] }
const respuesta = (body = geometria) => ({ ok: true, status: 200, json: async () => body })

let pendientes
let showObject
let showFeature

/** Un fetch que no resuelve hasta que el test lo decide. */
function fetchDiferido() {
  pendientes = []
  return vi.fn(() => new Promise((resolve, reject) => pendientes.push({ resolve, reject })))
}

beforeEach(async () => {
  vi.resetModules()
  geoJSON.mockClear()
  capa.remove.mockClear()
  global.fetch = fetchDiferido()
  const map = await import('./map.js')
  map.initMap('map')
  showObject = map.showObject
  showFeature = map.showFeature
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

// `showFeature` es el punto de entrada que usa la fila de hijos: dibuja un
// feature suelto (capa, campo y código) en vez del objeto de la búsqueda.
// Comparte con showObject el fetch/dibujo/guarda de carrera —extraídos a
// una función común—, así que sólo hace falta re-probar que arma bien su
// propio pedido y que la carrera también funciona cruzada con showObject.
describe('showFeature', () => {
  it('dibuja el feature pedido por capa, campo y código', async () => {
    const p = showFeature('geonode:radios_censales2', 'cod_indec', '068400101')
    pendientes[0].resolve(respuesta())
    await p
    expect(geoJSON).toHaveBeenCalledTimes(1)
    expect(mapa.fitBounds).toHaveBeenCalledWith('bounds', { padding: [16, 16] })
  })

  it('valida el código antes de armar el CQL_FILTER', async () => {
    await expect(showFeature('geonode:radios_censales2', 'cod_indec', "1' OR '1'='1"))
      .rejects.toThrow(/código inválido/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('propaga el error HTTP con su status', async () => {
    const p = showFeature('geonode:radios_censales2', 'cod_indec', '068400101')
    pendientes[0].resolve({ ok: false, status: 503 })
    await expect(p).rejects.toThrow(/503/)
  })

  it('una selección de objeto superada por un Ver no pisa lo que dibujó el Ver', async () => {
    const vieja = showObject(objeto)
    const nueva = showFeature('geonode:radios_censales2', 'cod_indec', '068400101')
    pendientes[1].resolve(respuesta())
    await nueva
    pendientes[0].resolve(respuesta())
    await vieja
    expect(geoJSON).toHaveBeenCalledTimes(1)
  })

  it('un Ver superado por una nueva selección de objeto no pisa el mapa', async () => {
    const vieja = showFeature('geonode:radios_censales2', 'cod_indec', '068400101')
    const nueva = showObject(otro)
    pendientes[1].resolve(respuesta())
    await nueva
    pendientes[0].resolve(respuesta())
    await expect(vieja).resolves.toBeUndefined()
    expect(geoJSON).toHaveBeenCalledTimes(1)
  })
})
