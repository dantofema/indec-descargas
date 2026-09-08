// src/totales.test.js
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildTotales } from '../scripts/lib/aggregate.mjs'
import { loadTotales } from './totales.js'

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

describe('loadTotales', () => {
  const responder = (data) => vi.fn(async () => ({ ok: true, json: async () => data }))

  it('carga y devuelve los totales', async () => {
    global.fetch = responder({ generated: '2026-09-06', jur: 24 })
    const t = await loadTotales('/totales.json')
    expect(t).toEqual({ generated: '2026-09-06', jur: 24 })
  })

  it('rechaza con error si el fetch falla', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404 }))
    await expect(loadTotales('/totales.json')).rejects.toThrow(/404/)
  })
})
