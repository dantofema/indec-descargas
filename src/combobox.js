/**
 * Combobox con listbox: teclado, estado ARIA y apertura/cierre. El dueño
 * pone los dos elementos, cómo se dibuja cada opción y qué pasa al elegir.
 *
 * El patrón sigue el APG de WAI-ARIA: el foco nunca sale del input, la
 * opción activa se señala con `aria-activedescendant`, y la lista se
 * cierra cuando el foco se va del campo.
 */
export function createCombobox({ input, list, renderOption, onSelect }) {
  let items = []
  let highlighted = -1

  function show(open) {
    list.hidden = !open
    input.setAttribute('aria-expanded', String(open))
    if (!open) setHighlight(-1)
  }

  function setHighlight(i) {
    const lis = list.children
    if (highlighted >= 0 && lis[highlighted]) lis[highlighted].removeAttribute('aria-selected')
    highlighted = i
    if (i < 0 || !lis[i]) {
      input.removeAttribute('aria-activedescendant')
      return
    }
    lis[i].setAttribute('aria-selected', 'true')
    input.setAttribute('aria-activedescendant', lis[i].id)
    // La lista scrollea: el resaltado tiene que quedar a la vista.
    lis[i].scrollIntoView({ block: 'nearest' })
  }

  /** Mueve el resaltado. Devuelve si hizo algo, para no comerse la tecla. */
  function move(delta) {
    if (!items.length) return false
    if (list.hidden) show(true)
    const n = items.length
    setHighlight(highlighted < 0 ? (delta > 0 ? 0 : n - 1) : (highlighted + delta + n) % n)
    return true
  }

  function select(obj) {
    show(false)
    onSelect(obj)
  }

  function render(objs) {
    items = objs
    setHighlight(-1)
    list.replaceChildren()
    if (!objs.length) {
      show(false)
      return
    }
    objs.forEach((obj, i) => {
      const li = document.createElement('li')
      li.setAttribute('role', 'option')
      li.id = `${list.id}-option-${i}`
      li.append(renderOption(obj))
      li.addEventListener('click', () => select(obj))
      list.append(li)
    })
    show(true)
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      show(false)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Sólo si movió: si no hay nada que recorrer, la flecha sigue
      // sirviendo para mover el cursor dentro del campo.
      if (move(e.key === 'ArrowDown' ? 1 : -1)) e.preventDefault()
    } else if (e.key === 'Enter' && !list.hidden && highlighted >= 0) {
      e.preventDefault()
      select(items[highlighted])
    }
  })

  // Tab, o cualquier otra cosa que se lleve el foco, cierra la lista: si
  // no, queda flotando sobre el contenido con aria-expanded="true".
  input.addEventListener('focusout', () => show(false))

  // El mousedown sacaría el foco del input y el focusout cerraría la lista
  // antes de que el click llegue a la opción.
  list.addEventListener('mousedown', (e) => e.preventDefault())

  return { render }
}
