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
let onFeatureSpy

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
  onFeatureSpy = vi.fn()
  map.onFeature(onFeatureSpy)
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

  // Fix round 1, hallazgo 4: es el único lugar de esta tarea que arma un
  // CQL_FILTER nuevo (featureQueryUrl) y no tenía test de la URL en sí.
  it('arma la URL con la capa, el campo y el código exactos', async () => {
    const p = showFeature('geonode:radios_censales2', 'cod_indec', '068400101')
    pendientes[0].resolve(respuesta())
    await p
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('typenames=geonode%3Aradios_censales2')
    expect(url).toContain('CQL_FILTER=cod_indec%3D%27068400101%27')
    expect(url).toContain('outputFormat=application%2Fjson')
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

// Fix round 3, hallazgo 4: el diseño dice textualmente que «"Ver" que falla
// deja el mapa como estaba y avisa». `beginRequest` borraba la capa de
// entrada, así que un showFeature que responde 503 dejaba el mapa vacío —y
// en vías lo dejaba vacío los ~12 s de espera aun cuando iba a salir bien—.
describe('lo dibujado no se borra hasta que hay con qué reemplazarlo', () => {
  it('un Ver que falla deja el mapa como estaba', async () => {
    const dibujo = showObject(objeto)
    pendientes[0].resolve(respuesta())
    await dibujo

    const falla = showFeature('geonode:radios_censales2', 'cod_indec', '068400101')
    pendientes[1].resolve({ ok: false, status: 503 })
    await expect(falla).rejects.toThrow(/503/)
    expect(capa.remove).not.toHaveBeenCalled()
  })

  it('una respuesta sin geometría tampoco borra lo que había', async () => {
    const dibujo = showObject(objeto)
    pendientes[0].resolve(respuesta())
    await dibujo

    const vacia = showFeature('geonode:radios_censales2', 'cod_indec', '068400101')
    pendientes[1].resolve(respuesta({ features: [] }))
    await expect(vacia).rejects.toThrow(/geometría/)
    expect(capa.remove).not.toHaveBeenCalled()
  })

  it('mientras el pedido está en vuelo, lo dibujado sigue ahí', async () => {
    const dibujo = showObject(objeto)
    pendientes[0].resolve(respuesta())
    await dibujo

    showFeature('geonode:vias_de_circulacion', 'cod_indec', '068400101')
    await Promise.resolve()
    expect(capa.remove).not.toHaveBeenCalled()
  })

  it('un dibujo que sale bien sí reemplaza al anterior', async () => {
    const dibujo = showObject(objeto)
    pendientes[0].resolve(respuesta())
    await dibujo

    const otroDibujo = showFeature('geonode:radios_censales2', 'cod_indec', '068400101')
    pendientes[1].resolve(respuesta())
    await otroDibujo
    expect(capa.remove).toHaveBeenCalledTimes(1)
    expect(geoJSON).toHaveBeenCalledTimes(2)
  })
})

// Fix round 1, hallazgo 1 (importante): la línea de metadatos de la fila 1
// describe el objeto de la ficha, siempre, y nunca acumula. Antes,
// showFeature disparaba el mismo callback que showObject y cada "Ver"
// pegaba otro tramo de texto sin límite a `#detail-meta` (ver main.js).
describe('la identidad del objeto no la toca un Ver', () => {
  it('showObject sí avisa las propiedades del objeto: esa línea lo describe', async () => {
    const p = showObject(objeto)
    pendientes[0].resolve(respuesta())
    await p
    expect(onFeatureSpy).toHaveBeenCalledWith(geometria.features[0].properties)
  })

  it('showFeature no avisa nada: mirar una fila no cambia la identidad de la ficha', async () => {
    const p = showFeature('geonode:radios_censales2', 'cod_indec', '068400101')
    pendientes[0].resolve(respuesta())
    await p
    expect(onFeatureSpy).not.toHaveBeenCalled()
  })
})
