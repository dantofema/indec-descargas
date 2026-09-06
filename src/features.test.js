import { describe, it, expect, vi } from 'vitest'
import { PAGE_SIZE, pageUrl, fetchPage } from './features.js'

const dep = { t: 'dep', c: '06840', n: 'Tres de Febrero' }

describe('pageUrl', () => {
  it('filtra por el campo del padre y su código', () => {
    expect(pageUrl(dep, 'radios', 0)).toContain('CQL_FILTER=cde%3D%2706840%27')
  })

  it('pide JSON, no geopackage', () => {
    expect(pageUrl(dep, 'radios', 0)).toContain('outputFormat=application%2Fjson')
  })

  it('pagina con count y startIndex', () => {
    expect(pageUrl(dep, 'radios', 0)).toContain(`count=${PAGE_SIZE}`)
    expect(pageUrl(dep, 'radios', 0)).toContain('startIndex=0')
    expect(pageUrl(dep, 'radios', 3)).toContain(`startIndex=${3 * PAGE_SIZE}`)
  })

  it('ordena con el desempate en vías', () => {
    expect(pageUrl(dep, 'vias', 0)).toContain('sortBy=cod_indec%2Cid')
  })

  it('no pide la geometría', () => {
    const url = pageUrl(dep, 'radios', 0)
    expect(url).toContain('propertyName=')
    expect(url).not.toMatch(/the_geom/)
  })

  it('rechaza un código de padre que no sea de dígitos', () => {
    expect(() => pageUrl({ t: 'dep', c: "x' OR '1" }, 'radios', 0)).toThrow(/inválido/)
  })
})

describe('fetchPage', () => {
  const responder = (body, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => body }))

  it('devuelve las propiedades de cada feature y el total del servidor', async () => {
    global.fetch = responder({
      totalFeatures: 432,
      features: [{ properties: { cod_indec: '068400101', cro: '01' } }],
    })
    const { rows, total } = await fetchPage(dep, 'radios', 0)
    expect(total).toBe(432)
    expect(rows).toEqual([{ cod_indec: '068400101', cro: '01' }])
  })

  it('avisa con el status cuando el GeoServer falla', async () => {
    global.fetch = responder({}, false)
    await expect(fetchPage(dep, 'radios', 0)).rejects.toThrow(/503/)
  })

  it('sobrevive a una respuesta sin features', async () => {
    global.fetch = responder({ totalFeatures: 0 })
    const { rows, total } = await fetchPage(dep, 'radios', 0)
    expect(rows).toEqual([])
    expect(total).toBe(0)
  })
})
