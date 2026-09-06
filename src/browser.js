import { createTabs } from './tabs.js'
import { fetchPage } from './features.js'
import { renderTable, renderPager } from './table.js'
import { childrenOf } from './catalog.js'
import { CHILD_LAYERS } from './download.js'
import { fmt } from './ui.js'

/**
 * Capas que no cargan solas al abrir su pestaña. Medido contra el
 * GeoServer real el 2026-09-06: una página de 20 vías tarda 14-20 s si el
 * filtro es un departamento y 88-99 s si es una provincia —no es el peso,
 * son 477.588 filas sin índice útil—. Auto-cargar esa pestaña colgaría la
 * interfaz hasta minuto y medio sin que el usuario haya pedido nada.
 */
const LAZY_KEYS = new Set(['vias'])

const VIAS_COST_NOTICE = 'Esta capa no tiene un índice útil sobre sus 477.588 vías: '
  + 'una página de 20 filas tarda entre 14 y 20 segundos si el filtro es un '
  + 'departamento, y entre 88 y 99 segundos si es una provincia.'

const VIAS_COST_REMINDER = 'Cada página que pidas de esta capa vuelve a costar lo mismo.'

/**
 * Medido contra el GeoServer real el 2026-09-06: un solo feature con
 * geometría —lo que pide el botón "Ver"— tarda 12,4 s en vías, contra
 * 0,65 s en radios. Sin este aviso, el clic deja la interfaz "muerta" ese
 * rato sin que el usuario sepa si se colgó.
 */
const VIAS_VIEW_NOTICE = 'El GeoServer tarda unos 12 segundos en traer la geometría de una vía.'

/**
 * La fila que se recorre: una pestaña por capa hija, y adentro la página que
 * se esté mirando. Guarda qué pestaña está activa, en qué página va cada una
 * y cuál fue el último pedido, para que una respuesta lenta de una pestaña
 * abandonada no pise a la que el usuario está mirando.
 */
export function createBrowser({ container, onView, onError }) {
  let obj = null
  let active = null
  let pages = new Map()
  // Capas lentas que el usuario ya aceptó cargar para el objeto actual.
  let confirmed = new Set()
  let token = 0
  let body = null

  function show(next) {
    obj = next
    active = null
    pages = new Map()
    confirmed = new Set()
    token += 1
    container.replaceChildren()

    const kids = childrenOf(obj)
    if (!kids.length) return

    const tabsBox = document.createElement('div')
    body = document.createElement('div')
    body.className = 'pane'
    container.append(tabsBox, body)

    createTabs({
      container: tabsBox,
      items: kids.map(({ key, count }) => ({
        key, label: CHILD_LAYERS[key].label, badge: fmt(count),
      })),
      onSelect: (key) => {
        active = key
        if (LAZY_KEYS.has(key) && !confirmed.has(key)) {
          body.replaceChildren(costPane(key))
          return
        }
        load(key, pages.get(key) ?? 0)
      },
    })
  }

  /** El costo medido y el botón para cargar la página igual. */
  function costPane(key) {
    const wrap = document.createElement('div')
    const p = document.createElement('p')
    p.className = 'note'
    p.textContent = VIAS_COST_NOTICE
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'btn ghost mini'
    b.textContent = 'Cargar igual'
    b.addEventListener('click', () => {
      confirmed.add(key)
      load(key, pages.get(key) ?? 0)
    })
    wrap.append(p, b)
    return wrap
  }

  async function load(key, page) {
    const mine = (token += 1)
    pages.set(key, page)
    body.replaceChildren(metaParagraph('Cargando…'))
    try {
      const { rows, total } = await fetchPage(obj, key, page)
      // Llegó tarde: el usuario ya está en otra pestaña o en otra página.
      if (mine !== token || key !== active) return

      const tableEl = renderTable(key, rows, (row, childKey) => markRow(tableEl, rows, row, childKey))
      const panels = [tableEl, renderPager({ page, total, onPage: (p) => load(key, p) })]
      if (LAZY_KEYS.has(key)) panels.push(metaParagraph(VIAS_COST_REMINDER))
      body.replaceChildren(...panels)
    } catch (err) {
      if (mine !== token || key !== active) return
      body.replaceChildren(errorBox(err, () => load(key, page)))
      onError(err)
    }
  }

  /**
   * Marca la fila vista con `aria-selected` —la regla ya existe en
   * style.css— y avisa. Se ubica por identidad dentro de `rows`, no por
   * texto: es la misma referencia que `renderTable` le pasa a `onView`.
   *
   * Además deja el botón "Ver" en estado de carga mientras `onView` tarda
   * —puede devolver una promesa; si no devuelve nada, se restaura en el
   * siguiente microtask—. En vías es la única forma de que el usuario sepa
   * que los ~12 s medidos están corriendo y no que la interfaz se colgó.
   *
   * `onView` es una interfaz pública genérica: no podemos asumir que quien
   * la implementa ya capturó sus propios errores (hoy `main.js` sí lo hace,
   * pero no es parte del contrato). Un rechazo sin `.catch` acá quedaría
   * como Unhandled Rejection. `onError` ya existe para justo esto —avisar
   * un fallo sin cortar el resto de la ficha—, así que lo reusamos en vez
   * de tragarnos el error con un `.catch(() => {})` mudo.
   */
  function markRow(tableEl, rows, row, childKey) {
    const idx = rows.indexOf(row)
    tableEl.querySelectorAll('tbody tr').forEach((tr, i) => {
      tr.setAttribute('aria-selected', String(i === idx))
    })

    const button = [...tableEl.querySelectorAll('tbody tr')][idx]?.querySelector('button')
    let notice = null
    if (button) {
      button.disabled = true
      button.textContent = 'Viendo…'
      if (childKey === 'vias') {
        notice = metaParagraph(VIAS_VIEW_NOTICE)
        button.insertAdjacentElement('afterend', notice)
      }
    }

    Promise.resolve(onView(row, childKey))
      .catch(onError)
      .finally(() => {
        if (button) {
          button.disabled = false
          button.textContent = 'Ver'
        }
        notice?.remove()
      })
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

  return { show, clear: () => container.replaceChildren() }
}
