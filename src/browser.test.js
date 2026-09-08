// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBrowser } from './browser.js'

const dep = {
  t: 'dep', c: '06840', n: 'Tres de Febrero',
  ch: { fracciones: 42, radios: 432 },
}

// Departamento con vías, para ejercitar la corrección 2 del brief sin que
// las otras pestañas (que sí auto-cargan) se metan en el medio.
const depVias = {
  t: 'dep', c: '06840', n: 'Tres de Febrero',
  ch: { fracciones: 42, vias: 1487 },
}

let container
const filas = (n, desde = 0) => Array.from({ length: n }, (_, i) => ({
  cod_indec: String(68400101 + desde + i), cro: '01', cfn: '01', tro: 'U',
}))

const paginaOk = (total = 42, n = 20) => ({
  ok: true,
  json: async () => ({ totalFeatures: total, features: filas(n).map((p) => ({ properties: p })) }),
})

const boton = (texto) => [...container.querySelectorAll('button')]
  .find((b) => b.textContent.match(texto))

/**
 * Un fetch que no contesta nunca y sólo se rinde si le abortan el signal,
 * que es lo que hace el `fetch` de verdad. Un GeoServer que acepta la
 * conexión y se queda callado es exactamente esto.
 */
const fetchColgado = () => vi.fn((_url, opts) => new Promise((_resolve, reject) => {
  opts?.signal?.addEventListener('abort', () => reject(opts.signal.reason))
}))

beforeEach(() => {
  document.body.innerHTML = '<div id="c"></div>'
  container = document.querySelector('#c')
})

describe('createBrowser', () => {
  it('dibuja una pestaña por capa hija y carga la primera', async () => {
    global.fetch = vi.fn(async () => paginaOk())
    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show(dep)
    await vi.waitFor(() => expect(container.querySelector('tbody')).not.toBe(null))
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('pasar de página pide la página siguiente', async () => {
    global.fetch = vi.fn(async () => paginaOk())
    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show(dep)
    await vi.waitFor(() => expect(container.querySelector('.pager')).not.toBe(null))
    container.querySelectorAll('.pager button')[1].click()
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(global.fetch.mock.calls[1][0]).toContain('startIndex=20')
  })

  // La carrera más fácil de provocar: cambiar de pestaña con un pedido en
  // vuelo. La respuesta vieja no puede pisar a la nueva.
  it('descarta la respuesta de una pestaña que ya se abandonó', async () => {
    let resolverPrimero
    global.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => { resolverPrimero = r }))
      .mockImplementationOnce(async () => ({ ok: true, json: async () => ({ totalFeatures: 1, features: [{ properties: { cod_indec: '999', cro: '99', cfn: '99', tro: 'R' } }] }) }))

    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show(dep)
    container.querySelectorAll('[role="tab"]')[1].click()
    await vi.waitFor(() => expect(container.textContent).toContain('999'))

    resolverPrimero({ ok: true, json: async () => ({ totalFeatures: 42, features: filas(20).map((p) => ({ properties: p })) }) })
    await new Promise((r) => setTimeout(r, 0))
    expect(container.textContent).toContain('999')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  // Segundo escenario de carrera (fix round 1, hallazgo 2): pasar de página
  // con un pedido en vuelo. Con vías tardando hasta 99 s, un doble clic en
  // "Siguiente" antes de que responda el primero no es hipotético.
  it('pasar de página con un pedido en vuelo: la vieja no pisa la nueva', async () => {
    let resolverPrimerClic
    global.fetch = vi.fn()
      .mockImplementationOnce(async () => paginaOk(42, 20)) // carga inicial: página 0
      .mockImplementationOnce(() => new Promise((r) => { resolverPrimerClic = r })) // 1er clic en Siguiente
      .mockImplementationOnce(async () => ({ ok: true, json: async () => ({ totalFeatures: 42, features: [{ properties: { cod_indec: '555', cfn: '02' } }] }) })) // 2do clic

    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show(dep)
    await vi.waitFor(() => expect(container.querySelector('.pager')).not.toBe(null))

    // La misma referencia del botón: sus listeners siguen vivos aunque el
    // `replaceChildren` de la carga la haya desconectado del documento.
    const siguiente = container.querySelectorAll('.pager button')[1]
    siguiente.click() // pide la página 1: queda colgada
    siguiente.click() // el usuario clickea de nuevo antes de que responda

    await vi.waitFor(() => expect(container.textContent).toContain('555'))

    resolverPrimerClic({ ok: true, json: async () => ({ totalFeatures: 42, features: filas(20, 20).map((p) => ({ properties: p })) }) })
    await new Promise((r) => setTimeout(r, 0))
    expect(container.textContent).toContain('555')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  // Tercer escenario de carrera (fix round 1, hallazgo 2): elegir otro
  // objeto en el buscador con un pedido en vuelo. Las dos capas coinciden
  // en clave ('fracciones') a propósito: si el guardia dependiera sólo de
  // comparar la pestaña activa, esto lo pasaría igual.
  it('elegir otro objeto con un pedido en vuelo descarta la respuesta vieja', async () => {
    let resolverPrimero
    global.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => { resolverPrimero = r })) // fracciones de `dep`
      .mockImplementationOnce(async () => ({ ok: true, json: async () => ({ totalFeatures: 1, features: [{ properties: { cod_indec: '777', cfn: '01' } }] }) })) // fracciones de `otroDep`

    const otroDep = { t: 'dep', c: '82084', n: 'Rosario', ch: { fracciones: 10 } }
    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show(dep) // pide fracciones de `dep`: queda colgada
    b.show(otroDep) // el usuario elige otro objeto antes de que responda

    await vi.waitFor(() => expect(container.textContent).toContain('777'))

    resolverPrimero({ ok: true, json: async () => ({ totalFeatures: 42, features: filas(20).map((p) => ({ properties: p })) }) })
    await new Promise((r) => setTimeout(r, 0))
    expect(container.textContent).toContain('777')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  it('un error del GeoServer se muestra en el lugar de la tabla, con reintento', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 503 }))
    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show(dep)
    await vi.waitFor(() => expect(container.textContent).toMatch(/503/))
    expect(container.querySelector('button.retry')).not.toBe(null)
  })

  it('un objeto sin hijos no dibuja nada', () => {
    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show({ t: 'gl', c: '060840', n: 'x' })
    expect(container.children).toHaveLength(0)
  })

  // Corrección 1 al brief: `renderTable` ya llama `onView(row, childKey)`
  // (ver table.js): browser.js no inventa nada, sólo lo deja pasar tal cual.
  it('Ver avisa con la fila entera y de qué pestaña salió', async () => {
    global.fetch = vi.fn(async () => paginaOk())
    const onView = vi.fn()
    const b = createBrowser({ container, onView, onError: () => {} })
    b.show(dep)
    await vi.waitFor(() => expect(container.querySelector('tbody')).not.toBe(null))
    container.querySelectorAll('tbody tr button')[1].click()
    expect(onView).toHaveBeenCalledWith(filas(20)[1], 'fracciones')
  })

  // Corrección 2 al brief: medido contra el GeoServer real el 2026-09-06,
  // una página de vías tarda 14-20 s por departamento y 88-99 s por
  // provincia. Auto-cargarla colgaría la interfaz sin que nadie lo pida.
  describe('la pestaña de vías no auto-carga', () => {
    it('al abrirla no pide nada: muestra el costo medido y un botón', () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(depVias) // dispara el auto-carga de la primera pestaña: fracciones
      const llamadasAntes = global.fetch.mock.calls.length
      container.querySelectorAll('[role="tab"]')[1].click() // la de vías

      expect(global.fetch).toHaveBeenCalledTimes(llamadasAntes)
      expect(container.textContent).toMatch(/20 segundos/)
      expect(container.textContent).toMatch(/99 segundos/)
      // Fix round 3: el 58% de las fichas donde aparece este panel son
      // localidades censales, y ese caso faltaba en el aviso. Medido el
      // 2026-09-06: clc=06840010 dio 18,0 s y clc=82084010 dio 17,2 s.
      expect(container.textContent).toMatch(/localidad/i)
      expect(container.textContent).toMatch(/1[78] (y 18 )?segundos/)
      expect(boton(/cargar/i)).not.toBe(undefined)
    })

    it('recién con el clic en el botón se pide la página', async () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(depVias)
      container.querySelectorAll('[role="tab"]')[1].click()
      const llamadasAntes = global.fetch.mock.calls.length
      boton(/cargar/i).click()

      await vi.waitFor(() => expect(container.querySelector('tbody')).not.toBe(null))
      expect(global.fetch).toHaveBeenCalledTimes(llamadasAntes + 1)
    })

    it('las demás pestañas siguen auto-cargando, aunque vías esté al lado', async () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(depVias)
      await vi.waitFor(() => expect(container.querySelector('tbody')).not.toBe(null))
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('una vez confirmada, volver a la pestaña no vuelve a preguntar', async () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      const tabs = () => container.querySelectorAll('[role="tab"]')
      b.show(depVias)

      // El auto-carga de fracciones ya usó una llamada al abrir depVias.
      tabs()[1].click()
      boton(/cargar/i).click()
      await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))

      tabs()[0].click() // vuelve a fracciones
      await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3))

      tabs()[1].click() // vuelve a vías: ya la confirmó, carga directo
      await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4))
      expect(boton(/cargar/i)).toBe(undefined)
    })

    it('mostrar un objeto nuevo vuelve a pedir confirmación', () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(depVias)
      container.querySelectorAll('[role="tab"]')[1].click()
      boton(/cargar/i).click()

      b.show(depVias)
      container.querySelectorAll('[role="tab"]')[1].click()
      expect(boton(/cargar/i)).not.toBe(undefined)
    })

    it('cada página cargada repite que cuesta lo mismo', async () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(depVias)
      container.querySelectorAll('[role="tab"]')[1].click()
      boton(/cargar/i).click()

      await vi.waitFor(() => expect(container.querySelector('tbody')).not.toBe(null))
      expect(container.textContent).toMatch(/cada página/i)
    })
  })

  // Fix round 3, hallazgo 2: ningún fetch del repo tenía timeout. Si el
  // GeoServer acepta la conexión y no contesta, `load` deja "Cargando…"
  // para siempre: el errorBox con Reintentar sólo vive en el `catch` y un
  // pedido colgado nunca llega ahí. Y el 58% del catálogo son localidades
  // censales con una sola pestaña (vías), así que no hay ni siquiera otra
  // pestaña a la que escapar.
  describe('un pedido que no vuelve', () => {
    it('corta solo y deja el errorBox con Reintentar', async () => {
      vi.useFakeTimers()
      try {
        global.fetch = fetchColgado()
        const b = createBrowser({ container, onView: () => {}, onError: () => {} })
        b.show(dep)
        expect(container.textContent).toMatch(/Cargando/)

        await vi.advanceTimersByTimeAsync(29_000)
        expect(container.textContent).toMatch(/Cargando/)

        await vi.advanceTimersByTimeAsync(2_000)
        expect(container.querySelector('button.retry')).not.toBe(null)
        expect(container.textContent).toMatch(/no contestó/)
      } finally {
        vi.useRealTimers()
      }
    })

    it('avisa el error una sola vez, por la vía de onError', async () => {
      vi.useFakeTimers()
      try {
        global.fetch = fetchColgado()
        const onError = vi.fn()
        const b = createBrowser({ container, onView: () => {}, onError })
        b.show(dep)
        await vi.advanceTimersByTimeAsync(31_000)
        expect(onError).toHaveBeenCalledTimes(1)
      } finally {
        vi.useRealTimers()
      }
    })

    // El corte tiene que quedar por encima del peor caso legítimo medido:
    // una página de vías filtrada por provincia (padre `jur`) tarda 88-99 s.
    // Con el mismo corte que el resto de las capas, esa espera legítima
    // daría error.
    it('en vías, con padre jur, espera más que las 99 s medidas antes de darla por muerta', async () => {
      vi.useFakeTimers()
      try {
        global.fetch = fetchColgado()
        const b = createBrowser({ container, onView: () => {}, onError: () => {} })
        const jurVias = { t: 'jur', c: '06', n: 'Buenos Aires', ch: { fracciones: 135, vias: 45000 } }
        b.show(jurVias)
        container.querySelectorAll('[role="tab"]')[1].click() // vías
        boton(/cargar/i).click()

        await vi.advanceTimersByTimeAsync(120_000)
        expect(container.textContent).toMatch(/Cargando/)

        await vi.advanceTimersByTimeAsync(61_000)
        expect(container.querySelector('button.retry')).not.toBe(null)
      } finally {
        vi.useRealTimers()
      }
    })

    // Post-review, arreglo B: 4.023 de 6.977 objetos del catálogo (58%) son
    // localidades censales con vías como única capa, y su peor caso medido
    // es 17-18 s. Esperar los 180 s pensados para el caso de provincia deja
    // ese 58% del catálogo hasta 3 minutos para enterarse de un colgado. El
    // padre `loc` (y `dep`) usa un plazo corto de 60 s en cambio.
    it('en vías, con padre loc, corta a los 60 s y no espera los 180 s de jur', async () => {
      vi.useFakeTimers()
      try {
        global.fetch = fetchColgado()
        const b = createBrowser({ container, onView: () => {}, onError: () => {} })
        const locVias = { t: 'loc', c: '06840010', n: 'Ciudadela', ch: { vias: 300 } }
        b.show(locVias) // vías es la única pestaña: se auto-selecciona, sin auto-cargar
        boton(/cargar/i).click()

        await vi.advanceTimersByTimeAsync(59_000)
        expect(container.textContent).toMatch(/Cargando/)

        await vi.advanceTimersByTimeAsync(2_000)
        expect(container.querySelector('button.retry')).not.toBe(null)
      } finally {
        vi.useRealTimers()
      }
    })

    it('reintentar arranca un pedido nuevo, con su propio corte', async () => {
      vi.useFakeTimers()
      try {
        global.fetch = fetchColgado()
        const b = createBrowser({ container, onView: () => {}, onError: () => {} })
        b.show(dep)
        await vi.advanceTimersByTimeAsync(31_000)

        container.querySelector('button.retry').click()
        expect(container.textContent).toMatch(/Cargando/)
        expect(global.fetch).toHaveBeenCalledTimes(2)

        await vi.advanceTimersByTimeAsync(31_000)
        expect(container.querySelector('button.retry')).not.toBe(null)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  // El pedido abandonado no se descarta nomás: se aborta. Sin eso, cada
  // reintento suma una conexión viva contra geonode.indec.gob.ar, el
  // browser corta en ~6 por origen y el mapa —que pide al mismo origen—
  // deja de dibujar. La falla de la fila 3 se propaga a la fila 1.
  describe('el pedido abandonado se aborta', () => {
    const señales = () => global.fetch.mock.calls.map(([, opts]) => opts.signal)

    it('cambiar de pestaña aborta el pedido de la anterior', () => {
      global.fetch = fetchColgado()
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(dep)
      container.querySelectorAll('[role="tab"]')[1].click()

      expect(señales()[0].aborted).toBe(true)
      expect(señales()[1].aborted).toBe(false)
    })

    it('pasar de página aborta el pedido de la página anterior', async () => {
      global.fetch = vi.fn()
        .mockImplementationOnce(async () => paginaOk(42, 20))
        .mockImplementation((_url, opts) => new Promise((_r, reject) => {
          opts?.signal?.addEventListener('abort', () => reject(opts.signal.reason))
        }))
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(dep)
      await vi.waitFor(() => expect(container.querySelector('.pager')).not.toBe(null))

      const siguiente = container.querySelectorAll('.pager button')[1]
      siguiente.click()
      siguiente.click()

      expect(señales()[1].aborted).toBe(true)
      expect(señales()[2].aborted).toBe(false)
    })

    it('elegir otro objeto aborta el pedido en vuelo', () => {
      global.fetch = fetchColgado()
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(dep)
      b.show({ t: 'dep', c: '82084', n: 'Rosario', ch: { fracciones: 10 } })

      expect(señales()[0].aborted).toBe(true)
      expect(señales()[1].aborted).toBe(false)
    })

    // Post-review, arreglo A: el camino a vías sin confirmar vuelve antes de
    // `load()` (muestra el panel de costo), y `load()` es el único lugar
    // donde vivía `abortInFlight`. Un pedido en vuelo en la pestaña anterior
    // no se cortaba al pasar a vías: sobrevivía hasta que venciera su propio
    // timeout, contradiciendo a NAV-R8 ("todo pedido que se abandona... se
    // aborta").
    it('cambiar a la pestaña de vías sin confirmar aborta el pedido de la anterior', () => {
      global.fetch = fetchColgado()
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(depVias) // auto-carga fracciones: queda colgada
      container.querySelectorAll('[role="tab"]')[1].click() // vías, lazy y sin confirmar

      expect(señales()[0].aborted).toBe(true)
    })

    // Un objeto sin capas hijas no dibuja nada y sale temprano: si el
    // aborto viviera sólo en `load`, ese camino dejaría el pedido vivo.
    it('elegir un objeto sin hijos también aborta el pedido en vuelo', () => {
      global.fetch = fetchColgado()
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(dep)
      b.show({ t: 'gl', c: '060840', n: 'Tres de Febrero' })

      expect(señales()[0].aborted).toBe(true)
    })
  })

  // Fix round 3, hallazgo 3: con `ch: {vias: 0}` —11 pares (objeto, capa)
  // del catálogo, Grytviken entre ellos— la fila 3 abría igual una pestaña
  // "Vías de circulación 0", con el panel de costo avisando 88-99 segundos
  // y un botón "Cargar igual" que disparaba un pedido real. Medido: ese
  // pedido tarda 17 s y vuelve con totalFeatures 0. El usuario paga la
  // espera entera para no recibir nada que la fila 2 no le diga gratis.
  describe('una capa con conteo cero no se recorre', () => {
    const grytviken = { t: 'loc', c: '94021040', n: 'Grytviken', ch: { vias: 0 } }

    it('no dibuja nada ni pide nada si todas sus capas están vacías', () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(grytviken)

      expect(container.children).toHaveLength(0)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('avisa que no dibujó nada, para que la fila entera se pueda ocultar', () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      expect(b.show(grytviken)).toBe(false)
      expect(b.show(dep)).toBe(true)
    })

    it('saca sólo la pestaña vacía, y deja las que tienen objetos', async () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show({ t: 'dep', c: '94028', n: 'Antártida Argentina', ch: { fracciones: 3, localidades: 0, vias: 0 } })
      await vi.waitFor(() => expect(container.querySelector('tbody')).not.toBe(null))

      const pestañas = [...container.querySelectorAll('[role="tab"]')]
      expect(pestañas).toHaveLength(1)
      expect(pestañas[0].textContent).toContain('Fracciones')
    })
  })

  // Fix round 3, hallazgo menor: una fila sin `cod_indec` hacía tirar
  // `renderTable`, y el `try` de `load` lo convertía en "No se pudo traer la
  // lista" —culpando a la red cuando el fetch salió bien— con un Reintentar
  // condenado a fallar siempre.
  it('una fila sin código no se disfraza de error de red', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        totalFeatures: 2,
        features: [
          { properties: { cod_indec: null, cro: '07', cfn: '01', tro: 'U' } },
          { properties: { cod_indec: '068400102', cro: '02', cfn: '01', tro: 'R' } },
        ],
      }),
    }))
    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show(dep)
    await vi.waitFor(() => expect(container.querySelector('tbody')).not.toBe(null))

    expect(container.querySelector('button.retry')).toBe(null)
    expect(container.textContent).not.toMatch(/no se pudo traer la lista/i)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(container.textContent).toMatch(/sin código/i)
  })

  // Task 8: /resultados/ abre la capa que dice la URL. El browser no sabe
  // nada de la URL —sólo recibe qué capa abrir y avisa cuál quedó abierta—,
  // pero sin estas dos puntas la barra y la pestaña no se pueden atar.
  describe('la capa inicial y el aviso de qué pestaña quedó activa', () => {
    const crearBrowserDePrueba = ({ onTab } = {}) => createBrowser({
      container, onView: () => {}, onError: () => {}, ...(onTab ? { onTab } : {}),
    })

    const pestañaActiva = () => container
      .querySelector('[role="tab"][aria-selected="true"]')
      ?.firstChild.textContent

    beforeEach(() => { global.fetch = vi.fn(async () => paginaOk()) })

    it('abre la capa que se le pide en vez de la primera', () => {
      const b = crearBrowserDePrueba()
      b.show(dep, 'radios')
      expect(pestañaActiva()).toBe('Radios censales')
    })

    it('una capa que el objeto no tiene cae en la primera, no en una pestaña vacía', () => {
      const b = crearBrowserDePrueba()
      b.show(dep, 'departamentos')
      expect(pestañaActiva()).toBe('Fracciones censales')
    })

    // Una capa en cero no es pestaña (NAV-R9): pedirla por URL tiene que
    // caer en la primera, no dejar la fila con una pestaña que no existe.
    it('una capa en cero tampoco se abre: cae en la primera', () => {
      const b = crearBrowserDePrueba()
      b.show({ t: 'dep', c: '94028', n: 'Antártida Argentina', ch: { fracciones: 3, vias: 0 } }, 'vias')
      expect(pestañaActiva()).toBe('Fracciones censales')
    })

    it('sin capa pedida sigue abriendo la primera, como siempre', () => {
      const b = crearBrowserDePrueba()
      b.show(dep)
      expect(pestañaActiva()).toBe('Fracciones censales')
    })

    it('avisa qué pestaña quedó activa, para que la URL la pueda guardar', () => {
      const onTab = vi.fn()
      const b = crearBrowserDePrueba({ onTab })
      b.show(dep, 'radios')
      expect(onTab).toHaveBeenCalledWith('radios')
    })

    it('también avisa la primera, cuando nadie pidió ninguna', () => {
      const onTab = vi.fn()
      const b = crearBrowserDePrueba({ onTab })
      b.show(dep)
      expect(onTab).toHaveBeenCalledWith('fracciones')
    })

    it('avisa cada vez que el usuario cambia de pestaña', () => {
      const onTab = vi.fn()
      const b = crearBrowserDePrueba({ onTab })
      b.show(dep)
      onTab.mockClear()
      container.querySelectorAll('[role="tab"]')[1].click()
      expect(onTab).toHaveBeenCalledWith('radios')
    })

    // NAV-R7 llega hasta acá: un enlace con `capa=vias` abre el panel de
    // costo, no le cobra al que lo abre hasta 99 s que nunca pidió.
    it('la capa lenta pedida por URL abre el panel de costo y no la pide', () => {
      const b = crearBrowserDePrueba()
      b.show(depVias, 'vias')
      expect(container.textContent).toMatch(/99 segundos/)
      expect(boton(/cargar/i)).not.toBe(undefined)
      const pedidas = global.fetch.mock.calls.map(([url]) => String(url))
      expect(pedidas.filter((u) => u.includes('vias_de_circulacion'))).toEqual([])
    })

    it('sin onTab no se rompe: es opcional', () => {
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      expect(() => b.show(dep, 'radios')).not.toThrow()
    })
  })

  // NOTA-R3: la pestaña activa es la única que sabe qué capa se está
  // recorriendo, así que el enlace a su nota vive acá y no en la página que
  // cablea. Va como hermano de `body`, no adentro: ningún reemplazo de
  // `body` —"Cargando…", el errorBox o el panel de costo— se lo lleva puesto.
  describe('el enlace a la nota de la pestaña activa', () => {
    const enlaceNota = () => container.querySelector('a[href*="/notas/#"]')

    it('enlaza la nota de la primera pestaña, antes de que la tabla llegue', () => {
      global.fetch = vi.fn(() => new Promise(() => {})) // no resuelve en este test
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(dep) // fracciones es la primera pestaña de `dep`
      expect(container.textContent).toMatch(/Cargando/)
      expect(enlaceNota().getAttribute('href')).toContain('#fraccion-censal')
    })

    it('cambiar de pestaña cambia el enlace, sin acumularlo', async () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(dep)
      await vi.waitFor(() => expect(container.querySelector('tbody')).not.toBe(null))

      container.querySelectorAll('[role="tab"]')[1].click() // radios
      expect(container.querySelectorAll('a[href*="/notas/#"]')).toHaveLength(1)
      expect(enlaceNota().getAttribute('href')).toContain('#radio-censal')
    })

    it('sigue visible si la página falla', async () => {
      vi.useFakeTimers()
      try {
        global.fetch = fetchColgado()
        const b = createBrowser({ container, onView: () => {}, onError: () => {} })
        b.show(dep)
        await vi.advanceTimersByTimeAsync(31_000)
        expect(container.querySelector('button.retry')).not.toBe(null)
        expect(enlaceNota().getAttribute('href')).toContain('#fraccion-censal')
      } finally {
        vi.useRealTimers()
      }
    })

    it('en la capa lenta, el panel de costo tampoco se lleva el enlace', () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(depVias)
      container.querySelectorAll('[role="tab"]')[1].click() // vías
      expect(container.textContent).toMatch(/no tiene un índice útil/)
      expect(enlaceNota().getAttribute('href')).toContain('#via-de-circulacion')
    })
  })

  // Task 6: el permalink recuerda la página, no sólo la pestaña. Sin esto el
  // Atrás del navegador (Task 4) devolvería a la página 1 de la tabla en vez
  // de a la que se estaba mirando, una regresión respecto del botón "Volver
  // a <objeto>" que reemplazó.
  describe('la página inicial y el aviso de cambio de página', () => {
    beforeEach(() => { global.fetch = vi.fn(async () => paginaOk()) })

    it('abre la pestaña en la página que le piden', async () => {
      const browser = createBrowser({ container, onView: () => {}, onError: () => {}, onPage: () => {} })
      browser.show(dep, 'radios', 3)
      // `dep` tiene dos pestañas: la primera (fracciones) se auto-selecciona
      // y pide su página 0 antes de que el `select` explícito la aborte y
      // pida radios (NAV-R8) — por eso se busca el pedido de radios en vez
      // de asumir que es el primero de la lista.
      await vi.waitFor(() => {
        const radios = global.fetch.mock.calls.map(([u]) => String(u)).find((u) => u.includes('radios_censales2'))
        expect(radios).toContain('startIndex=60')
      })
    })

    it('avisa cada cambio de página', async () => {
      const onPage = vi.fn()
      const browser = createBrowser({ container, onView: () => {}, onError: () => {}, onPage })
      browser.show(dep, 'radios')
      await vi.waitFor(() => expect(container.querySelector('.pager')).not.toBeNull())
      boton('Siguiente').click()
      await vi.waitFor(() => expect(onPage).toHaveBeenCalledWith('radios', 1))
    })

    // SITIO-R3: recordar la página no es motivo para pedirla.
    it('una página inicial de vías no dispara ningún pedido', async () => {
      const browser = createBrowser({ container, onView: () => {}, onError: () => {}, onPage: () => {} })
      browser.show(depVias, 'vias', 3)
      await vi.waitFor(() => expect(boton('Cargar igual')).not.toBeNull())
      // `depVias` también tiene una primera pestaña (fracciones) que se
      // auto-carga sola, ajena a vías: lo que SITIO-R3 prohíbe es el pedido
      // de vías, no cualquier pedido (mismo patrón que el test ya existente
      // "la capa lenta pedida por URL abre el panel de costo y no la pide").
      const pedidasVias = global.fetch.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('vias_de_circulacion'))
      expect(pedidasVias).toEqual([])
    })
  })
})
