import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectShell, readPartials, readGenerated } from './shell.mjs'
import viteConfig from '../vite.config.js'

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

  it('resuelve {{generated}} igual que {{base}}', () => {
    expect(injectShell('<p id="generated">{{generated}}</p>', { ...opts, generated: 'Catálogo generado el 2026-09-06.' }))
      .toBe('<p id="generated">Catálogo generado el 2026-09-06.</p>')
  })

  // Sin fecha el nodo queda vacío, que es como estaba: un pie sin fecha no
  // es motivo para publicar `{{generated}}` a la vista.
  it('sin fecha deja el nodo vacío en vez del marcador crudo', () => {
    expect(injectShell('<p id="generated">{{generated}}</p>', opts)).toBe('<p id="generated"></p>')
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
  const paginas = ['index.html', 'resultados/index.html', 'notas/index.html', 'servicios/index.html']

  it('todas traen header, CTA y footer, y todas resuelven', () => {
    for (const p of paginas) {
      const html = readFileSync(resolve(process.cwd(), p), 'utf8')
      for (const m of ['header', 'cta', 'footer']) {
        expect(html, `${p} no trae el marcador ${m}`).toContain(`<!--#shell:${m}-->`)
      }
      expect(() => injectShell(html, { partials: readPartials(), base: '/' })).not.toThrow()
    }
  })

  // `index.html` tenía su `<h1>` antes de partir el sitio en cuatro; el
  // header compartido no trae ninguno, así que /resultados/ —la única
  // página que es una app— quedó con el `<h2 id="detail-name">` oculto
  // como único encabezado.
  it('cada página tiene exactamente un h1', () => {
    for (const p of paginas) {
      const html = injectShell(
        readFileSync(resolve(process.cwd(), p), 'utf8'),
        { partials: readPartials(), base: '/' },
      )
      expect(html.match(/<h1[\s>]/g) ?? [], `${p} no tiene exactamente un h1`).toHaveLength(1)
    }
  })

  // El spec §6 dice que la fecha de generación del catálogo sigue
  // mostrándose, y `#generated` vive en el footer compartido: lo llenaban
  // sólo home y resultados, así que en /notas/ y /servicios/ quedaba un
  // `<p>` vacío. Se resuelve en build, como el resto del shell: la fecha
  // está en el HTML servido aunque el JS no corra, y /servicios/ —que no
  // tiene una línea de JS— no necesita ninguna para mostrarla.
  it('las cuatro llevan la fecha del catálogo en el pie (spec §6)', () => {
    const generated = readGenerated()
    // Sin esto el caso tiene una rama vacía: si `totales.json` pierde el
    // campo, `readGenerated` devuelve '' y las cuatro aserciones pasan por
    // `toContain('')` mientras el pie queda sin fecha.
    expect(generated, 'readGenerated() no devolvió ninguna fecha').not.toBe('')

    for (const p of paginas) {
      const html = injectShell(
        readFileSync(resolve(process.cwd(), p), 'utf8'),
        { partials: readPartials(), base: '/', generated },
      )
      expect(html, `${p} no muestra la fecha del catálogo`).toContain(generated)
    }
  })

  it('esa fecha sale del totales.json commiteado, no de un literal', () => {
    const { generated } = JSON.parse(readFileSync(resolve(process.cwd(), 'public/totales.json'), 'utf8'))
    expect(readGenerated()).toBe(`Catálogo generado el ${generated}.`)
  })

  it('el CTA apunta al Geoportal INDEC y abre en otra pestaña (SITIO-R5)', () => {
    const cta = readPartials().cta
    expect(cta).toContain('https://geonode.indec.gob.ar/')
    expect(cta).toContain('target="_blank"')
    expect(cta).toContain('rel="noopener"')
    expect(cta).toContain('Más info, más mapas, más capas en Geoportal INDEC')
  })
})

// SITIO-R6 no vive en `injectShell` sino en el cableado: hasta acá nadie
// llamaba al plugin —los cuatro tests de página inyectan el shell ellos
// mismos—, así que sacar `plugins: [shellPlugin()]` de `vite.config.js`
// dejaba la suite entera en verde y publicaba las cuatro páginas con
// `<!--#shell:footer-->` crudo: un comentario HTML invisible, sin header,
// sin CTA y sin la advertencia de límites. Justo el modo de falla que la
// regla cita como su razón de ser.
describe('el plugin del shell, tal como lo enchufa el build', () => {
  const plugin = (viteConfig.plugins ?? []).flat().find((p) => p?.name === 'indec-shell')

  it('vite.config.js lo tiene enchufado (SITIO-R6)', () => {
    expect(plugin, 'vite.config.js dejó de enchufar el plugin del shell').toBeDefined()
  })

  it('resuelve el HTML de una página de verdad, con el base que le da Vite', () => {
    // `configResolved` es por dónde le llega el base a un plugin de Vite:
    // sin esa llamada el plugin resolvería `{{base}}` contra `/`.
    plugin.configResolved({ base: viteConfig.base })
    const html = plugin.transformIndexHtml.handler(
      readFileSync(resolve(process.cwd(), 'resultados/index.html'), 'utf8'),
    )

    expect(html).not.toMatch(/<!--#shell:/)
    expect(html).not.toMatch(/\{\{[a-z]+\}\}/)
    expect(html).toContain('Instituto Nacional de Estadística y Censos')
    expect(html).toContain(readGenerated())
    expect(html).toContain('Más info, más mapas, más capas en Geoportal INDEC')
    expect(html).toContain(`href="${viteConfig.base}notas/"`)
  })
})
