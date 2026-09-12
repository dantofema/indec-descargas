import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import {
  DOCUMENTOS_DE_REGLAS, DOCUMENTO_POR_PREFIJO, CONCEPTOS_CON_DUENO,
  PRESUPUESTO_DE_PREGUNTA, DIR, todasLasReglas, todasLasAbiertas,
  renderIndiceDeReglas, cuerpoDePregunta, cuerpoPendiente, pesarCuerpo,
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
const ARCHIVOS_AJENOS = execSync(
  'git ls-files "*.test.js" "*.test.mjs" | grep -v reglas.test.mjs', { encoding: 'utf8' })
  .trim().split('\n')
  .map((ruta) => ({ ruta, texto: readFileSync(ruta, 'utf8') }))
const TESTS_AJENOS = ARCHIVOS_AJENOS.map((a) => a.texto).join('\n')

const vivas = () => todasLasReglas().filter((r) => !r.muerta)

/**
 * Deuda declarada. Son listas **exactas**, no subconjuntos: una regla que
 * entra sin declararse pone el gate en rojo, que es la idea. Sólo bajan.
 */

/**
 * Citadas por su ID pero sin nombrar el documento. **Vacío desde el
 * 2026-09-12** (ficha #4): las 43 citas dicen `<ID> de docs/reglas/<doc>.md`,
 * y el chequeo lo exige por cercanía —dentro de los 200 caracteres del ID— y
 * no por archivo, porque dos reglas del mismo documento en el mismo archivo se
 * cubrían con una sola mención.
 */
const REGLAS_CITADAS_SIN_DOCUMENTO = []

/**
 * Implementadas cuyo test no las nombra. **Vacío desde el 2026-09-11** (ficha
 * #1): las 43 vivas están citadas, con el documento y el ID adentro de la
 * cita — `R5` pelado matchea dos numeraciones distintas y daría verde por
 * coincidencia.
 *
 * Queda como lista y no como aserción directa para que agregar una regla sin
 * citarla obligue a declararla acá a propósito, en vez de pasar de largo.
 */
const REGLAS_SIN_CITA = []

/** Decididas y todavía sin código. */
const REGLAS_NO_IMPLEMENTADAS = []

/**
 * Sin el tag de grupo en el nombre del test. **Vacío desde el 2026-09-11**
 * (ficha #2).
 *
 * Pest tiene `->group()`; Vitest no, así que el equivalente es el tag en el
 * nombre, entre paréntesis al final — que es la convención que el repo ya
 * usaba con el ID pelado. Con `regla:<documento>:<ID>` adentro del nombre,
 * `npx vitest -t "regla:sitio:SITIO-R5"` corre exactamente lo que sostiene
 * esa decisión.
 */
const REGLAS_SIN_GRUPO = []

/**
 * Usos que **nombran** el concepto sin decidir nada sobre él. El gate no
 * distingue una cosa de la otra, así que la separación es a mano y con el
 * motivo escrito (ficha #3). No son deuda: exigirles una cita dejaría escrito
 * un vínculo que no existe.
 */
const USOS_SIN_DECIDIR = {
  'buscador.md BUS-R2': 'dice "medio catálogo" como cantidad coloquial, hablando de cuántos resultados devolvería un OR',
  'navegacion.md NAV-R7': 'lo usa como medición —4.023 de 6.977— para justificar a quién le habla el aviso',
  'navegacion.md NAV-R8': 'lo usa como medición, por el mismo motivo, para elegir el tier de timeout',
}

/**
 * Reglas que deciden algo apoyadas en un concepto de otro documento sin citar
 * a su dueño. Las tres que quedan dependen de **qué tipos entran al
 * catálogo**, y eso no lo decide ninguna regla todavía: está abierto en
 * DES-Q2. Citar a DES-R6 —que sólo habla del build— sería citar un precedente
 * que no dice lo que se necesita.
 */
const REGLAS_SIN_CITAR_AL_DUENO = [
  'buscador.md BUS-R5 usa "catálogo" (dueño: descargas.md) sin citarlo',
  'navegacion.md NAV-R1 usa "catálogo" (dueño: descargas.md) sin citarlo',
  'sitio.md SITIO-R4 usa "catálogo" (dueño: descargas.md) sin citarlo',
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
    const citada = (id) => new RegExp(`\\b${id}\\b`).test(TESTS_AJENOS)
    const reales = vivas().filter((r) => r.implementada && !citada(r.id)).map(clave)
    expect(ordenado(reales)).toEqual(ordenado(REGLAS_SIN_CITA))
  })

  it('la cita nombra el documento, no sólo el ID', () => {
    // `R1` pelado matchea dos numeraciones sin relación y daría verde por
    // coincidencia; por eso la disciplina pide documento **y** ID. El caso de
    // arriba sólo mira el ID: sin esto, cambiar "NOTA-R1 de notas.md" por un
    // "R1" suelto en otro archivo pasaba igual.
    const fallas = []
    for (const r of vivas().filter((x) => x.implementada)) {
      // Por cercanía y no por archivo: dos reglas del mismo documento en el
      // mismo archivo hacían que una sola mención del documento cubriera a
      // las dos, que es un verde que no dice nada.
      let citada = false, conDocumento = false
      for (const a of ARCHIVOS_AJENOS) {
        for (const m of a.texto.matchAll(new RegExp(`\\b${r.id}\\b`, 'g'))) {
          citada = true
          const cerca = a.texto.slice(Math.max(0, m.index - 200), m.index + 200)
          if (cerca.includes(`docs/reglas/${r.doc}.md`)) conDocumento = true
        }
      }
      if (citada && !conDocumento) fallas.push(`${clave(r)} se cita sin nombrar su documento`)
    }
    expect(ordenado(fallas)).toEqual(ordenado(REGLAS_CITADAS_SIN_DOCUMENTO))
  })

  it('las todavía sin implementar son exactamente las declaradas', () => {
    const reales = vivas().filter((r) => !r.implementada).map(clave)
    expect(ordenado(reales)).toEqual(ordenado(REGLAS_NO_IMPLEMENTADAS))
  })

  it('las que no tienen grupo son exactamente las declaradas', () => {
    // Sólo a las implementadas: una regla decidida y sin construir todavía no
    // tiene test que agrupar, y exigírselo confundiría "falta el tag" con
    // "falta el código".
    // Con `includes`, el tag de NAV-R11 satisfacía a NAV-R1: es substring
    // suyo. Lo encontró una mutación —sacarle el tag a NAV-R1 daba verde— y
    // es la misma clase de error que el ID pelado.
    const conGrupo = (r) => new RegExp(`regla:${r.doc}:${r.id}\\b`).test(TESTS_AJENOS)
    const reales = vivas().filter((r) => r.implementada && !conGrupo(r)).map(clave)
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
        if (citaAlDueno) continue
        if (USOS_SIN_DECIDIR[clave(r)]) continue
        fallas.push(`${clave(r)} usa "${concepto}" (dueño: ${dueno}.md) sin citarlo`)
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

  it('el rango de cada superficie llega hasta su última regla', () => {
    // Esa tabla se escribe a mano y es lo primero que se lee del tablero.
    // Cerrar una pregunta agrega una regla al final y el rango queda corto
    // sin que nada avise: DES-R11 nació y el índice seguía diciendo R10.
    const readme = readFileSync(join(DIR, 'README.md'), 'utf8')
    for (const doc of DOCUMENTOS_DE_REGLAS) {
      const ids = todasLasReglas().filter((r) => r.doc === doc)
        .map((r) => Number(r.id.split('-R')[1]))
      const fila = readme.match(new RegExp(`\\| \\[${doc}\\]\\(${doc}\\.md\\) \\| ([^|]+) \\|`))
      expect(fila, `el índice no lista ${doc}`).not.toBe(null)
      const prefijo = todasLasReglas().find((r) => r.doc === doc).id.split('-R')[0]
      expect(fila[1].trim(), `el rango de ${doc} quedó viejo`)
        .toBe(`${prefijo}-R${Math.min(...ids)} … ${prefijo}-R${Math.max(...ids)}`)
    }
  })

  it('cada documento trae los marcadores de abiertas', () => {
    for (const doc of DOCUMENTOS_DE_REGLAS) {
      const t = readFileSync(join(DIR, `${doc}.md`), 'utf8')
      expect(t, `${doc}.md no tiene <!-- abiertas -->`).toContain('<!-- abiertas -->')
      expect(t, `${doc}.md no tiene <!-- /abiertas -->`).toContain('<!-- /abiertas -->')
    }
  })

  it('toda pregunta abierta tiene dónde contestarse', () => {
    // La respuesta va **inline en el documento**, no en un chat: una
    // conclusión dicha al pasar se evapora y al rato reaparece disfrazada de
    // hecho adentro de un test. La línea `> **Tu respuesta:**` es ese lugar,
    // y va **después** de la tabla de opciones: `cuerpoPendiente` mide lo que
    // queda antes de ella, así que arriba de todo no mediría nada.
    for (const q of todasLasAbiertas()) {
      const cuerpo = cuerpoDePregunta(q)
      expect(cuerpo, `${q.id} no tiene dónde escribir la respuesta`).toMatch(/^> \*\*Tu respuesta:\*\*/m)
      const marca = cuerpo.search(/^> \*\*Tu respuesta:\*\*/m)
      const tabla = cuerpo.lastIndexOf('| **(')
      if (tabla !== -1) {
        expect(marca, `${q.id} pone la respuesta antes de las opciones`).toBeGreaterThan(tabla)
      }
    }
  })

  it('toda pregunta abierta ofrece sacar la cosa', () => {
    // Tres veces en un día la respuesta fue una opción que nadie había
    // escrito, y las tres eran quitar la promesa en vez de arreglarla.
    for (const q of todasLasAbiertas()) {
      expect(cuerpoDePregunta(q), `${q.id} no ofrece sacar la cosa`).toMatch(/Sacar la cosa/i)
    }
  })

  it('ninguna pregunta abierta se pasa del presupuesto', () => {
    const excedidas = []
    for (const q of todasLasAbiertas()) {
      const medido = pesarCuerpo(cuerpoPendiente(cuerpoDePregunta(q)))
      for (const [metrica, tope] of Object.entries(PRESUPUESTO_DE_PREGUNTA)) {
        if (medido[metrica] > tope) excedidas.push(`${q.id}: ${metrica} ${medido[metrica]} > ${tope}`)
      }
    }
    expect(excedidas, 'una pregunta que no entra en el presupuesto no se contesta: se parte').toEqual([])
  })

  it('la sección de abiertas dice algo aunque esté vacía', () => {
    // Dos comentarios HTML no se ven al leer el markdown renderizado: la
    // sección quedaba en blanco y parecía rota.
    for (const doc of DOCUMENTOS_DE_REGLAS) {
      const t = readFileSync(join(DIR, `${doc}.md`), 'utf8')
      const bloque = t.match(/<!-- abiertas -->\n([\s\S]*?)<!-- \/abiertas -->\n([\s\S]*?)\n## /)
      expect(bloque, `${doc}.md no tiene la sección de abiertas donde va`).not.toBe(null)
      const [, filas, despues] = bloque
      if (!filas.trim()) {
        expect(despues.trim(), `${doc}.md tiene la sección vacía y sin explicar`).not.toBe('')
      }
    }
  })

  it('toda pregunta abierta tiene su desarrollo en el documento', () => {
    for (const q of todasLasAbiertas()) {
      const t = readFileSync(join(DIR, `${q.doc}.md`), 'utf8')
      expect(t, `${q.id} está en la tabla pero no tiene sección propia`).toContain(`### ${q.id}`)
    }
  })
})
