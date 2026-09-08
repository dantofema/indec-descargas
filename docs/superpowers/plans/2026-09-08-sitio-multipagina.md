# Sitio multipágina — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partir `indec-descargas` en cuatro páginas con URL propia, dar a cada objeto un enlace permanente que es además la única fuente de verdad del estado, y hacer que la ficha describa siempre lo que el mapa está dibujando.

**Architecture:** Vite multi-page sobre GitHub Pages estático. Cada página es un HTML de verdad con su entry JS; el header, el CTA y el footer se inyectan en build desde partials compartidos. El estado vive entero en la query string, así que elegir un objeto navega y atrás/adelante funcionan sin código de historia. Los módulos de dominio que ya existen no cambian de contrato salvo tres excepciones nombradas.

**Tech Stack:** Vite 6, Vitest 2 + jsdom, Leaflet 1.9, JavaScript ESM sin framework. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-09-08-sitio-multipagina-design.md`

## Global Constraints

- **Sin dependencias nuevas.** El repo tiene una sola dependencia de runtime (Leaflet) y así queda. Los iconos son SVG inline, no una fuente ni un paquete.
- **Sitio estático**, sin backend, servido bajo `base: '/indec-descargas/'`. No se toca `.github/workflows/deploy.yml`.
- **Castellano en la interfaz, inglés en el código.** Los comentarios de este repo son en castellano y explican *por qué*, no *qué*: seguir ese registro.
- **Ningún número sobre el INDEC se escribe de memoria.** Sale del catálogo commiteado o de una respuesta del servidor. Si no se puede verificar, no entra.
- **Reglas vigentes que siguen valiendo:** BUS-R1…R4, DES-R1…R10, NAV-R1, R2, R3, R4, R5, R7, R8, y la mitad "no se recorre" de NAV-R9.
- **Valores exactos verificados el 2026-09-08** (usar textualmente, no recalcular):
  - Totales: `jur` 24, `dep` 529, `loc` 4023, `gl` 2282, `aglo` 119, `fracciones` 6571, `radios` 66515, `vias` 477588.
  - Geoportal INDEC = `https://geonode.indec.gob.ar/` (`geoportal.indec.gob.ar` no existe, sin DNS).
  - Texto del CTA: `Más info, más mapas, más capas en Geoportal INDEC`.
  - Objetivo del sitio (hero): `La cartografía del INDEC más fácil de descargar y usarla en tus proyectos`.
  - Footer: `Av. Presidente Julio A. Roca 609, P.B. — C1067ABB, Ciudad Autónoma de Buenos Aires, Argentina`; `Consultas: (54-11) 5031-4632`; licencia `Creative Commons BY-SA 4.0` → `https://creativecommons.org/licenses/by-sa/4.0/deed.es`.
- **Comandos:** `npm test` corre la suite. `npm run build` construye. `npx vitest run src/archivo.test.js` corre un archivo.

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `src/permalink.js` | Único que conoce los nombres de los parámetros de la URL. `parse` / `format`. |
| `src/totales.js` | Carga `totales.json`. Nada más. |
| `scripts/shell.mjs` | `injectShell` (función pura) + `shellPlugin` (Vite). |
| `src/shell/header.html`, `cta.html`, `footer.html` | El shell compartido, como HTML. |
| `src/pages/{home,resultados,notas,servicios}.js` | Una entry por página. Cablean; no deciden. |
| `resultados/index.html`, `notas/index.html`, `servicios/index.html` | Las tres páginas nuevas. |
| `public/totales.json` | Generado por el build del catálogo, commiteado. |
| `docs/reglas/sitio.md`, `docs/reglas/notas.md` | Reglas de producto nuevas. |

**Se modifican:** `index.html` (pasa a ser el home), `vite.config.js`, `src/map.js`, `src/notes.js`, `src/browser.js`, `src/style.css`, `scripts/build-index.mjs`, `docs/reglas/navegacion.md`, `docs/reglas/README.md`, `README.md`.

**Se borran:** `src/main.js` y `src/main.test.js` — su contenido se muda a `src/pages/resultados.js` y `src/pages/resultados.test.js`.

---
### Task 1: `src/permalink.js` — la URL como estado

**Files:**
- Create: `src/permalink.js`
- Test: `src/permalink.test.js`

**Interfaces:**
- Consumes: `TYPES`, `CHILD_LAYERS`, `isCode` de `src/download.js` (ya existen).
- Produces:
  - `parse(search: string) => {status:'empty'} | {status:'invalid', reason:string} | {status:'ok', type:string, code:string, layer:string|null}`
  - `format(obj: {t,c}, capa?: string|null) => string` — href absoluto con `BASE_URL`.

**Qué NO hace este módulo:** no sabe si el objeto existe en el catálogo ni si esa capa le corresponde a ese objeto. No tiene el catálogo. Eso lo decide `pages/resultados.js` (Task 7). Acá sólo se valida la sintaxis.

- [ ] **Step 1: Write the failing test**

```js
// src/permalink.test.js
import { describe, it, expect } from 'vitest'
import { parse, format } from './permalink.js'

const search = (href) => new URL(href, 'http://x').search

describe('parse', () => {
  it('sin parámetros es vacío, no un error', () => {
    expect(parse('')).toEqual({ status: 'empty' })
    expect(parse('?')).toEqual({ status: 'empty' })
  })

  it('lee tipo y código', () => {
    expect(parse('?t=dep&c=06840')).toEqual({ status: 'ok', t: 'dep', c: '06840', capa: null })
  })

  it('conserva los ceros a la izquierda del código', () => {
    expect(parse('?t=jur&c=02').c).toBe('02')
  })

  it('lee la capa cuando es una de las declaradas', () => {
    expect(parse('?t=dep&c=06840&capa=radios')).toEqual(
      { status: 'ok', t: 'dep', c: '06840', capa: 'radios' },
    )
  })

  it('ignora una capa que no existe en vez de fallar: la ficha sirve igual', () => {
    expect(parse('?t=dep&c=06840&capa=inventada').capa).toBeNull()
  })

  it('rechaza un tipo desconocido', () => {
    expect(parse('?t=xx&c=06840').status).toBe('invalid')
  })

  it('rechaza un código que no son dígitos: es lo que se interpola en el CQL', () => {
    expect(parse("?t=dep&c=06840'+OR+1=1").status).toBe('invalid')
    expect(parse('?t=dep&c=abc').status).toBe('invalid')
  })

  it('rechaza que falte cualquiera de los dos', () => {
    expect(parse('?t=dep').status).toBe('invalid')
    expect(parse('?c=06840').status).toBe('invalid')
  })

  it('el motivo dice qué parámetro está mal', () => {
    expect(parse('?t=xx&c=06840').reason).toMatch(/tipo/i)
    expect(parse('?t=dep&c=abc').reason).toMatch(/código|codigo/i)
  })
})

describe('format', () => {
  it('arma el href de resultados', () => {
    expect(format({ t: 'dep', c: '06840' })).toMatch(/resultados\/\?t=dep&c=06840$/)
  })

  it('agrega la capa sólo si se pide', () => {
    expect(format({ t: 'dep', c: '06840' })).not.toMatch(/capa/)
    expect(format({ t: 'dep', c: '06840' }, 'radios')).toMatch(/&capa=radios$/)
  })

  it('ida y vuelta: lo que formatea es lo que parsea', () => {
    for (const capa of [null, 'vias']) {
      const obj = { t: 'loc', c: '06840010' }
      expect(parse(search(format(obj, capa)))).toEqual({ status: 'ok', ...obj, capa })
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/permalink.test.js`
Expected: FAIL — `Failed to resolve import "./permalink.js"`

- [ ] **Step 3: Write minimal implementation**

```js
// src/permalink.js
import { TYPES, CHILD_LAYERS, isCode } from './download.js'

/**
 * La URL de /resultados/ es el estado entero: no hay nada que recordar
 * fuera de ella. Este módulo es el único que conoce los nombres de los
 * parámetros; el resto del sitio pide `parse` y `format`.
 *
 * Valida sintaxis, no existencia: acá no está el catálogo, así que "este
 * código no es de ningún objeto" y "esta capa no la tiene este objeto" los
 * decide quien sí lo tiene (pages/resultados.js).
 */
export function parse(search) {
  const p = new URLSearchParams(search)
  const t = p.get('t')
  const c = p.get('c')

  if (t === null && c === null) return { status: 'empty' }
  if (t === null || c === null) {
    return { status: 'invalid', reason: 'faltan el tipo o el código del objeto en el enlace' }
  }
  if (!(t in TYPES)) {
    return { status: 'invalid', reason: `tipo de objeto desconocido en el enlace: ${t}` }
  }
  // El código es lo único que se interpola dentro del CQL_FILTER: entra por
  // la misma puerta que `assertCode`, pero sin explotar, porque un enlace
  // mal copiado no es un error de programa.
  if (!isCode(c)) {
    return { status: 'invalid', reason: `el código del enlace no son dígitos: ${c}` }
  }

  // Una capa que no existe se ignora en vez de invalidar el enlace: el
  // objeto sigue siendo mostrable y abrir su primera pestaña es una
  // respuesta mejor que un error.
  const capa = p.get('capa')
  return { status: 'ok', t, c, capa: capa && capa in CHILD_LAYERS ? capa : null }
}

/** El enlace permanente de un objeto, opcionalmente con su capa abierta. */
export function format(obj, capa = null) {
  const p = new URLSearchParams({ t: obj.t, c: obj.c })
  if (capa) p.set('capa', capa)
  return `${import.meta.env.BASE_URL}resultados/?${p}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/permalink.test.js`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/permalink.js src/permalink.test.js
git commit -m "feat: la URL de resultados sabe leerse y escribirse sola"
```

---

### Task 2: los totales del home salen del build

**Files:**
- Modify: `scripts/lib/aggregate.mjs` (agregar `buildTotales`)
- Modify: `scripts/lib/aggregate.test.mjs`
- Modify: `scripts/build-index.mjs` (escribir `public/totales.json`)
- Create: `public/totales.json` (generado, se commitea)
- Create: `src/totales.js`, `src/totales.test.js`

**Interfaces:**
- Produces:
  - `buildTotales(catalog) => {generated, jur, dep, loc, gl, aglo, fracciones, radios, vias}` (en `scripts/lib/aggregate.mjs`)
  - `loadTotales(url?) => Promise<Totales>` (en `src/totales.js`)

**Por qué una función pura en `aggregate.mjs` y no un cálculo suelto en `build-index.mjs`:** así se computa desde el catálogo ya armado —no desde los CSV— y un test la ejerce sin red. Los totales no pueden divergir del catálogo porque salen de él.

- [ ] **Step 1: Write the failing test**

Agregar a `scripts/lib/aggregate.test.mjs`:

```js
import { buildTotales } from './aggregate.mjs'

describe('buildTotales', () => {
  const catalog = {
    generated: '2026-09-06',
    objects: [
      { t: 'jur', c: '06', n: 'Buenos Aires', ch: { departamentos: 2, fracciones: 10, radios: 100, localidades: 5, vias: 1000 } },
      { t: 'jur', c: '02', n: 'CABA', ch: { departamentos: 1, fracciones: 3, radios: 30, localidades: 1, vias: 200 } },
      { t: 'dep', c: '06840', n: 'Tres de Febrero', ch: { radios: 40 } },
      { t: 'dep', c: '02001', n: 'Comuna 1', ch: {} },
      { t: 'loc', c: '068400', n: 'x', ch: { vias: 9 } },
      { t: 'gl', c: '060840', n: 'y' },
      { t: 'aglo', c: '0001', n: 'z', ch: { localidades: 2, vias: 5 } },
    ],
  }

  it('cuenta por tipo los objetos buscables', () => {
    const t = buildTotales(catalog)
    expect(t).toMatchObject({ jur: 2, dep: 2, loc: 1, gl: 1, aglo: 1 })
  })

  it('las capas sin objeto propio se suman sobre las jurisdicciones, no sobre todo', () => {
    // Sumar sobre todos los objetos contaría los radios de Tres de Febrero
    // dos veces: una en el departamento y otra en su provincia.
    const t = buildTotales(catalog)
    expect(t.fracciones).toBe(13)
    expect(t.radios).toBe(130)
    expect(t.vias).toBe(1200)
  })

  it('arrastra la fecha del catálogo, para que el home no diga una distinta', () => {
    expect(buildTotales(catalog).generated).toBe('2026-09-06')
  })
})
```

Y crear `src/totales.test.js`, que es el que impide que el archivo commiteado envejezca:

```js
// src/totales.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildTotales } from '../scripts/lib/aggregate.mjs'

const leer = (p) => JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8'))

describe('public/totales.json', () => {
  it('dice exactamente lo que sale de sumar el catálogo commiteado', () => {
    // Si esto falla es porque se regeneró el catálogo sin regenerar los
    // totales: el home estaría publicando números viejos.
    expect(leer('public/totales.json')).toEqual(buildTotales(leer('public/catalog.json')))
  })

  it('trae los números verificados el 2026-09-08', () => {
    expect(leer('public/totales.json')).toMatchObject({
      jur: 24, dep: 529, loc: 4023, gl: 2282, aglo: 119,
      fracciones: 6571, radios: 66515, vias: 477588,
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/lib/aggregate.test.mjs src/totales.test.js`
Expected: FAIL — `buildTotales is not a function` y `ENOENT public/totales.json`.

- [ ] **Step 3: Write the implementation**

En `scripts/lib/aggregate.mjs`:

```js
/** Los tipos de objeto buscables, que se cuentan de a uno. */
const TIPOS = ['jur', 'dep', 'loc', 'gl', 'aglo']

/** Las capas que no son objeto buscable y sólo existen como hijas. */
const CAPAS = ['fracciones', 'radios', 'vias']

/**
 * Los números que muestra el home. Salen del catálogo ya armado, no de los
 * CSV: así no pueden decir algo distinto de lo que el sitio publica.
 *
 * Las capas sin objeto propio se suman sobre las 24 jurisdicciones y no
 * sobre todos los objetos: el país está particionado por jurisdicción, así
 * que sumar todo contaría los radios de un departamento otra vez dentro de
 * su provincia.
 */
export function buildTotales(catalog) {
  const totales = { generated: catalog.generated }
  for (const t of TIPOS) totales[t] = catalog.objects.filter((o) => o.t === t).length
  const jurisdicciones = catalog.objects.filter((o) => o.t === 'jur')
  for (const capa of CAPAS) {
    totales[capa] = jurisdicciones.reduce((acc, o) => acc + (o.ch?.[capa] ?? 0), 0)
  }
  return totales
}
```

En `scripts/build-index.mjs`: importar `buildTotales` junto a `buildCatalog`, agregar `const OUT_TOTALES = new URL('../public/totales.json', import.meta.url)` al lado de `OUT`, y después del `writeFile(OUT, ...)`:

```js
  const totales = buildTotales(catalog)
  await writeFile(OUT_TOTALES, JSON.stringify(totales, null, 2) + '\n')
  console.error(`Escrito public/totales.json`, totales)
```

Crear `src/totales.js`:

```js
/** Los totales del home. 300 bytes: se piden antes que el catálogo. */
export async function loadTotales(url = `${import.meta.env.BASE_URL}totales.json`) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`no se pudieron cargar los totales: HTTP ${res.status}`)
  return res.json()
}
```

- [ ] **Step 4: Generate `public/totales.json` and run the tests**

Generarlo **desde el catálogo commiteado**, sin tocar la red:

```bash
node -e "
import('./scripts/lib/aggregate.mjs').then(async (m) => {
  const fs = await import('node:fs/promises')
  const catalog = JSON.parse(await fs.readFile('public/catalog.json', 'utf8'))
  await fs.writeFile('public/totales.json', JSON.stringify(m.buildTotales(catalog), null, 2) + '\n')
})
"
cat public/totales.json
```

Run: `npx vitest run scripts/lib/aggregate.test.mjs src/totales.test.js`
Expected: PASS. `public/totales.json` debe decir `jur: 24, dep: 529, loc: 4023, gl: 2282, aglo: 119, fracciones: 6571, radios: 66515, vias: 477588`.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/aggregate.mjs scripts/lib/aggregate.test.mjs scripts/build-index.mjs public/totales.json src/totales.js src/totales.test.js
git commit -m "feat: los totales del home salen del catálogo y no pueden envejecer solos"
```

---
### Task 3: `src/notes.js` — ocho notas, una por objeto

**Files:**
- Modify: `src/notes.js` (reescritura: cambia de eje)
- Modify: `src/notes.test.js`
- Modify: `src/main.js`, `src/main.test.js`, `index.html` (la fila de notas de la ficha muere acá)

**Interfaces:**
- Consumes: nada del catálogo en runtime. `import.meta.env.BASE_URL` para el href.
- Produces:
  - `NOTES: Array<{slug, label, type:string|null, layer:string|null, total:number, paragraphs:string[]}>`
  - `NOTE_BY_TYPE: Record<'jur'|'dep'|'loc'|'gl'|'aglo', string>`
  - `NOTE_BY_LAYER: Record<'departamentos'|'fracciones'|'radios'|'localidades'|'vias', string>`
  - `noteFor(slug) => Note | undefined`
  - `noteHref(slug) => string` — `${BASE_URL}notas/#${slug}`

**Lo que desaparece:** `notesFor(obj)` y el import de `nonEmptyChildrenOf`. **NAV-R6 muere acá, no más adelante:** `main.js` es el único consumidor de `notesFor`, así que la fila de notas de la ficha se va en esta misma tarea o el sitio queda roto entre tareas. Concretamente: borrar `renderNotes` y su llamada en `selectObject`, las entradas `notes` y `rowNotes` del objeto `el`, y el bloque `<div class="row" id="row-notes">…</div>` de `index.html`; sacar de `src/main.test.js` los casos que afirman la fila de notas. Entre esta tarea y la Task 5 no hay a dónde enlazar —`/notas/` todavía no existe—: es la ventana esperada, y la Task 9 pone los enlaces. `nonEmptyChildrenOf` sigue existiendo en `catalog.js` porque la usan `browser.js` y `children.js`.

**Las dos notas que ya existen se mudan con su texto intacto, carácter por carácter.** El `total` es un campo aparte y no entra en `paragraphs`, justamente para no tocarlas.

- [ ] **Step 1: Write the failing test**

Reescribir `src/notes.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NOTES, NOTE_BY_TYPE, NOTE_BY_LAYER, noteFor, noteHref } from './notes.js'
import { TYPES, CHILD_LAYERS } from './download.js'

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

  it('ninguna nota está vacía', () => {
    for (const n of NOTES) {
      expect(n.paragraphs.length).toBeGreaterThan(0)
      for (const p of n.paragraphs) expect(p.trim().length).toBeGreaterThan(40)
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
      if (n.tipo) expect(n.total, `total de ${n.slug} por tipo`).toBe(porTipo(n.tipo))
      if (n.capa) expect(n.total, `total de ${n.slug} por capa`).toBe(sumaEnJurisdicciones(n.capa))
    }
  })

  it('los dos objetos que son tipo y capa a la vez dan lo mismo por los dos caminos', () => {
    const dobles = NOTES.filter((n) => n.tipo && n.capa)
    expect(dobles.map((n) => n.slug).sort()).toEqual(['departamento', 'localidad-censal'])
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

  it('localidad censal conserva sus tres párrafos intactos', () => {
    const loc = noteFor('localidad-censal')
    expect(loc.paragraphs).toHaveLength(3)
    expect(loc.paragraphs[0]).toBe(
      '«Localidad censal» no es lo que en la conversación diaria se llama localidad. Es una unidad del Marco Geoestadístico y a menudo no coincide con el municipio ni con el partido del mismo nombre.',
    )
    expect(loc.paragraphs[1]).toMatch(/tres objetos distintos con el mismo nombre/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/notes.test.js`
Expected: FAIL — `NOTES` no existe.

- [ ] **Step 3: Write the implementation**

Reescribir `src/notes.js`. Los ocho objetos, en este orden (de lo más grande a lo más chico, que es como se recorre el Marco):

```js
/**
 * Una nota por objeto del Marco Geoestadístico. Viven acá y no en el HTML
 * de /notas/ porque los tests tienen que poder citarlas y porque los
 * números que afirman se comparan contra el catálogo (NOTA-R2).
 *
 * `tipo` es la clave de TYPES cuando el objeto se puede buscar; `capa` la
 * de CHILD_LAYERS cuando además se puede recorrer como hija. Departamento y
 * localidad censal son las dos cosas a la vez.
 *
 * `total` va aparte de `paragraphs` a propósito: así las dos notas que ya
 * existían se mudaron sin tocarles una coma.
 */
export const NOTES = [
  {
    slug: 'jurisdiccion',
    label: 'Jurisdicción',
    tipo: 'jur',
    capa: null,
    total: 24,
    paragraphs: [
      'El INDEC llama jurisdicción a lo que en la conversación diaria es una provincia. Son 24: las 23 provincias y la Ciudad Autónoma de Buenos Aires, que no es una provincia pero sí una unidad del mismo nivel para el Marco Geoestadístico.',
      'Es el único objeto que contiene las cinco capas hijas —departamentos, fracciones, radios, localidades y vías— y también el filtro más caro que se le puede pedir al GeoServer: una página de 20 vías filtrada por provincia tarda entre 88 y 99 segundos medidos.',
      'Se descarga por el campo cpr.',
    ],
  },
  {
    slug: 'departamento',
    label: 'Departamento',
    tipo: 'dep',
    capa: 'departamentos',
    total: 529,
    paragraphs: [
      'Son 529 en el país, y el nombre cambia según dónde estés parado: en la Ciudad Autónoma de Buenos Aires son las 15 comunas y en la provincia de Buenos Aires, los 135 partidos. El INDEC los publica a todos en la misma capa, con el mismo campo cde.',
      'Contiene fracciones, radios, localidades y vías, así que es el nivel más cómodo para bajar la cadena censal completa de una zona sin pedir una provincia entera.',
      'Los códigos de departamento no cierran entre capas: hay 529 en departamentos, 530 en radios y 527 en vías. Este sitio reporta esas inconsistencias cuando regenera el catálogo y no las corrige, porque corregirlas sería inventar un dato que el INDEC no publicó.',
    ],
  },
  {
    slug: 'fraccion-censal',
    label: 'Fracción censal',
    tipo: null,
    capa: 'fracciones',
    total: 6571,
    paragraphs: [
      'Son 6.571 y no tienen nombre: el Marco Geoestadístico publica un número de fracción y un código, nada más. Este sitio no les inventa un rótulo, así que la tabla muestra número y código.',
      'Es el nivel intermedio entre el departamento y el radio: cada radio censal lleva el número de la fracción que lo contiene.',
      'No se puede buscar por nombre porque no lo tiene: se llega a las fracciones desde el objeto que las contiene. Se descarga por cod_indec.',
    ],
  },
  {
    slug: 'radio-censal',
    label: 'Radio censal',
    tipo: null,
    capa: 'radios',
    total: 66515,
    paragraphs: [
      'Son 66.515 y es la unidad más chica del Marco Geoestadístico. Tampoco tiene nombre: número de radio, número de la fracción que lo contiene, si es urbano o rural, y su código.',
      'Es una capa grande pero rápida: los 23.901 radios de la provincia de Buenos Aires bajan en 22 MB y 6,9 segundos medidos, y el archivo llega completo. No hay tope de descarga.',
      'Se llega a los radios desde el objeto que los contiene, y se descarga por cod_indec.',
    ],
  },
  {
    slug: 'localidad-censal',
    label: 'Localidad censal',
    tipo: 'loc',
    capa: 'localidades',
    total: 4023,
    paragraphs: [
      // Los tres párrafos originales, sin tocar.
    ],
  },
  {
    slug: 'gobierno-local',
    label: 'Gobierno local',
    tipo: 'gl',
    capa: null,
    total: 2282,
    paragraphs: [
      'Son 2.282 y son la excepción del sitio: no ofrecen ninguna capa hija. No es una omisión. Ni los radios ni las fracciones llevan el campo cmu que identifica al gobierno local, así que lo único que podrían ofrecer son las vías; y el gobierno local está fuera de la cadena censal —no tiene cde—, así que una sola capa suelta ahí no se explica.',
      'Un mismo nombre puede ser gobierno local, departamento y localidad censal a la vez, con tres límites distintos: Avellaneda y Tres de Febrero son los dos casos. Por eso cada resultado del buscador muestra de qué tipo es, que es lo que decide qué límites vas a bajar.',
      'Se descarga por cmu.',
    ],
  },
  {
    slug: 'aglomerado',
    label: 'Aglomerado',
    tipo: 'aglo',
    capa: null,
    total: 119,
    paragraphs: [
      'Son 119 y es el único objeto del Marco que no respeta los límites administrativos: 14 de ellos cruzan más de una provincia. El Gran Buenos Aires abarca la provincia de Buenos Aires y la Ciudad Autónoma, con 64 localidades censales y 112.152 vías.',
      'Contiene localidades censales y vías, pero no radios ni fracciones: esas capas no llevan el campo codaglo, así que no hay filtro que las recorte por aglomerado.',
      'Se descarga por codaglo.',
    ],
  },
  {
    slug: 'via-de-circulacion',
    label: 'Vía de circulación',
    tipo: null,
    capa: 'vias',
    total: 477588,
    paragraphs: [
      // Los dos párrafos originales, sin tocar.
    ],
  },
]

export const NOTE_BY_TYPE = {
  jur: 'jurisdiccion',
  dep: 'departamento',
  loc: 'localidad-censal',
  gl: 'gobierno-local',
  aglo: 'aglomerado',
}

export const NOTE_BY_LAYER = {
  departamentos: 'departamento',
  fracciones: 'fraccion-censal',
  radios: 'radio-censal',
  localidades: 'localidad-censal',
  vias: 'via-de-circulacion',
}

export const noteFor = (slug) => NOTES.find((n) => n.slug === slug)

/** El ancla de una nota en su página. La ficha enlaza acá (NOTA-R3). */
export const noteHref = (slug) => `${import.meta.env.BASE_URL}notas/#${slug}`
```

Los `paragraphs` de `localidad-censal` y `via-de-circulacion` se copian **literalmente** del `src/notes.js` actual (los tres y los dos párrafos respectivamente). No reescribirlos, no reacomodarlos, no corregirles nada.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/notes.test.js`
Expected: PASS. Si falla el test de números, el error dice qué nota y por qué camino.

- [ ] **Step 5: Verify the test kills the mutation**

Cambiar a mano `total: 66515` por `total: 66516` en la nota de radios y correr el test. Debe fallar con "total de radio-censal por capa". Volver atrás.

- [ ] **Step 6: Report the editorial claims**

En el reporte de esta tarea, listar **oración por oración** lo que se afirmó y no se puede verificar contra `public/catalog.json`, `src/download.js` ni las mediciones de NAV-R7/DES-R1. Ejemplo del formato esperado: `departamento, párrafo 2: "es el nivel más cómodo para bajar la cadena censal completa" — juicio, no dato`. Las dos notas mudadas no entran en la lista.

- [ ] **Step 7: Commit**

```bash
git add src/notes.js src/notes.test.js src/main.js src/main.test.js index.html
git commit -m "feat: una nota por objeto del Marco, y la ficha deja de repetirlas"
```

---

### Task 4: el mapa deja de acreditar a Leaflet y `showFeature` devuelve la fila

**Files:**
- Modify: `src/map.js:20-26` (`initMap`), `src/map.js:120-130` (`showFeature`)
- Modify: `src/map.test.js`

**Interfaces:**
- Produces: `showFeature(layerName, field, code) => Promise<object|undefined>` — las propiedades del feature, o `undefined` si el pedido perdió la carrera. Antes devolvía `Promise<void>`.

**Por qué `undefined` importa:** es la señal de "este pedido ya no manda". Task 8 la usa para no pisar la ficha con una respuesta de vías de 12 segundos que llegó tarde. No inventar un valor de relleno.

- [ ] **Step 1: Write the failing test**

Agregar a `src/map.test.js`. El mock de Leaflet del archivo necesita `attributionControl`; agregarle al objeto que devuelve `map()`:

```js
    attributionControl: { setPrefix: vi.fn() },
```

Y los casos:

```js
it('no acredita a Leaflet: ni el enlace ni la bandera que viaja en ese prefijo', () => {
  initMap('map')
  expect(mapaFalso.attributionControl.setPrefix).toHaveBeenCalledWith(false)
})

it('la atribución del IGN queda: es la del basemap, no la de la librería', () => {
  initMap('map')
  expect(opcionesDelTileLayer.attribution).toBe('Instituto Geográfico Nacional, OpenStreetMap')
})

it('showFeature devuelve las propiedades de la fila dibujada', async () => {
  // fetch devuelve un feature con propiedades conocidas
  const props = await showFeature('geonode:radios_censales2', 'cod_indec', '068400101')
  expect(props).toMatchObject({ cod_indec: '068400101' })
})

it('showFeature no devuelve nada cuando su pedido perdió la carrera', async () => {
  // Dos showFeature encadenados: el primero resuelve después del segundo.
  const primero = showFeature('geonode:vias_de_circulacion', 'cod_indec', '068400101')
  const segundo = showFeature('geonode:radios_censales2', 'cod_indec', '068400202')
  await segundo
  expect(await primero).toBeUndefined()
})
```

Adaptar los nombres (`mapaFalso`, `opcionesDelTileLayer`) a como el archivo ya tenga armado su mock — `src/map.test.js` ya mockea Leaflet, reusar esa estructura en vez de montar otra.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/map.test.js`
Expected: FAIL — `setPrefix` nunca se llamó, y `showFeature` devuelve `undefined` siempre (incluso en el caso que gana).

- [ ] **Step 3: Write the implementation**

En `initMap`, después de `map.fitBounds(ARGENTINA)`:

```js
  // El prefijo por defecto del control de atribución es el enlace a Leaflet,
  // y desde 1.9 se lleva adentro una bandera de Ucrania (leaflet-src.js:5762).
  // Se saca entero: la licencia BSD-2-Clause de Leaflet no pide crédito en la
  // interfaz, sólo el aviso de copyright en el código, que sigue donde estaba.
  // La atribución del IGN no se toca: esa sí es del dato que se está viendo.
  map.attributionControl.setPrefix(false)
```

En `showFeature`, devolver lo que ya devuelve `drawFromUrl`:

```js
export async function showFeature(layerName, field, code) {
  if (!map) return undefined
  // Devuelve las propiedades para que la ficha pueda describir la fila que
  // se está viendo (NAV-R10). `undefined` significa "este pedido perdió la
  // carrera": quien llama no tiene que escribir nada.
  return drawFromUrl(beginRequest(), featureQueryUrl(layerName, field, code))
}
```

Borrar el párrafo del comentario de `showFeature` que dice que a propósito no avisa al callback de `onFeature` y explica el bug de `#detail-meta`; reemplazarlo por el de arriba. `onFeature` sigue siendo sólo del objeto de la búsqueda: eso no cambia.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS. `src/main.test.js` también tiene un mock de Leaflet (línea ~9) y necesita el mismo `attributionControl`; si tira `Cannot read properties of undefined (reading 'setPrefix')`, agregárselo.

- [ ] **Step 5: Commit**

```bash
git add src/map.js src/map.test.js src/main.test.js
git commit -m "fix: el mapa acredita al IGN y no a Leaflet, y showFeature devuelve la fila"
```

---
### Task 5: el shell inyectado en build, Vite multi-page, y la página de notas

**Files:**
- Create: `scripts/shell.mjs`, `scripts/shell.test.mjs`
- Create: `src/shell/header.html`, `src/shell/cta.html`, `src/shell/footer.html`
- Create: `notas/index.html`, `src/pages/notas.js`, `src/pages/notas.test.js`
- Modify: `vite.config.js`, `index.html`, `src/main.test.js`, `src/style.css`

**Interfaces:**
- Produces:
  - `injectShell(html, {partials, base}) => string` — reemplaza `<!--#shell:nombre-->` y todo `{{base}}`.
  - `leerPartials(dir?) => Record<string,string>` — lee `src/shell/*.html`. La usan el plugin y los tests.
  - `shellPlugin() => Plugin` — el plugin de Vite.

**Por qué `{{base}}`:** los enlaces del nav apuntan a `/indec-descargas/notas/` en producción y a `/notas/` en `npm run dev`. Vite reescribe rutas de assets, no de `href` arbitrarios, así que la sustitución la hace el mismo plugin con el `base` ya resuelto.

**Al final de esta tarea el sitio sigue funcionando igual que antes**, con dos diferencias visibles: tiene nav, CTA y footer institucional en todas partes, y existe `/notas/`.

- [ ] **Step 1: Write the failing test for the pure function**

```js
// scripts/shell.test.mjs
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectShell, leerPartials } from './shell.mjs'

const partials = { header: '<nav>H</nav>', cta: '<aside>C</aside>', footer: '<footer>F</footer>' }
const opts = { partials, base: '/indec-descargas/' }

describe('injectShell', () => {
  it('reemplaza cada marcador por su partial', () => {
    expect(injectShell('<body><!--#shell:header-->x<!--#shell:footer--></body>', opts))
      .toBe('<body><nav>H</nav>x<footer>F</footer></body>')
  })

  it('reemplaza el mismo marcador más de una vez', () => {
    expect(injectShell('<!--#shell:cta--><!--#shell:cta-->', opts)).toBe('<aside>C</aside><aside>C</aside>')
  })

  it('tira ante un marcador sin partial: un typo no puede quedar en silencio', () => {
    expect(() => injectShell('<!--#shell:fotter-->', opts)).toThrow(/fotter/)
  })

  it('resuelve {{base}} en la página y también adentro del partial', () => {
    const conBase = { partials: { header: '<a href="{{base}}notas/">n</a>' }, base: '/indec-descargas/' }
    expect(injectShell('<!--#shell:header--><img src="{{base}}x.png">', conBase))
      .toBe('<a href="/indec-descargas/notas/">n</a><img src="/indec-descargas/x.png">')
  })

  it('deja intacto un HTML sin marcadores', () => {
    expect(injectShell('<p>hola</p>', opts)).toBe('<p>hola</p>')
  })
})

describe('leerPartials', () => {
  it('trae los tres partials del shell', () => {
    expect(Object.keys(leerPartials()).sort()).toEqual(['cta', 'footer', 'header'])
  })
})

describe('las páginas del sitio', () => {
  const paginas = ['index.html', 'notas/index.html']

  it('todas traen header, CTA y footer, y todas resuelven', () => {
    for (const p of paginas) {
      const html = readFileSync(resolve(process.cwd(), p), 'utf8')
      for (const m of ['header', 'cta', 'footer']) {
        expect(html, `${p} no trae el marcador ${m}`).toContain(`<!--#shell:${m}-->`)
      }
      expect(() => injectShell(html, { partials: leerPartials(), base: '/' })).not.toThrow()
    }
  })

  it('el CTA apunta al Geoportal INDEC y abre en otra pestaña (SITIO-R5)', () => {
    const cta = leerPartials().cta
    expect(cta).toContain('https://geonode.indec.gob.ar/')
    expect(cta).toContain('target="_blank"')
    expect(cta).toContain('rel="noopener"')
    expect(cta).toContain('Más info, más mapas, más capas en Geoportal INDEC')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/shell.test.mjs`
Expected: FAIL — no se resuelve `./shell.mjs`.

- [ ] **Step 3: Write `scripts/shell.mjs`**

```js
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const SHELL_DIR = fileURLToPath(new URL('../src/shell/', import.meta.url))
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
```

- [ ] **Step 4: Write the three partials**

`src/shell/header.html`:

```html
<header class="site-header">
  <a class="brand" href="{{base}}">Descargas del Marco Geoestadístico</a>
  <nav class="site-nav">
    <a data-nav="home" href="{{base}}">Inicio</a>
    <a data-nav="notas" href="{{base}}notas/">Notas</a>
    <a data-nav="servicios" href="{{base}}servicios/">Servicios del INDEC</a>
  </nav>
</header>
```

`src/shell/cta.html`:

```html
<aside class="cta">
  <a href="https://geonode.indec.gob.ar/" target="_blank" rel="noopener">Más info, más mapas, más capas en Geoportal INDEC</a>
</aside>
```

`src/shell/footer.html` — los datos institucionales verificados, más las dos frases que ya estaban en el footer actual, textuales:

```html
<footer class="site-footer">
  <p class="org">
    <strong>INDEC</strong> — Instituto Nacional de Estadística y Censos de la República Argentina<br />
    Av. Presidente Julio A. Roca 609, P.B. — C1067ABB, Ciudad Autónoma de Buenos Aires, Argentina<br />
    Consultas: (54-11) 5031-4632
  </p>
  <p>
    <a href="https://www.indec.gob.ar/">indec.gob.ar</a> ·
    <a href="https://geonode.indec.gob.ar/">Geoportal INDEC</a> ·
    material del INDEC bajo
    <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es">Creative Commons BY-SA 4.0</a>,
    salvo contenidos específicamente indicados.
  </p>
  <p>
    Las descargas van del servidor del INDEC a tu computadora: este sitio sólo arma el enlace.
  </p>
  <p class="warning">
    Estos límites son para integración de información estadística. No son fuente oficial de
    delimitación territorial ni sirven como prueba en controversias de límites.
  </p>
  <p id="generated" class="meta"></p>
</footer>
```

`#generated` se conserva porque `main.js` lo escribe hoy y `pages/home.js` lo va a escribir después.

- [ ] **Step 5: Wire Vite and convert `index.html`**

`vite.config.js`:

```js
import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { shellPlugin } from './scripts/shell.mjs'

export default defineConfig({
  base: '/indec-descargas/',
  plugins: [shellPlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        notas: resolve(import.meta.dirname, 'notas/index.html'),
      },
    },
  },
})
```

En `index.html`: reemplazar el `<header class="site-header">…</header>` actual por `<!--#shell:header-->`, y el `<footer class="site-footer">…</footer>` por `<!--#shell:cta-->` seguido de `<!--#shell:footer-->`. Agregar `data-pagina="home"` al `<body>`. El `<main>` no se toca todavía: sigue siendo la app de una sola página hasta la Task 7.

- [ ] **Step 6: Fix `src/main.test.js`**

Ese test monta el `<body>` de `index.html` en jsdom y ahora encontraría marcadores en vez del footer, así que `#generated` no existiría y `main.js` tiraría. Hacer que resuelva el shell antes de montar:

```js
import { injectShell, leerPartials } from '../scripts/shell.mjs'

const crudo = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
const html = injectShell(crudo, { partials: leerPartials(), base: '/' })
const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '')
```

Ojo con el `match`: el `<body>` ahora tiene atributo `data-pagina`, así que el regex actual `/<body>/` deja de matchear. Es el cambio de arriba.

- [ ] **Step 7: Write the notas page test**

```js
// src/pages/notas.test.js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectShell, leerPartials } from '../../scripts/shell.mjs'
import { NOTES } from '../notes.js'

const crudo = readFileSync(resolve(process.cwd(), 'notas/index.html'), 'utf8')
const html = injectShell(crudo, { partials: leerPartials(), base: '/' })
const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '')

async function montar(hash = '') {
  window.location.hash = hash
  document.body.innerHTML = body
  document.body.dataset.pagina = 'notas'
  const { initNotas } = await import('./notas.js')
  initNotas()
}

describe('la página de notas', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('lista los ocho objetos en el navegador vertical', async () => {
    await montar()
    const items = document.querySelectorAll('#nota-nav [role="tab"]')
    expect(items).toHaveLength(8)
    expect([...items].map((b) => b.textContent.trim())).toEqual(NOTES.map((n) => n.label))
  })

  it('sin ancla abre la primera', async () => {
    await montar()
    expect(document.querySelector('#nota-titulo').textContent).toBe(NOTES[0].label)
  })

  it('el ancla de la URL elige la nota', async () => {
    await montar('#gobierno-local')
    expect(document.querySelector('#nota-titulo').textContent).toBe('Gobierno local')
    expect(document.querySelector('#nota-cuerpo').textContent).toContain('2.282')
  })

  it('un ancla que no existe cae en la primera en vez de dejar la página vacía', async () => {
    await montar('#no-existe')
    expect(document.querySelector('#nota-titulo').textContent).toBe(NOTES[0].label)
  })

  it('elegir una nota escribe el ancla, para poder compartirla', async () => {
    await montar()
    document.querySelector('[data-slug="aglomerado"]').click()
    expect(window.location.hash).toBe('#aglomerado')
    expect(document.querySelector('#nota-titulo').textContent).toBe('Aglomerado')
  })

  it('muestra el total del objeto, que es dato y no prosa', async () => {
    await montar('#radio-censal')
    expect(document.querySelector('#nota-total').textContent).toContain('66.515')
  })
})
```

- [ ] **Step 8: Write `notas/index.html` and `src/pages/notas.js`**

`notas/index.html`: `<html lang="es">`, `<title>Notas sobre los objetos del Marco Geoestadístico — INDEC</title>`, `<meta name="description">`, `<link rel="stylesheet" href="/src/style.css">` (Vite resuelve la ruta), `<body data-pagina="notas">` con:

```html
<!--#shell:header-->
<main class="notas">
  <h1>Qué es cada objeto del Marco Geoestadístico</h1>
  <div class="notas-layout">
    <nav id="nota-nav" class="nota-nav" role="tablist" aria-label="Objetos"></nav>
    <article class="nota-panel">
      <h2 id="nota-titulo"></h2>
      <p id="nota-total" class="meta"></p>
      <div id="nota-cuerpo" class="nota-body"></div>
    </article>
  </div>
</main>
<!--#shell:cta-->
<!--#shell:footer-->
<script type="module" src="/src/pages/notas.js"></script>
```

`src/pages/notas.js` exporta `initNotas()` y la llama al cargar. Dibuja un botón por nota en `#nota-nav` (`role="tab"`, `aria-selected`, `data-slug`), y al elegir escribe `location.hash` y pinta título, total (`fmt(nota.total)` de `ui.js`) y párrafos. Lee `location.hash` al iniciar y escucha `hashchange`, para que atrás y adelante funcionen dentro de la página. Un slug desconocido cae en `NOTES[0]`.

Estilos en `src/style.css`: `.notas-layout` es `display: grid; grid-template-columns: 14rem minmax(0, 1fr); gap: 2rem;` y colapsa a una columna abajo de `48rem`, como ya hace `.row-bulk`. La nav vertical reusa los tokens que ya existen (`--line`, `--hl`, `--muted`).

- [ ] **Step 9: Run everything**

Run: `npm test` — todo verde.
Run: `npm run build` — construye `dist/index.html` y `dist/notas/index.html`, los dos con el footer resuelto.
Verificar: `grep -c "Roca 609" dist/notas/index.html` devuelve 1, y `grep -c "shell:" dist/notas/index.html` devuelve 0.

- [ ] **Step 10: Commit**

```bash
git add scripts/shell.mjs scripts/shell.test.mjs src/shell/ notas/ src/pages/notas.js src/pages/notas.test.js vite.config.js index.html src/main.test.js src/style.css
git commit -m "feat: shell compartido inyectado en build y la página de notas"
```

---

### Task 6: la página de servicios del INDEC

**Files:**
- Create: `servicios/index.html`, `src/pages/servicios.test.js`
- Modify: `vite.config.js` (tercera entrada), `src/style.css`

**Interfaces:**
- Consumes: `GEOSERVER` de `src/download.js`, `injectShell`/`leerPartials` en el test.
- Produces: nada que otra tarea use. Es una página de contenido.

**Todo el contenido está verificado el 2026-09-08 contra el servidor y está en la §5 del spec. No agregar un dato que no esté ahí.**

- [ ] **Step 1: Write the failing test**

```js
// src/pages/servicios.test.js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectShell, leerPartials } from '../../scripts/shell.mjs'
import { GEOSERVER } from '../download.js'

const crudo = readFileSync(resolve(process.cwd(), 'servicios/index.html'), 'utf8')
const html = injectShell(crudo, { partials: leerPartials(), base: '/' })

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/servicios.test.js`
Expected: FAIL — `ENOENT servicios/index.html`.

- [ ] **Step 3: Write the page**

`servicios/index.html`, `<body data-pagina="servicios">`, con `<!--#shell:header-->`, el contenido, `<!--#shell:cta-->` y `<!--#shell:footer-->`. Cuatro secciones, con este contenido y nada más:

1. **WFS 2.0.0** — endpoint `https://geonode.indec.gob.ar/geoserver/ows`, CORS abierto (es de lo que depende este sitio). Las 10 capas con prefijo `geonode:`, marcando cuáles usa este sitio (8) y cuáles no (las dos versiones "puntos"). Formatos: `geopackage` (alias `gpkg`, `geopkg`, `application/x-gpkg`), `application/json` (GeoJSON), `SHAPE-ZIP`, `csv`, `excel`, `excel2007`, KML, GML 2 / 3.1.1 / 3.2.
2. **WMS 1.3.0** — mismo endpoint, mismas 10 capas. `image/png` en `GetMap`, más `application/pdf`, KML/KMZ, GeoJSON, TopoJSON y `application/vnd.mapbox-vector-tile`. CRS: EPSG:4326, EPSG:3857, CRS:84.
3. **GeoNode / Geoportal INDEC** — `https://geonode.indec.gob.ar/`, 47 capas publicadas contra las 8 que usa este sitio, más mapas, documentos y metadatos; OpenSearch en `/catalogue/opensearch`.
4. **Dos recetas** — conectar el WFS en QGIS (Capa → Añadir capa → WFS, pegar el endpoint), y pedir una capa desde código, con una URL real de ejemplo que use `CQL_FILTER` (la misma forma que arma `src/download.js`).

**Esta página no lleva JS.** Es contenido estático: no se crea `src/pages/servicios.js` ni se le pone `<script>`. Una entry vacía es peor que ninguna, y el shell ya llega resuelto desde el build.

Agregar la entrada `servicios` a `rollupOptions.input`.

- [ ] **Step 4: Run tests**

Agregar `'servicios/index.html'` al array `paginas` de `scripts/shell.test.mjs`: ese test es el que garantiza que ninguna página se quede sin CTA ni footer, y sólo sirve si las lista a todas.

Run: `npm test` y `npm run build`
Expected: PASS; `dist/servicios/index.html` existe con el shell resuelto.

- [ ] **Step 5: Commit**

```bash
git add servicios/ src/pages/servicios.test.js vite.config.js src/style.css
git commit -m "feat: la página de servicios geoespaciales del INDEC"
```

---
### Task 7: `src/buscador.js` — el buscador deja de vivir en `main.js`

**Files:**
- Create: `src/buscador.js`, `src/buscador.test.js`
- Modify: `src/main.js` (lo usa; el comportamiento no cambia)

**Interfaces:**
- Consumes: `search`, `TYPE_ORDER` de `src/search.js`; `TYPES` de `src/download.js`; `createCombobox` de `src/combobox.js`.
- Produces: `createBuscador({input, select, list, onElegir}) => {setObjetos(objetos)}`

**Por qué ahora:** el home y `/resultados/` tienen los dos un buscador y hacen con él cosas distintas (uno navega, el otro también). Extraerlo antes del split evita escribirlo dos veces y deja el paso siguiente más chico. Esta tarea **no cambia ningún comportamiento**: `src/main.test.js` tiene que pasar sin tocarlo.

- [ ] **Step 1: Write the failing test**

```js
// src/buscador.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBuscador } from './buscador.js'
import { TYPE_ORDER } from './search.js'

const objetos = [
  { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires', sp: 'buenos aires' },
  { t: 'loc', c: '06840010', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires', sp: 'buenos aires' },
]

let el, onElegir, buscador

beforeEach(() => {
  document.body.innerHTML = `
    <select id="type"></select>
    <input id="q" role="combobox" aria-expanded="false" />
    <ul id="results" role="listbox" hidden></ul>`
  el = {
    input: document.querySelector('#q'),
    select: document.querySelector('#type'),
    list: document.querySelector('#results'),
  }
  onElegir = vi.fn()
  buscador = createBuscador({ ...el, onElegir })
})

const escribir = (texto) => {
  el.input.value = texto
  el.input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('createBuscador', () => {
  it('llena el filtro desde TYPE_ORDER, con "todos" adelante (BUS-R1)', () => {
    const opciones = [...el.select.options]
    expect(opciones[0].value).toBe('')
    expect(opciones.slice(1).map((o) => o.value)).toEqual(TYPE_ORDER)
  })

  it('no busca hasta tener objetos: el catálogo llega después', () => {
    escribir('tres')
    expect(el.list.children).toHaveLength(0)
  })

  it('busca una vez que tiene el catálogo', () => {
    buscador.setObjetos(objetos)
    escribir('tres de febrero')
    expect(el.list.children).toHaveLength(2)
  })

  it('cada resultado dice de qué tipo es: es lo que decide qué límites bajás', () => {
    buscador.setObjetos(objetos)
    escribir('tres')
    expect(el.list.textContent).toContain('Departamento')
    expect(el.list.textContent).toContain('Localidad censal')
  })

  it('cambiar el tipo vuelve a buscar lo escrito, sin retipear (BUS-R1)', () => {
    buscador.setObjetos(objetos)
    escribir('tres')
    el.select.value = 'loc'
    el.select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(el.list.children).toHaveLength(1)
  })

  it('elegir avisa con el objeto', () => {
    buscador.setObjetos(objetos)
    escribir('tres')
    el.list.children[0].click()
    expect(onElegir).toHaveBeenCalledWith(objetos[0])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/buscador.test.js`
Expected: FAIL — no se resuelve `./buscador.js`.

- [ ] **Step 3: Write `src/buscador.js`**

Mover, sin reescribir, estas piezas de `src/main.js`: `renderOption`, `typeOption`, el `el.type.append(...)`, `runSearch` y los dos `addEventListener` de `input`/`change`. La única diferencia es que el catálogo llega por `setObjetos` en vez de por una variable de módulo, y que elegir llama a `onElegir` en vez de a `selectObject`.

```js
import { search, TYPE_ORDER } from './search.js'
import { TYPES } from './download.js'
import { createCombobox } from './combobox.js'

/** Cada resultado muestra el nombre y, al lado, de qué tipo es. */
function renderOption(obj) { /* … igual que en main.js … */ }

/**
 * Las opciones del filtro salen de TYPE_ORDER y TYPES, no del HTML: el
 * orden y las etiquetas quedan en un solo lugar. El valor vacío es
 * "todos", que es donde arranca (BUS-R1).
 */
function typeOption(value, label) { /* … igual que en main.js … */ }

/**
 * El buscador, sin saber qué se hace con lo que se elige. El home navega y
 * /resultados/ también, pero eso lo decide cada página: acá sólo se busca.
 *
 * El catálogo llega por `setObjetos` porque pesa 673 KB y el home no lo
 * pide hasta que alguien toca el campo.
 */
export function createBuscador({ input, select, list, onElegir }) {
  let objetos = null

  select.append(
    typeOption('', 'Todos los tipos'),
    ...TYPE_ORDER.map((t) => typeOption(t, TYPES[t].plural)),
  )

  const combo = createCombobox({ input, list, renderOption, onSelect: onElegir })

  function correr() {
    if (!objetos) return
    combo.render(search(objetos, input.value, { type: select.value }))
  }

  input.addEventListener('input', correr)
  // El `change` también busca: cambiar de tipo tiene que acotar lo que ya
  // está escrito, sin obligar a volver a tipear.
  select.addEventListener('change', correr)

  return {
    setObjetos(next) {
      objetos = next
      correr()
    },
  }
}
```

- [ ] **Step 4: Rewire `src/main.js`**

Reemplazar en `main.js` las piezas movidas por:

```js
const buscador = createBuscador({
  input: el.q, select: el.type, list: el.results, onElegir: selectObject,
})
```

y en el `.then` de `loadCatalog`, `buscador.setObjetos(c.objects)`.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS, **sin tocar `src/main.test.js`**. Si hace falta tocarlo, algo del comportamiento cambió: revisar en vez de adaptar el test.

- [ ] **Step 6: Commit**

```bash
git add src/buscador.js src/buscador.test.js src/main.js
git commit -m "refactor: el buscador es un módulo, porque ahora lo usan dos páginas"
```

---

### Task 8: el sitio se parte en dos — home y `/resultados/`

**Files:**
- Create: `resultados/index.html`, `src/pages/resultados.js`, `src/pages/resultados.test.js`
- Create: `src/pages/home.js`, `src/pages/home.test.js`
- Modify: `index.html` (pasa a ser el home), `vite.config.js`, `src/browser.js`, `src/browser.test.js`, `src/style.css`
- Delete: `src/main.js`, `src/main.test.js`

**Interfaces:**
- Consumes: `parse`/`format` (Task 1), `loadTotales` (Task 2), `createBuscador` (Task 7).
- Produces:
  - `initHome({navegar}) => void` y `initResultados({navegar}) => void`. `navegar` por defecto es `(href) => window.location.assign(href)`; se inyecta para poder testear sin que jsdom se queje de navegar.
  - `createBrowser` cambia su firma: `show(obj, capaInicial = null)` y acepta `onTab(key)` entre sus opciones. Sigue devolviendo `{show}` más `boolean` desde `show`.

**El estado es la URL.** Elegir un objeto **navega**, incluso estando ya en `/resultados/`: `navegar(format(obj))`. No hay `pushState` ni `popstate`. Lo único que escribe la barra sin navegar es cambiar de pestaña, con `history.replaceState`.

- [ ] **Step 1: Extend `src/browser.js` and its test**

Primero lo que `/resultados/` necesita del browser. Test nuevo en `src/browser.test.js`:

```js
it('abre la capa que se le pide en vez de la primera', () => {
  const browser = crearBrowserDePrueba()          // helper que el archivo ya tiene
  browser.show(objetoConVariasCapas, 'radios')
  expect(pestañaActiva()).toBe('Radios censales')
})

it('una capa que el objeto no tiene cae en la primera, no en una pestaña vacía', () => {
  const browser = crearBrowserDePrueba()
  browser.show(objetoConVariasCapas, 'departamentos')
  expect(pestañaActiva()).toBe('Fracciones censales')
})

it('avisa qué pestaña quedó activa, para que la URL la pueda guardar', () => {
  const onTab = vi.fn()
  const browser = crearBrowserDePrueba({ onTab })
  browser.show(objetoConVariasCapas, 'radios')
  expect(onTab).toHaveBeenCalledWith('radios')
})
```

Implementación en `browser.js`: `createBrowser({container, onView, onError, onTab = () => {}})`; `show(next, capaInicial = null)` pasa a `createTabs` la lista de pestañas y después llama a `select(capaInicial)` **sólo si `capaInicial` está entre las capas no vacías del objeto**; el `onSelect` de `createTabs` llama a `onTab(key)` además de lo que ya hace.

Ojo: `createTabs` ya selecciona la primera al construirse y corta el reclic sobre la activa, así que pedir la primera explícitamente no dispara nada de más.

- [ ] **Step 2: Write the resultados test**

`src/pages/resultados.test.js` nace de `src/main.test.js`: **copiar el archivo entero** y adaptarlo — lee `resultados/index.html` en vez de `index.html`, resuelve el shell (Task 5, Step 6), importa `./resultados.js` y llama a `initResultados({ navegar })` con un spy. Todos los casos que ya cubría se conservan. Se agregan:

```js
describe('la URL es el estado', () => {
  it('sin parámetros muestra el buscador y no dibuja ficha', async () => {
    await montar('')
    expect(document.querySelector('#detail').hidden).toBe(true)
    expect(document.querySelector('#status').textContent).toMatch(/Buscá un objeto/)
  })

  it('con t y c válidos abre la ficha de ese objeto', async () => {
    await montar('?t=dep&c=06840')
    expect(document.querySelector('#detail-name').textContent).toBe('Tres de Febrero')
  })

  it('un tipo desconocido muestra el error y el buscador, no una ficha rota', async () => {
    await montar('?t=xx&c=06840')
    expect(document.querySelector('#detail').hidden).toBe(true)
    expect(document.querySelector('#status').classList.contains('error')).toBe(true)
  })

  it('un código que no está en el catálogo también', async () => {
    await montar('?t=dep&c=99999')
    expect(document.querySelector('#detail').hidden).toBe(true)
    expect(document.querySelector('#status').textContent).toMatch(/99999/)
  })

  it('abre la capa que pide la URL', async () => {
    await montar('?t=dep&c=06840&capa=radios')
    expect(document.querySelector('[role="tab"][aria-selected="true"]').textContent)
      .toContain('Radios censales')
  })

  it('capa=vias abre el panel de costo y no pide nada (NAV-R7, SITIO-R3)', async () => {
    await montar('?t=dep&c=06840&capa=vias')
    expect(document.querySelector('#browse').textContent).toContain('no tiene un índice útil')
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('vias_de_circulacion'))
  })

  it('cambiar de pestaña reescribe la URL sin navegar', async () => {
    await montar('?t=dep&c=06840')
    document.querySelectorAll('[role="tab"]')[1].click()
    expect(window.location.search).toContain('capa=')
    expect(navegar).not.toHaveBeenCalled()
  })

  it('elegir otro objeto en el buscador navega al permalink', async () => {
    await montar('?t=dep&c=06840')
    buscar('buenos aires')
    document.querySelector('#results').children[0].click()
    expect(navegar).toHaveBeenCalledWith(expect.stringMatching(/resultados\/\?t=jur&c=06$/))
  })

  it('copiar enlace copia la URL de la barra', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await montar('?t=dep&c=06840')
    document.querySelector('#copiar-enlace').click()
    expect(writeText).toHaveBeenCalledWith(window.location.href)
  })
})
```

Para `montar(search)`: en jsdom la URL se cambia con `window.history.replaceState({}, '', '/resultados/' + search)` antes de importar la página.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/pages/resultados.test.js`
Expected: FAIL — `ENOENT resultados/index.html`.

- [ ] **Step 4: Create `/resultados/`**

`resultados/index.html`: el `<main>` que hoy tiene `index.html` (el bloque `#row-notes` ya no está: se fue en la Task 3), con un agregado — al lado de `#detail-name` va `<button id="copiar-enlace" type="button" class="btn ghost mini">Copiar enlace</button>`. Header, CTA y footer por marcadores. `<body data-pagina="resultados">`. `<title>` propio.

`src/pages/resultados.js` es `src/main.js` movido, con estos cambios:

```js
export function initResultados({ navegar = (href) => window.location.assign(href) } = {}) {
  // … todo lo que hoy hace main.js al cargar …

  const buscador = createBuscador({
    input: el.q, select: el.type, list: el.results,
    // El estado es la URL: elegir un objeto navega, también estando ya acá.
    // Es lo que hace que atrás y adelante funcionen sin una línea de historia.
    onElegir: (obj) => navegar(format(obj)),
  })

  const url = parse(window.location.search)

  loadCatalog().then((c) => {
    catalog = c
    index = codeIndex(c.objects)
    buscador.setObjetos(c.objects)
    el.generated.textContent = `Catálogo generado el ${c.generated} · ${fmt(c.objects.length)} objetos.`

    if (url.status === 'empty') return setStatus('Buscá un objeto para verlo en el mapa.')
    if (url.status === 'invalid') return setStatus(`Ese enlace no se puede abrir: ${url.reason}`, true)

    const obj = c.objects.find((o) => o.t === url.t && o.c === url.c)
    if (!obj) return setStatus(`No hay ningún objeto con el código ${url.c} en el catálogo.`, true)

    initMap('map')          // recién acá: sin objeto no hay nada que dibujar
    selectObject(obj, url.capa)
    el.q.focus()
  })
}

initResultados()
```

`selectObject(obj, capaInicial)` pasa `capaInicial` a `browser.show(obj, capaInicial)`. El `onTab` del browser hace:

```js
  onTab: (capa) => {
    // Cambiar de pestaña reescribe la barra sin navegar: la URL sigue
    // describiendo lo que se ve, y atrás no se convierte en un paseo por
    // todas las pestañas que se tocaron.
    window.history.replaceState({}, '', format(obj, capa))
  },
```

El botón `#copiar-enlace` hace `navigator.clipboard.writeText(window.location.href)` y cambia su texto a "Copiado" por un momento. Si `navigator.clipboard` no existe, el botón no se muestra.

`initMap('map')` deja de correr al cargar el módulo y pasa a correr sólo cuando hay objeto (hoy está suelto en `main.js`).

- [ ] **Step 5: Turn `index.html` into the home**

`index.html`, `<body data-pagina="home">`:

```html
<!--#shell:header-->
<main class="home">
  <section class="hero">
    <h1>La cartografía del INDEC más fácil de descargar y usarla en tus proyectos</h1>
    <p class="subtitle">Buscá una provincia, departamento, localidad, municipio o aglomerado y descargalo en GeoPackage. Sin saber WFS, sin cuenta, sin instalar nada.</p>
    <div class="search">
      <div class="search-row">
        <select id="type" aria-label="Tipo de objeto"></select>
        <input id="q" type="search" autocomplete="off"
               placeholder="Escribí un nombre. Por ejemplo: Tres de Febrero"
               aria-label="Buscar un objeto geográfico" role="combobox"
               aria-autocomplete="list" aria-controls="results" aria-expanded="false" />
      </div>
      <ul id="results" class="results" role="listbox" hidden></ul>
    </div>
    <p id="status" class="status"></p>
  </section>

  <section class="totales">
    <h2>Qué hay adentro</h2>
    <ul id="totales" class="totales-grid"></ul>
  </section>
</main>
<!--#shell:cta-->
<!--#shell:footer-->
<script type="module" src="/src/pages/home.js"></script>
```

`src/pages/home.js`:

```js
export function initHome({ navegar = (href) => window.location.assign(href) } = {}) {
  const buscador = createBuscador({
    input: el.q, select: el.type, list: el.results,
    onElegir: (obj) => navegar(format(obj)),
  })

  // Los totales primero: son 300 bytes y son lo que el home tiene para
  // mostrar. El catálogo son 673 KB y no hace falta hasta que alguien
  // toque el campo.
  loadTotales().then(pintarTotales).catch(() => { /* el buscador sigue sirviendo */ })

  let pedido = null
  const traerCatalogo = () => {
    pedido ??= loadCatalog()
      .then((c) => buscador.setObjetos(c.objects))
      .catch((err) => setStatus(`No se pudo cargar el catálogo: ${err.message}`, true))
  }
  el.q.addEventListener('focus', traerCatalogo, { once: true })
  el.q.addEventListener('input', traerCatalogo, { once: true })
}
```

`pintarTotales` dibuja ocho `<li>` con un SVG inline, el número con `fmt()` y la etiqueta, en este orden y con estas claves: `jur` Jurisdicciones, `dep` Departamentos, `fracciones` Fracciones censales, `radios` Radios censales, `loc` Localidades censales, `gl` Gobiernos locales, `aglo` Aglomerados, `vias` Vías de circulación. Los iconos son SVG inline de trazo simple (`stroke="currentColor"`, `fill="none"`), uno por objeto; **no agregar una librería de iconos**.

`src/pages/home.test.js`: que los ocho tiles se pinten con los números de `totales.json` mockeado; que el catálogo **no** se pida hasta tocar el campo; que elegir llame a `navegar` con el permalink correcto.

- [ ] **Step 6: Delete `main.js`, add the entries, run everything**

```bash
git rm src/main.js src/main.test.js
```

Agregar `resultados` a `rollupOptions.input`, y `'resultados/index.html'` al array `paginas` de `scripts/shell.test.mjs`, que ahora tiene que listar las cuatro.

Run: `npm test` — todo verde.
Run: `npm run build` — cuatro páginas en `dist/`.
Run: `npm run preview` y abrir a mano: `/indec-descargas/`, elegir Tres de Febrero, ver que la barra queda en `/indec-descargas/resultados/?t=dep&c=06840`, cambiar de pestaña y ver aparecer `&capa=`, apretar atrás y volver al home.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: el sitio se parte en home y resultados, y la URL pasa a ser el estado"
```

---
### Task 9: la ficha describe lo que el mapa está dibujando (NAV-R10)

**Files:**
- Modify: `src/columns.js` (agregar `titleField`), `src/columns.test.js`
- Modify: `src/pages/resultados.js`, `src/pages/resultados.test.js`
- Modify: `src/browser.js`, `src/browser.test.js` (el enlace a la nota de la pestaña)
- Modify: `src/style.css`

**Interfaces:**
- Consumes: `showFeature` devolviendo propiedades (Task 4); `specOf`, `queryFields` de `columns.js`; `featureUrl`, `childOf`, `isCode` de `download.js`; `noteHref`, `noteFor`, `NOTE_BY_TYPE`, `NOTE_BY_LAYER` de `notes.js`.
- Produces: nada que otra tarea use. Es la última de comportamiento.

**El invariante:** la ficha describe siempre lo que el mapa está dibujando. Hoy el mapa dibuja un radio y la ficha sigue hablando del departamento.

**Lo que NO se hace:** concatenar texto sobre `#detail-meta`. Ese fue el bug que hizo que "Ver" dejara de tocar la ficha (ver el comentario que se borró en Task 4). Acá el panel se **reemplaza** entero y se construye desde `specOf`, no desde una lista de campos escrita a mano.

- [ ] **Step 1: Declare the title field**

En `src/columns.js`, agregar `titleField` a las specs que tienen un nombre publicado, y a ninguna más:

```js
  departamentos: { titleField: 'nam', … },
  localidades:   { titleField: 'nam', … },
  vias:          { titleField: 'fna', … },
```

`fracciones` y `radios` **no lo llevan**: el Marco no publica nombre para ellos y NAV-R4 dice que no se les inventa rótulo. Test en `src/columns.test.js`:

```js
it('sólo declaran título las capas que tienen nombre publicado (NAV-R4)', () => {
  const con = Object.entries(LAYER_SPECS).filter(([, s]) => s.titleField).map(([k]) => k)
  expect(con.sort()).toEqual(['departamentos', 'localidades', 'vias'])
})

it('el campo del título siempre es una columna que se pide al GeoServer', () => {
  for (const [key, spec] of Object.entries(LAYER_SPECS)) {
    if (spec.titleField) expect(queryFields(key)).toContain(spec.titleField)
  }
})
```

- [ ] **Step 2: Write the failing test for the ficha**

En `src/pages/resultados.test.js`:

```js
describe('el "Ver" de una fila hija (NAV-R10)', () => {
  it('la ficha pasa a describir la fila, con los campos de su capa', async () => {
    await montar('?t=dep&c=06840&capa=radios')
    await verPrimeraFila()
    expect(document.querySelector('#detail-name').textContent).toContain('068400101')
    // Los rótulos salen de specOf('radios'), no de una lista aparte.
    expect(document.querySelector('#detail-meta').textContent).toContain('Fracción')
    expect(document.querySelector('#detail-meta').textContent).toContain('Urbano')
  })

  it('no le inventa nombre a un radio (NAV-R4)', async () => {
    await montar('?t=dep&c=06840&capa=radios')
    await verPrimeraFila()
    expect(document.querySelector('#detail-name').textContent).toBe('Radio censal 068400101')
  })

  it('usa el nombre publicado cuando la capa lo tiene', async () => {
    await montar('?t=dep&c=06840&capa=localidades')
    await verPrimeraFila()
    expect(document.querySelector('#detail-name').textContent).toBe('Nombre de prueba')
  })

  it('el botón baja esa fila, no el objeto padre (DES-R9)', async () => {
    await montar('?t=dep&c=06840&capa=radios')
    await verPrimeraFila()
    const href = document.querySelector('#detail-self a').href
    expect(href).toContain('radios_censales2')
    expect(href).toContain('068400101')
  })

  it('una fila sin código no ofrece descarga, y no rompe la ficha (DES-R8)', async () => {
    // fila cuyo idField viene vacío
    await montar('?t=dep&c=06840&capa=radios')
    await verFilaSinCodigo()
    expect(document.querySelector('#detail-self .is-disabled')).not.toBeNull()
  })

  it('"volver" restaura la ficha del objeto y lo redibuja', async () => {
    await montar('?t=dep&c=06840&capa=radios')
    await verPrimeraFila()
    document.querySelector('#volver-al-objeto').click()
    expect(document.querySelector('#detail-name').textContent).toBe('Tres de Febrero')
    expect(document.querySelector('#detail-self a').href).toContain('departamentos')
  })

  it('una respuesta que perdió la carrera no escribe la ficha', async () => {
    // showFeature devuelve undefined cuando su pedido fue superado (Task 4).
    await montar('?t=dep&c=06840&capa=radios')
    const primera = verFila(0)      // lenta
    const segunda = verFila(1)      // rápida, la gana
    await Promise.all([primera, segunda])
    expect(document.querySelector('#detail-name').textContent).toContain(codigoDeFila(1))
  })

  it('la fila vista queda marcada en la tabla', async () => {
    await montar('?t=dep&c=06840&capa=radios')
    await verPrimeraFila()
    expect(document.querySelectorAll('tbody tr[aria-selected="true"]')).toHaveLength(1)
  })
})

describe('los enlaces a las notas (NOTA-R3)', () => {
  it('la ficha enlaza la nota del tipo del objeto', async () => {
    await montar('?t=dep&c=06840')
    expect(document.querySelector('.detail a[href*="/notas/#"]').getAttribute('href'))
      .toContain('#departamento')
  })

  it('cada pestaña enlaza la nota de su capa', async () => {
    await montar('?t=dep&c=06840&capa=radios')
    expect(document.querySelector('#browse a[href*="/notas/#"]').getAttribute('href'))
      .toContain('#radio-censal')
  })

  it('la fila de notas con pestañas ya no existe', async () => {
    await montar('?t=dep&c=06840')
    expect(document.querySelector('#row-notes')).toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/pages/resultados.test.js src/columns.test.js`
Expected: FAIL — la ficha sigue mostrando el departamento después de "Ver".

- [ ] **Step 4: Implement**

En `src/pages/resultados.js`:

```js
/**
 * La ficha de una fila hija. Los campos salen de `specOf`, la misma spec
 * que arma la tabla: ficha y tabla leen lo mismo, así que no pueden decir
 * cosas distintas de la misma fila.
 *
 * Se reemplaza entera, no se le agrega nada a lo que había: es lo que
 * separa esto del bug viejo, donde cada "Ver" le pegaba otro tramo de texto
 * a #detail-meta sin límite.
 */
function mostrarFila(capa, row) {
  const spec = specOf(capa)
  const codigo = String(row[spec.idField] ?? '')

  // El singular sale del `label` de la nota de esa capa, que ya está en
  // singular ("Radio censal"). Derivarlo de CHILD_LAYERS con un replace
  // daría "Radios censale": el plural del INDEC no se deshace con un regex.
  const singular = noteFor(NOTE_BY_LAYER[capa]).label

  el.name.textContent = spec.titleField && row[spec.titleField]
    ? row[spec.titleField]
    : `${singular} ${codigo}`

  el.meta.textContent = spec.columns
    .filter((c) => row[c.field] !== undefined && row[c.field] !== '')
    .map((c) => `${c.label}: ${c.map ? c.map(row[c.field]) : row[c.field]}`)
    .join(' · ')

  // Una fila sin código no es un error de programa: es un dato que el INDEC
  // no publicó (DES-R8). Se dice, y la ficha sigue en pie.
  el.self.replaceChildren(
    isCode(codigo)
      ? downloadButton(featureUrl(capa, codigo), `Descargar ${singular.toLowerCase()}`)
      : disabledButton('Descargar', 'El INDEC no publicó el código de esta fila.'),
    botonVolver(),
  )
}
```

`botonVolver()` es un `<button id="volver-al-objeto" class="btn ghost mini">` que dice `Volver a ${obj.n}` y llama a `selectObject(obj, capaActiva)` de nuevo.

El `onView` del browser pasa a ser:

```js
  onView: (row, capa) => {
    const spec = specOf(capa)
    return showFeature(childOf(capa).layer, spec.idField, String(row[spec.idField]))
      .then((props) => {
        // `undefined` significa que este pedido perdió la carrera: un "Ver"
        // de vías de 12 s que llegó tarde no pisa lo que se está mirando.
        if (props) mostrarFila(capa, { ...row, ...props })
      })
      .catch((err) => setStatus(`No se pudo dibujar en el mapa: ${err.message}`, true))
  },
```

`{ ...row, ...props }`: la fila de la tabla no trae geometría ni todos los campos; el feature del GeoServer sí. Se prefiere lo que vino del servidor.

En la ficha del objeto (`selectObject`), agregar junto a `el.meta` un enlace `Qué es ${TYPES[obj.t].det} ${TYPES[obj.t].label.toLowerCase()} →` con `href = noteHref(NOTE_BY_TYPE[obj.t])`.

En `src/browser.js`, dentro del `onSelect` de las pestañas, agregar al panel un enlace chico `Qué es ${noteFor(NOTE_BY_LAYER[key]).label.toLowerCase()} →` con `href = noteHref(NOTE_BY_LAYER[key])`. Va arriba de la tabla y se mantiene visible aunque la tabla esté cargando o haya fallado.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Verify the tests kill the mutation**

Dos mutaciones, una por promesa de la regla:

1. Sacar el `if (props)` de `onView` y devolver siempre `mostrarFila`. El test "una respuesta que perdió la carrera no escribe la ficha" tiene que ponerse rojo.
2. Poner `titleField: 'cod_indec'` en la spec de `radios`. El test "no le inventa nombre a un radio" tiene que ponerse rojo.

Volver atrás las dos. **Anotar en el commit qué mutación se aplicó.**

- [ ] **Step 7: Commit**

```bash
git add src/columns.js src/columns.test.js src/pages/resultados.js src/pages/resultados.test.js src/browser.js src/browser.test.js src/style.css
git commit -m "feat: la ficha describe lo que el mapa dibuja, y enlaza la nota de cada objeto"
```

---

### Task 10: las reglas de producto y el README

**Files:**
- Create: `docs/reglas/sitio.md`, `docs/reglas/notas.md`
- Modify: `docs/reglas/navegacion.md`, `docs/reglas/README.md`, `README.md`

**Este repo mantiene `docs/reglas/` a mano: no tiene `bin/reglas-index.php` ni gate.** El índice del README de reglas se actualiza a mano, en este mismo commit. No buscar el generador.

Formato de los documentos existentes: `# Superficie`, un párrafo, `## ✅ Reglas`, y una sección `### ID — resumen en una oración` seguida de la explicación y un párrafo `**Por qué:**`. Seguirlo.

- [ ] **Step 1: Write `docs/reglas/sitio.md`**

Ocho reglas, con el porqué de cada una. El contenido está en la §8 del spec; el "por qué" sale de lo que se decidió en el brainstorming:

- **SITIO-R1** — El sitio son cuatro páginas con URL propia. *Por qué:* el home tiene que vender la idea y ser compartible, y notas y servicios son contenido que se lee, no estado de una app.
- **SITIO-R2** — El permalink es el estado: elegir un objeto navega, y no hay estado fuera de la URL. *Por qué:* con `pushState` habría dos fuentes de verdad que pueden desincronizarse; navegando de verdad, atrás y adelante funcionan sin una línea de código de historia. El costo aceptado es un reload por objeto, con el catálogo saliendo de caché.
- **SITIO-R3** — `capa=vias` en el permalink abre el panel de costo sin pedir nada. Cita **NAV-R7**. *Por qué:* si no, un enlace compartido le cobra al que lo abre hasta 99 segundos medidos que nunca pidió.
- **SITIO-R4** — Parámetros inválidos muestran el buscador, nunca una ficha rota. *Por qué:* un enlace se copia mal, se corta en un mensaje o envejece; la respuesta útil es dejar buscar, no un error terminal.
- **SITIO-R5** — Cada página lleva el CTA al Geoportal INDEC, con `target="_blank"`. Destino: `https://geonode.indec.gob.ar/`. *Por qué:* este sitio usa 8 capas de las 47 que publica el INDEC; quien necesita más tiene que saber a dónde ir. `geoportal.indec.gob.ar` **no existe** (verificado el 2026-09-08, sin registro DNS): el Geoportal INDEC es el GeoNode.
- **SITIO-R6** — El header, el CTA y el footer se inyectan en build y existen en el HTML servido. *Por qué:* escritos una vez, pero presentes aunque el JS no corra; y un marcador sin partial tira en vez de dejar un footer faltante en silencio.
- **SITIO-R7** — Los totales del home salen del build y no pueden envejecer sin que un test lo diga. *Por qué:* el home muestra números en menos de 100 ms sin bajar 673 KB, y si el catálogo se regenera sin regenerar los totales, la suite se pone roja en vez de publicar números viejos.
- **SITIO-R8** — El mapa no acredita a Leaflet; sí al IGN. *Por qué:* el prefijo por defecto del control de atribución trae el enlace a Leaflet y una bandera de Ucrania, que no son del dato que se está viendo. La licencia BSD-2-Clause de Leaflet no exige crédito en la interfaz. La atribución del IGN sí queda: esa es del basemap.

- [ ] **Step 2: Write `docs/reglas/notas.md`**

- **NOTA-R1** — Hay una nota por objeto del Marco, ocho, cada una con ancla propia. *Por qué:* los ocho objetos se confunden entre sí y el buscador ya obliga a elegir cuál se quiere; la página es donde se explica la diferencia una sola vez.
- **NOTA-R2** — Una nota afirma sólo lo verificable contra el catálogo o el GeoServer. Los totales que declara se comparan con `public/catalog.json` en la suite. *Por qué:* una nota es la voz del sitio sobre datos ajenos; un número inventado ahí es peor que no tener nota.
- **NOTA-R3** — Las notas viven en `/notas/`; la ficha enlaza, no repite. *Por qué:* dos superficies con el mismo texto compiten por ser la buena y divergen. La ficha enlaza en contexto: la nota del tipo del objeto y la de la capa de cada pestaña.

- [ ] **Step 3: Update `docs/reglas/navegacion.md`**

Tres cambios:

1. **NAV-R6 muere.** Tachar el título: `### ~~NAV-R6 — La fila de notas aparece sólo si el objeto tiene alguna nota~~`, y debajo: `**Muerta:** la fila de notas dejó de existir. Las notas se mudaron a /notas/ y la ficha enlaza en vez de repetir; la reemplaza NOTA-R3 de notas.md.` Conservar el texto original abajo, como ya hace DES-R5.
2. **NAV-R9** pierde la mitad "ni se anota": corregir el título, el cuerpo y el párrafo del porqué para que hablen sólo de "no se recorre". Explicar en una línea que la otra mitad se fue con NAV-R6.
3. **NAV-R10 nace.** `### NAV-R10 — La ficha describe lo que el mapa está dibujando`. Cuerpo: el "Ver" de una fila hija reemplaza el panel de identidad con el de esa fila; los campos salen de `specOf` (la misma spec que la tabla); el botón baja esa fila (DES-R9); una fila sin código muestra el botón muerto con su motivo (DES-R8); hay forma de volver al objeto. Una respuesta que perdió la carrera no escribe la ficha. *Por qué:* antes el mapa dibujaba un radio y la ficha seguía describiendo el departamento, y el intento anterior de arreglarlo concatenaba texto sobre `#detail-meta` sin límite; reemplazar el panel desde la spec es lo que hace que el arreglo no reviva ese bug.

- [ ] **Step 4: Update the two READMEs**

`docs/reglas/README.md`: agregar las dos superficies a la tabla y actualizar el rango de navegación.

```
| [buscador](buscador.md) | BUS-R1 … BUS-R4 |
| [descargas](descargas.md) | DES-R1 … DES-R10 |
| [navegacion](navegacion.md) | NAV-R1 … NAV-R10 |
| [notas](notas.md) | NOTA-R1 … NOTA-R3 |
| [sitio](sitio.md) | SITIO-R1 … SITIO-R8 |
```

`README.md` de la raíz: actualizar la sección **Estado** para describir el sitio de cuatro páginas y el enlace permanente, enlazar el diseño nuevo (`docs/superpowers/specs/2026-09-08-sitio-multipagina-design.md`) y las dos superficies de reglas nuevas, y documentar que `npm run build:index` ahora emite también `public/totales.json`. Los números que ya están en el README se mantienen: siguen siendo correctos.

- [ ] **Step 5: Full verification**

```bash
npm test
npm run build
grep -rc "shell:" dist/ || echo "ningún marcador sin resolver"
grep -c "Roca 609" dist/index.html dist/resultados/index.html dist/notas/index.html dist/servicios/index.html
grep -c "geoportal.indec.gob.ar" -r dist/ src/ docs/ || echo "no se menciona el host que no existe"
```

Esperado: suite verde, cuatro páginas construidas, footer en las cuatro, cero marcadores sin resolver, y ninguna mención a `geoportal.indec.gob.ar` fuera de las reglas que explican que no existe.

- [ ] **Step 6: Commit**

```bash
git add docs/ README.md
git commit -m "docs: las reglas del sitio y de las notas, y NAV-R6 muere donde corresponde"
```
