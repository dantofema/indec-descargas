/**
 * El home: el hero con el buscador y los totales de lo que hay adentro.
 *
 * No abre fichas: elegir un objeto navega a /resultados/, que es donde vive
 * el estado (la URL). Y no baja el catálogo al cargar —son 673 KB contra
 * los 162 bytes medidos de los totales—: lo pide recién cuando alguien toca
 * el campo, y el buscador vuelve a buscar solo lo que ya esté escrito cuando
 * el catálogo llega.
 */
import { loadCatalog } from '../catalog.js'
import { loadTotales } from '../totales.js'
import { createSearchBox } from '../searchbox.js'
import { format } from '../permalink.js'
import { fmt } from '../ui.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Los ocho objetos del Marco, en el orden en que el home los muestra, con
 * la clave con la que vienen en `totales.json`.
 *
 * Los iconos son trazo simple dibujado acá: ocho dibujos no justifican
 * sumar una librería de iconos al bundle.
 */
const TILES = [
  { key: 'jur', label: 'Jurisdicciones', shapes: [
    ['path', { d: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z' }],
    ['path', { d: 'M9 3v15' }],
    ['path', { d: 'M15 6v15' }],
  ] },
  { key: 'dep', label: 'Departamentos', shapes: [
    ['rect', { x: 3, y: 3, width: 8, height: 8, rx: 1 }],
    ['rect', { x: 13, y: 3, width: 8, height: 8, rx: 1 }],
    ['rect', { x: 3, y: 13, width: 8, height: 8, rx: 1 }],
    ['rect', { x: 13, y: 13, width: 8, height: 8, rx: 1 }],
  ] },
  { key: 'fracciones', label: 'Fracciones censales', shapes: [
    ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 1 }],
    ['rect', { x: 8, y: 8, width: 8, height: 8, rx: 1 }],
  ] },
  { key: 'radios', label: 'Radios censales', shapes: [
    ['circle', { cx: 12, cy: 12, r: 8 }],
    ['circle', { cx: 12, cy: 12, r: 1.5 }],
    ['path', { d: 'M12 12l6-4' }],
  ] },
  { key: 'loc', label: 'Localidades censales', shapes: [
    ['path', { d: 'M4 20v-9l5-4 5 4v9' }],
    ['path', { d: 'M14 20v-6l5-3v9' }],
    ['path', { d: 'M3 20h18' }],
  ] },
  { key: 'gl', label: 'Gobiernos locales', shapes: [
    ['path', { d: 'M3 10l9-6 9 6z' }],
    ['path', { d: 'M6 10v9M10 10v9M14 10v9M18 10v9' }],
    ['path', { d: 'M3 21h18' }],
  ] },
  { key: 'aglo', label: 'Aglomerados', shapes: [
    ['circle', { cx: 9, cy: 11, r: 5 }],
    ['circle', { cx: 16, cy: 15, r: 4 }],
    ['circle', { cx: 17, cy: 7, r: 3 }],
  ] },
  { key: 'vias', label: 'Vías de circulación', shapes: [
    ['path', { d: 'M8 3v18' }],
    ['path', { d: 'M16 3v18' }],
    ['path', { d: 'M12 4v3M12 10v4M12 17v3' }],
  ] },
]

/** Los nodos de la página, resueltos al cablear y no al importar. */
const el = {}

function queryEls() {
  Object.assign(el, {
    q: document.querySelector('#q'),
    type: document.querySelector('#type'),
    results: document.querySelector('#results'),
    status: document.querySelector('#status'),
    totals: document.querySelector('#totals'),
    generated: document.querySelector('#generated'),
  })
}

function setStatus(text, isError = false) {
  el.status.textContent = text
  el.status.classList.toggle('error', isError)
  el.status.hidden = !text
}

/** Un icono de trazo, sin relleno, que hereda el color del texto. */
function icon(shapes) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  const attrs = {
    viewBox: '0 0 24 24', width: '28', height: '28',
    fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  }
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v)
  for (const [tag, shapeAttrs] of shapes) {
    const node = document.createElementNS(SVG_NS, tag)
    for (const [k, v] of Object.entries(shapeAttrs)) node.setAttribute(k, String(v))
    svg.append(node)
  }
  return svg
}

/**
 * Los ocho tiles. Con `replaceChildren` para que volver a cablear la página
 * no los duplique.
 */
function renderTotals(totals) {
  el.totals.replaceChildren(...TILES.map((tile) => {
    const li = document.createElement('li')
    li.className = 'totales-tile'
    const n = document.createElement('span')
    n.className = 'totales-n'
    n.textContent = fmt(totals[tile.key] ?? 0)
    const label = document.createElement('span')
    label.className = 'totales-label'
    label.textContent = tile.label
    li.append(icon(tile.shapes), n, label)
    return li
  }))
  if (totals.generated) el.generated.textContent = `Catálogo generado el ${totals.generated}.`
}

/**
 * `navigate` se inyecta para poder testear sin que jsdom se queje de
 * navegar de verdad. Volver a llamarla sobre la misma página no duplica
 * nada: todo lo que dibuja usa `replaceChildren`.
 */
export function initHome({ navigate = (href) => window.location.assign(href) } = {}) {
  queryEls()
  // Sin su DOM no hay nada que cablear: el módulo es el entry de Vite y se
  // auto-invoca abajo, así que importarlo sin la página montada —un test—
  // tiene que ser inofensivo.
  if (!el.q) return

  const searchbox = createSearchBox({
    input: el.q, select: el.type, list: el.results,
    // El estado es la URL: elegir un objeto navega, no abre nada acá.
    onPick: (obj) => navigate(format(obj)),
  })

  // Los totales primero: son 162 bytes medidos y son lo que el home tiene
  // para mostrar. Si fallan, el buscador sigue sirviendo, que es lo que la
  // página vino a hacer.
  loadTotales().then(renderTotals).catch(() => {})

  let pending = null
  const fetchCatalog = () => {
    pending ??= loadCatalog()
      .then((c) => searchbox.setObjects(c.objects))
      .catch((err) => setStatus(`No se pudo cargar el catálogo: ${err.message}`, true))
  }
  el.q.addEventListener('focus', fetchCatalog, { once: true })
  el.q.addEventListener('input', fetchCatalog, { once: true })
}

initHome()
