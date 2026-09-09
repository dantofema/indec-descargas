// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectShell, readPartials } from '../../scripts/shell.mjs'

// El cableado de /resultados/: que el `resultados/index.html` real, el
// catálogo y los módulos encajen. Leaflet va mockeado —necesita un browser
// de verdad para medir—, todo lo demás es el código que se publica.
//
// `mapaLeaflet` guarda el objeto que devuelve `L.map()` en el montaje más
// reciente: la ficha de una vía (SITIO-R3) tiene que avisarle a Leaflet su
// tamaño al destaparse `#detail` sin haber dibujado nada todavía, y sin
// `invalidateSize` como espía ningún test lo puede comprobar sobre el mock.
let mapaLeaflet
vi.mock('leaflet', () => ({
  default: {
    map: () => {
      mapaLeaflet = { invalidateSize: vi.fn(), fitBounds: () => {}, attributionControl: { setPrefix: () => {} } }
      return mapaLeaflet
    },
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
    // El catálogo real tiene el departamento y la localidad censal
    // homónimos de Tres de Febrero: este objeto lo agrega acá porque una
    // vía (Task 5) lo necesita como padre.
    { t: 'loc', c: '06840010', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires',
      ch: { vias: 1487 } },
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
// (fila 1) como para la página que carga la fila 3.
const filaDeVerdad = {
  cod_indec: '068400101', cde: '06840', clc: '068401',
  cfn: '01', cro: '01', tro: 'U', nam: 'Nombre de prueba', gna: 'Tipo',
  aglomerado: 'Gran Buenos Aires', fna: 'Avenida de prueba', sag: 'S',
}

/** El espía de navegación: la página nunca navega de verdad en jsdom. */
let navigate
/** El mismo espía de `global.fetch`, con nombre: lo necesita el "Ver" de una
 * vía (NAV-R11), que prueba que no pide nada de más contando llamadas. */
let fetchSpy

beforeEach(() => {
  document.body.innerHTML = ''
  Element.prototype.scrollIntoView = () => {}
  navigate = vi.fn()
  fetchSpy = vi.fn(async (url) => String(url).includes('catalog.json')
    ? { ok: true, json: async () => catalogo }
    : { ok: true, status: 200, json: async () => ({ totalFeatures: 1, features: [{ properties: filaDeVerdad }] }) })
  global.fetch = fetchSpy
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
    expect($('#generated').textContent).toContain('4 objetos')
    expect($('#generated').textContent).toContain('2026-09-04')
    // Ya no hay tope de descarga: el pie de página no debe mentir sobre uno.
    expect($('#generated').textContent).not.toContain('máximo')
    expect($('#detail').hidden).toBe(true)
  })

  it('buscar muestra los resultados con su tipo', async () => {
    await montar()
    buscar('tres')
    expect($('#results').hidden).toBe(false)
    // El departamento y la localidad censal de Tres de Febrero son
    // homónimos en el catálogo real: la consulta trae los dos, y el tipo
    // de cada fila es lo único que los distingue.
    expect($('#results').children).toHaveLength(2)
    expect($('#results').textContent).toContain('Tres de Febrero')
    expect($('#results').textContent).toContain('Departamento')
    expect($('#results').textContent).toContain('Localidad censal')
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
    // Sin filtro, el departamento y la localidad homónima aparecen los dos.
    expect($('#results').children).toHaveLength(2)
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
    // Acotado a departamento: la localidad homónima matchea el mismo
    // término y esta prueba es sobre el departamento, no sobre el empate.
    filtrar('dep')
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

  // Task 6: la página de la tabla viaja en el permalink, cableado completo
  // (permalink.parse → resultados.selectObject → browser.show).
  it('abre la tabla en la página que recuerda el permalink', async () => {
    await montar('?t=dep&c=06840&capa=radios&pag=4')
    await vi.waitFor(() => expect($('#browse tbody')).not.toBe(null))
    const pedidoRadios = fetchSpy.mock.calls.map(([u]) => String(u)).find((u) => u.includes('radios_censales2'))
    expect(pedidoRadios).toContain('startIndex=60')
  })

  // Cierra el ciclo: sin esto el Atrás del navegador (Task 4) volvería a la
  // página 1 en vez de a la que se estaba mirando, la regresión que esta
  // tarea existe para evitar.
  it('pasar de página reescribe pag= en la barra, para que el enlace la recuerde', async () => {
    global.fetch = vi.fn(async (url) => String(url).includes('catalog.json')
      ? { ok: true, json: async () => catalogo }
      : { ok: true, status: 200, json: async () => ({ totalFeatures: 42, features: [{ properties: filaDeVerdad }] }) })
    await montar('?t=dep&c=06840&capa=radios')
    await vi.waitFor(() => expect($('#browse .pager')).not.toBe(null))
    const siguiente = [...document.querySelectorAll('#browse .pager button')].find((b) => /siguiente/i.test(b.textContent))
    siguiente.click()
    await vi.waitFor(() => expect(window.location.search).toContain('pag=2'))
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

// NAV-R11: el "Ver" de una fila hija navega a su permalink en vez de
// reemplazar media ficha con la del padre. Las pestañas y la tabla ya
// tienen su propio suite en browser.test.js; acá sólo se prueba el
// cableado real de "Ver".
describe('el "Ver" de una fila hija (NAV-R11)', () => {
  it('navega al permalink de esa fila en vez de reemplazar media ficha', async () => {
    await montar('?t=dep&c=06840')
    $('tbody tr .acts button').click()
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('t=frac'))
    expect(navigate.mock.calls[0][0]).toMatch(/c=\d{7}/)
  })

  it('no toca la ficha: la página se va, no se reescribe', async () => {
    await montar('?t=dep&c=06840')
    const antes = $('#detail-name').textContent
    $('tbody tr .acts button').click()
    expect($('#detail-name').textContent).toBe(antes)
  })

  it('ya no hay botón de volver: lo reemplaza el Atrás del navegador', async () => {
    await montar('?t=dep&c=06840')
    $('tbody tr .acts button').click()
    expect($('#back-to-object')).toBeNull()
  })

  it('el "Ver" de una vía tampoco pide la geometría: sólo navega (SITIO-R3)', async () => {
    await montar('?t=dep&c=06840&capa=vias')
    // La pestaña abre en su panel de costo; confirmarla para tener tabla.
    // `#browse button` sola es ambigua: las pestañas también son `<button>`
    // (ver tabs.js), así que hay que buscar la de "Cargar igual" por texto.
    ;[...document.querySelectorAll('#browse button')].find((b) => /cargar/i.test(b.textContent)).click()
    await vi.waitFor(() => expect($('tbody tr')).not.toBeNull())
    const antes = fetchSpy.mock.calls.length
    $('tbody tr .acts button').click()
    expect(fetchSpy.mock.calls.length).toBe(antes)
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('t=via'))
  })
})

describe('la ficha de una vía (SITIO-R3)', () => {
  // El mock de más arriba devuelve un solo feature: el caso de "en cuántos
  // tramos" necesita dos con el mismo `cod_indec`, así que esta pestaña
  // amplía el mock para la URL de vías sin tocar el resto de los tests.
  beforeEach(() => {
    fetchSpy = vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('catalog.json')) return { ok: true, json: async () => catalogo }
      const properties = { ...filaDeVerdad, cod_indec: '0684001001810' }
      return { ok: true, status: 200, json: async () => ({ totalFeatures: 2, features: [{ properties }, { properties }] }) }
    })
    global.fetch = fetchSpy
  })

  const pidioVias = () => fetchSpy.mock.calls
    .map(([u]) => String(u))
    .some((u) => u.includes('vias_de_circulacion'))

  it('no dispara ningún pedido de vías al montarse', async () => {
    await montar('?t=via&c=0684001001810')
    expect(pidioVias()).toBe(false)
  })

  // `initMap` corre con `#detail` todavía oculto y Leaflet mide 0×0. Las
  // demás fichas lo corrigen al dibujar (`beginRequest` llama
  // `invalidateSize`), pero la de una vía no dibuja nada hasta el clic: sin
  // un aviso aparte, el permalink de un tramo aterriza con el mapa en cero
  // píxeles en vez de la vista de Argentina.
  it('el mapa mide su tamaño real al destaparse la ficha, aunque no dibuje nada', async () => {
    await montar('?t=via&c=0684001001810')
    expect(pidioVias()).toBe(false)
    expect(mapaLeaflet.invalidateSize).toHaveBeenCalled()
  })

  it('muestra el costo medido y un botón para cargar igual', async () => {
    await montar('?t=via&c=0684001001810')
    expect($('#detail').textContent).toContain('12 segundos')
    expect($('#load-feature')).not.toBeNull()
  })

  it('la descarga funciona antes de pedir nada: sólo necesita el código', async () => {
    await montar('?t=via&c=0684001001810')
    expect($('#detail-self a').href).toContain('0684001001810')
  })

  it('muestra sus padres sin pedir nada: salen del código', async () => {
    await montar('?t=via&c=0684001001810')
    // Localidad censal 06840010, departamento 06840 y jurisdicción 06.
    expect($('#parents').children.length).toBe(3)
    expect(pidioVias()).toBe(false)
  })

  it('recién el botón dispara el pedido', async () => {
    await montar('?t=via&c=0684001001810')
    $('#load-feature').click()
    await vi.waitFor(() => expect(pidioVias()).toBe(true))
  })

  // Verificado el 2026-09-08: un `cod_indec` de vías identifica la calle, no
  // el tramo, y hasta 80 filas lo comparten. La ficha describe la calle.
  it('cargada, dice en cuántos tramos está partida la calle', async () => {
    await montar('?t=via&c=0684001001810')
    $('#load-feature').click()
    await vi.waitFor(() => expect($('#detail-meta').textContent).toContain('tramos'))
    // El fixture de vías tiene que devolver más de un feature para este caso:
    // si hoy devuelve uno solo, duplicalo en el mock con el mismo cod_indec.
    expect($('#detail-meta').textContent).toMatch(/partida en \d+ tramos/)
  })

  // Con el GeoServer del INDEC un corte de conexión es más probable que un
  // 500 (ver map.js), y este botón es la única acción de la página: si el
  // fallo lo deja apagado, la ficha queda sin salida.
  it('si el dibujo falla, el botón vuelve a ofrecer "Cargar igual" para reintentar', async () => {
    await montar('?t=via&c=0684001001810')
    global.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch') })

    const boton = $('#load-feature')
    boton.click()
    await vi.waitFor(() => expect(boton.disabled).toBe(true))
    expect(boton.textContent).toBe('Cargando…')

    await vi.waitFor(() => expect($('#status').textContent).toContain('No se pudo dibujar'))
    expect(boton.disabled).toBe(false)
    expect(boton.textContent).toBe('Cargar igual')
  })
})

describe('los enlaces a las notas (NOTA-R3)', () => {
  it('la ficha enlaza la nota del tipo del objeto', async () => {
    await montar('?t=dep&c=06840')
    expect(document.querySelector('.detail a[href*="/notas/#"]').getAttribute('href'))
      .toContain('#departamento')
  })

  it('cada pestaña enlaza la nota de su capa', async () => {
    await montar('?t=dep&c=06840&capa=radios')
    expect(document.querySelector('#browse a[href*="/notas/#"]').getAttribute('href'))
      .toContain('#radio-censal')
  })

  it('la fila de notas con pestañas ya no existe', async () => {
    await montar('?t=dep&c=06840')
    expect(document.querySelector('#row-notes')).toBeNull()
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

  it('capa=vias abre el panel de costo y no pide vías (NAV-R7, SITIO-R3)', async () => {
    await montar('?t=dep&c=06840&capa=vias')
    expect($('#browse').textContent).toContain('no tiene un índice útil')
    // `toHaveBeenCalledWith` compara la lista de argumentos entera y
    // `features.js` llama `fetch(url, { signal })` con dos: un solo matcher
    // no matchea nunca y el `not` pasaría siempre.
    expect(global.fetch.mock.calls.some(([u]) => String(u).includes('vias_de_circulacion'))).toBe(false)

    // La cuenta que afirma SITIO-R3, porque afirmarla sin gate es cómo la
    // regla envejeció dos veces: la página sí pide, lo que no pide es vías.
    // Son la página de la primera pestaña —abortada— y la geometría del
    // objeto para el mapa, que es la fila 1 y no depende de qué pestaña se
    // abrió.
    const capas = global.fetch.mock.calls
      .map(([u]) => decodeURIComponent(String(u).match(/typenames=([^&]+)/)?.[1] ?? ''))
      .filter(Boolean)
    expect(capas).toEqual(['geonode:fracciones_censales', 'geonode:departamentos'])
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

  // El caso hermano: una capa que no existe en ninguna parte. La página
  // hacía lo mismo que arriba —abrir la primera pestaña— pero dejaba la
  // barra intacta, así que seguía diciendo `capa=radioss`, una capa que no
  // se está mostrando, y "Copiar enlace" propagaba ese enlace roto.
  it('una capa que no existe también, en vez de dejar la barra mintiendo', async () => {
    await montar('?t=dep&c=06840&capa=radioss')
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

describe('la ficha de un objeto que no está en el catálogo', () => {
  // El mock por defecto siempre devuelve `filaDeVerdad` sin mirar el
  // filtro, con su propio cod_indec. Acá la fila que vuelve es el objeto
  // mismo de la ficha —selfUrl filtra por su código—, así que un GeoServer
  // de verdad la devuelve con ese código puesto; el mock tiene que hacer
  // lo mismo para no simular uno que ignora su propio CQL_FILTER.
  beforeEach(() => {
    global.fetch = vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('catalog.json')) return { ok: true, json: async () => catalogo }
      const codigo = u.match(/cod_indec%3D%27(\d+)%27/)?.[1]
      const properties = codigo ? { ...filaDeVerdad, cod_indec: codigo } : filaDeVerdad
      return { ok: true, status: 200, json: async () => ({ totalFeatures: 1, features: [{ properties }] }) }
    })
  })

  it('un radio se resuelve contra el GeoServer y muestra su identidad', async () => {
    await montar('?t=rad&c=068402311')
    expect($('#detail').hidden).toBe(false)
    expect($('#detail-name').textContent).toContain('068402311')
    expect($('#detail-self a')).not.toBeNull()
  })

  it('no muestra fila 3 ni bloque de capas hijas: un radio no contiene nada', async () => {
    await montar('?t=rad&c=068402311')
    expect($('#row-browse').hidden).toBe(true)
    expect($('#row-children').hidden).toBe(true)
  })

  it('muestra de qué forma parte, derivado del código', async () => {
    await montar('?t=rad&c=068402311')
    expect($('#row-parents').hidden).toBe(false)
    // Fracción 0684023 (sintética), departamento 06840 y jurisdicción 06.
    const filas = [...$('#parents').children]
    expect(filas).toHaveLength(3)

    // Fix round 1, hallazgo 2: la fracción sintética no tiene nombre
    // publicado (NAV-R4). `parentRow` tiene que usar el tipo como rótulo,
    // no dejar la fila en blanco con un separador colgando de la nada.
    const fraccion = filas[0].textContent
    expect(fraccion).toContain('Fracción censal')
    expect(fraccion).toContain('0684023')
    expect(fraccion.trimStart().startsWith('·')).toBe(false)
  })

  it('el buscador no queda diciendo "undefined"', async () => {
    await montar('?t=rad&c=068402311')
    expect($('#q').value).toBe('068402311')
  })

  it('un código con el largo de otro tipo muestra el buscador, no una ficha rota (SITIO-R4)', async () => {
    await montar('?t=rad&c=0684042')
    expect($('#detail').hidden).toBe(true)
    expect($('#status').classList.contains('error')).toBe(true)
  })
})
