import { describe, it, expect } from 'vitest'
import { NOTES, notesFor } from './notes.js'
import { CHILD_LAYERS } from './download.js'

describe('NOTES', () => {
  it('cada nota apunta a una capa que existe', () => {
    for (const nota of NOTES) {
      expect(Object.keys(CHILD_LAYERS), nota.key).toContain(nota.key)
    }
  })

  it('ninguna nota está vacía', () => {
    for (const nota of NOTES) {
      expect(nota.paragraphs.length, nota.key).toBeGreaterThan(0)
      expect(nota.label, nota.key).toBeTruthy()
    }
  })

  it('la nota de vías dice que la descarga trae la calle entera', () => {
    const vias = NOTES.find((n) => n.key === 'vias')
    expect(vias.paragraphs.join(' ')).toMatch(/calle entera/i)
  })

  it('la nota de localidades usa el ejemplo de Avellaneda', () => {
    const loc = NOTES.find((n) => n.key === 'localidades')
    expect(loc.paragraphs.join(' ')).toContain('Avellaneda')
  })
})

describe('notesFor', () => {
  it('trae sólo las notas de las capas que el objeto tiene', () => {
    const dep = { t: 'dep', c: '06840', ch: { radios: 432, vias: 1487, localidades: 1 } }
    expect(notesFor(dep).map((n) => n.key).sort()).toEqual(['localidades', 'vias'])
  })

  it('un objeto sin capas con nota no trae ninguna', () => {
    expect(notesFor({ t: 'dep', c: '1', ch: { radios: 10 } })).toEqual([])
  })

  it('un objeto sin hijos no trae ninguna', () => {
    expect(notesFor({ t: 'gl', c: '060840' })).toEqual([])
  })
})
