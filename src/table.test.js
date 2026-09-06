// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderTable, renderPager } from './table.js'

const radios = [
  { cod_indec: '068400101', cro: '01', cfn: '01', tro: 'U' },
  { cod_indec: '068400102', cro: '02', cfn: '01', tro: 'R' },
]

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

  it('sin filas dice que no hay nada, sin tabla vacía', () => {
    const t = renderTable('radios', [], () => {})
    expect(t.querySelector('table')).toBe(null)
    expect(t.textContent).toMatch(/no hay/i)
  })

  it('la tabla ancha scrollea sola', () => {
    expect(renderTable('vias', [], () => {}).className).toContain('table-scroll')
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
})
