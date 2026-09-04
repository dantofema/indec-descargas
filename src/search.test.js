import { describe, it, expect } from 'vitest'
import { normalize, search } from './search.js'

// El `gl` va antes que el `dep` a propósito: `Array.prototype.sort` es
// estable, así que con el orden natural el resultado esperado salía del
// orden de inserción y el desempate por TYPE_ORDER no se ejercitaba.
const objects = [
  { t: 'gl', c: '060840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires' },
  { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires' },
  { t: 'loc', c: '06840010', n: 'Caseros', s: 'caseros', p: 'Buenos Aires' },
  { t: 'dep', c: '82084', n: 'Rosario', s: 'rosario', p: 'Santa Fe' },
  { t: 'jur', c: '06', n: 'Buenos Aires', s: 'buenos aires', p: 'Buenos Aires' },
]

describe('normalize', () => {
  it('pasa a minúsculas', () => {
    expect(normalize('Tres De Febrero')).toBe('tres de febrero')
  })

  it('saca acentos y diéresis', () => {
    expect(normalize('Neuquén')).toBe('neuquen')
    expect(normalize('Río Negro')).toBe('rio negro')
    expect(normalize('Güer Aike')).toBe('guer aike')
  })

  it('colapsa espacios internos y recorta los bordes', () => {
    expect(normalize('  Tres   de  Febrero ')).toBe('tres de febrero')
  })

  it('sobrevive a entradas vacías o nulas', () => {
    expect(normalize('')).toBe('')
    expect(normalize(null)).toBe('')
    expect(normalize(undefined)).toBe('')
  })
})

describe('search', () => {
  it('encuentra por prefijo parcial', () => {
    const r = search(objects, 'Tres de Febr')
    expect(r.map((o) => o.c)).toContain('06840')
  })

  it('ignora acentos en la consulta', () => {
    const r = search([{ t: 'jur', c: '58', n: 'Neuquén', s: 'neuquen' }], 'neuquén')
    expect(r).toHaveLength(1)
  })

  it('pone los prefijos antes que las coincidencias internas', () => {
    const objs = [
      { t: 'dep', c: '1', n: 'Villa Rosario', s: 'villa rosario' },
      { t: 'dep', c: '2', n: 'Rosario', s: 'rosario' },
    ]
    expect(search(objs, 'rosario').map((o) => o.c)).toEqual(['2', '1'])
  })

  it('ordena por tipo dentro del mismo grupo de coincidencia', () => {
    const r = search(objects, 'tres de febrero')
    expect(r.map((o) => o.t)).toEqual(['dep', 'gl'])
  })

  it('devuelve vacío para consulta vacía o de un solo carácter', () => {
    expect(search(objects, '')).toEqual([])
    expect(search(objects, '  ')).toEqual([])
    expect(search(objects, 'a')).toEqual([])
  })

  it('respeta el tope de resultados', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      t: 'dep', c: String(i), n: `Rosario ${i}`, s: `rosario ${i}`,
    }))
    expect(search(many, 'rosario')).toHaveLength(20)
    expect(search(many, 'rosario', 5)).toHaveLength(5)
  })
})
