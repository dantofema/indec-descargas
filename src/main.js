import { loadCatalog } from './catalog.js'
import { selfUrl, TYPES, childOf } from './download.js'
import { initMap, showObject, showFeature, onFeature } from './map.js'
import { fmt, downloadButton } from './ui.js'
import { childRows } from './children.js'
import { createSearchBox } from './searchbox.js'
import { codeIndex, parentsOf } from './parents.js'
import { createBrowser } from './browser.js'
import { specOf } from './columns.js'

const el = {
  q: document.querySelector('#q'),
  type: document.querySelector('#type'),
  results: document.querySelector('#results'),
  status: document.querySelector('#status'),
  detail: document.querySelector('#detail'),
  name: document.querySelector('#detail-name'),
  meta: document.querySelector('#detail-meta'),
  self: document.querySelector('#detail-self'),
  parents: document.querySelector('#parents'),
  rowParents: document.querySelector('#row-parents'),
  rowBrowse: document.querySelector('#row-browse'),
  browse: document.querySelector('#browse'),
  children: document.querySelector('#children'),
  generated: document.querySelector('#generated'),
}

let index = null

function setStatus(text, isError = false) {
  el.status.textContent = text
  el.status.classList.toggle('error', isError)
  el.status.hidden = !text
}

function renderChildren(obj) {
  const rows = childRows(obj)
  el.children.replaceChildren(...rows)
}

/**
 * La fila 3: recorrer de a una página los objetos hijos y verlos en el
 * mapa. `onView` ya recibe la fila y de qué pestaña salió (ver table.js),
 * así que no hace falta que main.js lleve la cuenta de la pestaña activa.
 */
const browser = createBrowser({
  container: el.browse,
  // Devuelve la promesa: es lo que usa browser.js para dejar el botón
  // "Ver" en estado de carga mientras el GeoServer contesta (ver
  // markRow en browser.js; en vías tarda ~12 s medidos).
  onView: (row, key) => {
    const spec = specOf(key)
    return showFeature(childOf(key).layer, spec.idField, String(row[spec.idField]))
      .catch((err) => setStatus(`No se pudo dibujar en el mapa: ${err.message}`, true))
  },
  onError: () => {},
})

/** Una fila por padre: quién es y su descarga. */
function parentRow(parent) {
  const li = document.createElement('li')
  const who = document.createElement('span')
  who.className = 'who'
  who.textContent = parent.n
  const kind = document.createElement('span')
  kind.className = 'count'
  kind.textContent = ` · ${TYPES[parent.t].label} · ${parent.c}`
  who.append(kind)
  li.append(who, downloadButton(selfUrl(parent), 'Descargar'))
  return li
}

function renderParents(obj) {
  const rows = parentsOf(obj, index).map(parentRow)
  el.rowParents.hidden = rows.length === 0
  el.parents.replaceChildren(...rows)
}

function selectObject(obj) {
  el.q.value = obj.n
  setStatus('')

  el.name.textContent = obj.n
  el.meta.textContent = obj.p && obj.p !== obj.n
    ? `${TYPES[obj.t].label} · ${obj.p} · código ${obj.c}`
    : `${TYPES[obj.t].label} · código ${obj.c}`

  el.self.replaceChildren(
    downloadButton(selfUrl(obj), `Descargar ${TYPES[obj.t].det} ${TYPES[obj.t].label.toLowerCase()}`),
  )

  renderParents(obj)
  renderChildren(obj)
  // La visibilidad de la fila la decide quien la dibuja, como la fila 2:
  // recalcular acá el mismo predicado es cómo divergen y queda una fila
  // visible y vacía.
  el.rowBrowse.hidden = !browser.show(obj)
  el.detail.hidden = false
  document.dispatchEvent(new CustomEvent('object:selected', { detail: obj }))
}

const searchbox = createSearchBox({
  input: el.q, select: el.type, list: el.results, onPick: selectObject,
})

initMap('map')

onFeature((props) => {
  // El GeoServer devuelve nombres largos y códigos que no están en el
  // catálogo; se muestran tal cual vienen, sin traducir.
  const interesting = ['fna', 'gna', 'cod_indec', 'sag']
  const parts = interesting
    .filter((k) => props[k] && props[k] !== 'N/A')
    .map((k) => `${k}: ${props[k]}`)
  if (parts.length) el.meta.textContent += ` · ${parts.join(' · ')}`
})

document.addEventListener('object:selected', (e) => {
  showObject(e.detail).catch((err) => {
    setStatus(`No se pudo dibujar el objeto en el mapa: ${err.message}. Las descargas siguen funcionando.`, true)
  })
})

loadCatalog()
  .then((c) => {
    index = codeIndex(c.objects)
    searchbox.setObjects(c.objects)
    setStatus('')
    el.generated.textContent = `Catálogo generado el ${c.generated} · ${fmt(c.objects.length)} objetos.`
    el.q.focus()
  })
  .catch((err) => {
    setStatus(`No se pudo cargar el catálogo: ${err.message}`, true)
  })
