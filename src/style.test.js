import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8')

/** Los dos bloques `:root`: el primero es el claro, el segundo el oscuro. */
function palettes() {
  const blocks = [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1])
  const read = (block) => Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  )
  const light = read(blocks[0])
  return { light, dark: { ...light, ...read(blocks[1] ?? '') } }
}

/** Resuelve las indirecciones `var(--x)` hasta llegar al color. */
function resolve(name, tokens) {
  let value = tokens[name]
  while (value && value.startsWith('var(')) value = tokens[value.slice(4, -1).trim()]
  return value
}

const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const rule = (selector) => {
  const re = new RegExp(`${selector.replace(/[.[\]"^$*+?()|\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g')
  return [...css.matchAll(re)].map((m) => m[1])
}

describe('contraste del resaltado de teclado', () => {
  // El resaltado es el único indicador de dónde va a caer el Enter. WCAG
  // 2.1 SC 1.4.11 pide 3:1 para el indicador de estado de un componente.
  const { light, dark } = palettes()

  it('la marca contrasta con el fondo de la lista en modo claro', () => {
    expect(contrast(resolve('--hl-mark', light), resolve('--bg', light))).toBeGreaterThanOrEqual(3)
  })

  it('la marca contrasta con el fondo de la lista en modo oscuro', () => {
    expect(contrast(resolve('--hl-mark', dark), resolve('--bg', dark))).toBeGreaterThanOrEqual(3)
  })

  it('el resaltado usa la marca', () => {
    const bloques = rule('.results li[aria-selected="true"]')
    expect(bloques.length).toBeGreaterThan(0)
    expect(bloques.every((b) => b.includes('var(--hl-mark)'))).toBe(true)
  })

  // Compartir estilo con el hover hace que, con el mouse sobre otra fila,
  // se vean dos filas resaltadas y el Enter elija la que no está debajo
  // del puntero.
  it('el hover del mouse no se disfraza de resaltado de teclado', () => {
    expect(rule('.results li:hover').every((b) => !b.includes('var(--hl-mark)'))).toBe(true)
    expect(css).not.toMatch(/:hover\s*,[^{]*aria-selected/)
    expect(css).not.toMatch(/aria-selected[^{]*,\s*[^{]*:hover/)
  })
})
