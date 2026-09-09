/** Piezas de interfaz que comparten la ficha del objeto y sus capas hijas. */

/** Formatea un entero con separador de miles en castellano. */
export const fmt = (n) => n.toLocaleString('es-AR')

/**
 * Enlace de descarga. No lleva atributo `download`: el href siempre es
 * cross-origin y el browser lo ignora ahí. El nombre del archivo lo pone
 * el `Content-Disposition` que arma `format_options` (ver download.js).
 *
 * `extra` es para variantes de tamaño o énfasis (p.ej. `mini`, en las
 * filas de una tabla) sin duplicar esta función.
 */
export function downloadButton(href, label, extra = '') {
  const a = document.createElement('a')
  a.className = extra ? `btn ${extra}` : 'btn'
  a.href = href
  a.textContent = label
  return a
}

/**
 * El panel de una capa cara: qué cuesta y un botón para pedirla igual
 * (NAV-R7, SITIO-R3). Lo usan los dos lugares donde el sitio cobra una
 * espera medida —la pestaña de vías y la ficha de una vía—, y vive acá
 * para que sigan siendo el mismo panel: son la misma promesa hecha en dos
 * pantallas, y dos copias del markup es cómo terminan viéndose distinto.
 *
 * El `id` es opcional porque sólo uno de los dos necesita que un test lo
 * agarre sin ambigüedad: en la fila 3 hay pestañas que también son `button`.
 */
export function costPanel({ message, onClick, id }) {
  const wrap = document.createElement('div')
  const p = document.createElement('p')
  p.className = 'note'
  p.textContent = message
  const b = document.createElement('button')
  b.type = 'button'
  if (id) b.id = id
  b.className = 'btn ghost mini'
  b.textContent = 'Cargar igual'
  b.addEventListener('click', () => onClick(b))
  wrap.append(p, b)
  return wrap
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

/**
 * El mensaje de estado de una página: qué dice, si es un error y si se ve.
 * La clase `error` es contrato con `.status.error` de style.css.
 *
 * Recibe el nodo en vez de leerlo de un `el` compartido: home y resultados
 * tienen sets de nodos distintos, así que abstraer eso sería peor que
 * pasarle el único nodo que esta función toca.
 */
export function setStatus(node, text, isError = false) {
  node.textContent = text
  node.classList.toggle('error', isError)
  node.hidden = !text
}
