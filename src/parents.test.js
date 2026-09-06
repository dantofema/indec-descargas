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
