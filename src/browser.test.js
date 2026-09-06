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

  // Corrección 3 al brief, que se la olvidó pedir: sin esto la fila que se
  // mandó al mapa se pierde de vista entre otras 19 iguales.
  describe('marca la fila que se está viendo', () => {
    it('al hacer clic en Ver, esa fila queda aria-selected y las demás no', async () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(dep)
      await vi.waitFor(() => expect(container.querySelector('tbody')).not.toBe(null))
      const trs = () => container.querySelectorAll('tbody tr')
      trs()[2].querySelector('button').click()

      expect(trs()[2].getAttribute('aria-selected')).toBe('true')
      expect([...trs()].filter((_, i) => i !== 2).every((tr) => tr.getAttribute('aria-selected') !== 'true')).toBe(true)
    })

    it('ver otra fila mueve la marca, no la duplica', async () => {
      global.fetch = vi.fn(async () => paginaOk())
      const b = createBrowser({ container, onView: () => {}, onError: () => {} })
      b.show(dep)
      await vi.waitFor(() => expect(container.querySelector('tbody')).not.toBe(null))
      const trs = () => container.querySelectorAll('tbody tr')
      trs()[2].querySelector('button').click()
      trs()[0].querySelector('button').click()

      expect(trs()[0].getAttribute('aria-selected')).toBe('true')
      expect(trs()[2].getAttribute('aria-selected')).toBe('false')
    })
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
})
