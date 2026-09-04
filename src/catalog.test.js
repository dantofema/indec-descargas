import { describe, it, expect } from 'vitest'
import { childrenOf } from './catalog.js'

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
