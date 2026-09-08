// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { downloadButton, setStatus } from './ui.js'

describe('downloadButton', () => {
  // resultados.js y children.js llaman downloadButton con dos argumentos: si el
  // armado de className cambia, tienen que seguir recibiendo exactamente
  // esto.
  it('sin variante da exactamente la clase btn', () => {
    const a = downloadButton('https://x', 'Descargar')
    expect(a.className).toBe('btn')
  })

  it('con una variante la suma sin perder btn', () => {
    const a = downloadButton('https://x', 'Descargar', 'mini')
    expect(a.className).toBe('btn mini')
  })

  it('siempre es un <a> con el href y el texto pedidos', () => {
    const a = downloadButton('https://x', 'Descargar')
    expect(a.tagName).toBe('A')
    expect(a.getAttribute('href')).toBe('https://x')
    expect(a.textContent).toBe('Descargar')
  })
})

// Estaba duplicado byte a byte entre home.js y resultados.js, y comparte
// contrato de clase con `.status.error` de style.css. Recibe el nodo en vez
// de leerlo de un `el` compartido: las dos páginas tienen sets de nodos
// distintos y abstraer eso hubiera sido peor.
describe('setStatus', () => {
  let nodo
  beforeEach(() => {
    nodo = document.createElement('p')
    nodo.className = 'status'
  })

  it('escribe el texto y muestra el nodo', () => {
    setStatus(nodo, 'Buscá un objeto para verlo en el mapa.')
    expect(nodo.textContent).toBe('Buscá un objeto para verlo en el mapa.')
    expect(nodo.hidden).toBe(false)
    expect(nodo.classList.contains('error')).toBe(false)
  })

  it('un texto vacío lo esconde en vez de dejar un hueco', () => {
    setStatus(nodo, 'algo')
    setStatus(nodo, '')
    expect(nodo.textContent).toBe('')
    expect(nodo.hidden).toBe(true)
  })

  it('marca el error con la clase que espera style.css, y la saca al volver', () => {
    setStatus(nodo, 'no se pudo', true)
    expect(nodo.classList.contains('error')).toBe(true)
    setStatus(nodo, 'todo bien')
    expect(nodo.classList.contains('error')).toBe(false)
  })
})
