// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { childRows } from './children.js'

const MAX = 5000

/** Tres de Febrero, con una capa de cada situación posible. */
const dep = {
  t: 'dep',
  c: '06840',
  n: 'Tres de Febrero',
  ch: { fracciones: 42, radios: 432, localidades: 1, vias: 1487 },
}

const rowsOf = (obj, max = MAX) => childRows(obj, max)
const label = (li) => li.querySelector('div div').textContent
const nota = (li) => li.querySelector('.note')?.textContent ?? ''

describe('childRows', () => {
  it('devuelve una fila por capa hija, en el orden declarado', () => {
    expect(rowsOf(dep).map(label)).toEqual([
      'Fracciones censales', 'Radios censales', 'Localidades censales', 'Vías de circulación',
    ])
  })

  it('no devuelve filas para un objeto sin capas hijas', () => {
    expect(rowsOf({ t: 'gl', c: '060840', n: 'Tres de Febrero' })).toEqual([])
  })

  it('escribe el conteo con separador de miles', () => {
    expect(rowsOf(dep)[3].textContent).toContain('1.487 objetos')
  })

  it('escribe el singular cuando hay un solo objeto', () => {
    expect(rowsOf(dep)[2].textContent).toContain('1 objeto')
    expect(rowsOf(dep)[2].textContent).not.toContain('1 objetos')
  })
})

describe('childRows: el tope habilita (DES-R1)', () => {
  it('la capa que no supera el tope trae un enlace de descarga real', () => {
    const a = rowsOf(dep)[1].querySelector('a.btn')
    expect(a.getAttribute('href')).toContain('typenames=geonode%3Aradios_censales2')
    expect(a.getAttribute('href')).toContain('CQL_FILTER=cde%3D%2706840%27')
    expect(a.textContent).toBe('Descargar')
  })

  it('el enlace pide gpkg en 4326 y nombra el archivo (DES-R4)', () => {
    const href = rowsOf(dep)[1].querySelector('a.btn').getAttribute('href')
    expect(href).toContain('outputFormat=geopackage')
    expect(href).toContain('srsName=EPSG%3A4326')
    expect(href).toContain('format_options=filename%3Aradios-de-departamentos-06840.gpkg')
  })
})

describe('childRows: superar el tope deshabilita, no recorta (DES-R2)', () => {
  const grande = { t: 'jur', c: '06', n: 'Buenos Aires', ch: { radios: 23901 } }

  it('no ofrece ningún enlace de descarga', () => {
    expect(rowsOf(grande)[0].querySelector('a')).toBe(null)
  })

  it('deja el botón deshabilitado para el lector de pantalla', () => {
    expect(rowsOf(grande)[0].querySelector('[aria-disabled="true"]').textContent).toBe('Descargar')
  })

  it('dice el conteo real y el máximo, los dos con separador de miles', () => {
    expect(nota(rowsOf(grande)[0])).toContain('23.901')
    expect(nota(rowsOf(grande)[0])).toContain('5.000')
  })

  it('el tope sale del catálogo, no de una constante del código (DES-R5)', () => {
    expect(rowsOf(grande, 30000)[0].querySelector('a.btn')).not.toBe(null)
    expect(nota(rowsOf(grande, 20000)[0])).toContain('20.000')
  })

  it('el límite exacto todavía descarga', () => {
    const justo = { t: 'jur', c: '06', n: 'Buenos Aires', ch: { radios: MAX } }
    expect(rowsOf(justo)[0].querySelector('a.btn')).not.toBe(null)
  })
})

describe('childRows: conteo cero también deshabilita (DES-R3)', () => {
  const vacio = { t: 'jur', c: '94', n: 'Tierra del Fuego', ch: { radios: 0 } }

  it('no ofrece un enlace que bajaría un archivo vacío', () => {
    expect(rowsOf(vacio)[0].querySelector('a')).toBe(null)
    expect(rowsOf(vacio)[0].querySelector('[aria-disabled="true"]')).not.toBe(null)
  })

  it('dice que no hay nada de esa capa, sin hablar del tope', () => {
    expect(nota(rowsOf(vacio)[0])).toMatch(/no hay/i)
    expect(nota(rowsOf(vacio)[0])).not.toMatch(/máximo/i)
  })
})

describe('childRows: la advertencia de las vías', () => {
  it('avisa que las vías tardan', () => {
    expect(nota(rowsOf(dep)[3])).toMatch(/tardan/i)
  })

  it('no se la pone a las demás capas', () => {
    expect(nota(rowsOf(dep)[1])).toBe('')
  })
})
