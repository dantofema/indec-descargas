// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderTable, renderPager } from './table.js'
import { specOf } from './columns.js'

const radios = [
  { cod_indec: '068400101', cro: '01', cfn: '01', tro: 'U' },
  { cod_indec: '068400102', cro: '02', cfn: '01', tro: 'R' },
]

// Una fila real de vías, con sus 21 campos, para ejercitar la columna wide
// de verdad —con `rows` vacío `renderTable` corta antes de armar la
// `<table>`, y no prueba nada del requisito de esta capa—. `cod_indec` tiene
// que ser dígitos: es el `idField` y arma la descarga de la fila.
const via = {
  ...Object.fromEntries(specOf('vias').columns.map((c) => [c.field, 'x'])),
  cod_indec: '0684001000010',
}

describe('renderTable', () => {
  it('pone una columna por campo declarado, más la de acciones', () => {
    const t = renderTable('radios', radios, () => {})
    expect(t.querySelectorAll('thead th')).toHaveLength(5)
    expect(t.querySelector('thead th').textContent).toBe('Radio')
  })

  it('traduce urbano y rural en vez de mostrar la letra', () => {
    const t = renderTable('radios', radios, () => {})
    const filas = t.querySelectorAll('tbody tr')
    expect(filas[0].textContent).toContain('Urbano')
    expect(filas[1].textContent).toContain('Rural')
  })

  it('cada fila descarga por su código', () => {
    const t = renderTable('radios', radios, () => {})
    const href = t.querySelector('tbody tr a.btn').getAttribute('href')
    expect(href).toContain('CQL_FILTER=cod_indec%3D%27068400101%27')
  })

  // Corrección al brief: `onView` recibe fila Y capa, no sólo la fila. Es el
  // único punto que sabe de qué capa es la fila, y quien mira el detalle
  // necesita ese dato para pedirle la geometría al GeoServer.
  it('Ver avisa con la fila entera y de qué capa es', () => {
    const onView = vi.fn()
    const t = renderTable('radios', radios, onView)
    t.querySelectorAll('tbody tr button')[1].click()
    expect(onView).toHaveBeenCalledWith(radios[1], 'radios')
  })

  it('el botón Ver es de baja jerarquía y el de descarga es chico, para no competir por atención en la fila', () => {
    const t = renderTable('radios', radios, () => {})
    const fila = t.querySelector('tbody tr')
    expect(fila.querySelector('button').className).toBe('btn ghost mini')
    expect(fila.querySelector('a').className).toBe('btn mini')
  })

  it('sin filas dice que no hay nada, sin tabla vacía', () => {
    const t = renderTable('radios', [], () => {})
    expect(t.querySelector('table')).toBe(null)
    expect(t.textContent).toMatch(/no hay/i)
  })

  it('la tabla ancha (vías) le pone la clase wide a la <table>, no sólo al contenedor', () => {
    const t = renderTable('vias', [via], () => {})
    expect(t.className).toContain('table-scroll')
    expect(t.querySelector('table').className).toBe('wide')
  })

  it('una capa angosta no arrastra la clase wide', () => {
    const t = renderTable('radios', radios, () => {})
    expect(t.querySelector('table').className).toBe('')
  })

  // Fix round 3, hallazgo menor: `row[col.field] ?? ''` para mostrar pero
  // `String(row[spec.idField])` sin red para descargar. Un `cod_indec` nulo
  // —plausible: DES-R8 documenta que los códigos del INDEC no cierran—
  // hacía tirar `renderTable` con `código inválido: "undefined"`, y el `try`
  // de browser.js lo convertía en "No se pudo traer la lista", culpando a la
  // red cuando el fetch había salido bien, con un Reintentar condenado.
  describe('una fila sin código', () => {
    const sinCodigo = { cod_indec: null, cro: '07', cfn: '01', tro: 'U' }

    it('no rompe la tabla', () => {
      expect(() => renderTable('radios', [sinCodigo], () => {})).not.toThrow()
    })

    it('dice por qué no tiene acciones, en vez de ofrecer un enlace roto', () => {
      const t = renderTable('radios', [sinCodigo], () => {})
      const acts = t.querySelector('tbody tr td.acts')
      expect(acts.querySelector('a.btn')).toBe(null)
      expect(acts.querySelector('button')).toBe(null)
      expect(acts.textContent).toMatch(/sin código/i)
      expect(acts.textContent).toContain('cod_indec')
    })

    it('sigue mostrando los datos que sí tiene', () => {
      const t = renderTable('radios', [sinCodigo], () => {})
      expect(t.querySelector('tbody tr').textContent).toContain('07')
    })

    it('no se lleva puestas a las filas que sí tienen código', () => {
      const t = renderTable('radios', [sinCodigo, ...radios], () => {})
      expect(t.querySelectorAll('tbody tr')).toHaveLength(3)
      expect(t.querySelectorAll('tbody tr a.btn')).toHaveLength(2)
    })

    // El `id` de vías llega como número en el JSON del GeoServer: un código
    // numérico es válido y no puede caer en este camino.
    it('un código que viene como número sigue descargando', () => {
      const t = renderTable('departamentos', [{ nam: 'x', cde: 6840 }], () => {})
      expect(t.querySelector('tbody tr a.btn').getAttribute('href')).toContain('cde%3D%276840%27')
    })
  })
})

describe('renderPager', () => {
  it('en la primera página no deja retroceder', () => {
    const p = renderPager({ page: 0, total: 432, onPage: () => {} })
    const [prev, next] = p.querySelectorAll('button')
    expect(prev.disabled).toBe(true)
    expect(next.disabled).toBe(false)
    expect(p.textContent).toContain('1–20 de 432')
  })

  it('en la última no deja avanzar', () => {
    const p = renderPager({ page: 21, total: 432, onPage: () => {} })
    const [prev, next] = p.querySelectorAll('button')
    expect(prev.disabled).toBe(false)
    expect(next.disabled).toBe(true)
    expect(p.textContent).toContain('421–432 de 432')
  })

  it('con una sola página no deja ir a ningún lado', () => {
    const p = renderPager({ page: 0, total: 1, onPage: () => {} })
    for (const b of p.querySelectorAll('button')) expect(b.disabled).toBe(true)
  })

  it('avisa a qué página ir', () => {
    const onPage = vi.fn()
    const p = renderPager({ page: 2, total: 432, onPage })
    p.querySelectorAll('button')[1].click()
    expect(onPage).toHaveBeenCalledWith(3)
  })

  // Fix round 3, hallazgo menor: WFS admite `"totalFeatures": "unknown"`.
  // Con eso, `Math.ceil(total / PAGE_SIZE)` daba NaN, `page >= NaN` daba
  // false y "Siguiente" quedaba habilitado para siempre —en vías, cada clic
  // en esa nada cuesta entre 14 y 99 segundos medidos—.
  describe('cuando el servidor no informa el total', () => {
    it('con una página incompleta no deja avanzar: no hay más', () => {
      const p = renderPager({ page: 0, total: 'unknown', count: 3, onPage: () => {} })
      expect(p.querySelectorAll('button')[1].disabled).toBe(true)
    })

    it('con una página llena sí deja avanzar: puede haber más', () => {
      const p = renderPager({ page: 0, total: 'unknown', count: 20, onPage: () => {} })
      expect(p.querySelectorAll('button')[1].disabled).toBe(false)
    })

    it('dice dónde está y que el total no lo sabe, en vez de inventarlo', () => {
      const p = renderPager({ page: 1, total: 'unknown', count: 20, onPage: () => {} })
      expect(p.textContent).toContain('21–40')
      expect(p.textContent).toMatch(/no informó el total/i)
      expect(p.textContent).not.toMatch(/NaN|unknown/)
    })

    it('sin filas no promete una página que no está', () => {
      const p = renderPager({ page: 0, total: 'unknown', count: 0, onPage: () => {} })
      for (const b of p.querySelectorAll('button')) expect(b.disabled).toBe(true)
    })
  })
})
