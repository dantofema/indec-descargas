import { describe, it, expect } from 'vitest'
import { selfUrl, childUrl, filename, featureUrl, GEOSERVER, TYPES } from './download.js'

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

  it('lleva el nombre del archivo en format_options', () => {
    // El `download` del <a> no aplica cross-origin: el nombre lo fija el
    // Content-Disposition que GeoServer arma desde format_options.
    expect(params(selfUrl(treFeb)).format_options).toBe('filename:departamentos-06840.gpkg')
  })

  it('no pide nombre de archivo para el GeoJSON del mapa', () => {
    expect(params(selfUrl(treFeb, 'application/json')).format_options).toBeUndefined()
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

  it('lleva el nombre del archivo de la capa hija en format_options', () => {
    expect(params(childUrl(treFeb, 'radios')).format_options)
      .toBe('filename:radios-de-departamentos-06840.gpkg')
  })

  it('no pide nombre de archivo cuando no es una descarga', () => {
    expect(params(childUrl(treFeb, 'radios', 'application/json')).format_options).toBeUndefined()
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

describe('TYPES', () => {
  // Sin `det`, la interfaz escribe "Descargar undefined aglomerado".
  it('cada tipo trae el determinante que le corresponde', () => {
    for (const [t, tipo] of Object.entries(TYPES)) {
      expect(['este', 'esta'], `tipo ${t}`).toContain(tipo.det)
    }
  })

  it('los dos tipos femeninos llevan esta', () => {
    expect(TYPES.jur.det).toBe('esta')
    expect(TYPES.loc.det).toBe('esta')
  })
})

describe('featureUrl', () => {
  it('filtra por el campo identificador de la capa', () => {
    const url = featureUrl('radios', '068400101')
    expect(url).toContain('typenames=geonode%3Aradios_censales2')
    expect(url).toContain('CQL_FILTER=cod_indec%3D%27068400101%27')
    expect(url).toContain('outputFormat=geopackage')
    expect(url).toContain('srsName=EPSG%3A4326')
  })

  it('usa clc para una localidad censal', () => {
    expect(featureUrl('localidades', '06840010')).toContain('CQL_FILTER=clc%3D%2706840010%27')
  })

  // Una calle se parte en tramos que comparten cod_indec: filtrar por el
  // código baja la calle entera, que es lo que se quiere.
  it('en vías filtra por cod_indec, no por tramo', () => {
    expect(featureUrl('vias', '0684001000010')).toContain('CQL_FILTER=cod_indec%3D%270684001000010%27')
  })

  it('nombra el archivo con la capa y el código', () => {
    expect(featureUrl('radios', '068400101')).toContain('filename%3Aradios_censales2-068400101.gpkg')
  })

  it('rechaza un código que no sea de dígitos', () => {
    expect(() => featureUrl('radios', "1' OR '1")).toThrow(/inválido/)
  })

  it('tira con una capa que no existe', () => {
    expect(() => featureUrl('parcelas', '1')).toThrow(/parcelas/)
  })
})

describe('filename', () => {
  it('nombra la descarga del objeto', () => {
    expect(filename(treFeb)).toBe('departamentos-06840.gpkg')
  })

  it('nombra la descarga de una capa hija', () => {
    expect(filename(treFeb, 'radios')).toBe('radios-de-departamentos-06840.gpkg')
  })

  it('rechaza un tipo desconocido igual que sus hermanas', () => {
    expect(() => filename({ t: 'zzz', c: '06' })).toThrow(/tipo/i)
  })

  // El nombre ya no es un atributo `download` inerte: viaja en
  // `format_options`, donde `;` separa pares. Un código sin validar
  // inyecta opciones en la URL de descarga.
  it('rechaza un código inválido igual que sus hermanas', () => {
    expect(() => filename({ t: 'dep', c: '06840;filename:otro' })).toThrow(/código/i)
  })
})
