import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectShell, readPartials } from '../scripts/shell.mjs'

/**
 * Cierra APAR-R8 de `docs/reglas/apariencia.md`: la marca es «Marco» y sus
 * archivos declaran de qué token salieron.
 *
 * La marca del sitio: el favicon, el icono de iOS y la tarjeta para
 * compartir. Son archivos que viven fuera de la hoja de estilo, así que
 * nada los ata a la paleta salvo estos casos.
 */
const paginas = ['index.html', 'resultados/index.html', 'notas/index.html', 'servicios/index.html']
const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const css = leer('src/style.css')
const favicon = () => leer('public/favicon.svg')

/** El valor de un token adentro de un bloque de la hoja. */
function token(bloque, nombre) {
  const m = bloque.match(new RegExp(`${nombre}\\s*:\\s*(oklch\\([^)]*\\))`))
  return m && m[1].replace(/\s+/g, ' ')
}

describe('los archivos de la marca existen', () => {
  it.each([
    ['public/favicon.svg', 400],
    ['public/favicon-32.png', 200],
    ['public/apple-touch-icon.png', 1000],
    ['public/og.png', 5000],
  ])('%s pesa algo', (ruta, minimo) => {
    expect(existsSync(resolve(process.cwd(), ruta)), `falta ${ruta}`).toBe(true)
    // Un PNG de 0 bytes existe y no se ve: el piso separa "está" de "sirve".
    expect(statSync(resolve(process.cwd(), ruta)).size).toBeGreaterThan(minimo)
  })
})

describe('el favicon se dibuja para 16 px', () => {
  it('usa la variante de trazo grueso, no la del header', () => {
    // A 1,6 el encuadre desaparece en la pestaña. La lámina de marca fija
    // 2,4 para el encuadre y 1,9 para el polígono a tamaño chico.
    expect(favicon()).toContain('stroke-width="2.4"')
    expect(favicon()).not.toContain('stroke-width="1.6"')
  })

  it('trae las dos paletas: la pestaña oscura y la clara', () => {
    // Adentro del favicon `prefers-color-scheme` sí manda —APAR-R7 habla de
    // la página, y acá no hay página ni botón: el cromo del browser es lo
    // único que puede opinar.
    expect(favicon()).toContain('prefers-color-scheme: dark')
  })
})

describe('la marca no se despega de la paleta del sitio', () => {
  // Los hex del SVG son literales por necesidad —un favicon se abre fuera
  // de la página, donde no hay variables— así que nada los ataría a la hoja.
  // El SVG declara de qué oklch salió cada uno y esto lo compara contra la
  // hoja: si alguien cambia el acento, esto se pone rojo y hay que
  // recalcular el hex.
  const declarado = (tema) => {
    const m = favicon().match(new RegExp(`${tema}:\\s*(#[0-9a-f]{6})\\s*=\\s*(oklch\\([^)]*\\))`))
    return m && { hex: m[1], oklch: m[2].replace(/\s+/g, ' ') }
  }

  it('el acento oscuro del favicon es el --accent oscuro de la hoja', () => {
    const d = declarado('oscuro')
    expect(d, 'el favicon no declara de qué oklch salió su acento oscuro').toBeTruthy()
    expect(d.oklch).toBe(token(css.slice(css.indexOf(':root')), '--accent'))
  })

  it('el acento claro del favicon es el --accent claro de la hoja', () => {
    const d = declarado('claro')
    expect(d, 'el favicon no declara de qué oklch salió su acento claro').toBeTruthy()
    expect(d.oklch).toBe(token(css.slice(css.indexOf(':root[data-tema="claro"]')), '--accent'))
  })
})

describe('las cuatro páginas la piden', () => {
  const resuelta = (p) => injectShell(leer(p), { partials: readPartials(), base: '/indec-descargas/' })

  it('todas traen el marcador de iconos, en el head', () => {
    for (const p of paginas) {
      const html = leer(p)
      expect(html.indexOf('<!--#shell:iconos-->'), `${p} no pide los iconos`).toBeGreaterThan(-1)
      expect(html.indexOf('<!--#shell:iconos-->')).toBeLessThan(html.indexOf('</head>'))
    }
  })

  it('los enlaces salen con el base del sitio, no desde la raíz del dominio', () => {
    for (const p of paginas) {
      const html = resuelta(p)
      for (const a of ['favicon.svg', 'apple-touch-icon.png', 'og.png']) {
        expect(html, `${p} no enlaza ${a}`).toContain(`/indec-descargas/${a}`)
      }
      // En GitHub Pages el sitio no cuelga de la raíz: una ruta absoluta
      // pediría el favicon de otro proyecto del mismo dominio.
      expect(html, `${p} enlaza un icono desde la raíz`).not.toMatch(/(?:href|content)="\/(?:favicon|apple-touch|og)/)
    }
  })

  it('cada página se presenta con su propio título al compartirla', () => {
    // Una tarjeta con imagen y sin título no la arma ningún crawler, y las
    // cuatro páginas no dicen lo mismo.
    const titulos = paginas.map((p) => leer(p).match(/property="og:title" content="([^"]*)"/)?.[1])
    expect(titulos.every(Boolean), 'alguna página no declara og:title').toBe(true)
    expect(new Set(titulos).size, 'dos páginas comparten el og:title').toBe(paginas.length)
  })
})
