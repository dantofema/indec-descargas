import { describe, it, expect } from 'vitest'
import { findByCode, childrenOf } from './catalog.js'

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

// Separate fixture with a real code collision (same code, different type)
const collisionCatalog = {
  generated: '2026-09-04',
  maxFeatures: 5000,
  objects: [
    { t: 'dep', c: '06840', n: 'Departamento Tres de Febrero', s: 'departamento', p: 'Buenos Aires' },
    { t: 'gl', c: '06840', n: 'GL Tres de Febrero', s: 'gobierno local', p: 'Buenos Aires' },
  ],
}

describe('findByCode', () => {
  it('encuentra por tipo y código', () => {
    expect(findByCode(catalog, 'dep', '06840').n).toBe('Tres de Febrero')
  })

  it('distingue objetos con el mismo código en tipos distintos', () => {
    const dep = findByCode(collisionCatalog, 'dep', '06840')
    const gl = findByCode(collisionCatalog, 'gl', '06840')
    expect(dep.t).toBe('dep')
    expect(gl.t).toBe('gl')
  })

  it('devuelve undefined si no está', () => {
    expect(findByCode(catalog, 'dep', '99999')).toBeUndefined()
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
