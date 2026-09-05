// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { createCombobox } from './combobox.js'

// jsdom no implementa scrollIntoView y el resaltado lo usa para no salirse
// de la lista scrolleable.
beforeAll(() => { Element.prototype.scrollIntoView = () => {} })

const objs = [{ n: 'Tres de Febrero' }, { n: 'Tres Arroyos' }, { n: 'Tres Isletas' }]

function mount() {
  document.body.innerHTML = `
    <div class="search">
      <input id="q" role="combobox" aria-expanded="false" aria-controls="results" />
      <ul id="results" role="listbox" hidden></ul>
    </div>
    <a href="#" id="afuera">otro foco</a>`
  const input = document.querySelector('#q')
  const list = document.querySelector('#results')
  const elegidos = []
  const combo = createCombobox({
    input,
    list,
    renderOption: (obj) => {
      const span = document.createElement('span')
      span.textContent = obj.n
      return span
    },
    onSelect: (obj) => elegidos.push(obj),
  })
  return { input, list, combo, elegidos }
}

/** Manda una tecla al input y devuelve el evento, para mirar el default. */
function tecla(input, key) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  input.dispatchEvent(e)
  return e
}

const resaltado = (list) => list.querySelector('[aria-selected="true"]')

describe('createCombobox: abrir y cerrar', () => {
  it('render abre la lista y lo dice en aria-expanded', () => {
    const { input, list, combo } = mount()
    combo.render(objs)
    expect(list.hidden).toBe(false)
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(list.children).toHaveLength(3)
  })

  it('render sin resultados la cierra', () => {
    const { input, list, combo } = mount()
    combo.render(objs)
    combo.render([])
    expect(list.hidden).toBe(true)
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(list.children).toHaveLength(0)
  })

  it('Escape la cierra y suelta el resaltado', () => {
    const { input, list, combo } = mount()
    combo.render(objs)
    tecla(input, 'ArrowDown')
    tecla(input, 'Escape')
    expect(list.hidden).toBe(true)
    expect(resaltado(list)).toBe(null)
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
  })

  // Sin esto la lista queda flotando como overlay sobre el contenido,
  // con aria-expanded="true" en un combobox que ya no tiene el foco.
  it('se cierra cuando el foco se va del campo', () => {
    const { input, list, combo } = mount()
    combo.render(objs)
    input.focus()
    document.querySelector('#afuera').focus()
    expect(list.hidden).toBe(true)
    expect(input.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('createCombobox: teclado', () => {
  it('ArrowDown resalta el primero y se lo dice al lector de pantalla', () => {
    const { input, list, combo } = mount()
    combo.render(objs)
    tecla(input, 'ArrowDown')
    expect(resaltado(list)).toBe(list.children[0])
    expect(input.getAttribute('aria-activedescendant')).toBe(list.children[0].id)
  })

  it('ArrowUp desde ninguno resalta el último', () => {
    const { input, list, combo } = mount()
    combo.render(objs)
    tecla(input, 'ArrowUp')
    expect(resaltado(list)).toBe(list.children[2])
  })

  it('da la vuelta en los dos extremos', () => {
    const { input, list, combo } = mount()
    combo.render(objs)
    tecla(input, 'ArrowUp')
    tecla(input, 'ArrowDown')
    expect(resaltado(list)).toBe(list.children[0])
    tecla(input, 'ArrowUp')
    expect(resaltado(list)).toBe(list.children[2])
  })

  it('el resaltado se mueve, no se acumula', () => {
    const { input, list, combo } = mount()
    combo.render(objs)
    tecla(input, 'ArrowDown')
    tecla(input, 'ArrowDown')
    expect(list.querySelectorAll('[aria-selected="true"]')).toHaveLength(1)
    expect(resaltado(list)).toBe(list.children[1])
  })

  it('Enter elige el resaltado y cierra', () => {
    const { input, list, combo, elegidos } = mount()
    combo.render(objs)
    tecla(input, 'ArrowDown')
    tecla(input, 'ArrowDown')
    expect(tecla(input, 'Enter').defaultPrevented).toBe(true)
    expect(elegidos).toEqual([objs[1]])
    expect(list.hidden).toBe(true)
  })

  it('Enter sin resaltado no elige nada ni se come el evento', () => {
    const { input, combo, elegidos } = mount()
    combo.render(objs)
    expect(tecla(input, 'Enter').defaultPrevented).toBe(false)
    expect(elegidos).toEqual([])
  })

  // Con la lista cerrada la flecha tiene que volver a abrirla, y mientras
  // no haya nada que mover no tiene por qué bloquear el cursor del input.
  it('ArrowDown vuelve a abrir una lista cerrada con resultados', () => {
    const { input, list, combo } = mount()
    combo.render(objs)
    tecla(input, 'Escape')
    tecla(input, 'ArrowDown')
    expect(list.hidden).toBe(false)
    expect(resaltado(list)).toBe(list.children[0])
  })

  it('sin resultados la flecha deja mover el cursor dentro del campo', () => {
    const { input, combo } = mount()
    combo.render([])
    expect(tecla(input, 'ArrowDown').defaultPrevented).toBe(false)
    expect(tecla(input, 'ArrowUp').defaultPrevented).toBe(false)
  })

  it('con resultados la flecha no mueve el cursor dentro del campo', () => {
    const { input, combo } = mount()
    combo.render(objs)
    expect(tecla(input, 'ArrowDown').defaultPrevented).toBe(true)
  })

  it('un render nuevo resetea el resaltado', () => {
    const { input, list, combo } = mount()
    combo.render(objs)
    tecla(input, 'ArrowDown')
    combo.render(objs.slice(0, 2))
    expect(resaltado(list)).toBe(null)
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
  })
})

describe('createCombobox: mouse', () => {
  it('el click en una opción la elige', () => {
    const { list, combo, elegidos } = mount()
    combo.render(objs)
    list.children[2].click()
    expect(elegidos).toEqual([objs[2]])
    expect(list.hidden).toBe(true)
  })

  // El mousedown sobre la lista sacaría el foco del input, y el cierre por
  // focusout llegaría antes que el click: la opción no se podría elegir.
  it('el mousedown en la lista no le saca el foco al campo', () => {
    const { list, combo } = mount()
    combo.render(objs)
    const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    list.children[0].dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })
})
