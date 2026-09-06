import { childUrl, childOf } from './download.js'
import { childrenOf } from './catalog.js'
import { fmt, downloadButton, disabledButton } from './ui.js'

/**
 * Bytes por feature, medidos el 2026-09-06 contra el GeoServer: los 23.901
 * radios de Buenos Aires pesaron 22 MB y sus 179.029 vías, 74 MB. Las líneas
 * pesan menos de la mitad que los polígonos.
 */
const BYTES_PER_FEATURE = { vias: 420 }
const BYTES_DEFAULT = 973

/** 74 MB en 37 s en la medición del peor caso. */
const BYTES_PER_SECOND = 2 * 1024 * 1024

/**
 * A partir de acá el archivo tarda lo suficiente como para que valga
 * advertirlo. Por debajo no se dice nada: son casi todas las descargas.
 */
const NOTICE_THRESHOLD = 10 * 1024 * 1024

/**
 * La capa de vías tiene ~20 s de demora fija del servidor, sin relación
 * con el tamaño del pedido: 1.487 vías (795 KB) tardan 21,3 s, 4.260
 * (4,3 MB) tardan 19,5 s y las 179.029 del peor caso (74 MB) tardan 37 s.
 * `estimateSeconds` calcula por bytes y para el pedido chico da 0,4 s, 50
 * veces menos que la realidad: este aviso es incondicional y no usa esa
 * cuenta.
 */
const LATENCY_NOTICE = 'El servidor del INDEC tarda unos 20 segundos en empezar a responder esta capa, aun para pocas vías.'

export function estimateBytes(childKey, count) {
  return (BYTES_PER_FEATURE[childKey] ?? BYTES_DEFAULT) * count
}

export function estimateSeconds(bytes) {
  return Math.round(bytes / BYTES_PER_SECOND)
}

/**
 * Aviso de peso, o `null` si el archivo es chico. Se dice antes del clic:
 * la descarga la toma el gestor del browser y no hay progreso que mostrar.
 */
export function weightNotice(childKey, count) {
  const bytes = estimateBytes(childKey, count)
  if (bytes <= NOTICE_THRESHOLD) return null
  const mb = Math.round(bytes / (1024 * 1024))
  return `Archivo grande: unos ${fmt(mb)} MB, cerca de ${fmt(estimateSeconds(bytes))} segundos.`
}

/** Una fila por capa hija, con su conteo y su descarga. */
export function childRows(obj) {
  return childrenOf(obj).map(({ key, count }) => {
    const child = childOf(key)
    const li = document.createElement('li')
    const who = document.createElement('span')
    who.className = 'who'
    who.textContent = child.label

    const cuenta = document.createElement('span')
    cuenta.className = 'count'
    cuenta.textContent = ` · ${fmt(count)}`
    who.append(cuenta)

    if (count === 0) {
      li.append(who, disabledButton('Descargar', `No hay ${child.label.toLowerCase()} en este objeto.`))
      return li
    }

    if (key === 'vias') {
      const demora = document.createElement('span')
      demora.className = 'heavy'
      demora.textContent = LATENCY_NOTICE
      who.append(demora)
    }

    const aviso = weightNotice(key, count)
    if (aviso) {
      const nota = document.createElement('span')
      nota.className = 'heavy'
      nota.textContent = aviso
      who.append(nota)
    }
    li.append(who, downloadButton(childUrl(obj, key), 'Descargar'))
    return li
  })
}
