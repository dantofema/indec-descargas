import { describe, it, expect } from 'vitest'
import { codeIndex, parentsOf } from './parents.js'

const objects = [
  { t: 'jur', c: '06', n: 'Buenos Aires' },
  { t: 'dep', c: '06840', n: 'Tres de Febrero' },
  { t: 'loc', c: '06840010', n: 'Tres de Febrero', ag: '0001' },
  { t: 'gl', c: '060840', n: 'Tres de Febrero' },
  { t: 'aglo', c: '0001', n: 'Gran Buenos Aires' },
]
const index = codeIndex(objects)
const codigos = (obj) => parentsOf(obj, index).map((o) => `${o.t}:${o.c}`)
const buscar = (t, c) => objects.find((o) => o.t === t && o.c === c)

describe('parentsOf', () => {
  it('la jurisdicción no tiene padres', () => {
    expect(parentsOf(buscar('jur', '06'), index)).toEqual([])
  })

  it('el departamento cuelga de su jurisdicción', () => {
    expect(codigos(buscar('dep', '06840'))).toEqual(['jur:06'])
  })

  it('la localidad da la cadena entera, del más cercano al más lejano', () => {
    expect(codigos(buscar('loc', '06840010'))).toEqual(['dep:06840', 'jur:06', 'aglo:0001'])
  })

  it('el gobierno local sólo llega a la jurisdicción', () => {
    expect(codigos(buscar('gl', '060840'))).toEqual(['jur:06'])
  })

  it('el aglomerado no tiene padre: cruza jurisdicciones', () => {
    expect(parentsOf(buscar('aglo', '0001'), index)).toEqual([])
  })

  // DES-R8: los códigos del INDEC no cierran entre capas. Un padre derivado
  // puede no existir, y ahí no se ofrece en vez de armar una URL a ciegas.
  it('descarta el padre derivado que no está en el catálogo', () => {
    const huerfano = { t: 'dep', c: '99999', n: 'Inventado' }
    expect(parentsOf(huerfano, codeIndex([huerfano]))).toEqual([])
  })

  it('la localidad sin ag no ofrece aglomerado', () => {
    const sinAglo = { t: 'loc', c: '06840010', n: 'x' }
    expect(codigos(sinAglo)).toEqual(['dep:06840', 'jur:06'])
  })
})

describe('los padres de un objeto sin catálogo', () => {
  const index = codeIndex([
    { t: 'jur', c: '06', n: 'Buenos Aires' },
    { t: 'dep', c: '06469', n: 'Malvinas Argentinas' },
    { t: 'loc', c: '06469080', n: 'Grand Bourg' },
  ])

  it('un radio cuelga de su fracción, su departamento y su jurisdicción', () => {
    const padres = parentsOf({ t: 'rad', c: '064690801' }, index)
    expect(padres.map((p) => [p.t, p.c])).toEqual([
      ['frac', '0646908'], ['dep', '06469'], ['jur', '06'],
    ])
  })

  it('el padre que no está en el catálogo se ofrece igual, sin nombre', () => {
    const [frac] = parentsOf({ t: 'rad', c: '064690801' }, index)
    expect(frac.n).toBeNull()
  })

  it('una vía cuelga de su localidad censal: su código empieza con el clc', () => {
    const padres = parentsOf({ t: 'via', c: '0646908000600' }, index)
    expect(padres.map((p) => [p.t, p.c])).toEqual([
      ['loc', '06469080'], ['dep', '06469'], ['jur', '06'],
    ])
  })

  it('una fracción cuelga de su departamento y su jurisdicción', () => {
    expect(parentsOf({ t: 'frac', c: '0646908' }, index).map((p) => p.t)).toEqual(['dep', 'jur'])
  })

  // DES-R8: los códigos del INDEC no cierran entre capas, así que un prefijo
  // válido puede apuntar a un objeto que el catálogo no tiene.
  it('un padre de catálogo que no existe se descarta, y uno sintético no', () => {
    const vacio = codeIndex([])
    const padres = parentsOf({ t: 'rad', c: '064690801' }, vacio)
    expect(padres.map((p) => p.t)).toEqual(['frac'])
  })
})
