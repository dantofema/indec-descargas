# Consola cartográfica — diseño

Fecha: 2026-09-09. Estado: dirección elegida por el dueño, pendiente de plan.

Canvas del diseño: https://claude.ai/code/artifact/db3e09bd-4a59-4521-ab9e-f5892ffa40d8

Hoy `indec-descargas` es una utilidad sobria: fuente de sistema, azul de framework
(`#1f6feb`, el de GitHub), y **cero transiciones y cero animaciones en las 16.331 líneas-byte
de `src/style.css`** —verificado por grep—. Funciona y no dice nada.

Este diseño le da una identidad: consola cartográfica. Grafito frío, acento cián de señal,
monoespaciada para todo número. El dueño eligió esta dirección entre tres (editorial claro y
plano técnico eran las otras).

La identidad no es el modo: el sitio ya sigue la preferencia del sistema con dos paletas, y las
dos quedan (§1).

## Qué se construye

1. **Una paleta en oklch**, ocho tokens, con los dos acentos compartiendo croma y luminosidad.
2. **Tres familias tipográficas auto-hospedadas**, una por trabajo: display, lectura, datos.
3. **Movimiento**: una entrada orquestada, contadores que corren, y estados que responden al
   hover — todo apagable con `prefers-reduced-motion`.
4. **El basemap claro del IGN tratado como superficie encendida** cuando la interfaz está oscura.
5. **Una superficie de reglas nueva**, `docs/reglas/apariencia.md`, porque estas son decisiones
   de producto y sin documentar se revierten solas.

## Lo que no cambia

- **La estructura.** Las cuatro páginas, el shell inyectado en build, la fila 1/2/3 de la ficha,
  el paginado: todo queda. Esto es una capa de superficie sobre un sistema que ya funciona.
- **El comportamiento.** Ninguna regla de `buscador.md`, `descargas.md`, `navegacion.md` o
  `notas.md` cambia de sentido. En particular **SITIO-R3** —un enlace compartido no le cobra los
  12,4 s de una vía a quien lo abre— y **SITIO-R9** —el sitio dice que no es del INDEC— siguen
  en pie y el diseño los muestra.
- **Los ocho iconos.** Ya existen en `src/pages/home.js`, son trazo simple sobre grilla de 24, y
  son buenos. Se recolorean, no se redibujan.
- **DES-Q1 sigue abierta.** Esta rama no la contesta.

## 1. Paleta y modo

Ocho tokens. Las cuatro superficies comparten un solo eje de matiz (250, azul frío) y sólo
varían en luminosidad; los dos acentos comparten croma (0.125) y luminosidad (0.80) y sólo
cambian de matiz, así que ninguno pesa más que el otro.

| Token | oklch | Rol |
|---|---|---|
| `--ground` | `oklch(0.17 0.012 250)` | fondo de página |
| `--panel` | `oklch(0.215 0.014 250)` | tiles, tabla, campos |
| `--raise` | `oklch(0.26 0.015 250)` | hover de superficie |
| `--line` | `oklch(0.32 0.014 250)` | bordes y separadores |
| `--fg` | `oklch(0.96 0.005 250)` | texto |
| `--muted` | `oklch(0.72 0.012 250)` | texto secundario |
| `--accent` | `oklch(0.80 0.125 190)` | acción, foco, geometría dibujada |
| `--amber` | `oklch(0.80 0.125 75)` | costo medido — nunca error |

El blanco lleva croma 0.005, muy por debajo de 0.02: un blanco puro sobre grafito vibra.

**Las dos paletas quedan, y las dos son la misma consola.**

Una versión anterior de este documento decía que el sitio era claro-solo y que el rediseño sería
oscuro-solo. **Era falso:** `src/style.css:413` ya tiene un bloque
`@media (prefers-color-scheme: dark)` con su propia paleta, y `src/style.test.js` la audita —hay
un test que exige que "la clara es clara y la oscura es oscura, no al revés"—. Escribir
"oscuro-solo" no habría sido elegir una dirección: habría sido **borrar una función de
accesibilidad que ya existe**, que es seguir la preferencia del sistema operativo de quien
visita. Eso no entra en un rediseño de superficie.

Así que la dirección elegida es **la identidad**, no el modo: la tipografía, el movimiento, los
iconos, la densidad y la familia de acentos son los mismos en las dos. Lo que cambia entre
paletas son las superficies y la luminosidad del acento.

La tabla de arriba es la paleta **oscura**. La clara es la misma construcción invertida, con el
acento bajado en luminosidad porque un cián de `L 0.80` sobre blanco mide ~1,6:1 y es ilegible:

| Token | oklch (claro) | Rol |
|---|---|---|
| `--ground` | `oklch(0.99 0.002 250)` | fondo de página |
| `--panel` | `oklch(0.975 0.004 250)` | tiles, tabla, campos |
| `--raise` | `oklch(0.95 0.006 250)` | hover de superficie |
| `--line` | `oklch(0.90 0.006 250)` | bordes y separadores |
| `--fg` | `oklch(0.22 0.012 250)` | texto |
| `--muted` | `oklch(0.50 0.014 250)` | texto secundario |
| `--accent` | `oklch(0.55 0.14 190)` | acción, foco, geometría |
| `--amber` | `oklch(0.55 0.14 75)` | costo medido |

Los valores exactos los fija el gate de contraste (§6), no esta tabla: si un par no llega al
piso, se ajusta la luminosidad hasta que llegue.

**`--amber` es costo, no error.** El único lugar donde aparece es el panel que declara una espera
medida antes de cobrarla (NAV-R7, SITIO-R3). Un rojo diría que algo falló; ahí no falló nada, hay
un precio.

## 2. Tipografía

Tres familias, una por trabajo:

| Familia | Uso | Reemplazo si no carga |
|---|---|---|
| **Space Grotesk** 500/700 | títulos, botones, pestañas | `system-ui` |
| **IBM Plex Sans** 400 | lectura | `system-ui` |
| **IBM Plex Mono** 400/500 | todo número, código y metadato | `ui-monospace, SFMono-Regular, Menlo` |

**Todo número va en cifras tabulares** (`font-variant-numeric: tabular-nums`). Sin eso un
contador que sube cambia de ancho en cada cuadro y la grilla late.

**Se auto-hospedan.** Medido el 2026-09-09, las cinco caras en subset latino pesan **34.560 bytes
(~33 KB)** en woff2. Ese es el costo entero de no depender de `fonts.googleapis.com`.

Hoy este sitio no le pide nada a ningún tercero: sólo al GeoServer del INDEC —del que salen los
datos— y a los tiles del IGN —de los que sale el mapa—. Meter un tercer origen para tipografía
agrega una resolución DNS, un handshake TLS y un tercero que ve quién visita el sitio, todo para
ahorrar 33 KB que el build ya puede servir. No vale la pena.

Consecuencia: hay un paso de build o un directorio en `public/` con los woff2 y un bloque de
`@font-face` con `font-display: swap`.

## 3. Movimiento

Hoy no hay ninguno. Lo que entra es poco y cada pieza tiene un motivo:

| Qué | Duración | Curva | Por qué |
|---|---|---|---|
| entrada del hero | 550 ms | `cubic-bezier(.2,.7,.3,1)` | cuatro escalones de 80 ms; ordena la lectura una vez |
| contadores | 1300 ms | easeOutCubic | un solo reloj para los ocho |
| tile hover | 220 ms | `cubic-bezier(.2,.7,.3,1)` | −2 px y la línea inferior se dibuja |
| fila de tabla | 160 ms | ease | las acciones pasan de 55 % a 100 % |
| pestaña y nav | 240 ms | `cubic-bezier(.2,.7,.3,1)` | el subrayado crece desde la izquierda |

**Una entrada orquestada, no micro-interacciones sueltas.** Los ocho contadores comparten reloj:
no son ocho animaciones, es una.

**Todo se apaga con `prefers-reduced-motion: reduce`**: los contadores saltan a su valor final y
los estados quedan sin transición. Para alguien con sensibilidad vestibular, ocho números
corriendo no es un adorno.

**El hover del botón deja de ser `filter: brightness(1.08)`** y pasa a ser un anillo de foco. En
oscuro, subir el brillo de un cián ya luminoso no se percibe.

## 4. El basemap claro dentro de la interfaz oscura

Es el problema que la paleta oscura crea y hay que resolverlo, no esconderlo: los tiles del IGN
son claros y no se pueden oscurecer sin falsear el dato que muestran. **En la paleta clara el
problema no existe** —el mapa se apoya en un fondo de su misma familia— así que el tratamiento de
abajo vive en el bloque oscuro.

**El mapa se trata como una pantalla encendida dentro de la consola:** pozo con borde teñido de
acento al 30 %, sombra interior de 1 px y una sombra proyectada hacia abajo, para que la
superficie clara se lea como algo que está prendido y no como un parche pegado.

**Y la geometría dibujada cambia de color:** del azul `#1f6feb` actual al cián del acento, que es
lo que se lee sobre el papel claro del IGN. Eso toca `src/map.js`, que hoy dibuja con un literal.

La atribución del IGN queda donde está (SITIO-R8) y se le da un fondo claro semitransparente para
que se lea sobre los tiles.

## 5. Contadores

Los ocho totales suben desde cero al cargar el home, en 1300 ms, con easeOutCubic —arranca rápido
y se estaciona, que es como se lee un instrumento; lineal parecería una barra de carga—.

Salen de `totales.json`, como hoy (SITIO-R7): **el diseño no cambia de dónde vienen los números**,
sólo cómo aparecen. Si el archivo no llega, no hay animación que correr y el tile queda como está
hoy.

## 6. Accesibilidad, con gate

El riesgo de una paleta nueva es el contraste, y el riesgo de una tabla de contraste escrita a
mano es que sea mentira.

**Este gate ya existe y hay que extenderlo, no inventarlo.** `src/style.test.js` trae
`palettes()`, `resolve()`, `luminance()` y `contrast()`, audita las dos paletas y ya documenta una
corrección medida: `#b32020` daba 2,71:1 sobre el fondo oscuro y se reemplazó por `#ff6b6b`, que
mide 6,53:1. El trabajo es sumar pares y hacer que los helpers entiendan `oklch()`, que hoy no
parsean.

**El contraste se verifica en la suite, no se estima**, en **las dos paletas**:

- `--fg` sobre `--ground` y sobre `--panel`: **≥ 7:1** (AAA para texto normal)
- `--muted` sobre `--ground` y sobre `--panel`: **≥ 4.5:1** (AA)
- `--accent` sobre `--ground`: **≥ 4.5:1**
- `--ground` sobre `--accent` (el texto del botón primario): **≥ 4.5:1**

Si un token se toca y algún par baja del piso, la suite se pone roja. Es la misma disciplina que
NOTA-R2 aplica a los números de las notas: lo verificable se verifica.

Además: el foco visible nunca se saca (`:focus-visible` con anillo de acento), y los blancos de
los tiles se apoyan en borde además de color, para no depender sólo del matiz.

## 7. Reglas

Superficie nueva: **`docs/reglas/apariencia.md`**, con seis reglas. Es una superficie propia y no
un apéndice de `sitio.md` porque son decisiones sobre cómo se ve y cómo se mueve, no sobre qué
páginas existen.

| Regla | Qué decide |
|---|---|
| **APAR-R1** | Hay dos paletas y las dos son la misma consola: la identidad no es el modo |
| **APAR-R2** | Todo el color se declara en oklch; los dos acentos comparten croma y luminosidad |
| **APAR-R3** | Las fuentes se auto-hospedan: el sitio no le pide nada a un tercero |
| **APAR-R4** | Una entrada orquestada, y todo el movimiento se apaga con `prefers-reduced-motion` |
| **APAR-R5** | El basemap claro se trata como superficie encendida, no se disimula |
| **APAR-R6** | El contraste de texto se verifica en la suite, en las dos paletas |

`SITIO-R8` gana una línea: la geometría se dibuja con el acento del sitio, no con un azul literal.

`docs/reglas/README.md` suma la fila de la superficie nueva.

## 8. Qué queda afuera a propósito

- **Borrar el modo claro.** Se evaluó y se descartó: existe, es accesibilidad, y sacarlo no es
  una decisión de superficie (§1).
- **Rediseñar `/notas/` y `/servicios/` más allá de heredar los tokens.** Son páginas de texto: el
  sistema nuevo las mejora sin trabajo específico, y darles layout propio es otro alcance.
- **Cambiar el titular del home.** El canvas propone «La cartografía del INDEC, lista para tus
  proyectos» en lugar del actual, que no cierra gramaticalmente
  («más fácil de descargar y usarla»). **Es una propuesta, no parte del rediseño:** si el dueño no
  la elige, el titular queda como está y el diseño funciona igual.
- **Iconos nuevos.** Los ocho que hay alcanzan.
