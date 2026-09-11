// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
// jsdom pisa el `URL` global con el suyo, que `readFileSync` no acepta
// (protocolo no es "file:"): hace falta el de Node, con nombre explícito.
import { URL as NodeURL } from 'node:url'
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
/**
 * Cierra SITIO-R8 de `docs/reglas/sitio.md`: el mapa no acredita a Leaflet; sí al
 * IGN.
 */
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

// El basemap del IGN es claro en las dos paletas y el color de la geometría
// tiene que leerse encima en las dos (APAR-R5): por eso sale de --accent, el
// token del sitio, y no de un azul fijo que ninguna paleta declaró.
describe('showObject: la geometría toma su color de --accent, no de un literal', () => {
  it('no hardcodea el azul de GitHub como color de la geometría', () => {
    const codigo = readFileSync(new NodeURL('./map.js', import.meta.url), 'utf8')
    // El literal puede seguir vivo como fallback de --accent (ver el test de
    // abajo): lo que esta regla prohíbe es que sea el color que efectivamente
    // pinta, no que la palabra exista en algún lado del archivo.
    expect(codigo).not.toMatch(/style:\s*\{\s*color:\s*['"]#1f6feb['"]/)
  })

  it('lee --accent del documento para pintar la geometría', async () => {
    document.documentElement.style.setProperty('--accent', '#00c2ff')
    try {
      const p = showObject(objeto)
      pendientes[0].resolve(respuesta())
      await p
      expect(geoJSON.mock.calls[0][1].style.color).toBe('#00c2ff')
    } finally {
      document.documentElement.style.removeProperty('--accent')
    }
  })

  it('si --accent no resuelve, cae al azul viejo en vez de dejar la geometría sin color', async () => {
    const p = showObject(objeto)
    pendientes[0].resolve(respuesta())
    await p
    expect(geoJSON.mock.calls[0][1].style.color).toBe('#1f6feb')
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

// Fix round 1, hallazgo 5: hoy `showObject` se llama una sola vez por carga
// de página —elegir otro objeto navega, no vuelve a llamar `showObject` en
// la misma instancia—, así que esta rama es defensiva y no una carrera que
// pase en producción todavía. Se prueba igual: el día que algo dibuje una
// segunda vez en la misma página, el mapa tiene que seguir sin quedar en
// blanco mientras llega la geometría nueva, y borrar la defensa porque hoy
// nadie la ejercita es cómo vuelve el bug.
describe('lo dibujado no se borra hasta que hay con qué reemplazarlo', () => {
  it('un dibujo que falla deja el mapa como estaba', async () => {
    const primero = showObject(objeto)
    pendientes[0].resolve(respuesta())
    await primero

    const segundo = showObject(otro)
    pendientes[1].resolve({ ok: false, status: 503 })
    await expect(segundo).rejects.toThrow(/503/)
    expect(capa.remove).not.toHaveBeenCalled()
    // No sólo "no se borró": lo que queda dibujado sigue siendo la capa del
    // primer showObject —geoJSON no se volvió a llamar—, no una vacía o a
    // medio construir.
    expect(geoJSON).toHaveBeenCalledTimes(1)
  })

  it('una respuesta sin geometría tampoco borra lo que había', async () => {
    const primero = showObject(objeto)
    pendientes[0].resolve(respuesta())
    await primero

    const segundo = showObject(otro)
    pendientes[1].resolve(respuesta({ features: [] }))
    await expect(segundo).rejects.toThrow(/geometría/)
    expect(capa.remove).not.toHaveBeenCalled()
  })

  it('mientras el pedido está en vuelo, lo dibujado sigue ahí', async () => {
    const primero = showObject(objeto)
    pendientes[0].resolve(respuesta())
    await primero

    showObject(otro)
    await Promise.resolve()
    expect(capa.remove).not.toHaveBeenCalled()
  })

  it('un dibujo que sale bien sí reemplaza al anterior', async () => {
    const primero = showObject(objeto)
    pendientes[0].resolve(respuesta())
    await primero

    const segundo = showObject(otro)
    pendientes[1].resolve(respuesta())
    await segundo
    expect(capa.remove).toHaveBeenCalledTimes(1)
    expect(geoJSON).toHaveBeenCalledTimes(2)
  })
})
