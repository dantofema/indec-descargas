import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NOTES, NOTE_BY_TYPE, NOTE_BY_LAYER, noteFor, noteHref } from './notes.js'
import { TYPES, CHILD_LAYERS } from './download.js'
import { fmt } from './ui.js'

const catalog = JSON.parse(readFileSync(resolve(process.cwd(), 'public/catalog.json'), 'utf8'))
const porTipo = (t) => catalog.objects.filter((o) => o.t === t).length
const sumaEnJurisdicciones = (capa) => catalog.objects
  .filter((o) => o.t === 'jur')
  .reduce((acc, o) => acc + (o.ch?.[capa] ?? 0), 0)

describe('las ocho notas', () => {
  it('son ocho, una por objeto del Marco', () => {
    expect(NOTES).toHaveLength(8)
  })

  it('cada slug es único y sirve como ancla', () => {
    const slugs = NOTES.map((n) => n.slug)
    expect(new Set(slugs).size).toBe(8)
    for (const s of slugs) expect(s).toMatch(/^[a-z][a-z-]*[a-z]$/)
  })

  // El brief pide >40 caracteres por párrafo, pero eso contradice contenido
  // que el propio brief manda escribir ('Se descarga por cmu.' mide 20). La
  // intención del caso es que ninguna nota esté vacía, no imponer un largo
  // por párrafo: se verifica longitud no nula por párrafo y un piso sobre
  // la nota entera.
  it('ninguna nota está vacía', () => {
    for (const n of NOTES) {
      expect(n.paragraphs.length).toBeGreaterThan(0)
      for (const p of n.paragraphs) expect(p.trim().length).toBeGreaterThan(0)
      expect(n.paragraphs.join(' ').length, n.slug).toBeGreaterThan(200)
    }
  })

  it('el href apunta a la página de notas con el ancla', () => {
    expect(noteHref('radio-censal')).toMatch(/notas\/#radio-censal$/)
  })
})

describe('los dos vocabularios llegan a una nota', () => {
  it('todo tipo buscable tiene nota', () => {
    for (const t of Object.keys(TYPES)) {
      expect(noteFor(NOTE_BY_TYPE[t]), `falta la nota del tipo ${t}`).toBeDefined()
    }
  })

  it('toda capa hija tiene nota', () => {
    for (const capa of Object.keys(CHILD_LAYERS)) {
      expect(noteFor(NOTE_BY_LAYER[capa]), `falta la nota de la capa ${capa}`).toBeDefined()
    }
  })

  it('no hay notas huérfanas: cada una la alcanza algún vocabulario', () => {
    const alcanzables = new Set([...Object.values(NOTE_BY_TYPE), ...Object.values(NOTE_BY_LAYER)])
    for (const n of NOTES) expect(alcanzables.has(n.slug), `${n.slug} no la nombra nadie`).toBe(true)
  })
})

describe('los números que afirma una nota (NOTA-R2)', () => {
  it('coinciden con el catálogo commiteado', () => {
    for (const n of NOTES) {
      if (n.type) expect(n.total, `total de ${n.slug} por tipo`).toBe(porTipo(n.type))
      if (n.layer) expect(n.total, `total de ${n.slug} por capa`).toBe(sumaEnJurisdicciones(n.layer))
    }
  })

  it('los dos objetos que son tipo y capa a la vez dan lo mismo por los dos caminos', () => {
    const dobles = NOTES.filter((n) => n.type && n.layer)
    expect(dobles.map((n) => n.slug).sort()).toEqual(['departamento', 'localidad-censal'])
  })

  // El campo `total` estaba gateado y la prosa que repite ese mismo número,
  // no. Hoy están todos bien; el problema es mañana: al regenerar el
  // catálogo `total` falla, alguien lo corrige, y la prosa sigue diciendo
  // el número viejo sin que nada se ponga rojo.
  //
  // Las dos notas que se mudaron intactas (ver notes.js) no afirman su
  // total en prosa —/notas/ ya lo muestra como dato, leído del mismo campo
  // `total`—, así que están exceptuadas por nombre. La lista es cerrada en
  // los dos sentidos: el caso de abajo la pone roja si alguna de las dos
  // empieza a afirmarlo, y una nota nueva entra al gate sola.
  const SIN_TOTAL_EN_PROSA = new Set(['via-de-circulacion'])

  it('el número que la prosa afirma es el mismo que verifica el catálogo', () => {
    for (const n of NOTES) {
      if (SIN_TOTAL_EN_PROSA.has(n.slug)) continue
      expect(n.paragraphs.join(' '), `la prosa de ${n.slug} no dice ${fmt(n.total)}`)
        .toContain(fmt(n.total))
    }
  })

  it('las exceptuadas lo están porque no afirman su total, no por costumbre', () => {
    for (const slug of SIN_TOTAL_EN_PROSA) {
      const n = noteFor(slug)
      expect(n.paragraphs.join(' '), `${slug} ya afirma su total: sacala de la excepción`)
        .not.toContain(fmt(n.total))
    }
  })

  it('los nombres que son los tres tipos a la vez salen del catálogo, no de la memoria', () => {
    const porNombre = new Map()
    for (const o of catalog.objects) {
      if (!['gl', 'dep', 'loc'].includes(o.t)) continue
      if (!porNombre.has(o.n)) porNombre.set(o.n, new Set())
      porNombre.get(o.n).add(o.t)
    }
    const losTres = [...porNombre.values()].filter((s) => s.size === 3).length
    expect(noteFor('gobierno-local').paragraphs.join(' ')).toContain(`${losTres} nombres del catálogo`)
  })
})

describe('las dos notas que ya existían', () => {
  it('vías conserva su texto intacto', () => {
    const vias = noteFor('via-de-circulacion')
    expect(vias.paragraphs[0]).toBe(
      'Esta capa no lista calles: lista tramos. Una misma calle aparece tantas veces como tramos tenga su geometría, y todos comparten nombre, código y altura. En Tres de Febrero, las 1.487 filas son 727 calles; la más partida llega a 80 tramos.',
    )
    expect(vias.paragraphs[1]).toMatch(/^Se muestra tal como lo publica el INDEC/)
  })
})

describe('las fuentes externas (NOTA-R2, mitad nueva)', () => {
  it('cada fuente declarada está nombrada en el texto de su nota', () => {
    for (const n of NOTES) {
      for (const s of n.sources ?? []) {
        expect(n.paragraphs.join(' '), `${n.slug} enlaza a «${s.label}» sin nombrarla en el texto`)
          .toContain(s.label)
      }
    }
  })

  it('cada fuente lleva un enlace absoluto y https', () => {
    for (const n of NOTES) {
      for (const s of n.sources ?? []) {
        expect(s.href, `${n.slug} → ${s.label}`).toMatch(/^https:\/\//)
      }
    }
  })

  // La regla amplía qué se puede afirmar, no cuánto se puede inventar: una
  // nota con `sources` vacío declara una fuente que no existe.
  it('ninguna nota declara una lista de fuentes vacía', () => {
    for (const n of NOTES) {
      if ('sources' in n) expect(n.sources.length, `${n.slug}`).toBeGreaterThan(0)
    }
  })
})

describe('el caso que engaña (NOTA-R2, contra el catálogo)', () => {
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const locsDe = (dep) => catalog.objects.filter((o) => o.t === 'loc' && o.c.startsWith(dep.c))

  it('el partido de Tres de Febrero tiene una sola localidad censal, homónima', () => {
    const dep = catalog.objects.find((o) => o.t === 'dep' && o.c === '06840')
    const locs = locsDe(dep)
    expect(locs).toHaveLength(1)
    expect(locs[0].c).toBe('06840010')
    expect(norm(locs[0].n)).toBe(norm(dep.n))
  })

  it('los pueblos del partido no existen en la capa de localidades censales', () => {
    const ausentes = ['Caseros', 'Ciudadela', 'Sáenz Peña', 'Villa Bosch']
    for (const nombre of ausentes) {
      const enBA = catalog.objects.filter(
        (o) => o.t === 'loc' && o.p === 'Buenos Aires' && norm(o.n) === norm(nombre),
      )
      expect(enBA, `${nombre} apareció como localidad censal bonaerense`).toHaveLength(0)
    }
  })

  it('el número de partidos que la nota afirma sale del catálogo, no de la memoria', () => {
    const deps = catalog.objects.filter((o) => o.t === 'dep' && o.c.startsWith('06'))
    const unicaYHomonima = deps.filter((d) => {
      const h = locsDe(d)
      return h.length === 1 && norm(h[0].n) === norm(d.n)
    })
    // 29 en el catálogo; 28 son componente de aglomerado del Gran Buenos
    // Aires y una —General Alvear, 06287010— es un pueblo de verdad, que no
    // engaña a nadie. El catálogo no trae `tlc`, así que la excepción se
    // nombra acá: si el INDEC agrega otra, este caso se pone rojo y hay que
    // volver a mirar cuál de las dos cosas es.
    const SIN_AGLOMERADO = new Set(['06287010'])
    const componentes = unicaYHomonima.filter((d) => !SIN_AGLOMERADO.has(locsDe(d)[0].c))
    expect(componentes).toHaveLength(28)
    expect(noteFor('localidad-censal').paragraphs.join(' '))
      .toContain(`${componentes.length} partidos del Gran Buenos Aires`)
  })

  it('CABA aparece partida en quince, una por comuna', () => {
    const caba = catalog.objects.filter((o) => o.t === 'loc' && o.c.startsWith('02'))
    expect(caba).toHaveLength(15)
    expect(noteFor('localidad-censal').paragraphs.join(' ')).toContain('quince')
  })
})
