# Navegar las capas hijas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la ficha deje recorrer los objetos hijos en una tabla paginada, verlos en el mapa, bajarlos de a uno, bajar también los padres, y que el tope de 5.000 features desaparezca.

**Architecture:** El catálogo estático sigue siendo la fuente de la búsqueda y de los conteos; las filas de la tabla salen del GeoServer en vivo, paginadas con `startIndex`/`count`/`sortBy` y sin geometría. La ficha pasa de dos columnas a cuatro filas apiladas. Cada pieza nueva es un módulo sin DOM (`features`, `columns`, `parents`, `notes`) o un módulo de render que recibe datos ya resueltos (`table`, `tabs`), y `browser.js` guarda el estado de la fila 3.

**Tech Stack:** JavaScript ESM sin framework, Vite 6, Vitest 2 (jsdom para lo que toca DOM), Leaflet 1.9. Sin backend.

**Spec:** [`docs/superpowers/specs/2026-09-06-navegar-capas-hijas-design.md`](../specs/2026-09-06-navegar-capas-hijas-design.md)

## Global Constraints

- Todo el código en inglés; todos los comentarios, textos de interfaz y mensajes de test en castellano rioplatense, como el resto del repo.
- Sin dependencias nuevas. Nada de frameworks, nada de librerías de tabla.
- Toda descarga es GPKG en `EPSG:4326` (DES-R4), armada como `<a href>` al GeoServer. Nunca `fetch` para descargar.
- Todo código que se interpola en un `CQL_FILTER` o en `format_options` pasa por `assertCode()`.
- `PAGE_SIZE = 20`.
- Umbral del aviso de peso: **10 MB estimados** (`10 * 1024 * 1024`).
- Bytes por feature: vías `420`, cualquier otra capa `973`. Velocidad para estimar segundos: `2 * 1024 * 1024` B/s.
- GeoServer: `https://geonode.indec.gob.ar/geoserver/ows`, ya exportado como `GEOSERVER` en `src/download.js`.
- TDD sin excepciones: test rojo, verlo fallar, mínimo verde, commit. Correr `npx vitest run` antes de cada commit.
- Un commit por tarea, con el prefijo convencional (`feat:`, `refactor:`, `docs:`, `test:`).

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/columns.js` **nuevo** | Por capa hija: columnas a mostrar, `sortBy` y campo identificador. Datos puros. | 1 |
| `src/children.js` **modificar** | Deja de decidir el tope; estima peso y arma el aviso. | 2 |
| `src/download.js` **modificar** | Nace `featureUrl()`; muere `canDownload()`. | 2, 6 |
| `scripts/lib/aggregate.mjs` **modificar** | Agrega `ag` (código de aglomerado) a los objetos `loc`. | 3 |
| `src/parents.js` **nuevo** | Cadena de padres resuelta contra el catálogo. Sin DOM. | 4 |
| `index.html` + `src/style.css` **modificar** | Las cuatro filas. | 5 |
| `src/main.js` **modificar** | Cablea las cuatro filas. | 5, 10, 11 |
| `src/features.js` **nuevo** | Arma el pedido de una página de hijos y normaliza la respuesta. | 7 |
| `src/tabs.js` **nuevo** | Pestañas con ARIA. Lo usan la fila 3 y la fila 4. | 8 |
| `src/table.js` **nuevo** | Renderiza tabla y paginador a partir de filas ya traídas. | 9 |
| `src/browser.js` **nuevo** | Estado de la fila 3: pestaña activa, página, fila vista, pedido en vuelo. | 10 |
| `src/notes.js` **nuevo** | Las notas y a qué capa aplica cada una. | 11 |
| `docs/reglas/*` **modificar/nuevo** | DES reescritas, `navegacion.md` nuevo. | 12 |

---

# ETAPA 1 — sacar el tope y bajar los padres

Cierra sola: al terminar la etapa el sitio anda entero, sin tope y con los padres.

## Task 1: `columns.js` — qué se muestra de cada capa

**Files:**
- Create: `src/columns.js`
- Test: `src/columns.test.js`

**Interfaces:**
- Consumes: `CHILD_LAYERS` de `src/download.js` (sólo el test, para comparar claves).
- Produces:
  - `LAYER_SPECS` — objeto `{ [childKey]: { sortBy: string, idField: string, columns: Column[] } }`
  - `Column` — `{ field: string, label: string, kind: 'text' | 'code' | 'num', map?: (v: string) => string }`
  - `specOf(childKey): Spec` — tira si la capa no existe
  - `queryFields(childKey): string[]` — campos únicos para `propertyName`: columnas + `idField` + los de `sortBy`

- [ ] **Step 1: Escribir el test que falla**

```js
// src/columns.test.js
import { describe, it, expect } from 'vitest'
import { LAYER_SPECS, specOf, queryFields } from './columns.js'
import { CHILD_LAYERS } from './download.js'

describe('LAYER_SPECS', () => {
  // El test que se rompe cuando alguien agrega una capa y se olvida la mitad.
  it('cubre exactamente las capas hijas que existen', () => {
    expect(Object.keys(LAYER_SPECS).sort()).toEqual(Object.keys(CHILD_LAYERS).sort())
  })

  it('toda capa declara sortBy, idField y al menos una columna', () => {
    for (const [key, spec] of Object.entries(LAYER_SPECS)) {
      expect(spec.sortBy, key).toBeTruthy()
      expect(spec.idField, key).toBeTruthy()
      expect(spec.columns.length, key).toBeGreaterThan(0)
    }
  })

  it('vías desempata el orden, porque repite cod_indec', () => {
    expect(LAYER_SPECS.vias.sortBy).toBe('cod_indec,id')
  })

  it('vías muestra los 21 campos que publica el GeoServer', () => {
    expect(LAYER_SPECS.vias.columns).toHaveLength(21)
    expect(LAYER_SPECS.vias.columns[0].field).toBe('id')
    expect(LAYER_SPECS.vias.columns.at(-1).field).toBe('sag')
  })
})

describe('specOf', () => {
  it('devuelve la capa pedida', () => {
    expect(specOf('radios').idField).toBe('cod_indec')
  })

  it('tira con una capa desconocida', () => {
    expect(() => specOf('parcelas')).toThrow(/parcelas/)
  })
})

describe('queryFields', () => {
  it('junta columnas, identificador y campos de orden, sin repetir', () => {
    expect(queryFields('vias')).toContain('id')
    expect(queryFields('vias').filter((f) => f === 'id')).toHaveLength(1)
  })

  it('incluye el campo de orden aunque no sea columna', () => {
    expect(queryFields('localidades')).toContain('clc')
  })

  it('no pide la geometría', () => {
    for (const key of Object.keys(LAYER_SPECS)) {
      expect(queryFields(key)).not.toContain('the_geom')
      expect(queryFields(key)).not.toContain('geom')
    }
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/columns.test.js`
Expected: FAIL — `Failed to resolve import "./columns.js"`

- [ ] **Step 3: Escribir `src/columns.js`**

```js
/**
 * Qué mostrar de cada capa hija, cómo ordenarla y qué campo identifica una
 * fila para poder descargarla sola.
 *
 * Fracciones y radios no traen nombre en el Marco Geoestadístico: se
 * identifican por número y por su código. No se les inventa un rótulo.
 */

const urbanoRural = (v) => (v === 'U' ? 'Urbano' : v === 'R' ? 'Rural' : v)

/** Las vías se muestran con los 21 campos publicados, en el orden del GeoServer. */
const VIA_FIELDS = [
  'id', 'cpr', 'jur', 'cde', 'dpto', 'cmu', 'gobloc', 'clc', 'localidad',
  'codaglo', 'aglomerado', 'cvc', 'fna', 'gna', 'subtipo',
  'desdei', 'desded', 'hastai', 'hastad', 'cod_indec', 'sag',
]
const NUMERIC_VIA_FIELDS = new Set(['id', 'desdei', 'desded', 'hastai', 'hastad'])
const CODE_VIA_FIELDS = new Set(['cpr', 'cde', 'cmu', 'clc', 'codaglo', 'cvc', 'cod_indec'])

export const LAYER_SPECS = {
  departamentos: {
    sortBy: 'cde',
    idField: 'cde',
    columns: [
      { field: 'nam', label: 'Nombre', kind: 'text' },
      { field: 'cde', label: 'Código', kind: 'code' },
    ],
  },
  fracciones: {
    sortBy: 'cod_indec',
    idField: 'cod_indec',
    columns: [
      { field: 'cfn', label: 'Fracción', kind: 'num' },
      { field: 'cod_indec', label: 'Código', kind: 'code' },
    ],
  },
  radios: {
    sortBy: 'cod_indec',
    idField: 'cod_indec',
    columns: [
      { field: 'cro', label: 'Radio', kind: 'num' },
      { field: 'cfn', label: 'Fracción', kind: 'num' },
      { field: 'tro', label: 'Tipo', kind: 'text', map: urbanoRural },
      { field: 'cod_indec', label: 'Código', kind: 'code' },
    ],
  },
  localidades: {
    sortBy: 'clc',
    idField: 'clc',
    columns: [
      { field: 'nam', label: 'Nombre', kind: 'text' },
      { field: 'gna', label: 'Tipo', kind: 'text' },
      { field: 'aglomerado', label: 'Aglomerado', kind: 'text' },
      { field: 'clc', label: 'Código', kind: 'code' },
    ],
  },
  vias: {
    // `cod_indec` se repite —una calle se parte en hasta 80 tramos—, así que
    // sin desempate el paginado podría repetir o saltear filas entre páginas.
    sortBy: 'cod_indec,id',
    idField: 'cod_indec',
    columns: VIA_FIELDS.map((field) => ({
      field,
      label: field,
      kind: NUMERIC_VIA_FIELDS.has(field) ? 'num' : CODE_VIA_FIELDS.has(field) ? 'code' : 'text',
    })),
  },
}

/** La especificación de una capa hija. Tira si no existe. */
export function specOf(childKey) {
  const spec = LAYER_SPECS[childKey]
  if (!spec) throw new Error(`capa hija sin columnas declaradas: ${JSON.stringify(childKey)}`)
  return spec
}

/**
 * Campos que hay que pedirle al GeoServer: los que se muestran, el que
 * identifica la fila y los del orden. La geometría no entra: la tabla no la
 * usa y es lo que pesa.
 */
export function queryFields(childKey) {
  const spec = specOf(childKey)
  return [...new Set([
    ...spec.columns.map((c) => c.field),
    spec.idField,
    ...spec.sortBy.split(','),
  ])]
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npx vitest run src/columns.test.js`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/columns.js src/columns.test.js
git commit -m "feat: cada capa hija declara sus columnas, su orden y su identificador"
```

---

## Task 2: sacar el tope y avisar el peso

**Files:**
- Modify: `src/download.js` (borrar `canDownload`)
- Modify: `src/children.js` (completo)
- Test: `src/children.test.js`, `src/download.test.js`

**Interfaces:**
- Produces:
  - `estimateBytes(childKey, count): number`
  - `estimateSeconds(bytes): number`
  - `weightNotice(childKey, count): string | null` — `null` por debajo del umbral
  - `childRows(obj): HTMLElement[]` — ya no recibe `maxFeatures`
- Deja de existir: `canDownload(count, maxFeatures)` de `download.js`.

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar el contenido de `src/children.test.js` por esto (mirá primero el archivo actual para conservar el estilo de sus helpers):

```js
// src/children.test.js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { estimateBytes, estimateSeconds, weightNotice, childRows } from './children.js'

const MB = 1024 * 1024

describe('estimateBytes', () => {
  it('usa la constante de líneas para vías', () => {
    expect(estimateBytes('vias', 1000)).toBe(420 * 1000)
  })

  it('usa la constante de polígonos para el resto', () => {
    expect(estimateBytes('radios', 1000)).toBe(973 * 1000)
    expect(estimateBytes('fracciones', 1000)).toBe(973 * 1000)
  })
})

describe('weightNotice', () => {
  it('calla por debajo del umbral', () => {
    expect(weightNotice('radios', 432)).toBe(null)
  })

  it('avisa por encima del umbral, con tamaño y espera', () => {
    const aviso = weightNotice('radios', 23901)
    expect(aviso).toMatch(/22 MB/)
    expect(aviso).toMatch(/segundos/)
  })

  // El peor caso medido: 179.029 vías de Buenos Aires, 74 MB reales.
  it('estima el peor caso del catálogo en el orden correcto', () => {
    const aviso = weightNotice('vias', 179029)
    expect(aviso).toMatch(/7[0-9] MB/)
  })

  it('en el borde exacto del umbral todavía calla', () => {
    const justo = Math.floor((10 * MB) / 973)
    expect(weightNotice('radios', justo)).toBe(null)
    expect(weightNotice('radios', justo + 1)).not.toBe(null)
  })
})

describe('childRows', () => {
  const obj = { t: 'jur', c: '06', n: 'Buenos Aires', ch: { radios: 23901, localidades: 621 } }

  it('da un enlace de descarga vivo aunque la capa sea enorme', () => {
    const filas = childRows(obj)
    const radios = filas.find((li) => li.textContent.includes('Radios'))
    expect(radios.querySelector('a.btn')).not.toBe(null)
    expect(radios.querySelector('[aria-disabled="true"]')).toBe(null)
  })

  it('pone el aviso de peso sólo donde hace falta', () => {
    const filas = childRows(obj)
    expect(filas.find((li) => li.textContent.includes('Radios')).textContent).toMatch(/MB/)
    expect(filas.find((li) => li.textContent.includes('Localidades')).textContent).not.toMatch(/MB/)
  })

  it('la capa con cero objetos sigue deshabilitada', () => {
    const filas = childRows({ t: 'loc', c: '06840010', n: 'x', ch: { vias: 0 } })
    expect(filas[0].querySelector('a.btn')).toBe(null)
    expect(filas[0].querySelector('[aria-disabled="true"]')).not.toBe(null)
  })
})
```

Y en `src/download.test.js`, borrar el bloque `describe('canDownload', ...)` entero.

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npx vitest run src/children.test.js`
Expected: FAIL — `estimateBytes is not a function` y `childRows` recibiendo un solo argumento.

- [ ] **Step 3: Reescribir `src/children.js`**

Leer el archivo actual antes de tocarlo: conserva `CHILD_LAYERS`, `childUrl`, `fmt` y `downloadButton`/`disabledButton` como los usa hoy.

```js
import { childUrl, CHILD_LAYERS } from './download.js'
import { childrenOf } from './catalog.js'
import { fmt, downloadButton, disabledButton } from './ui.js'

/**
 * Bytes por feature, medidos el 2026-09-06 contra el GeoServer: los 23.901
 * radios de Buenos Aires pesaron 22 MB y sus 179.029 vías, 74 MB. Las líneas
 * pesan menos de la mitad que los polígonos.
 */
const BYTES_PER_FEATURE = { vias: 420 }
const BYTES_DEFAULT = 973

/** 74 MB en 37 s en la medición del peor caso. */
const BYTES_PER_SECOND = 2 * 1024 * 1024

/**
 * A partir de acá el archivo tarda lo suficiente como para que valga
 * advertirlo. Por debajo no se dice nada: son casi todas las descargas.
 */
const NOTICE_THRESHOLD = 10 * 1024 * 1024

export function estimateBytes(childKey, count) {
  return (BYTES_PER_FEATURE[childKey] ?? BYTES_DEFAULT) * count
}

export function estimateSeconds(bytes) {
  return Math.round(bytes / BYTES_PER_SECOND)
}

/**
 * Aviso de peso, o `null` si el archivo es chico. Se dice antes del clic:
 * la descarga la toma el gestor del browser y no hay progreso que mostrar.
 */
export function weightNotice(childKey, count) {
  const bytes = estimateBytes(childKey, count)
  if (bytes <= NOTICE_THRESHOLD) return null
  const mb = Math.round(bytes / (1024 * 1024))
  return `Archivo grande: unos ${fmt(mb)} MB, cerca de ${fmt(estimateSeconds(bytes))} segundos.`
}

/** Una fila por capa hija, con su conteo y su descarga. */
export function childRows(obj) {
  return childrenOf(obj).map(({ key, count }) => {
    const li = document.createElement('li')
    const who = document.createElement('span')
    who.className = 'who'
    who.textContent = CHILD_LAYERS[key].label

    const cuenta = document.createElement('span')
    cuenta.className = 'count'
    cuenta.textContent = ` · ${fmt(count)}`
    who.append(cuenta)

    if (count === 0) {
      li.append(who, disabledButton('Descargar', `No hay ${CHILD_LAYERS[key].label.toLowerCase()} en este objeto.`))
      return li
    }

    const aviso = weightNotice(key, count)
    if (aviso) {
      const nota = document.createElement('span')
      nota.className = 'heavy'
      nota.textContent = aviso
      who.append(nota)
    }
    li.append(who, downloadButton(childUrl(obj, key), 'Descargar'))
    return li
  })
}
```

En `src/download.js`, borrar la función `canDownload` y su comentario.

- [ ] **Step 4: Correr toda la suite y verla pasar**

Run: `npx vitest run`
Expected: PASS. Si `main.test.js` falla porque esperaba el botón muerto de los radios de Buenos Aires, actualizá ese test: ahora el enlace existe y al lado dice los MB. Es el cambio que pide la spec.

- [ ] **Step 5: Commit**

```bash
git add src/children.js src/children.test.js src/download.js src/download.test.js src/main.test.js
git commit -m "feat: el tope de 5.000 se reemplaza por un aviso de peso"
```

---

## Task 3: el catálogo aprende el aglomerado de cada localidad

**Files:**
- Modify: `scripts/lib/aggregate.mjs`
- Test: `scripts/lib/aggregate.test.mjs`
- Regenerate: `public/catalog.json`

**Interfaces:**
- Produces: los objetos `loc` del catálogo ganan `ag` — el `codaglo` de esa localidad, o se omite si no tiene.

- [ ] **Step 1: Escribir el test que falla**

Abrí `scripts/lib/aggregate.test.mjs` y mirá cómo arma sus fixtures. Agregá:

```js
// El aglomerado de una localidad no sale de su código: `clc` no lo contiene.
// Sin esto, la cadena de padres de una localidad pierde un eslabón.
it('guarda el código de aglomerado de cada localidad', () => {
  const cat = aggregate(fixtures)
  const loc = cat.objects.find((o) => o.t === 'loc' && o.c === '06840010')
  expect(loc.ag).toBe('0001')
})

it('no inventa aglomerado donde el INDEC no lo declara', () => {
  const cat = aggregate(fixtures)
  const sinAglo = cat.objects.find((o) => o.t === 'loc' && o.c === '82049020')
  expect(sinAglo.ag).toBeUndefined()
})
```

Ajustá los códigos a los que existan en las fixtures del archivo, y agregá a la fixture de localidades una fila con `codaglo: '0001'` y otra con `codaglo: 'N/A'` o vacío.

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run scripts/lib/aggregate.test.mjs`
Expected: FAIL — `expected undefined to be '0001'`

- [ ] **Step 3: Agregar `ag` en el build**

En `scripts/lib/aggregate.mjs`, en el `objects.push` de las localidades:

```js
objects.push({
  t: 'loc', c: row.clc, n: row.nam, s: normalize(row.nam), p: row.jur,
  // El aglomerado no se deduce del código: `clc` no lo contiene. Se guarda
  // para que la cadena de padres pueda ofrecerlo (ver parents.js).
  ...(row.codaglo && row.codaglo !== 'N/A' ? { ag: row.codaglo } : {}),
  ch: { vias: get(viasByLoc, row.clc) },
})
```

Verificá contra el archivo real cómo se llama la variable de la fila y cómo se detecta el `N/A`: el módulo ya trata ese centinela en otro lado.

- [ ] **Step 4: Correr los tests y regenerar el catálogo**

```bash
npx vitest run scripts/lib/aggregate.test.mjs
npm run build:index
node -e "const c=require('./public/catalog.json');const l=c.objects.filter(o=>o.t==='loc');console.log('localidades:',l.length,'| con ag:',l.filter(o=>o.ag).length)"
```
Expected: tests PASS; el conteo de localidades con `ag` es mayor que cero y menor o igual al total.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/aggregate.mjs scripts/lib/aggregate.test.mjs public/catalog.json
git commit -m "feat: el catálogo guarda el aglomerado de cada localidad censal"
```

---

## Task 4: `parents.js` — la cadena de padres

**Files:**
- Create: `src/parents.js`
- Test: `src/parents.test.js`

**Interfaces:**
- Produces:
  - `codeIndex(objects): Map<string, object>` — clave `` `${t}:${c}` ``
  - `parentsOf(obj, index): object[]` — objetos del catálogo, del padre más cercano al más lejano

- [ ] **Step 1: Escribir el test que falla**

```js
// src/parents.test.js
import { describe, it, expect } from 'vitest'
import { codeIndex, parentsOf } from './parents.js'

const objects = [
  { t: 'jur', c: '06', n: 'Buenos Aires' },
  { t: 'dep', c: '06840', n: 'Tres de Febrero' },
  { t: 'loc', c: '06840010', n: 'Tres de Febrero', ag: '0001' },
  { t: 'gl', c: '060840', n: 'Tres de Febrero' },
  { t: 'aglo', c: '0001', n: 'Gran Buenos Aires' },
]
const index = codeIndex(objects)
const codigos = (obj) => parentsOf(obj, index).map((o) => `${o.t}:${o.c}`)
const buscar = (t, c) => objects.find((o) => o.t === t && o.c === c)

describe('parentsOf', () => {
  it('la jurisdicción no tiene padres', () => {
    expect(parentsOf(buscar('jur', '06'), index)).toEqual([])
  })

  it('el departamento cuelga de su jurisdicción', () => {
    expect(codigos(buscar('dep', '06840'))).toEqual(['jur:06'])
  })

  it('la localidad da la cadena entera, del más cercano al más lejano', () => {
    expect(codigos(buscar('loc', '06840010'))).toEqual(['dep:06840', 'jur:06', 'aglo:0001'])
  })

  it('el gobierno local sólo llega a la jurisdicción', () => {
    expect(codigos(buscar('gl', '060840'))).toEqual(['jur:06'])
  })

  it('el aglomerado no tiene padre: cruza jurisdicciones', () => {
    expect(parentsOf(buscar('aglo', '0001'), index)).toEqual([])
  })

  // DES-R8: los códigos del INDEC no cierran entre capas. Un padre derivado
  // puede no existir, y ahí no se ofrece en vez de armar una URL a ciegas.
  it('descarta el padre derivado que no está en el catálogo', () => {
    const huerfano = { t: 'dep', c: '99999', n: 'Inventado' }
    expect(parentsOf(huerfano, codeIndex([huerfano]))).toEqual([])
  })

  it('la localidad sin ag no ofrece aglomerado', () => {
    const sinAglo = { t: 'loc', c: '06840010', n: 'x' }
    expect(codigos(sinAglo)).toEqual(['dep:06840', 'jur:06'])
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/parents.test.js`
Expected: FAIL — `Failed to resolve import "./parents.js"`

- [ ] **Step 3: Escribir `src/parents.js`**

```js
/**
 * De qué forma parte un objeto. Los códigos del INDEC anidan por prefijo
 * —`cde` empieza con `cpr`, `clc` empieza con `cde`—, así que el padre se
 * deriva del código propio. La excepción es el aglomerado de una localidad,
 * que no está en su código y viaja aparte en el catálogo como `ag`.
 *
 * Todo padre derivado se busca en el catálogo antes de ofrecerlo: DES-R8
 * documenta que los códigos no cierran entre capas, así que un prefijo
 * válido puede apuntar a un objeto que no existe.
 */

/** Índice por tipo y código, para resolver un padre sin recorrer el catálogo. */
export function codeIndex(objects) {
  return new Map(objects.map((obj) => [`${obj.t}:${obj.c}`, obj]))
}

/** Padres derivables de cada tipo, del más cercano al más lejano. */
const CHAIN = {
  jur: () => [],
  dep: (obj) => [['jur', obj.c.slice(0, 2)]],
  loc: (obj) => [
    ['dep', obj.c.slice(0, 5)],
    ['jur', obj.c.slice(0, 2)],
    ...(obj.ag ? [['aglo', obj.ag]] : []),
  ],
  gl: (obj) => [['jur', obj.c.slice(0, 2)]],
  aglo: () => [],
}

/** Los padres que existen de verdad en el catálogo. */
export function parentsOf(obj, index) {
  const chain = CHAIN[obj?.t]
  if (!chain) return []
  return chain(obj)
    .map(([t, c]) => index.get(`${t}:${c}`))
    .filter(Boolean)
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npx vitest run src/parents.test.js`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/parents.js src/parents.test.js
git commit -m "feat: la cadena de padres de un objeto, resuelta contra el catálogo"
```

---

## Task 5: la ficha en cuatro filas, con la fila 2 cableada

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`
- Modify: `src/main.js`
- Test: `src/main.test.js`

**Interfaces:**
- Produces: los contenedores `#row-parents`, `#parents`, `#row-browse`, `#row-notes` en el DOM, que las etapas 2 y 3 rellenan.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `src/main.test.js`. La fixture `catalogo` de ese archivo necesita ahora una jurisdicción y un departamento que encadenen: `{t:'jur',c:'06',...}` ya está; el departamento `06840` también. Alcanza.

```js
// La cadena de padres es lo único que la fila 2 agrega al recorrido de hoy.
describe('la fila de padres', () => {
  it('ofrece la jurisdicción de un departamento', () => {
    buscar('tres')
    $('#results').children[0].click()
    const filas = [...$('#parents').children]
    expect(filas).toHaveLength(1)
    expect(filas[0].textContent).toContain('Buenos Aires')
    expect(filas[0].textContent).toContain('Jurisdicción')
    expect(filas[0].querySelector('a.btn').getAttribute('href')).toContain('cpr%3D%2706%27')
  })

  it('la jurisdicción no muestra la fila, porque no tiene padres', () => {
    buscar('buenos')
    $('#results').children[0].click()
    expect($('#row-parents').hidden).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/main.test.js`
Expected: FAIL — `Cannot read properties of null (reading 'children')` sobre `#parents`

- [ ] **Step 3: Las cuatro filas**

En `index.html`, reemplazar el `<section id="detail">` por:

```html
      <section id="detail" class="detail" hidden>
        <div class="row row-identity">
          <div id="map" class="map"></div>
          <div class="identity">
            <h2 id="detail-name"></h2>
            <p id="detail-meta" class="meta"></p>
            <div id="detail-self"></div>
          </div>
        </div>

        <div class="row row-bulk">
          <div id="row-parents" hidden>
            <p class="block-title">De qué forma parte</p>
            <ul id="parents" class="rel"></ul>
          </div>
          <div>
            <p class="block-title">Qué contiene, capa entera</p>
            <ul id="children" class="rel"></ul>
          </div>
        </div>

        <div class="row" id="row-browse" hidden>
          <p class="block-title">Recorrer y descargar de a uno</p>
          <div id="browse"></div>
        </div>

        <div class="row" id="row-notes" hidden>
          <p class="block-title">Notas</p>
          <div id="notes"></div>
        </div>
      </section>
```

El `<h3 id="children-title">` desaparece: ahora el rótulo es el `.block-title` fijo de la fila 2.

En `src/style.css`, reemplazar la regla `.detail` y agregar las de las filas:

```css
.detail { display: flex; flex-direction: column; gap: 1.75rem; margin: 1.5rem 0 3rem; }

.row-identity { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.row-bulk { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr); gap: 1.5rem; }
@media (max-width: 48rem) {
  .row-identity, .row-bulk { grid-template-columns: 1fr; }
}

.identity { display: flex; flex-direction: column; justify-content: center; }

.block-title {
  font-size: .78rem; text-transform: uppercase; letter-spacing: .06em;
  color: var(--muted); margin: 0 0 .4rem;
}

.rel { list-style: none; padding: 0; margin: 0; }
.rel li {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: .55rem 0; border-top: 1px solid var(--line);
}
.rel .who { font-size: .92rem; }
.rel .count { color: var(--muted); }
/* El aviso de peso va debajo del nombre de la capa, no al lado del botón:
   es lo que se lee antes de decidir el clic. */
.rel .heavy { color: var(--warn); font-size: .8rem; display: block; }
```

Borrar las reglas viejas de `.children` y `.panel` que queden sin uso, y las de `#children-title`.

En `src/main.js`: agregar los elementos nuevos a `el`, importar `parents.js`, y en `selectObject` renderizar la fila 2.

```js
import { codeIndex, parentsOf } from './parents.js'
import { TYPES, selfUrl } from './download.js'

// ... en `el`:
  parents: document.querySelector('#parents'),
  rowParents: document.querySelector('#row-parents'),
  rowBrowse: document.querySelector('#row-browse'),
  rowNotes: document.querySelector('#row-notes'),

let index = null   // se llena junto con `catalog`

/** Una fila por padre: quién es y su descarga. */
function parentRow(parent) {
  const li = document.createElement('li')
  const who = document.createElement('span')
  who.className = 'who'
  who.textContent = parent.n
  const kind = document.createElement('span')
  kind.className = 'count'
  kind.textContent = ` · ${TYPES[parent.t].label} · ${parent.c}`
  who.append(kind)
  li.append(who, downloadButton(selfUrl(parent), 'Descargar'))
  return li
}

function renderParents(obj) {
  const rows = parentsOf(obj, index).map(parentRow)
  el.rowParents.hidden = rows.length === 0
  el.parents.replaceChildren(...rows)
}
```

Llamar `renderParents(obj)` en `selectObject`, y en el `.then` de `loadCatalog` hacer `index = codeIndex(c.objects)`. `renderChildren(obj)` pierde el argumento `maxFeatures` y ya no toca `childrenTitle`.

- [ ] **Step 4: Correr toda la suite y verla pasar**

Run: `npx vitest run`
Expected: PASS. Los tests viejos que buscaban `#children-title` hay que borrarlos: ese elemento ya no existe.

- [ ] **Step 5: Verificar en un browser real**

```bash
npx vite --port 5199 --strictPort &
```
Abrir `http://localhost:5199/`, buscar "Tres de Febrero", elegir el departamento. Confirmar: cuatro filas apiladas, mapa e identidad arriba, padres e hijos abajo, y que en angosto las dos grillas caen a una columna. Cerrar el server por su PID (`ss -lptn 'sport = :5199'`), no con `pkill -f vite`: ese patrón mata también el shell que lo corre.

- [ ] **Step 6: Commit**

```bash
git add index.html src/style.css src/main.js src/main.test.js
git commit -m "feat: la ficha pasa a cuatro filas y ofrece la descarga de los padres"
```

---

# ETAPA 2 — recorrer los hijos

## Task 6: `featureUrl()` — descargar un objeto hijo solo

**Files:**
- Modify: `src/download.js`
- Test: `src/download.test.js`

**Interfaces:**
- Consumes: `specOf` de `src/columns.js`
- Produces: `featureUrl(childKey, code, format = 'geopackage'): string`

- [ ] **Step 1: Escribir el test que falla**

```js
// en src/download.test.js
import { featureUrl } from './download.js'

describe('featureUrl', () => {
  it('filtra por el campo identificador de la capa', () => {
    const url = featureUrl('radios', '068400101')
    expect(url).toContain('typenames=geonode%3Aradios_censales2')
    expect(url).toContain('CQL_FILTER=cod_indec%3D%27068400101%27')
    expect(url).toContain('outputFormat=geopackage')
    expect(url).toContain('srsName=EPSG%3A4326')
  })

  it('usa clc para una localidad censal', () => {
    expect(featureUrl('localidades', '06840010')).toContain('CQL_FILTER=clc%3D%2706840010%27')
  })

  // Una calle se parte en tramos que comparten cod_indec: filtrar por el
  // código baja la calle entera, que es lo que se quiere.
  it('en vías filtra por cod_indec, no por tramo', () => {
    expect(featureUrl('vias', '0684001000010')).toContain('CQL_FILTER=cod_indec%3D%270684001000010%27')
  })

  it('nombra el archivo con la capa y el código', () => {
    expect(featureUrl('radios', '068400101')).toContain('filename%3Aradios_censales2-068400101.gpkg')
  })

  it('rechaza un código que no sea de dígitos', () => {
    expect(() => featureUrl('radios', "1' OR '1")).toThrow(/inválido/)
  })

  it('tira con una capa que no existe', () => {
    expect(() => featureUrl('parcelas', '1')).toThrow(/parcelas/)
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/download.test.js`
Expected: FAIL — `featureUrl is not a function`

- [ ] **Step 3: Implementar**

```js
// src/download.js — junto a selfUrl y childUrl
import { specOf } from './columns.js'

/**
 * URL de descarga de un objeto hijo suelto. En vías el filtro es por
 * `cod_indec`, que agrupa todos los tramos de una calle: se baja la calle
 * entera, no el tramo de la fila.
 */
export function featureUrl(childKey, code, format = GPKG) {
  const child = CHILD_LAYERS[childKey]
  if (!child) throw new Error(`capa hija desconocida: ${JSON.stringify(childKey)}`)
  const base = child.layer.replace('geonode:', '')
  return wfsUrl(
    child.layer,
    `${specOf(childKey).idField}='${assertCode(code)}'`,
    format,
    format === GPKG ? `${base}-${assertCode(code)}.gpkg` : null,
  )
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npx vitest run src/download.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/download.js src/download.test.js
git commit -m "feat: URL de descarga de un objeto hijo suelto"
```

---

## Task 7: `features.js` — traer una página de hijos

**Files:**
- Create: `src/features.js`
- Test: `src/features.test.js`

**Interfaces:**
- Consumes: `CHILD_LAYERS`, `TYPES`, `GEOSERVER` de `download.js`; `specOf`, `queryFields` de `columns.js`
- Produces:
  - `PAGE_SIZE = 20`
  - `pageUrl(obj, childKey, page): string`
  - `fetchPage(obj, childKey, page): Promise<{ rows: object[], total: number }>`

- [ ] **Step 1: Escribir el test que falla**

```js
// src/features.test.js
import { describe, it, expect, vi } from 'vitest'
import { PAGE_SIZE, pageUrl, fetchPage } from './features.js'

const dep = { t: 'dep', c: '06840', n: 'Tres de Febrero' }

describe('pageUrl', () => {
  it('filtra por el campo del padre y su código', () => {
    expect(pageUrl(dep, 'radios', 0)).toContain('CQL_FILTER=cde%3D%2706840%27')
  })

  it('pide JSON, no geopackage', () => {
    expect(pageUrl(dep, 'radios', 0)).toContain('outputFormat=application%2Fjson')
  })

  it('pagina con count y startIndex', () => {
    expect(pageUrl(dep, 'radios', 0)).toContain(`count=${PAGE_SIZE}`)
    expect(pageUrl(dep, 'radios', 0)).toContain('startIndex=0')
    expect(pageUrl(dep, 'radios', 3)).toContain(`startIndex=${3 * PAGE_SIZE}`)
  })

  it('ordena con el desempate en vías', () => {
    expect(pageUrl(dep, 'vias', 0)).toContain('sortBy=cod_indec%2Cid')
  })

  it('no pide la geometría', () => {
    const url = pageUrl(dep, 'radios', 0)
    expect(url).toContain('propertyName=')
    expect(url).not.toMatch(/the_geom/)
  })

  it('rechaza un código de padre que no sea de dígitos', () => {
    expect(() => pageUrl({ t: 'dep', c: "x' OR '1" }, 'radios', 0)).toThrow(/inválido/)
  })
})

describe('fetchPage', () => {
  const responder = (body, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => body }))

  it('devuelve las propiedades de cada feature y el total del servidor', async () => {
    global.fetch = responder({
      totalFeatures: 432,
      features: [{ properties: { cod_indec: '068400101', cro: '01' } }],
    })
    const { rows, total } = await fetchPage(dep, 'radios', 0)
    expect(total).toBe(432)
    expect(rows).toEqual([{ cod_indec: '068400101', cro: '01' }])
  })

  it('avisa con el status cuando el GeoServer falla', async () => {
    global.fetch = responder({}, false)
    await expect(fetchPage(dep, 'radios', 0)).rejects.toThrow(/503/)
  })

  it('sobrevive a una respuesta sin features', async () => {
    global.fetch = responder({ totalFeatures: 0 })
    const { rows, total } = await fetchPage(dep, 'radios', 0)
    expect(rows).toEqual([])
    expect(total).toBe(0)
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/features.test.js`
Expected: FAIL — `Failed to resolve import "./features.js"`

- [ ] **Step 3: Escribir `src/features.js`**

```js
import { GEOSERVER, CHILD_LAYERS, TYPES, assertCode } from './download.js'
import { specOf, queryFields } from './columns.js'

/**
 * Una página de objetos hijos, leída del GeoServer en vivo: el catálogo tiene
 * los conteos, no los objetos —las vías del país son 477.588 filas—.
 *
 * El pedido va sin geometría: la tabla no la usa y es lo que pesa. Una página
 * de 20 filas de vías pesa 3,1 KB, así que cuesta lo mismo paginar un partido
 * que una provincia. La geometría se pide aparte, de a un feature, al verlo
 * en el mapa.
 */
export const PAGE_SIZE = 20

export function pageUrl(obj, childKey, page) {
  const child = CHILD_LAYERS[childKey]
  if (!child) throw new Error(`capa hija desconocida: ${JSON.stringify(childKey)}`)
  const parent = TYPES[obj?.t]
  if (!parent) throw new Error(`tipo de objeto desconocido: ${JSON.stringify(obj?.t)}`)

  const p = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typenames: child.layer,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    CQL_FILTER: `${parent.field}='${assertCode(obj.c)}'`,
    propertyName: queryFields(childKey).join(','),
    sortBy: specOf(childKey).sortBy,
    count: String(PAGE_SIZE),
    startIndex: String(page * PAGE_SIZE),
  })
  return `${GEOSERVER}?${p}`
}

/** Las filas de una página y el total que dice el servidor. */
export async function fetchPage(obj, childKey, page) {
  const res = await fetch(pageUrl(obj, childKey, page))
  if (!res.ok) throw new Error(`el GeoServer respondió HTTP ${res.status}`)
  const body = await res.json()
  return {
    rows: (body.features ?? []).map((f) => f.properties),
    total: body.totalFeatures ?? 0,
  }
}
```

`assertCode` hoy es privada en `download.js`: exportarla.

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npx vitest run src/features.test.js`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/features.js src/features.test.js src/download.js
git commit -m "feat: una página de objetos hijos leída del GeoServer, sin geometría"
```

---

## Task 8: `tabs.js` — pestañas reutilizables

**Files:**
- Create: `src/tabs.js`
- Test: `src/tabs.test.js`

**Interfaces:**
- Produces: `createTabs({ container, items, onSelect }): { select(key), destroy() }`
  - `items`: `[{ key: string, label: string, badge?: string }]`
  - Renderiza un `<div role="tablist">` dentro de `container` y llama `onSelect(key)` al elegir. Selecciona el primero al construirse.

- [ ] **Step 1: Escribir el test que falla**

```js
// src/tabs.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTabs } from './tabs.js'

let container
const items = [
  { key: 'radios', label: 'Radios', badge: '432' },
  { key: 'vias', label: 'Vías', badge: '1.487' },
]

beforeEach(() => {
  document.body.innerHTML = '<div id="c"></div>'
  container = document.querySelector('#c')
})

describe('createTabs', () => {
  it('dibuja una pestaña por item, con su badge', () => {
    createTabs({ container, items, onSelect: () => {} })
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].textContent).toContain('Radios')
    expect(tabs[0].textContent).toContain('432')
  })

  it('elige la primera al construirse', () => {
    const onSelect = vi.fn()
    createTabs({ container, items, onSelect })
    expect(onSelect).toHaveBeenCalledWith('radios')
    expect(container.querySelector('[role="tab"]').getAttribute('aria-selected')).toBe('true')
  })

  it('al hacer clic avisa y mueve el aria-selected', () => {
    const onSelect = vi.fn()
    createTabs({ container, items, onSelect })
    container.querySelectorAll('[role="tab"]')[1].click()
    expect(onSelect).toHaveBeenLastCalledWith('vias')
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs[0].getAttribute('aria-selected')).toBe('false')
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
  })

  it('no vuelve a avisar si se elige la que ya está', () => {
    const onSelect = vi.fn()
    createTabs({ container, items, onSelect })
    onSelect.mockClear()
    container.querySelector('[role="tab"]').click()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('sin items no dibuja nada', () => {
    const onSelect = vi.fn()
    createTabs({ container, items: [], onSelect })
    expect(container.children).toHaveLength(0)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/tabs.test.js`
Expected: FAIL — `Failed to resolve import "./tabs.js"`

- [ ] **Step 3: Escribir `src/tabs.js`**

```js
/**
 * Pestañas con el patrón tablist de WAI-ARIA. No sabe qué hay adentro de
 * cada una: avisa cuál se eligió y el dueño decide qué dibujar. La usan la
 * fila de capas hijas y la de notas.
 */
export function createTabs({ container, items, onSelect }) {
  container.replaceChildren()
  if (!items.length) return { select: () => {}, destroy: () => container.replaceChildren() }

  const list = document.createElement('div')
  list.className = 'tabs'
  list.setAttribute('role', 'tablist')
  let active = null

  const buttons = items.map((item) => {
    const b = document.createElement('button')
    b.className = 'tab'
    b.type = 'button'
    b.setAttribute('role', 'tab')
    b.setAttribute('aria-selected', 'false')
    b.textContent = item.label
    if (item.badge) {
      const n = document.createElement('span')
      n.className = 'n'
      n.textContent = ` ${item.badge}`
      b.append(n)
    }
    b.addEventListener('click', () => select(item.key))
    list.append(b)
    return b
  })

  function select(key) {
    // Volver a la que ya está no vuelve a pedir la página.
    if (key === active) return
    active = key
    items.forEach((item, i) => buttons[i].setAttribute('aria-selected', String(item.key === key)))
    onSelect(key)
  }

  container.append(list)
  select(items[0].key)
  return { select, destroy: () => container.replaceChildren() }
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npx vitest run src/tabs.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/tabs.js src/tabs.test.js
git commit -m "feat: pestañas con ARIA, compartidas por la fila de hijos y la de notas"
```

---

## Task 9: `table.js` — tabla y paginador

**Files:**
- Create: `src/table.js`
- Test: `src/table.test.js`

**Interfaces:**
- Consumes: `specOf` de `columns.js`, `featureUrl` de `download.js`, `PAGE_SIZE` de `features.js`, `fmt`/`downloadButton` de `ui.js`
- Produces:
  - `renderTable(childKey, rows, onView): HTMLElement` — un `<div class="table-scroll">` con la `<table>` adentro
  - `renderPager({ page, total, onPage }): HTMLElement`

- [ ] **Step 1: Escribir el test que falla**

```js
// src/table.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderTable, renderPager } from './table.js'

const radios = [
  { cod_indec: '068400101', cro: '01', cfn: '01', tro: 'U' },
  { cod_indec: '068400102', cro: '02', cfn: '01', tro: 'R' },
]

describe('renderTable', () => {
  it('pone una columna por campo declarado, más la de acciones', () => {
    const t = renderTable('radios', radios, () => {})
    expect(t.querySelectorAll('thead th')).toHaveLength(5)
    expect(t.querySelector('thead th').textContent).toBe('Radio')
  })

  it('traduce urbano y rural en vez de mostrar la letra', () => {
    const t = renderTable('radios', radios, () => {})
    const filas = t.querySelectorAll('tbody tr')
    expect(filas[0].textContent).toContain('Urbano')
    expect(filas[1].textContent).toContain('Rural')
  })

  it('cada fila descarga por su código', () => {
    const t = renderTable('radios', radios, () => {})
    const href = t.querySelector('tbody tr a.btn').getAttribute('href')
    expect(href).toContain('CQL_FILTER=cod_indec%3D%27068400101%27')
  })

  it('Ver avisa con la fila entera', () => {
    const onView = vi.fn()
    const t = renderTable('radios', radios, onView)
    t.querySelectorAll('tbody tr button')[1].click()
    expect(onView).toHaveBeenCalledWith(radios[1])
  })

  it('sin filas dice que no hay nada, sin tabla vacía', () => {
    const t = renderTable('radios', [], () => {})
    expect(t.querySelector('table')).toBe(null)
    expect(t.textContent).toMatch(/no hay/i)
  })

  it('la tabla ancha scrollea sola', () => {
    expect(renderTable('vias', [], () => {}).className).toContain('table-scroll')
  })
})

describe('renderPager', () => {
  it('en la primera página no deja retroceder', () => {
    const p = renderPager({ page: 0, total: 432, onPage: () => {} })
    const [prev, next] = p.querySelectorAll('button')
    expect(prev.disabled).toBe(true)
    expect(next.disabled).toBe(false)
    expect(p.textContent).toContain('1–20 de 432')
  })

  it('en la última no deja avanzar', () => {
    const p = renderPager({ page: 21, total: 432, onPage: () => {} })
    const [prev, next] = p.querySelectorAll('button')
    expect(prev.disabled).toBe(false)
    expect(next.disabled).toBe(true)
    expect(p.textContent).toContain('421–432 de 432')
  })

  it('con una sola página no deja ir a ningún lado', () => {
    const p = renderPager({ page: 0, total: 1, onPage: () => {} })
    for (const b of p.querySelectorAll('button')) expect(b.disabled).toBe(true)
  })

  it('avisa a qué página ir', () => {
    const onPage = vi.fn()
    const p = renderPager({ page: 2, total: 432, onPage })
    p.querySelectorAll('button')[1].click()
    expect(onPage).toHaveBeenCalledWith(3)
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/table.test.js`
Expected: FAIL — `Failed to resolve import "./table.js"`

- [ ] **Step 3: Escribir `src/table.js`**

```js
import { specOf } from './columns.js'
import { featureUrl } from './download.js'
import { PAGE_SIZE } from './features.js'
import { fmt, downloadButton } from './ui.js'

/** La tabla de una página de hijos. Recibe las filas ya traídas. */
export function renderTable(childKey, rows, onView) {
  const wrap = document.createElement('div')
  wrap.className = 'table-scroll'

  if (!rows.length) {
    const vacio = document.createElement('p')
    vacio.className = 'meta'
    vacio.textContent = 'No hay objetos de esta capa.'
    wrap.append(vacio)
    return wrap
  }

  const spec = specOf(childKey)
  const table = document.createElement('table')
  if (spec.columns.length > 8) table.className = 'wide'

  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const col of spec.columns) {
    const th = document.createElement('th')
    th.textContent = col.label
    headRow.append(th)
  }
  headRow.append(document.createElement('th'))
  thead.append(headRow)

  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    for (const col of spec.columns) {
      const td = document.createElement('td')
      if (col.kind !== 'text') td.className = col.kind
      const raw = row[col.field] ?? ''
      td.textContent = col.map ? col.map(String(raw)) : String(raw)
      tr.append(td)
    }

    const acts = document.createElement('td')
    acts.className = 'acts'
    const ver = document.createElement('button')
    ver.type = 'button'
    ver.className = 'btn ghost mini'
    ver.textContent = 'Ver'
    ver.addEventListener('click', () => onView(row))
    acts.append(ver, downloadButton(featureUrl(childKey, String(row[spec.idField])), 'Descargar'))
    acts.querySelector('a').classList.add('mini')
    tr.append(acts)
    tbody.append(tr)
  }

  table.append(thead, tbody)
  wrap.append(table)
  return wrap
}

/** Anterior / dónde estoy / siguiente. El total lo manda el servidor. */
export function renderPager({ page, total, onPage }) {
  const wrap = document.createElement('div')
  wrap.className = 'pager'
  const last = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)
  const desde = total === 0 ? 0 : page * PAGE_SIZE + 1
  const hasta = Math.min(total, (page + 1) * PAGE_SIZE)

  const prev = document.createElement('button')
  prev.type = 'button'
  prev.textContent = 'Anterior'
  prev.disabled = page <= 0
  prev.addEventListener('click', () => onPage(page - 1))

  const donde = document.createElement('span')
  donde.className = 'where'
  donde.textContent = `${fmt(desde)}–${fmt(hasta)} de ${fmt(total)}`

  const next = document.createElement('button')
  next.type = 'button'
  next.textContent = 'Siguiente'
  next.disabled = page >= last
  next.addEventListener('click', () => onPage(page + 1))

  wrap.append(prev, donde, next)
  return wrap
}
```

Agregar a `src/style.css` las reglas de `.tabs`, `.tab`, `.table-scroll`, `table`, `.pager` y la columna fija de `.wide` — copiarlas del mock publicado, que ya usa los tokens del sitio.

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npx vitest run src/table.test.js`
Expected: PASS, 10 tests

- [ ] **Step 5: Commit**

```bash
git add src/table.js src/table.test.js src/style.css
git commit -m "feat: tabla y paginador de objetos hijos"
```

---

## Task 10: `browser.js` y el cableado de la fila 3

**Files:**
- Create: `src/browser.js`
- Modify: `src/main.js`
- Modify: `src/map.js` (si hace falta un punto de entrada para dibujar un feature suelto)
- Test: `src/browser.test.js`, `src/main.test.js`

**Interfaces:**
- Consumes: `createTabs`, `fetchPage`, `renderTable`, `renderPager`, `childrenOf`, `CHILD_LAYERS`
- Produces: `createBrowser({ container, onView, onError }): { show(obj), clear() }`

- [ ] **Step 1: Escribir el test que falla**

```js
// src/browser.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBrowser } from './browser.js'

const dep = {
  t: 'dep', c: '06840', n: 'Tres de Febrero',
  ch: { fracciones: 42, radios: 432 },
}

let container
const filas = (n, desde = 0) => Array.from({ length: n }, (_, i) => ({
  cod_indec: String(68400101 + desde + i), cro: '01', cfn: '01', tro: 'U',
}))

beforeEach(() => {
  document.body.innerHTML = '<div id="c"></div>'
  container = document.querySelector('#c')
})

describe('createBrowser', () => {
  it('dibuja una pestaña por capa hija y carga la primera', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ totalFeatures: 42, features: filas(20).map((p) => ({ properties: p })) }) }))
    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show(dep)
    await vi.waitFor(() => expect(container.querySelector('tbody')).not.toBe(null))
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('pasar de página pide la página siguiente', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ totalFeatures: 42, features: filas(20).map((p) => ({ properties: p })) }) }))
    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show(dep)
    await vi.waitFor(() => expect(container.querySelector('.pager')).not.toBe(null))
    container.querySelectorAll('.pager button')[1].click()
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(global.fetch.mock.calls[1][0]).toContain('startIndex=20')
  })

  // La carrera más fácil de provocar: cambiar de pestaña con un pedido en
  // vuelo. La respuesta vieja no puede pisar a la nueva.
  it('descarta la respuesta de una pestaña que ya se abandonó', async () => {
    let resolverPrimero
    global.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => { resolverPrimero = r }))
      .mockImplementationOnce(async () => ({ ok: true, json: async () => ({ totalFeatures: 1, features: [{ properties: { cod_indec: '999', cro: '99', cfn: '99', tro: 'R' } }] }) }))

    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show(dep)
    container.querySelectorAll('[role="tab"]')[1].click()
    await vi.waitFor(() => expect(container.textContent).toContain('999'))

    resolverPrimero({ ok: true, json: async () => ({ totalFeatures: 42, features: filas(20).map((p) => ({ properties: p })) }) })
    await new Promise((r) => setTimeout(r, 0))
    expect(container.textContent).toContain('999')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  it('un error del GeoServer se muestra en el lugar de la tabla, con reintento', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 503 }))
    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show(dep)
    await vi.waitFor(() => expect(container.textContent).toMatch(/503/))
    expect(container.querySelector('button.retry')).not.toBe(null)
  })

  it('un objeto sin hijos no dibuja nada', () => {
    const b = createBrowser({ container, onView: () => {}, onError: () => {} })
    b.show({ t: 'gl', c: '060840', n: 'x' })
    expect(container.children).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/browser.test.js`
Expected: FAIL — `Failed to resolve import "./browser.js"`

- [ ] **Step 3: Escribir `src/browser.js`**

```js
import { createTabs } from './tabs.js'
import { fetchPage } from './features.js'
import { renderTable, renderPager } from './table.js'
import { childrenOf } from './catalog.js'
import { CHILD_LAYERS } from './download.js'
import { fmt } from './ui.js'

/**
 * La fila que se recorre: una pestaña por capa hija, y adentro la página que
 * se esté mirando. Guarda qué pestaña está activa, en qué página va cada una
 * y cuál fue el último pedido, para que una respuesta lenta de una pestaña
 * abandonada no pise a la que el usuario está mirando.
 */
export function createBrowser({ container, onView, onError }) {
  let obj = null
  let active = null
  let pages = new Map()
  let token = 0
  let body = null

  function show(next) {
    obj = next
    active = null
    pages = new Map()
    token += 1
    container.replaceChildren()

    const kids = childrenOf(obj)
    if (!kids.length) return

    const tabsBox = document.createElement('div')
    body = document.createElement('div')
    body.className = 'pane'
    container.append(tabsBox, body)

    createTabs({
      container: tabsBox,
      items: kids.map(({ key, count }) => ({
        key, label: CHILD_LAYERS[key].label, badge: fmt(count),
      })),
      onSelect: (key) => {
        active = key
        load(key, pages.get(key) ?? 0)
      },
    })
  }

  async function load(key, page) {
    const mine = (token += 1)
    pages.set(key, page)
    body.replaceChildren(estado('Cargando…'))
    try {
      const { rows, total } = await fetchPage(obj, key, page)
      // Llegó tarde: el usuario ya está en otra pestaña o en otra página.
      if (mine !== token || key !== active) return
      body.replaceChildren(
        renderTable(key, rows, onView),
        renderPager({ page, total, onPage: (p) => load(key, p) }),
      )
    } catch (err) {
      if (mine !== token || key !== active) return
      body.replaceChildren(errorBox(err, () => load(key, page)))
      onError(err)
    }
  }

  function estado(texto) {
    const p = document.createElement('p')
    p.className = 'meta'
    p.textContent = texto
    return p
  }

  function errorBox(err, retry) {
    const wrap = document.createElement('div')
    const p = document.createElement('p')
    p.className = 'status error'
    p.textContent = `No se pudo traer la lista: ${err.message}`
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'btn ghost mini retry'
    b.textContent = 'Reintentar'
    b.addEventListener('click', retry)
    wrap.append(p, b)
    return wrap
  }

  return { show, clear: () => container.replaceChildren() }
}
```

- [ ] **Step 4: Cablearlo en `main.js`**

```js
import { createBrowser } from './browser.js'
import { specOf } from './columns.js'
import { showFeature } from './map.js'

const browser = createBrowser({
  container: el.browse,
  onView: (row) => {
    const key = /* la capa de la pestaña activa */ browserActiveKey
    showFeature(CHILD_LAYERS[key].layer, specOf(key).idField, String(row[specOf(key).idField]))
      .catch((err) => setStatus(`No se pudo dibujar en el mapa: ${err.message}`, true))
  },
  onError: () => {},
})
```

Para no tener que exportar la pestaña activa, hacé que `browser.js` pase la capa como segundo argumento: `onView(row, childKey)`. Ajustá el test de `browser.test.js` en consecuencia (`expect(onView).toHaveBeenCalledWith(radios[1], 'radios')`) antes de implementarlo.

En `selectObject`, llamar `browser.show(obj)` y `el.rowBrowse.hidden = childrenOf(obj).length === 0`.

En `src/map.js`, agregar `showFeature(layer, field, code)`: es lo mismo que `showObject` pero con un `CQL_FILTER` armado con esos tres datos en vez de con el tipo del objeto. Leé `showObject` y extraé la parte común en vez de duplicarla.

- [ ] **Step 5: Test de integración en `main.test.js`**

```js
describe('recorrer los hijos', () => {
  it('abre la pestaña, lista la página y descarga una fila', async () => {
    buscar('tres')
    $('#results').children[0].click()
    await vi.waitFor(() => expect($('#browse tbody')).not.toBe(null))
    expect($('#row-browse').hidden).toBe(false)
    const href = $('#browse tbody tr a.btn').getAttribute('href')
    expect(href).toContain('outputFormat=geopackage')
  })
})
```

El `global.fetch` del `beforeEach` de ese archivo ya devuelve `{ features: [{ properties: {} }] }` para lo que no es el catálogo; hay que darle propiedades de verdad para que la tabla tenga qué mostrar.

- [ ] **Step 6: Correr toda la suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Verificar en un browser real**

Levantar `npx vite --port 5199 --strictPort`, buscar "Tres de Febrero", elegir el departamento, y confirmar: cuatro pestañas con sus conteos, la tabla de fracciones cargada, pasar de página, la de vías scrolleando a lo ancho con 21 columnas, y "Ver" dibujando ese radio en el mapa.

- [ ] **Step 8: Commit**

```bash
git add src/browser.js src/browser.test.js src/main.js src/main.test.js src/map.js src/map.test.js
git commit -m "feat: la fila de hijos se recorre paginada y se ve en el mapa"
```

---

# ETAPA 3 — notas

## Task 11: `notes.js` y la fila 4

**Files:**
- Create: `src/notes.js`
- Test: `src/notes.test.js`
- Modify: `src/main.js`, `src/main.test.js`

**Interfaces:**
- Produces:
  - `NOTES` — `[{ key, label, paragraphs: string[] }]`
  - `notesFor(obj): Note[]` — las que aplican a las capas hijas de ese objeto

- [ ] **Step 1: Escribir el test que falla**

```js
// src/notes.test.js
import { describe, it, expect } from 'vitest'
import { NOTES, notesFor } from './notes.js'
import { CHILD_LAYERS } from './download.js'

describe('NOTES', () => {
  it('cada nota apunta a una capa que existe', () => {
    for (const nota of NOTES) {
      expect(Object.keys(CHILD_LAYERS), nota.key).toContain(nota.key)
    }
  })

  it('ninguna nota está vacía', () => {
    for (const nota of NOTES) {
      expect(nota.paragraphs.length, nota.key).toBeGreaterThan(0)
      expect(nota.label, nota.key).toBeTruthy()
    }
  })

  it('la nota de vías dice que la descarga trae la calle entera', () => {
    const vias = NOTES.find((n) => n.key === 'vias')
    expect(vias.paragraphs.join(' ')).toMatch(/calle entera/i)
  })

  it('la nota de localidades usa el ejemplo de Avellaneda', () => {
    const loc = NOTES.find((n) => n.key === 'localidades')
    expect(loc.paragraphs.join(' ')).toContain('Avellaneda')
  })
})

describe('notesFor', () => {
  it('trae sólo las notas de las capas que el objeto tiene', () => {
    const dep = { t: 'dep', c: '06840', ch: { radios: 432, vias: 1487, localidades: 1 } }
    expect(notesFor(dep).map((n) => n.key).sort()).toEqual(['localidades', 'vias'])
  })

  it('un objeto sin capas con nota no trae ninguna', () => {
    expect(notesFor({ t: 'dep', c: '1', ch: { radios: 10 } })).toEqual([])
  })

  it('un objeto sin hijos no trae ninguna', () => {
    expect(notesFor({ t: 'gl', c: '060840' })).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/notes.test.js`
Expected: FAIL — `Failed to resolve import "./notes.js"`

- [ ] **Step 3: Escribir `src/notes.js`**

```js
import { childrenOf } from './catalog.js'

/**
 * Aclaraciones sobre la cartografía del INDEC, atadas a la capa donde
 * confunden. Viven acá y no en el HTML porque son contenido que va a crecer
 * y porque un test tiene que poder citarlas.
 *
 * Los datos de la nota de localidades están verificados contra el GeoServer:
 * las tres Avellaneda existen, con el mismo `nam` y `fna` distinto.
 */
export const NOTES = [
  {
    key: 'vias',
    label: 'Vías de circulación',
    paragraphs: [
      'Esta capa no lista calles: lista tramos. Una misma calle aparece tantas veces como tramos tenga su geometría, y todos comparten nombre, código y altura. En Tres de Febrero, las 1.487 filas son 727 calles; la más partida llega a 80 tramos.',
      'Se muestra tal como lo publica el INDEC, sin agrupar, para que lo que ves acá sea lo mismo que baja el archivo. Descargar en cualquier fila de una calle trae la calle entera, con todos sus tramos: el filtro es por código, no por tramo.',
    ],
  },
  {
    key: 'localidades',
    label: 'Localidad censal',
    paragraphs: [
      '«Localidad censal» no es lo que en la conversación diaria se llama localidad. Es una unidad del Marco Geoestadístico y a menudo no coincide con el municipio ni con el partido del mismo nombre.',
      'Buscando Avellaneda, el INDEC publica tres objetos distintos con el mismo nombre y límites diferentes: «Partido de Avellaneda» (departamento, 06035), «Municipio Avellaneda» (gobierno local, 060035) y «Localidad Avellaneda» (localidad censal, 06035010, dentro del aglomerado Gran Buenos Aires). Quien dice «la localidad de Avellaneda» casi siempre se refiere al partido o al municipio.',
      'Al revés también pasa: Tres de Febrero sí existe como localidad censal, además de como partido y como municipio. Por eso cada resultado del buscador muestra su tipo al lado: es lo que decide qué límites vas a bajar.',
    ],
  },
]

/** Las notas que le corresponden a un objeto, por las capas que tiene. */
export function notesFor(obj) {
  const keys = new Set(childrenOf(obj).map((c) => c.key))
  return NOTES.filter((n) => keys.has(n.key))
}
```

- [ ] **Step 4: Cablear la fila 4 en `main.js`**

```js
import { createTabs } from './tabs.js'
import { notesFor } from './notes.js'

function renderNotes(obj) {
  const notes = notesFor(obj)
  el.rowNotes.hidden = notes.length === 0
  el.notes.replaceChildren()
  if (!notes.length) return

  const tabsBox = document.createElement('div')
  const body = document.createElement('div')
  body.className = 'pane nota-body'
  el.notes.append(tabsBox, body)

  createTabs({
    container: tabsBox,
    items: notes.map((n) => ({ key: n.key, label: n.label })),
    onSelect: (key) => {
      const nota = notes.find((n) => n.key === key)
      body.replaceChildren(...nota.paragraphs.map((t) => {
        const p = document.createElement('p')
        p.textContent = t
        return p
      }))
    },
  })
}
```

Llamarla en `selectObject`, y agregar `notes: document.querySelector('#notes')` a `el`.

En `src/style.css`: `.nota-body { max-width: 72ch; } .nota-body p { margin: 0 0 .7rem; }`.

- [ ] **Step 5: Test de integración**

```js
// en src/main.test.js
it('la fila de notas aparece con las notas que corresponden', () => {
  buscar('tres')
  $('#results').children[0].click()
  expect($('#row-notes').hidden).toBe(false)
  expect($('#notes').textContent).toMatch(/tramos/)
})
```

La fixture `catalogo` de `main.test.js` tiene que darle al departamento `vias` en su `ch` para que la nota aplique.

- [ ] **Step 6: Correr toda la suite y verla pasar**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/notes.js src/notes.test.js src/main.js src/main.test.js src/style.css
git commit -m "feat: fila de notas sobre las trampas de la cartografía del INDEC"
```

---

## Task 12: las reglas de producto

**Files:**
- Modify: `docs/reglas/descargas.md`
- Create: `docs/reglas/navegacion.md`
- Modify: `docs/reglas/README.md`
- Modify: `README.md`

Este repo **no tiene el aparato de reglas** (no hay `bin/reglas-index.php` ni gate de citas): los archivos se escriben a mano y el índice del README también. No busques el generador.

- [ ] **Step 1: Reescribir `descargas.md`**

- **DES-R1** pasa a: no hay tope de features; la descarga se ofrece siempre. El **por qué** lleva los números medidos: peor caso 179.029 vías → 74 MB en 37 s, HTTP 200; el `.gpkg` de 23.901 radios se abrió y tiene 23.901 filas; el `CountDefault` del GeoServer es 1.000.000.
- **DES-R2** pasa a: superar los 10 MB estimados muestra un aviso de peso y espera al lado del botón, que sigue habilitado. Conservar el **por qué** original —una descarga parcial silenciosa es peor que no descargar— y agregar que ahora lo garantiza el `CountDefault`.
- **DES-R3** (conteo cero deshabilita) queda igual.
- **DES-R4** (GPKG en 4326) queda igual.
- **DES-R5** se tacha: `~~**DES-R5**~~`, con la celda de estado nombrando que muere junto con el tope. No borrarla: el repo documenta las reglas muertas, no las desaparece.
- **DES-R6**, **DES-R7**, **DES-R8** quedan igual.
- **DES-R9** nueva: la descarga de un objeto hijo suelto filtra por el campo identificador de su capa, y en vías eso baja la calle entera y no el tramo de la fila.
- **DES-R10** nueva: se ofrece la cadena de padres completa, y sólo los padres que existen en el catálogo (cita DES-R8).

- [ ] **Step 2: Escribir `docs/reglas/navegacion.md`**

Prefijo `NAV-`, mismo formato que `descargas.md` (`## ✅ Reglas`, `### NAV-Rn — título`, `**Por qué:**`):

- **NAV-R1** — Las capas hijas se recorren paginadas contra el GeoServer, 20 por página, sin geometría. *Por qué:* el catálogo tiene conteos, no objetos; una página pesa 3,1 KB y cuesta lo mismo en un partido que en una provincia.
- **NAV-R2** — Una pestaña carga su primera página al abrirse, no antes. *Por qué:* abrir una ficha no tiene por qué disparar cuatro pedidos al GeoServer.
- **NAV-R3** — Vías se lista por tramo, con los 21 campos publicados, sin agrupar. *Por qué:* agrupar exige bajar 3,9 MB en una provincia y WFS no agrupa en el servidor; y lo que se ve tiene que ser lo que baja.
- **NAV-R4** — Fracciones y radios se listan sin nombre. *Por qué:* el INDEC no publica ninguno; inventar un rótulo sería inventar un dato.
- **NAV-R5** — La respuesta de una pestaña abandonada se descarta. *Por qué:* es la carrera más fácil de provocar y el síntoma es la tabla equivocada bajo la pestaña correcta.
- **NAV-R6** — La fila de notas aparece sólo si el objeto tiene alguna nota. *Por qué:* una sección vacía enseña a ignorarla.

- [ ] **Step 3: Actualizar los índices**

Agregar a la tabla de `docs/reglas/README.md`:

```markdown
| [navegacion](navegacion.md) | NAV-R1 … NAV-R6 |
```

Y en el `README.md` raíz, actualizar la sección "Estado": ya no hay tope, y las capas hijas se recorren.

- [ ] **Step 4: Verificar que nada quedó apuntando a la regla muerta**

```bash
grep -rn "DES-R5\|maxFeatures\|canDownload" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . | grep -v "docs/reglas/descargas.md"
```
Expected: sólo menciones en las specs viejas, que son registro histórico y no se tocan. Si aparece código o un test vivo, arreglarlo.

- [ ] **Step 5: Commit**

```bash
git add docs/reglas README.md
git commit -m "docs: las reglas de descargas y navegación después de sacar el tope"
```

---

## Self-review de este plan

- **Cobertura de la spec:** cada sección tiene tarea. Fila 1 y 2 → tareas 2–5. Fila 3 → tareas 1, 6–10. Fila 4 → tarea 11. Tope → tarea 2. `ag` en el build → tarea 3. Reglas → tarea 12.
- **Sin placeholders:** cada paso trae el código o el comando concreto. Las dos excepciones deliberadas están marcadas: en la tarea 3 hay que mirar las fixtures reales de `aggregate.test.mjs` antes de escribir el test, y en la tarea 10 hay que leer `showObject` antes de extraer `showFeature`. Las dos dicen exactamente qué mirar y por qué.
- **Consistencia de nombres:** `specOf`/`queryFields` (tarea 1) se usan igual en 6, 7 y 9. `PAGE_SIZE` se define en 7 y se consume en 9. `featureUrl(childKey, code)` se define en 6 y se usa en 9. `onView(row, childKey)` queda con dos argumentos desde la tarea 10, y el paso 4 de esa tarea lo dice explícitamente antes de implementarlo.
