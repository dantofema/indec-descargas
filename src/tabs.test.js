// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTabs } from './tabs.js'

let container
const items = [
  { key: 'radios', label: 'Radios', badge: '432' },
  { key: 'vias', label: 'Vías', badge: '1.487' },
]

beforeEach(() => {
  document.body.innerHTML = '<div id="c"></div>'
  container = document.querySelector('#c')
})

describe('createTabs', () => {
  it('dibuja una pestaña por item, con su badge', () => {
    createTabs({ container, items, onSelect: () => {} })
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].textContent).toContain('Radios')
    expect(tabs[0].textContent).toContain('432')
  })

  it('elige la primera al construirse', () => {
    const onSelect = vi.fn()
    createTabs({ container, items, onSelect })
    expect(onSelect).toHaveBeenCalledWith('radios')
    expect(container.querySelector('[role="tab"]').getAttribute('aria-selected')).toBe('true')
  })

  it('al hacer clic avisa y mueve el aria-selected', () => {
    const onSelect = vi.fn()
    createTabs({ container, items, onSelect })
    container.querySelectorAll('[role="tab"]')[1].click()
    expect(onSelect).toHaveBeenLastCalledWith('vias')
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs[0].getAttribute('aria-selected')).toBe('false')
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
  })

  it('no vuelve a avisar si se elige la que ya está', () => {
    const onSelect = vi.fn()
    createTabs({ container, items, onSelect })
    onSelect.mockClear()
    container.querySelector('[role="tab"]').click()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('sin items no dibuja nada', () => {
    const onSelect = vi.fn()
    createTabs({ container, items: [], onSelect })
    expect(container.children).toHaveLength(0)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
