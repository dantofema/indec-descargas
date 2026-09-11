// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { estimateBytes, estimateSeconds, weightNotice, childRows } from './children.js'

const MB = 1024 * 1024

/**
 * Cierra DES-R2 de `docs/reglas/descargas.md`: superar el peso estimado avisa,
 * no deshabilita. Las dos constantes —973 bytes por feature en polígonos, 420
 * en vías— son las que la regla declara medidas, no estimadas.
 */
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

describe('childRows: la demora fija de las vías', () => {
  // Medido contra el GeoServer: 1.487 vías tardan 21,3 s y 4.260 tardan
  // 19,5 s — la demora es del servidor, no del tamaño del pedido, así que
  // el aviso va incondicional y no depende de weightNotice/estimateSeconds.
  it('avisa la demora aunque la capa de vías sea chica, sin aviso de peso', () => {
    const filas = childRows({ t: 'dep', c: '06840', n: 'Tres de Febrero', ch: { vias: 1487 } })
    expect(filas[0].textContent).toMatch(/20 segundos/)
    expect(filas[0].textContent).not.toMatch(/MB/)
  })

  it('una capa de vías enorme trae los dos avisos, el de demora y el de peso', () => {
    const filas = childRows({ t: 'jur', c: '06', n: 'Buenos Aires', ch: { vias: 179029 } })
    expect(filas[0].textContent).toMatch(/20 segundos/)
    expect(filas[0].textContent).toMatch(/MB/)
  })

  it('ninguna otra capa trae el aviso de demora', () => {
    const filas = childRows({ t: 'jur', c: '06', n: 'Buenos Aires', ch: { radios: 23901, localidades: 621 } })
    for (const li of filas) expect(li.textContent).not.toMatch(/20 segundos/)
  })
})

describe('childRows', () => {
  const obj = { t: 'jur', c: '06', n: 'Buenos Aires', ch: { radios: 23901, localidades: 621 } }

  /**
   * Cierra DES-R1 de `docs/reglas/descargas.md`: no hay tope superior de features.
   * Ninguna capa hija deshabilita su botón por **superar** una cantidad; el piso
   * lo decide DES-R3, que es el caso de más abajo.
   */
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

  // DES-R3 pide las dos mitades: el botón deshabilitado **y** que diga que
  // no hay nada de esa capa. Sin la segunda aserción, el test se conforma
  // con la mitad de la regla —y la fila 2 es el único lugar del sitio donde
  // el conteo cero se explica, porque las filas 3 y 4 lo filtran.
  it('la capa con cero objetos sigue deshabilitada, y dice por qué', () => {
    const filas = childRows({ t: 'loc', c: '06840010', n: 'x', ch: { vias: 0 } })
    expect(filas[0].querySelector('a.btn')).toBe(null)
    expect(filas[0].querySelector('[aria-disabled="true"]')).not.toBe(null)
    expect(filas[0].textContent).toMatch(/no hay vías de circulación en este objeto/i)
  })
})
