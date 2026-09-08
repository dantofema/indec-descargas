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
function notaActual() {
  return noteFor(location.hash.slice(1)) ?? NOTES[0]
}

function pintarParrafo(texto) {
  const p = document.createElement('p')
  p.textContent = texto
  return p
}

/** Dibuja el navegador vertical una sola vez: la lista de notas no cambia. */
function pintarNav() {
  const nav = document.querySelector('#nota-nav')
  if (!nav) return
  nav.replaceChildren(...NOTES.map((nota) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'nota-tab'
    b.setAttribute('role', 'tab')
    b.setAttribute('aria-selected', 'false')
    b.dataset.slug = nota.slug
    b.textContent = nota.label
    // El click repinta al toque: `hashchange` es async (una tarea en cola)
    // y de ahí no alcanza para que el clic se vea de inmediato. El listener
    // de más abajo sigue haciendo falta para atrás/adelante del navegador,
    // que no pasan por acá.
    b.addEventListener('click', () => {
      location.hash = nota.slug
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

  const nota = notaActual()
  titulo.textContent = nota.label
  total.textContent = `${fmt(nota.total)} en el Marco Geoestadístico.`
  cuerpo.replaceChildren(...nota.paragraphs.map(pintarParrafo))

  document.querySelectorAll('#nota-nav [role="tab"]').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.slug === nota.slug))
  })
}

let escuchando = false

/**
 * Idempotente a propósito: este módulo es el entry de Vite, así que se
 * auto-invoca abajo, y los tests la vuelven a llamar sobre el mismo DOM
 * montado. Repintar con `replaceChildren` (nunca `append`) y escuchar
 * `hashchange` una sola vez por instancia del módulo es lo que hace que
 * llamarla de nuevo no duplique nada.
 */
export function initNotas() {
  pintarNav()
  render()
  if (!escuchando) {
    window.addEventListener('hashchange', render)
    escuchando = true
  }
}

initNotas()
