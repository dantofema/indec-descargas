import { specOf } from './columns.js'
import { featureUrl } from './download.js'
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
    headRow.append(th)
  }
  headRow.append(document.createElement('th'))
  thead.append(headRow)

  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    for (const col of spec.columns) {
      const td = document.createElement('td')
      if (col.kind !== 'text') td.className = col.kind
      const raw = row[col.field] ?? ''
      td.textContent = col.map ? col.map(String(raw)) : String(raw)
      tr.append(td)
    }

    const acts = document.createElement('td')
    acts.className = 'acts'
    const ver = document.createElement('button')
    ver.type = 'button'
    ver.className = 'btn ghost mini'
    ver.textContent = 'Ver'
    // `onView` lleva la capa además de la fila: es lo único que en este
    // punto sabe de qué capa vino el objeto, y quien mira el detalle
    // necesita ese dato para pedirle la geometría al GeoServer.
    ver.addEventListener('click', () => onView(row, childKey))
    acts.append(ver, downloadButton(featureUrl(childKey, String(row[spec.idField])), 'Descargar', 'mini'))
    tr.append(acts)
    tbody.append(tr)
  }

  table.append(thead, tbody)
  wrap.append(table)
  return wrap
}

/** Anterior / dónde estoy / siguiente. El total lo manda el servidor. */
export function renderPager({ page, total, onPage }) {
  const wrap = document.createElement('div')
  wrap.className = 'pager'
  const last = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)
  const desde = total === 0 ? 0 : page * PAGE_SIZE + 1
  const hasta = Math.min(total, (page + 1) * PAGE_SIZE)

  const prev = document.createElement('button')
  prev.type = 'button'
  prev.textContent = 'Anterior'
  prev.disabled = page <= 0
  prev.addEventListener('click', () => onPage(page - 1))

  const donde = document.createElement('span')
  donde.className = 'where'
  donde.textContent = `${fmt(desde)}–${fmt(hasta)} de ${fmt(total)}`

  const next = document.createElement('button')
  next.type = 'button'
  next.textContent = 'Siguiente'
  next.disabled = page >= last
  next.addEventListener('click', () => onPage(page + 1))

  wrap.append(prev, donde, next)
  return wrap
}
