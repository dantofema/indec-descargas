import { createTabs } from './tabs.js'
import { fetchPage } from './features.js'
import { renderTable, renderPager } from './table.js'
import { nonEmptyChildrenOf } from './catalog.js'
import { childOf } from './download.js'
import { fmt, costPanel } from './ui.js'
import { noteFor, noteHref, NOTE_BY_LAYER } from './notes.js'

/**
 * Capas que no cargan solas al abrir su pestaña. Medido contra el
 * GeoServer real el 2026-09-06: una página de 20 vías tarda 14-20 s si el
 * filtro es un departamento, 17-18 s si es una localidad censal y 88-99 s
 * si es una provincia —no es el peso, son 477.588 filas sin índice útil—.
 * Auto-cargar esa pestaña colgaría la interfaz hasta minuto y medio sin que
 * el usuario haya pedido nada.
 */
const LAZY_KEYS = new Set(['vias'])

/**
 * El caso de la localidad censal no es un adorno: es el 58% de las fichas
 * donde este panel aparece —4.023 de los 6.977 objetos del catálogo, todas
 * con vías como única capa hija—, así que era justo el número que faltaba.
 */
const VIAS_COST_NOTICE = 'Esta capa no tiene un índice útil sobre sus 477.588 vías: '
  + 'una página de 20 filas tarda entre 14 y 20 segundos si el filtro es un '
  + 'departamento, entre 17 y 18 segundos si es una localidad censal, y entre '
  + '88 y 99 segundos si es una provincia.'

const VIAS_COST_REMINDER = 'Cada página que pidas de esta capa vuelve a costar lo mismo.'

/**
 * Cuánto se espera una página antes de darla por muerta. Un `fetch` sin
 * corte no falla nunca: si el GeoServer acepta la conexión y no contesta,
 * `load` deja "Cargando…" para siempre —el errorBox con Reintentar sólo
 * vive en el `catch`, y un pedido colgado no llega ahí—. Y no siempre hay a
 * dónde escapar: 4.023 de los 6.977 objetos del catálogo (58%) son
 * localidades censales con una sola capa hija, así que no hay otra pestaña
 * que clickear, y `tabs.js` corta el reclic sobre la activa.
 *
 * El resto de las capas —fracciones, radios, departamentos, localidades—
 * tarda 0,65-0,89 s medidos, así que 30 s les deja treinta veces de
 * headroom, sin distinguir tipo de padre.
 *
 * Vías es la única que hace falta partir por tipo de padre: post-review del
 * 2026-09-06 se midió que el peor caso no es parejo. Antes había un solo
 * plazo de 180 s para toda la capa, pensado para el peor caso de provincia;
 * el 58% del catálogo (las localidades censales) pagaba esa espera entera
 * —hasta 3 minutos— para enterarse de un colgado cuyo caso legítimo termina
 * en 18 s. Acá sí vale la pena partir: es un solo eje (tipo de padre) sobre
 * una sola capa, con los números ya medidos, no la tabla de dos dimensiones
 * que hubiera hecho falta para partir todas las capas por todos los padres:
 * - `jur`: 180 s. Es el padre del peor caso medido, 88-99 s por provincia,
 *   así que 180 s deja headroom ~1,8x.
 * - `aglo`: 180 s también, pero sin medir. Un aglomerado puede cubrir más
 *   área que un departamento y no hay dato que lo descarte, así que queda a
 *   propósito en el tier conservador de `jur` en vez de en el corto.
 * - `dep` y `loc`: 60 s. Peores casos medidos de 20 s y 18 s, headroom ~3x.
 */
const VIAS_TIMEOUT_MS = {
  jur: 180_000,
  aglo: 180_000,
  dep: 60_000,
  loc: 60_000,
}
const DEFAULT_TIMEOUT_MS = 30_000
const timeoutOf = (childKey, parentType) => {
  if (childKey !== 'vias') return DEFAULT_TIMEOUT_MS
  // Ningún objeto con vías debería caer acá —jur/dep/loc/aglo son los
  // únicos padres posibles—, pero si algo no medido llegara, el tier
  // conservador es el que no rompe la promesa de NAV-R8.
  return VIAS_TIMEOUT_MS[parentType] ?? VIAS_TIMEOUT_MS.aglo
}

/**
 * Medido contra el GeoServer real el 2026-09-06: traer una vía con geometría
 * tarda 12,4 s, contra 0,65 s en radios. Lo usa la ficha de una vía, que por
 * eso no pide nada al abrirse y muestra este costo con un botón (SITIO-R3).
 *
 * Vive en este módulo, que no lo consume, porque acá están todos los costos
 * medidos de vías del repo: partirlos en dos archivos es cómo divergen.
 */
export const VIAS_VIEW_NOTICE = 'El GeoServer tarda unos 12 segundos en traer la geometría de una vía.'

/**
 * La fila que se recorre: una pestaña por capa hija, y adentro la página que
 * se esté mirando. Guarda qué pestaña está activa, en qué página va cada una
 * y cuál fue el último pedido, para que una respuesta lenta de una pestaña
 * abandonada no pise a la que el usuario está mirando.
 *
 * `show` devuelve si dibujó algo: quién puede recorrerse lo decide esta
 * fila, no quien la cablea. Duplicar la decisión afuera es cómo aparece una
 * fila visible y vacía.
 *
 * `onTab` avisa qué pestaña quedó activa —la primera al abrir, y cada
 * cambio después—. El browser no sabe que existe una URL: la página que lo
 * cablea es la que decide qué hacer con ese aviso.
 *
 * `onPage` avisa desde `load`, antes del `await fetchPage(...)`: el aviso
 * llega cuando la página se pide de verdad, no cuando termina de cargar
 * —ese pedido todavía puede abortarse o fallar—. El browser no sabe que
 * existe una URL, sólo qué se está pidiendo.
 */
export function createBrowser({ container, onView, onError, onTab = () => {}, onPage = () => {} }) {
  let obj = null
  let active = null
  let pages = new Map()
  // Capas lentas que el usuario ya aceptó cargar para el objeto actual.
  let confirmed = new Set()
  let token = 0
  let body = null
  let noteBox = null
  // El pedido en vuelo, para poder abortarlo y no sólo ignorarlo.
  let inFlight = null

  /**
   * Corta el pedido que haya en vuelo. Descartar la respuesta no alcanza:
   * la conexión abandonada sigue ocupando una de las ~6 que el browser
   * permite por origen, y el mapa pide al mismo origen.
   */
  function abortInFlight(reason) {
    inFlight?.abort(new Error(reason))
    inFlight = null
  }

  /**
   * `initialLayer` es la capa que pide la URL. Se abre sólo si el objeto la
   * tiene y no está en cero: una capa que no es pestaña dejaría la fila
   * mostrando un panel vacío, y caer en la primera es mejor respuesta que
   * un error (lo mismo que hace `permalink.parse` con una capa que no
   * existe).
   */
  function show(next, initialLayer = null, initialPage = 0) {
    abortInFlight('se eligió otro objeto')
    obj = next
    active = null
    pages = new Map()
    confirmed = new Set()
    token += 1
    container.replaceChildren()

    // La página inicial es de la capa que el enlace nombró y de ninguna
    // otra: sembrarla en todas haría que cambiar de pestaña arrancara en la
    // página 4 de una capa que nadie pidió.
    if (initialLayer && initialPage > 0) pages.set(initialLayer, initialPage)

    // Sin los ceros: una pestaña "Vías de circulación 0" ofrece recorrer lo
    // que no existe, y su panel de costo cobra 17 s medidos por una página
    // vacía (ver `nonEmptyChildrenOf`).
    const kids = nonEmptyChildrenOf(obj)
    if (!kids.length) return false

    const tabsBox = document.createElement('div')
    // Enlace a la nota de la capa activa (NOTA-R3): va arriba de la tabla,
    // como hermano de `body` y no adentro, así ningún `body.replaceChildren`
    // de `load`/`costPane`/`errorBox` se lo lleva puesto —sigue visible
    // mientras la página carga o si falla—.
    noteBox = document.createElement('p')
    noteBox.className = 'note-link'
    body = document.createElement('div')
    body.className = 'pane'
    container.append(tabsBox, noteBox, body)

    const tabs = createTabs({
      container: tabsBox,
      items: kids.map(({ key, count }) => ({
        key, label: childOf(key).label, badge: fmt(count),
      })),
      onSelect: (key) => {
        active = key
        onTab(key)
        noteBox.replaceChildren(layerNoteLink(key))
        if (LAZY_KEYS.has(key) && !confirmed.has(key)) {
          // Este camino no pasa por `load()` —muestra el panel de costo, no
          // pide nada—, pero es tan "cambiar de pestaña" como cualquier
          // otro: si había un pedido en vuelo en la anterior, NAV-R8 promete
          // que se aborta, no que se lo deja morir de su propio timeout.
          abortInFlight('se cambió a una pestaña que no auto-carga')
          body.replaceChildren(costPane(key))
          return
        }
        load(key, pages.get(key) ?? 0)
      },
    })

    // `createTabs` ya seleccionó la primera al construirse, y corta el
    // reclic sobre la activa: pedir la primera explícitamente no dispara
    // nada de más, y pedir otra aborta el pedido de la primera (NAV-R8).
    if (kids.some(({ key }) => key === initialLayer)) tabs.select(initialLayer)
    return true
  }

  /** El enlace "Qué es..." de la capa que se está recorriendo (NOTA-R3). */
  function layerNoteLink(key) {
    const a = document.createElement('a')
    const slug = NOTE_BY_LAYER[key]
    a.href = noteHref(slug)
    a.textContent = `Qué es ${noteFor(slug).label.toLowerCase()} →`
    return a
  }

  /** El costo medido y el botón para cargar la página igual. */
  function costPane(key) {
    return costPanel({
      message: VIAS_COST_NOTICE,
      onClick: () => {
        confirmed.add(key)
        load(key, pages.get(key) ?? 0)
      },
    })
  }

  async function load(key, page) {
    abortInFlight('empezó otro pedido')
    const mine = (token += 1)
    const ms = timeoutOf(key, obj.t)
    const controller = new AbortController()
    inFlight = controller
    // El corte llega como abort, no como una carrera aparte: así el pedido
    // que se da por muerto además muere, en vez de seguir vivo sin dueño.
    const timer = setTimeout(
      () => controller.abort(new Error(`el GeoServer no contestó en ${ms / 1000} segundos`)),
      ms,
    )
    pages.set(key, page)
    onPage(key, page)
    body.replaceChildren(metaParagraph('Cargando…'))
    try {
      const { rows, total } = await fetchPage(obj, key, page, controller.signal)
      // Llegó tarde: el usuario ya está en otra pestaña o en otra página.
      if (mine !== token || key !== active) return

      const tableEl = renderTable(key, rows, (row, childKey) => onView(row, childKey))
      const panels = [tableEl, renderPager({ page, total, count: rows.length, onPage: (p) => load(key, p) })]
      if (LAZY_KEYS.has(key)) panels.push(metaParagraph(VIAS_COST_REMINDER))
      body.replaceChildren(...panels)
    } catch (err) {
      // Un aborto propio ya perdió la carrera por definición: el guard de
      // abajo lo silencia, porque `token` avanzó antes de abortar.
      if (mine !== token || key !== active) return
      body.replaceChildren(errorBox(err, () => load(key, page)))
      onError(err)
    } finally {
      clearTimeout(timer)
      if (inFlight === controller) inFlight = null
    }
  }

  function metaParagraph(texto) {
    const p = document.createElement('p')
    p.className = 'meta'
    p.textContent = texto
    return p
  }

  function errorBox(err, retry) {
    const wrap = document.createElement('div')
    const p = document.createElement('p')
    p.className = 'status error'
    p.textContent = `No se pudo traer la lista: ${err.message}`
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'btn ghost mini retry'
    b.textContent = 'Reintentar'
    b.addEventListener('click', retry)
    wrap.append(p, b)
    return wrap
  }

  return { show }
}
