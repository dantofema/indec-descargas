// src/totales.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildTotales } from '../scripts/lib/aggregate.mjs'

const leer = (p) => JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8'))

describe('public/totales.json', () => {
  it('dice exactamente lo que sale de sumar el catálogo commiteado', () => {
    // Si esto falla es porque se regeneró el catálogo sin regenerar los
    // totales: el home estaría publicando números viejos.
    expect(leer('public/totales.json')).toEqual(buildTotales(leer('public/catalog.json')))
  })

  it('trae los números verificados el 2026-09-08', () => {
    expect(leer('public/totales.json')).toMatchObject({
      jur: 24, dep: 529, loc: 4023, gl: 2282, aglo: 119,
      fracciones: 6571, radios: 66515, vias: 477588,
    })
  })
})
