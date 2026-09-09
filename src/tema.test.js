// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectShell, readPartials } from '../scripts/shell.mjs'

/**
 * El tema lo elige la persona, no el sistema (APAR-R7): la consola oscura es
 * la cara del sitio y el botón la cambia.
 *
 * El código vive en un `<script>` en línea dentro del partial y no en un
 * módulo, por dos motivos: tiene que correr **antes** de la primera pintura
 * —si no, quien eligió el tema claro ve un destello oscuro en cada carga— y
 * `servicios/` no embarca ningún JS, así que un módulo obligaría a sumarle
 * un bundle entero para un botón.
 *
 * Que sea en línea no lo saca del suite: acá se lee el partial de verdad y
 * se ejecuta ese mismo texto.
 */
const partials = readPartials()
const codigo = partials.tema.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]

const paginas = ['index.html', 'resultados/index.html', 'notas/index.html', 'servicios/index.html']

/** Corre el script del partial contra el DOM de este caso. */
const correr = () => new Function(codigo)()

const guardado = () => window.localStorage.getItem('tema')

function montarBoton() {
  document.body.innerHTML = injectShell('<!--#shell:header-->', { partials, base: '/' })
  return document.querySelector('[data-tema-toggle]')
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-tema')
  document.body.innerHTML = ''
})

describe('la consola arranca oscura (APAR-R7)', () => {
  it('sin nada elegido no marca tema: manda el :root pelado, que es el oscuro', () => {
    correr()
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false)
  })

  it('el tema elegido sobrevive a la recarga', () => {
    window.localStorage.setItem('tema', 'claro')
    correr()
    expect(document.documentElement.dataset.tema).toBe('claro')
  })

  it('un valor basura guardado no cambia nada', () => {
    // `localStorage` es de la persona y cualquiera puede escribirle. Un
    // `data-tema="rojo"` no matchea ninguna paleta y dejaría el sitio con
    // la oscura pero el botón diciendo lo contrario.
    window.localStorage.setItem('tema', 'rojo')
    correr()
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false)
  })
})

describe('el botón del tema', () => {
  it('existe en el header, que es el shell de las cuatro páginas', () => {
    const b = montarBoton()
    expect(b).not.toBeNull()
    expect(b.tagName).toBe('BUTTON')
    // Sin `type`, un botón adentro de un form lo envía. El header no tiene
    // form hoy, pero el partial se comparte y eso cambia sin avisar.
    expect(b.getAttribute('type')).toBe('button')
  })

  it('un click pasa a claro y lo guarda', () => {
    correr()
    const b = montarBoton()
    b.click()
    expect(document.documentElement.dataset.tema).toBe('claro')
    expect(guardado()).toBe('claro')
  })

  it('el segundo click vuelve a la oscura y también lo guarda', () => {
    correr()
    const b = montarBoton()
    b.click()
    b.click()
    expect(document.documentElement.dataset.tema).toBe('oscuro')
    // Guardar 'oscuro' explícito y no borrar la clave: son dos estados
    // distintos —"quiero oscuro" y "no elegí"— y hoy pintan igual, pero
    // sólo el primero sobrevive si algún día cambia lo de por defecto.
    expect(guardado()).toBe('oscuro')
  })

  it('dice qué hace, y lo dice distinto en cada estado', () => {
    correr()
    const b = montarBoton()
    const antes = b.getAttribute('aria-pressed')
    b.click()
    expect(b.getAttribute('aria-pressed')).not.toBe(antes)
  })

  it('con el tema claro ya guardado, el botón aparece en su estado, no en el otro', () => {
    // El script corre en el `<head>`, antes de que el header exista: si no
    // vuelve a pasar cuando el DOM está armado, el botón queda anunciando
    // el estado contrario al que la página está pintando.
    window.localStorage.setItem('tema', 'claro')
    correr()
    const b = montarBoton()
    document.dispatchEvent(new Event('DOMContentLoaded'))
    expect(b.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('el script corre antes de la primera pintura', () => {
  it('las cuatro páginas lo traen en el head y antes de la hoja de estilo', () => {
    for (const p of paginas) {
      const html = readFileSync(resolve(process.cwd(), p), 'utf8')
      const marcador = html.indexOf('<!--#shell:tema-->')
      const hoja = html.indexOf('rel="stylesheet"')
      const finHead = html.indexOf('</head>')
      expect(marcador, `${p} no inyecta el tema`).toBeGreaterThan(-1)
      expect(marcador, `${p} inyecta el tema fuera del head`).toBeLessThan(finHead)
      // Después de la hoja, el browser ya tiene con qué pintar y el
      // destello vuelve.
      expect(marcador, `${p} inyecta el tema después de la hoja`).toBeLessThan(hoja)
    }
  })
})
