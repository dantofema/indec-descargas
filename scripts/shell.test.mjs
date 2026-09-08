import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectShell, readPartials } from './shell.mjs'

const partials = { header: '<nav>H</nav>', cta: '<aside>C</aside>', footer: '<footer>F</footer>' }
const opts = { partials, base: '/indec-descargas/' }

describe('injectShell', () => {
  it('reemplaza cada marcador por su partial', () => {
    expect(injectShell('<body><!--#shell:header-->x<!--#shell:footer--></body>', opts))
      .toBe('<body><nav>H</nav>x<footer>F</footer></body>')
  })

  it('reemplaza el mismo marcador más de una vez', () => {
    expect(injectShell('<!--#shell:cta--><!--#shell:cta-->', opts)).toBe('<aside>C</aside><aside>C</aside>')
  })

  it('tira ante un marcador sin partial: un typo no puede quedar en silencio', () => {
    expect(() => injectShell('<!--#shell:fotter-->', opts)).toThrow(/fotter/)
  })

  it('resuelve {{base}} en la página y también adentro del partial', () => {
    const conBase = { partials: { header: '<a href="{{base}}notas/">n</a>' }, base: '/indec-descargas/' }
    expect(injectShell('<!--#shell:header--><img src="{{base}}x.png">', conBase))
      .toBe('<a href="/indec-descargas/notas/">n</a><img src="/indec-descargas/x.png">')
  })

  it('deja intacto un HTML sin marcadores', () => {
    expect(injectShell('<p>hola</p>', opts)).toBe('<p>hola</p>')
  })
})

describe('readPartials', () => {
  it('trae los tres partials del shell', () => {
    expect(Object.keys(readPartials()).sort()).toEqual(['cta', 'footer', 'header'])
  })
})

describe('las páginas del sitio', () => {
  const paginas = ['index.html', 'notas/index.html']

  it('todas traen header, CTA y footer, y todas resuelven', () => {
    for (const p of paginas) {
      const html = readFileSync(resolve(process.cwd(), p), 'utf8')
      for (const m of ['header', 'cta', 'footer']) {
        expect(html, `${p} no trae el marcador ${m}`).toContain(`<!--#shell:${m}-->`)
      }
      expect(() => injectShell(html, { partials: readPartials(), base: '/' })).not.toThrow()
    }
  })

  it('el CTA apunta al Geoportal INDEC y abre en otra pestaña (SITIO-R5)', () => {
    const cta = readPartials().cta
    expect(cta).toContain('https://geonode.indec.gob.ar/')
    expect(cta).toContain('target="_blank"')
    expect(cta).toContain('rel="noopener"')
    expect(cta).toContain('Más info, más mapas, más capas en Geoportal INDEC')
  })
})
