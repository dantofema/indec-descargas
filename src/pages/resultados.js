/**
 * La ficha de un objeto: mapa, de qué forma parte, qué contiene y cómo
 * recorrerlo. Este módulo sólo cablea —lee la URL, busca el objeto en el
 * catálogo y reparte a los módulos que ya deciden cada cosa—.
 *
 * El estado es la URL y no hay estado fuera de ella: elegir un objeto en el
 * buscador **navega**, también estando ya acá. No hay `pushState` ni
 * `popstate` que sincronizar, y atrás y adelante funcionan porque son
 * navegación de verdad. Lo único que escribe la barra sin navegar es
 * cambiar de pestaña o de página de la tabla, con `replaceState`: la URL
 * sigue describiendo lo que se ve, y atrás no se convierte en un paseo por
 * todas las pestañas y páginas que se tocaron.
 */
import { loadCatalog } from '../catalog.js'
import { selfUrl, TYPES, LAYER_OF_TYPE, TYPE_OF_LAYER, featureUrl, isCode } from '../download.js'
import { initMap, showObject, syncMapSize } from '../map.js'
import { fmt, downloadButton, disabledButton, setStatus, costPanel } from '../ui.js'
import { childRows } from '../children.js'
import { createSearchBox } from '../searchbox.js'
import { codeIndex, parentsOf } from '../parents.js'
import { createBrowser, VIAS_VIEW_NOTICE } from '../browser.js'
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
 * Si los avisos de pestaña y de página del browser se escriben en la barra
 * o no.
 *
 * La pestaña que el browser abre solo al armarse no es una acción del
 * usuario: no se escribe, así el enlace que alguien comparte queda como lo
 * abrió y `capa=` aparece recién cuando se cambia de pestaña. La excepción
 * es un enlace que sí nombró una capa: ahí la barra ya afirmó qué se está
 * viendo, y si el objeto no tiene esa capa —o si esa capa no existe— hay
 * que dejarla diciendo la que se abrió en su lugar.
 *
 * La página de la tabla va por el mismo camino: la primera pestaña se carga
 * sola al armar la fila y dispara su propio aviso, distinto del de la
 * pestaña pero con la misma guarda, así que `writeTab` decide para los dos.
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
    rowChildren: document.querySelector('#row-children'),
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

function renderChildren(obj) {
  const rows = childRows(obj)
  el.children.replaceChildren(...rows)
  // La visibilidad de la fila la decide quien la dibuja, como su hermana
  // `renderParents`: decidirla aparte es cómo divergen y queda una fila
  // visible y vacía.
  el.rowChildren.hidden = rows.length === 0
}

/** Una fila por padre: quién es y su descarga. */
function parentRow(parent) {
  const li = document.createElement('li')
  const who = document.createElement('span')
  who.className = 'who'
  // Un padre sin catálogo no tiene nombre publicado (NAV-R4): su rótulo es
  // su tipo, y el código va una sola vez, en el `kind`. Sin esto la fila sale
  // con el nombre en blanco y un separador colgando.
  who.textContent = parent.n ?? TYPES[parent.t].label
  const kind = document.createElement('span')
  kind.className = 'count'
  kind.textContent = parent.n
    ? ` · ${TYPES[parent.t].label} · ${parent.c}`
    : ` · ${parent.c}`
  who.append(kind)
  li.append(who, downloadButton(selfUrl(parent), 'Descargar'))
  return li
}

function renderParents(obj) {
  const rows = parentsOf(obj, index).map(parentRow)
  el.rowParents.hidden = rows.length === 0
  el.parents.replaceChildren(...rows)
}

/** El enlace "Qué es..." a la nota de un slug, con el texto que le toque. */
function noteLink(slug, texto) {
  const a = document.createElement('a')
  a.href = noteHref(slug)
  a.textContent = texto
  return a
}

/** El enlace "Qué es..." del objeto de la ficha (NOTA-R3). */
function objectNoteLink(obj) {
  return noteLink(
    NOTE_BY_TYPE[obj.t],
    `Qué es ${TYPES[obj.t].det} ${TYPES[obj.t].label.toLowerCase()} →`,
  )
}

/**
 * El panel de identidad del objeto: nombre, metadatos, enlace a su nota y
 * su descarga propia.
 */
function showObjectIdentity(obj) {
  el.name.textContent = obj.n ?? `${TYPES[obj.t].label} ${obj.c}`
  el.meta.textContent = obj.p && obj.p !== obj.n
    ? `${TYPES[obj.t].label} · ${obj.p} · código ${obj.c}`
    : `${TYPES[obj.t].label} · código ${obj.c}`
  el.note.replaceChildren(objectNoteLink(obj))
  el.self.replaceChildren(
    downloadButton(selfUrl(obj), `Descargar ${TYPES[obj.t].det} ${TYPES[obj.t].label.toLowerCase()}`),
  )
}

/**
 * El panel de identidad de una fila de capa: nombre, metadatos, enlace a la
 * nota de esa capa y su descarga. Los campos salen de `specOf`, la misma
 * spec que arma la tabla, así que ficha y tabla no pueden decir cosas
 * distintas de la misma fila.
 *
 * Se reemplaza entero, nunca se le agrega nada a lo que había: es lo que
 * separa esto del bug viejo, donde cada "Ver" le pegaba otro tramo de texto
 * a #detail-meta sin límite.
 *
 * `count` sólo importa en vías: ahí el código identifica una calle entera y
 * `row` describe uno solo de los tramos que el mapa está dibujando, así que
 * la ficha dice cuántos son en vez de repetir campos de un tramo suelto
 * como si fueran de la calle (ver más abajo).
 */
function showFeatureIdentity(layerKey, row, count) {
  const spec = specOf(layerKey)
  const codigo = String(row[spec.idField] ?? '')

  // El singular sale del `label` de la nota de esa capa, que ya está en
  // singular ("Radio censal"). Derivarlo de CHILD_LAYERS con un replace
  // daría "Radios censale": el plural del INDEC no se deshace con un regex.
  const singular = noteFor(NOTE_BY_LAYER[layerKey]).label

  el.name.textContent = spec.titleField && row[spec.titleField]
    ? row[spec.titleField]
    : `${singular} ${codigo}`

  el.meta.textContent = spec.columns
    .filter((c) => row[c.field] !== undefined && row[c.field] !== '')
    .map((c) => `${c.label}: ${c.map ? c.map(row[c.field]) : row[c.field]}`)
    .join(' · ')

  // Una vía es la excepción: el código identifica la calle y sus tramos lo
  // comparten, así que `row` describe uno solo de los que el mapa está
  // dibujando. Los campos de tramo —alturas, id— mienten sobre la calle, así
  // que en su lugar la ficha dice cuántos tramos son.
  if (layerKey === 'vias') {
    el.meta.textContent = count > 1
      ? `Código ${codigo} · el INDEC la publica partida en ${fmt(count)} tramos`
      : `Código ${codigo} · un solo tramo`
  }

  el.note.replaceChildren(noteLink(NOTE_BY_LAYER[layerKey], `Qué es ${singular.toLowerCase()} →`))

  el.self.replaceChildren(
    isCode(codigo)
      ? downloadButton(featureUrl(layerKey, codigo), `Descargar ${singular.toLowerCase()}`)
      : disabledButton('Descargar', 'El INDEC no publicó el código de esta fila.'),
  )
}

/**
 * Dibuja la ficha del objeto que pide la URL. `initialLayer` es la capa que
 * el enlace quiere abierta; el browser la ignora si el objeto no la tiene.
 *
 * `layerRequested` es si el enlace nombró alguna capa, la tenga el objeto o
 * no y exista o no: es lo que decide si la pestaña que se abre se escribe
 * en la barra. No alcanza con mirar `initialLayer`, que es `null` también
 * cuando la capa nombrada no existe —y ahí la barra ya afirmó algo falso
 * que hay que corregir (ver `permalink.parse`)—.
 *
 * `initialPage` es la página que el enlace recordaba para `initialLayer`:
 * el browser la ignora si no hay capa, igual que ignora una capa que el
 * objeto no tiene.
 */
function selectObject(obj, initialLayer = null, layerRequested = initialLayer !== null, initialPage = 0) {
  // Antes de `show`: el `onTab` del browser dispara en el mismo momento en
  // que se arma la primera pestaña, y necesita saber de quién es la ficha y
  // si esa primera pestaña se escribe en la barra (ver `writeTab`).
  current = obj
  writeTab = layerRequested
  // Un objeto sin catálogo no tiene nombre publicado: el campo muestra su
  // código, que es como se llegó hasta acá.
  el.q.value = obj.n ?? obj.c
  setStatus(el.status, '')

  showObjectIdentity(obj)
  renderParents(obj)
  renderChildren(obj)
  // Mismo principio que `renderParents` y `renderChildren`: la fila se
  // esconde según lo que devuelve quien la arma, no según un predicado
  // recalculado acá aparte.
  el.rowBrowse.hidden = !browser.show(obj, initialLayer, initialPage)
  writeTab = true
  el.detail.hidden = false
  // `#detail` estaba oculto cuando `initMap` armó el mapa, así que Leaflet
  // midió 0×0: hay que avisarle recién ahora, se dibuje algo enseguida o no
  // (ver SITIO-R3 dos líneas abajo).
  syncMapSize()
  // SITIO-R3: nada de vías se pide sin un acto explícito. Un enlace a un
  // tramo abre mostrando el costo medido y un botón, igual que la pestaña
  // (NAV-R7). Lo que sí funciona sin red es la descarga: sólo necesita el
  // código, que ya está en la URL.
  if (obj.t === 'via') el.self.append(loadFeatureButton(obj))
  else drawObject(obj)
}

/** El costo medido y el botón que sí dispara el pedido (SITIO-R3, NAV-R7). */
function loadFeatureButton(obj) {
  return costPanel({
    message: VIAS_VIEW_NOTICE,
    id: 'load-feature',
    onClick: (b) => {
      b.disabled = true
      b.textContent = 'Cargando…'
      // Con el GeoServer del INDEC un corte de conexión es más probable que
      // un 500 (ver map.js), y este botón es la única acción de la ficha:
      // si el fallo lo deja apagado, la página se queda sin ninguna salida.
      drawObject(obj, () => {
        b.disabled = false
        b.textContent = 'Cargar igual'
      })
    },
  })
}

/**
 * El objeto que la URL direcciona no existe (DES-R11).
 *
 * No se esconde la ficha ni se manda al buscador: el enlace prometía un
 * objeto concreto y lo útil es decir cuál no está, con su código a la vista
 * para que se pueda comparar contra la fuente. Lo que se apaga es la
 * descarga, con su motivo, igual que DES-R8 hace con una fila sin código.
 */
function showMissing(obj) {
  const label = TYPES[obj.t].label.toLowerCase()
  const motivo = `El INDEC no publica ${TYPES[obj.t].det} ${label} con código ${obj.c}: el objeto no existe.`
  setStatus(el.status, motivo, true)
  el.self.replaceChildren(disabledButton('Descargar', motivo))
}

/**
 * Dibuja el objeto de la ficha en el mapa. Va después de destapar `#detail`
 * y de `syncMapSize()`: sin eso Leaflet sigue midiendo lo que midió con el
 * panel oculto, que es 0×0.
 *
 * Un mapa que no se puede dibujar no rompe la ficha: las descargas —que son
 * a lo que se vino— siguen ahí, así que el fallo se avisa y se sigue.
 *
 * `onFail` es para quien haya dejado algo deshabilitado mientras esperaba
 * —hoy sólo el botón "Cargar igual" de una vía—: sin avisarle del fallo,
 * ese botón queda apagado para siempre y la página pierde su única acción.
 */
function drawObject(obj, onFail = () => {}) {
  showObject(obj)
    .then((drawn) => {
      // Un objeto sin catálogo llega a la página con nada más que su tipo y
      // su código: los campos que lo describen los trae el mismo pedido que
      // dibuja el mapa, así que la identidad se completa acá y no antes.
      if (!drawn) return
      // El servidor contestó y no tiene ese objeto. El largo del código lo
      // dejó pasar —nueve dígitos es el largo correcto de un radio— así que
      // hasta acá la ficha lo ofrecía como si existiera (DES-R11).
      if (drawn.count === 0) return showMissing(obj)
      if (!TYPES[obj.t].catalogo) {
        showFeatureIdentity(LAYER_OF_TYPE[obj.t], drawn.props, drawn.count)
      }
    })
    .catch((err) => {
      setStatus(el.status, `No se pudo dibujar el objeto en el mapa: ${err.message}. Las descargas siguen funcionando.`, true)
      onFail()
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
      .catch(() => setStatus(el.status, 'No se pudo copiar el enlace: copialo de la barra del navegador.', true))
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
    /**
     * Una fila hija es un objeto direccionable como cualquier otro: verla es
     * ir a su ficha, no reemplazar media ficha de otro objeto. Eso es SITIO-R2
     * aplicado a un caso más, y es lo que borra el andamiaje entero que
     * existía para que la ficha y el mapa no se contradijeran (NAV-R11).
     */
    onView: (row, key) => {
      const codigo = String(row[specOf(key).idField])
      navigate(format({ t: TYPE_OF_LAYER[key], c: codigo }))
    },
    onError: () => {},
    onTab: (layer) => {
      // Reescribe la barra sin navegar: la URL sigue describiendo lo que se
      // ve, y atrás vuelve a de dónde se vino, no a la pestaña anterior.
      if (current && writeTab) window.history.replaceState({}, '', format(current, layer, 0))
    },
    // La página de la tabla viaja en el permalink (SITIO-R2): sin esto, el
    // Atrás del navegador —que reemplazó al botón "Volver a <objeto>" cuando
    // "Ver" pasó a navegar (NAV-R11)— devolvería siempre a la página 1.
    //
    // El mismo `writeTab` que usa `onTab`: la primera pestaña se auto-carga
    // sola al armar la fila y dispara su propio `onPage`, así que sin esta
    // guarda un enlace sin `capa=` terminaría con `capa=` igual apenas
    // cargara la primera página.
    onPage: (layer, page) => {
      if (current && writeTab) window.history.replaceState({}, '', format(current, layer, page))
    },
  })

  setupCopyLink(el.copyLink)

  const url = parse(window.location.search)

  loadCatalog()
    .then((c) => {
      index = codeIndex(c.objects)
      searchbox.setObjects(c.objects)
      el.generated.textContent = `Catálogo generado el ${c.generated} · ${fmt(c.objects.length)} objetos.`

      if (url.status === 'empty') return setStatus(el.status, 'Buscá un objeto para verlo en el mapa.')
      if (url.status === 'invalid') return setStatus(el.status, `Ese enlace no se puede abrir: ${url.reason}`, true)

      // El catálogo dice qué objetos se pueden buscar por nombre, no cuáles
      // existen: fracciones, radios y vías se resuelven contra el GeoServer,
      // que es quien los tiene.
      const obj = TYPES[url.type].catalogo
        ? c.objects.find((o) => o.t === url.type && o.c === url.code)
        : { t: url.type, c: url.code }
      if (!obj) return setStatus(el.status, `No hay ningún objeto con el código ${url.code} en el catálogo.`, true)

      initMap('map') // recién acá: sin objeto no hay nada que dibujar
      selectObject(obj, url.layer, url.layerRequested, url.page)
      el.q.focus()
    })
    .catch((err) => {
      setStatus(el.status, `No se pudo cargar el catálogo: ${err.message}`, true)
    })
}

initResultados()
