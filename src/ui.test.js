// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { downloadButton } from './ui.js'

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
