/**
 * La ficha de un objeto: mapa, de qué forma parte, qué contiene y cómo
 * recorrerlo. Este módulo sólo cablea —lee la URL, busca el objeto en el
 * catálogo y reparte a los módulos que ya deciden cada cosa—.
 *
 * El estado es la URL y no hay estado fuera de ella: elegir un objeto en el
 * buscador **navega**, también estando ya acá. No hay `pushState` ni
 * `popstate` que sincronizar, y atrás y adelante funcionan porque son
 * navegación de verdad. Lo único que escribe la barra sin navegar es
 * cambiar de pestaña, con `replaceState`: la URL sigue describiendo lo que
 * se ve, y atrás no se convierte en un paseo por todas las pestañas que se
 * tocaron.
 */
import { loadCatalog } from '../catalog.js'
import { selfUrl, TYPES, childOf, featureUrl, isCode } from '../download.js'
import { initMap, showObject, showFeature, onFeature } from '../map.js'
import { fmt, downloadButton, disabledButton } from '../ui.js'
import { childRows } from '../children.js'
import { createSearchBox } from '../searchbox.js'
import { codeIndex, parentsOf } from '../parents.js'
import { createBrowser } from '../browser.js'
import { specOf } from '../columns.js'
import { noteFor, noteHref, NOTE_BY_TYPE, NOTE_BY_LAYER } from '../notes.js'
import { parse, format } from '../permalink.js'

/**
 * Los nodos de la página. Se resuelven al cablear y no al importar: el
 * módulo es el entry de Vite y se auto-invoca abajo, así que importarlo sin
 * la página montada tiene que ser inofensivo.
 */
const el = {}

let index = null
let browser = null
/** El objeto que la ficha está mostrando. Lo dice la URL, no un clic. */
let current = null
/**
 * Si el aviso de pestaña del browser se escribe en la barra o no.
 *
 * La pestaña que el browser abre solo al armarse no es una acción del
 * usuario: no se escribe, así el enlace que alguien comparte queda como lo
 * abrió y `capa=` aparece recién cuando se cambia de pestaña. La excepción
 * es un enlace que sí nombró una capa: ahí la barra ya afirmó qué se está
 * viendo, y si el objeto no tiene esa capa hay que dejarla diciendo la que
 * se abrió en su lugar.
 */
let writeTab = false

/** Cuánto dura el "Copiado" del botón de enlace. */
const COPY_FEEDBACK_MS = 1500

function queryEls() {
  Object.assign(el, {
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
    copyLink: document.querySelector('#copy-link'),
  })

  // El enlace "Qué es..." del objeto (NOTA-R3) no tiene id en el HTML: se
  // crea acá una sola vez, junto a `el.meta`, y `selectObject` sólo
  // reemplaza su contenido en cada ficha —nunca agrega un segundo enlace.
  if (el.meta && !el.note) {
    el.note = document.createElement('p')
    el.note.className = 'note-link'
    el.meta.insertAdjacentElement('afterend', el.note)
  }
}

function setStatus(text, isError = false) {
  el.status.textContent = text
  el.status.classList.toggle('error', isError)
  el.status.hidden = !text
}

function renderChildren(obj) {
  el.children.replaceChildren(...childRows(obj))
}

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

/** El enlace "Qué es..." del objeto de la ficha (NOTA-R3). */
function objectNoteLink(obj) {
  const a = document.createElement('a')
  a.href = noteHref(NOTE_BY_TYPE[obj.t])
  a.textContent = `Qué es ${TYPES[obj.t].det} ${TYPES[obj.t].label.toLowerCase()} →`
  return a
}

/** Vuelve a la ficha del objeto, en la pestaña desde la que se vino. */
function backButton(capa) {
  const b = document.createElement('button')
  b.type = 'button'
  b.id = 'back-to-object'
  b.className = 'btn ghost mini'
  b.textContent = `Volver a ${current.n}`
  b.addEventListener('click', () => selectObject(current, capa))
  return b
}

/**
 * La ficha de una fila hija. Los campos salen de `specOf`, la misma spec
 * que arma la tabla: ficha y tabla leen lo mismo, así que no pueden decir
 * cosas distintas de la misma fila.
 *
 * Se reemplaza entera, no se le agrega nada a lo que había: es lo que
 * separa esto del bug viejo, donde cada "Ver" le pegaba otro tramo de texto
 * a #detail-meta sin límite.
 */
function showRow(capa, row) {
  const spec = specOf(capa)
  const codigo = String(row[spec.idField] ?? '')

  // El singular sale del `label` de la nota de esa capa, que ya está en
  // singular ("Radio censal"). Derivarlo de CHILD_LAYERS con un replace
  // daría "Radios censale": el plural del INDEC no se deshace con un regex.
  const singular = noteFor(NOTE_BY_LAYER[capa]).label

  el.name.textContent = spec.titleField && row[spec.titleField]
    ? row[spec.titleField]
    : `${singular} ${codigo}`

  el.meta.textContent = spec.columns
    .filter((c) => row[c.field] !== undefined && row[c.field] !== '')
    .map((c) => `${c.label}: ${c.map ? c.map(row[c.field]) : row[c.field]}`)
    .join(' · ')

  // Una fila sin código no es un error de programa: es un dato que el INDEC
  // no publicó (DES-R8). Se dice, y la ficha sigue en pie.
  el.self.replaceChildren(
    isCode(codigo)
      ? downloadButton(featureUrl(capa, codigo), `Descargar ${singular.toLowerCase()}`)
      : disabledButton('Descargar', 'El INDEC no publicó el código de esta fila.'),
    backButton(capa),
  )
}

/**
 * Dibuja la ficha del objeto que pide la URL. `initialLayer` es la capa que
 * el enlace quiere abierta; el browser la ignora si el objeto no la tiene.
 */
function selectObject(obj, initialLayer = null) {
  // Antes de `show`: el `onTab` del browser dispara en el mismo momento en
  // que se arma la primera pestaña, y necesita saber de quién es la ficha y
  // si esa primera pestaña se escribe en la barra (ver `writeTab`).
  current = obj
  writeTab = initialLayer !== null
  el.q.value = obj.n
  setStatus('')

  el.name.textContent = obj.n
  el.meta.textContent = obj.p && obj.p !== obj.n
    ? `${TYPES[obj.t].label} · ${obj.p} · código ${obj.c}`
    : `${TYPES[obj.t].label} · código ${obj.c}`
  el.note.replaceChildren(objectNoteLink(obj))

  el.self.replaceChildren(
    downloadButton(selfUrl(obj), `Descargar ${TYPES[obj.t].det} ${TYPES[obj.t].label.toLowerCase()}`),
  )

  renderParents(obj)
  renderChildren(obj)
  // La visibilidad de la fila la decide quien la dibuja, como la fila 2:
  // recalcular acá el mismo predicado es cómo divergen y queda una fila
  // visible y vacía.
  el.rowBrowse.hidden = !browser.show(obj, initialLayer)
  writeTab = true
  el.detail.hidden = false
  drawObject(obj)
}

/**
 * El GeoServer devuelve nombres largos y códigos que no están en el
 * catálogo; se muestran tal cual vienen, sin traducir.
 */
function describeFeature(props) {
  const interesting = ['fna', 'gna', 'cod_indec', 'sag']
  const parts = interesting
    .filter((k) => props[k] && props[k] !== 'N/A')
    .map((k) => `${k}: ${props[k]}`)
  if (parts.length) el.meta.textContent += ` · ${parts.join(' · ')}`
}

/**
 * Dibuja el objeto de la ficha en el mapa. Va después de destapar `#detail`:
 * Leaflet midió altura cero con el panel oculto y `showObject` lo corrige
 * con `invalidateSize`, que necesita el contenedor a la vista.
 *
 * Un mapa que no se puede dibujar no rompe la ficha: las descargas —que son
 * a lo que se vino— siguen ahí, así que el fallo se avisa y se sigue.
 */
function drawObject(obj) {
  showObject(obj).catch((err) => {
    setStatus(`No se pudo dibujar el objeto en el mapa: ${err.message}. Las descargas siguen funcionando.`, true)
  })
}

/**
 * Copiar la barra tal cual: incluida la pestaña abierta, porque la URL ya
 * describe todo lo que se está viendo. Sin `navigator.clipboard` —http, o
 * un browser que no lo trae— el botón no puede cumplir lo que promete, así
 * que no se muestra.
 */
function setupCopyLink(button) {
  if (!navigator.clipboard) {
    button.hidden = true
    return
  }
  button.hidden = false
  let timer = null
  button.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        button.textContent = 'Copiado'
        clearTimeout(timer)
        timer = setTimeout(() => { button.textContent = 'Copiar enlace' }, COPY_FEEDBACK_MS)
      })
      .catch(() => setStatus('No se pudo copiar el enlace: copialo de la barra del navegador.', true))
  })
}

/**
 * `navigate` se inyecta para poder testear sin que jsdom se queje de
 * navegar de verdad. En producción es la navegación real, que es lo que
 * hace que la URL pueda ser el único estado.
 */
export function initResultados({ navigate = (href) => window.location.assign(href) } = {}) {
  queryEls()
  // Sin su DOM no hay nada que cablear. Pasa cuando el módulo se importa
  // antes de montar la página, y es lo que deja que el auto-invoke de abajo
  // conviva con los tests.
  if (!el.q) return

  const searchbox = createSearchBox({
    input: el.q, select: el.type, list: el.results,
    // El estado es la URL: elegir un objeto navega, también estando ya acá.
    // Es lo que hace que atrás y adelante funcionen sin una línea de historia.
    onPick: (obj) => navigate(format(obj)),
  })

  /**
   * La fila 3: recorrer de a una página los objetos hijos y verlos en el
   * mapa. `onView` ya recibe la fila y de qué pestaña salió (ver table.js),
   * así que no hace falta que esta página lleve la cuenta de la activa.
   */
  browser = createBrowser({
    container: el.browse,
    // Devuelve la promesa: es lo que usa browser.js para dejar el botón
    // "Ver" en estado de carga mientras el GeoServer contesta (ver
    // markRow en browser.js; en vías tarda ~12 s medidos).
    onView: (row, key) => {
      const spec = specOf(key)
      return showFeature(childOf(key).layer, spec.idField, String(row[spec.idField]))
        .then((props) => {
          // `undefined` significa que este pedido perdió la carrera: un
          // "Ver" de vías de 12 s que llegó tarde no pisa lo que se está
          // mirando (NAV-R10).
          if (props) showRow(key, { ...row, ...props })
        })
        .catch((err) => setStatus(`No se pudo dibujar en el mapa: ${err.message}`, true))
    },
    onError: () => {},
    onTab: (layer) => {
      // Reescribe la barra sin navegar: la URL sigue describiendo lo que se
      // ve, y atrás vuelve a de dónde se vino, no a la pestaña anterior.
      if (current && writeTab) window.history.replaceState({}, '', format(current, layer))
    },
  })

  onFeature(describeFeature)
  setupCopyLink(el.copyLink)

  const url = parse(window.location.search)

  loadCatalog()
    .then((c) => {
      index = codeIndex(c.objects)
      searchbox.setObjects(c.objects)
      el.generated.textContent = `Catálogo generado el ${c.generated} · ${fmt(c.objects.length)} objetos.`

      if (url.status === 'empty') return setStatus('Buscá un objeto para verlo en el mapa.')
      if (url.status === 'invalid') return setStatus(`Ese enlace no se puede abrir: ${url.reason}`, true)

      // `permalink.js` valida sintaxis; la existencia la decide el catálogo,
      // que es quien la sabe.
      const obj = c.objects.find((o) => o.t === url.type && o.c === url.code)
      if (!obj) return setStatus(`No hay ningún objeto con el código ${url.code} en el catálogo.`, true)

      initMap('map') // recién acá: sin objeto no hay nada que dibujar
      selectObject(obj, url.layer)
      el.q.focus()
    })
    .catch((err) => {
      setStatus(`No se pudo cargar el catálogo: ${err.message}`, true)
    })
}

initResultados()
