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

  // Buscar el nombre suelto en el HTML entero no probaba la lista: dos de
  // las diez se satisfacían con otro texto de la página
  // —`localidades_censales` lo cumplía la fila de
  // `localidades_censales_puntos1`, y `departamentos`, el ejemplo de CQL—,
  // así que borrar cualquiera de esos dos `<li>` dejaba el test en verde.
  // Se ancla a la fila: su `<code>` completo, y diez filas, ni una más.
  it('lista las diez capas vectoriales del WFS, una por fila', () => {
    document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1]
    const filas = [...document.querySelectorAll('.capas li')]
    expect(filas).toHaveLength(10)

    const codigos = filas.map((li) => li.querySelector('code').textContent)
    for (const capa of [
      'aglomerados', 'departamentos', 'fracciones_censales', 'gobiernos_locales4',
      'gobiernos_locales_puntos', 'jurisdicciones', 'localidades_censales',
      'localidades_censales_puntos1', 'radios_censales2', 'vias_de_circulacion',
    ]) {
      expect(codigos, `falta la fila de ${capa}`).toContain(`geonode:${capa}`)
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
    expect(html).toContain('Sitio no oficial')
    expect(html).toContain('Ir al Geoportal INDEC')
    expect(crudo).toContain('<!--#shell:header-->')
  })
})
