import { describe, it, expect } from 'vitest'
import { assertMinRows } from './dump.mjs'

const minRows = { jurisdicciones: 24, radios: 60000 }

describe('assertMinRows', () => {
  it('deja pasar los volcados que llegan al piso', () => {
    const rows = { jurisdicciones: Array(24).fill({}), radios: Array(66515).fill({}) }
    expect(() => assertMinRows(rows, minRows)).not.toThrow()
  })

  it('aborta nombrando la capa truncada, con el conteo y el mínimo', () => {
    const rows = { jurisdicciones: Array(24).fill({}), radios: Array(30000).fill({}) }
    expect(() => assertMinRows(rows, minRows)).toThrow(/radios.*30000.*60000/)
  })

  it('aborta si falta un volcado con piso declarado', () => {
    const rows = { jurisdicciones: Array(24).fill({}) }
    expect(() => assertMinRows(rows, minRows)).toThrow(/falta.*radios/)
  })
})
