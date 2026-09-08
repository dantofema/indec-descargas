import { describe, it, expect } from 'vitest'
import { countBy, buildCatalog, NA } from './aggregate.mjs'

const input = {
  generated: '2026-09-04',
  jurisdicciones: [
    { cpr: '06', nam: 'Buenos Aires' },
    { cpr: '82', nam: 'Santa Fe' },
  ],
  departamentos: [
    { cpr: '06', cde: '06840', nam: 'Tres de Febrero', jur: 'Buenos Aires' },
    { cpr: '82', cde: '82084', nam: 'Rosario', jur: 'Santa Fe' },
  ],
  localidades: [
    { cpr: '06', clc: '06840010', cde: '06840', nam: 'Caseros', jur: 'Buenos Aires', dpto: 'Tres de Febrero', codaglo: '0001' },
    { cpr: '82', clc: '82084010', cde: '82084', nam: 'Rosario', jur: 'Santa Fe', dpto: 'Rosario', codaglo: NA },
  ],
  gobiernosLocales: [{ cmu: '060840', nam: 'Tres de Febrero', jur: 'Buenos Aires' }],
  aglomerados: [{ codaglo: '0001', nam: 'Gran Buenos Aires' }],
  fracciones: [{ cpr: '06', cde: '06840' }, { cpr: '06', cde: '06840' }, { cpr: '82', cde: '82084' }],
  radios: [{ cpr: '06', cde: '06840' }, { cpr: '06', cde: '06840' }, { cpr: '06', cde: '06840' }],
  vias: [
    { cpr: '06', cde: '06840', cmu: '060840', clc: '06840010', codaglo: '0001' },
    { cpr: '06', cde: '06840', cmu: NA, clc: '06840010', codaglo: NA },
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

  it("omite también '0000' cuando el campo es codaglo", () => {
    // `vias_de_circulacion` escribe '0000' donde `localidades_censales`
    // escribe 'N/A': el mismo "sin aglomerado" con dos centinelas.
    const m = countBy([{ codaglo: '0000' }, { codaglo: NA }, { codaglo: '0001' }], 'codaglo')
    expect(m.has('0000')).toBe(false)
    expect(m.has(NA)).toBe(false)
    expect(m.get('0001')).toBe(1)
  })

  it("'0000' sigue siendo un valor válido en cualquier otro campo", () => {
    expect(countBy([{ clc: '0000' }], 'clc').get('0000')).toBe(1)
  })
})

describe('buildCatalog', () => {
  const { catalog, warnings } = buildCatalog(input)
  const byCode = (t, c) => catalog.objects.find((o) => o.t === t && o.c === c)

  it('copia la metadata', () => {
    expect(catalog.generated).toBe('2026-09-04')
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

  // El aglomerado de una localidad no sale de su código: `clc` no lo
  // contiene. Sin esto, una tarea posterior que arme la cadena de padres
  // de una localidad pierde ese eslabón.
  it('guarda el código de aglomerado de cada localidad', () => {
    expect(byCode('loc', '06840010').ag).toBe('0001')
  })

  it('no inventa aglomerado donde el INDEC no lo declara', () => {
    expect(byCode('loc', '82084010').ag).toBeUndefined()
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

  it('un aglomerado de múltiples provincias junta sus provincias con " / "', () => {
    const multiProv = {
      ...input,
      localidades: [
        ...input.localidades,
        { cpr: '14', clc: '14000010', cde: '14000', nam: 'Frontera', jur: 'Córdoba', dpto: 'Capital', codaglo: '0002' },
        { cpr: '82', clc: '82000010', cde: '82000', nam: 'Otro Punto', jur: 'Santa Fe', dpto: 'Capital', codaglo: '0002' },
      ],
      aglomerados: [
        ...input.aglomerados,
        { codaglo: '0002', nam: 'San Francisco - Frontera' },
      ],
    }
    const { catalog } = buildCatalog(multiProv)
    const aglo = catalog.objects.find((o) => o.t === 'aglo' && o.c === '0002')
    expect(aglo.p).toBe('Córdoba / Santa Fe')
  })
})

describe('buildCatalog: inconsistencias', () => {
  it('advierte por un código hijo sin padre', () => {
    const { warnings } = buildCatalog({ ...input, radios: [...input.radios, { cpr: '99', cde: '99999' }] })
    expect(warnings.join(' ')).toMatch(/99999/)
    expect(warnings.join(' ')).toMatch(/radios/)
  })

  it('advierte por un aglomerado que sólo aparece en vías', () => {
    const vias = [...input.vias, { cpr: '06', cde: '06840', cmu: NA, clc: '06840010', codaglo: '7777' }]
    const { warnings } = buildCatalog({ ...input, vias })
    expect(warnings.join(' ')).toMatch(/7777/)
  })

  it("no advierte por el centinela '0000' de codaglo en vías", () => {
    const vias = [...input.vias, { cpr: '06', cde: '06840', cmu: NA, clc: '06840010', codaglo: '0000' }]
    const { warnings } = buildCatalog({ ...input, vias })
    expect(warnings).toEqual([])
  })
})

describe('buildCatalog: la provincia del hijo sale de cpr, no de cde', () => {
  // Hay filas del INDEC donde las dos columnas discrepan: el radio
  // fid 59896 lleva cpr=66 (Salta) y cde=105, y la localidad fid 2740
  // lleva cpr=94 (Tierra del Fuego) y cde=06008. Contar por
  // `cde.slice(0, 2)` mete a esas filas en una provincia distinta de la
  // que después filtra la descarga, y el usuario ve un número que el
  // archivo que recibe contradice.
  //
  // Las cinco capas se cuentan por separado en `buildCatalog`, así que
  // las cinco necesitan su propia fila discrepante: con una sola, las
  // otras cuatro líneas se pueden revertir a `cde.slice(0, 2)` sin que
  // el suite diga nada.
  const discrepante = {
    departamentos: { cpr: '82', cde: '06999', nam: 'Discrepante', jur: 'Santa Fe' },
    fracciones:    { cpr: '82', cde: '06999' },
    radios:        { cpr: '82', cde: '06999' },
    localidades:   { cpr: '82', clc: '82999010', cde: '06999', nam: 'Discrepante', jur: 'Santa Fe', dpto: 'Discrepante', codaglo: NA },
    vias:          { cpr: '82', cde: '06999', cmu: NA, clc: '82999010', codaglo: NA },
  }

  const jurDe = (catalog, c) => catalog.objects.find((o) => o.t === 'jur' && o.c === c)
  const base = buildCatalog(input).catalog

  for (const [capa, fila] of Object.entries(discrepante)) {
    describe(capa, () => {
      const { catalog } = buildCatalog({ ...input, [capa]: [...input[capa], fila] })

      it('suma la fila discrepante a la provincia de su cpr', () => {
        expect(jurDe(catalog, '82').ch[capa]).toBe(jurDe(base, '82').ch[capa] + 1)
      })

      it('no la suma a la provincia que dice su cde', () => {
        expect(jurDe(catalog, '06').ch[capa]).toBe(jurDe(base, '06').ch[capa])
      })
    })
  }
})

import { buildTotales } from './aggregate.mjs'

describe('buildTotales', () => {
  const catalog = {
    generated: '2026-09-06',
    objects: [
      { t: 'jur', c: '06', n: 'Buenos Aires', ch: { departamentos: 2, fracciones: 10, radios: 100, localidades: 5, vias: 1000 } },
      { t: 'jur', c: '02', n: 'CABA', ch: { departamentos: 1, fracciones: 3, radios: 30, localidades: 1, vias: 200 } },
      { t: 'dep', c: '06840', n: 'Tres de Febrero', ch: { radios: 40 } },
      { t: 'dep', c: '02001', n: 'Comuna 1', ch: {} },
      { t: 'loc', c: '068400', n: 'x', ch: { vias: 9 } },
      { t: 'gl', c: '060840', n: 'y' },
      { t: 'aglo', c: '0001', n: 'z', ch: { localidades: 2, vias: 5 } },
    ],
  }

  it('cuenta por tipo los objetos buscables', () => {
    const t = buildTotales(catalog)
    expect(t).toMatchObject({ jur: 2, dep: 2, loc: 1, gl: 1, aglo: 1 })
  })

  it('las capas sin objeto propio se suman sobre las jurisdicciones, no sobre todo', () => {
    // Sumar sobre todos los objetos contaría los radios de Tres de Febrero
    // dos veces: una en el departamento y otra en su provincia.
    const t = buildTotales(catalog)
    expect(t.fracciones).toBe(13)
    expect(t.radios).toBe(130)
    expect(t.vias).toBe(1200)
  })

  it('arrastra la fecha del catálogo, para que el home no diga una distinta', () => {
    expect(buildTotales(catalog).generated).toBe('2026-09-06')
  })
})
