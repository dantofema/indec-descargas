# indec-descargas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un sitio estático donde el usuario escribe el nombre de un objeto del Marco Geoestadístico Nacional, lo ve en un mapa y descarga ese objeto o sus hijos en GeoPackage.

**Architecture:** Dos tiempos. En *build* (Node, a mano) un script vuelca columnas clave del GeoServer del INDEC, agrega los conteos de hijos y escribe `public/catalog.json`. En *runtime* el browser carga ese catálogo una vez y resuelve búsqueda, jerarquía y tope sin red; el GeoServer se toca sólo para dibujar el objeto y para descargar, con un `<a href>` directo.

**Tech Stack:** Vite 6, JavaScript sin framework, Leaflet 1.9, Vitest 2, `csv-parse` (sólo build). GitHub Pages vía Actions.

**Spec:** `docs/superpowers/specs/2026-09-04-indec-descargas-design.md`

## Global Constraints

- Todo el código en inglés; los textos de interfaz y los mensajes al usuario en español.
- Módulos ES (`type: "module"` en `package.json`). Sin TypeScript.
- Endpoint único: `https://geonode.indec.gob.ar/geoserver/ows`. No hay backend propio.
- Toda descarga pide `srsName=EPSG:4326` y `outputFormat=geopackage`.
- `maxFeatures` vale **5000** y vive en `catalog.json`, nunca hardcodeado en `src/`.
- Los códigos (`cpr`, `cde`, `clc`, `cmu`, `codaglo`) son cadenas de sólo dígitos con ceros a la izquierda significativos. Nunca convertirlos a número.
- `"N/A"` es un centinela de ausencia en `codaglo` y `cmu`. Nunca contarlo como código.
- Los CSV del GeoServer traen columnas `FID` y `fid` no pedidas, y **no** respetan el orden de `propertyName`. Leer siempre por nombre de encabezado.
- `base` de Vite es `/indec-descargas/` (GitHub Pages sirve el proyecto en un subdirectorio).

## Tipos de objeto y su campo de filtro

Esta tabla se repite en el código como constante y gobierna todo el plan:

| `t` | Capa propia | Campo de filtro | Hijos (claves de `ch`) |
|---|---|---|---|
| `jur` | `geonode:jurisdicciones` | `cpr` | `departamentos`, `fracciones`, `radios`, `localidades`, `vias` |
| `dep` | `geonode:departamentos` | `cde` | `fracciones`, `radios`, `localidades`, `vias` |
| `aglo` | `geonode:aglomerados` | `codaglo` | `localidades`, `vias` |
| `loc` | `geonode:localidades_censales` | `clc` | `vias` |
| `gl` | `geonode:gobiernos_locales4` | `cmu` | (ninguno) |

Regla uniforme: **para filtrar un hijo se usa el campo de filtro del padre.** Un departamento filtra sus radios con `cde='06840'`; una jurisdicción filtra los suyos con `cpr='06'`.

---

### Task 1: Scaffolding del proyecto y `search.js`

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `src/search.js`
- Test: `src/search.test.js`

**Interfaces:**
- Consumes: nada
- Produces:
  - `normalize(text: string): string` — minúsculas, sin acentos, espacios colapsados, sin bordes
  - `TYPE_ORDER: string[]` — `['jur','dep','loc','gl','aglo']`
  - `search(objects: Object[], query: string, limit?: number): Object[]` — `limit` por defecto 20

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "indec-descargas",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "build:index": "node scripts/build-index.mjs"
  },
  "dependencies": {
    "leaflet": "^1.9.4"
  },
  "devDependencies": {
    "csv-parse": "^5.5.6",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Crear `vite.config.js`**

`base` tiene que coincidir con el nombre del repo o GitHub Pages devuelve 404 en todos los assets.

```js
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/indec-descargas/',
  build: { outDir: 'dist' },
})
```

- [ ] **Step 3: Instalar dependencias**

Run: `npm install`
Expected: crea `node_modules/` y `package-lock.json` sin errores.

- [ ] **Step 4: Escribir el test que falla**

Create `src/search.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { normalize, search } from './search.js'

const objects = [
  { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires' },
  { t: 'loc', c: '06840010', n: 'Caseros', s: 'caseros', p: 'Buenos Aires' },
  { t: 'dep', c: '82084', n: 'Rosario', s: 'rosario', p: 'Santa Fe' },
  { t: 'jur', c: '06', n: 'Buenos Aires', s: 'buenos aires', p: 'Buenos Aires' },
  { t: 'gl', c: '060840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires' },
]

describe('normalize', () => {
  it('pasa a minúsculas', () => {
    expect(normalize('Tres De Febrero')).toBe('tres de febrero')
  })

  it('saca acentos y diéresis', () => {
    expect(normalize('Neuquén')).toBe('neuquen')
    expect(normalize('Río Negro')).toBe('rio negro')
    expect(normalize('Güer Aike')).toBe('guer aike')
  })

  it('colapsa espacios internos y recorta los bordes', () => {
    expect(normalize('  Tres   de  Febrero ')).toBe('tres de febrero')
  })

  it('sobrevive a entradas vacías o nulas', () => {
    expect(normalize('')).toBe('')
    expect(normalize(null)).toBe('')
    expect(normalize(undefined)).toBe('')
  })
})

describe('search', () => {
  it('encuentra por prefijo parcial', () => {
    const r = search(objects, 'Tres de Febr')
    expect(r.map((o) => o.c)).toContain('06840')
  })

  it('ignora acentos en la consulta', () => {
    const r = search([{ t: 'jur', c: '58', n: 'Neuquén', s: 'neuquen' }], 'neuquén')
    expect(r).toHaveLength(1)
  })

  it('pone los prefijos antes que las coincidencias internas', () => {
    const objs = [
      { t: 'dep', c: '1', n: 'Villa Rosario', s: 'villa rosario' },
      { t: 'dep', c: '2', n: 'Rosario', s: 'rosario' },
    ]
    expect(search(objs, 'rosario').map((o) => o.c)).toEqual(['2', '1'])
  })

  it('ordena por tipo dentro del mismo grupo de coincidencia', () => {
    const r = search(objects, 'tres de febrero')
    expect(r.map((o) => o.t)).toEqual(['dep', 'gl'])
  })

  it('devuelve vacío para consulta vacía o de un solo carácter', () => {
    expect(search(objects, '')).toEqual([])
    expect(search(objects, '  ')).toEqual([])
    expect(search(objects, 'a')).toEqual([])
  })

  it('respeta el tope de resultados', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      t: 'dep', c: String(i), n: `Rosario ${i}`, s: `rosario ${i}`,
    }))
    expect(search(many, 'rosario')).toHaveLength(20)
    expect(search(many, 'rosario', 5)).toHaveLength(5)
  })
})
```

- [ ] **Step 5: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./search.js"`.

- [ ] **Step 6: Implementar `src/search.js`**

```js
/** Orden de presentación de los tipos de objeto en los resultados. */
export const TYPE_ORDER = ['jur', 'dep', 'loc', 'gl', 'aglo']

/**
 * Pasa un texto a la forma con la que se comparan nombres:
 * minúsculas, sin acentos, con los espacios colapsados.
 */
export function normalize(text) {
  if (!text) return ''
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Busca por substring sobre la clave normalizada `s`, que ya viene
 * calculada del build. Devuelve primero los que empiezan con la consulta.
 */
export function search(objects, query, limit = 20) {
  const q = normalize(query)
  if (q.length < 2) return []

  const matches = []
  for (const obj of objects) {
    const at = obj.s.indexOf(q)
    if (at === -1) continue
    matches.push({ obj, prefix: at === 0 ? 0 : 1 })
  }

  matches.sort((a, b) => {
    if (a.prefix !== b.prefix) return a.prefix - b.prefix
    const ta = TYPE_ORDER.indexOf(a.obj.t)
    const tb = TYPE_ORDER.indexOf(b.obj.t)
    if (ta !== tb) return ta - tb
    return a.obj.s.localeCompare(b.obj.s)
  })

  return matches.slice(0, limit).map((m) => m.obj)
}
```

- [ ] **Step 7: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 10 tests.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.js src/search.js src/search.test.js
git commit -m "feat: scaffolding con Vite y búsqueda por nombre normalizado"
```

---

### Task 2: `download.js` — URLs del GeoServer y decisión del tope

**Files:**
- Create: `src/download.js`
- Test: `src/download.test.js`

**Interfaces:**
- Consumes: nada
- Produces:
  - `GEOSERVER: string`
  - `TYPES: Record<string, {layer: string, field: string, label: string}>` — clave por `t`
  - `CHILD_LAYERS: Record<string, {layer: string, label: string}>` — clave por nombre de hijo
  - `selfUrl(obj, format?): string` — descarga del objeto mismo; `format` por defecto `'geopackage'`
  - `childUrl(obj, childKey, format?): string` — descarga de una capa hija
  - `canDownload(count, maxFeatures): boolean`
  - `filename(obj, childKey?): string`

- [ ] **Step 1: Escribir el test que falla**

Create `src/download.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { selfUrl, childUrl, canDownload, filename, GEOSERVER } from './download.js'

const treFeb = { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero' }
const buenosAires = { t: 'jur', c: '06', n: 'Buenos Aires', s: 'buenos aires' }

/** Devuelve los parámetros de una URL como objeto plano. */
function params(url) {
  return Object.fromEntries(new URL(url).searchParams)
}

describe('selfUrl', () => {
  it('apunta al GeoServer del INDEC', () => {
    expect(selfUrl(treFeb).startsWith(GEOSERVER)).toBe(true)
  })

  it('pide el objeto en su propia capa filtrando por su campo', () => {
    const p = params(selfUrl(treFeb))
    expect(p.typenames).toBe('geonode:departamentos')
    expect(p.CQL_FILTER).toBe("cde='06840'")
  })

  it('pide siempre GPKG en EPSG:4326', () => {
    const p = params(selfUrl(treFeb))
    expect(p.outputFormat).toBe('geopackage')
    expect(p.srsName).toBe('EPSG:4326')
    expect(p.service).toBe('WFS')
    expect(p.version).toBe('2.0.0')
    expect(p.request).toBe('GetFeature')
  })

  it('acepta otro formato para el dibujo del mapa', () => {
    expect(params(selfUrl(treFeb, 'application/json')).outputFormat).toBe('application/json')
  })

  it('conserva los ceros a la izquierda del código', () => {
    expect(params(selfUrl(buenosAires)).CQL_FILTER).toBe("cpr='06'")
  })
})

describe('childUrl', () => {
  it('filtra la capa hija por el campo del padre', () => {
    const p = params(childUrl(treFeb, 'radios'))
    expect(p.typenames).toBe('geonode:radios_censales2')
    expect(p.CQL_FILTER).toBe("cde='06840'")
  })

  it('una jurisdicción filtra a sus hijos por cpr', () => {
    const p = params(childUrl(buenosAires, 'departamentos'))
    expect(p.typenames).toBe('geonode:departamentos')
    expect(p.CQL_FILTER).toBe("cpr='06'")
  })

  it('un aglomerado filtra sus localidades por codaglo', () => {
    const aglo = { t: 'aglo', c: '0043', n: 'San Francisco - Frontera', s: 'san francisco - frontera' }
    expect(params(childUrl(aglo, 'localidades')).CQL_FILTER).toBe("codaglo='0043'")
  })

  it('rechaza una capa hija desconocida', () => {
    expect(() => childUrl(treFeb, 'inventada')).toThrow(/capa hija/i)
  })
})

describe('validación de códigos', () => {
  it('rechaza un código que no sea sólo dígitos', () => {
    const malicioso = { t: 'dep', c: "06840' OR '1'='1", n: 'x', s: 'x' }
    expect(() => selfUrl(malicioso)).toThrow(/código/i)
  })

  it('rechaza un tipo desconocido', () => {
    expect(() => selfUrl({ t: 'zzz', c: '06', n: 'x', s: 'x' })).toThrow(/tipo/i)
  })
})

describe('canDownload', () => {
  it('habilita por debajo del tope', () => {
    expect(canDownload(4999, 5000)).toBe(true)
  })

  it('habilita justo en el tope', () => {
    expect(canDownload(5000, 5000)).toBe(true)
  })

  it('bloquea por encima del tope', () => {
    expect(canDownload(5001, 5000)).toBe(false)
  })

  it('bloquea cuando no hay nada que bajar', () => {
    expect(canDownload(0, 5000)).toBe(false)
  })

  it('bloquea si el conteo falta', () => {
    expect(canDownload(undefined, 5000)).toBe(false)
  })
})

describe('filename', () => {
  it('nombra la descarga del objeto', () => {
    expect(filename(treFeb)).toBe('departamentos-06840.gpkg')
  })

  it('nombra la descarga de una capa hija', () => {
    expect(filename(treFeb, 'radios')).toBe('radios-de-departamentos-06840.gpkg')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./download.js"`.

- [ ] **Step 3: Implementar `src/download.js`**

```js
export const GEOSERVER = 'https://geonode.indec.gob.ar/geoserver/ows'

/** Capa propia y campo de filtro de cada tipo de objeto buscable. */
export const TYPES = {
  jur:  { layer: 'geonode:jurisdicciones',        field: 'cpr',     label: 'Jurisdicción' },
  dep:  { layer: 'geonode:departamentos',         field: 'cde',     label: 'Departamento' },
  loc:  { layer: 'geonode:localidades_censales',  field: 'clc',     label: 'Localidad censal' },
  gl:   { layer: 'geonode:gobiernos_locales4',    field: 'cmu',     label: 'Gobierno local' },
  aglo: { layer: 'geonode:aglomerados',           field: 'codaglo', label: 'Aglomerado' },
}

/** Capas que un objeto puede ofrecer como hijas. */
export const CHILD_LAYERS = {
  departamentos: { layer: 'geonode:departamentos',        label: 'Departamentos' },
  fracciones:    { layer: 'geonode:fracciones_censales',  label: 'Fracciones censales' },
  radios:        { layer: 'geonode:radios_censales2',     label: 'Radios censales' },
  localidades:   { layer: 'geonode:localidades_censales', label: 'Localidades censales' },
  vias:          { layer: 'geonode:vias_de_circulacion',  label: 'Vías de circulación' },
}

/**
 * Los códigos del INDEC son siempre dígitos con ceros a la izquierda.
 * Validarlos acá evita interpolar cualquier otra cosa dentro del CQL.
 */
function assertCode(code) {
  if (typeof code !== 'string' || !/^\d+$/.test(code)) {
    throw new Error(`código inválido: ${JSON.stringify(code)}`)
  }
  return code
}

function typeOf(obj) {
  const type = TYPES[obj?.t]
  if (!type) throw new Error(`tipo de objeto desconocido: ${JSON.stringify(obj?.t)}`)
  return type
}

function wfsUrl(typename, cql, format) {
  const p = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typenames: typename,
    outputFormat: format,
    srsName: 'EPSG:4326',
    CQL_FILTER: cql,
  })
  return `${GEOSERVER}?${p}`
}

/** URL de descarga del objeto en sí. */
export function selfUrl(obj, format = 'geopackage') {
  const type = typeOf(obj)
  return wfsUrl(type.layer, `${type.field}='${assertCode(obj.c)}'`, format)
}

/** URL de descarga de una capa hija, filtrada por el campo del padre. */
export function childUrl(obj, childKey, format = 'geopackage') {
  const type = typeOf(obj)
  const child = CHILD_LAYERS[childKey]
  if (!child) throw new Error(`capa hija desconocida: ${JSON.stringify(childKey)}`)
  return wfsUrl(child.layer, `${type.field}='${assertCode(obj.c)}'`, format)
}

/** El tope habilita si hay algo que bajar y no lo supera. */
export function canDownload(count, maxFeatures) {
  return Number.isFinite(count) && count > 0 && count <= maxFeatures
}

/** Nombre sugerido del archivo descargado. */
export function filename(obj, childKey) {
  const base = TYPES[obj.t].layer.replace('geonode:', '')
  return childKey ? `${childKey}-de-${base}-${obj.c}.gpkg` : `${base}-${obj.c}.gpkg`
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 28 tests en total.

- [ ] **Step 5: Commit**

```bash
git add src/download.js src/download.test.js
git commit -m "feat: armado de URLs WFS y decisión del tope de descarga"
```

---

### Task 3: Agregación del catálogo (lógica pura)

Separada del script que sale a la red para poder testearla con fixtures.

**Files:**
- Create: `scripts/lib/aggregate.mjs`
- Test: `scripts/lib/aggregate.test.mjs`

**Interfaces:**
- Consumes: nada
- Produces:
  - `NA: string` — el centinela `'N/A'`
  - `countBy(rows, field): Map<string, number>` — omite `''` y `'N/A'`
  - `buildCatalog(input): {catalog, warnings}` donde `input` es
    `{generated, maxFeatures, jurisdicciones, departamentos, localidades, gobiernosLocales, aglomerados, fracciones, radios, vias}`.
    Cada valor es un array de filas ya parseadas (objetos con las columnas del CSV).

- [ ] **Step 1: Escribir el test que falla**

Create `scripts/lib/aggregate.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { countBy, buildCatalog, NA } from './aggregate.mjs'

const input = {
  generated: '2026-09-04',
  maxFeatures: 5000,
  jurisdicciones: [
    { cpr: '06', nam: 'Buenos Aires' },
    { cpr: '82', nam: 'Santa Fe' },
  ],
  departamentos: [
    { cde: '06840', nam: 'Tres de Febrero', jur: 'Buenos Aires' },
    { cde: '82084', nam: 'Rosario', jur: 'Santa Fe' },
  ],
  localidades: [
    { clc: '06840010', cde: '06840', nam: 'Caseros', jur: 'Buenos Aires', dpto: 'Tres de Febrero', codaglo: '0001' },
    { clc: '82084010', cde: '82084', nam: 'Rosario', jur: 'Santa Fe', dpto: 'Rosario', codaglo: NA },
  ],
  gobiernosLocales: [{ cmu: '060840', nam: 'Tres de Febrero', jur: 'Buenos Aires' }],
  aglomerados: [{ codaglo: '0001', nam: 'Gran Buenos Aires' }],
  fracciones: [{ cde: '06840' }, { cde: '06840' }, { cde: '82084' }],
  radios: [{ cde: '06840' }, { cde: '06840' }, { cde: '06840' }],
  vias: [
    { cde: '06840', cmu: '060840', clc: '06840010', codaglo: '0001' },
    { cde: '06840', cmu: NA, clc: '06840010', codaglo: NA },
  ],
}

describe('countBy', () => {
  it('cuenta por valor de campo', () => {
    const m = countBy([{ cde: 'a' }, { cde: 'a' }, { cde: 'b' }], 'cde')
    expect(m.get('a')).toBe(2)
    expect(m.get('b')).toBe(1)
  })

  it('omite el centinela N/A y los vacíos', () => {
    const m = countBy([{ x: NA }, { x: '' }, { x: '7' }], 'x')
    expect(m.has(NA)).toBe(false)
    expect(m.has('')).toBe(false)
    expect(m.get('7')).toBe(1)
  })
})

describe('buildCatalog', () => {
  const { catalog, warnings } = buildCatalog(input)
  const byCode = (t, c) => catalog.objects.find((o) => o.t === t && o.c === c)

  it('copia la metadata', () => {
    expect(catalog.generated).toBe('2026-09-04')
    expect(catalog.maxFeatures).toBe(5000)
  })

  it('incluye un objeto por cada fila buscable', () => {
    expect(catalog.objects).toHaveLength(2 + 2 + 2 + 1 + 1)
  })

  it('cuenta los hijos de un departamento por cde', () => {
    expect(byCode('dep', '06840').ch).toEqual({
      fracciones: 2, radios: 3, localidades: 1, vias: 2,
    })
  })

  it('cuenta los hijos de una jurisdicción por prefijo de provincia', () => {
    expect(byCode('jur', '06').ch).toEqual({
      departamentos: 1, fracciones: 2, radios: 3, localidades: 1, vias: 2,
    })
  })

  it('el aglomerado cuenta localidades y vías por codaglo', () => {
    expect(byCode('aglo', '0001').ch).toEqual({ localidades: 1, vias: 1 })
  })

  it('la localidad sólo cuenta vías', () => {
    expect(byCode('loc', '06840010').ch).toEqual({ vias: 2 })
  })

  it('el gobierno local no tiene hijos', () => {
    expect(byCode('gl', '060840').ch).toBeUndefined()
  })

  it('usa 0 cuando una capa hija no tiene filas para ese código', () => {
    expect(byCode('dep', '82084').ch.radios).toBe(0)
  })

  it('calcula la clave de búsqueda normalizada', () => {
    expect(byCode('dep', '06840').s).toBe('tres de febrero')
  })

  it('deriva la provincia del aglomerado desde sus localidades', () => {
    expect(byCode('aglo', '0001').p).toBe('Buenos Aires')
  })

  it('la jurisdicción es su propia provincia', () => {
    expect(byCode('jur', '06').p).toBe('Buenos Aires')
  })

  it('no reporta advertencias con datos consistentes', () => {
    expect(warnings).toEqual([])
  })
})

describe('buildCatalog: inconsistencias', () => {
  it('advierte por un código hijo sin padre', () => {
    const { warnings } = buildCatalog({ ...input, radios: [...input.radios, { cde: '99999' }] })
    expect(warnings.join(' ')).toMatch(/99999/)
    expect(warnings.join(' ')).toMatch(/radios/)
  })

  it('advierte por un aglomerado que sólo aparece en vías', () => {
    const vias = [...input.vias, { cde: '06840', cmu: NA, clc: '06840010', codaglo: '7777' }]
    const { warnings } = buildCatalog({ ...input, vias })
    expect(warnings.join(' ')).toMatch(/7777/)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./aggregate.mjs"`.

- [ ] **Step 3: Implementar `scripts/lib/aggregate.mjs`**

```js
import { normalize } from '../../src/search.js'

/** El GeoServer usa esta cadena para "sin valor" en codaglo y cmu. */
export const NA = 'N/A'

/** Cuenta filas por valor de un campo, omitiendo vacíos y el centinela. */
export function countBy(rows, field) {
  const counts = new Map()
  for (const row of rows) {
    const key = row[field]
    if (!key || key === NA) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** Cuenta filas cuyo `cde` empieza con el código de provincia. */
function countByProvince(rows) {
  const counts = new Map()
  for (const row of rows) {
    const cde = row.cde
    if (!cde || cde === NA) continue
    const cpr = cde.slice(0, 2)
    counts.set(cpr, (counts.get(cpr) ?? 0) + 1)
  }
  return counts
}

const get = (map, key) => map.get(key) ?? 0

/**
 * Arma el catálogo completo a partir de las filas de cada capa.
 * Devuelve también las advertencias de códigos huérfanos, que el
 * llamador decide si son fatales.
 */
export function buildCatalog(input) {
  const {
    generated, maxFeatures,
    jurisdicciones, departamentos, localidades, gobiernosLocales, aglomerados,
    fracciones, radios, vias,
  } = input

  // Conteos por departamento (cde).
  const fracByDep = countBy(fracciones, 'cde')
  const radiosByDep = countBy(radios, 'cde')
  const locByDep = countBy(localidades, 'cde')
  const viasByDep = countBy(vias, 'cde')

  // Conteos por provincia (primeros dos dígitos del cde).
  const depByProv = countByProvince(departamentos)
  const fracByProv = countByProvince(fracciones)
  const radiosByProv = countByProvince(radios)
  const locByProv = countByProvince(localidades)
  const viasByProv = countByProvince(vias)

  // Conteos por aglomerado y por localidad.
  const locByAglo = countBy(localidades, 'codaglo')
  const viasByAglo = countBy(vias, 'codaglo')
  const viasByLoc = countBy(vias, 'clc')

  // Provincia de cada aglomerado, derivada de sus localidades: el
  // aglomerado no trae `jur` y puede cruzar más de una provincia.
  const provsOfAglo = new Map()
  for (const loc of localidades) {
    if (!loc.codaglo || loc.codaglo === NA) continue
    if (!provsOfAglo.has(loc.codaglo)) provsOfAglo.set(loc.codaglo, new Set())
    provsOfAglo.get(loc.codaglo).add(loc.jur)
  }

  const objects = []

  for (const row of jurisdicciones) {
    objects.push({
      t: 'jur', c: row.cpr, n: row.nam, s: normalize(row.nam), p: row.nam,
      ch: {
        departamentos: get(depByProv, row.cpr),
        fracciones: get(fracByProv, row.cpr),
        radios: get(radiosByProv, row.cpr),
        localidades: get(locByProv, row.cpr),
        vias: get(viasByProv, row.cpr),
      },
    })
  }

  for (const row of departamentos) {
    objects.push({
      t: 'dep', c: row.cde, n: row.nam, s: normalize(row.nam), p: row.jur,
      ch: {
        fracciones: get(fracByDep, row.cde),
        radios: get(radiosByDep, row.cde),
        localidades: get(locByDep, row.cde),
        vias: get(viasByDep, row.cde),
      },
    })
  }

  for (const row of localidades) {
    objects.push({
      t: 'loc', c: row.clc, n: row.nam, s: normalize(row.nam), p: row.jur,
      ch: { vias: get(viasByLoc, row.clc) },
    })
  }

  for (const row of gobiernosLocales) {
    objects.push({ t: 'gl', c: row.cmu, n: row.nam, s: normalize(row.nam), p: row.jur })
  }

  for (const row of aglomerados) {
    const provs = [...(provsOfAglo.get(row.codaglo) ?? [])].sort()
    objects.push({
      t: 'aglo', c: row.codaglo, n: row.nam, s: normalize(row.nam),
      p: provs.join(' / '),
      ch: { localidades: get(locByAglo, row.codaglo), vias: get(viasByAglo, row.codaglo) },
    })
  }

  // Códigos que aparecen en una capa hija y no tienen padre en el catálogo.
  const warnings = []
  const orphans = (counts, known, what) => {
    const missing = [...counts.keys()].filter((k) => !known.has(k)).sort()
    if (missing.length) {
      warnings.push(`${what}: ${missing.length} código(s) sin padre: ${missing.join(', ')}`)
    }
  }

  const knownDep = new Set(departamentos.map((r) => r.cde))
  const knownAglo = new Set(aglomerados.map((r) => r.codaglo))
  const knownLoc = new Set(localidades.map((r) => r.clc))

  orphans(fracByDep, knownDep, 'fracciones por cde')
  orphans(radiosByDep, knownDep, 'radios por cde')
  orphans(viasByDep, knownDep, 'vias por cde')
  orphans(locByAglo, knownAglo, 'localidades por codaglo')
  orphans(viasByAglo, knownAglo, 'vias por codaglo')
  orphans(viasByLoc, knownLoc, 'vias por clc')

  return { catalog: { generated, maxFeatures, objects }, warnings }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 44 tests en total.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/aggregate.mjs scripts/lib/aggregate.test.mjs
git commit -m "feat: agregación del catálogo con detección de códigos huérfanos"
```

---

### Task 4: `build-index.mjs` — volcado del GeoServer y escritura del catálogo

**Files:**
- Create: `scripts/build-index.mjs`
- Usa: `scripts/.cache/`, que ya está en `.gitignore`

**Interfaces:**
- Consumes: `buildCatalog`, `NA` de `scripts/lib/aggregate.mjs`
- Produces: `public/catalog.json`

- [ ] **Step 1: Implementar `scripts/build-index.mjs`**

No lleva test propio: la lógica testeable ya está en `aggregate.mjs` y esto es I/O. Se valida corriéndolo.

```js
#!/usr/bin/env node
import { writeFile, mkdir, readFile, access } from 'node:fs/promises'
import { parse } from 'csv-parse/sync'
import { buildCatalog } from './lib/aggregate.mjs'

const GEOSERVER = 'https://geonode.indec.gob.ar/geoserver/ows'
const MAX_FEATURES = 5000
const CACHE_DIR = new URL('./.cache/', import.meta.url)
const OUT = new URL('../public/catalog.json', import.meta.url)

/** Qué columnas se piden de cada capa. Menos columnas, menos bytes. */
const DUMPS = {
  jurisdicciones:   { layer: 'jurisdicciones',        props: 'cpr,nam' },
  departamentos:    { layer: 'departamentos',         props: 'cde,nam,jur' },
  localidades:      { layer: 'localidades_censales',  props: 'clc,cde,nam,jur,dpto,codaglo' },
  gobiernosLocales: { layer: 'gobiernos_locales4',    props: 'cmu,nam,jur' },
  aglomerados:      { layer: 'aglomerados',           props: 'codaglo,nam' },
  fracciones:       { layer: 'fracciones_censales',   props: 'cde' },
  radios:           { layer: 'radios_censales2',      props: 'cde' },
  vias:             { layer: 'vias_de_circulacion',   props: 'cde,cmu,clc,codaglo' },
}

function dumpUrl({ layer, props }) {
  const p = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typenames: `geonode:${layer}`,
    outputFormat: 'csv',
    propertyName: props,
  })
  return `${GEOSERVER}?${p}`
}

const exists = (url) => access(url).then(() => true, () => false)

/**
 * Baja el CSV de una capa, con caché en disco: el volcado de vías tarda
 * casi un minuto y no hace falta repetirlo mientras se itera.
 */
async function fetchCsv(key, spec, useCache) {
  const cached = new URL(`${key}.csv`, CACHE_DIR)
  if (useCache && (await exists(cached))) {
    console.error(`  ${key}: desde caché`)
    return readFile(cached, 'utf8')
  }
  const started = Date.now()
  const res = await fetch(dumpUrl(spec), { signal: AbortSignal.timeout(300_000) })
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status} ${res.statusText}`)
  const text = await res.text()
  await writeFile(cached, text)
  console.error(`  ${key}: ${text.length} bytes en ${((Date.now() - started) / 1000).toFixed(1)}s`)
  return text
}

async function main() {
  const useCache = !process.argv.includes('--no-cache')
  if (!useCache) console.error('(--no-cache: se vuelve a bajar todo)')
  await mkdir(CACHE_DIR, { recursive: true })

  console.error('Volcando capas del GeoServer del INDEC...')
  const rows = {}
  for (const [key, spec] of Object.entries(DUMPS)) {
    // `columns: true` lee por nombre de encabezado: el GeoServer no
    // respeta el orden de propertyName y agrega FID/fid por su cuenta.
    rows[key] = parse(await fetchCsv(key, spec, useCache), { columns: true, skip_empty_lines: true })
  }

  const { catalog, warnings } = buildCatalog({
    generated: new Date().toISOString().slice(0, 10),
    maxFeatures: MAX_FEATURES,
    ...rows,
  })

  if (warnings.length) {
    console.error('\nInconsistencias en los datos del INDEC:')
    for (const w of warnings) console.error(`  - ${w}`)
  }

  const counts = catalog.objects.reduce((acc, o) => ({ ...acc, [o.t]: (acc[o.t] ?? 0) + 1 }), {})
  console.error(`\nObjetos: ${catalog.objects.length}`, counts)

  if (catalog.objects.length < 6000) {
    throw new Error(`sólo ${catalog.objects.length} objetos; se esperaban ~6900. Abortando.`)
  }

  await mkdir(new URL('../public/', import.meta.url), { recursive: true })
  await writeFile(OUT, JSON.stringify(catalog))
  const size = JSON.stringify(catalog).length
  console.error(`Escrito public/catalog.json (${(size / 1024).toFixed(0)} KB)`)
}

main().catch((err) => {
  console.error(`\nFalló el build del índice: ${err.message}`)
  process.exit(1)
})
```

- [ ] **Step 2: Correr el build contra el GeoServer real**

Run: `npm run build:index`
Expected: tarda entre 1 y 2 minutos. Imprime el tamaño de cada volcado, las inconsistencias conocidas (códigos huérfanos en radios y vías), un recuento por tipo cercano a `{ jur: 24, dep: 529, loc: 4023, gl: 2282, aglo: 119 }`, y escribe `public/catalog.json`.

Si el GeoServer del INDEC está caído, el paso falla con un mensaje de HTTP y no deja un catálogo a medias.

- [ ] **Step 3: Verificar el resultado contra los números conocidos**

Run:

```bash
node -e "
const c = require('./public/catalog.json');
const tf = c.objects.find(o => o.t === 'dep' && o.c === '06840');
console.log('Tres de Febrero:', tf.n, tf.ch);
const ba = c.objects.find(o => o.t === 'jur' && o.c === '06');
console.log('Buenos Aires radios:', ba.ch.radios);
console.log('total objetos:', c.objects.length, 'maxFeatures:', c.maxFeatures);
"
```

Expected:
- Tres de Febrero → `{ fracciones: 42, radios: 432, localidades: 1, vias: 1487 }`
- Buenos Aires radios → `23901`
- total objetos ≈ `6977`, maxFeatures `5000`

Si alguno no coincide, la agregación tiene un error: no seguir hasta resolverlo.

- [ ] **Step 4: Commit del script y del catálogo**

El catálogo se versiona a propósito: así el deploy no depende del GeoServer del INDEC.

```bash
git add scripts/build-index.mjs public/catalog.json
git commit -m "feat: script de build del índice y catálogo generado"
```

---

### Task 5: `catalog.js` — carga y consulta del catálogo

**Files:**
- Create: `src/catalog.js`
- Test: `src/catalog.test.js`

**Interfaces:**
- Consumes: nada
- Produces:
  - `loadCatalog(url?): Promise<{generated, maxFeatures, objects}>` — `url` por defecto `` `${import.meta.env.BASE_URL}catalog.json` ``
  - `findByCode(catalog, t, c): Object | undefined`
  - `childrenOf(obj): Array<{key: string, count: number}>` — vacío si no tiene `ch`

- [ ] **Step 1: Escribir el test que falla**

Create `src/catalog.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { findByCode, childrenOf } from './catalog.js'

const catalog = {
  generated: '2026-09-04',
  maxFeatures: 5000,
  objects: [
    { t: 'dep', c: '06840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires',
      ch: { fracciones: 42, radios: 432, localidades: 1, vias: 1487 } },
    { t: 'gl', c: '060840', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires' },
    { t: 'loc', c: '06840010', n: 'Caseros', s: 'caseros', p: 'Buenos Aires', ch: { vias: 0 } },
  ],
}

describe('findByCode', () => {
  it('encuentra por tipo y código', () => {
    expect(findByCode(catalog, 'dep', '06840').n).toBe('Tres de Febrero')
  })

  it('distingue objetos con el mismo código en tipos distintos', () => {
    expect(findByCode(catalog, 'gl', '060840').t).toBe('gl')
  })

  it('devuelve undefined si no está', () => {
    expect(findByCode(catalog, 'dep', '99999')).toBeUndefined()
  })
})

describe('childrenOf', () => {
  it('lista los hijos en el orden declarado', () => {
    expect(childrenOf(catalog.objects[0])).toEqual([
      { key: 'fracciones', count: 42 },
      { key: 'radios', count: 432 },
      { key: 'localidades', count: 1 },
      { key: 'vias', count: 1487 },
    ])
  })

  it('devuelve vacío para un objeto sin hijos', () => {
    expect(childrenOf(catalog.objects[1])).toEqual([])
  })

  it('conserva los hijos con conteo cero', () => {
    expect(childrenOf(catalog.objects[2])).toEqual([{ key: 'vias', count: 0 }])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./catalog.js"`.

- [ ] **Step 3: Implementar `src/catalog.js`**

```js
/** Orden en que se muestran las capas hijas, independientemente del JSON. */
const CHILD_ORDER = ['departamentos', 'fracciones', 'radios', 'localidades', 'vias']

/** Carga el catálogo generado en build. Una sola vez por sesión. */
export async function loadCatalog(url = `${import.meta.env.BASE_URL}catalog.json`) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`no se pudo cargar el catálogo: HTTP ${res.status}`)
  return res.json()
}

/** Busca un objeto por tipo y código. */
export function findByCode(catalog, t, c) {
  return catalog.objects.find((o) => o.t === t && o.c === c)
}

/** Hijos de un objeto, en orden estable y con su conteo. */
export function childrenOf(obj) {
  if (!obj?.ch) return []
  return CHILD_ORDER
    .filter((key) => key in obj.ch)
    .map((key) => ({ key, count: obj.ch[key] }))
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 50 tests en total.

- [ ] **Step 5: Commit**

```bash
git add src/catalog.js src/catalog.test.js
git commit -m "feat: carga y consulta del catálogo"
```

---

### Task 6: Interfaz sin mapa — buscador, ficha y descargas

**Files:**
- Create: `index.html`
- Create: `src/style.css`
- Create: `src/main.js`

**Interfaces:**
- Consumes: `search` de `search.js`; `loadCatalog`, `childrenOf` de `catalog.js`; `selfUrl`, `childUrl`, `canDownload`, `filename`, `TYPES`, `CHILD_LAYERS` de `download.js`
- Produces: `selectObject(obj)` (interno; el Task 7 se engancha acá)

- [ ] **Step 1: Crear `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Descargas del Marco Geoestadístico Nacional — INDEC</title>
    <meta name="description" content="Descargá capas del Marco Geoestadístico Nacional del INDEC en GeoPackage: departamentos, radios y fracciones censales, localidades y vías de circulación." />
    <link rel="stylesheet" href="./src/style.css" />
  </head>
  <body>
    <header class="site-header">
      <h1>Descargas del Marco Geoestadístico Nacional</h1>
      <p class="subtitle">Buscá una provincia, departamento, localidad, municipio o aglomerado y descargalo en GeoPackage.</p>
    </header>

    <main>
      <div class="search">
        <input
          id="q"
          type="search"
          autocomplete="off"
          placeholder="Escribí un nombre. Por ejemplo: Tres de Febrero"
          aria-label="Buscar un objeto geográfico"
          aria-controls="results"
        />
        <ul id="results" class="results" role="listbox" hidden></ul>
      </div>

      <p id="status" class="status">Cargando el catálogo…</p>

      <section id="detail" class="detail" hidden>
        <div id="map" class="map"></div>
        <div class="panel">
          <h2 id="detail-name"></h2>
          <p id="detail-meta" class="meta"></p>
          <div id="detail-self"></div>
          <h3 id="children-title" hidden>Capas de este objeto</h3>
          <ul id="children" class="children"></ul>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <p>
        Datos del <a href="https://www.indec.gob.ar/">INDEC</a>, servidos por
        <a href="https://geonode.indec.gob.ar/geoserver">geonode.indec.gob.ar</a>.
        Las descargas van de ese servidor a tu computadora: este sitio sólo arma el enlace.
      </p>
      <p class="warning">
        Estos límites son para integración de información estadística. No son fuente oficial de
        delimitación territorial ni sirven como prueba en controversias de límites.
      </p>
      <p id="generated" class="meta"></p>
    </footer>

    <script type="module" src="./src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Crear `src/style.css`**

```css
:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  --muted: #666666;
  --line: #e0e0e0;
  --accent: #1f6feb;
  --accent-fg: #ffffff;
  --disabled: #f2f2f2;
  --warn: #8a5a00;
  --radius: 6px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--fg);
  background: var(--bg);
}

main, .site-header, .site-footer {
  max-width: 60rem;
  margin: 0 auto;
  padding: 0 1rem;
}

.site-header { padding-top: 2rem; }
.site-header h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
.subtitle { color: var(--muted); margin: 0 0 1.5rem; }

.search { position: relative; }

#q {
  width: 100%;
  padding: .75rem 1rem;
  font-size: 1.05rem;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--fg);
}
#q:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

.results {
  position: absolute;
  z-index: 10;
  left: 0; right: 0;
  margin: .25rem 0 0;
  padding: 0;
  list-style: none;
  max-height: 22rem;
  overflow-y: auto;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 8px 24px rgb(0 0 0 / .10);
}
.results li { padding: .6rem 1rem; cursor: pointer; display: flex; justify-content: space-between; gap: 1rem; }
.results li:hover, .results li[aria-selected="true"] { background: #f5f8ff; }
.results .kind { color: var(--muted); font-size: .85rem; white-space: nowrap; }

.status { color: var(--muted); margin: 1rem 0; }
.status.error { color: #b32020; }

.detail { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin: 1.5rem 0 3rem; }
@media (max-width: 48rem) { .detail { grid-template-columns: 1fr; } }

.map { height: 24rem; border: 1px solid var(--line); border-radius: var(--radius); background: var(--disabled); }
.panel h2 { margin: 0 0 .25rem; font-size: 1.25rem; }
.meta { color: var(--muted); font-size: .9rem; margin: 0 0 1rem; }

.children { list-style: none; padding: 0; margin: 0; }
.children li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .6rem 0; border-top: 1px solid var(--line); }
.children .count { color: var(--muted); font-size: .9rem; }

.btn {
  display: inline-block;
  padding: .45rem .9rem;
  border-radius: var(--radius);
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--accent-fg);
  text-decoration: none;
  font-size: .9rem;
  white-space: nowrap;
}
.btn:hover { filter: brightness(1.08); }
.btn.is-disabled {
  background: var(--disabled);
  border-color: var(--line);
  color: var(--muted);
  cursor: not-allowed;
  pointer-events: none;
}
.note { color: var(--warn); font-size: .85rem; margin: .25rem 0 0; }

.site-footer { border-top: 1px solid var(--line); padding-top: 1rem; padding-bottom: 3rem; color: var(--muted); font-size: .85rem; }
.site-footer a { color: inherit; }
.warning { font-style: italic; }

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14161a; --fg: #e8e8e8; --muted: #9aa0a6; --line: #2c3038;
    --accent: #4b8bf5; --accent-fg: #0d0f12; --disabled: #21252b; --warn: #e0b050;
  }
  .results li:hover, .results li[aria-selected="true"] { background: #1c2230; }
}
```

- [ ] **Step 3: Crear `src/main.js`**

El mapa se llena en el Task 7; acá se deja el contenedor y el gancho.

```js
import { search } from './search.js'
import { loadCatalog, childrenOf } from './catalog.js'
import { selfUrl, childUrl, canDownload, filename, TYPES, CHILD_LAYERS } from './download.js'

const el = {
  q: document.querySelector('#q'),
  results: document.querySelector('#results'),
  status: document.querySelector('#status'),
  detail: document.querySelector('#detail'),
  name: document.querySelector('#detail-name'),
  meta: document.querySelector('#detail-meta'),
  self: document.querySelector('#detail-self'),
  childrenTitle: document.querySelector('#children-title'),
  children: document.querySelector('#children'),
  generated: document.querySelector('#generated'),
}

let catalog = null

/** Formatea un entero con separador de miles en castellano. */
const fmt = (n) => n.toLocaleString('es-AR')

function setStatus(text, isError = false) {
  el.status.textContent = text
  el.status.classList.toggle('error', isError)
  el.status.hidden = !text
}

/** Botón de descarga: enlace real si el tope habilita, botón muerto si no. */
function downloadButton(href, name, label) {
  const a = document.createElement('a')
  a.className = 'btn'
  a.href = href
  a.download = name
  a.textContent = label
  return a
}

function disabledButton(label, reason) {
  const wrap = document.createElement('div')
  const span = document.createElement('span')
  span.className = 'btn is-disabled'
  span.textContent = label
  span.setAttribute('aria-disabled', 'true')
  const note = document.createElement('p')
  note.className = 'note'
  note.textContent = reason
  wrap.append(span, note)
  return wrap
}

function renderResults(items) {
  el.results.replaceChildren()
  if (!items.length) {
    el.results.hidden = true
    return
  }
  for (const obj of items) {
    const li = document.createElement('li')
    li.setAttribute('role', 'option')
    const name = document.createElement('span')
    name.textContent = obj.n
    const kind = document.createElement('span')
    kind.className = 'kind'
    kind.textContent = obj.p && obj.p !== obj.n
      ? `${TYPES[obj.t].label} · ${obj.p}`
      : TYPES[obj.t].label
    li.append(name, kind)
    li.addEventListener('click', () => selectObject(obj))
    el.results.append(li)
  }
  el.results.hidden = false
}

function renderChildren(obj) {
  const children = childrenOf(obj)
  el.children.replaceChildren()
  el.childrenTitle.hidden = children.length === 0
  if (!children.length) return

  for (const { key, count } of children) {
    const li = document.createElement('li')
    const left = document.createElement('div')
    const label = document.createElement('div')
    label.textContent = CHILD_LAYERS[key].label
    const n = document.createElement('div')
    n.className = 'count'
    n.textContent = count === 1 ? '1 objeto' : `${fmt(count)} objetos`
    left.append(label, n)

    let right
    if (count === 0) {
      right = disabledButton('Descargar', 'No hay objetos de esta capa acá.')
    } else if (!canDownload(count, catalog.maxFeatures)) {
      right = disabledButton(
        'Descargar',
        `Son ${fmt(count)} objetos y el máximo por descarga es ${fmt(catalog.maxFeatures)}. ` +
        'Probá con un objeto más chico.',
      )
    } else {
      right = downloadButton(childUrl(obj, key), filename(obj, key), 'Descargar')
      if (key === 'vias') {
        const wrap = document.createElement('div')
        const note = document.createElement('p')
        note.className = 'note'
        note.textContent = 'Las vías tardan: el servidor del INDEC puede demorar un minuto o más en responder.'
        wrap.append(right, note)
        right = wrap
      }
    }

    li.append(left, right)
    el.children.append(li)
  }
}

function selectObject(obj) {
  el.results.hidden = true
  el.q.value = obj.n
  setStatus('')

  el.name.textContent = obj.n
  el.meta.textContent = obj.p && obj.p !== obj.n
    ? `${TYPES[obj.t].label} · ${obj.p} · código ${obj.c}`
    : `${TYPES[obj.t].label} · código ${obj.c}`

  el.self.replaceChildren(
    downloadButton(selfUrl(obj), filename(obj), `Descargar este ${TYPES[obj.t].label.toLowerCase()}`),
  )

  renderChildren(obj)
  el.detail.hidden = false
  document.dispatchEvent(new CustomEvent('object:selected', { detail: obj }))
}

el.q.addEventListener('input', () => {
  if (!catalog) return
  renderResults(search(catalog.objects, el.q.value))
})

el.q.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') el.results.hidden = true
})

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search')) el.results.hidden = true
})

loadCatalog()
  .then((c) => {
    catalog = c
    setStatus('')
    el.generated.textContent = `Catálogo generado el ${c.generated} · ${fmt(c.objects.length)} objetos · máximo ${fmt(c.maxFeatures)} por descarga.`
    el.q.focus()
  })
  .catch((err) => {
    setStatus(`No se pudo cargar el catálogo: ${err.message}`, true)
  })
```

- [ ] **Step 4: Levantar el sitio y probar el recorrido completo**

Run: `npm run dev`

Verificar en el browser:
1. Escribir `Tres de Febr` → aparece "Tres de Febrero · Departamento · Buenos Aires" y también el gobierno local homónimo.
2. Hacer click en el departamento → se ve la ficha con el código `06840` y cuatro capas: fracciones 42, radios 432, localidades 1, vías 1.487, todas con botón habilitado. Vías muestra el aviso de demora.
3. Buscar `Buenos Aires` y elegir la jurisdicción → radios (23.901) y vías aparecen **deshabilitados** con el mensaje del tope; departamentos (135) habilitado.
4. Buscar un gobierno local → sólo el botón de descarga propia, sin lista de capas.
5. Hacer click en "Descargar" de las fracciones de Tres de Febrero → baja un `.gpkg` que abre en QGIS.

- [ ] **Step 5: Commit**

```bash
git add index.html src/style.css src/main.js
git commit -m "feat: buscador, ficha del objeto y descargas con tope"
```

---

### Task 7: Mapa Leaflet

**Files:**
- Create: `src/map.js`
- Modify: `src/main.js` (importar e inicializar el mapa)

**Interfaces:**
- Consumes: `selfUrl` de `download.js`; el evento `object:selected` que dispara `main.js`
- Produces:
  - `initMap(containerId): void`
  - `showObject(obj): Promise<void>` — pide el GeoJSON, lo dibuja y encuadra
  - `onFeature(callback): void` — entrega las propiedades del feature dibujado

- [ ] **Step 1: Implementar `src/map.js`**

```js
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { selfUrl } from './download.js'

/**
 * Basemap del IGN. Es TMS, que numera el eje Y al revés que XYZ:
 * sin `tms: true` el mapa sale espejado verticalmente.
 */
const IGN_TILES = 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{y}.png'

const ARGENTINA = [[-55.5, -74], [-21.5, -53]]

let map = null
let layer = null
let featureCallback = () => {}
let pending = 0

export function initMap(containerId) {
  map = L.map(containerId, { scrollWheelZoom: false })
  L.tileLayer(IGN_TILES, {
    tms: true,
    maxZoom: 18,
    attribution: 'Instituto Geográfico Nacional, OpenStreetMap',
  }).addTo(map)
  map.fitBounds(ARGENTINA)
}

/** Registra a quién avisarle cuando llegan las propiedades del objeto. */
export function onFeature(callback) {
  featureCallback = callback
}

export async function showObject(obj) {
  if (!map) return
  const request = ++pending

  // El mapa se creó con `#detail` oculto, así que Leaflet midió un
  // contenedor de altura cero. Ahora ya es visible: hay que avisarle.
  map.invalidateSize()

  if (layer) {
    layer.remove()
    layer = null
  }

  const res = await fetch(selfUrl(obj, 'application/json'))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const geojson = await res.json()

  // Otra selección ganó de mano a ésta mientras viajaba la respuesta.
  if (request !== pending) return

  if (!geojson.features?.length) throw new Error('el servidor no devolvió geometría')

  layer = L.geoJSON(geojson, {
    style: { color: '#1f6feb', weight: 2, fillOpacity: 0.12 },
  }).addTo(map)

  map.fitBounds(layer.getBounds(), { padding: [16, 16] })
  featureCallback(geojson.features[0].properties)
}
```

- [ ] **Step 2: Enganchar el mapa en `src/main.js`**

Agregar el import al principio del archivo, junto a los otros:

```js
import { initMap, showObject, onFeature } from './map.js'
```

Y agregar esto justo antes de la llamada a `loadCatalog()`, al final del archivo:

```js
initMap('map')

onFeature((props) => {
  // El GeoServer devuelve nombres largos y códigos que no están en el
  // catálogo; se muestran tal cual vienen, sin traducir.
  const interesting = ['fna', 'gna', 'cod_indec', 'sag']
  const parts = interesting
    .filter((k) => props[k] && props[k] !== 'N/A')
    .map((k) => `${k}: ${props[k]}`)
  if (parts.length) el.meta.textContent += ` · ${parts.join(' · ')}`
})

document.addEventListener('object:selected', (e) => {
  showObject(e.detail).catch((err) => {
    setStatus(`No se pudo dibujar el objeto en el mapa: ${err.message}. Las descargas siguen funcionando.`, true)
  })
})
```

- [ ] **Step 3: Probar el mapa**

Run: `npm run dev`

Verificar:
1. Al cargar, el mapa muestra Argentina con el basemap del IGN, **no espejado** (Tierra del Fuego abajo, Jujuy arriba). Si sale al revés, falta `tms: true`.
2. Elegir Tres de Febrero → el mapa encuadra el partido y lo pinta en azul.
3. Elegir otro objeto → el anterior desaparece.
4. La ficha suma los atributos del INDEC (`fna`, `gna`, `sag`).

- [ ] **Step 4: Correr los tests para confirmar que nada se rompió**

Run: `npm test`
Expected: PASS, 50 tests.

- [ ] **Step 5: Commit**

```bash
git add src/map.js src/main.js
git commit -m "feat: mapa Leaflet con basemap del IGN"
```

---

### Task 8: Deploy a GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm run build` del Task 1
- Produces: el sitio en `https://dantofema.github.io/indec-descargas/`

- [ ] **Step 1: Crear `.github/workflows/deploy.yml`**

El índice **no** se genera acá: `public/catalog.json` ya está versionado, así que el deploy no depende de que el GeoServer del INDEC esté arriba.

```yaml
name: Deploy a GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Habilitar Pages en el repo**

Run: `gh api -X POST repos/dantofema/indec-descargas/pages -f build_type=workflow`

Expected: responde con un JSON que incluye `"html_url": "https://dantofema.github.io/indec-descargas/"`.

Si responde `409 Conflict`, Pages ya estaba habilitado: seguir.

- [ ] **Step 3: Commit y push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy a GitHub Pages"
git push
```

- [ ] **Step 4: Verificar el deploy**

Run: `gh run watch`
Expected: los dos jobs en verde.

Después abrir `https://dantofema.github.io/indec-descargas/` y repetir el recorrido de Tres de Febrero. Si los assets dan 404, `base` en `vite.config.js` no coincide con el nombre del repo.

---

### Task 9: Regla de producto de descargas

**Files:**
- Create: `docs/reglas/descargas.md`
- Create: `docs/reglas/README.md`

**Interfaces:**
- Consumes: las decisiones del spec
- Produces: el registro numerado de las decisiones de producto

- [ ] **Step 1: Crear `docs/reglas/descargas.md`**

```markdown
# Descargas

Decisiones de producto sobre qué se puede descargar y con qué límite.

## ✅ Reglas

### DES-R1 — El tope es un único número global de features

`maxFeatures` vale 5000 y se aplica igual a toda capa. No hay topes por capa.

**Por qué:** un solo número es explicable al usuario en una frase y calibra bien con los datos
reales: ningún departamento supera 5000 radios (máximo 2069), y las tres provincias grandes
quedan afuera, que es exactamente el comportamiento pedido.

### DES-R2 — Superar el tope deshabilita, no recorta

Si el conteo supera `maxFeatures` el botón queda deshabilitado mostrando el conteo real y el
máximo. No se ofrece una descarga parcial ni paginada.

**Por qué:** una descarga parcial silenciosa produce un archivo que el usuario cree completo.
Es peor que no descargar.

### DES-R3 — Conteo cero también deshabilita

Un hijo con 0 objetos muestra el botón deshabilitado y dice que no hay nada de esa capa.

**Por qué:** un `.gpkg` vacío parece un error del usuario, no un dato.

### DES-R4 — La descarga es siempre GPKG en EPSG:4326

No hay selector de formato ni de proyección en el MVP.

**Por qué:** el GeoServer del INDEC publica las capas en EPSG:3857 pero reproyecta a pedido.
4326 es lo que espera la mayoría de las herramientas y GPKG es un archivo único, sin el
problema de los `.shp` en varios archivos ni su límite de 10 caracteres por nombre de campo.

### DES-R5 — El tope vive en el catálogo, no en el código

`maxFeatures` se lee de `catalog.json`.

**Por qué:** cambiar la política es regenerar el índice, y el valor queda registrado junto a
los conteos con los que se decidió.

### DES-R6 — El catálogo se regenera a mano y se versiona

`npm run build:index` lo produce; el archivo se commitea.

**Por qué:** el Marco Geoestadístico cambia entre censos, no entre semanas. Versionarlo hace
que el deploy no dependa de que el GeoServer del INDEC esté arriba, y que un cambio en los
datos se vea en el diff.

### DES-R7 — El gobierno local no ofrece capas hijas; la localidad sí ofrece vías

**Por qué:** ni radios ni fracciones llevan `clc`, `cmu` ni `codaglo`, así que los dos sólo
podrían ofrecer vías. Pero el gobierno local está fuera de la cadena censal (no tiene `cde`) y
ver una sola capa suelta ahí no se explica; la localidad está adentro, y "las calles de esta
localidad" es una respuesta útil por sí sola.

### DES-R8 — Las inconsistencias del INDEC se reportan, no se corrigen

El build advierte por cada código hijo sin padre y sigue.

**Por qué:** los códigos de departamento no cierran entre capas (529 en `departamentos`, 530
en radios, 527 en vías). Silenciarlos haría que el catálogo mienta sobre el dato de origen.
```

- [ ] **Step 2: Crear `docs/reglas/README.md`**

```markdown
# Reglas por superficie

Decisiones de producto de `indec-descargas`, numeradas. **Antes de tocar una de estas
superficies, leé su archivo.** Cambiar el comportamiento sin cambiar la regla es hacer que el
documento mienta.

| Superficie | Reglas |
|---|---|
| [descargas](descargas.md) | DES-R1 … DES-R8 |
```

- [ ] **Step 3: Commit**

```bash
git add docs/reglas/
git commit -m "docs: reglas de producto de descargas"
```

---

## Verificación final

- [ ] `npm test` pasa (50 tests)
- [ ] `npm run build` termina sin errores
- [ ] El sitio publicado carga y el recorrido de Tres de Febrero funciona de punta a punta
- [ ] Una descarga de fracciones abre correctamente en QGIS
- [ ] Buenos Aires muestra radios y vías deshabilitados con el mensaje del tope
