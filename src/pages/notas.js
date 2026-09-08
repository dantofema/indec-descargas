/**
 * La página de notas: navegador vertical de objetos a la izquierda, nota
 * elegida a la derecha. No decide contenido —eso vive en `notes.js`— sólo
 * lo cablea contra el DOM y la URL.
 *
 * No reusa `createTabs` de `tabs.js`: ese helper selecciona siempre el
 * primer ítem al montar y no expone el `slug` en el DOM, y acá la
 * selección inicial la manda el ancla de la URL —no siempre la primera
 * nota— y el test elige una nota por `data-slug`. Adaptar `createTabs` a
 * las dos cosas hubiera sido más código que este tablist vertical propio.
 */
import { NOTES, noteFor } from '../notes.js'
import { fmt } from '../ui.js'

/** La nota que corresponde al ancla actual, o la primera si no hay o no existe. */
function currentNote() {
  return noteFor(location.hash.slice(1)) ?? NOTES[0]
}

function renderParagraph(texto) {
  const p = document.createElement('p')
  p.textContent = texto
  return p
}

/**
 * Las fuentes externas de una nota (NOTA-R2). La lista queda vacía —y por
 * lo tanto invisible— en las notas que sólo afirman lo que el catálogo y el
 * GeoServer ya sostienen, que son la mayoría.
 */
function renderFuente({ label, href }) {
  const li = document.createElement('li')
  const a = document.createElement('a')
  a.href = href
  a.textContent = label
  a.rel = 'noopener'
  a.target = '_blank'
  li.append(a)
  return li
}

/** Dibuja el navegador vertical una sola vez: la lista de notas no cambia. */
function renderNav() {
  const nav = document.querySelector('#nota-nav')
  if (!nav) return
  nav.replaceChildren(...NOTES.map((note) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'nota-tab'
    b.setAttribute('role', 'tab')
    b.setAttribute('aria-selected', 'false')
    b.dataset.slug = note.slug
    b.textContent = note.label
    // El click repinta al toque: `hashchange` es async (una tarea en cola)
    // y de ahí no alcanza para que el clic se vea de inmediato. El listener
    // de más abajo sigue haciendo falta para atrás/adelante del navegador,
    // que no pasan por acá.
    b.addEventListener('click', () => {
      location.hash = note.slug
      render()
    })
    return b
  }))
}

/** Repinta el panel y marca la pestaña activa según el ancla actual. */
function render() {
  const titulo = document.querySelector('#nota-titulo')
  const total = document.querySelector('#nota-total')
  const cuerpo = document.querySelector('#nota-cuerpo')
  if (!titulo || !total || !cuerpo) return

  const note = currentNote()
  titulo.textContent = note.label
  total.textContent = `${fmt(note.total)} en el Marco Geoestadístico.`
  cuerpo.replaceChildren(...note.paragraphs.map(renderParagraph))

  const fuentes = document.querySelector('#nota-fuentes')
  if (fuentes) fuentes.replaceChildren(...(note.sources ?? []).map(renderFuente))

  document.querySelectorAll('#nota-nav [role="tab"]').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.slug === note.slug))
  })
}

let listening = false

/**
 * Idempotente a propósito: este módulo es el entry de Vite, así que se
 * auto-invoca abajo, y los tests la vuelven a llamar sobre el mismo DOM
 * montado. Repintar con `replaceChildren` (nunca `append`) y escuchar
 * `hashchange` una sola vez por instancia del módulo es lo que hace que
 * llamarla de nuevo no duplique nada.
 */
export function initNotas() {
  renderNav()
  render()
  if (!listening) {
    window.addEventListener('hashchange', render)
    listening = true
  }
}

initNotas()
