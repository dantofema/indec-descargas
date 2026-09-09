/**
 * Pestañas con el patrón tablist de WAI-ARIA. No sabe qué hay adentro de
 * cada una: avisa cuál se eligió y el dueño decide qué dibujar.
 *
 * Hoy tiene un solo llamador, la fila de capas hijas (`browser.js`). La
 * fila de notas que también lo usaba dejó de existir (NOTA-R3), y `/notas/`
 * explica en `pages/notas.js` por qué su tablist vertical no lo reusa.
 */
export function createTabs({ container, items, onSelect }) {
  container.replaceChildren()
  if (!items.length) return { select: () => {}, destroy: () => container.replaceChildren() }

  const list = document.createElement('div')
  list.className = 'tabs'
  list.setAttribute('role', 'tablist')
  let active = null

  const buttons = items.map((item) => {
    const b = document.createElement('button')
    b.className = 'tab'
    b.type = 'button'
    b.setAttribute('role', 'tab')
    b.setAttribute('aria-selected', 'false')
    b.textContent = item.label
    if (item.badge) {
      const n = document.createElement('span')
      n.className = 'n'
      n.textContent = ` ${item.badge}`
      b.append(n)
    }
    b.addEventListener('click', () => select(item.key))
    list.append(b)
    return b
  })

  function select(key) {
    // Volver a la que ya está no vuelve a pedir la página.
    if (key === active) return
    active = key
    items.forEach((item, i) => buttons[i].setAttribute('aria-selected', String(item.key === key)))
    onSelect(key)
  }

  container.append(list)
  select(items[0].key)
  return { select, destroy: () => container.replaceChildren() }
}
