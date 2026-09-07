import { describe, it, expect } from 'vitest'
import { LAYER_SPECS, specOf, queryFields } from './columns.js'
import { CHILD_LAYERS } from './download.js'

describe('LAYER_SPECS', () => {
  // El test que se rompe cuando alguien agrega una capa y se olvida la mitad.
  it('cubre exactamente las capas hijas que existen', () => {
    expect(Object.keys(LAYER_SPECS).sort()).toEqual(Object.keys(CHILD_LAYERS).sort())
  })

  it('toda capa declara sortBy, idField y al menos una columna', () => {
    for (const [key, spec] of Object.entries(LAYER_SPECS)) {
      expect(spec.sortBy, key).toBeTruthy()
      expect(spec.idField, key).toBeTruthy()
      expect(spec.columns.length, key).toBeGreaterThan(0)
    }
  })

  it('vías desempata el orden, porque repite cod_indec', () => {
    expect(LAYER_SPECS.vias.sortBy).toBe('cod_indec,id')
  })

  it('vías muestra los 21 campos que publica el GeoServer', () => {
    expect(LAYER_SPECS.vias.columns).toHaveLength(21)
    expect(LAYER_SPECS.vias.columns[0].field).toBe('id')
    expect(LAYER_SPECS.vias.columns.at(-1).field).toBe('sag')
  })

  // Vías es la única capa que necesita scroll horizontal y columna fija en
  // la tabla. Que lo declare la capa, no que table.js lo adivine contando
  // columnas: una capa futura de 9 campos activaría el scroll sin motivo.
  it('vías es la única capa marcada wide', () => {
    expect(LAYER_SPECS.vias.wide).toBe(true)
    for (const [key, spec] of Object.entries(LAYER_SPECS)) {
      if (key === 'vias') continue
      expect(spec.wide, key).toBeFalsy()
    }
  })

  // La columna que se fija al scrollear la tuvo que nombrar la capa: es la
  // única que sabe cuál campo identifica la fila para una persona. No puede
  // ser `id` (primer campo publicado, un número interno) ni tampoco la
  // primera posición a secas: el orden del GeoServer no se toca.
  it('vías ancla la columna del nombre de la calle, no la primera publicada', () => {
    expect(LAYER_SPECS.vias.anchorField).toBe('fna')
    expect(LAYER_SPECS.vias.columns[0].field).toBe('id')
  })

  it('ninguna otra capa declara columna ancla', () => {
    for (const [key, spec] of Object.entries(LAYER_SPECS)) {
      if (key === 'vias') continue
      expect(spec.anchorField, key).toBeUndefined()
    }
  })
})

describe('specOf', () => {
  it('devuelve la capa pedida', () => {
    expect(specOf('radios').idField).toBe('cod_indec')
  })

  it('tira con una capa desconocida', () => {
    expect(() => specOf('parcelas')).toThrow(/parcelas/)
  })
})

describe('queryFields', () => {
  it('junta columnas, identificador y campos de orden, sin repetir', () => {
    expect(queryFields('vias')).toContain('id')
    expect(queryFields('vias').filter((f) => f === 'id')).toHaveLength(1)
  })

  it('incluye el campo de orden aunque no sea columna', () => {
    expect(queryFields('localidades')).toContain('clc')
  })

  it('no pide la geometría', () => {
    for (const key of Object.keys(LAYER_SPECS)) {
      expect(queryFields(key)).not.toContain('the_geom')
      expect(queryFields(key)).not.toContain('geom')
    }
  })
})
