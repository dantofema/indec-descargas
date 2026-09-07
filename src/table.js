import { specOf } from './columns.js'
import { featureUrl, isCode } from './download.js'
import { PAGE_SIZE } from './features.js'
import { fmt, downloadButton } from './ui.js'

/** La tabla de una página de hijos. Recibe las filas ya traídas. */
export function renderTable(childKey, rows, onView) {
  const wrap = document.createElement('div')
  wrap.className = 'table-scroll'

  if (!rows.length) {
    const vacio = document.createElement('p')
    vacio.className = 'meta'
    vacio.textContent = 'No hay objetos de esta capa.'
    wrap.append(vacio)
    return wrap
  }

  const spec = specOf(childKey)
  const table = document.createElement('table')
  // La capa decide si es ancha (ver `wide` en columns.js), no se lo adivina
  // acá contando columnas: una capa futura de 9 campos no necesita por eso
  // el scroll horizontal y la columna fija (ver la regla `.wide` en style.css).
  if (spec.wide) table.className = 'wide'

  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const col of spec.columns) {
    const th = document.createElement('th')
    th.textContent = col.label
    // `col-anchor` es la columna que la capa eligió fijar (ver `anchorField`
    // en columns.js), no la primera: en vías es `fna`, no `id`. Sin
    // `anchorField` declarado esto nunca matchea y no se marca nada.
    if (col.field === spec.anchorField) th.className = 'col-anchor'
    headRow.append(th)
  }
  headRow.append(document.createElement('th'))
  thead.append(headRow)

  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    for (const col of spec.columns) {
      const td = document.createElement('td')
      const classes = [col.kind !== 'text' ? col.kind : null, col.field === spec.anchorField ? 'col-anchor' : null].filter(Boolean)
      if (classes.length) td.className = classes.join(' ')
      const raw = row[col.field] ?? ''
      td.textContent = col.map ? col.map(String(raw)) : String(raw)
      tr.append(td)
    }

    tr.append(actionCell(spec, childKey, row, onView))
    tbody.append(tr)
  }

  table.append(thead, tbody)
  wrap.append(table)
  return wrap
}

/**
 * "Ver" y "Descargar" de una fila, o el motivo de que no los tenga.
 *
 * Las dos acciones interpolan el código en un filtro CQL, así que sin
 * código no hay ninguna de las dos: el GeoServer puede devolver una fila sin
 * el campo identificador —DES-R8 documenta que los códigos del INDEC no
 * cierran entre capas— y eso es un dato faltante, no un error de programa.
 * Antes reventaba `renderTable` entera y browser.js lo mostraba como "No se
 * pudo traer la lista", culpando a una red que había funcionado.
 */
function actionCell(spec, childKey, row, onView) {
  const acts = document.createElement('td')
  acts.className = 'acts'

  const raw = row[spec.idField]
  const code = raw == null ? null : String(raw)
  if (!isCode(code)) {
    const motivo = document.createElement('p')
    motivo.className = 'note'
    motivo.textContent = `Sin código (${spec.idField}): el INDEC no lo publicó para esta fila, así que no se puede verla ni descargarla sola.`
    acts.append(motivo)
    return acts
  }

  const ver = document.createElement('button')
  ver.type = 'button'
  ver.className = 'btn ghost mini'
  ver.textContent = 'Ver'
  // `onView` lleva la capa además de la fila: es lo único que en este
  // punto sabe de qué capa vino el objeto, y quien mira el detalle
  // necesita ese dato para pedirle la geometría al GeoServer.
  ver.addEventListener('click', () => onView(row, childKey))
  acts.append(ver, downloadButton(featureUrl(childKey, code), 'Descargar', 'mini'))
  return acts
}

/**
 * Anterior / dónde estoy / siguiente. El total lo manda el servidor, y WFS
 * admite que conteste `"totalFeatures": "unknown"`: ahí no hay última página
 * que calcular, y lo único que se sabe es si esta página vino llena.
 */
export function renderPager({ page, total, count = 0, onPage }) {
  const wrap = document.createElement('div')
  wrap.className = 'pager'
  const known = Number.isFinite(total)
  const enEstaPagina = known ? Math.max(0, Math.min(total, (page + 1) * PAGE_SIZE) - page * PAGE_SIZE) : count
  const desde = enEstaPagina === 0 ? 0 : page * PAGE_SIZE + 1
  const hasta = page * PAGE_SIZE + enEstaPagina

  const prev = document.createElement('button')
  prev.type = 'button'
  prev.textContent = 'Anterior'
  prev.disabled = page <= 0
  prev.addEventListener('click', () => onPage(page - 1))

  const donde = document.createElement('span')
  donde.className = 'where'
  donde.textContent = known
    ? `${fmt(desde)}–${fmt(hasta)} de ${fmt(total)}`
    : `${fmt(desde)}–${fmt(hasta)} · el servidor no informó el total`

  const next = document.createElement('button')
  next.type = 'button'
  next.textContent = 'Siguiente'
  // Sin total no hay última página que comparar: una página llena es lo
  // único que dice que puede haber otra. Habilitarlo igual dejaba
  // "Siguiente" vivo para siempre, y en vías cada clic en esa nada cuesta
  // entre 14 y 99 segundos medidos.
  next.disabled = known
    ? page >= Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)
    : count < PAGE_SIZE
  next.addEventListener('click', () => onPage(page + 1))

  wrap.append(prev, donde, next)
  return wrap
}
