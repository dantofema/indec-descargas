import { describe, it, expect } from 'vitest'
import { parse, format } from './permalink.js'

const search = (href) => new URL(href, 'http://x').search

describe('parse', () => {
  it('sin parámetros es vacío, no un error', () => {
    expect(parse('')).toEqual({ status: 'empty' })
    expect(parse('?')).toEqual({ status: 'empty' })
  })

  it('lee tipo y código', () => {
    expect(parse('?t=dep&c=06840')).toEqual(
      { status: 'ok', type: 'dep', code: '06840', layer: null, layerRequested: false },
    )
  })

  it('conserva los ceros a la izquierda del código', () => {
    expect(parse('?t=jur&c=02').code).toBe('02')
  })

  it('lee la capa cuando es una de las declaradas', () => {
    expect(parse('?t=dep&c=06840&capa=radios')).toEqual(
      { status: 'ok', type: 'dep', code: '06840', layer: 'radios', layerRequested: true },
    )
  })

  it('ignora una capa que no existe en vez de fallar: la ficha sirve igual', () => {
    expect(parse('?t=dep&c=06840&capa=inventada').layer).toBeNull()
  })

  // `layer: null` solo no alcanza: la página lo usa para decidir si
  // reescribe la barra, y "no nombró capa" y "nombró una que no existe" le
  // piden cosas opuestas. Sin distinguirlos, `?capa=radioss` abre
  // fracciones y deja la barra —y el botón "Copiar enlace"— diciendo
  // `capa=radioss`, que es una capa que la página no muestra.
  it('distingue no nombrar capa de nombrar una que no existe', () => {
    expect(parse('?t=dep&c=06840').layerRequested).toBe(false)
    expect(parse('?t=dep&c=06840&capa=radios').layerRequested).toBe(true)
    expect(parse('?t=dep&c=06840&capa=radioss').layerRequested).toBe(true)
    expect(parse('?t=dep&c=06840&capa=radioss').layer).toBeNull()
  })

  it('rechaza un tipo desconocido', () => {
    expect(parse('?t=xx&c=06840').status).toBe('invalid')
  })

  it('rechaza un código que no son dígitos: es lo que se interpola en el CQL', () => {
    expect(parse("?t=dep&c=06840'+OR+1=1").status).toBe('invalid')
    expect(parse('?t=dep&c=abc').status).toBe('invalid')
  })

  it('rechaza que falte cualquiera de los dos', () => {
    expect(parse('?t=dep').status).toBe('invalid')
    expect(parse('?c=06840').status).toBe('invalid')
  })

  it('el motivo dice qué parámetro está mal', () => {
    expect(parse('?t=xx&c=06840').reason).toMatch(/tipo/i)
    expect(parse('?t=dep&c=abc').reason).toMatch(/código|codigo/i)
  })

  it('un nombre de la cadena de prototipos no es un tipo: `in` decía que sí', () => {
    for (const t of ['constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
      expect(parse(`?t=${t}&c=06840`).status, t).toBe('invalid')
    }
  })

  it('tampoco es una capa', () => {
    for (const capa of ['constructor', 'toString', '__proto__']) {
      expect(parse(`?t=dep&c=06840&capa=${capa}`).layer, capa).toBeNull()
    }
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

  // La clave de la URL es de cable, no del objeto que devuelve `parse`: fija
  // que sigue siendo `capa=` y no el nombre nuevo del campo (`layer`).
  it('la clave de la URL sigue siendo capa, no layer', () => {
    expect(format({ t: 'dep', c: '06840' }, 'radios')).toContain('capa=radios')
    expect(format({ t: 'dep', c: '06840' }, 'radios')).not.toContain('layer=')
  })

  it('ida y vuelta: lo que formatea es lo que parsea', () => {
    for (const layer of [null, 'vias']) {
      const obj = { t: 'loc', c: '06840010' }
      expect(parse(search(format(obj, layer))))
        .toEqual({ status: 'ok', type: obj.t, code: obj.c, layer, layerRequested: layer !== null })
    }
  })
})
