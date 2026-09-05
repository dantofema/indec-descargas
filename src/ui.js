/** Piezas de interfaz que comparten la ficha del objeto y sus capas hijas. */

/** Formatea un entero con separador de miles en castellano. */
export const fmt = (n) => n.toLocaleString('es-AR')

/**
 * Enlace de descarga. No lleva atributo `download`: el href siempre es
 * cross-origin y el browser lo ignora ahí. El nombre del archivo lo pone
 * el `Content-Disposition` que arma `format_options` (ver download.js).
 */
export function downloadButton(href, label) {
  const a = document.createElement('a')
  a.className = 'btn'
  a.href = href
  a.textContent = label
  return a
}

/** Botón muerto con el motivo al lado, para cuando la descarga no se ofrece. */
export function disabledButton(label, reason) {
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
