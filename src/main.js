import { search } from './search.js'
import { loadCatalog, childrenOf } from './catalog.js'
import { selfUrl, childUrl, canDownload, filename, TYPES, CHILD_LAYERS } from './download.js'
import { initMap, showObject, onFeature } from './map.js'

const el = {
  q: document.querySelector('#q'),
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

/** Resultados en pantalla y cuál está resaltado (-1 = ninguno). */
let items = []
let highlighted = -1

/** Formatea un entero con separador de miles en castellano. */
const fmt = (n) => n.toLocaleString('es-AR')

function setStatus(text, isError = false) {
  el.status.textContent = text
  el.status.classList.toggle('error', isError)
  el.status.hidden = !text
}

/** Botón de descarga: enlace real si el tope habilita, botón muerto si no. */
function downloadButton(href, name, label) {
  const a = document.createElement('a')
  a.className = 'btn'
  a.href = href
  a.download = name
  a.textContent = label
  return a
}

function disabledButton(label, reason) {
  const wrap = document.createElement('div')
  const span = document.createElement('span')
  span.className = 'btn is-disabled'
  span.textContent = label
  span.setAttribute('aria-disabled', 'true')
  const note = document.createElement('p')
  note.className = 'note'
  note.textContent = reason
  wrap.append(span, note)
  return wrap
}

/** Abre o cierra la lista manteniendo el estado ARIA del combobox. */
function showResults(open) {
  el.results.hidden = !open
  el.q.setAttribute('aria-expanded', String(open))
  if (!open) setHighlight(-1)
}

/** Resalta un resultado para el teclado y para el lector de pantalla. */
function setHighlight(i) {
  const lis = el.results.children
  if (highlighted >= 0 && lis[highlighted]) lis[highlighted].removeAttribute('aria-selected')
  highlighted = i
  if (i < 0 || !lis[i]) {
    el.q.removeAttribute('aria-activedescendant')
    return
  }
  lis[i].setAttribute('aria-selected', 'true')
  el.q.setAttribute('aria-activedescendant', lis[i].id)
  // La lista scrollea: el resaltado tiene que quedar a la vista.
  lis[i].scrollIntoView({ block: 'nearest' })
}

/** Mueve el resaltado con las flechas, dando la vuelta en los extremos. */
function moveHighlight(delta) {
  if (el.results.hidden || !items.length) return
  const n = items.length
  setHighlight(highlighted < 0 ? (delta > 0 ? 0 : n - 1) : (highlighted + delta + n) % n)
}

function renderResults(objs) {
  items = objs
  highlighted = -1
  el.q.removeAttribute('aria-activedescendant')
  el.results.replaceChildren()
  if (!objs.length) {
    showResults(false)
    return
  }
  objs.forEach((obj, i) => {
    const li = document.createElement('li')
    li.setAttribute('role', 'option')
    li.id = `result-${i}`
    const name = document.createElement('span')
    name.textContent = obj.n
    const kind = document.createElement('span')
    kind.className = 'kind'
    kind.textContent = obj.p && obj.p !== obj.n
      ? `${TYPES[obj.t].label} · ${obj.p}`
      : TYPES[obj.t].label
    li.append(name, kind)
    li.addEventListener('click', () => selectObject(obj))
    el.results.append(li)
  })
  showResults(true)
}

function renderChildren(obj) {
  const children = childrenOf(obj)
  el.children.replaceChildren()
  el.childrenTitle.hidden = children.length === 0
  if (!children.length) return

  for (const { key, count } of children) {
    const li = document.createElement('li')
    const left = document.createElement('div')
    const label = document.createElement('div')
    label.textContent = CHILD_LAYERS[key].label
    const n = document.createElement('div')
    n.className = 'count'
    n.textContent = count === 1 ? '1 objeto' : `${fmt(count)} objetos`
    left.append(label, n)

    let right
    if (count === 0) {
      right = disabledButton('Descargar', 'No hay objetos de esta capa acá.')
    } else if (!canDownload(count, catalog.maxFeatures)) {
      right = disabledButton(
        'Descargar',
        `Son ${fmt(count)} objetos y el máximo por descarga es ${fmt(catalog.maxFeatures)}. ` +
        'Probá con un objeto más chico.',
      )
    } else {
      right = downloadButton(childUrl(obj, key), filename(obj, key), 'Descargar')
      if (key === 'vias') {
        const wrap = document.createElement('div')
        const note = document.createElement('p')
        note.className = 'note'
        note.textContent = 'Las vías tardan: el servidor del INDEC puede demorar un minuto o más en responder.'
        wrap.append(right, note)
        right = wrap
      }
    }

    li.append(left, right)
    el.children.append(li)
  }
}

function selectObject(obj) {
  showResults(false)
  el.q.value = obj.n
  setStatus('')

  el.name.textContent = obj.n
  el.meta.textContent = obj.p && obj.p !== obj.n
    ? `${TYPES[obj.t].label} · ${obj.p} · código ${obj.c}`
    : `${TYPES[obj.t].label} · código ${obj.c}`

  el.self.replaceChildren(
    downloadButton(selfUrl(obj), filename(obj), `Descargar este ${TYPES[obj.t].label.toLowerCase()}`),
  )

  renderChildren(obj)
  el.detail.hidden = false
  document.dispatchEvent(new CustomEvent('object:selected', { detail: obj }))
}

el.q.addEventListener('input', () => {
  if (!catalog) return
  renderResults(search(catalog.objects, el.q.value))
})

el.q.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    showResults(false)
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault() // si no, las flechas mueven el cursor dentro del input
    moveHighlight(e.key === 'ArrowDown' ? 1 : -1)
  } else if (e.key === 'Enter' && !el.results.hidden && highlighted >= 0) {
    e.preventDefault()
    selectObject(items[highlighted])
  }
})

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search')) showResults(false)
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
    catalog = c
    setStatus('')
    el.generated.textContent = `Catálogo generado el ${c.generated} · ${fmt(c.objects.length)} objetos · máximo ${fmt(c.maxFeatures)} por descarga.`
    el.q.focus()
  })
  .catch((err) => {
    setStatus(`No se pudo cargar el catálogo: ${err.message}`, true)
  })
