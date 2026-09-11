import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import {
  DOCUMENTOS_DE_REGLAS, DOCUMENTO_POR_PREFIJO, CONCEPTOS_CON_DUENO,
  DIR, todasLasReglas, todasLasAbiertas, renderIndiceDeReglas,
} from './reglas-index.mjs'
import { join } from 'node:path'

/**
 * El gate de las reglas de producto, portado de `RuleCitationTest.php` de
 * crm-dantofema. Mismo contrato, otro runtime.
 *
 * Existe porque el 2026-07-29 aparecieron cuatro fallas en una pantalla con
 * 49 tests en verde: tres estaban **afirmadas como correctas** por los tests,
 * porque los tests se habían escrito leyendo el código. Un test escrito
 * leyendo la implementación no puede fallar contra ella. Estos documentos son
 * de dónde sale la expectativa, y esto es lo que impide que se pudra el
 * vínculo.
 *
 * Lo que este gate NO mira: el código de la app. Que una regla marcada "sin
 * construir" ya esté construida no lo caza nada, y que el test cubra lo que
 * la regla dice es una afirmación humana. Lo único que acorrala eso son las
 * dos disciplinas de siempre: el test se escribe rojo, y se rompe el
 * comportamiento a mano antes de marcar ✅.
 */

/**
 * El texto de los tests del repo **menos este archivo**. La exclusión no es
 * higiene: acá adentro se nombran IDs de ejemplo y listas enteras de
 * trinquete, así que incluirse a sí mismo hace que toda regla parezca citada
 * y con grupo. Pasó: el caso de grupos usaba la variante sin excluir y daba
 * verde sólo mientras este archivo no estaba trackeado todavía.
 */
const TESTS_AJENOS = execSync(
  'cat $(git ls-files "*.test.js" "*.test.mjs" | grep -v reglas.test.mjs)', { encoding: 'utf8' })

const vivas = () => todasLasReglas().filter((r) => !r.muerta)

/**
 * Deuda declarada. Son listas **exactas**, no subconjuntos: una regla que
 * entra sin declararse pone el gate en rojo, que es la idea. Sólo bajan.
 */

/** Implementadas cuyo test no las nombra. Ficha #1. */
const REGLAS_SIN_CITA = [
  'apariencia.md APAR-R1', 'apariencia.md APAR-R8',
  'descargas.md DES-R1', 'descargas.md DES-R2', 'descargas.md DES-R4',
  'descargas.md DES-R6', 'descargas.md DES-R7', 'descargas.md DES-R9',
  'descargas.md DES-R10',
  'navegacion.md NAV-R2', 'navegacion.md NAV-R3', 'navegacion.md NAV-R5',
  'notas.md NOTA-R1',
  'sitio.md SITIO-R7', 'sitio.md SITIO-R8',
]

/** Decididas y todavía sin código. Hoy ninguna: las 43 vivas están construidas. */
const REGLAS_NO_IMPLEMENTADAS = []

/**
 * Sin el tag de grupo en el nombre del test. Pest tiene `->group()`; Vitest
 * no, así que el equivalente es el tag en el nombre: con
 * `regla:<documento>:<ID>` adentro del nombre, `vitest -t "regla:sitio:SITIO-R5"`
 * corre exactamente lo que sostiene esa decisión. Ficha #2.
 */
const REGLAS_SIN_GRUPO = vivas().map((r) => `${r.doc}.md ${r.id}`)

/**
 * Reglas que usan un concepto de otro documento sin citar a su dueño. Es el
 * trinquete de lo que ya estaba escrito antes de que hubiera dueños. Ficha #3
 * — y ojo, no todas son deuda: el gate no distingue *usar el término* de
 * *decidir sobre el concepto*, así que hay que leerlas de a una.
 */
const REGLAS_SIN_CITAR_AL_DUENO = [
  'buscador.md BUS-R2 usa "catálogo" (dueño: descargas.md) sin citarlo',
  'buscador.md BUS-R5 usa "catálogo" (dueño: descargas.md) sin citarlo',
  'navegacion.md NAV-R1 usa "catálogo" (dueño: descargas.md) sin citarlo',
  'navegacion.md NAV-R7 usa "catálogo" (dueño: descargas.md) sin citarlo',
  'navegacion.md NAV-R8 usa "catálogo" (dueño: descargas.md) sin citarlo',
  'notas.md NOTA-R2 usa "catálogo" (dueño: descargas.md) sin citarlo',
  'sitio.md SITIO-R4 usa "catálogo" (dueño: descargas.md) sin citarlo',
  'sitio.md SITIO-R6 usa "catálogo" (dueño: descargas.md) sin citarlo',
  'sitio.md SITIO-R7 usa "catálogo" (dueño: descargas.md) sin citarlo',
]

const clave = (r) => `${r.doc}.md ${r.id}`
const ordenado = (xs) => [...xs].sort()

describe('el parseo ve lo que dice ver', () => {
  it('encuentra reglas en los seis documentos', () => {
    const porDoc = Object.fromEntries(DOCUMENTOS_DE_REGLAS.map((d) => [d, 0]))
    for (const r of todasLasReglas()) porDoc[r.doc]++
    for (const [doc, n] of Object.entries(porDoc)) {
      expect(n, `${doc}.md no aporta ninguna regla: ¿cambió el formato de la tabla?`).toBeGreaterThan(0)
    }
  })

  it('cada ID vive en el documento dueño de su prefijo', () => {
    for (const r of todasLasReglas()) {
      const prefijo = r.id.split('-')[0]
      expect(r.doc, `${r.id} está en ${r.doc}.md`).toBe(DOCUMENTO_POR_PREFIJO[prefijo])
    }
  })

  it('toda regla tiene resumen y estado', () => {
    for (const r of todasLasReglas()) {
      expect(r.resumen.length, `${r.id} no abre con un resumen en negrita`).toBeGreaterThan(10)
      expect(r.estado.trim(), `${r.id} no declara estado`).not.toBe('')
    }
  })
})

describe('las reglas muertas', () => {
  it('toda regla muerta manda a leer algo', () => {
    for (const r of todasLasReglas().filter((x) => x.muerta)) {
      const otras = [...r.texto.matchAll(/(?:APAR|BUS|DES|NAV|NOTA|SITIO)-R\d+/g)]
        .map((m) => m[0]).filter((id) => id !== r.id)
      expect(otras.length, `${r.id} está muerta y no nombra qué la reemplaza`).toBeGreaterThan(0)
    }
  })

  it('nadie manda a leer una regla muerta sin decir cuál manda ahora', () => {
    const muertas = todasLasReglas().filter((x) => x.muerta).map((x) => x.id)
    for (const r of vivas()) {
      for (const id of muertas) {
        if (!r.texto.includes(id)) continue
        const contexto = r.texto.slice(Math.max(0, r.texto.indexOf(id) - 200), r.texto.indexOf(id) + 300)
        // Las formas con las que un documento avisa que lo que cita ya no
        // rige. Sin "ya no existe" esto marcaba NAV-R9, que sí lo dice.
        expect(/reemplaz|muert|dejó de|se mudó|ya no (existe|rige|está)/i.test(contexto),
          `${r.id} cita a ${id}, que está muerta, sin decir que lo está`).toBe(true)
      }
    }
  })
})

describe('los trinquetes de deuda', () => {
  it('las implementadas sin cita son exactamente las declaradas', () => {
    const reales = vivas().filter((r) => r.implementada && !TESTS_AJENOS.includes(r.id)).map(clave)
    expect(ordenado(reales)).toEqual(ordenado(REGLAS_SIN_CITA))
  })

  it('las todavía sin implementar son exactamente las declaradas', () => {
    const reales = vivas().filter((r) => !r.implementada).map(clave)
    expect(ordenado(reales)).toEqual(ordenado(REGLAS_NO_IMPLEMENTADAS))
  })

  it('las que no tienen grupo son exactamente las declaradas', () => {
    const reales = vivas().filter((r) => !TESTS_AJENOS.includes(`regla:${r.doc}:${r.id}`)).map(clave)
    expect(ordenado(reales)).toEqual(ordenado(REGLAS_SIN_GRUPO))
  })
})

describe('dueño único por concepto', () => {
  it('ninguna regla decide un concepto que no es suyo', () => {
    const fallas = []
    for (const r of vivas()) {
      for (const [concepto, dueno] of Object.entries(CONCEPTOS_CON_DUENO)) {
        if (r.doc === dueno) continue
        // Límite de palabra de los DOS lados: sin el de la derecha,
        // "nota" matcheaba "notar" y marcaba reglas que hablan de otra cosa.
        if (!new RegExp(`\\b${concepto}s?\\b`, 'i').test(r.texto)) continue
        // Usar el término está bien; lo que no se puede es decidirlo sin
        // citar un ID del documento dueño.
        const citaAlDueno = [...r.texto.matchAll(/(?:APAR|BUS|DES|NAV|NOTA|SITIO)-R\d+/g)]
          .some((m) => DOCUMENTO_POR_PREFIJO[m[0].split('-')[0]] === dueno)
        if (!citaAlDueno) fallas.push(`${clave(r)} usa "${concepto}" (dueño: ${dueno}.md) sin citarlo`)
      }
    }
    expect(ordenado(fallas)).toEqual(ordenado(REGLAS_SIN_CITAR_AL_DUENO))
  })
})

describe('el tablero', () => {
  it('el índice del README está al día', () => {
    expect(readFileSync(join(DIR, 'README.md'), 'utf8'),
      'corré: node scripts/reglas-index.mjs').toBe(renderIndiceDeReglas())
  })

  it('cada documento trae los marcadores de abiertas', () => {
    for (const doc of DOCUMENTOS_DE_REGLAS) {
      const t = readFileSync(join(DIR, `${doc}.md`), 'utf8')
      expect(t, `${doc}.md no tiene <!-- abiertas -->`).toContain('<!-- abiertas -->')
      expect(t, `${doc}.md no tiene <!-- /abiertas -->`).toContain('<!-- /abiertas -->')
    }
  })

  it('toda pregunta abierta tiene su desarrollo en el documento', () => {
    for (const q of todasLasAbiertas()) {
      const t = readFileSync(join(DIR, `${q.doc}.md`), 'utf8')
      expect(t, `${q.id} está en la tabla pero no tiene sección propia`).toContain(`### ${q.id}`)
    }
  })
})
