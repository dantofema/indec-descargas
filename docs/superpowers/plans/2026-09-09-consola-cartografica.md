# Consola cartográfica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Darle a `indec-descargas` una identidad visual —consola cartográfica— sin tocar su estructura ni su comportamiento, en las dos paletas que el sitio ya tiene.

**Architecture:** Una capa de superficie sobre un sistema que funciona. Todo el color vive en ocho tokens por paleta en `src/style.css`; el movimiento entra en CSS salvo los contadores, que necesitan un `requestAnimationFrame` en `src/pages/home.js`; el color de la geometría del mapa deja de ser un literal en `src/map.js` y pasa a leerse del token. El gate de contraste que ya existe se extiende para entender `oklch()` y auditar las dos paletas.

**Tech Stack:** Vite 6, Vitest 2 + jsdom, Leaflet 1.9, JavaScript ESM sin framework. Sin dependencias nuevas de npm.

**Spec:** `docs/superpowers/specs/2026-09-09-consola-cartografica-design.md`
**Canvas del diseño:** https://claude.ai/code/artifact/db3e09bd-4a59-4521-ab9e-f5892ffa40d8

## Global Constraints

- **Sin dependencias nuevas de npm.** Las fuentes son cinco archivos woff2 servidos por el propio sitio, no un paquete.
- **Castellano en la interfaz y en los comentarios, inglés en el código.** Los comentarios de este repo explican *por qué*, no *qué*.
- **Las dos paletas quedan.** El sitio ya sigue `prefers-color-scheme` y eso es accesibilidad, no una preferencia estética. Ninguna tarea puede dejar una sola paleta.
- **Ninguna regla de producto cambia de comportamiento.** En particular **SITIO-R3** (un enlace compartido no dispara el pedido de vías) y **SITIO-R9** (el sitio dice que no es del INDEC): el rediseño los muestra, no los toca.
- **Ninguna tarea deja la suite en rojo entre commits.** Si un borrado necesita que su consumidor muera primero, se reordena o se para.
- **Valores exactos verificados el 2026-09-09. Usar textualmente:**
  - Fuentes auto-hospedadas, subset latino, woff2: Space Grotesk 500 **4.324 B**, 700 **4.204 B**; IBM Plex Sans 400 **12.148 B**; IBM Plex Mono 400 **6.912 B**, 500 **6.972 B**. Total **34.560 B (~33 KB)**.
  - Totales del catálogo para los contadores: `jur` 24, `dep` 529, `loc` 4.023, `gl` 2.282, `aglo` 119, `fracciones` 6.571, `radios` 66.515, `vias` 477.588.
  - El sitio hoy tiene **cero** `transition`, `@keyframes` y `animation` en `src/style.css`.
- **Comandos:** `npm test`, `npm run build`, `npx vitest run src/style.test.js`.

## Estructura de archivos

**Se crean:** `public/fonts/*.woff2` (5), `docs/reglas/apariencia.md`
**Se modifican:** `src/style.css` (el grueso), `src/style.test.js`, `src/pages/home.js`, `src/pages/home.test.js`, `src/map.js`, `src/map.test.js`, `index.html`, `docs/reglas/sitio.md`, `docs/reglas/README.md`

---

### Task 1: El gate de contraste entiende oklch

Va primero **a propósito**: es lo único que puede decir si una paleta nueva es legible, y escribirlo contra la paleta vieja —que todavía es hex— prueba que la conversión es correcta antes de que ningún color cambie.

**Files:**
- Modify: `src/style.test.js`

**Interfaces:**
- Produces: `luminance(color)` acepta `#rrggbb` **y** `oklch(L C H)`. `contrast(a, b)` sigue igual.

- [ ] **Step 1: Escribir el test que falla**

En `src/style.test.js`, dentro de un `describe` nuevo:

```js
describe('la conversión de color del gate', () => {
  // El control que hace confiable a todo lo demás: un color escrito de las
  // dos formas tiene que dar la misma luminancia. Sin esto, la conversión
  // oklch podría estar mal y los contrastes de la paleta nueva serían
  // números inventados con cara de medidos.
  it('oklch y hex del mismo color dan la misma luminancia', () => {
    // #1f6feb, el acento que el sitio tiene hoy, convertido el 2026-09-09.
    // Su luminancia WCAG medida es 0.17658: si la conversión oklch no cae
    // ahí, está mal la conversión, no el valor esperado.
    expect(luminance('oklch(0.5686 0.2023 259.7)')).toBeCloseTo(luminance('#1f6feb'), 2)
    expect(luminance('#1f6feb')).toBeCloseTo(0.17658, 4)
  })

  it('los extremos caen donde tienen que caer', () => {
    expect(luminance('oklch(1 0 0)')).toBeCloseTo(1, 2)
    expect(luminance('oklch(0 0 0)')).toBeCloseTo(0, 2)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/style.test.js`
Expected: FAIL — `luminance` hace `hex.slice(1, 3)` sobre la cadena `oklch(...)` y devuelve `NaN`.

- [ ] **Step 3: Extender `luminance` en `src/style.test.js`**

Reemplazar la función por estas tres, dejando `channel` donde está:

```js
/**
 * oklch → sRGB lineal, con los coeficientes de Björn Ottosson. Hace falta
 * porque la paleta se declara en oklch —es el espacio donde "mismo croma,
 * misma luminosidad, otro matiz" significa lo que dice— y el contraste de
 * WCAG se calcula sobre sRGB lineal.
 */
function oklchToLinear(L, C, H) {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ]
}

/** Los canales lineales de un color, venga en hex o en oklch. */
function linearChannels(color) {
  const ok = color.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/)
  if (ok) return oklchToLinear(+ok[1], +ok[2], +ok[3]).map((c) => Math.min(1, Math.max(0, c)))
  return [1, 3, 5].map((i) => channel(parseInt(color.slice(i, i + 2), 16) / 255))
}

function luminance(color) {
  const [r, g, b] = linearChannels(color)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test`
Expected: PASS, y **la suite entera sigue verde**: los tests de contraste que ya existen auditan la paleta hex actual y tienen que seguir dando lo mismo. Si alguno cambia de resultado, la conversión rompió el camino hex.

- [ ] **Step 5: Commit**

```bash
git add src/style.test.js
git commit -m "test: el gate de contraste entiende oklch, y se prueba contra el hex que ya audita"
```

---

### Task 2: Las dos paletas en oklch

**Files:**
- Modify: `src/style.css` (bloque `:root` y bloque `@media (prefers-color-scheme: dark)`)
- Modify: `src/style.test.js`

**Interfaces:**
- Consumes: `luminance` con oklch (Task 1).
- Produces: ocho tokens por paleta. Los nombres viejos que el resto de la hoja usa —`--bg`, `--fg`, `--muted`, `--line`, `--accent`, `--accent-fg`, `--hl`, `--hl-mark`, `--disabled`, `--warn`— **siguen existiendo**: los nuevos se suman y los viejos se redefinen en términos de los nuevos, así que ninguna regla de la hoja se rompe en esta tarea.

- [ ] **Step 1: Escribir los tests que fallan**

```js
describe('la paleta de la consola (APAR-R6)', () => {
  const { light, dark } = palettes()
  const pares = [
    ['--fg', '--ground', 7],
    ['--fg', '--panel', 7],
    ['--muted', '--ground', 4.5],
    ['--muted', '--panel', 4.5],
    ['--accent', '--ground', 4.5],
    ['--ground', '--accent', 4.5],
  ]

  for (const [modo, tokens] of [['clara', light], ['oscura', dark]]) {
    for (const [a, b, piso] of pares) {
      it(`${a} sobre ${b} llega a ${piso}:1 en la paleta ${modo}`, () => {
        expect(contrast(resolve(a, tokens), resolve(b, tokens))).toBeGreaterThanOrEqual(piso)
      })
    }
  }

  // Los dos acentos comparten croma y luminosidad y sólo cambian de matiz:
  // es lo que hace que ninguno pese más que el otro (APAR-R2).
  it('los dos acentos comparten croma y luminosidad en las dos paletas', () => {
    for (const tokens of [light, dark]) {
      const [, la, ca] = resolve('--accent', tokens).match(/oklch\(([\d.]+) ([\d.]+)/)
      const [, lb, cb] = resolve('--amber', tokens).match(/oklch\(([\d.]+) ([\d.]+)/)
      expect(+la).toBeCloseTo(+lb, 3)
      expect(+ca).toBeCloseTo(+cb, 3)
    }
  })

  it('todo token de color se declara en oklch (APAR-R2)', () => {
    for (const tokens of [light, dark]) {
      for (const t of ['--ground', '--panel', '--raise', '--line', '--fg', '--muted', '--accent', '--amber']) {
        expect(resolve(t, tokens), t).toMatch(/^oklch\(/)
      }
    }
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/style.test.js`
Expected: FAIL — los tokens nuevos no existen.

- [ ] **Step 3: Escribir las dos paletas en `src/style.css`**

Bloque claro (`:root`), con los alias viejos apuntando a los nuevos:

```css
:root {
  /* La consola, paleta clara. Las cuatro superficies comparten un solo eje
     de matiz (250, azul frío) y sólo varían en luminosidad; los dos acentos
     comparten croma y luminosidad y sólo cambian de matiz, así que ninguno
     pesa más que el otro (APAR-R2). Los pisos de contraste los verifica la
     suite, no esta tabla (APAR-R6). */
  --ground: oklch(0.99 0.002 250);
  --panel:  oklch(0.975 0.004 250);
  --raise:  oklch(0.95 0.006 250);
  --line:   oklch(0.90 0.006 250);
  --fg:     oklch(0.22 0.012 250);
  --muted:  oklch(0.50 0.014 250);
  --accent: oklch(0.55 0.14 190);
  --amber:  oklch(0.55 0.14 75);

  /* Los nombres que el resto de la hoja ya usa, en términos de los de
     arriba: así el rediseño de superficie no obliga a reescribir cada
     regla en la misma tarea que cambia los colores. */
  --bg: var(--ground);
  --hl: var(--raise);
  --hl-mark: var(--accent);
  --accent-fg: var(--ground);
  --disabled: var(--raise);
  --warn: var(--amber);
}
```

Bloque oscuro, **dentro del `@media (prefers-color-scheme: dark)` que ya existe**, sin sacar el `.status.error` que vive ahí:

```css
  :root {
    --ground: oklch(0.17 0.012 250);
    --panel:  oklch(0.215 0.014 250);
    --raise:  oklch(0.26 0.015 250);
    --line:   oklch(0.32 0.014 250);
    --fg:     oklch(0.96 0.005 250);
    --muted:  oklch(0.72 0.012 250);
    --accent: oklch(0.80 0.125 190);
    --amber:  oklch(0.80 0.125 75);
  }
```

Los alias no se repiten en el bloque oscuro: `var()` se resuelve en uso, así que heredan solos.

- [ ] **Step 4: Ajustar hasta que el gate pase**

Run: `npx vitest run src/style.test.js`

Si un par no llega a su piso, **mover la luminosidad del token, no bajar el piso**. Los valores del spec son un punto de partida medido a ojo; el gate es la autoridad.

- [ ] **Step 5: Correr la suite entera**

Run: `npm test`
Expected: PASS. Los tests viejos de contraste (`--hl-mark` sobre `--bg`, ≥3:1) siguen valiendo porque los alias los mantienen vivos.

- [ ] **Step 6: Commit**

```bash
git add src/style.css src/style.test.js
git commit -m "feat: las dos paletas de la consola, en oklch y con su piso de contraste medido"
```

---

### Task 3: Las fuentes se auto-hospedan

**Files:**
- Create: `public/fonts/` (5 archivos woff2)
- Modify: `src/style.css`
- Modify: `src/style.test.js`

**Interfaces:**
- Produces: `--display`, `--body`, `--mono` como tokens.

- [ ] **Step 1: Bajar las cinco caras**

```bash
mkdir -p public/fonts
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
for spec in "Space+Grotesk:wght@500:space-grotesk-500" "Space+Grotesk:wght@700:space-grotesk-700" \
            "IBM+Plex+Sans:wght@400:plex-sans-400" "IBM+Plex+Mono:wght@400:plex-mono-400" \
            "IBM+Plex+Mono:wght@500:plex-mono-500"; do
  fam="${spec%:*}"; out="${spec##*:}"
  url=$(curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=${fam}&display=swap" | grep -o 'https://fonts.gstatic.com[^)]*\.woff2' | head -1)
  curl -s -A "$UA" -o "public/fonts/${out}.woff2" "$url"
done
ls -l public/fonts
```

Los cinco tienen que existir y sumar **~34.560 bytes**. Si alguno viene vacío o el total se aleja mucho, parar: el CSS que devuelve Google cambia según el `User-Agent` y un subset equivocado es una fuente que no cubre el castellano.

- [ ] **Step 2: Escribir el test que falla**

```js
describe('las fuentes se sirven desde acá (APAR-R3)', () => {
  it('no hay ningún origen de terceros en la hoja', () => {
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/)
  })

  it('las cinco caras están declaradas y apuntan a public/fonts', () => {
    const caras = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1])
    expect(caras).toHaveLength(5)
    for (const c of caras) {
      expect(c).toMatch(/url\(["']?\/fonts\/[a-z-]+\.woff2/)
      // `swap` y no `block`: la fuente no puede esconder el texto mientras
      // llega. El sitio se lee antes de verse lindo.
      expect(c).toMatch(/font-display:\s*swap/)
    }
  })
})
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run src/style.test.js`
Expected: FAIL — no hay ningún `@font-face`.

- [ ] **Step 4: Declarar las caras y los tokens en `src/style.css`**

Arriba de todo, antes del `:root`:

```css
/* Las cinco caras se sirven desde el propio sitio: 34.560 bytes medidos, y
   a cambio el sitio no le pide nada a ningún tercero (APAR-R3). Hoy sólo
   habla con el GeoServer del INDEC —de donde salen los datos— y con los
   tiles del IGN —de donde sale el mapa—. */
@font-face { font-family: "Space Grotesk"; font-weight: 500; font-style: normal; font-display: swap; src: url("/fonts/space-grotesk-500.woff2") format("woff2"); }
@font-face { font-family: "Space Grotesk"; font-weight: 700; font-style: normal; font-display: swap; src: url("/fonts/space-grotesk-700.woff2") format("woff2"); }
@font-face { font-family: "IBM Plex Sans"; font-weight: 400; font-style: normal; font-display: swap; src: url("/fonts/plex-sans-400.woff2") format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-weight: 400; font-style: normal; font-display: swap; src: url("/fonts/plex-mono-400.woff2") format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-weight: 500; font-style: normal; font-display: swap; src: url("/fonts/plex-mono-500.woff2") format("woff2"); }
```

Y en `:root`, junto a los colores:

```css
  --display: "Space Grotesk", system-ui, sans-serif;
  --body: "IBM Plex Sans", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
```

Y `body` pasa a `font: 16px/1.5 var(--body);`.

**Cuidado con la ruta:** el sitio se sirve bajo `base: '/indec-descargas/'`, pero lo que está en `public/` se copia a la raíz del build y Vite reescribe las URL absolutas del CSS contra `base`. Verificá en el Step 5 que el build deja las fuentes donde el CSS las busca.

- [ ] **Step 5: Correr, buildear y verificar que las fuentes llegan**

```bash
npm test
npm run build
ls dist/fonts/
grep -o '/[a-z/-]*fonts/[a-z-]*\.woff2' dist/assets/*.css | head
```

Las rutas del CSS construido tienen que coincidir con dónde quedaron los archivos. Si no coinciden, ajustá la referencia; **no muevas los archivos fuera de `public/`**.

- [ ] **Step 6: Commit**

```bash
git add public/fonts src/style.css src/style.test.js
git commit -m "feat: tres familias auto-hospedadas en 33 KB, y ningún tercero"
```

---

### Task 4: Superficies, controles y tipografía aplicada

**Files:**
- Modify: `src/style.css`
- Modify: `src/style.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

```js
describe('los controles de la consola', () => {
  // El brillo no sirve como hover cuando el acento ya es luminoso: en la
  // paleta oscura, subirle 8% a un cián no se percibe.
  it('el hover del botón es un anillo, no un filtro de brillo', () => {
    const btn = rule('\\.btn:hover')
    expect(btn.length).toBeGreaterThan(0)
    expect(btn.join(' ')).toMatch(/box-shadow/)
    expect(btn.join(' ')).not.toMatch(/brightness/)
  })

  it('el foco visible nunca se saca', () => {
    expect(css).toMatch(/:focus-visible/)
    expect(css).not.toMatch(/outline:\s*(none|0)\s*;(?![^}]*:focus-visible)/)
  })

  it('todo número va en cifras tabulares', () => {
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums/)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/style.test.js`

- [ ] **Step 3: Aplicar el sistema a la hoja**

Recorrer `src/style.css` aplicando, sin cambiar ninguna estructura ni ningún selector:

- `--radius` pasa de `6px` a `8px` —**esto vive acá y no en la Task 2**, que sólo toca colores; el radio es geometría—; los tiles y el pozo del mapa usan `10px`–`12px`.
- Títulos, botones y pestañas: `font-family: var(--display)`; peso 500, salvo el `h1` del home que va 700.
- Todo número, código y metadato: `font-family: var(--mono)` **más** `font-variant-numeric: tabular-nums`. Alcanza a `.totales-n`, la columna de códigos de la tabla, `#generated`, el paginador y los metadatos de la ficha.
- `.btn:hover`: sacar `filter: brightness(1.08)`, poner `box-shadow: 0 0 0 4px color-mix(in oklch, var(--accent) 22%, transparent)`. `.btn:active` baja 1 px.
- `.btn.ghost:hover`: fondo `color-mix(in oklch, var(--accent) 10%, transparent)`.
- Campos (`#q`, `#type`): fondo `var(--panel)`, y en `:focus` borde de acento más anillo al 18 %.
- `.totales-tile`: fondo `var(--panel)`, borde `var(--line)`, radio 10px.
- `:focus-visible` global con anillo de acento; ninguna regla saca el outline sin reponerlo.

- [ ] **Step 4: Correr y verificar**

Run: `npm test && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/style.css src/style.test.js
git commit -m "feat: superficies, controles y tipografía de la consola"
```

---

### Task 5: El movimiento, y su interruptor

**Files:**
- Modify: `src/style.css`
- Modify: `src/style.test.js`

- [ ] **Step 1: Escribir los tests que fallan**

```js
describe('el movimiento (APAR-R4)', () => {
  it('hay movimiento, que antes no había', () => {
    expect(css).toMatch(/@keyframes/)
    expect((css.match(/transition:/g) ?? []).length).toBeGreaterThan(4)
  })

  // Lo único no negociable de esta tarea: para alguien con sensibilidad
  // vestibular, ocho números corriendo no es un adorno.
  it('todo se apaga con prefers-reduced-motion', () => {
    const bloque = media('(prefers-reduced-motion: reduce)')
    expect(bloque).not.toBeNull()
    expect(bloque).toMatch(/animation:\s*none/)
    expect(bloque).toMatch(/transition:\s*none/)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/style.test.js`
Expected: FAIL — hoy hay cero `@keyframes` y cero `transition`.

- [ ] **Step 3: Escribir el movimiento**

Las cinco piezas de la tabla del spec §3, con sus duraciones y curvas exactas: la entrada del hero en cuatro escalones de 80 ms, el hover del tile con la línea inferior que se dibuja, la fila de tabla que sube sus acciones de 55 % a 100 %, y el subrayado de pestaña y nav que crece desde la izquierda.

Y el bloque que lo apaga todo:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  /* Los subrayados y las líneas viven en un `transform: scaleX(0)` que la
     transición abría: sin animación hay que dejarlos abiertos, o el estado
     activo deja de verse. */
  .tab[aria-selected="true"]::after { transform: scaleX(1); }
}
```

- [ ] **Step 4: Correr y verificar**

Run: `npm test && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/style.css src/style.test.js
git commit -m "feat: el movimiento de la consola, y el interruptor que lo apaga"
```

---

### Task 6: Los contadores corren

**Files:**
- Modify: `src/pages/home.js`
- Modify: `src/pages/home.test.js`

**Interfaces:**
- Consumes: `--mono` y `tabular-nums` (Task 4); si no están, los números saltan de ancho.

- [ ] **Step 1: Escribir los tests que fallan**

```js
it('los contadores arrancan abajo del total y llegan al total', async () => {
  await montar()
  const n = () => [...document.querySelectorAll('.totales-n')].map((e) => e.textContent)
  // No se afirma un valor intermedio: eso ataría el test al reloj. Se afirma
  // que termina en el número real del catálogo.
  await vi.waitFor(() => expect(n()).toContain('66.515'))
})

it('con prefers-reduced-motion el número está desde el primer cuadro', async () => {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
  await montar()
  expect([...document.querySelectorAll('.totales-n')].map((e) => e.textContent)).toContain('66.515')
})
```

Mirá cómo el archivo monta la página antes de escribirlos y usá sus helpers.

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/pages/home.test.js`

- [ ] **Step 3: Implementar en `src/pages/home.js`**

```js
/**
 * Los ocho totales suben desde cero al cargar. No son ocho animaciones: es
 * una sola, con un reloj compartido, porque ocho relojes desincronizados se
 * ven como un error y no como una entrada.
 *
 * easeOutCubic y no lineal: arranca rápido y se estaciona, que es como se
 * lee un instrumento. Lineal parecería una barra de carga.
 */
const COUNT_MS = 1300

function runCounters(nodes, totals) {
  const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)')
  const paint = (t) => {
    for (const { node, target } of nodes) node.textContent = fmt(Math.round(target * t))
  }
  // Respetar la preferencia no es un extra: para alguien con sensibilidad
  // vestibular, ocho números corriendo es un síntoma.
  if (mq && mq.matches) return paint(1)

  const start = performance.now()
  const step = (now) => {
    const p = Math.min(1, (now - start) / COUNT_MS)
    paint(1 - (1 - p) ** 3)
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
```

Y donde hoy se hace `n.textContent = fmt(totals[tile.key] ?? 0)`, dejar el nodo en `0` y juntar `{ node, target }` para pasárselos a `runCounters` después de montar los ocho.

- [ ] **Step 4: Correr y verificar**

Run: `npm test && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/pages/home.js src/pages/home.test.js
git commit -m "feat: los ocho totales suben con un solo reloj, y se quedan quietos si el sistema lo pide"
```

---

### Task 7: El mapa, y su geometría

**Files:**
- Modify: `src/map.js`, `src/map.test.js`
- Modify: `src/style.css`
- Modify: `docs/reglas/sitio.md` (una línea en SITIO-R8)

- [ ] **Step 1: Escribir el test que falla**

```js
it('la geometría se dibuja con el acento del sitio, no con un azul literal', () => {
  expect(readFileSync(new URL('./map.js', import.meta.url), 'utf8')).not.toMatch(/#1f6feb/)
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/map.test.js`
Expected: FAIL — `src/map.js` tiene `color: '#1f6feb'` literal.

- [ ] **Step 3: Leer el acento del token en `src/map.js`**

```js
/**
 * El color de la geometría sale del token del sitio y no de un literal: la
 * paleta tiene dos modos y el dibujo tiene que leerse sobre el basemap claro
 * del IGN en los dos (APAR-R5). Se resuelve al dibujar, no al importar,
 * porque el token cambia con `prefers-color-scheme`.
 */
const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1f6feb'
```

y usarlo en el `style` del `L.geoJSON`. El fallback existe porque en jsdom el valor computado puede venir vacío, y un mapa sin color es peor que uno con el color viejo.

- [ ] **Step 4: El pozo del mapa en `src/style.css`**

Sólo dentro del bloque oscuro, porque en la paleta clara el problema no existe:

```css
  /* Los tiles del IGN son claros y no se pueden oscurecer sin falsear el
     dato. En vez de disimularlo, el mapa es una pantalla encendida dentro de
     la consola: pozo hundido, borde teñido y sombra proyectada, para que la
     superficie clara se lea como algo prendido y no como un parche
     (APAR-R5). */
  .map {
    border-color: color-mix(in oklch, var(--accent) 30%, var(--line));
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 8%, transparent),
                0 12px 32px -18px oklch(0 0 0 / .9);
  }
```

- [ ] **Step 5: Agregar la línea a SITIO-R8**

En `docs/reglas/sitio.md`, al final de SITIO-R8:

```markdown
La geometría del objeto se dibuja con el acento del sitio, no con un azul literal: la paleta
tiene dos modos y el dibujo tiene que leerse sobre el basemap claro del IGN en los dos (APAR-R5).
```

- [ ] **Step 6: Correr y verificar**

Run: `npm test && npm run build`

- [ ] **Step 7: Commit**

```bash
git add src/map.js src/map.test.js src/style.css docs/reglas/sitio.md
git commit -m "feat: el mapa es una pantalla encendida, y su geometría sale del token"
```

---

### Task 8: La superficie de reglas

**Files:**
- Create: `docs/reglas/apariencia.md`
- Modify: `docs/reglas/README.md`

- [ ] **Step 1: Escribir `docs/reglas/apariencia.md`**

Seis reglas con el formato del repo —enunciado, cuerpo, y **Por qué:**—, en el orden del spec §7: APAR-R1 (dos paletas, una identidad), R2 (todo en oklch, acentos con croma y luminosidad compartidos), R3 (fuentes auto-hospedadas, con los 34.560 bytes medidos), R4 (una entrada orquestada, y `prefers-reduced-motion` la apaga), R5 (el basemap claro es superficie encendida), R6 (el contraste se verifica en la suite, en las dos paletas).

Cada **Por qué** tiene que decir qué se pierde si la regla se ignora, no repetir el enunciado. APAR-R1 en particular tiene que contar que el modo claro **ya existía** y que borrarlo habría sido sacar accesibilidad, no elegir una dirección.

- [ ] **Step 2: Agregar la fila al índice**

En `docs/reglas/README.md`, en la tabla de superficies, alfabéticamente antes de `buscador`:

```markdown
| [apariencia](apariencia.md) | APAR-R1 … APAR-R6 |
```

- [ ] **Step 3: Verificar que nada quedó viejo**

Run: `grep -rn "brightness(1.08)\|#1f6feb\|fonts.googleapis" src docs --include=*.css --include=*.js --include=*.md`

No tiene que quedar ninguno fuera de un contexto histórico explícito. Este repo trata un texto que describe algo que ya no existe como defecto no negociable, y **las nueve revisiones del trabajo anterior encontraron exactamente uno cada una**.

- [ ] **Step 4: Correr la suite y el build**

Run: `npm test && npm run build`

- [ ] **Step 5: Commit**

```bash
git add docs/reglas/apariencia.md docs/reglas/README.md
git commit -m "docs: apariencia, la superficie de reglas que el rediseño necesitaba"
```
