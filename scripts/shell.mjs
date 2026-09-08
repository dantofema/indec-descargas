import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// `import.meta.url` va a una variable antes de entrar a `new URL(...)`:
// escrito como literal (`new URL('../src/shell/', import.meta.url)`), Vite
// lo reconoce como su patrón de asset URL y lo reescribe contra `base` en
// vez de resolverlo como ruta de archivo. Sólo pasa cuando este módulo se
// carga en modo cliente —los tests en jsdom, no los de entorno node—, así
// que `leerPartials()` tiraba ahí con "The URL must be of scheme file".
const AQUI = import.meta.url
const SHELL_DIR = fileURLToPath(new URL('../src/shell/', AQUI))
const MARCADOR = /<!--#shell:([a-z-]+)-->/g

/**
 * El header, el CTA y el footer se escriben una vez y se resuelven en build,
 * así que llegan al browser adentro del HTML: existen aunque el JS no corra.
 *
 * Tira ante un marcador sin partial en vez de dejarlo pasar: un `fotter`
 * mal tipeado que no rompe nada es un footer que falta en producción y que
 * nadie ve faltar.
 */
export function injectShell(html, { partials, base }) {
  const conShell = html.replace(MARCADOR, (_, nombre) => {
    if (!(nombre in partials)) throw new Error(`marcador de shell sin partial: ${nombre}`)
    return partials[nombre]
  })
  // Después de inyectar, para que los enlaces del propio partial se
  // resuelvan igual que los de la página.
  return conShell.replaceAll('{{base}}', base)
}

/** Los partials del shell, por nombre de archivo sin extensión. */
export function leerPartials(dir = SHELL_DIR) {
  return Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith('.html'))
      .map((f) => [f.replace(/\.html$/, ''), readFileSync(join(dir, f), 'utf8').trim()]),
  )
}

/** El plugin sólo cablea: la decisión entera vive en `injectShell`. */
export function shellPlugin() {
  let base = '/'
  return {
    name: 'indec-shell',
    configResolved(config) { base = config.base },
    transformIndexHtml: {
      order: 'pre',
      // Se releen en cada transform para que editar un partial se vea en dev.
      handler: (html) => injectShell(html, { partials: leerPartials(), base }),
    },
  }
}
