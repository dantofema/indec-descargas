import { describe, it, expect, vi } from 'vitest'
import { childrenOf, loadCatalog } from './catalog.js'

const catalog = {
  generated: '2026-09-04',
  maxFeatures: 5000,
  objects: [
    // Las claves de `ch` van desordenadas a propósito: con el orden
    // natural, `Object.keys` habría pasado el test igual que CHILD_ORDER.
    { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires',
      ch: { vias: 1487, fracciones: 42, radios: 432, localidades: 1 } },
    { t: 'gl', c: '060840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires' },
    { t: 'loc', c: '06840010', n: 'Caseros', s: 'caseros', p: 'Buenos Aires', ch: { vias: 0 } },
  ],
}

describe('childrenOf', () => {
  it('lista los hijos en el orden declarado', () => {
    expect(childrenOf(catalog.objects[0])).toEqual([
      { key: 'fracciones', count: 42 },
      { key: 'radios', count: 432 },
      { key: 'localidades', count: 1 },
      { key: 'vias', count: 1487 },
    ])
  })

  it('devuelve vacío para un objeto sin hijos', () => {
    expect(childrenOf(catalog.objects[1])).toEqual([])
  })

  it('conserva los hijos con conteo cero', () => {
    expect(childrenOf(catalog.objects[2])).toEqual([{ key: 'vias', count: 0 }])
  })
})

// BUS-R3: la búsqueda mira también la provincia, y la compara normalizada.
// La clave se deriva al cargar y no en el build: `p` ya viaja en el JSON, y
// precalcularla ahí le sumaría mas de 100 KB al catalogo commiteado.
describe('loadCatalog', () => {
  const responder = (objects) => vi.fn(async () => ({ ok: true, json: async () => ({ objects }) }))

  it('agrega la clave normalizada de la provincia', async () => {
    global.fetch = responder([{ t: 'loc', n: 'Caseros', s: 'caseros', p: 'Buenos Aires' }])
    const c = await loadCatalog('/catalog.json')
    expect(c.objects[0].sp).toBe('buenos aires')
  })

  it('le saca los acentos igual que al nombre', async () => {
    global.fetch = responder([{ t: 'loc', n: 'Centenario', s: 'centenario', p: 'Neuqu\u00e9n' }])
    const c = await loadCatalog('/catalog.json')
    expect(c.objects[0].sp).toBe('neuquen')
  })

  it('deja la clave vacía si el objeto no trae provincia', async () => {
    global.fetch = responder([{ t: 'jur', n: 'Santa Fe', s: 'santa fe' }])
    const c = await loadCatalog('/catalog.json')
    expect(c.objects[0].sp).toBe('')
  })
})
