import { search, TYPE_ORDER } from './search.js'
import { loadCatalog } from './catalog.js'
import { selfUrl, TYPES } from './download.js'
import { initMap, showObject, onFeature } from './map.js'
import { fmt, downloadButton } from './ui.js'
import { childRows } from './children.js'
import { createCombobox } from './combobox.js'

const el = {
  q: document.querySelector('#q'),
  type: document.querySelector('#type'),
  results: document.querySelector('#results'),
  status: document.querySelector('#status'),
  detail: document.querySelector('#detail'),
  name: document.querySelector('#detail-name'),
  meta: document.querySelector('#detail-meta'),
  self: document.querySelector('#detail-self'),
  childrenTitle: document.querySelector('#children-title'),
  children: document.querySelector('#children'),
  generated: document.querySelector('#generated'),
}

let catalog = null

function setStatus(text, isError = false) {
  el.status.textContent = text
  el.status.classList.toggle('error', isError)
  el.status.hidden = !text
}

function renderChildren(obj) {
  const rows = childRows(obj)
  el.childrenTitle.hidden = rows.length === 0
  el.children.replaceChildren(...rows)
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

  renderChildren(obj)
  el.detail.hidden = false
  document.dispatchEvent(new CustomEvent('object:selected', { detail: obj }))
}

/** Cada resultado muestra el nombre y, al lado, de qué tipo es. */
function renderOption(obj) {
  const frag = document.createDocumentFragment()
  const name = document.createElement('span')
  name.textContent = obj.n
  const kind = document.createElement('span')
  kind.className = 'kind'
  kind.textContent = obj.p && obj.p !== obj.n
    ? `${TYPES[obj.t].label} · ${obj.p}`
    : TYPES[obj.t].label
  frag.append(name, kind)
  return frag
}

const combo = createCombobox({
  input: el.q,
  list: el.results,
  renderOption,
  onSelect: selectObject,
})

/**
 * Las opciones del filtro salen de TYPE_ORDER y TYPES, no del HTML: el
 * orden y las etiquetas quedan en un solo lugar. El valor vacío es
 * "todos", que es donde arranca (BUS-R1).
 */
function typeOption(value, label) {
  const option = document.createElement('option')
  option.value = value
  option.textContent = label
  return option
}

el.type.append(
  typeOption('', 'Todos los tipos'),
  ...TYPE_ORDER.map((t) => typeOption(t, TYPES[t].plural)),
)

function runSearch() {
  if (!catalog) return
  combo.render(search(catalog.objects, el.q.value, { type: el.type.value }))
}

// El `change` también busca: cambiar de tipo tiene que acotar lo que ya
// está escrito, sin obligar a volver a tipear.
el.q.addEventListener('input', runSearch)
el.type.addEventListener('change', runSearch)

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
    catalog = c
    setStatus('')
    el.generated.textContent = `Catálogo generado el ${c.generated} · ${fmt(c.objects.length)} objetos.`
    el.q.focus()
  })
  .catch((err) => {
    setStatus(`No se pudo cargar el catálogo: ${err.message}`, true)
  })
