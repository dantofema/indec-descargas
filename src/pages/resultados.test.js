// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectShell, readPartials } from '../../scripts/shell.mjs'

// El cableado de /resultados/: que el `resultados/index.html` real, el
// catálogo y los módulos encajen. Leaflet va mockeado —necesita un browser
// de verdad para medir—, todo lo demás es el código que se publica.
vi.mock('leaflet', () => ({
  default: {
    map: () => ({ invalidateSize: () => {}, fitBounds: () => {}, attributionControl: { setPrefix: () => {} } }),
    tileLayer: () => ({ addTo: () => {} }),
    geoJSON: () => ({ addTo() { return this }, getBounds: () => 'bounds', remove: () => {} }),
  },
}))

const catalogo = {
  generated: '2026-09-04',
  objects: [
    { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires',
      ch: { fracciones: 42, radios: 432, localidades: 1, vias: 1487 } },
    { t: 'jur', c: '06', n: 'Buenos Aires', s: 'buenos aires', p: 'Buenos Aires',
      ch: { departamentos: 135, radios: 23901 } },
    // Existe en el catálogo real, con ese conteo: es uno de los 11 pares
    // (objeto, capa) con cero, y los 11 caen en capas que tienen nota.
    { t: 'loc', c: '94021040', n: 'Grytviken', s: 'grytviken', p: 'Tierra del Fuego',
      ch: { vias: 0 } },
  ],
}

// En jsdom `import.meta.url` es una URL http del server de vitest, no un
// archivo: la raíz del proyecto se toma del cwd.
//
// El shell se resuelve acá porque `resultados/index.html` no trae el footer,
// sino el marcador que lo reemplaza: sin esto `#generated` no existiría y la
// página tiraría al intentar escribirlo.
const crudo = readFileSync(resolve(process.cwd(), 'resultados/index.html'), 'utf8')
const html = injectShell(crudo, { partials: readPartials(), base: '/' })
const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '')

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
// `assertCode`—. Sirve tanto para la geometría del objeto de la ficha
// (fila 1) como para la página que carga la fila 3 y el "Ver" que dibuja
// una fila.
const filaDeVerdad = {
  cod_indec: '068400101', cde: '06840', clc: '068401',
  cfn: '01', cro: '01', tro: 'U', nam: 'Nombre de prueba', gna: 'Tipo',
  aglomerado: 'Gran Buenos Aires', fna: 'Avenida de prueba', sag: 'S',
}

/** El espía de navegación: la página nunca navega de verdad en jsdom. */
let navigate

beforeEach(() => {
  document.body.innerHTML = ''
  Element.prototype.scrollIntoView = () => {}
  navigate = vi.fn()
  global.fetch = vi.fn(async (url) => String(url).includes('catalog.json')
    ? { ok: true, json: async () => catalogo }
    : { ok: true, status: 200, json: async () => ({ totalFeatures: 1, features: [{ properties: filaDeVerdad }] }) })
})

afterEach(() => { vi.unstubAllGlobals() })

/**
 * Monta la página con la URL que se le pida. El estado es la URL, así que
 * cada caso es una URL distinta y no una secuencia de clics.
 *
 * El import va con el body vacío a propósito: `resultados.js` es el entry
 * de Vite y se auto-invoca al cargar, y sin su DOM montado se va sin
 * cablear nada. Así cada caso corre una sola instancia, la que se arma acá
 * con su propio `navigate`.
 */
async function montarSinEsperar(search = '') {
  window.history.replaceState({}, '', `/resultados/${search}`)
  vi.resetModules()
  const { initResultados } = await import('./resultados.js')
  document.body.innerHTML = body
  initResultados({ navigate })
}

/** Lo mismo, esperando a que el catálogo haya llegado. */
async function montar(search = '') {
  await montarSinEsperar(search)
  await vi.waitFor(() => expect($('#generated').textContent).not.toBe(''))
}

describe('el recorrido completo', () => {
  it('arranca con el catálogo cargado y sin ficha si el enlace no trae objeto', async () => {
    await montar()
    expect($('#generated').textContent).toContain('3 objetos')
    expect($('#generated').textContent).toContain('2026-09-04')
    // Ya no hay tope de descarga: el pie de página no debe mentir sobre uno.
    expect($('#generated').textContent).not.toContain('máximo')
    expect($('#detail').hidden).toBe(true)
  })

  it('buscar muestra los resultados con su tipo', async () => {
    await montar()
    buscar('tres')
    expect($('#results').hidden).toBe(false)
    expect($('#results').children).toHaveLength(1)
    expect($('#results').textContent).toContain('Tres de Febrero')
    expect($('#results').textContent).toContain('Departamento')
  })

  it('la ficha del enlace trae su descarga y sus capas', async () => {
    await montar('?t=dep&c=06840')

    expect($('#detail').hidden).toBe(false)
    expect($('#status').hidden).toBe(true)
    expect($('#q').value).toBe('Tres de Febrero')
    expect($('#detail-name').textContent).toBe('Tres de Febrero')
    expect($('#detail-meta').textContent).toContain('código 06840')

    const propia = $('#detail-self a.btn')
    expect(propia.getAttribute('href')).toContain('CQL_FILTER=cde%3D%2706840%27')
    expect(propia.getAttribute('href')).toContain('outputFormat=geopackage')

    expect($('#children').children).toHaveLength(4)
    expect($('#children').querySelectorAll('a.btn')).toHaveLength(4)
  })

  // El foco arranca en el buscador: buscar otra cosa no obliga a ir a
  // buscar el campo con el mouse.
  it('el foco arranca en el buscador', async () => {
    await montar('?t=dep&c=06840')
    expect(document.activeElement.id).toBe('q')
  })

  // "Descargar este jurisdicción" se leía en el sitio publicado: el texto
  // se armaba con `este` fijo y dos de los cinco tipos son femeninos.
  it('el botón de descarga propia concuerda en género', async () => {
    await montar('?t=dep&c=06840')
    expect($('#detail-self a.btn').textContent).toBe('Descargar este departamento')

    await montar('?t=jur&c=06')
    expect($('#detail-self a.btn').textContent).toBe('Descargar esta jurisdicción')
  })

  it('elegir con el teclado hace lo mismo que con el mouse', async () => {
    await montar()
    buscar('tres')
    $('#q').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    $('#q').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/resultados\/\?t=dep&c=06840$/))
  })

  // La provincia grande es el ejemplo del dueño: sus 23.901 radios ya no
  // tienen tope que los bloquee, pero sí un aviso de peso antes del clic.
  it('la capa que antes superaba el tope ahora descarga con su aviso de peso', async () => {
    await montar('?t=jur&c=06')

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
    global.fetch = vi.fn(async () => ({ ok: false, status: 503 }))
    await montarSinEsperar('?t=dep&c=06840')
    // Se espera el texto del error y no `hidden === false`: la línea de
    // estado arranca visible diciendo "Cargando el catálogo…", así que esa
    // condición ya se cumple antes de que el fallo llegue.
    await vi.waitFor(() => expect($('#status').textContent).toMatch(/503/))
    expect($('#status').className).toContain('error')
    expect($('#status').hidden).toBe(false)
    expect($('#detail').hidden).toBe(true)
  })
})

// BUS-R1: el filtro acota sobre qué tipo de objeto se busca, y arranca en
// todos para que no haya que elegir nada antes de escribir.
describe('el filtro por tipo', () => {
  it('arranca en todos y ofrece los cinco tipos en orden', async () => {
    await montar()
    expect($('#type')).not.toBe(null)
    expect($('#type').value).toBe('')
    expect([...$('#type').options].map((o) => o.value))
      .toEqual(['', 'jur', 'dep', 'loc', 'gl', 'aglo'])
    expect([...$('#type').options].map((o) => o.textContent)).toEqual([
      'Todos los tipos', 'Jurisdicciones', 'Departamentos',
      'Localidades censales', 'Gobiernos locales', 'Aglomerados',
    ])
  })

  it('acota la búsqueda al tipo elegido', async () => {
    await montar()
    filtrar('jur')
    buscar('tres')
    expect($('#results').children).toHaveLength(0)
    expect($('#results').hidden).toBe(true)
  })

  it('vuelve a buscar al cambiar de tipo, sin retipear', async () => {
    await montar()
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
  it('encuentra el departamento nombrando su provincia', async () => {
    await montar()
    buscar('febrero buenos aires')
    expect($('#results').children).toHaveLength(1)
    expect($('#results').textContent).toContain('Tres de Febrero')
  })
})

// La cadena de padres es lo único que la fila 2 agrega al recorrido de hoy.
describe('la fila de padres', () => {
  it('ofrece la jurisdicción de un departamento', async () => {
    await montar('?t=dep&c=06840')
    const filas = [...$('#parents').children]
    expect(filas).toHaveLength(1)
    expect(filas[0].textContent).toContain('Buenos Aires')
    expect(filas[0].textContent).toContain('Jurisdicción')
    expect(filas[0].querySelector('a.btn').getAttribute('href')).toContain('cpr%3D%2706%27')
  })

  it('la jurisdicción no muestra la fila, porque no tiene padres', async () => {
    await montar('?t=jur&c=06')
    expect($('#row-parents').hidden).toBe(true)
  })
})

// La fila 3: recorrer los hijos paginados y descargarlos o verlos en el
// mapa. Las pestañas y la tabla ya tienen su propio suite en
// browser.test.js; acá sólo se prueba que el cableado real —el
// `resultados/index.html` publicado, con el catálogo de verdad— las enciende.
describe('recorrer los hijos', () => {
  it('abre la pestaña, lista la página y descarga una fila', async () => {
    await montar('?t=dep&c=06840')
    await vi.waitFor(() => expect($('#browse tbody')).not.toBe(null))
    expect($('#row-browse').hidden).toBe(false)
    // fracciones, radios, localidades y vías: las cuatro que trae el catálogo.
    expect(document.querySelectorAll('#browse [role="tab"]')).toHaveLength(4)

    const href = $('#browse tbody tr a.btn').getAttribute('href')
    expect(href).toContain('outputFormat=geopackage')
  })

  // Corrección 2 al brief original: la pestaña de vías no se auto-carga,
  // tampoco cableada en la app completa —no sólo en el test unitario de
  // browser.js—.
  it('la pestaña de vías pide confirmación en vez de cargar sola', async () => {
    await montar('?t=dep&c=06840')
    await vi.waitFor(() => expect($('#browse tbody')).not.toBe(null))
    const llamadasAntes = global.fetch.mock.calls.length

    const tabVias = [...document.querySelectorAll('#browse [role="tab"]')]
      .find((tab) => tab.textContent.includes('Vías'))
    tabVias.click()

    expect(global.fetch).toHaveBeenCalledTimes(llamadasAntes)
    expect($('#browse').textContent).toMatch(/99 segundos/)
  })

  // Corrección 3 al brief original: Ver deja la fila marcada, sin romper el
  // resto de la ficha si el dibujo en el mapa sale bien.
  it('Ver dibuja la fila en el mapa y la deja marcada', async () => {
    await montar('?t=dep&c=06840')
    await vi.waitFor(() => expect($('#browse tbody')).not.toBe(null))

    const fila = $('#browse tbody tr')
    fila.querySelector('button').click()
    expect(fila.getAttribute('aria-selected')).toBe('true')

    await new Promise((r) => setTimeout(r, 0))
    expect($('#status').hidden).toBe(true)
  })

  // Fix round 1, hallazgo 1 (importante): `el.meta.textContent += ...` en
  // el handler de onFeature acumulaba con cada "Ver", incluso repetido
  // sobre la misma fila. La línea de metadatos describe el objeto de la
  // ficha, siempre, y nunca acumula —mirar una fila ya se señala marcando
  // la fila en la tabla, no reescribiendo el nombre de al lado del mapa—.
  it('dos Ver seguidos no acumulan ni repiten la línea de identidad del objeto', async () => {
    await montar('?t=dep&c=06840')
    await vi.waitFor(() => expect($('#browse tbody')).not.toBe(null))
    // Deja asentar el onFeature que dispara el showObject del departamento.
    await new Promise((r) => setTimeout(r, 0))

    const metaBase = $('#detail-meta').textContent
    const ocurrencias = (texto) => metaBase.split(texto).length - 1
    // Prueba que el aviso de onFeature sí llegó a pegarse una vez —si no,
    // el test siguiente pasaría aunque nadie hubiera arreglado nada—.
    expect(metaBase).toContain('cod_indec: 068400101')
    expect(ocurrencias('cod_indec')).toBe(1)

    // El mock de este archivo sólo trae una fila (`totalFeatures: 1`): dos
    // "Ver" seguidos sobre la misma fila alcanzan para probar que no
    // acumula —de hecho es un caso más exigente que dos filas distintas—.
    const fila = $('#browse tbody tr')
    fila.querySelector('button').click()
    await new Promise((r) => setTimeout(r, 0))
    expect($('#detail-meta').textContent).toBe(metaBase)

    fila.querySelector('button').click()
    await new Promise((r) => setTimeout(r, 0))
    expect($('#detail-meta').textContent).toBe(metaBase)
  })
})

// Fix round 3, hallazgo 3: las dos filas de la misma ficha se
// contradecían con conteo cero. La 2 decía bien que no hay vías; la 3
// ofrecía recorrerlas igual, con el panel de costo y un botón que dispara
// un pedido de 17 s que vuelve vacío.
describe('un objeto con una capa hija en cero', () => {
  it('lo dice una sola vez, en la fila 2, y no ofrece recorrerla', async () => {
    await montar('?t=loc&c=94021040')

    const vias = [...$('#children').children][0]
    expect(vias.querySelector('a.btn')).toBe(null)
    expect(vias.textContent).toMatch(/no hay vías de circulación en este objeto/i)

    expect($('#row-browse').hidden).toBe(true)
    expect($('#browse').children).toHaveLength(0)

    // Y no se le pide nada al GeoServer por una capa que sabemos vacía.
    await new Promise((r) => setTimeout(r, 0))
    const pedidos = global.fetch.mock.calls.map(([url]) => String(url))
    expect(pedidos.filter((u) => u.includes('vias_de_circulacion'))).toEqual([])
  })
})

// NAV-R1 a R3, R5, R7 a R9 siguen valiendo; lo que esta tarea agrega es que
// todo eso se abre desde la URL y no desde una secuencia de clics.
describe('la URL es el estado', () => {
  it('sin parámetros muestra el buscador y no dibuja ficha', async () => {
    await montar('')
    expect($('#detail').hidden).toBe(true)
    expect($('#status').textContent).toMatch(/Buscá un objeto/)
    expect($('#status').classList.contains('error')).toBe(false)
  })

  it('con t y c válidos abre la ficha de ese objeto', async () => {
    await montar('?t=dep&c=06840')
    expect($('#detail-name').textContent).toBe('Tres de Febrero')
  })

  it('un tipo desconocido muestra el error y el buscador, no una ficha rota', async () => {
    await montar('?t=xx&c=06840')
    expect($('#detail').hidden).toBe(true)
    expect($('#status').classList.contains('error')).toBe(true)
    expect($('#q')).not.toBe(null)
  })

  it('un código que no está en el catálogo también', async () => {
    await montar('?t=dep&c=99999')
    expect($('#detail').hidden).toBe(true)
    expect($('#status').textContent).toMatch(/99999/)
    expect($('#status').classList.contains('error')).toBe(true)
  })

  it('abre la capa que pide la URL', async () => {
    await montar('?t=dep&c=06840&capa=radios')
    expect($('[role="tab"][aria-selected="true"]').textContent)
      .toContain('Radios censales')
  })

  it('capa=vias abre el panel de costo y no pide nada (NAV-R7, SITIO-R3)', async () => {
    await montar('?t=dep&c=06840&capa=vias')
    expect($('#browse').textContent).toContain('no tiene un índice útil')
    // `toHaveBeenCalledWith` compara la lista de argumentos entera y
    // `features.js` llama `fetch(url, { signal })` con dos: un solo matcher
    // no matchea nunca y el `not` pasaría siempre.
    expect(global.fetch.mock.calls.some(([u]) => String(u).includes('vias_de_circulacion'))).toBe(false)
  })

  // La pestaña que el browser abre solo al armarse no es una acción del
  // usuario: el enlace que se comparte queda como se lo abrió, y `capa=`
  // aparece recién cuando alguien cambia de pestaña.
  it('abrir la ficha no le agrega la capa por defecto a la barra', async () => {
    await montar('?t=dep&c=06840')
    expect(window.location.search).toBe('?t=dep&c=06840')
  })

  // Un enlace que nombra una capa ya afirmó qué se está viendo: si el
  // objeto no la tiene, la barra tiene que quedar diciendo la que se abrió
  // en su lugar, no la que no existe.
  it('una capa que el objeto no tiene deja la barra diciendo la que se abrió', async () => {
    await montar('?t=dep&c=06840&capa=departamentos')
    expect($('[role="tab"][aria-selected="true"]').textContent).toContain('Fracciones censales')
    expect(window.location.search).toBe('?t=dep&c=06840&capa=fracciones')
  })

  it('cambiar de pestaña reescribe la URL sin navegar', async () => {
    await montar('?t=dep&c=06840')
    document.querySelectorAll('[role="tab"]')[1].click()
    expect(window.location.search).toContain('capa=radios')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('elegir otro objeto en el buscador navega al permalink', async () => {
    await montar('?t=dep&c=06840')
    buscar('buenos aires')
    $('#results').children[0].click()
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/resultados\/\?t=jur&c=06$/))
  })

  it('copiar enlace copia la URL de la barra', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await montar('?t=dep&c=06840')
    $('#copy-link').click()
    expect(writeText).toHaveBeenCalledWith(window.location.href)
  })

  // Sin `navigator.clipboard` —http, o un browser que no lo trae— el botón
  // no puede cumplir lo que promete: mejor no ofrecerlo.
  it('sin portapapeles el botón de copiar no se muestra', async () => {
    await montar('?t=dep&c=06840')
    expect($('#copy-link').hidden).toBe(true)
  })
})
