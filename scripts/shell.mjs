import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// `dirname` + `fileURLToPath` en vez de `new URL('../src/shell/',
// import.meta.url)`: ese patrón literal es el que Vite reconoce como su
// sintaxis especial de asset URL y reescribe contra `base` en vez de
// resolverlo como ruta de archivo —sólo en modo cliente, que es como
// Vitest carga los módulos bajo `environment: jsdom`—, así que
// `readPartials()` tiraba ahí con "The URL must be of scheme file". Esta
// forma nunca pasa por `new URL(str, import.meta.url)`, así que no hay
// nada que el pattern-matching estático de Vite pueda reescribir.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SHELL_DIR = join(ROOT, 'src', 'shell')
const TOTALES = join(ROOT, 'public', 'totales.json')
const MARKER = /<!--#shell:([a-z-]+)-->/g

/**
 * El header, el CTA y el footer se escriben una vez y se resuelven en build,
 * así que llegan al browser adentro del HTML: existen aunque el JS no corra.
 *
 * Tira ante un marcador sin partial en vez de dejarlo pasar: un `fotter`
 * mal tipeado que no rompe nada es un footer que falta en producción y que
 * nadie ve faltar.
 */
export function injectShell(html, { partials, base, generated = '' }) {
  const withShell = html.replace(MARKER, (_, name) => {
    if (!(name in partials)) throw new Error(`marcador de shell sin partial: ${name}`)
    return partials[name]
  })
  // Después de inyectar, para que los enlaces y la fecha del propio partial
  // se resuelvan igual que los de la página.
  return withShell
    .replaceAll('{{base}}', base)
    .replaceAll('{{generated}}', generated)
}

/** Los partials del shell, por nombre de archivo sin extensión. */
export function readPartials(dir = SHELL_DIR) {
  return Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith('.html'))
      .map((f) => [f.replace(/\.html$/, ''), readFileSync(join(dir, f), 'utf8').trim()]),
  )
}

/**
 * La fecha del catálogo, para el pie de las cuatro páginas (spec §6).
 *
 * Sale de `totales.json`, que la trae del mismo paso de build que el
 * catálogo y ya se compara contra él en la suite (SITIO-R7). Se resuelve
 * acá y no con JS de página porque así está en el HTML servido aunque el JS
 * no corra, y porque `/servicios/` no tiene una línea de JS: darle una para
 * escribir una fecha en el pie sería un bundle entero por un renglón.
 *
 * Sin fecha devuelve la cadena vacía: el `<p>` queda vacío, como estaba, en
 * vez de publicar el marcador crudo.
 */
export function readGenerated(file = TOTALES) {
  const { generated } = JSON.parse(readFileSync(file, 'utf8'))
  return generated ? `Catálogo generado el ${generated}.` : ''
}

/** El plugin sólo cablea: la decisión entera vive en `injectShell`. */
export function shellPlugin() {
  let base = '/'
  return {
    name: 'indec-shell',
    configResolved(config) { base = config.base },
    transformIndexHtml: {
      order: 'pre',
      // Se releen en cada transform para que editar un partial —o regenerar
      // los totales— se vea en dev.
      handler: (html) => injectShell(html, {
        partials: readPartials(), base, generated: readGenerated(),
      }),
    },
  }
}
