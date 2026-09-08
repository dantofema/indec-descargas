import { describe, it, expect } from 'vitest'
import { parse, format } from './permalink.js'

const search = (href) => new URL(href, 'http://x').search

describe('parse', () => {
  it('sin parámetros es vacío, no un error', () => {
    expect(parse('')).toEqual({ estado: 'vacio' })
    expect(parse('?')).toEqual({ estado: 'vacio' })
  })

  it('lee tipo y código', () => {
    expect(parse('?t=dep&c=06840')).toEqual({ estado: 'ok', t: 'dep', c: '06840', capa: null })
  })

  it('conserva los ceros a la izquierda del código', () => {
    expect(parse('?t=jur&c=02').c).toBe('02')
  })

  it('lee la capa cuando es una de las declaradas', () => {
    expect(parse('?t=dep&c=06840&capa=radios')).toEqual(
      { estado: 'ok', t: 'dep', c: '06840', capa: 'radios' },
    )
  })

  it('ignora una capa que no existe en vez de fallar: la ficha sirve igual', () => {
    expect(parse('?t=dep&c=06840&capa=inventada').capa).toBeNull()
  })

  it('rechaza un tipo desconocido', () => {
    expect(parse('?t=xx&c=06840').estado).toBe('invalido')
  })

  it('rechaza un código que no son dígitos: es lo que se interpola en el CQL', () => {
    expect(parse("?t=dep&c=06840'+OR+1=1").estado).toBe('invalido')
    expect(parse('?t=dep&c=abc').estado).toBe('invalido')
  })

  it('rechaza que falte cualquiera de los dos', () => {
    expect(parse('?t=dep').estado).toBe('invalido')
    expect(parse('?c=06840').estado).toBe('invalido')
  })

  it('el motivo dice qué parámetro está mal', () => {
    expect(parse('?t=xx&c=06840').motivo).toMatch(/tipo/i)
    expect(parse('?t=dep&c=abc').motivo).toMatch(/código|codigo/i)
  })
})

describe('format', () => {
  it('arma el href de resultados', () => {
    expect(format({ t: 'dep', c: '06840' })).toMatch(/resultados\/\?t=dep&c=06840$/)
  })

  it('agrega la capa sólo si se pide', () => {
    expect(format({ t: 'dep', c: '06840' })).not.toMatch(/capa/)
    expect(format({ t: 'dep', c: '06840' }, 'radios')).toMatch(/&capa=radios$/)
  })

  it('ida y vuelta: lo que formatea es lo que parsea', () => {
    for (const capa of [null, 'vias']) {
      const obj = { t: 'loc', c: '06840010' }
      expect(parse(search(format(obj, capa)))).toEqual({ estado: 'ok', ...obj, capa })
    }
  })
})
