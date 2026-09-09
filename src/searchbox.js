import { search, codeMatches, TYPE_ORDER } from './search.js'
import { TYPES } from './download.js'
import { createCombobox } from './combobox.js'

/** Cada resultado muestra el nombre y, al lado, de qué tipo es. */
function renderOption(obj) {
  const frag = document.createDocumentFragment()
  const name = document.createElement('span')
  name.textContent = obj.n
  const kind = document.createElement('span')
  kind.className = 'kind'
  kind.textContent = obj.p && obj.p !== obj.n
    ? `${TYPES[obj.t].label} · ${obj.p}`
    : TYPES[obj.t].label
  frag.append(name, kind)
  return frag
}

/**
 * Las opciones del filtro salen de TYPE_ORDER y TYPES, no del HTML: el
 * orden y las etiquetas quedan en un solo lugar. El valor vacío es
 * "todos", que es donde arranca (BUS-R1).
 */
function typeOption(value, label) {
  const option = document.createElement('option')
  option.value = value
  option.textContent = label
  return option
}

/**
 * El buscador, sin saber qué se hace con lo que se elige. El home navega y
 * /resultados/ también, pero eso lo decide cada página: acá sólo se busca.
 *
 * El catálogo llega por `setObjects` porque pesa 673 KB y el home no lo
 * pide hasta que alguien toca el campo.
 */
export function createSearchBox({ input, select, list, onPick }) {
  let objects = null

  // `replaceChildren` y no `append`: los módulos de página se auto-invocan
  // y tienen que poder cablearse de nuevo sin duplicar las opciones.
  select.replaceChildren(
    typeOption('', 'Todos los tipos'),
    ...TYPE_ORDER.map((t) => typeOption(t, TYPES[t].plural)),
  )

  const combo = createCombobox({ input, list, renderOption, onSelect: onPick })

  function runSearch() {
    if (!objects) return
    const q = input.value.trim()
    // Las dos listas nunca se pisan: ningún código del catálogo mide 7, 9 ni
    // 13 caracteres, que son los tres largos que arman fila sintética.
    combo.render([
      ...search(objects, q, { type: select.value }),
      ...codeMatches(q, { type: select.value }),
    ])
  }

  // El `change` también busca: cambiar de tipo tiene que acotar lo que ya
  // está escrito, sin obligar a volver a tipear.
  input.addEventListener('input', runSearch)
  select.addEventListener('change', runSearch)

  return {
    setObjects(next) {
      objects = next
      runSearch()
    },
  }
}
