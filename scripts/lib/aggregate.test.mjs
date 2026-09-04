import { describe, it, expect } from 'vitest'
import { countBy, buildCatalog, NA } from './aggregate.mjs'

const input = {
  generated: '2026-09-04',
  maxFeatures: 5000,
  jurisdicciones: [
    { cpr: '06', nam: 'Buenos Aires' },
    { cpr: '82', nam: 'Santa Fe' },
  ],
  departamentos: [
    { cde: '06840', nam: 'Tres de Febrero', jur: 'Buenos Aires' },
    { cde: '82084', nam: 'Rosario', jur: 'Santa Fe' },
  ],
  localidades: [
    { clc: '06840010', cde: '06840', nam: 'Caseros', jur: 'Buenos Aires', dpto: 'Tres de Febrero', codaglo: '0001' },
    { clc: '82084010', cde: '82084', nam: 'Rosario', jur: 'Santa Fe', dpto: 'Rosario', codaglo: NA },
  ],
  gobiernosLocales: [{ cmu: '060840', nam: 'Tres de Febrero', jur: 'Buenos Aires' }],
  aglomerados: [{ codaglo: '0001', nam: 'Gran Buenos Aires' }],
  fracciones: [{ cde: '06840' }, { cde: '06840' }, { cde: '82084' }],
  radios: [{ cde: '06840' }, { cde: '06840' }, { cde: '06840' }],
  vias: [
    { cde: '06840', cmu: '060840', clc: '06840010', codaglo: '0001' },
    { cde: '06840', cmu: NA, clc: '06840010', codaglo: NA },
  ],
}

describe('countBy', () => {
  it('cuenta por valor de campo', () => {
    const m = countBy([{ cde: 'a' }, { cde: 'a' }, { cde: 'b' }], 'cde')
    expect(m.get('a')).toBe(2)
    expect(m.get('b')).toBe(1)
  })

  it('omite el centinela N/A y los vacíos', () => {
    const m = countBy([{ x: NA }, { x: '' }, { x: '7' }], 'x')
    expect(m.has(NA)).toBe(false)
    expect(m.has('')).toBe(false)
    expect(m.get('7')).toBe(1)
  })
})

describe('buildCatalog', () => {
  const { catalog, warnings } = buildCatalog(input)
  const byCode = (t, c) => catalog.objects.find((o) => o.t === t && o.c === c)

  it('copia la metadata', () => {
    expect(catalog.generated).toBe('2026-09-04')
    expect(catalog.maxFeatures).toBe(5000)
  })

  it('incluye un objeto por cada fila buscable', () => {
    expect(catalog.objects).toHaveLength(2 + 2 + 2 + 1 + 1)
  })

  it('cuenta los hijos de un departamento por cde', () => {
    expect(byCode('dep', '06840').ch).toEqual({
      fracciones: 2, radios: 3, localidades: 1, vias: 2,
    })
  })

  it('cuenta los hijos de una jurisdicción por prefijo de provincia', () => {
    expect(byCode('jur', '06').ch).toEqual({
      departamentos: 1, fracciones: 2, radios: 3, localidades: 1, vias: 2,
    })
  })

  it('el aglomerado cuenta localidades y vías por codaglo', () => {
    expect(byCode('aglo', '0001').ch).toEqual({ localidades: 1, vias: 1 })
  })

  it('la localidad sólo cuenta vías', () => {
    expect(byCode('loc', '06840010').ch).toEqual({ vias: 2 })
  })

  it('el gobierno local no tiene hijos', () => {
    expect(byCode('gl', '060840').ch).toBeUndefined()
  })

  it('usa 0 cuando una capa hija no tiene filas para ese código', () => {
    expect(byCode('dep', '82084').ch.radios).toBe(0)
  })

  it('calcula la clave de búsqueda normalizada', () => {
    expect(byCode('dep', '06840').s).toBe('tres de febrero')
  })

  it('deriva la provincia del aglomerado desde sus localidades', () => {
    expect(byCode('aglo', '0001').p).toBe('Buenos Aires')
  })

  it('la jurisdicción es su propia provincia', () => {
    expect(byCode('jur', '06').p).toBe('Buenos Aires')
  })

  it('no reporta advertencias con datos consistentes', () => {
    expect(warnings).toEqual([])
  })
})

describe('buildCatalog: inconsistencias', () => {
  it('advierte por un código hijo sin padre', () => {
    const { warnings } = buildCatalog({ ...input, radios: [...input.radios, { cde: '99999' }] })
    expect(warnings.join(' ')).toMatch(/99999/)
    expect(warnings.join(' ')).toMatch(/radios/)
  })

  it('advierte por un aglomerado que sólo aparece en vías', () => {
    const vias = [...input.vias, { cde: '06840', cmu: NA, clc: '06840010', codaglo: '7777' }]
    const { warnings } = buildCatalog({ ...input, vias })
    expect(warnings.join(' ')).toMatch(/7777/)
  })
})
