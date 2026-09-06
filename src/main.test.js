// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// El cableado: que el `index.html` real, el catálogo y los módulos encajen.
// Leaflet va mockeado —necesita un browser de verdad para medir—, todo lo
// demás es el código que se publica.
vi.mock('leaflet', () => ({
  default: {
    map: () => ({ invalidateSize: () => {}, fitBounds: () => {} }),
    tileLayer: () => ({ addTo: () => {} }),
    geoJSON: () => ({ addTo() { return this }, getBounds: () => 'bounds', remove: () => {} }),
  },
}))

const catalogo = {
  generated: '2026-09-04',
  maxFeatures: 5000,
  objects: [
    { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires',
      ch: { fracciones: 42, radios: 432, localidades: 1, vias: 1487 } },
    { t: 'jur', c: '06', n: 'Buenos Aires', s: 'buenos aires', p: 'Buenos Aires',
      ch: { departamentos: 135, radios: 23901 } },
  ],
}

// En jsdom `import.meta.url` es una URL http del server de vitest, no un
// archivo: la raíz del proyecto se toma del cwd.
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '')

const $ = (sel) => document.querySelector(sel)

/** Escribe en el buscador como lo haría una persona. */
function buscar(texto) {
  $('#q').value = texto
  $('#q').dispatchEvent(new Event('input', { bubbles: true }))
}

/** Elige un tipo en el filtro, como lo haría una persona. */
function filtrar(tipo) {
  $('#type').value = tipo
  $('#type').dispatchEvent(new Event('change', { bubbles: true }))
}

// Una fila con propiedades de verdad: `cod_indec`/`cde`/`clc` son los
// `idField` de las cinco capas hijas, y tienen que ser dígitos —pasan por
// `assertCode`—. Sirve tanto para la geometría del objeto elegido (fila 1)
// como para la página que carga la fila 3 y el "Ver" que dibuja una fila.
const filaDeVerdad = {
  cod_indec: '068400101', cde: '06840', clc: '068401',
  cfn: '01', cro: '01', tro: 'U', nam: 'Nombre de prueba', gna: 'Tipo',
  aglomerado: 'Gran Buenos Aires', fna: 'Avenida de prueba', sag: 'S',
}

beforeEach(async () => {
  vi.resetModules()
  document.body.innerHTML = body
  Element.prototype.scrollIntoView = () => {}
  global.fetch = vi.fn(async (url) => String(url).includes('catalog.json')
    ? { ok: true, json: async () => catalogo }
    : { ok: true, status: 200, json: async () => ({ totalFeatures: 1, features: [{ properties: filaDeVerdad }] }) })
  await import('./main.js')
  await vi.waitFor(() => expect($('#generated').textContent).not.toBe(''))
})

describe('el recorrido completo', () => {
  it('arranca con el catálogo cargado y la ficha oculta', () => {
    expect($('#generated').textContent).toContain('2 objetos')
    expect($('#generated').textContent).toContain('2026-09-04')
    // Ya no hay tope de descarga: el pie de página no debe mentir sobre uno.
    expect($('#generated').textContent).not.toContain('máximo')
    expect($('#detail').hidden).toBe(true)
    expect($('#status').hidden).toBe(true)
    // El foco arranca en el buscador: no hace falta ir a buscarlo.
    expect(document.activeElement.id).toBe('q')
  })

  it('buscar muestra los resultados con su tipo', () => {
    buscar('tres')
    expect($('#results').hidden).toBe(false)
    expect($('#results').children).toHaveLength(1)
    expect($('#results').textContent).toContain('Tres de Febrero')
    expect($('#results').textContent).toContain('Departamento')
  })

  it('elegir un resultado abre la ficha con su descarga y sus capas', () => {
    buscar('tres')
    $('#results').children[0].click()

    expect($('#detail').hidden).toBe(false)
    expect($('#results').hidden).toBe(true)
    expect($('#q').value).toBe('Tres de Febrero')
    expect($('#detail-name').textContent).toBe('Tres de Febrero')
    expect($('#detail-meta').textContent).toContain('código 06840')

    const propia = $('#detail-self a.btn')
    expect(propia.getAttribute('href')).toContain('CQL_FILTER=cde%3D%2706840%27')
    expect(propia.getAttribute('href')).toContain('outputFormat=geopackage')

    expect($('#children').children).toHaveLength(4)
    expect($('#children').querySelectorAll('a.btn')).toHaveLength(4)
  })

  // "Descargar este jurisdicción" se leía en el sitio publicado: el texto
  // se armaba con `este` fijo y dos de los cinco tipos son femeninos.
  it('el botón de descarga propia concuerda en género', () => {
    buscar('tres')
    $('#results').children[0].click()
    expect($('#detail-self a.btn').textContent).toBe('Descargar este departamento')

    buscar('buenos')
    $('#results').children[0].click()
    expect($('#detail-self a.btn').textContent).toBe('Descargar esta jurisdicción')
  })

  it('elegir con el teclado hace lo mismo que con el mouse', () => {
    buscar('tres')
    $('#q').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    $('#q').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect($('#detail').hidden).toBe(false)
    expect($('#detail-name').textContent).toBe('Tres de Febrero')
  })

  // La provincia grande es el ejemplo del dueño: sus 23.901 radios ya no
  // tienen tope que los bloquee, pero sí un aviso de peso antes del clic.
  it('la capa que antes superaba el tope ahora descarga con su aviso de peso', () => {
    buscar('buenos')
    $('#results').children[0].click()

    const filas = [...$('#children').children]
    const radios = filas.find((li) => li.textContent.includes('Radios'))
    expect(radios.querySelector('a.btn')).not.toBe(null)
    expect(radios.querySelector('[aria-disabled="true"]')).toBe(null)
    expect(radios.textContent).toContain('23.901')
    expect(radios.textContent).toMatch(/MB/)

    const deps = filas.find((li) => li.textContent.includes('Departamentos'))
    expect(deps.querySelector('a.btn')).not.toBe(null)
    expect(deps.textContent).not.toMatch(/MB/)
  })

  it('avisa si el catálogo no carga', async () => {
    vi.resetModules()
    document.body.innerHTML = body
    global.fetch = vi.fn(async () => ({ ok: false, status: 503 }))
    await import('./main.js')
    await vi.waitFor(() => expect($('#status').hidden).toBe(false))
    expect($('#status').className).toContain('error')
    expect($('#status').textContent).toMatch(/503/)
  })
})

// BUS-R1: el filtro acota sobre qué tipo de objeto se busca, y arranca en
// todos para que no haya que elegir nada antes de escribir.
describe('el filtro por tipo', () => {
  it('arranca en todos y ofrece los cinco tipos en orden', () => {
    expect($('#type')).not.toBe(null)
    expect($('#type').value).toBe('')
    expect([...$('#type').options].map((o) => o.value))
      .toEqual(['', 'jur', 'dep', 'loc', 'gl', 'aglo'])
    expect([...$('#type').options].map((o) => o.textContent)).toEqual([
      'Todos los tipos', 'Jurisdicciones', 'Departamentos',
      'Localidades censales', 'Gobiernos locales', 'Aglomerados',
    ])
  })

  it('acota la búsqueda al tipo elegido', () => {
    filtrar('jur')
    buscar('tres')
    expect($('#results').children).toHaveLength(0)
    expect($('#results').hidden).toBe(true)
  })

  it('vuelve a buscar al cambiar de tipo, sin retipear', () => {
    buscar('tres')
    expect($('#results').children).toHaveLength(1)
    filtrar('jur')
    expect($('#results').children).toHaveLength(0)
    filtrar('dep')
    expect($('#results').children).toHaveLength(1)
  })
})

// BUS-R3: la clave de la provincia la agrega `loadCatalog`, no el build,
// así que sólo el cableado completo prueba que llega hasta la búsqueda.
describe('la provincia como término extra', () => {
  it('encuentra el departamento nombrando su provincia', () => {
    buscar('febrero buenos aires')
    expect($('#results').children).toHaveLength(1)
    expect($('#results').textContent).toContain('Tres de Febrero')
  })
})

// La cadena de padres es lo único que la fila 2 agrega al recorrido de hoy.
describe('la fila de padres', () => {
  it('ofrece la jurisdicción de un departamento', () => {
    buscar('tres')
    $('#results').children[0].click()
    const filas = [...$('#parents').children]
    expect(filas).toHaveLength(1)
    expect(filas[0].textContent).toContain('Buenos Aires')
    expect(filas[0].textContent).toContain('Jurisdicción')
    expect(filas[0].querySelector('a.btn').getAttribute('href')).toContain('cpr%3D%2706%27')
  })

  it('la jurisdicción no muestra la fila, porque no tiene padres', () => {
    buscar('buenos')
    $('#results').children[0].click()
    expect($('#row-parents').hidden).toBe(true)
  })
})

// La fila 3: recorrer los hijos paginados y descargarlos o verlos en el
// mapa. Las pestañas y la tabla ya tienen su propio suite en
// browser.test.js; acá sólo se prueba que el cableado real —el `index.html`
// publicado, con el catálogo de verdad— las enciende.
describe('recorrer los hijos', () => {
  it('abre la pestaña, lista la página y descarga una fila', async () => {
    buscar('tres')
    $('#results').children[0].click()
    await vi.waitFor(() => expect($('#browse tbody')).not.toBe(null))
    expect($('#row-browse').hidden).toBe(false)
    // fracciones, radios, localidades y vías: las cuatro que trae el catálogo.
    expect(document.querySelectorAll('#browse [role="tab"]')).toHaveLength(4)

    const href = $('#browse tbody tr a.btn').getAttribute('href')
    expect(href).toContain('outputFormat=geopackage')
  })

  // Corrección 2 al brief: la pestaña de vías no se auto-carga, tampoco
  // cableada en la app completa —no sólo en el test unitario de browser.js—.
  it('la pestaña de vías pide confirmación en vez de cargar sola', async () => {
    buscar('tres')
    $('#results').children[0].click()
    await vi.waitFor(() => expect($('#browse tbody')).not.toBe(null))
    const llamadasAntes = global.fetch.mock.calls.length

    const tabVias = [...document.querySelectorAll('#browse [role="tab"]')]
      .find((tab) => tab.textContent.includes('Vías'))
    tabVias.click()

    expect(global.fetch).toHaveBeenCalledTimes(llamadasAntes)
    expect($('#browse').textContent).toMatch(/99 segundos/)
  })

  // Corrección 3 al brief: Ver deja la fila marcada, sin romper el resto
  // de la ficha si el dibujo en el mapa sale bien.
  it('Ver dibuja la fila en el mapa y la deja marcada', async () => {
    buscar('tres')
    $('#results').children[0].click()
    await vi.waitFor(() => expect($('#browse tbody')).not.toBe(null))

    const fila = $('#browse tbody tr')
    fila.querySelector('button').click()
    expect(fila.getAttribute('aria-selected')).toBe('true')

    await new Promise((r) => setTimeout(r, 0))
    expect($('#status').hidden).toBe(true)
  })
})
