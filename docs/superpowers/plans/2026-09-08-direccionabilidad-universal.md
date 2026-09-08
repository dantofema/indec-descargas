# Direccionabilidad universal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los ocho objetos del Marco tengan enlace permanente y se puedan buscar por código, y que «Ver» navegue en vez de reemplazar media ficha.

**Architecture:** El catálogo deja de decidir qué objetos existen y pasa a servir sólo para buscar por nombre. `TYPES` gana tres entradas —fracción, radio, vía— con el largo de su código, y con eso `selfUrl`, `filename` y `showObject` funcionan para ellas sin un camino nuevo. La ficha de un objeto sin catálogo se resuelve con un GetFeature por código; la de una vía no pide nada hasta que se lo piden. `onView` pasa a navegar, y con eso se borra todo el andamiaje que existía para que media ficha describiera otra cosa que la otra.

**Tech Stack:** Vite 6, Vitest 2 + jsdom, Leaflet 1.9, JavaScript ESM sin framework. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-09-08-direccionabilidad-universal-design.md`

## Global Constraints

- **Sin dependencias nuevas.** Sitio estático bajo `base: '/indec-descargas/'`.
- **Castellano en la interfaz, inglés en el código.** Comentarios en castellano que explican *por qué*, no *qué*.
- **La URL es el estado (SITIO-R2).** Nada de `pushState` para elegir objeto: se navega. Lo único que reescribe la barra sin navegar es la pestaña y la página, con `replaceState`.
- **Ningún pedido de vías sin un acto explícito del usuario (SITIO-R3).** Es la promesa más fácil de romper de este plan y la que tiene control negativo obligatorio.
- **Largos de código verificados el 2026-09-08. Usar textualmente:** `jur` 2, `aglo` 4, `dep` 5, `gl` 6, `frac` 7, `loc` 8, `rad` 9, `via` 13. Ocho largos, cero colisiones.
- **Costos medidos el 2026-09-06 contra el GeoServer real:** un feature con geometría tarda **12,4 s** en vías y **0,65 s** en radios. Una página de 20 vías tarda 14–20 s por departamento, 17–18 s por localidad censal, 88–99 s por provincia.
- **Prefijos verificados el 2026-09-08:** el `cod_indec` de una vía empieza siempre con su `clc` (400 de 400 filas del departamento `06469`, 11 localidades censales distintas, cero contraejemplos).
- **Comandos:** `npm test` corre la suite. `npx vitest run src/archivo.test.js` corre un archivo. `npm run build` construye.

## Estructura de archivos

**Se modifican:**
- `src/download.js` — `TYPES` gana `frac`, `rad`, `via`, con `len` y `catalogo`; mapas `LAYER_OF_TYPE` / `TYPE_OF_LAYER`
- `src/permalink.js` — valida el largo del código; `pag=`
- `src/parents.js` — cadena de padres de los tres tipos nuevos; padres sintéticos
- `src/map.js` — `showObject` devuelve las propiedades
- `src/pages/resultados.js` — resolución sin catálogo, panel de costo de vía, «Ver» que navega, `pag=`
- `src/browser.js` — `onView` sin marca ni estado de carga; exporta el aviso de costo; página inicial
- `src/search.js` — nivel 0 por código y filas sintéticas
- `src/searchbox.js` — cablea las filas sintéticas
- `resultados/index.html` — `id` en el bloque «Qué contiene»
- `docs/reglas/buscador.md`, `navegacion.md`, `sitio.md`, `README.md`

---

### Task 1: Los ocho tipos son direccionables

**Files:**
- Modify: `src/download.js`
- Modify: `src/permalink.js`
- Test: `src/download.test.js` (crear si no existe), `src/permalink.test.js`

**Interfaces:**
- Produces:
  - `TYPES[t] = { layer, field, len, catalogo, label, plural, det }` para los ocho tipos.
  - `LAYER_OF_TYPE: Record<'dep'|'loc'|'frac'|'rad'|'via', string>` → clave de `CHILD_LAYERS`.
  - `TYPE_OF_LAYER: Record<string, string>` → la inversa.
  - `parse(search)` devuelve `{ status:'invalid' }` si el largo del código no es el del tipo.

- [ ] **Step 1: Escribir los tests que fallan, en `src/permalink.test.js`**

```js
import { TYPES, LAYER_OF_TYPE, TYPE_OF_LAYER } from './download.js'

describe('los ocho tipos direccionables', () => {
  it('los ocho largos de código son distintos: es lo que deja resolver por código', () => {
    const largos = Object.values(TYPES).map((v) => v.len)
    expect(new Set(largos).size).toBe(largos.length)
    expect(largos.sort((a, b) => a - b)).toEqual([2, 4, 5, 6, 7, 8, 9, 13])
  })

  it('los tres nuevos no están en el catálogo y los cinco viejos sí', () => {
    expect(Object.entries(TYPES).filter(([, v]) => !v.catalogo).map(([t]) => t).sort())
      .toEqual(['frac', 'rad', 'via'])
  })

  it('capa y tipo se traducen en los dos sentidos', () => {
    for (const [t, capa] of Object.entries(LAYER_OF_TYPE)) expect(TYPE_OF_LAYER[capa]).toBe(t)
  })

  it('parsea un radio, una fracción y una vía', () => {
    expect(parse('?t=rad&c=068402311')).toMatchObject({ status: 'ok', type: 'rad', code: '068402311' })
    expect(parse('?t=frac&c=0684042')).toMatchObject({ status: 'ok', type: 'frac' })
    expect(parse('?t=via&c=0646908000600')).toMatchObject({ status: 'ok', type: 'via' })
  })

  it('un código con el largo de otro tipo es un enlace inválido', () => {
    // Siete dígitos es una fracción, no un radio: sin esta guarda la página
    // saldría a pedirle al GeoServer un objeto que no puede existir.
    expect(parse('?t=rad&c=0684042')).toMatchObject({ status: 'invalid' })
    expect(parse('?t=dep&c=06840010')).toMatchObject({ status: 'invalid' })
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/permalink.test.js`
Expected: FAIL — `LAYER_OF_TYPE is not defined` y los tipos nuevos no existen.

- [ ] **Step 3: Extender `TYPES` en `src/download.js`**

Reemplazar el bloque `TYPES` entero, conservando el comentario de arriba y agregándole las dos frases nuevas:

```js
/**
 * Capa propia y campo de filtro de cada tipo de objeto. `det` es el
 * determinante que le corresponde al `label`: la interfaz está en castellano
 * y varios tipos son femeninos. `plural` es la etiqueta con la que el tipo
 * aparece en el filtro del buscador —que sale de `TYPE_ORDER`, no de acá, y
 * por eso los tres tipos sin catálogo no aparecen en él: no tienen nombre
 * que buscar (NAV-R4)—.
 *
 * `len` es el largo del código, verificado el 2026-09-08 contra el GeoServer
 * y el catálogo. Los ocho son distintos y no colisionan: es lo que deja que
 * una consulta de puros dígitos se resuelva sola (BUS-R5) y lo que separa un
 * enlace bueno de `?t=rad&c=0684042`.
 *
 * `catalogo` dice si el objeto está en `catalog.json`. Los tres que no lo
 * están se resuelven con un GetFeature por código: el catálogo hace falta
 * para buscar por nombre, no para direccionar.
 */
export const TYPES = {
  jur:  { layer: 'geonode:jurisdicciones',        field: 'cpr',       len: 2,  catalogo: true,  label: 'Jurisdicción',       plural: 'Jurisdicciones',       det: 'esta' },
  aglo: { layer: 'geonode:aglomerados',           field: 'codaglo',   len: 4,  catalogo: true,  label: 'Aglomerado',         plural: 'Aglomerados',          det: 'este' },
  dep:  { layer: 'geonode:departamentos',         field: 'cde',       len: 5,  catalogo: true,  label: 'Departamento',       plural: 'Departamentos',        det: 'este' },
  gl:   { layer: 'geonode:gobiernos_locales4',    field: 'cmu',       len: 6,  catalogo: true,  label: 'Gobierno local',     plural: 'Gobiernos locales',    det: 'este' },
  frac: { layer: 'geonode:fracciones_censales',   field: 'cod_indec', len: 7,  catalogo: false, label: 'Fracción censal',    plural: 'Fracciones censales',  det: 'esta' },
  loc:  { layer: 'geonode:localidades_censales',  field: 'clc',       len: 8,  catalogo: true,  label: 'Localidad censal',   plural: 'Localidades censales', det: 'esta' },
  rad:  { layer: 'geonode:radios_censales2',      field: 'cod_indec', len: 9,  catalogo: false, label: 'Radio censal',       plural: 'Radios censales',      det: 'este' },
  via:  { layer: 'geonode:vias_de_circulacion',   field: 'cod_indec', len: 13, catalogo: false, label: 'Vía de circulación', plural: 'Vías de circulación',  det: 'esta' },
}
```

**Cuidado:** `TYPE_ORDER` en `search.js` sigue siendo `['jur', 'dep', 'loc', 'gl', 'aglo']`. No agregarle los tres nuevos: el filtro del buscador ofrece tipos que se buscan por nombre, y estos no tienen nombre.

- [ ] **Step 4: Agregar los dos mapas, después de `CHILD_LAYERS` en `src/download.js`**

```js
/**
 * La capa hija que corresponde a un tipo direccionable. Existe porque las
 * columnas de un objeto las decide `specOf`, que se indexa por clave de
 * `CHILD_LAYERS`, y la ficha se indexa por tipo: sin este puente, la ficha
 * de un radio no sabe qué campos mostrar.
 */
export const LAYER_OF_TYPE = {
  dep: 'departamentos',
  loc: 'localidades',
  frac: 'fracciones',
  rad: 'radios',
  via: 'vias',
}

/** La inversa: qué tipo direccionable es una fila de esta capa. La usa el "Ver" para armar el permalink. */
export const TYPE_OF_LAYER = Object.fromEntries(
  Object.entries(LAYER_OF_TYPE).map(([t, capa]) => [capa, t]),
)
```

- [ ] **Step 5: Validar el largo en `src/permalink.js`**

Después del bloque `if (!isCode(c)) { ... }`, agregar:

```js
  // El largo es lo único que separa una fracción de un radio: los dos son
  // `cod_indec` de la misma forma. Sin esta guarda, `?t=rad&c=0684042` sale
  // a pedirle al GeoServer un radio de siete dígitos, que no puede existir,
  // y el usuario ve un error de red donde hay un enlace mal escrito.
  if (c.length !== TYPES[t].len) {
    return {
      status: 'invalid',
      reason: `el código ${c} no tiene el largo de ${TYPES[t].label.toLowerCase()}: son ${TYPES[t].len} dígitos`,
    }
  }
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npm test`
Expected: PASS. Si algún test viejo de `download.test.js` o `permalink.test.js` cuenta los tipos, actualizarlo a ocho.

- [ ] **Step 7: Commit**

```bash
git add src/download.js src/permalink.js src/permalink.test.js
git commit -m "feat: fracción, radio y vía también son objetos con enlace propio"
```

---

### Task 2: Un objeto sin catálogo sabe de qué forma parte

**Files:**
- Modify: `src/parents.js`
- Modify: `src/parents.test.js`

**Interfaces:**
- Consumes: `TYPES[t].catalogo` de la Task 1.
- Produces: `parentsOf(obj, index)` acepta `frac`, `rad`, `via` y devuelve padres sintéticos `{ t, c, n: null }` para los tipos sin catálogo.

- [ ] **Step 1: Escribir los tests que fallan, en `src/parents.test.js`**

```js
describe('los padres de un objeto sin catálogo', () => {
  const index = codeIndex([
    { t: 'jur', c: '06', n: 'Buenos Aires' },
    { t: 'dep', c: '06469', n: 'Malvinas Argentinas' },
    { t: 'loc', c: '06469080', n: 'Grand Bourg' },
  ])

  it('un radio cuelga de su fracción, su departamento y su jurisdicción', () => {
    const padres = parentsOf({ t: 'rad', c: '064690801' }, index)
    expect(padres.map((p) => [p.t, p.c])).toEqual([
      ['frac', '0646908'], ['dep', '06469'], ['jur', '06'],
    ])
  })

  it('el padre que no está en el catálogo se ofrece igual, sin nombre', () => {
    const [frac] = parentsOf({ t: 'rad', c: '064690801' }, index)
    expect(frac.n).toBeNull()
  })

  it('una vía cuelga de su localidad censal: su código empieza con el clc', () => {
    const padres = parentsOf({ t: 'via', c: '0646908000600' }, index)
    expect(padres.map((p) => [p.t, p.c])).toEqual([
      ['loc', '06469080'], ['dep', '06469'], ['jur', '06'],
    ])
  })

  it('una fracción cuelga de su departamento y su jurisdicción', () => {
    expect(parentsOf({ t: 'frac', c: '0646908' }, index).map((p) => p.t)).toEqual(['dep', 'jur'])
  })

  // DES-R8: los códigos del INDEC no cierran entre capas, así que un prefijo
  // válido puede apuntar a un objeto que el catálogo no tiene.
  it('un padre de catálogo que no existe se descarta, y uno sintético no', () => {
    const vacio = codeIndex([])
    const padres = parentsOf({ t: 'rad', c: '064690801' }, vacio)
    expect(padres.map((p) => p.t)).toEqual(['frac'])
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/parents.test.js`
Expected: FAIL — `CHAIN['rad']` no existe, así que `parentsOf` devuelve `[]`.

- [ ] **Step 3: Extender `CHAIN` y `parentsOf` en `src/parents.js`**

Importar `TYPES` arriba: `import { TYPES } from './download.js'`.

Agregar a `CHAIN`:

```js
  frac: (obj) => [
    ['dep', obj.c.slice(0, 5)],
    ['jur', obj.c.slice(0, 2)],
  ],
  rad: (obj) => [
    ['frac', obj.c.slice(0, 7)],
    ['dep', obj.c.slice(0, 5)],
    ['jur', obj.c.slice(0, 2)],
  ],
  // Verificado el 2026-09-08 sobre las 400 filas del departamento 06469,
  // repartidas en 11 localidades censales: el `cod_indec` de un tramo empieza
  // siempre con su `clc`, sin un contraejemplo. Es lo que deja que la ficha
  // de una vía muestre sus padres antes de pedir nada (SITIO-R3).
  via: (obj) => [
    ['loc', obj.c.slice(0, 8)],
    ['dep', obj.c.slice(0, 5)],
    ['jur', obj.c.slice(0, 2)],
  ],
```

Y reemplazar `parentsOf`:

```js
/**
 * Los padres que se pueden ofrecer. Los de catálogo se buscan antes de
 * ofrecerlos —DES-R8: un prefijo válido puede apuntar a un objeto que no
 * existe—; los que no están en el catálogo se arman del código, porque no
 * hay dónde buscarlos y su existencia la decide el GeoServer recién cuando
 * se los abre.
 *
 * `n: null` es "este objeto no tiene nombre publicado" (NAV-R4), no "falta
 * el dato": quien dibuja la fila usa el tipo como rótulo.
 */
export function parentsOf(obj, index) {
  const chain = CHAIN[obj?.t]
  if (!chain) return []
  return chain(obj)
    .map(([t, c]) => (TYPES[t].catalogo ? index.get(`${t}:${c}`) : { t, c, n: null }))
    .filter(Boolean)
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run src/parents.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parents.js src/parents.test.js
git commit -m "feat: un radio también forma parte de algo, y su código lo dice"
```

---

### Task 3: La ficha de un objeto sin catálogo

**Files:**
- Modify: `src/map.js` (`showObject` devuelve props)
- Modify: `src/pages/resultados.js`
- Modify: `resultados/index.html` (`id` en el bloque «Qué contiene»)
- Modify: `src/pages/resultados.test.js`, `src/map.test.js`

**Interfaces:**
- Consumes: `TYPES[t].catalogo`, `LAYER_OF_TYPE` (Task 1); `parentsOf` con tipos nuevos (Task 2).
- Produces:
  - `showObject(obj): Promise<object|undefined>` — devuelve las propiedades del feature, o `undefined` si el pedido perdió la carrera.
  - `showFeatureIdentity(layerKey, row)` en `resultados.js` — pinta nombre, metadatos, enlace a la nota y descarga desde `specOf(layerKey)`. Sin botón de volver.

- [ ] **Step 1: Escribir los tests que fallan, en `src/pages/resultados.test.js`**

El archivo ya trae los helpers: `montar(search)` monta y espera, `montarSinEsperar(search)`, `$(sel)`, `buscar(texto)`, `filtrar(tipo)`. Usarlos; no escribir helpers nuevos.

**Tres cosas del archivo, verificadas el 2026-09-08. Usalas así, no las adivines:**

1. **`navigate` ya está en el scope del módulo** (`let navigate`, reasignado en el `beforeEach`). Los tests de las Tasks 4 a 7 lo usan directo, sin tocar nada.
2. **El espía de `fetch` no tiene nombre propio:** el `beforeEach` hace `global.fetch = vi.fn(...)`. Donde este plan escribe `fetchSpy.mock.calls`, poné **`global.fetch.mock.calls`**. No hace falta hoistear nada.
3. **El mock devuelve siempre un solo feature** (`features: [{ properties: filaDeVerdad }]`). Los tests que necesiten más de uno —el conteo de tramos de una vía, Task 5— tienen que ampliar ese mock para que, cuando la URL pida `vias_de_circulacion`, devuelva varios features con el mismo `cod_indec`. Ampliarlo, no reemplazarlo: el resto de los casos depende de que siga devolviendo uno.

**Y un test existente se va a poner rojo por el fixture nuevo:** `src/pages/resultados.test.js:107` afirma `toContain('3 objetos')`, que es el conteo del catálogo de prueba. Agregarle la localidad censal `06840010` lo lleva a **4**. Actualizar esa expectativa es lo correcto —el catálogo real tiene el departamento y la localidad homónimos, así que el fixture de tres estaba probando un catálogo irreal—; **no saques el objeto del fixture**, que la Task 5 lo necesita como padre de una vía.

Al fixture `catalogo` hay que agregarle la localidad censal de Tres de Febrero, que hoy no está y que estos tests necesitan como padre de una vía:

```js
    { t: 'loc', c: '06840010', n: 'Tres de Febrero', s: 'tres de febrero', p: 'Buenos Aires',
      ch: { vias: 1487 } },
```

Los códigos de los tests salen del GeoServer real: fracción `0684042`, radio `068402311`, vía `0684001001810`.

```js
describe('la ficha de un objeto que no está en el catálogo', () => {
  it('un radio se resuelve contra el GeoServer y muestra su identidad', async () => {
    await montar('?t=rad&c=068402311')
    expect($('#detail').hidden).toBe(false)
    expect($('#detail-name').textContent).toContain('068402311')
    expect($('#detail-self a')).not.toBeNull()
  })

  it('no muestra fila 3 ni bloque de capas hijas: un radio no contiene nada', async () => {
    await montar('?t=rad&c=068402311')
    expect($('#row-browse').hidden).toBe(true)
    expect($('#row-children').hidden).toBe(true)
  })

  it('muestra de qué forma parte, derivado del código', async () => {
    await montar('?t=rad&c=068402311')
    expect($('#row-parents').hidden).toBe(false)
    // Fracción 0684023 (sintética), departamento 06840 y jurisdicción 06.
    expect($('#parents').children.length).toBe(3)
  })

  it('el buscador no queda diciendo "undefined"', async () => {
    await montar('?t=rad&c=068402311')
    expect($('#q').value).toBe('068402311')
  })

  it('un código con el largo de otro tipo muestra el buscador, no una ficha rota (SITIO-R4)', async () => {
    await montar('?t=rad&c=0684042')
    expect($('#detail').hidden).toBe(true)
    expect($('#status').classList.contains('error')).toBe(true)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/pages/resultados.test.js`
Expected: FAIL — hoy `?t=rad` ni siquiera parsea como objeto del catálogo, así que aparece «No hay ningún objeto con el código…».

- [ ] **Step 3: Que `showObject` devuelva las propiedades y cuántos features vinieron, en `src/map.js`**

En `drawFromUrl`, cambiar los dos `return` del final para que devuelva las dos cosas:

```js
    map.fitBounds(layer.getBounds(), { padding: [16, 16] })
    // El conteo, además de las propiedades del primero: en vías un código no
    // identifica un tramo sino una calle entera, y sus tramos comparten el
    // código —80 filas en el caso más partido medido, la AUTOPISTA DEL OESTE
    // (`0684001002660`)—. Sin este número la ficha describiría el tramo 1
    // mientras el mapa dibuja los 80, que es justo la contradicción que
    // NAV-R11 vino a eliminar.
    return { props: geojson.features[0].properties, count: geojson.features.length }
```

y en el `catch`, `return undefined` como está.

```js
export async function showObject(obj) {
  if (!map) return undefined
  // Devuelve, además de avisar: la ficha de un objeto sin catálogo se
  // construye entera con esto —no tiene un nombre que venga del catálogo—,
  // y el callback es un canal de aviso, no de datos. Una petición superada
  // devuelve `undefined` (ver arriba).
  const drawn = await drawFromUrl(beginRequest(), selfUrl(obj, 'application/json'))
  if (drawn) featureCallback(drawn.props)
  return drawn
}
```

**`showFeature` y `featureQueryUrl` NO se borran acá: los borra la Task 4.** Este plan mandaba borrarlas en este paso y estaba mal —lo descubrió el implementador al quedar bloqueado—: su último llamador es el `onView` de `resultados.js`, que se reemplaza recién en la Task 4, así que borrarlas acá deja la suite en 418/431 y el build en error. Ninguna tarea puede dejar la suite en rojo entre commits.

Lo único que `showFeature` necesita en esta tarea es desenvolver el valor nuevo de `drawFromUrl`, para que su llamador no se entere del cambio:

```js
/**
 * Dibuja un feature suelto de una capa hija: la fila que se está "viendo"
 * desde la tabla de la fila 3, no el objeto de la búsqueda.
 *
 * Devuelve sólo las propiedades: su único llamador es ese "Ver", que
 * describe un objeto por vez y no tiene qué hacer con el conteo. `undefined`
 * significa "este pedido perdió la carrera": quien llama no escribe nada.
 *
 * Muere junto con ese "Ver" en la Task 4: con `TYPES` extendido, la ficha de
 * cualquier objeto se dibuja con `showObject`.
 */
export async function showFeature(layerName, field, code) {
  if (!map) return undefined
  const drawn = await drawFromUrl(beginRequest(), featureQueryUrl(layerName, field, code))
  return drawn?.props
}
```

El comentario que anuncia su propia muerte es a propósito: sin él, dentro de dos semanas alguien la ve sin llamadores y no sabe si puede borrarla.

- [ ] **Step 4: Dar un `id` al bloque «Qué contiene», en `resultados/index.html`**

```html
          <div id="row-children">
            <p class="block-title">Qué contiene, capa entera</p>
            <ul id="children" class="rel"></ul>
          </div>
```

- [ ] **Step 5: Extraer `showFeatureIdentity` en `src/pages/resultados.js`**

Partir el `showRow` de hoy en dos. Lo que sigue reemplaza su cuerpo; `showRow` queda como un envoltorio que le agrega el botón de volver, y muere en la Task 4.

```js
/**
 * El panel de identidad de una fila de capa: nombre, metadatos, enlace a la
 * nota de esa capa y su descarga. Los campos salen de `specOf`, la misma
 * spec que arma la tabla, así que ficha y tabla no pueden decir cosas
 * distintas de la misma fila.
 *
 * Se reemplaza entero, nunca se le agrega nada a lo que había: es lo que
 * separa esto del bug viejo, donde cada "Ver" le pegaba otro tramo de texto
 * a #detail-meta sin límite.
 */
function showFeatureIdentity(layerKey, row) {
  const spec = specOf(layerKey)
  const codigo = String(row[spec.idField] ?? '')
  const singular = noteFor(NOTE_BY_LAYER[layerKey]).label

  el.name.textContent = spec.titleField && row[spec.titleField]
    ? row[spec.titleField]
    : `${singular} ${codigo}`

  el.meta.textContent = spec.columns
    .filter((c) => row[c.field] !== undefined && row[c.field] !== '')
    .map((c) => `${c.label}: ${c.map ? c.map(row[c.field]) : row[c.field]}`)
    .join(' · ')

  el.note.replaceChildren(noteLink(NOTE_BY_LAYER[layerKey], `Qué es ${singular.toLowerCase()} →`))

  el.self.replaceChildren(
    isCode(codigo)
      ? downloadButton(featureUrl(layerKey, codigo), `Descargar ${singular.toLowerCase()}`)
      : disabledButton('Descargar', 'El INDEC no publicó el código de esta fila.'),
  )
}

function showRow(layerKey, row) {
  showFeatureIdentity(layerKey, row)
  el.self.append(backButton())
}
```

- [ ] **Step 6: Resolver el objeto sin catálogo en `src/pages/resultados.js`**

Importar `TYPES, LAYER_OF_TYPE` de `download.js`.

Reemplazar el bloque que hoy busca en el catálogo:

```js
      // El catálogo dice qué objetos se pueden buscar por nombre, no cuáles
      // existen: fracciones, radios y vías se resuelven contra el GeoServer,
      // que es quien los tiene.
      const obj = TYPES[url.type].catalogo
        ? c.objects.find((o) => o.t === url.type && o.c === url.code)
        : { t: url.type, c: url.code }
      if (!obj) return setStatus(el.status, `No hay ningún objeto con el código ${url.code} en el catálogo.`, true)
```

En `selectObject`, cambiar dos líneas y agregar el ocultamiento del bloque de hijas:

```js
  // Un objeto sin catálogo no tiene nombre publicado: el campo muestra su
  // código, que es como se llegó hasta acá.
  el.q.value = obj.n ?? obj.c
```

```js
  renderChildren(obj)
  // La fila 2 tiene dos mitades y cada una decide su visibilidad: un radio
  // no contiene nada, y una sección vacía enseña a ignorarla.
  el.rowChildren.hidden = el.children.children.length === 0
```

Agregar `rowChildren: document.querySelector('#row-children')` a `queryEls`.

Y en `showObjectIdentity`, contemplar el objeto sin nombre:

```js
function showObjectIdentity(obj) {
  el.name.textContent = obj.n ?? `${TYPES[obj.t].label} ${obj.c}`
  el.meta.textContent = obj.p && obj.p !== obj.n
    ? `${TYPES[obj.t].label} · ${obj.p} · código ${obj.c}`
    : `${TYPES[obj.t].label} · código ${obj.c}`
  el.note.replaceChildren(objectNoteLink(obj))
  el.self.replaceChildren(
    downloadButton(selfUrl(obj), `Descargar ${TYPES[obj.t].det} ${TYPES[obj.t].label.toLowerCase()}`),
  )
}
```

**`NOTE_BY_TYPE` ya tiene las ocho claves: lo hizo la Task 1, no ésta.** Estaba planificado acá y estaba mal: el test `'todo tipo direccionable tiene nota'` de `src/notes.test.js` itera `Object.keys(TYPES)`, así que extender la tabla de tipos sin extender el mapa de notas deja la suite en rojo desde el commit de la Task 1. Ninguna tarea puede dejar la suite en rojo entre commits, así que el arreglo se mudó a donde nace el problema. `objectNoteLink` funciona con los ocho tipos sin que esta tarea toque `src/notes.js`.

- [ ] **Step 7: Pintar la identidad con las propiedades cuando llegan**

En `drawObject`, para un objeto sin catálogo:

```js
function drawObject(obj) {
  showObject(obj)
    .then((drawn) => {
      // Un objeto sin catálogo llega a la página con nada más que su tipo y
      // su código: los campos que lo describen los trae el mismo pedido que
      // dibuja el mapa, así que la identidad se completa acá y no antes.
      if (drawn && !TYPES[obj.t].catalogo) {
        showFeatureIdentity(LAYER_OF_TYPE[obj.t], drawn.props, drawn.count)
      }
    })
    .catch((err) => {
      setStatus(el.status, `No se pudo dibujar el objeto en el mapa: ${err.message}. Las descargas siguen funcionando.`, true)
    })
}
```

Y `showFeatureIdentity` recibe ese conteo, porque en vías cambia lo que la ficha puede decir con verdad. Su firma pasa a `showFeatureIdentity(layerKey, row, count = 1)` y termina así:

```js
  // Una vía es la excepción: el código identifica la calle y sus tramos lo
  // comparten, así que `row` describe uno solo de los que el mapa está
  // dibujando. Los campos de tramo —alturas, id— mienten sobre la calle, así
  // que en su lugar la ficha dice cuántos tramos son. Es además el aviso de
  // duplicados que pide la nota de vías, acá gratis: el pedido ya volvió con
  // todos.
  if (layerKey === 'vias') {
    el.meta.textContent = count > 1
      ? `Código ${codigo} · el INDEC la publica partida en ${fmt(count)} tramos`
      : `Código ${codigo} · un solo tramo`
  }
```

insertado después de asignar `el.meta.textContent` con las columnas de la spec y antes del enlace a la nota. `fmt` ya está importado de `../ui.js`.

- [ ] **Step 8: Correr y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/map.js src/map.test.js src/pages/resultados.js src/pages/resultados.test.js src/notes.js resultados/index.html
git commit -m "feat: un radio, una fracción y un tramo tienen ficha propia"
```

---

### Task 4: «Ver» navega

Es la tarea más grande del plan y conviene saberlo antes de empezar. Medido el 2026-09-08 sobre el árbol:

| Pieza que muere | Referencias en `src/` |
|---|---|
| `onFeature` | 10 |
| `back-to-object` | 7 |
| `clearSelection` | 7 |
| `describeFeature` | 4 |
| `markRow` | 3 |
| **Citas a `NAV-R10`** (en `src/` y `docs/`) | **30** |

Más nueve bloques de `src/pages/resultados.test.js` que ejercitan el «Ver» que previsualiza y el «Volver» que restaura —entre ellos `'Ver dibuja la fila en el mapa y la deja marcada'`, `'dos Ver seguidos no acumulan'`, `'"volver" restaura la ficha del objeto y lo redibuja'` y el `describe('"Volver" no tira abajo la fila 3')`—. Esos tests prueban comportamiento que deja de existir: **se borran, no se adaptan.** Adaptarlos sería inventarles un objeto nuevo.

El grep de `NAV-R10` del Step 9 no es una formalidad: son treinta lugares, y este repo ya tuvo once comentarios huérfanos el día que murió NAV-R6.

**Files:**
- Modify: `src/pages/resultados.js` (`onView`; muere `showRow`, `backButton`, `describeFeature`)
- Modify: `src/browser.js` (`markRow` deja de marcar y de esperar)
- Modify: `src/pages/resultados.test.js`, `src/browser.test.js`
- Modify: `docs/reglas/navegacion.md` (NAV-R10 muere, nace NAV-R11)

**Interfaces:**
- Consumes: `TYPE_OF_LAYER` (Task 1), la ficha sin catálogo (Task 3).
- Produces: `createBrowser` ya no expone `clearSelection`. `onView(row, childKey)` no devuelve nada que el browser espere.

- [ ] **Step 1: Escribir los tests que fallan**

En `src/pages/resultados.test.js`:

El archivo ya inyecta un `navigate` falso para poder testear sin que jsdom navegue de verdad: reusar ese mecanismo, no inventar otro. El objeto de la ficha es el departamento `06840` del fixture, cuya primera pestaña es fracciones.

```js
describe('el "Ver" de una fila hija (NAV-R11)', () => {
  it('navega al permalink de esa fila en vez de reemplazar media ficha', async () => {
    await montar('?t=dep&c=06840')
    $('tbody tr .acts button').click()
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('t=frac'))
    expect(navigate.mock.calls[0][0]).toMatch(/c=\d{7}/)
  })

  it('no toca la ficha: la página se va, no se reescribe', async () => {
    await montar('?t=dep&c=06840')
    const antes = $('#detail-name').textContent
    $('tbody tr .acts button').click()
    expect($('#detail-name').textContent).toBe(antes)
  })

  it('ya no hay botón de volver: lo reemplaza el Atrás del navegador', async () => {
    await montar('?t=dep&c=06840')
    $('tbody tr .acts button').click()
    expect($('#back-to-object')).toBeNull()
  })

  it('el "Ver" de una vía tampoco pide la geometría: sólo navega (SITIO-R3)', async () => {
    await montar('?t=dep&c=06840&capa=vias')
    // La pestaña abre en su panel de costo; confirmarla para tener tabla.
    $('#browse button').click()
    await vi.waitFor(() => expect($('tbody tr')).not.toBeNull())
    const antes = fetchSpy.mock.calls.length
    $('tbody tr .acts button').click()
    expect(fetchSpy.mock.calls.length).toBe(antes)
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('t=via'))
  })
})
```

El último caso es el que más importa de este bloque: hoy ese clic cuesta 12,4 segundos medidos contra el GeoServer, y con «Ver» navegando no cuesta nada hasta que la ficha de destino los pida (Task 5).

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/pages/resultados.test.js`
Expected: FAIL — hoy `onView` pide el feature y reescribe `#detail`.

- [ ] **Step 3: Reemplazar `onView` en `src/pages/resultados.js`**

Agregar `TYPE_OF_LAYER` al import de `./download.js` —queda `import { selfUrl, TYPES, LAYER_OF_TYPE, TYPE_OF_LAYER, featureUrl, isCode } from '../download.js'`, con `childOf` fuera si ya no se usa—. `specOf` y `format` ya están importados.

```js
    /**
     * Una fila hija es un objeto direccionable como cualquier otro: verla es
     * ir a su ficha, no reemplazar media ficha de otro objeto. Eso es SITIO-R2
     * aplicado a un caso más, y es lo que borra el andamiaje entero que
     * existía para que la ficha y el mapa no se contradijeran (NAV-R11).
     */
    onView: (row, key) => {
      const codigo = String(row[specOf(key).idField])
      navigate(format({ t: TYPE_OF_LAYER[key], c: codigo }))
    },
```

- [ ] **Step 4: Borrar lo que quedó sin dueño en `src/pages/resultados.js`**

Se van, enteros:
- `showRow` (el envoltorio de la Task 3; `showFeatureIdentity` **queda**)
- `backButton`
- `describeFeature` y la línea `onFeature(describeFeature)`
- el import de `showFeature`, y además **`showFeature` y `featureQueryUrl` en `src/map.js`**, con los tests de `map.test.js` que las ejercitan. Estaban planificadas para la Task 3 y no se pudieron borrar ahí: su último llamador es el `onView` que esta tarea reemplaza, así que borrarlas antes dejaba la suite en 418/431 y el build en error. Ahora sí quedan sin llamador —la ficha de cualquier objeto se dibuja con `showObject`— y su docblock ya anuncia esta muerte, así que no hay que adivinar si se pueden sacar.
- el import de `childOf` si ya no se usa

`current` deja de hacer falta para el botón de volver, pero **sigue haciendo falta** para `onTab`: no borrarla.

- [ ] **Step 5: Simplificar `markRow` en `src/browser.js`**

`onView` ya no devuelve una promesa que valga la pena esperar, y marcar una fila de una página que está por desaparecer no dice nada. Reemplazar la llamada de `renderTable`:

```js
      const tableEl = renderTable(key, rows, (row, childKey) => onView(row, childKey))
```

Borrar `markRow` y `clearSelection`, y devolver sólo `{ show }`. Actualizar el comentario de cabecera de `createBrowser`, que hoy describe `clearSelection`.

**`VIAS_VIEW_NOTICE` no se borra: se exporta.** Deja de usarlo `markRow` pero lo va a usar la ficha de una vía en la Task 5, y este módulo es el único lugar del repo donde viven los costos medidos de vías: partirlos en dos archivos es cómo divergen. Cambiar su declaración a `export const VIAS_VIEW_NOTICE = …`, dejando el comentario que ya tiene.

- [ ] **Step 6: Sacar `clearSelection` de `resultados.js` y de los tests**

`grep -rn "clearSelection" src` y borrar cada uso. En `src/browser.test.js`, los casos que prueban la marca de fila y el estado «Viendo…» del botón dejan de tener objeto: borrarlos, no adaptarlos.

- [ ] **Step 7: Correr y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Matar NAV-R10 y escribir NAV-R11 en `docs/reglas/navegacion.md`**

Tachar el encabezado de NAV-R10 —`### ~~NAV-R10 — La ficha describe lo que el mapa está dibujando~~`— y reemplazar su cuerpo por:

```markdown
**Muerta:** el "Ver" de una fila dejó de reemplazar media ficha y pasó a navegar, así que ya no
hay dos objetos en la misma página que puedan contradecirse. La reemplaza NAV-R11.
```

Y agregar:

```markdown
### NAV-R11 — Un objeto por página

El "Ver" de una fila hija navega a la ficha de esa fila. No hay previsualización dentro de la
ficha de otro objeto: la página describe un solo objeto, y el mapa dibuja ése. Volver es el botón
Atrás del navegador, que funciona porque es navegación de verdad (SITIO-R2).

**Por qué:** NAV-R10 pedía que la ficha siguiera al mapa, y para cumplirlo hacían falta un panel
de identidad que se reemplazaba, un botón de volver que restauraba el anterior, un chequeo de
carrera para que un "Ver" de 12 s que llegaba tarde no pisara lo que se estaba mirando, y una
marca de fila que había que limpiar al volver. Cinco piezas para sostener una promesa que se
cumple sola si hay un solo objeto por página. Además la ficha estaba arriba de la tabla: el
cambio ocurría fuera de la pantalla y se sentía que no había pasado nada.
```

- [ ] **Step 9: Buscar comentarios que quedaron apuntando a la regla muerta**

Run: `grep -rn "NAV-R10" src scripts docs --include=*.js --include=*.mjs --include=*.md`

Cada cita en código pasa a NAV-R11 o se borra si el comentario describe algo que ya no existe. Este repo ya tuvo el problema cuando murió NAV-R6: once comentarios huérfanos.

- [ ] **Step 10: Commit**

```bash
git add src/pages/resultados.js src/browser.js src/pages/resultados.test.js src/browser.test.js docs/reglas/navegacion.md
git commit -m "feat: Ver navega, y con eso se caen las cinco piezas que sostenían NAV-R10"
```

---

### Task 5: La ficha de una vía no pide nada al abrirse

Es la promesa de SITIO-R3 y el test con control negativo obligatorio.

**Files:**
- Modify: `src/pages/resultados.js`
- Modify: `src/browser.js` (exportar el aviso de costo)
- Modify: `src/pages/resultados.test.js`
- Modify: `docs/reglas/sitio.md` (SITIO-R3)

**Interfaces:**
- Consumes: la ficha sin catálogo (Task 3).
- Produces: `VIAS_VIEW_NOTICE` exportado desde `src/browser.js`.

- [ ] **Step 1: Escribir los tests que fallan**

```js
describe('la ficha de una vía (SITIO-R3)', () => {
  const pidioVias = () => fetchSpy.mock.calls
    .map(([u]) => String(u))
    .some((u) => u.includes('vias_de_circulacion'))

  it('no dispara ningún pedido de vías al montarse', async () => {
    await montar('?t=via&c=0684001001810')
    expect(pidioVias()).toBe(false)
  })

  it('muestra el costo medido y un botón para cargar igual', async () => {
    await montar('?t=via&c=0684001001810')
    expect($('#detail').textContent).toContain('12 segundos')
    expect($('#load-feature')).not.toBeNull()
  })

  it('la descarga funciona antes de pedir nada: sólo necesita el código', async () => {
    await montar('?t=via&c=0684001001810')
    expect($('#detail-self a').href).toContain('0684001001810')
  })

  it('muestra sus padres sin pedir nada: salen del código', async () => {
    await montar('?t=via&c=0684001001810')
    // Localidad censal 06840010, departamento 06840 y jurisdicción 06.
    expect($('#parents').children.length).toBe(3)
    expect(pidioVias()).toBe(false)
  })

  it('recién el botón dispara el pedido', async () => {
    await montar('?t=via&c=0684001001810')
    $('#load-feature').click()
    await vi.waitFor(() => expect(pidioVias()).toBe(true))
  })

  // Verificado el 2026-09-08: un `cod_indec` de vías identifica la calle, no
  // el tramo, y hasta 80 filas lo comparten. La ficha describe la calle.
  it('cargada, dice en cuántos tramos está partida la calle', async () => {
    await montar('?t=via&c=0684001001810')
    $('#load-feature').click()
    await vi.waitFor(() => expect($('#detail-meta').textContent).toContain('tramos'))
    // El fixture de vías tiene que devolver más de un feature para este caso:
    // si hoy devuelve uno solo, duplicalo en el mock con el mismo cod_indec.
    expect($('#detail-meta').textContent).toMatch(/partida en \d+ tramos/)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/pages/resultados.test.js`
Expected: FAIL — hoy `drawObject` pide siempre.

- [ ] **Step 3: Exportar el aviso desde `src/browser.js`**

```js
export const VIAS_VIEW_NOTICE = 'El GeoServer tarda unos 12 segundos en traer la geometría de una vía.'
```

Vive acá y no en `resultados.js` porque este módulo ya es el dueño de todos los costos medidos de vías del repo; partirlos en dos archivos es cómo divergen.

- [ ] **Step 4: No pedir vías al montar, en `src/pages/resultados.js`**

Agregar el aviso al import que ya existe: `import { createBrowser, VIAS_VIEW_NOTICE } from '../browser.js'`.

En `selectObject`, reemplazar `drawObject(obj)` por:

```js
  // SITIO-R3: nada de vías se pide sin un acto explícito. Un enlace a un
  // tramo abre mostrando el costo medido y un botón, igual que la pestaña
  // (NAV-R7). Lo que sí funciona sin red es la descarga: sólo necesita el
  // código, que ya está en la URL.
  if (obj.t === 'via') el.self.append(loadFeatureButton(obj))
  else drawObject(obj)
```

Y agregar:

```js
/** El costo medido y el botón que sí dispara el pedido (SITIO-R3, NAV-R7). */
function loadFeatureButton(obj) {
  const wrap = document.createElement('div')
  const p = document.createElement('p')
  p.className = 'note'
  p.textContent = VIAS_VIEW_NOTICE
  const b = document.createElement('button')
  b.type = 'button'
  b.id = 'load-feature'
  b.className = 'btn ghost mini'
  b.textContent = 'Cargar igual'
  b.addEventListener('click', () => {
    b.disabled = true
    b.textContent = 'Cargando…'
    drawObject(obj)
  })
  wrap.append(p, b)
  return wrap
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run src/pages/resultados.test.js`
Expected: PASS.

- [ ] **Step 6: Control negativo obligatorio**

Cambiar la guarda por `if (false)` —o sea, dejar que `drawObject` corra siempre— y correr `npx vitest run src/pages/resultados.test.js`. **Tiene que fallar** el caso `'no dispara ningún pedido de vías al montarse'`. Deshacer el cambio.

Un test que no mata esa mutación no sostiene SITIO-R3, y SITIO-R3 es la única regla del sitio que protege a alguien que no pidió nada: el que abre un enlace que le mandaron.

- [ ] **Step 7: Reescribir SITIO-R3 en `docs/reglas/sitio.md`**

Cambiar el encabezado a `### SITIO-R3 — Nada de vías se pide sin un acto explícito del usuario` y agregar, después del primer párrafo:

```markdown
Vale para los dos caminos que llevan a vías desde un enlace. Un enlace con `capa=vias` abre la
pestaña en su panel de costo sin pedir nada, y un enlace a un tramo —`?t=via&c=…`— abre su ficha
mostrando el costo medido y un botón, sin pedir nada tampoco. En los dos casos la descarga
funciona igual, porque sólo necesita el código.

**Por qué el permalink de un tramo también:** traer un feature de vías con geometría tarda 12,4
segundos medidos. Ese es el mismo problema que esta regla ya resolvió para la pestaña, con el
mismo agravante: la espera se la come quien recibe el enlace, no quien lo mandó.
```

- [ ] **Step 8: Commit**

```bash
git add src/browser.js src/pages/resultados.js src/pages/resultados.test.js docs/reglas/sitio.md
git commit -m "fix: el enlace a un tramo le cobraba 12 segundos al que lo abría"
```

---

### Task 6: La página de la tabla viaja en el permalink

Sin esto, el Atrás de la Task 4 es peor que el «Volver» que reemplazó: devolvía a la página 3 y ahora devolvería a la 1.

**Files:**
- Modify: `src/permalink.js`
- Modify: `src/browser.js` (página inicial y aviso de cambio de página)
- Modify: `src/pages/resultados.js`
- Modify: `src/permalink.test.js`, `src/browser.test.js`, `src/pages/resultados.test.js`
- Modify: `docs/reglas/sitio.md` (SITIO-R2)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `parse(search)` devuelve además `page: number` (0-based interno; `pag=1` en la URL es `page: 0`).
  - `format(obj, layer = null, page = 0)` escribe `pag=` sólo si `page > 0`.
  - `createBrowser({ onPage })` avisa la página activa; `show(obj, initialLayer, initialPage)`.

- [ ] **Step 1: Escribir los tests que fallan, en `src/permalink.test.js`**

```js
describe('la página de la tabla en el permalink (SITIO-R2)', () => {
  it('pag es 1-based en la URL y 0-based adentro', () => {
    expect(parse('?t=dep&c=06469&capa=radios&pag=4')).toMatchObject({ page: 3 })
    expect(parse('?t=dep&c=06469&capa=radios&pag=1')).toMatchObject({ page: 0 })
  })

  it('sin capa no hay página que recordar', () => {
    expect(parse('?t=dep&c=06469&pag=4')).toMatchObject({ page: 0 })
  })

  it('una página que no es un entero positivo se ignora en vez de romper el enlace', () => {
    for (const malo of ['0', '-2', 'tres', '']) {
      expect(parse(`?t=dep&c=06469&capa=radios&pag=${malo}`)).toMatchObject({ status: 'ok', page: 0 })
    }
  })

  it('format no escribe la primera página', () => {
    expect(format({ t: 'dep', c: '06469' }, 'radios', 0)).not.toContain('pag=')
    expect(format({ t: 'dep', c: '06469' }, 'radios', 3)).toContain('pag=4')
  })

  it('sin capa no escribe página, aunque se la pasen', () => {
    expect(format({ t: 'dep', c: '06469' }, null, 3)).not.toContain('pag=')
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/permalink.test.js`
Expected: FAIL — `page` es `undefined`.

- [ ] **Step 3: Implementar en `src/permalink.js`**

Reemplazar el bloque final de `parse` —desde `const layer = p.get('capa')` hasta el `return`— por:

```js
  const capa = p.get('capa')
  const layer = capa && Object.hasOwn(CHILD_LAYERS, capa) ? capa : null

  // 1-based en la URL, 0-based adentro: el paginador dice "1–20 de 1.487", y
  // un enlace que dijera `pag=0` para la primera página sería un enlace que
  // no se puede leer. Sin capa abierta no hay tabla que paginar, así que la
  // página se ignora. Y una página inválida no invalida el enlace: el objeto
  // sigue siendo mostrable, que es la misma decisión que ya se tomó con una
  // capa que no existe.
  const pag = Number(p.get('pag'))
  const page = layer && Number.isInteger(pag) && pag > 0 ? pag - 1 : 0

  return {
    status: 'ok',
    type: t,
    code: c,
    layer,
    layerRequested: p.has('capa'),
    page,
  }
```

`Number('')` es `0`, que `pag > 0` descarta; `Number('tres')` es `NaN`, que `Number.isInteger` descarta. Los dos casos del test caen por caminos distintos y los dos terminan en `page: 0`.

Y en `format`:

```js
export function format(obj, layer = null, page = 0) {
  const p = new URLSearchParams({ t: obj.t, c: obj.c })
  if (layer) p.set('capa', layer)
  // La primera página no se escribe, igual que no se escribe la pestaña que
  // se abre sola: la barra dice lo que hace falta y nada más.
  if (layer && page > 0) p.set('pag', String(page + 1))
  return `${import.meta.env.BASE_URL}resultados/?${p}`
}
```

- [ ] **Step 4: Escribir el test del browser que falla, en `src/browser.test.js`**

```js
it('abre la pestaña en la página que le piden', async () => {
  const onPage = vi.fn()
  const browser = createBrowser({ container, onView: () => {}, onError: () => {}, onPage })
  browser.show(objConRadios, 'radios', 3)
  await tick()
  expect(fetchSpy.mock.calls[0][0]).toContain('startIndex=60')
})

it('avisa cada cambio de página', async () => {
  const onPage = vi.fn()
  const browser = createBrowser({ container, onView: () => {}, onError: () => {}, onPage })
  browser.show(objConRadios, 'radios')
  await tick()
  document.querySelector('.pager button:last-child').click()
  expect(onPage).toHaveBeenCalledWith('radios', 1)
})

// SITIO-R3: recordar la página no es motivo para pedirla.
it('una página inicial de vías no dispara ningún pedido', async () => {
  const browser = createBrowser({ container, onView: () => {}, onError: () => {}, onPage: () => {} })
  browser.show(objConVias, 'vias', 3)
  await tick()
  expect(fetchSpy).not.toHaveBeenCalled()
})
```

- [ ] **Step 5: Correr y verificar que falla**

Run: `npx vitest run src/browser.test.js`
Expected: FAIL.

- [ ] **Step 6: Implementar en `src/browser.js`**

`show(next, initialLayer = null, initialPage = 0)`. Después de `pages = new Map()`, sembrar la página inicial sólo para la capa pedida:

```js
    // La página inicial es de la capa que el enlace nombró y de ninguna otra:
    // sembrarla en todas haría que cambiar de pestaña arrancara en la página
    // 4 de una capa que nadie pidió.
    if (initialLayer && initialPage > 0) pages.set(initialLayer, initialPage)
```

En `createBrowser({ ..., onPage = () => {} })`, avisar en `load`:

```js
    pages.set(key, page)
    onPage(key, page)
```

**Cuidado:** `onPage` se llama desde `load`, que es justo el camino que vías no toma hasta que se confirma. Así el aviso llega cuando la página se pide de verdad, y una vía con `pag=3` sin confirmar no reescribe la barra afirmando algo que no está mostrando.

- [ ] **Step 7: Cablear en `src/pages/resultados.js`**

```js
    onTab: (layer) => {
      if (current && writeTab) window.history.replaceState({}, '', format(current, layer, 0))
    },
    onPage: (layer, page) => {
      if (current) window.history.replaceState({}, '', format(current, layer, page))
    },
```

Y pasar la página inicial: `el.rowBrowse.hidden = !browser.show(obj, initialLayer, initialPage)`, con `initialPage` llegando desde `selectObject(obj, url.layer, url.layerRequested, url.page)`.

- [ ] **Step 8: Correr y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Ampliar SITIO-R2 en `docs/reglas/sitio.md`**

Agregar, después del primer párrafo de SITIO-R2:

```markdown
El estado incluye la página de la tabla, no sólo el objeto y la pestaña: `pag=` es 1-based en el
enlace y no se escribe cuando vale 1. Sin eso, el Atrás del navegador —que es lo que reemplazó al
botón "Volver a <objeto>" cuando "Ver" pasó a navegar (NAV-R11)— devolvería a la primera página
de la tabla en vez de a la que se estaba mirando: sería una regresión respecto del botón que
reemplazó. Recordar la página no es pedirla: una vía con `pag=3` sigue sin disparar nada
(SITIO-R3).
```

- [ ] **Step 10: Commit**

```bash
git add src/permalink.js src/browser.js src/pages/resultados.js src/permalink.test.js src/browser.test.js src/pages/resultados.test.js docs/reglas/sitio.md
git commit -m "feat: el enlace recuerda también en qué página de la tabla estabas"
```

---

### Task 7: Buscar por código

**Files:**
- Modify: `src/search.js`
- Modify: `src/searchbox.js`
- Modify: `src/search.test.js`, `src/searchbox.test.js`
- Modify: `docs/reglas/buscador.md`, `docs/reglas/README.md`

**Interfaces:**
- Consumes: `TYPES[t].len` y `TYPES[t].catalogo` (Task 1); las fichas sin catálogo (Tasks 3 y 5).
- Produces: `codeMatches(query, { type })` en `src/search.js` → `Array<{ t, c, n, sintetico: true }>`.

- [ ] **Step 1: Escribir los tests que fallan, en `src/search.test.js`**

```js
describe('buscar por código (BUS-R5)', () => {
  const objetos = [
    { t: 'dep', c: '06469', n: 'Malvinas Argentinas', s: 'malvinas argentinas', sp: 'buenos aires' },
    { t: 'loc', c: '06469080', n: 'Grand Bourg', s: 'grand bourg', sp: 'buenos aires' },
  ]

  it('un código del catálogo devuelve su objeto y sólo ése', () => {
    expect(search(objetos, '06469').map((o) => o.c)).toEqual(['06469'])
  })

  it('el código gana a cualquier coincidencia de nombre (BUS-R4, nivel 0)', () => {
    const conHomonimo = [...objetos, { t: 'loc', c: '99999999', n: '06469', s: '06469', sp: 'x' }]
    expect(search(conHomonimo, '06469')[0].c).toBe('06469')
  })

  it('los ceros a la izquierda importan: el código es una cadena', () => {
    expect(search(objetos, '6469')).toEqual([])
  })

  it('siete, nueve y trece dígitos son fracción, radio y vía', () => {
    expect(codeMatches('0646908')).toMatchObject([{ t: 'frac', c: '0646908' }])
    expect(codeMatches('064690801')).toMatchObject([{ t: 'rad', c: '064690801' }])
    expect(codeMatches('0646908000600')).toMatchObject([{ t: 'via', c: '0646908000600' }])
  })

  it('un largo que es de un tipo del catálogo no arma fila sintética', () => {
    // Ese largo lo resuelve el catálogo, que es quien sabe si existe.
    expect(codeMatches('06469')).toEqual([])
  })

  it('el filtro de tipo también acota la búsqueda por código (BUS-R1)', () => {
    expect(codeMatches('064690801', { type: 'frac' })).toEqual([])
    expect(codeMatches('064690801', { type: 'rad' })).toHaveLength(1)
  })

  it('lo que no son puros dígitos no arma fila sintética', () => {
    expect(codeMatches('grand bourg')).toEqual([])
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/search.test.js`
Expected: FAIL — `codeMatches is not a function`.

- [ ] **Step 3: Implementar en `src/search.js`**

Importar `TYPES` de `./download.js`. Agregar:

```js
/**
 * Un código es la afirmación más literal que se puede escribir en el campo,
 * así que va arriba de cualquier coincidencia de nombre (BUS-R4, nivel 0).
 */
const CODE_RANK = -1

/**
 * Los tres tipos que no están en el catálogo, indexados por el largo de su
 * código. Son los únicos que no se pueden buscar por nombre —no lo tienen
 * (NAV-R4)—, así que el código es su único handle, y el largo alcanza para
 * saber cuál es: los ocho largos no colisionan.
 */
const SIN_CATALOGO_POR_LARGO = Object.fromEntries(
  Object.entries(TYPES).filter(([, v]) => !v.catalogo).map(([t, v]) => [v.len, t]),
)

const esCodigo = (q) => /^\d+$/.test(q)

/**
 * La fila sintética de un objeto sin catálogo. No pide nada: el pedido
 * ocurre recién en la ficha, si el usuario la elige. Es lo que deja que
 * tipear un código de vía no cueste los 12 segundos medidos hasta que se lo
 * pidió a propósito.
 */
export function codeMatches(query, { type = '' } = {}) {
  if (!esCodigo(query)) return []
  const t = SIN_CATALOGO_POR_LARGO[query.length]
  if (!t) return []
  if (type && type !== t) return []
  return [{ t, c: query, n: query, sintetico: true }]
}
```

Y dentro del `for` de `search`, antes de `const rank = rankOf(...)`:

```js
    if (esCodigo(q) && obj.c === q) {
      matches.push({ obj, rank: CODE_RANK })
      continue
    }
```

- [ ] **Step 4: Cablear en `src/searchbox.js`**

```js
  function runSearch() {
    if (!objects) return
    const q = input.value.trim()
    // Las dos listas nunca se pisan: ningún código del catálogo mide 7, 9 ni
    // 13 caracteres, que son los tres largos que arman fila sintética.
    combo.render([
      ...search(objects, q, { type: select.value }),
      ...codeMatches(q, { type: select.value }),
    ])
  }
```

Importar `codeMatches` de `./search.js`.

- [ ] **Step 5: Escribir y correr el test de que no toca la red, en `src/searchbox.test.js`**

```js
it('tipear el código de una vía no le pide nada al GeoServer (BUS-R5)', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  input.value = '0646908000600'
  input.dispatchEvent(new Event('input'))
  expect(document.querySelectorAll('#results li')).toHaveLength(1)
  expect(fetchSpy).not.toHaveBeenCalled()
})
```

Run: `npx vitest run src/searchbox.test.js`
Expected: PASS.

- [ ] **Step 6: Correr la suite entera y el build**

Run: `npm test && npm run build`
Expected: PASS y build exitoso.

- [ ] **Step 7: Escribir BUS-R5 y ampliar BUS-R4 en `docs/reglas/buscador.md`**

En BUS-R4, agregar arriba de la lista: `0. la consulta es el código exacto de un objeto`, y en el `**Por qué:**` una frase: «El código va primero porque es la afirmación más literal que se puede escribir en ese campo: quien lo escribe sabe exactamente qué quiere.»

Y al final de la sección:

```markdown
### BUS-R5 — Se busca por código, los ocho tipos, sin pedir nada hasta que elegís

Una consulta de puros dígitos se resuelve por coincidencia exacta contra el código del catálogo,
para los cinco tipos que están ahí. Para los tres que no están —fracción, radio y vía— el largo
del código dice cuál es: 7, 9 y 13 dígitos, y ninguno de esos largos lo usa un tipo del catálogo.
Esos tres aparecen como una fila armada del código, **sin un solo pedido al GeoServer**: el pedido
ocurre recién en la ficha, si el usuario la elige.

Los ceros a la izquierda importan: el código es una cadena y la coincidencia es exacta. `6840` no
encuentra el departamento `06840`, y tampoco inventa un aglomerado de cuatro dígitos.

**Por qué:** fracciones y radios no tienen nombre publicado (NAV-R4), así que el código es el
único handle que tienen; sin esto no hay forma de llegar a un radio salvo bajando por la ficha de
su padre. Y que la fila sintética no toque la red es la mitad del diseño: tipear un código no
puede costar los 12 segundos medidos de un feature de vías. Esa espera se paga dos veces a
propósito —al elegir la fila y al apretar "Cargar igual" en la ficha (SITIO-R3)—, siempre después
de un acto del usuario.
```

- [ ] **Step 8: Actualizar el índice de `docs/reglas/README.md`**

`buscador` pasa a `BUS-R1 … BUS-R5`; `navegacion` a `NAV-R1 … NAV-R11`.

- [ ] **Step 9: Commit**

```bash
git add src/search.js src/searchbox.js src/search.test.js src/searchbox.test.js docs/reglas/buscador.md docs/reglas/README.md
git commit -m "feat: un radio no tiene nombre, así que se busca por su código"
```
