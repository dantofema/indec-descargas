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

  // Fix round 3, hallazgo 3: Grytviken existe en el catálogo con
  // `ch: {vias: 0}`. Explicarle que la capa lista tramos y no calles, para
  // un objeto que no tiene ninguna, es prosa sobre la nada. Los 11 pares
  // (objeto, capa) con conteo cero del catálogo caen todos en capas con nota.
  it('una capa con conteo cero no trae su nota', () => {
    expect(notesFor({ t: 'loc', c: '94021040', n: 'Grytviken', ch: { vias: 0 } })).toEqual([])
  })

  it('el cero de una capa no se lleva puesta la nota de otra que sí tiene objetos', () => {
    const dep = { t: 'dep', c: '94028', ch: { localidades: 3, vias: 0 } }
    expect(notesFor(dep).map((n) => n.key)).toEqual(['localidades'])
  })
})
