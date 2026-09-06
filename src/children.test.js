// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { estimateBytes, estimateSeconds, weightNotice, childRows } from './children.js'

const MB = 1024 * 1024

describe('estimateBytes', () => {
  it('usa la constante de líneas para vías', () => {
    expect(estimateBytes('vias', 1000)).toBe(420 * 1000)
  })

  it('usa la constante de polígonos para el resto', () => {
    expect(estimateBytes('radios', 1000)).toBe(973 * 1000)
    expect(estimateBytes('fracciones', 1000)).toBe(973 * 1000)
  })
})

describe('weightNotice', () => {
  it('calla por debajo del umbral', () => {
    expect(weightNotice('radios', 432)).toBe(null)
  })

  it('avisa por encima del umbral, con tamaño y espera', () => {
    const aviso = weightNotice('radios', 23901)
    expect(aviso).toMatch(/22 MB/)
    expect(aviso).toMatch(/segundos/)
  })

  // El peor caso medido: 179.029 vías de Buenos Aires, 74 MB reales.
  it('estima el peor caso del catálogo en el orden correcto', () => {
    const aviso = weightNotice('vias', 179029)
    expect(aviso).toMatch(/7[0-9] MB/)
  })

  it('en el borde exacto del umbral todavía calla', () => {
    const justo = Math.floor((10 * MB) / 973)
    expect(weightNotice('radios', justo)).toBe(null)
    expect(weightNotice('radios', justo + 1)).not.toBe(null)
  })
})

describe('childRows', () => {
  const obj = { t: 'jur', c: '06', n: 'Buenos Aires', ch: { radios: 23901, localidades: 621 } }

  it('da un enlace de descarga vivo aunque la capa sea enorme', () => {
    const filas = childRows(obj)
    const radios = filas.find((li) => li.textContent.includes('Radios'))
    expect(radios.querySelector('a.btn')).not.toBe(null)
    expect(radios.querySelector('[aria-disabled="true"]')).toBe(null)
  })

  it('pone el aviso de peso sólo donde hace falta', () => {
    const filas = childRows(obj)
    expect(filas.find((li) => li.textContent.includes('Radios')).textContent).toMatch(/MB/)
    expect(filas.find((li) => li.textContent.includes('Localidades')).textContent).not.toMatch(/MB/)
  })

  it('la capa con cero objetos sigue deshabilitada', () => {
    const filas = childRows({ t: 'loc', c: '06840010', n: 'x', ch: { vias: 0 } })
    expect(filas[0].querySelector('a.btn')).toBe(null)
    expect(filas[0].querySelector('[aria-disabled="true"]')).not.toBe(null)
  })
})
