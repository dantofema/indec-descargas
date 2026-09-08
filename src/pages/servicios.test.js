// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectShell, readPartials } from '../../scripts/shell.mjs'
import { GEOSERVER } from '../download.js'

const crudo = readFileSync(resolve(process.cwd(), 'servicios/index.html'), 'utf8')
const html = injectShell(crudo, { partials: readPartials(), base: '/' })

describe('la página de servicios', () => {
  it('publica el endpoint real, el mismo del que baja el sitio', () => {
    expect(html).toContain(GEOSERVER)
  })

  it('lista las diez capas vectoriales del WFS', () => {
    for (const capa of [
      'aglomerados', 'departamentos', 'fracciones_censales', 'gobiernos_locales4',
      'gobiernos_locales_puntos', 'jurisdicciones', 'localidades_censales',
      'localidades_censales_puntos1', 'radios_censales2', 'vias_de_circulacion',
    ]) {
      expect(html, `falta ${capa}`).toContain(capa)
    }
  })

  it('nombra los formatos que el servidor declara', () => {
    for (const f of ['geopackage', 'application/json', 'SHAPE-ZIP', 'csv', 'excel2007']) {
      expect(html).toContain(f)
    }
  })

  it('enlaza el Geoportal INDEC y no un host que no existe', () => {
    expect(html).toContain('https://geonode.indec.gob.ar/')
    expect(html).not.toContain('geoportal.indec.gob.ar')
  })

  it('trae el shell completo', () => {
    expect(html).toContain('Roca 609')
    expect(html).toContain('Más info, más mapas, más capas en Geoportal INDEC')
    expect(crudo).toContain('<!--#shell:header-->')
  })
})
