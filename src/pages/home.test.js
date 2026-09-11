// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectShell, readPartials } from '../../scripts/shell.mjs'

// El home es la página comercial: hero, buscador y totales. No baja el
// catálogo —673 KB— hasta que alguien toca el campo, y elegir un objeto no
// abre nada acá: navega a /resultados/.
const totales = {
  generated: '2026-09-06',
  jur: 24, dep: 529, loc: 4023, gl: 2282, aglo: 119,
  fracciones: 6571, radios: 66515, vias: 477588,
}

const catalogo = {
  generated: '2026-09-06',
  objects: [
    { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires' },
    { t: 'jur', c: '06', n: 'Buenos Aires', s: 'buenos aires', p: 'Buenos Aires' },
  ],
}

const crudo = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
const html = injectShell(crudo, { partials: readPartials(), base: '/' })
const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '')

const $ = (sel) => document.querySelector(sel)

/** Escribe en el buscador como lo haría una persona. */
function buscar(texto) {
  $('#q').value = texto
  $('#q').dispatchEvent(new Event('input', { bubbles: true }))
}

const pedidos = () => global.fetch.mock.calls.map(([url]) => String(url))
const pedidosDe = (que) => pedidos().filter((u) => u.includes(que))

let navigate

beforeEach(() => {
  document.body.innerHTML = ''
  Element.prototype.scrollIntoView = () => {}
  navigate = vi.fn()
  global.fetch = vi.fn(async (url) => (String(url).includes('catalog.json')
    ? { ok: true, json: async () => catalogo }
    : { ok: true, json: async () => totales }))
})

/**
 * El import va con el body vacío a propósito: `home.js` es el entry de Vite
 * y se auto-invoca al cargar, y sin su DOM montado se va sin cablear nada.
 * Así cada caso corre una sola instancia, la que se arma acá.
 */
async function montar() {
  vi.resetModules()
  const { initHome } = await import('./home.js')
  document.body.innerHTML = body
  initHome({ navigate })
}

/** Monta y espera a que los totales hayan llegado. */
async function montarConTotales() {
  await montar()
  await vi.waitFor(() => expect($('#totals').children.length).toBeGreaterThan(0))
}

describe('los totales del home', () => {
  it('pinta los ocho objetos, en orden y con sus números', async () => {
    await montarConTotales()
    const tiles = [...$('#totals').children]
    expect(tiles).toHaveLength(8)
    expect(tiles.map((li) => li.querySelector('.totales-label').textContent)).toEqual([
      'Jurisdicciones', 'Departamentos', 'Fracciones censales', 'Radios censales',
      'Localidades censales', 'Gobiernos locales', 'Aglomerados', 'Vías de circulación',
    ])
    // El número no llega de una: los contadores lo suben desde 0 en 1300 ms
    // (APAR-R4), así que hay que esperar a que el reloj termine y no leerlo
    // apenas el tile existe, o esta prueba mide un cuadro cualquiera de la
    // animación en vez del total real.
    await vi.waitFor(() => expect(tiles.map((li) => li.querySelector('.totales-n').textContent)).toEqual([
      '24', '529', '6.571', '66.515', '4.023', '2.282', '119', '477.588',
    ]), { timeout: 2000 })
  })

  it('cada uno trae su icono dibujado a mano, sin librería', async () => {
    await montarConTotales()
    const svgs = $('#totals').querySelectorAll('svg')
    expect(svgs).toHaveLength(8)
    expect([...svgs].every((s) => s.getAttribute('stroke') === 'currentColor')).toBe(true)
    // Ocho dibujos distintos, no el mismo repetido ocho veces.
    expect(new Set([...svgs].map((s) => s.innerHTML)).size).toBe(8)
  })

  // `initHome` es el entry de Vite y se auto-invoca: tiene que poder
  // llamarse de nuevo sin duplicar nada de lo que dibuja.
  it('dibuja una sola vez aunque se vuelva a cablear', async () => {
    await montarConTotales()
    const { initHome } = await import('./home.js')
    initHome({ navigate })
    await vi.waitFor(() => expect($('#totals').children).toHaveLength(8))
    expect($('#type').options).toHaveLength(6)
  })

  it('el pie dice cuándo se generó el catálogo', async () => {
    await montarConTotales()
    expect($('#generated').textContent).toContain('2026-09-06')
  })

  it('si los totales no cargan, el buscador sigue sirviendo', async () => {
    global.fetch = vi.fn(async (url) => (String(url).includes('catalog.json')
      ? { ok: true, json: async () => catalogo }
      : { ok: false, status: 500 }))
    await montar()
    await new Promise((r) => setTimeout(r, 0))
    expect($('#totals').children).toHaveLength(0)

    buscar('tres')
    await vi.waitFor(() => expect($('#results').children).toHaveLength(1))
  })
})

describe('el catálogo se pide tarde', () => {
  it('al cargar la página sólo se piden los totales', async () => {
    await montarConTotales()
    expect(pedidosDe('totales.json')).toHaveLength(1)
    expect(pedidosDe('catalog.json')).toHaveLength(0)
  })

  it('tocar el campo lo pide', async () => {
    await montarConTotales()
    $('#q').focus()
    expect(pedidosDe('catalog.json')).toHaveLength(1)
  })

  it('escribir sin haber enfocado también lo pide', async () => {
    await montarConTotales()
    buscar('tre')
    expect(pedidosDe('catalog.json')).toHaveLength(1)
  })

  it('lo pide una sola vez, por más que se toque el campo mil veces', async () => {
    await montarConTotales()
    $('#q').focus()
    buscar('tres')
    buscar('tres de')
    $('#q').focus()
    expect(pedidosDe('catalog.json')).toHaveLength(1)
  })

  // Es lo que le permite al home no bajar el catálogo hasta que alguien
  // escribe: lo que ya está escrito se vuelve a buscar solo cuando llega.
  it('lo que se escribió mientras tanto se busca solo al llegar el catálogo', async () => {
    await montarConTotales()
    buscar('tres')
    expect($('#results').children).toHaveLength(0)
    await vi.waitFor(() => expect($('#results').children).toHaveLength(1))
    expect($('#results').textContent).toContain('Tres de Febrero')
  })

  it('avisa si el catálogo no carga', async () => {
    global.fetch = vi.fn(async (url) => (String(url).includes('catalog.json')
      ? { ok: false, status: 503 }
      : { ok: true, json: async () => totales }))
    await montarConTotales()
    buscar('tres')
    await vi.waitFor(() => expect($('#status').textContent).toMatch(/503/))
    expect($('#status').className).toContain('error')
  })
})

describe('elegir un objeto', () => {
  it('navega a su ficha en /resultados/', async () => {
    await montarConTotales()
    buscar('tres')
    await vi.waitFor(() => expect($('#results').children).toHaveLength(1))
    $('#results').children[0].click()
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/resultados\/\?t=dep&c=06840$/))
  })

  it('con el teclado hace lo mismo', async () => {
    await montarConTotales()
    buscar('buenos')
    await vi.waitFor(() => expect($('#results').children).toHaveLength(1))
    $('#q').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    $('#q').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/resultados\/\?t=jur&c=06$/))
  })

  // BUS-R1: el filtro por tipo también vive en el home.
  it('el filtro por tipo arranca en todos y ofrece los cinco (regla:buscador:BUS-R1)', async () => {
    await montarConTotales()
    expect($('#type').value).toBe('')
    expect([...$('#type').options].map((o) => o.value))
      .toEqual(['', 'jur', 'dep', 'loc', 'gl', 'aglo'])
  })
})

describe('los contadores corren (regla:apariencia:APAR-R4)', () => {
  // El único `vi.spyOn` del describe: sin restaurarlo, queda pegado a
  // `window.requestAnimationFrame` para los tests que corran después. Hoy
  // es inofensivo —es pass-through—, pero es la clase de cosa que muerde
  // cuando alguien agrega un test nuevo más adelante.
  afterEach(() => vi.restoreAllMocks())

  // No se afirma un valor intermedio (decisión del plan): eso ataría el test
  // al reloj. Pero sin nada más, esta prueba pasaba igual con el código
  // viejo —que siempre pintó el total final de una— porque nunca revisaba
  // que hubiera corrido una animación de verdad. `requestAnimationFrame` es
  // el mecanismo, no un valor de reloj: que se haya llamado sí distingue
  // "corrió un cuadro" de "nunca animó nada".
  it('los contadores arrancan abajo del total y llegan al total', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    await montar()
    const n = () => [...document.querySelectorAll('.totales-n')].map((e) => e.textContent)
    await vi.waitFor(() => expect(raf).toHaveBeenCalled())
    // El reloj de los contadores es de 1300 ms y el default de `vi.waitFor`
    // es 1000 ms: sin este margen el test cronometra la animación en vez de
    // esperarla, y se cae por timeout aunque el código esté bien.
    await vi.waitFor(() => expect(n()).toContain('66.515'), { timeout: 2000 })
  })

  it('con prefers-reduced-motion el número está desde el primer cuadro', async () => {
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
    // `montar()` no espera a que lleguen los totales —es una promesa aparte
    // de montar la página—: revisar el texto justo después corría contra una
    // carrera con esa promesa, no contra el comportamiento que el nombre
    // describe. `montarConTotales()` espera a que los ocho tiles existan; con
    // reduced motion ya están en su valor final en cuanto existen.
    await montarConTotales()
    expect([...document.querySelectorAll('.totales-n')].map((e) => e.textContent)).toContain('66.515')
  })
})

/**
 * El canvas aprobado (`Main.dc.html`) traía una composición que la rama
 * nunca portó: se tradujeron los tokens y las animaciones, y el markup
 * quedó igual al de antes del rediseño. Estos casos fijan lo que el hero
 * tiene que decir, que es donde estaba la diferencia visible.
 */
describe('el hero porta la composición del canvas', () => {
  it('lleva el descargo arriba del título, no sólo en el pie', async () => {
    await montar()
    expect($('.hero .eyebrow').textContent).toBe('Sitio no oficial · Datos del INDEC')
  })

  it('el titular es una oración que cierra', async () => {
    await montar()
    // El anterior decía "más fácil de descargar y usarla en tus proyectos":
    // arranca comparando y termina coordinando un infinitivo con un
    // gerundio. No concuerda, y era lo primero que se leía del sitio.
    expect($('.hero h1').textContent).toBe('La cartografía del INDEC, lista para tus proyectos.')
  })

  it('el campo anuncia que también busca por código', async () => {
    await montar()
    // La búsqueda por código se implementó en la rama anterior y el
    // placeholder se quedó viejo: la función existía y nadie la veía.
    expect($('#q').placeholder).toContain('código')
  })
})

describe('la línea meta del hero (BUS-R5)', () => {
  it('separa lo buscable por nombre de lo direccionable por código', async () => {
    await montarConTotales()
    const meta = $('.hero-meta').textContent
    // 24 + 119 + 529 + 2282 + 4023: los cinco tipos con `catalogo: true`.
    expect(meta).toContain('6.977')
    // Los ocho tipos sumados: todo el Marco es direccionable por código,
    // aunque sólo cinco entren al catálogo de nombres.
    expect(meta).toContain('557.651')
  })

  it('cada número queda pegado a la vía de búsqueda que le corresponde', async () => {
    await montarConTotales()
    const meta = $('.hero-meta').textContent
    // Decir "557.651 objetos indexados" —lo que pedía el artboard— sería
    // falso: radios, fracciones y vías no están en catalog.json. Que los
    // dos números aparezcan no alcanza: cruzados, la página miente igual,
    // así que cada uno se exige junto a su palabra.
    expect(meta).toMatch(/6\.977[^·]*nombre/)
    expect(meta).toMatch(/557\.651[^·]*código/)
  })
})
