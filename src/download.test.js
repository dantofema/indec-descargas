import { describe, it, expect } from 'vitest'
import { selfUrl, childUrl, canDownload, filename, GEOSERVER } from './download.js'

const treFeb = { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero' }
const buenosAires = { t: 'jur', c: '06', n: 'Buenos Aires', s: 'buenos aires' }

/** Devuelve los parámetros de una URL como objeto plano. */
function params(url) {
  return Object.fromEntries(new URL(url).searchParams)
}

describe('selfUrl', () => {
  it('apunta al GeoServer del INDEC', () => {
    expect(selfUrl(treFeb).startsWith(GEOSERVER)).toBe(true)
  })

  it('pide el objeto en su propia capa filtrando por su campo', () => {
    const p = params(selfUrl(treFeb))
    expect(p.typenames).toBe('geonode:departamentos')
    expect(p.CQL_FILTER).toBe("cde='06840'")
  })

  it('pide siempre GPKG en EPSG:4326', () => {
    const p = params(selfUrl(treFeb))
    expect(p.outputFormat).toBe('geopackage')
    expect(p.srsName).toBe('EPSG:4326')
    expect(p.service).toBe('WFS')
    expect(p.version).toBe('2.0.0')
    expect(p.request).toBe('GetFeature')
  })

  it('acepta otro formato para el dibujo del mapa', () => {
    expect(params(selfUrl(treFeb, 'application/json')).outputFormat).toBe('application/json')
  })

  it('conserva los ceros a la izquierda del código', () => {
    expect(params(selfUrl(buenosAires)).CQL_FILTER).toBe("cpr='06'")
  })
})

describe('childUrl', () => {
  it('filtra la capa hija por el campo del padre', () => {
    const p = params(childUrl(treFeb, 'radios'))
    expect(p.typenames).toBe('geonode:radios_censales2')
    expect(p.CQL_FILTER).toBe("cde='06840'")
  })

  it('una jurisdicción filtra a sus hijos por cpr', () => {
    const p = params(childUrl(buenosAires, 'departamentos'))
    expect(p.typenames).toBe('geonode:departamentos')
    expect(p.CQL_FILTER).toBe("cpr='06'")
  })

  it('un aglomerado filtra sus localidades por codaglo', () => {
    const aglo = { t: 'aglo', c: '0043', n: 'San Francisco - Frontera', s: 'san francisco - frontera' }
    expect(params(childUrl(aglo, 'localidades')).CQL_FILTER).toBe("codaglo='0043'")
  })

  it('rechaza una capa hija desconocida', () => {
    expect(() => childUrl(treFeb, 'inventada')).toThrow(/capa hija/i)
  })
})

describe('validación de códigos', () => {
  it('rechaza un código que no sea sólo dígitos', () => {
    const malicioso = { t: 'dep', c: "06840' OR '1'='1", n: 'x', s: 'x' }
    expect(() => selfUrl(malicioso)).toThrow(/código/i)
  })

  it('rechaza un tipo desconocido', () => {
    expect(() => selfUrl({ t: 'zzz', c: '06', n: 'x', s: 'x' })).toThrow(/tipo/i)
  })
})

describe('canDownload', () => {
  it('habilita por debajo del tope', () => {
    expect(canDownload(4999, 5000)).toBe(true)
  })

  it('habilita justo en el tope', () => {
    expect(canDownload(5000, 5000)).toBe(true)
  })

  it('bloquea por encima del tope', () => {
    expect(canDownload(5001, 5000)).toBe(false)
  })

  it('bloquea cuando no hay nada que bajar', () => {
    expect(canDownload(0, 5000)).toBe(false)
  })

  it('bloquea si el conteo falta', () => {
    expect(canDownload(undefined, 5000)).toBe(false)
  })
})

describe('filename', () => {
  it('nombra la descarga del objeto', () => {
    expect(filename(treFeb)).toBe('departamentos-06840.gpkg')
  })

  it('nombra la descarga de una capa hija', () => {
    expect(filename(treFeb, 'radios')).toBe('radios-de-departamentos-06840.gpkg')
  })
})
