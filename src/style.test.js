import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8')

const roots = (texto) => [...texto.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1])

const readTokens = (block) => Object.fromEntries(
  [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
)

/**
 * Las dos paletas, ubicadas por dónde viven y no por el orden en que
 * aparecen: la clara es el `:root` de afuera de todo `@media` y la oscura el
 * de adentro de `(prefers-color-scheme: dark)`.
 *
 * Antes tomaba el primer `:root` como el claro y el segundo como el oscuro.
 * Con un tercer bloque, o con los dos al revés, el suite auditaba la paleta
 * equivocada **en verde**: era el único test del archivo que podía pasar
 * estando mal. Ahora, si esos supuestos dejan de valer, esto tira.
 */
function palettes() {
  const oscuro = media('(prefers-color-scheme: dark)')
  if (oscuro === null) {
    throw new Error('la hoja ya no trae un @media (prefers-color-scheme: dark): ¿dónde está la paleta oscura?')
  }
  const claros = roots(css.replace(oscuro, ''))
  const oscuros = roots(oscuro)
  if (claros.length !== 1) {
    throw new Error(`se esperaba un solo :root fuera de @media (la paleta clara) y hay ${claros.length}`)
  }
  if (oscuros.length !== 1) {
    throw new Error(`se esperaba un solo :root dentro del @media oscuro y hay ${oscuros.length}`)
  }
  const light = readTokens(claros[0])
  return { light, dark: { ...light, ...readTokens(oscuros[0]) } }
}

/** Resuelve las indirecciones `var(--x)` hasta llegar al color. */
function resolve(name, tokens) {
  let value = tokens[name]
  while (value && value.startsWith('var(')) value = tokens[value.slice(4, -1).trim()]
  return value
}

const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

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

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const rule = (selector) => {
  const re = new RegExp(`${selector.replace(/[.[\]"^$*+?()|\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g')
  return [...css.matchAll(re)].map((m) => m[1])
}


/** Contenido de un bloque `@media`, contando llaves. */
function media(consulta) {
  const inicio = css.indexOf(`@media ${consulta}`)
  if (inicio === -1) return null
  let i = css.indexOf('{', inicio), nivel = 0
  for (let j = i; j < css.length; j++) {
    if (css[j] === '{') nivel++
    else if (css[j] === '}' && --nivel === 0) return css.slice(i + 1, j)
  }
  return null
}

// El resto de este archivo audita colores contra `palettes()`, así que
// primero se verifica que `palettes()` esté mirando las paletas que dice.
describe('de dónde salen las paletas que se auditan', () => {
  it('hay exactamente una paleta clara y una oscura, y están donde se las busca', () => {
    expect(() => palettes()).not.toThrow()
  })

  // El chequeo estructural no alcanza: dos bloques bien ubicados pero con
  // los valores cambiados de lugar lo pasarían igual. Esto mira el color.
  it('la clara es clara y la oscura es oscura, no al revés', () => {
    const { light, dark } = palettes()
    expect(luminance(resolve('--bg', light))).toBeGreaterThan(luminance(resolve('--fg', light)))
    expect(luminance(resolve('--bg', dark))).toBeLessThan(luminance(resolve('--fg', dark)))
    expect(luminance(resolve('--bg', dark))).toBeLessThan(luminance(resolve('--bg', light)))
  })
})

describe('contraste del resaltado de teclado', () => {
  // El resaltado es el único indicador de dónde va a caer el Enter. WCAG
  // 2.1 SC 1.4.11 pide 3:1 para el indicador de estado de un componente.
  const { light, dark } = palettes()

  it('la marca contrasta con el fondo de la lista en modo claro', () => {
    expect(contrast(resolve('--hl-mark', light), resolve('--bg', light))).toBeGreaterThanOrEqual(3)
  })

  it('la marca contrasta con el fondo de la lista en modo oscuro', () => {
    expect(contrast(resolve('--hl-mark', dark), resolve('--bg', dark))).toBeGreaterThanOrEqual(3)
  })

  it('el resaltado usa la marca', () => {
    const bloques = rule('.results li[aria-selected="true"]')
    expect(bloques.length).toBeGreaterThan(0)
    expect(bloques.every((b) => b.includes('var(--hl-mark)'))).toBe(true)
  })

  // Compartir estilo con el hover hace que, con el mouse sobre otra fila,
  // se vean dos filas resaltadas y el Enter elija la que no está debajo
  // del puntero.
  it('el hover del mouse no se disfraza de resaltado de teclado', () => {
    expect(rule('.results li:hover').every((b) => !b.includes('var(--hl-mark)'))).toBe(true)
    expect(css).not.toMatch(/:hover\s*,[^{]*aria-selected/)
    expect(css).not.toMatch(/aria-selected[^{]*,\s*[^{]*:hover/)
  })
})

// Estas dos las encontró un browser de verdad sobre el sitio publicado, no
// el suite: jsdom no reproduce ninguna de las dos —su cascada resuelve
// `[hidden]` a `display: none` igual, y no tiene apilamiento ni pintura—.
// Por eso el test mira la hoja, que es lo único que acá se puede afirmar.
describe('reglas que el browser real desarma', () => {
  it('el atributo hidden no lo puede pisar una regla nuestra', () => {
    // `[hidden] { display: none }` viene de la hoja del browser con
    // especificidad cero: `.detail { display: grid }` le ganaba y el panel
    // vacío, con el mapa adentro, se veía desde que cargaba la página.
    expect(css).toMatch(/\[hidden\]\s*\{[^}]*display:\s*none\s*!important/)
  })

  it('la lista de resultados se pinta por encima del mapa', () => {
    // Leaflet apila sus paneles entre 200 y 700, y sus controles llegan a
    // 1000. Con la ficha abierta, buscar de nuevo dejaba los nombres de los
    // resultados atrás del mapa: sólo se leían las etiquetas de la derecha,
    // que caen fuera del ancho del mapa.
    const z = Number(css.match(/\.results\s*\{[^}]*z-index:\s*(\d+)/)[1])
    expect(z).toBeGreaterThan(1000)
  })
})

describe('la atribución del mapa', () => {
  // Leaflet pinta su placa con `rgba(255,255,255,.8)`, así que el fondo real
  // del texto es la tesela que haya debajo. Su enlace, #0078A8, mide 4,94:1
  // sobre blanco pero 3,64:1 sobre el gris del contenedor: el contraste
  // dependía de qué se hubiera cargado atrás. Con la placa opaca es siempre
  // el número bueno, sin pelearle a la paleta de Leaflet.
  it('la placa es opaca, así el contraste no depende de la tesela', () => {
    const regla = rule('#map .leaflet-control-attribution')
    expect(regla.length).toBe(1)
    expect(regla[0]).toMatch(/background:\s*#fff\b/)
  })
})

describe('columna fija de vías: ancla la que declara la capa, no la primera', () => {
  // El bug medido en el sitio desplegado: la regla apuntaba a `:first-child`,
  // y el primer campo publicado por el GeoServer es `id` (un número interno),
  // no `fna` (el nombre de la calle). El arreglo es apuntar a una clase que
  // pone la capa, no a la posición.
  it('la regla sticky apunta a .col-anchor, no a :first-child', () => {
    const bloques = rule('table.wide th.col-anchor, table.wide td.col-anchor')
    expect(bloques.length).toBe(1)
    expect(bloques[0]).toMatch(/position:\s*sticky/)
    expect(css).not.toMatch(/table\.wide\s+(th|td):first-child/)
  })
})

describe('lo que cambia sin mouse', () => {
  // En una pantalla táctil el `:hover` queda pegado después del tap: en el
  // iPhone la fila tocada seguía tintada, sin estar elegida, y parecía una
  // selección que no existía. `(hover: hover)` da false en táctil, así que
  // la regla no tiene por qué llegar ahí.
  it('el hover no se pega en pantallas táctiles', () => {
    const bloque = media('(hover: hover)')
    expect(bloque).not.toBe(null)
    expect(bloque).toMatch(/\.results li:hover/)
  })
})

// El body trae `data-pagina` (cada página lo pone en su propio <body>) y
// el link del nav, `data-nav` (lo pone el shell, en build): sin un
// selector que combine los dos, quedan dos mitades de un mecanismo sin el
// puente, y el nav activo nunca se marca. Esto lo fija para que no se
// vuelva a evaporar; las tareas 6 y 8 suman acá el par de servicios y de
// resultados al crear esas páginas.
//
// El selector va entero: `[^{]*` no cruza la llave pero sí cruza la coma,
// así que con los cuatro pares en una sola lista de selectores los cuatro
// casos seguían pasando aunque se invirtieran dos pares entre sí.
describe('el nav marca la página activa', () => {
  const par = (pagina, nav) =>
    new RegExp(`\\[data-pagina="${pagina}"\\] \\.site-nav \\[data-nav="${nav}"\\]`)

  it('home', () => {
    expect(css).toMatch(par('home', 'home'))
  })

  it('notas', () => {
    expect(css).toMatch(par('notas', 'notas'))
  })

  it('servicios', () => {
    expect(css).toMatch(par('servicios', 'servicios'))
  })

  // /resultados/ no es una entrada del nav: es la ficha a la que lleva el
  // buscador del home, así que marca "Inicio".
  it('resultados marca Inicio', () => {
    expect(css).toMatch(par('resultados', 'home'))
  })
})

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

  // Agarra un error de signo o de escala en los coeficientes de la fila L.
  // No agarra un cubo faltante ni un signo invertido en el matiz —0 y 1 son
  // puntos fijos de x³ y con croma 0 el matiz no participa—: eso lo cubren
  // las anclas de abajo.
  it('los extremos caen donde tienen que caer', () => {
    expect(luminance('oklch(1 0 0)')).toBeCloseTo(1, 2)
    expect(luminance('oklch(0 0 0)')).toBeCloseTo(0, 2)
  })

  // Dos anclas más, con croma de verdad y a 180° de distancia entre sí: sin
  // esto, borrar el `** 3` de la conversión pasa desapercibido, porque 0 y 1
  // son puntos fijos del cubo y con croma 0 los términos de matiz se anulan.
  // El acento y el aviso que el sitio tiene hoy en su paleta oscura sirven
  // de patrón: son colores reales, no valores de laboratorio.
  it('un color con croma también cae donde corresponde', () => {
    expect(luminance('oklch(0.6470 0.1718 259.9)')).toBeCloseTo(luminance('#4b8bf5'), 2)
    expect(luminance('oklch(0.7829 0.1258 82.3)')).toBeCloseTo(luminance('#e0b050'), 2)
  })

  // Fuera del gamut sRGB la conversión da canales negativos o mayores a 1, y
  // sin recortarlos el contraste saldría un número imposible. Este croma no
  // existe en sRGB a esa luminosidad.
  it('un color fuera del gamut sRGB se recorta en vez de mentir', () => {
    const l = luminance('oklch(0.7 0.4 150)')
    expect(l).toBeGreaterThanOrEqual(0)
    expect(l).toBeLessThanOrEqual(1)
  })
})

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

  // Un color fuera del gamut sRGB no se puede pintar: el browser lo mapea al
  // borde y lo que se ve deja de ser lo que el gate mide. Declarar el croma
  // que sRGB sí puede representar no pierde saturación —la pantalla iba a
  // mostrar ese color igual— y hace que la medición valga.
  it('ningún token de color se sale del gamut sRGB', () => {
    const { light, dark } = palettes()
    for (const [modo, tokens] of [['clara', light], ['oscura', dark]]) {
      for (const t of ['--ground', '--panel', '--raise', '--line', '--fg', '--muted', '--accent', '--amber']) {
        const m = resolve(t, tokens).match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/)
        const canales = oklchToLinear(+m[1], +m[2], +m[3])
        for (const c of canales) {
          expect(c, `${t} en la paleta ${modo} se sale de sRGB`).toBeGreaterThanOrEqual(-1e-6)
          expect(c, `${t} en la paleta ${modo} se sale de sRGB`).toBeLessThanOrEqual(1 + 1e-6)
        }
      }
    }
  })
})

// El color del error no es un token: vive en una regla, así que `palettes()`
// no lo ve. Y es la cadena que más importa que se lea: si el rediseño de la
// paleta lo dejó por debajo del piso, nadie se entera hasta que alguien no
// puede leer por qué falló su descarga.
describe('el mensaje de error se lee en las dos paletas', () => {
  const colorDeError = (bloque) => {
    const m = bloque.match(/\.status\.error\s*\{\s*color:\s*([^;]+);/)
    return m && m[1].trim()
  }

  it('en la paleta clara', () => {
    const { light } = palettes()
    const claro = colorDeError(css.replace(media('(prefers-color-scheme: dark)'), ''))
    expect(claro).toBeTruthy()
    expect(contrast(claro, resolve('--ground', light))).toBeGreaterThanOrEqual(4.5)
  })

  it('en la paleta oscura', () => {
    const { dark } = palettes()
    const oscuro = colorDeError(media('(prefers-color-scheme: dark)'))
    expect(oscuro).toBeTruthy()
    expect(contrast(oscuro, resolve('--ground', dark))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('las fuentes se sirven desde acá (APAR-R3)', () => {
  it('no hay ningún origen de terceros en la hoja', () => {
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/)
  })

  it('las cinco caras están declaradas y apuntan a public/fonts', () => {
    const caras = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1])
    expect(caras).toHaveLength(5)
    for (const c of caras) {
      expect(c).toMatch(/url\(["']?\/fonts\/[a-z0-9-]+\.woff2/)
      // `swap` y no `block`: la fuente no puede esconder el texto mientras
      // llega. El sitio se lee antes de verse lindo.
      expect(c).toMatch(/font-display:\s*swap/)
    }
  })
})
