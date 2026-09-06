import { describe, it, expect, vi } from 'vitest'
import { childrenOf, nonEmptyChildrenOf, loadCatalog } from './catalog.js'
import { CHILD_LAYERS } from './download.js'

const catalog = {
  generated: '2026-09-04',
  objects: [
    // Las claves de `ch` van desordenadas a propósito: con el orden
    // natural, `Object.keys` habría pasado el test igual que CHILD_ORDER.
    { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires',
      ch: { vias: 1487, fracciones: 42, radios: 432, localidades: 1 } },
    { t: 'gl', c: '060840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires' },
    { t: 'loc', c: '06840010', n: 'Caseros', s: 'caseros', p: 'Buenos Aires', ch: { vias: 0 } },
  ],
}

// El orden de las capas hijas vive en catalog.js y las capas mismas en
// download.js. Si se separan, una capa nueva no aparece nunca (falta en el
// orden) o hace explotar a quien la busque (falta en las capas). Es el mismo
// guard que columns.test.js pone del otro lado.
describe('el orden de las capas y las capas declaradas', () => {
  it('nombran exactamente las mismas capas', () => {
    const enOrden = childrenOf({ ch: Object.fromEntries(Object.keys(CHILD_LAYERS).map((k) => [k, 1])) })
    expect(enOrden.map((c) => c.key).sort()).toEqual(Object.keys(CHILD_LAYERS).sort())
  })
})

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

// Fix round 3, hallazgo 3: el cero tiene dos lectores con necesidades
// opuestas. La fila 2 lo necesita para dibujar el botón muerto con su
// motivo (DES-R3), y las filas 3 y 4 no tienen nada que ofrecer sobre una
// capa vacía. Por eso `childrenOf` sigue devolviendo todo y el filtro es
// una pregunta aparte, escrita una sola vez para sus dos consumidores.
describe('nonEmptyChildrenOf', () => {
  it('saca las capas con conteo cero', () => {
    expect(nonEmptyChildrenOf(catalog.objects[2])).toEqual([])
  })

  it('deja intactas las capas que tienen objetos, en el mismo orden', () => {
    expect(nonEmptyChildrenOf(catalog.objects[0])).toEqual(childrenOf(catalog.objects[0]))
  })

  it('saca sólo el cero cuando convive con capas llenas', () => {
    const mixto = { t: 'dep', c: '94028', n: 'Antártida Argentina', ch: { fracciones: 3, localidades: 0, vias: 0 } }
    expect(nonEmptyChildrenOf(mixto)).toEqual([{ key: 'fracciones', count: 3 }])
  })

  it('un objeto sin hijos devuelve vacío, como childrenOf', () => {
    expect(nonEmptyChildrenOf(catalog.objects[1])).toEqual([])
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
