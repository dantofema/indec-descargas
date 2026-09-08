import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import viteConfig from '../vite.config.js'

// SITIO-R1 dice que el sitio son cuatro páginas, cada una con su propia
// entrada de build. Esa lista no la miraba nadie: sacar `servicios` de
// `rollupOptions.input` dejaba a CI construyendo y desplegando en verde,
// con la página faltante y sus enlaces del nav apuntando a un 404.
describe('las entradas del build (SITIO-R1)', () => {
  const input = viteConfig.build.rollupOptions.input

  it('son las cuatro páginas del sitio', () => {
    expect(Object.keys(input).sort()).toEqual(['home', 'notas', 'resultados', 'servicios'])
  })

  it('cada una apunta a un index.html que existe', () => {
    for (const [nombre, ruta] of Object.entries(input)) {
      expect(ruta.endsWith('index.html'), `${nombre} no apunta a un index.html`).toBe(true)
      expect(existsSync(ruta), `${nombre} apunta a ${ruta}, que no existe`).toBe(true)
    }
  })
})
