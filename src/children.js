import { childrenOf } from './catalog.js'
import { childUrl, canDownload, CHILD_LAYERS } from './download.js'
import { fmt, downloadButton, disabledButton } from './ui.js'

/**
 * Una fila por capa hija: etiqueta, conteo y el botón que el tope habilita
 * o no. Acá viven DES-R2 (superar el tope deshabilita, no recorta) y
 * DES-R3 (conteo cero también deshabilita), así que el tope entra por
 * parámetro —sale del catálogo, DES-R5— y nunca se lee de una constante.
 */
export function childRows(obj, maxFeatures) {
  return childrenOf(obj).map(({ key, count }) => {
    const li = document.createElement('li')
    const left = document.createElement('div')
    const label = document.createElement('div')
    label.textContent = CHILD_LAYERS[key].label
    const n = document.createElement('div')
    n.className = 'count'
    n.textContent = count === 1 ? '1 objeto' : `${fmt(count)} objetos`
    left.append(label, n)

    li.append(left, rightSide(obj, key, count, maxFeatures))
    return li
  })
}

function rightSide(obj, key, count, maxFeatures) {
  if (count === 0) {
    return disabledButton('Descargar', 'No hay objetos de esta capa acá.')
  }
  if (!canDownload(count, maxFeatures)) {
    return disabledButton(
      'Descargar',
      `Son ${fmt(count)} objetos y el máximo por descarga es ${fmt(maxFeatures)}. ` +
      'Probá con un objeto más chico.',
    )
  }

  const button = downloadButton(childUrl(obj, key), 'Descargar')
  if (key !== 'vias') return button

  const wrap = document.createElement('div')
  const note = document.createElement('p')
  note.className = 'note'
  note.textContent = 'Las vías tardan: el servidor del INDEC puede demorar un minuto o más en responder.'
  wrap.append(button, note)
  return wrap
}
