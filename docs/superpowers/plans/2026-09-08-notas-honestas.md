# Notas honestas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacar del sitio todo lo que lo hace pasar por oficial, y reescribir las notas que hoy dicen algo falso o callan lo que importa.

**Architecture:** Dos superficies independientes. El shell (`src/shell/footer.html` y los cuatro `<title>`) se resuelve en build y no tiene JS. Las notas viven enteras en `src/notes.js` como datos, y `src/pages/notas.js` sólo las cablea contra el DOM. Nada de esto toca el buscador, la ficha, el mapa ni las descargas.

**Tech Stack:** Vite 6, Vitest 2 + jsdom, JavaScript ESM sin framework. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-09-08-notas-honestas-design.md`

## Global Constraints

- **Sin dependencias nuevas.** Sitio estático bajo `base: '/indec-descargas/'`.
- **Castellano en la interfaz, inglés en el código.** Los comentarios de este repo son en castellano y explican *por qué*, no *qué*. Seguir ese registro.
- **Ningún número sobre el INDEC se escribe de memoria.** Sale del catálogo commiteado, de una respuesta del servidor, o de una fuente externa nombrada en el texto.
- **Valores verificados el 2026-09-08. Usar textualmente, no recalcular:**
  - Localidades censales del partido `06840`: **1**, la `06840010`, publicada por el INDEC como `fna="Localidad Tres de Febrero"`, `gna="Localidad"`, `tlc=2`, aglomerado Gran Buenos Aires.
  - Localidades censales llamadas Caseros, Ciudadela, Sáenz Peña o Villa Bosch **en Buenos Aires**: **0**.
  - Partidos del Gran Buenos Aires donde la única localidad censal es homónima del partido y `tlc=2`: **28**.
  - Tramos de vía llamados `CALLE SN`: **20.613**. Con alguna altura: **97.073** de **477.588** = **20,3 %**.
  - IGN: **2.114** municipios, **3.528** localidades BAHRA, **529** departamentos. INDEC: **2.282** gobiernos locales, **4.023** localidades censales, **529** departamentos.
  - Localidades censales de CABA en el catálogo: **15**, `CABA - Comuna 1` … `CABA - Comuna 15`.
  - Radios por tipo, medidos contra el GeoServer: **54.459** urbanos (`tro='U'`), **9.347** rurales (`tro='R'`), **2.683** mixtos (`tro='M'`). Suman 66.489 de los 66.515 publicados: **26** no traen tipo.
- **Sólo dos fuentes externas se pueden citar, y son las únicas cuyo enlace resuelve** (verificado el 2026-09-08; el resto de lo que trajo el research quedó afuera, ver abajo):
  - Marco Geoestadístico (PDF, HTTP 200, leído) → `https://www.indec.gob.ar/ftp/cuadros/geoestadistica/marco_geoestadistico_nacional.pdf`
  - IGN Unidades Territoriales (HTTP 200) → `https://www.ign.gob.ar/ut/`
- **Citas del Marco Geoestadístico verificadas textuales contra el PDF. Usar así, no parafrasear:**
  - Localidad censal: «Unidad territorial caracterizada por la concentración espacial de edificaciones conectadas entre sí a través de redes de vías de circulación, terrestres o navegables. Se identifica por un nombre establecido por ley o costumbre. La delimitación de la localidad censal se realiza de acuerdo con el criterio de continuidad física.»
  - Entidad censal: «unidad territorial que identifica una subdivisión de la localidad censal dentro de una misma área político-administrativa.»
  - Zona rural: «Área comprendida entre el perímetro de la localidad censal y el límite del departamento, donde se puede localizar población rural dispersa.»
  - Departamento: «Se denomina partido en la provincia de Buenos Aires, departamento en el resto de las provincias y comuna en la Ciudad Autónoma de Buenos Aires.»
  - Radio censal: «Con fines estadísticos, el radio se clasifica en urbano, rural o mixto.»
- **Prohibido citar, porque no se pudo verificar** (los tres se probaron el 2026-09-08 y fallaron): que los límites del INDEC salen de las direcciones provinciales de estadística (el API v2 y el CSW del GeoNode no responden; la frase no está en el PDF ni en el `Abstract` del WMS); el umbral urbano/rural de 2.000 habitantes y su origen en 1914 (`repositorio.inta.gob.ar` devuelve 000 por http y https, y «2.000» no aparece en el PDF del MGN); y `bahra.gob.ar` como enlace (devuelve 000 — el dato de BAHRA se cita como del IGN, que es de donde lo medí).
- **Comandos:** `npm test` corre la suite. `npx vitest run src/notes.test.js` corre un archivo. `npm run build` construye.

## Estructura de archivos

**Se modifican:**
- `src/shell/footer.html` — pie sin bloque institucional, con descargo y el aviso de límites corregido
- `src/style.css` — se va la regla huérfana de `.org` si existe
- `index.html`, `resultados/index.html`, `notas/index.html`, `servicios/index.html` — `<title>` sin `— INDEC`
- `notas/index.html` — nodo nuevo para la lista de fuentes
- `src/notes.js` — campo `sources` y el texto de cinco notas
- `src/pages/notas.js` — render de las fuentes
- `src/notes.test.js` — gate de fuentes, gate del caso Tres de Febrero, y baja del andamiaje de "las dos notas que ya existían"
- `scripts/shell.test.mjs`, `src/pages/servicios.test.js` — hoy afirman el pie institucional
- `docs/reglas/sitio.md` — SITIO-R9
- `docs/reglas/notas.md` — NOTA-R2 ampliada
- `docs/reglas/README.md` — el rango de SITIO pasa a R1…R9

---

### Task 1: El pie deja de ser institucional

**Files:**
- Modify: `src/shell/footer.html` (archivo entero)
- Modify: `src/style.css` (regla de `.org`, si existe)
- Modify: `scripts/shell.test.mjs:139`
- Modify: `src/pages/servicios.test.js:49`
- Modify: `docs/reglas/sitio.md`, `docs/reglas/README.md`

**Interfaces:**
- Consumes: nada.
- Produces: el pie que las cuatro páginas inyectan en build. Ningún módulo JS lo lee; sólo los tests.

- [ ] **Step 1: Escribir el test que falla, en `scripts/shell.test.mjs`**

Reemplazar el caso de `:139` que hoy dice `expect(html).toContain('Instituto Nacional de Estadística y Censos')` por este bloque:

```js
  it('ninguna página lleva el bloque institucional del INDEC (SITIO-R9)', () => {
    for (const p of paginas) {
      const html = injectShell(readFileSync(resolve(process.cwd(), p), 'utf8'), {
        partials: readPartials(), base: '/indec-descargas/', generated: '',
      })
      expect(html, `${p} todavía trae el nombre del organismo como firma`)
        .not.toContain('Instituto Nacional de Estadística y Censos')
      expect(html, `${p} todavía trae la dirección del INDEC`).not.toContain('Roca 609')
      expect(html, `${p} todavía trae el teléfono del INDEC`).not.toContain('5031-4632')
    }
  })

  it('las cuatro páginas dicen que el sitio no es oficial (SITIO-R9)', () => {
    for (const p of paginas) {
      const html = injectShell(readFileSync(resolve(process.cwd(), p), 'utf8'), {
        partials: readPartials(), base: '/indec-descargas/', generated: '',
      })
      expect(html, `${p} no lleva el descargo`).toContain('Sitio no oficial')
      expect(html, `${p} no dice que no representa al INDEC`)
        .toContain('No pertenece al INDEC ni lo representa')
    }
  })

  it('el aviso de límites nombra a quién sí los publica (SITIO-R9)', () => {
    const footer = readPartials().footer
    expect(footer).toContain('cada dirección provincial de estadística')
    expect(footer).toContain('https://www.ign.gob.ar/ut/')
  })
```

Si el `describe('las páginas del sitio')` ya define `paginas`, reusar esa constante en vez de redeclararla.

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run scripts/shell.test.mjs`
Expected: FAIL — los tres casos nuevos. El primero falla porque el bloque sigue ahí; el segundo porque el descargo no existe; el tercero porque el aviso todavía es la paráfrasis vieja.

- [ ] **Step 3: Reescribir `src/shell/footer.html` entero**

```html
<footer class="site-footer">
  <p class="warning">
    <strong>Sitio no oficial.</strong> No pertenece al INDEC ni lo representa. Publica datos que
    el INDEC distribuye abiertamente.
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
    Los límites del INDEC son los que usa cada dirección provincial de estadística para armar su
    base geográfica, no los del IGN ni los de la ley. La cartografía censal se elabora con fines
    estadísticos: usarla para otra cosa queda bajo tu responsabilidad. Los límites oficiales los
    publica el <a href="https://www.ign.gob.ar/ut/">IGN</a>.
  </p>
  <p id="generated" class="meta">{{generated}}</p>
</footer>
```

- [ ] **Step 4: Sacar la regla CSS que quedó sin dueño**

Run: `grep -n "\.org" src/style.css`

Si aparece una regla para `.site-footer .org` o `.org`, borrarla. Este repo ya tuvo un commit por una regla CSS huérfana (`2aff358`); dejar otra es repetir el mismo defecto. Si `grep` no devuelve nada, no hay nada que hacer y se pasa al paso siguiente.

- [ ] **Step 5: Arreglar el test de servicios que afirma el pie viejo**

En `src/pages/servicios.test.js:49`, `expect(html).toContain('Roca 609')` pasa a:

```js
    expect(html).toContain('Sitio no oficial')
```

- [ ] **Step 6: Correr la suite entera y verificar que pasa**

Run: `npm test`
Expected: PASS. Si `src/style.test.js` afirma la regla `.org`, sacar ese caso también: su motivo era que la regla existiera para un nodo que existía.

- [ ] **Step 7: Escribir SITIO-R9 en `docs/reglas/sitio.md`**

Al final de la sección `## ✅ Reglas`:

```markdown
### SITIO-R9 — El sitio dice que no es del INDEC, en las cuatro páginas

El pie de las cuatro páginas abre con un descargo de que el sitio no es oficial ni representa al
INDEC. No hay bloque institucional —nombre, dirección, teléfono del organismo— en ninguna página,
y ningún `<title>` lleva el nombre del INDEC como firma. La atribución de licencia y el enlace a
la fuente sí quedan: son del dato, no del sitio.

El aviso de límites nombra de dónde salen: son los que usa cada dirección provincial de
estadística, no los del IGN ni los de la ley, y enlaza a quién sí publica los oficiales. Eso no
sale del Marco Geoestadístico —el PDF no trae ningún descargo de oficialidad— sino de los
metadatos de las capas del GeoNode.

**Por qué:** un pie que abre con la dirección y el teléfono del INDEC es el pie que pondría el
INDEC. Nada en el sitio afirmaba ser oficial y aun así el conjunto —vocabulario del organismo,
capas del organismo, datos de contacto del organismo— lo daba a entender. La diferencia importa
cuando alguien baja un límite y lo usa para algo: quién responde por ese archivo es el INDEC, y
quién no responde por nada es este sitio.
```

- [ ] **Step 8: Actualizar el índice de `docs/reglas/README.md`**

La fila de `sitio` pasa de `SITIO-R1 … SITIO-R8` a `SITIO-R1 … SITIO-R9`.

- [ ] **Step 9: Commit**

```bash
git add src/shell/footer.html src/style.css scripts/shell.test.mjs src/pages/servicios.test.js src/style.test.js docs/reglas/sitio.md docs/reglas/README.md
git commit -m "fix: el pie dejaba entender que este sitio es del INDEC"
```

---

### Task 2: Los títulos dejan de firmar como INDEC

**Files:**
- Modify: `index.html:6`, `resultados/index.html:6`, `notas/index.html:6`, `servicios/index.html:6`
- Modify: `scripts/shell.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: nada que ningún módulo lea.

- [ ] **Step 1: Escribir el test que falla**

En `scripts/shell.test.mjs`, dentro de `describe('las páginas del sitio')`:

```js
  it('ningún título firma con el nombre del organismo (SITIO-R9)', () => {
    for (const p of paginas) {
      const html = readFileSync(resolve(process.cwd(), p), 'utf8')
      const titulo = html.match(/<title>([^<]*)<\/title>/)[1]
      expect(titulo, `${p} firma su título como INDEC`).not.toMatch(/—\s*INDEC\s*$/)
    }
  })
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run scripts/shell.test.mjs`
Expected: FAIL en las cuatro páginas.

- [ ] **Step 3: Sacar el sufijo de los cuatro títulos**

| Archivo | Título nuevo |
|---|---|
| `index.html` | `Descargas del Marco Geoestadístico Nacional` |
| `resultados/index.html` | `Descargar un objeto del Marco Geoestadístico` |
| `notas/index.html` | `Notas sobre los objetos del Marco Geoestadístico` |
| `servicios/index.html` | `Servicios geoespaciales del INDEC` |

El de `/servicios/` no pierde el nombre del organismo: ahí «INDEC» es el tema de la página, no una firma. Lo que se va es el sufijo repetido.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html resultados/index.html notas/index.html servicios/index.html scripts/shell.test.mjs
git commit -m "fix: el título de las cuatro páginas firmaba como si fueran del INDEC"
```

---

### Task 3: Una nota puede citar una fuente externa

**Files:**
- Modify: `src/notes.js` (comentario de cabecera + campo `sources`)
- Modify: `src/pages/notas.js` (render)
- Modify: `notas/index.html` (nodo)
- Modify: `src/notes.test.js` (gate)
- Modify: `docs/reglas/notas.md` (NOTA-R2)

**Interfaces:**
- Consumes: nada.
- Produces: `NOTES[n].sources?: Array<{ label: string, href: string }>`. Las tareas 4 a 7 lo llenan. `src/pages/notas.js` lo dibuja bajo el cuerpo de la nota.

- [ ] **Step 1: Escribir los tests que fallan, en `src/notes.test.js`**

Agregar al final del archivo:

```js
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
```

Y en `src/pages/notas.test.js`:

```js
  it('la nota que cita fuentes las muestra con su enlace (NOTA-R2)', () => {
    const conFuentes = NOTES.find((n) => n.sources?.length)
    location.hash = conFuentes.slug
    initNotas()
    const enlaces = [...document.querySelectorAll('#nota-fuentes a')]
    expect(enlaces).toHaveLength(conFuentes.sources.length)
    expect(enlaces[0].href).toBe(conFuentes.sources[0].href)
    expect(enlaces[0].textContent).toBe(conFuentes.sources[0].label)
  })
```

Importar `NOTES` en ese archivo si no está.

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/notes.test.js src/pages/notas.test.js`
Expected: los tres primeros PASAN en vacío (ninguna nota tiene `sources` todavía) y el de `notas.test.js` FALLA con `Cannot read properties of undefined` sobre `conFuentes.slug`. Ese es el rojo que importa: el mecanismo no existe.

- [ ] **Step 3: Agregar `sources` a una nota y el comentario de cabecera en `src/notes.js`**

En el bloque de comentario de arriba del archivo, agregar:

```js
 * `sources` es la mitad nueva de NOTA-R2: una nota puede afirmar algo que
 * no sale del catálogo ni del GeoServer si nombra la fuente en el texto y
 * deja el enlace a la vista. Esa mitad no tiene gate que valga: ninguna
 * máquina compara prosa castellana con un PDF de la UBA. Lo único que la
 * suite puede acorralar es que no haya afirmación externa huérfana —cada
 * `label` tiene que aparecer literal en algún párrafo—, y eso es lo que
 * hace.
```

Como semilla del mecanismo, agregar `sources` a la nota `departamento`, que es la más corta de tocar. Su primer párrafo ya cuenta que el nombre cambia por provincia; agregar un cuarto párrafo que diga de dónde sale eso:

```js
      'Que se llame partido, departamento o comuna no es costumbre local: lo fija el Marco Geoestadístico, que define al departamento como la división político-administrativa de segundo nivel y aclara que «se denomina partido en la provincia de Buenos Aires, departamento en el resto de las provincias y comuna en la Ciudad Autónoma de Buenos Aires».',
```

y el campo, después de `paragraphs`:

```js
    sources: [
      { label: 'Marco Geoestadístico', href: 'https://www.indec.gob.ar/ftp/cuadros/geoestadistica/marco_geoestadistico_nacional.pdf' },
    ],
```

Esa cita está verificada textual contra el PDF el 2026-09-08.

- [ ] **Step 4: Agregar el nodo en `notas/index.html`**

Dentro de `<article class="nota-panel">`, después de `<div id="nota-cuerpo" class="nota-body"></div>`:

```html
          <ul id="nota-fuentes" class="nota-fuentes"></ul>
```

- [ ] **Step 5: Dibujar las fuentes en `src/pages/notas.js`**

Agregar la función, arriba de `render()`:

```js
/**
 * Las fuentes externas de una nota (NOTA-R2). La lista queda vacía —y por
 * lo tanto invisible— en las notas que sólo afirman lo que el catálogo y el
 * GeoServer ya sostienen, que son la mayoría.
 */
function renderFuente({ label, href }) {
  const li = document.createElement('li')
  const a = document.createElement('a')
  a.href = href
  a.textContent = label
  a.rel = 'noopener'
  a.target = '_blank'
  li.append(a)
  return li
}
```

Y dentro de `render()`, después de `cuerpo.replaceChildren(...)`:

```js
  const fuentes = document.querySelector('#nota-fuentes')
  if (fuentes) fuentes.replaceChildren(...(note.sources ?? []).map(renderFuente))
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npx vitest run src/notes.test.js src/pages/notas.test.js`
Expected: PASS.

- [ ] **Step 7: Romper a mano y ver el rojo**

Cambiar el `label` de la fuente de `departamento` a `'metadatos que la nota no nombra'` y correr `npx vitest run src/notes.test.js`. Tiene que fallar con «enlaza a «metadatos que la nota no nombra» sin nombrarla en el texto». Deshacer el cambio. Un gate que no mata esa mutación no sostiene NOTA-R2.

- [ ] **Step 8: Ampliar NOTA-R2 en `docs/reglas/notas.md`**

Después del párrafo que empieza «Los totales que una nota declara…», antes del `**Por qué:**`, agregar:

```markdown
Una nota puede además afirmar algo que no sale del catálogo ni del GeoServer, **si nombra la
fuente en el texto y deja el enlace a la vista** (`sources` en `notes.js`, dibujado bajo la nota).
Esa mitad de la regla no tiene gate: ninguna máquina compara prosa castellana con un PDF de la
UBA. Lo sostiene una afirmación humana, y por eso la nota tiene que decir de quién es el dato en
vez de absorberlo como si fuera propio. Lo único que la suite acorrala es que no quede una
afirmación externa huérfana: cada fuente declarada tiene que estar nombrada en algún párrafo.

Lo verificable contra el catálogo o el GeoServer sigue bajo el gate automático, sin excepción:
que ahora se admita fuente externa no es permiso para dejar de chequear lo que sí se puede
chequear.
```

- [ ] **Step 9: Commit**

```bash
git add src/notes.js src/notes.test.js src/pages/notas.js src/pages/notas.test.js notas/index.html docs/reglas/notas.md
git commit -m "feat: una nota puede citar una fuente externa, si la nombra en el texto"
```

---

### Task 4: La nota de localidad censal deja de tranquilizar

Es la corrección que motiva todo el plan. Hoy el párrafo tres usa Tres de Febrero como el caso que tranquiliza —«al revés también pasa»— cuando es el que más engaña.

**Files:**
- Modify: `src/notes.js` (nota `localidad-censal`)
- Modify: `src/notes.test.js` (gate del caso + baja del andamiaje viejo)

**Interfaces:**
- Consumes: `sources` de la Task 3.
- Produces: nada nuevo.

- [ ] **Step 1: Escribir el test que falla, en `src/notes.test.js`**

```js
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
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/notes.test.js`
Expected: los dos primeros PASAN (son hechos del catálogo que ya son ciertos); el tercero y el cuarto FALLAN porque la nota todavía no dice esas frases. Ése es el rojo buscado: el gate ya funciona y lo que falta es el texto.

- [ ] **Step 3: Reescribir la nota `localidad-censal` en `src/notes.js`**

Reemplazar sus `paragraphs` enteros y agregar `sources`:

```js
    paragraphs: [
      '«Localidad censal» no es lo que en la conversación diaria se llama localidad. Es una unidad del Marco Geoestadístico y a menudo no coincide con el municipio ni con el partido del mismo nombre.',
      'El Marco Geoestadístico la define por continuidad física: una concentración de edificaciones conectadas entre sí por vías de circulación. No la define una ley, ni un límite municipal, ni quién cobra los impuestos ahí.',
      'Buscando Avellaneda, el INDEC publica tres objetos distintos con el mismo nombre y límites diferentes: «Partido de Avellaneda» (departamento, 06035), «Municipio Avellaneda» (gobierno local, 060035) y «Localidad Avellaneda» (localidad censal, 06035010, dentro del aglomerado Gran Buenos Aires). Quien dice «la localidad de Avellaneda» casi siempre se refiere al partido o al municipio.',
      'El caso que más engaña es el contrario, y conviene mirarlo despacio. El partido de Tres de Febrero tiene una sola localidad censal, la 06840010, y abarca el partido entero: el INDEC la publica con el nombre «Localidad Tres de Febrero», que no usa nadie. Caseros, Ciudadela, Sáenz Peña y Villa Bosch —los pueblos donde vive esa gente— no existen en esta capa. Son entidades, y las entidades no se publican acá. Pasa en 28 partidos del Gran Buenos Aires, todos marcados como componente de aglomerado: ahí la unidad del INDEC es el partido, no el pueblo.',
      'Tampoco es la única forma oficial de contar localidades. El IGN publica 3.528 localidades —las de BAHRA, la base de asentamientos que mantiene junto al INDEC— donde esta capa publica 4.023 localidades censales, y cuenta a la Ciudad Autónoma de Buenos Aires como una sola localidad donde el INDEC la parte en quince, una por comuna.',
      'Y una localidad censal no delimita lo urbano. El Marco Geoestadístico llama zona rural al «área comprendida entre el perímetro de la localidad censal y el límite del departamento», así que todo lo que queda afuera es rural por definición, haya lo que haya ahí. Adentro tampoco es todo urbano: el propio INDEC clasifica cada radio censal en urbano, rural o mixto.',
    ],
    sources: [
      { label: 'Marco Geoestadístico', href: 'https://www.indec.gob.ar/ftp/cuadros/geoestadistica/marco_geoestadistico_nacional.pdf' },
      { label: 'IGN', href: 'https://www.ign.gob.ar/ut/' },
    ],
```

- [ ] **Step 4: Bajar el andamiaje que afirmaba que esta nota estaba intacta**

En `src/notes.test.js`, del `describe('las dos notas que ya existían')` sacar el caso `'localidad censal conserva sus tres párrafos intactos'` entero. Su motivo era documentar una mudanza sin cambios; la mudanza terminó.

Y sacar `'localidad-censal'` del `Set` `SIN_TOTAL_EN_PROSA`: la nota ahora afirma sus 4.023 en prosa, así que entra al gate de totales como cualquier otra.

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run src/notes.test.js`
Expected: PASS, incluido el gate viejo `'el número que la prosa afirma es el mismo que verifica el catálogo'`, que ahora cubre esta nota.

- [ ] **Step 6: Romper a mano y ver el rojo**

Cambiar `28 partidos del Gran Buenos Aires` por `32 partidos del Gran Buenos Aires` en la nota y correr `npx vitest run src/notes.test.js`. Tiene que fallar. Deshacer. (32 era el número que trajo el research y que el catálogo desmintió: es exactamente la clase de error que este gate existe para cazar.)

- [ ] **Step 7: Commit**

```bash
git add src/notes.js src/notes.test.js
git commit -m "fix: la nota usaba Tres de Febrero como el caso que tranquiliza, y es el que engaña"
```

---

### Task 5: La nota de vías advierte en vez de describir

**Files:**
- Modify: `src/notes.js` (nota `via-de-circulacion`)
- Modify: `src/notes.test.js`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: nada nuevo.

- [ ] **Step 1: Escribir el test que falla, en `src/notes.test.js`**

Dentro del `describe('los números que afirma una nota (NOTA-R2)')`:

```js
  it('vías advierte para qué no sirve, con los números medidos', () => {
    const texto = noteFor('via-de-circulacion').paragraphs.join(' ')
    expect(texto).toContain('20.613')
    expect(texto).toContain('97.073')
    expect(texto).toContain('20,3')
    expect(texto).toContain('CALLE SN')
  })
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/notes.test.js`
Expected: FAIL — la nota no dice ninguno de esos números.

- [ ] **Step 3: Reescribir la nota `via-de-circulacion` en `src/notes.js`**

```js
    paragraphs: [
      'Esta capa no lista calles: lista tramos, y eso es una advertencia, no un detalle. Una misma calle aparece tantas veces como tramos tenga su geometría, y las filas comparten nombre, código y altura: nada en la tabla las distingue salvo un id interno. En Tres de Febrero, las 1.487 filas son 727 calles, y la más partida llega a 80 tramos idénticos.',
      'Tampoco es un nomenclador de direcciones, aunque el nombre lo sugiera. De los 477.588 tramos, 20.613 se llaman literalmente «CALLE SN» —el INDEC no publicó su nombre— y sólo 97.073, el 20,3%, traen alguna altura. Para buscar una dirección esta capa no alcanza.',
      'Se muestra tal como lo publica el INDEC, sin agrupar, para que lo que ves acá sea lo mismo que baja el archivo. Descargar en cualquier fila de una calle trae la calle entera, con todos sus tramos: el filtro es por código, no por tramo.',
    ],
```

- [ ] **Step 4: Bajar el andamiaje que afirmaba que esta nota estaba intacta**

En `src/notes.test.js`, sacar del `describe('las dos notas que ya existían')` el caso `'vías conserva su texto intacto'`. Con eso el `describe` queda vacío: borrarlo entero, junto con su comentario.

Sacar `'via-de-circulacion'` de `SIN_TOTAL_EN_PROSA`. El `Set` queda vacío: borrar la constante, el `continue` que la usa y el caso `'las exceptuadas lo están porque no afirman su total, no por costumbre'`, y dejar el gate de prosa corriendo sobre las ocho notas sin excepciones. El comentario de arriba de la constante ya anticipaba esto («una nota nueva entra al gate sola»); reescribirlo para decir que ya no hay exceptuadas.

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npm test`
Expected: PASS. Si el gate de prosa falla en alguna de las ocho notas, es porque esa nota no afirma su total: agregarlo al texto, no volver a poner la excepción.

- [ ] **Step 6: Commit**

```bash
git add src/notes.js src/notes.test.js
git commit -m "fix: vías describía que son tramos donde tenía que advertirlo"
```

---

### Task 6: La columna Tipo de radios dice "M" y la nota no lo explica

Son dos cosas que son una sola: la tabla muestra hoy una `M` cruda en 2.683 filas —`columns.js` mapea `U` y `R` y nada más— y la nota no dice qué significa esa columna. Escribir la nota sin arreglar el mapeo la haría mentir sobre la tabla que explica.

**Files:**
- Modify: `src/columns.js` (`urbanoRural`)
- Modify: `src/columns.test.js`
- Modify: `src/notes.js` (nota `radio-censal`)
- Modify: `src/notes.test.js`

**Interfaces:**
- Consumes: `sources` de la Task 3.
- Produces: nada nuevo.

- [ ] **Step 1: Escribir los tests que fallan**

En `src/columns.test.js`:

```js
  it('el tipo de radio tiene tres valores, no dos (MGN)', () => {
    const tipo = specOf('radios').columns.find((c) => c.field === 'tro')
    expect(tipo.map('U')).toBe('Urbano')
    expect(tipo.map('R')).toBe('Rural')
    // 2.683 radios son mixtos y hasta hoy mostraban una "M" cruda.
    expect(tipo.map('M')).toBe('Mixto')
  })

  // Un valor que el INDEC no documentó se muestra tal cual: no se inventa
  // un rótulo (DES-R8).
  it('un tipo desconocido pasa sin traducir', () => {
    expect(specOf('radios').columns.find((c) => c.field === 'tro').map('X')).toBe('X')
  })
```

En `src/notes.test.js`:

```js
  it('radio censal explica qué significa su columna Tipo, con los tres valores', () => {
    const texto = noteFor('radio-censal').paragraphs.join(' ')
    expect(texto).toContain('mixto')
    expect(texto).toContain('54.459')
    expect(texto).toContain('9.347')
    expect(texto).toContain('2.683')
  })
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run src/columns.test.js src/notes.test.js`
Expected: FAIL — `tipo.map('M')` devuelve `'M'`, y la nota no dice ninguno de los tres números.

- [ ] **Step 3: Mapear el tercer valor en `src/columns.js`**

```js
// El Marco Geoestadístico clasifica el radio en urbano, rural o mixto: son
// tres, no dos. Los 2.683 mixtos medidos mostraban una "M" cruda en la
// tabla. Cualquier otro valor pasa sin traducir —el INDEC no documentó un
// cuarto, y los 26 radios que no traen ninguno son un dato que falta, no un
// rótulo que inventar (DES-R8)—.
const urbanoRural = (v) => (v === 'U' ? 'Urbano' : v === 'R' ? 'Rural' : v === 'M' ? 'Mixto' : v)
```

- [ ] **Step 4: Agregar el párrafo a la nota `radio-censal`**

Insertar como segundo párrafo, después del que dice «Son 66.515…», y agregar `sources`:

```js
      'La columna Tipo sale del campo tro y tiene tres valores, no dos: el Marco Geoestadístico clasifica cada radio en urbano, rural o mixto. Medidos contra el GeoServer: 54.459 urbanos, 9.347 rurales y 2.683 mixtos —y 26 radios que no traen ninguno—. Conviene tomarla con cuidado: es una clasificación operativa del censo, no una descripción del paisaje, y el radio mixto existe justamente porque en muchos lugares el corte no cae en ningún lado.',
```

```js
    sources: [
      { label: 'Marco Geoestadístico', href: 'https://www.indec.gob.ar/ftp/cuadros/geoestadistica/marco_geoestadistico_nacional.pdf' },
    ],
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run src/columns.test.js src/notes.test.js`
Expected: PASS. El gate de prosa sigue exigiendo que la nota diga `66.515`: el párrafo nuevo se agrega, no reemplaza al primero.

- [ ] **Step 6: Commit**

```bash
git add src/columns.js src/columns.test.js src/notes.js src/notes.test.js
git commit -m "fix: 2.683 radios mostraban una M cruda y la nota no decía qué era esa columna"
```

---

### Task 7: Gobierno local cuenta que otros cuentan distinto

**Files:**
- Modify: `src/notes.js` (nota `gobierno-local`)
- Modify: `src/notes.test.js`

**Interfaces:**
- Consumes: `sources` de la Task 3.
- Produces: nada nuevo.

- [ ] **Step 1: Escribir el test que falla**

```js
  it('gobierno local dice que el IGN publica otro número', () => {
    const texto = noteFor('gobierno-local').paragraphs.join(' ')
    expect(texto).toContain('2.114')
    expect(texto).toContain('529')
  })
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/notes.test.js`
Expected: FAIL.

- [ ] **Step 3: Agregar el párrafo a la nota `gobierno-local`**

Insertar como último párrafo, antes de `'Se descarga por cmu.'`, y agregar `sources`:

```js
      'No es el único organismo que cuenta esto, ni todos cuentan lo mismo. El IGN publica 2.114 municipios donde el INDEC publica 2.282 gobiernos locales, y 3.528 localidades donde el INDEC publica 4.023 localidades censales. En departamentos coinciden: 529 los dos. Ninguno está equivocado; cuentan cosas distintas con las mismas palabras, y el que baja el archivo tiene que saber cuál de las dos bajó.',
```

```js
    sources: [
      { label: 'IGN', href: 'https://www.ign.gob.ar/ut/' },
    ],
```

**Cuidado:** el caso `'los nombres que son los tres tipos a la vez salen del catálogo'` exige que esta nota contenga la frase `271 nombres del catálogo`. No tocar el párrafo que la trae.

- [ ] **Step 4: Correr la suite entera**

Run: `npm test`
Expected: PASS. Todas las notas, todos los gates.

- [ ] **Step 5: Verificar el build**

Run: `npm run build`
Expected: build exitoso, sin marcador de shell sin partial.

- [ ] **Step 6: Commit**

```bash
git add src/notes.js src/notes.test.js
git commit -m "feat: dos organismos oficiales publican números distintos y la nota lo callaba"
```
