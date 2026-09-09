// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSearchBox } from './searchbox.js'
import { TYPE_ORDER } from './search.js'

const objetos = [
  { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires', sp: 'buenos aires' },
  { t: 'loc', c: '06840010', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires', sp: 'buenos aires' },
]

let el, onPick, searchbox

beforeEach(() => {
  document.body.innerHTML = `
    <select id="type"></select>
    <input id="q" role="combobox" aria-expanded="false" />
    <ul id="results" role="listbox" hidden></ul>`
  el = {
    input: document.querySelector('#q'),
    select: document.querySelector('#type'),
    list: document.querySelector('#results'),
  }
  onPick = vi.fn()
  searchbox = createSearchBox({ ...el, onPick })
})

const escribir = (texto) => {
  el.input.value = texto
  el.input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('createSearchBox', () => {
  it('llena el filtro desde TYPE_ORDER, con "todos" adelante (BUS-R1)', () => {
    const opciones = [...el.select.options]
    expect(opciones[0].value).toBe('')
    expect(opciones.slice(1).map((o) => o.value)).toEqual(TYPE_ORDER)
  })

  it('no busca hasta tener objetos: el catálogo llega después', () => {
    escribir('tres')
    expect(el.list.children).toHaveLength(0)
  })

  it('busca una vez que tiene el catálogo', () => {
    searchbox.setObjects(objetos)
    escribir('tres de febrero')
    expect(el.list.children).toHaveLength(2)
  })

  it('cada resultado dice de qué tipo es: es lo que decide qué límites bajás', () => {
    searchbox.setObjects(objetos)
    escribir('tres')
    expect(el.list.textContent).toContain('Departamento')
    expect(el.list.textContent).toContain('Localidad censal')
  })

  it('cambiar el tipo vuelve a buscar lo escrito, sin retipear (BUS-R1)', () => {
    searchbox.setObjects(objetos)
    escribir('tres')
    el.select.value = 'loc'
    el.select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(el.list.children).toHaveLength(1)
  })

  it('elegir avisa con el objeto', () => {
    searchbox.setObjects(objetos)
    escribir('tres')
    el.list.children[0].click()
    expect(onPick).toHaveBeenCalledWith(objetos[0])
  })

  it('lo escrito antes de que llegue el catálogo se busca solo cuando llega', () => {
    // El home pide el catálogo recién cuando alguien toca el campo, así que
    // escribir primero y recibirlo después es el caso normal, no el raro.
    escribir('tres de febrero')
    expect(el.list.children).toHaveLength(0)
    searchbox.setObjects(objetos)
    expect(el.list.children).toHaveLength(2)
  })

  it('tipear el código de una vía no le pide nada al GeoServer (BUS-R5)', () => {
    searchbox.setObjects(objetos)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    escribir('0646908000600')
    expect(document.querySelectorAll('#results li')).toHaveLength(1)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
