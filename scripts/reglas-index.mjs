#!/usr/bin/env node
/**
 * Regenera los bloques derivados de `docs/reglas/README.md`.
 *
 * El README es el tablero: es lo único que el dueño mira para saber qué le
 * falta contestar y qué quedó decidido sin construir. Por eso se genera —una
 * tabla a mano envejece contra los documentos y nadie lo nota— y por eso el
 * gate falla si quedó vieja.
 *
 * Portado de `bin/reglas-index.php` de crm-dantofema. Mismo contrato, otro
 * runtime: acá no hay PHP.
 *
 *   node scripts/reglas-index.mjs          reescribe el README
 *   node scripts/reglas-index.mjs --check  falla si quedó viejo, sin tocar nada
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DIR = join(RAIZ, 'docs', 'reglas')

/** Las superficies. Un documento que no esté acá es invisible para el gate. */
export const DOCUMENTOS_DE_REGLAS = ['apariencia', 'buscador', 'descargas', 'navegacion', 'notas', 'sitio']

export const PATRON_ID_DE_REGLA = /(?:APAR|BUS|DES|NAV|NOTA|SITIO)-R\d+/
export const PATRON_ID_DE_PREGUNTA = /(?:APAR|BUS|DES|NAV|NOTA|SITIO)-Q\d+/

/** Qué documento es dueño de qué prefijo. Un ID fuera de su archivo es un error. */
export const DOCUMENTO_POR_PREFIJO = {
  APAR: 'apariencia', BUS: 'buscador', DES: 'descargas',
  NAV: 'navegacion', NOTA: 'notas', SITIO: 'sitio',
}

/**
 * Conceptos con dueño único. Los archivos están cortados por superficie pero
 * las contradicciones nunca son sobre una pantalla: son sobre conceptos que
 * cruzan todas. Una regla de otra superficie puede decir qué muestra su
 * pantalla, no puede decidir cuándo pasa la cosa: para eso cita al dueño.
 */
export const CONCEPTOS_CON_DUENO = {
  'paleta': 'apariencia', 'contraste': 'apariencia', 'tema': 'apariencia',
  'permalink': 'sitio', 'catálogo': 'descargas',
}
// `nota` estuvo acá y se sacó: choca con `notas` como **nombre de página**.
// SITIO-R1 y SITIO-R5 la nombran al enumerar las cuatro rutas del sitio, que
// no es decidir nada sobre el contenido de una nota. Un concepto que también
// es un sustantivo común del dominio no sirve como concepto con dueño.

/** Cuánto puede pesar una pregunta abierta antes de que haya que partirla. */
export const PRESUPUESTO_DE_PREGUNTA = { caracteres: 4000, opciones: 5 }

const leer = (doc) => readFileSync(join(DIR, `${doc}.md`), 'utf8')

/** Las filas de la tabla de ✅ Reglas de un documento. */
export function reglasDe(doc) {
  const texto = leer(doc)
  const cuerpo = texto.slice(texto.search(/^## ✅ Reglas/m))
  return [...cuerpo.matchAll(/^\| (~~)?\*\*([A-Z]+-R\d+)\*\*(~~)? \| ([\s\S]*?) \| (.*?) \|$/gm)]
    .map(([, muerta, id, , texto_, estado]) => ({
      id, doc, muerta: !!muerta, texto: texto_, estado,
      // El resumen es la primera negrita: es lo que va al índice.
      resumen: (texto_.match(/\*\*(.+?)\*\*/) || [, texto_.slice(0, 90)])[1].replace(/~~/g, ''),
      implementada: /✅/.test(estado),
    }))
}

/** Las preguntas que esperan respuesta: sólo lo que está entre marcadores. */
export function abiertasDe(doc) {
  const m = leer(doc).match(/<!-- abiertas -->\n([\s\S]*?)<!-- \/abiertas -->/)
  if (!m) throw new Error(`${doc}.md no tiene los marcadores <!-- abiertas -->`)
  return [...m[1].matchAll(/^\| \*\*([A-Z]+-Q\d+)\*\* \| (.*?) \|$/gm)]
    .map(([, id, resumen]) => ({ id, doc, resumen }))
}

export const todasLasReglas = () => DOCUMENTOS_DE_REGLAS.flatMap(reglasDe)
export const todasLasAbiertas = () => DOCUMENTOS_DE_REGLAS.flatMap(abiertasDe)

/** Lo que el dueño mira para saber qué le falta contestar. */
function renderAbiertas(abiertas) {
  if (!abiertas.length) return '\nNinguna. Todo lo que se destapó está contestado.\n'
  return ['', '| Pregunta | Superficie | De qué se trata |', '|---|---|---|',
    ...abiertas.map((q) => `| **${q.id}** | [${q.doc}](${q.doc}.md) | ${q.resumen} |`), ''].join('\n')
}

/** Lo decidido que espera turno. */
function renderSinConstruir(reglas) {
  const pendientes = reglas.filter((r) => !r.muerta && !r.implementada)
  if (!pendientes.length) return '\nNinguna: todas las reglas vivas están construidas.\n'
  return ['', '| Regla | Superficie | Qué decide | Estado |', '|---|---|---|---|',
    ...pendientes.map((r) => `| **${r.id}** | [${r.doc}](${r.doc}.md) | ${r.resumen} | ${r.estado} |`), ''].join('\n')
}

/**
 * Reglas que citan una regla de OTRA superficie. Una regla que cita a otra
 * hereda su destino, y el documento no lo dice en ninguna parte: sin esto hay
 * que leer las superficies enteras para descubrirlo.
 */
function renderCruces(reglas) {
  const porId = Object.fromEntries(reglas.map((r) => [r.id, r]))
  const cruces = []
  for (const r of reglas) {
    for (const [, otro] of r.texto.matchAll(new RegExp(`(${PATRON_ID_DE_REGLA.source})`, 'g'))) {
      const destino = porId[otro]
      if (!destino || destino.doc === r.doc || destino.id === r.id) continue
      cruces.push(`| **${r.id}** | [${r.doc}](${r.doc}.md) | **${otro}** | ${destino.estado} |`)
    }
  }
  if (!cruces.length) return '\nNinguna regla depende de otra superficie.\n'
  return ['', '| Regla | Superficie | Cita a | Estado del destino |', '|---|---|---|---|',
    ...[...new Set(cruces)], ''].join('\n')
}

/** Una pregunta que no entra en el presupuesto no se contesta: se parte. */
function renderComplejidad(abiertas) {
  if (!abiertas.length) return '\nSin preguntas abiertas que medir.\n'
  const filas = abiertas.map((q) => {
    const texto = leer(q.doc)
    const desde = texto.indexOf(`### ${q.id}`)
    const hasta = texto.indexOf('\n### ', desde + 1)
    const cuerpo = desde === -1 ? '' : texto.slice(desde, hasta === -1 ? undefined : hasta)
    const chars = cuerpo.length
    const opciones = (cuerpo.match(/^\| \*\*\([a-z]\)\*\*/gm) || []).length
    const entra = chars <= PRESUPUESTO_DE_PREGUNTA.caracteres && opciones <= PRESUPUESTO_DE_PREGUNTA.opciones
    return `| **${q.id}** | ${chars} / ${PRESUPUESTO_DE_PREGUNTA.caracteres} | ${opciones} / ${PRESUPUESTO_DE_PREGUNTA.opciones} | ${entra ? 'entra' : '⚠️ **partir**'} |`
  })
  return ['', '| Pregunta | Caracteres | Opciones | ¿Entra? |', '|---|---|---|---|', ...filas, ''].join('\n')
}

/** Reemplaza lo que hay entre `<!-- bloque:X -->` y `<!-- /bloque:X -->`. */
export function reemplazarBloque(contenido, nombre, cuerpo) {
  // Sin `\n` obligatorio de cada lado: un bloque recién creado está vacío y
  // sus dos marcadores quedan pegados, que es justo el caso de la primera
  // generación. Exigir el salto hacía fallar el README nuevo.
  const re = new RegExp(`(<!-- bloque:${nombre} -->)[\\s\\S]*?(<!-- /bloque:${nombre} -->)`)
  if (!re.test(contenido)) throw new Error(`el README no tiene el bloque ${nombre}`)
  return contenido.replace(re, `$1\n${cuerpo.replace(/^\n+|\n+$/g, '')}\n$2`)
}

/** El README al día, sin escribirlo. */
export function renderIndiceDeReglas() {
  const reglas = todasLasReglas()
  const abiertas = todasLasAbiertas()
  let out = readFileSync(join(DIR, 'README.md'), 'utf8')
  out = reemplazarBloque(out, 'abiertas', renderAbiertas(abiertas))
  out = reemplazarBloque(out, 'sin-construir', renderSinConstruir(reglas))
  out = reemplazarBloque(out, 'cruces', renderCruces(reglas))
  return reemplazarBloque(out, 'complejidad', renderComplejidad(abiertas))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const destino = join(DIR, 'README.md')
  const nuevo = renderIndiceDeReglas()
  if (process.argv.includes('--check')) {
    if (readFileSync(destino, 'utf8') !== nuevo) {
      console.error('El índice de docs/reglas/README.md quedó viejo. Corré: node scripts/reglas-index.mjs')
      process.exit(1)
    }
    console.log('El índice está al día.')
  } else {
    writeFileSync(destino, nuevo)
    console.log(`Índice regenerado: ${todasLasReglas().length} reglas, ${todasLasAbiertas().length} abiertas.`)
  }
}
