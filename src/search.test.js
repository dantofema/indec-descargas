import { describe, it, expect } from 'vitest'
import { normalize, search, codeMatches } from './search.js'

// El `gl` va antes que el `dep` a propósito: `Array.prototype.sort` es
// estable, así que con el orden natural el resultado esperado salía del
// orden de inserción y el desempate por TYPE_ORDER no se ejercitaba.
const objects = [
  { t: 'gl', c: '060840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires', sp: 'buenos aires' },
  { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires', sp: 'buenos aires' },
  { t: 'loc', c: '06840010', n: 'Caseros', s: 'caseros', p: 'Buenos Aires', sp: 'buenos aires' },
  { t: 'dep', c: '82084', n: 'Rosario', s: 'rosario', p: 'Santa Fe', sp: 'santa fe' },
  { t: 'jur', c: '06', n: 'Buenos Aires', s: 'buenos aires', p: 'Buenos Aires', sp: 'buenos aires' },
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
    expect(search(many, 'rosario', { limit: 5 })).toHaveLength(5)
  })
})

// BUS-R2: los términos se buscan sueltos, así que el usuario no tiene que
// acordarse de las palabras de relleno del nombre oficial.
describe('search con varias palabras', () => {
  it('encuentra aunque falten las palabras del medio', () => {
    expect(search(objects, 'tres febrero').map((o) => o.c)).toContain('06840')
  })

  it('encuentra con los términos en cualquier orden', () => {
    expect(search(objects, 'febrero tres').map((o) => o.c)).toContain('06840')
  })

  it('exige que estén todos los términos, no alguno', () => {
    expect(search(objects, 'tres rosario')).toEqual([])
  })
})

// BUS-R3: la provincia refina una búsqueda por nombre; no busca sola.
describe('search por provincia', () => {
  it('acepta la provincia como término extra', () => {
    expect(search(objects, 'caseros buenos aires').map((o) => o.c)).toEqual(['06840010'])
  })

  it('no lista una provincia entera cuando ningún término cae en el nombre', () => {
    const r = search(objects, 'buenos aires')
    expect(r.map((o) => o.c)).toEqual(['06'])
  })
})

// BUS-R4: cinco niveles, del match más literal al más laxo.
describe('el orden de los resultados', () => {
  it('pone la coincidencia entera antes que la que necesita la provincia', () => {
    const objs = [
      { t: 'dep', c: '1', n: 'Rosario', s: 'rosario', p: 'Santa Fe', sp: 'santa fe' },
      { t: 'dep', c: '2', n: 'Rosario Santa Ana', s: 'rosario santa ana', p: 'Córdoba', sp: 'cordoba' },
    ]
    expect(search(objs, 'santa rosario').map((o) => o.c)).toEqual(['2', '1'])
  })

  it('pone la consulta contigua antes que los términos sueltos', () => {
    const objs = [
      { t: 'dep', c: '1', n: 'Santa Rosa del Conlara', s: 'santa rosa del conlara', sp: '' },
      { t: 'dep', c: '2', n: 'Rosa de Santa Fe', s: 'rosa de santa fe', sp: '' },
    ]
    expect(search(objs, 'santa rosa').map((o) => o.c)).toEqual(['1', '2'])
  })
})

// BUS-R1: el filtro acota sobre qué tipo de objeto se busca.
describe('search filtrada por tipo', () => {
  it('devuelve sólo el tipo pedido', () => {
    expect(search(objects, 'tres de febrero', { type: 'dep' }).map((o) => o.t)).toEqual(['dep'])
  })

  it('sin tipo busca en todos', () => {
    expect(search(objects, 'tres de febrero', { type: '' })).toHaveLength(2)
    expect(search(objects, 'tres de febrero')).toHaveLength(2)
  })

  it('devuelve vacío si nada del tipo pedido coincide', () => {
    expect(search(objects, 'tres de febrero', { type: 'jur' })).toEqual([])
  })
})

describe('buscar por código (BUS-R5)', () => {
  const objetos = [
    { t: 'dep', c: '06469', n: 'Malvinas Argentinas', s: 'malvinas argentinas', sp: 'buenos aires' },
    { t: 'loc', c: '06469080', n: 'Grand Bourg', s: 'grand bourg', sp: 'buenos aires' },
  ]

  it('un código del catálogo devuelve su objeto y sólo ése', () => {
    expect(search(objetos, '06469').map((o) => o.c)).toEqual(['06469'])
  })

  it('el código gana a cualquier coincidencia de nombre (BUS-R4, nivel 0)', () => {
    const conHomonimo = [...objetos, { t: 'loc', c: '99999999', n: '06469', s: '06469', sp: 'x' }]
    expect(search(conHomonimo, '06469')[0].c).toBe('06469')
  })

  it('los ceros a la izquierda importan: el código es una cadena', () => {
    expect(search(objetos, '6469')).toEqual([])
  })

  it('siete, nueve y trece dígitos son fracción, radio y vía', () => {
    expect(codeMatches('0646908')).toMatchObject([{ t: 'frac', c: '0646908' }])
    expect(codeMatches('064690801')).toMatchObject([{ t: 'rad', c: '064690801' }])
    expect(codeMatches('0646908000600')).toMatchObject([{ t: 'via', c: '0646908000600' }])
  })

  it('un largo que es de un tipo del catálogo no arma fila sintética', () => {
    // Ese largo lo resuelve el catálogo, que es quien sabe si existe.
    expect(codeMatches('06469')).toEqual([])
  })

  it('el filtro de tipo también acota la búsqueda por código (BUS-R1)', () => {
    expect(codeMatches('064690801', { type: 'frac' })).toEqual([])
    expect(codeMatches('064690801', { type: 'rad' })).toHaveLength(1)
  })

  it('lo que no son puros dígitos no arma fila sintética', () => {
    expect(codeMatches('grand bourg')).toEqual([])
  })
})
