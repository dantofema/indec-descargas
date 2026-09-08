// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectShell, leerPartials } from '../../scripts/shell.mjs'
import { NOTES } from '../notes.js'

const crudo = readFileSync(resolve(process.cwd(), 'notas/index.html'), 'utf8')
const html = injectShell(crudo, { partials: leerPartials(), base: '/' })
const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '')

async function montar(hash = '') {
  window.location.hash = hash
  document.body.innerHTML = body
  document.body.dataset.pagina = 'notas'
  // `notas.js` se auto-invoca al cargar, así que cada caso necesita su
  // propia instancia del módulo: sin esto, el segundo test mide el DOM
  // que dejó el primero, porque el import queda cacheado entre casos.
  vi.resetModules()
  const { initNotas } = await import('./notas.js')
  initNotas()
}

describe('la página de notas', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('lista los ocho objetos en el navegador vertical', async () => {
    await montar()
    const items = document.querySelectorAll('#nota-nav [role="tab"]')
    expect(items).toHaveLength(8)
    expect([...items].map((b) => b.textContent.trim())).toEqual(NOTES.map((n) => n.label))
  })

  it('sin ancla abre la primera', async () => {
    await montar()
    expect(document.querySelector('#nota-titulo').textContent).toBe(NOTES[0].label)
  })

  it('el ancla de la URL elige la nota', async () => {
    await montar('#gobierno-local')
    expect(document.querySelector('#nota-titulo').textContent).toBe('Gobierno local')
    expect(document.querySelector('#nota-cuerpo').textContent).toContain('2.282')
  })

  it('un ancla que no existe cae en la primera en vez de dejar la página vacía', async () => {
    await montar('#no-existe')
    expect(document.querySelector('#nota-titulo').textContent).toBe(NOTES[0].label)
  })

  it('elegir una nota escribe el ancla, para poder compartirla', async () => {
    await montar()
    document.querySelector('[data-slug="aglomerado"]').click()
    expect(window.location.hash).toBe('#aglomerado')
    expect(document.querySelector('#nota-titulo').textContent).toBe('Aglomerado')
  })

  it('muestra el total del objeto, que es dato y no prosa', async () => {
    await montar('#radio-censal')
    expect(document.querySelector('#nota-total').textContent).toContain('66.515')
  })
})
