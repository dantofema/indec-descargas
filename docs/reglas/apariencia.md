# Apariencia

Decisiones de producto sobre cómo se ve y cómo se mueve el sitio: la paleta, la tipografía, el
movimiento, y el tratamiento del basemap del IGN dentro de la consola.

## ✅ Reglas

### APAR-R1 — Hay dos paletas, y las dos son la misma consola

La identidad del rediseño —grafito frío, acento cián de señal, tipografía y movimiento— es una
sola, pero el modo no es parte de esa elección: el sitio sigue `prefers-color-scheme` del sistema
operativo de quien visita, con una paleta clara y una oscura que comparten construcción —mismo
eje de matiz, mismos acentos con croma y luminosidad compartidos— y sólo varían en luminosidad de
superficie.

El modo claro **ya existía** antes de este rediseño: `src/style.css` ya tenía su bloque
`@media (prefers-color-scheme: dark)` con paleta propia, y `src/style.test.js` ya lo auditaba —hay
un test que exige que la clara sea clara y la oscura sea oscura, no al revés—. Una primera
versión del spec de este rediseño decía que el sitio era claro-solo y proponía hacerlo
oscuro-solo: era falso, y de haberse escrito así no habría sido elegir una dirección estética,
habría sido borrar una función de accesibilidad que ya estaba construida y probada.

**Por qué:** seguir la preferencia del sistema operativo es lo que le permite a alguien con
fotosensibilidad, o que simplemente lee de noche, no tener que pelear con el sitio para verlo
cómodo. Tratar el modo como una decisión de "qué dirección estética elegimos" —en vez de una
plataforma que ya corría y que el rediseño hereda— es cómo se llega a proponer borrarlo por
accidente, que es exactamente lo que pasó acá una vez.

### APAR-R2 — Todo el color se declara en oklch, y los dos acentos comparten croma y luminosidad

Los ocho tokens de cada paleta (`--ground`, `--panel`, `--raise`, `--line`, `--fg`, `--muted`,
`--accent`, `--amber`) se escriben en oklch, no en hex ni en hsl. Las cuatro superficies de fondo
comparten un solo eje de matiz y sólo varían en luminosidad; `--accent` y `--amber` comparten
croma y luminosidad y sólo cambian de matiz, así que ninguno de los dos pesa más que el otro en
la interfaz —el acento no grita más fuerte que el aviso de costo, ni al revés—.

**Por qué:** oklch es perceptualmente uniforme —dos colores con la misma luminosidad se ven con
el mismo peso visual, cosa que hex y hsl no garantizan—, así que es la única forma de construir
"acento y costo pesan igual" y de verificarlo en la suite en vez de a ojo. Declarar en hex vuelve
a poner esa decisión a criterio de quien mira la pantalla, y un valor fuera del gamut sRGB se
recorta en el browser sin avisar: lo que el token dice dejaría de ser lo que efectivamente se
pinta, y nadie se entera hasta que alguien mide con un instrumento.

### APAR-R3 — Las fuentes se auto-hospedan

Space Grotesk (500/700, títulos y controles), IBM Plex Sans (400, lectura) e IBM Plex Mono
(400/500, todo número, código y metadato) se sirven como `@font-face` con los woff2 en el propio
sitio, no desde `fonts.googleapis.com` ni ningún otro CDN de fuentes. Las cinco caras, en subset
latino, pesan 34.560 bytes (~33 KB) medidos.

**Por qué:** hoy este sitio sólo le habla a dos terceros —el GeoServer del INDEC, de donde salen
los datos, y los tiles del IGN, de donde sale el mapa— y ninguno de los dos es opcional: son la
razón de ser del sitio. Sumar `fonts.googleapis.com` agrega una resolución DNS, un handshake TLS
y un tercero que ve quién visita, todo para ahorrarse 33 KB que el propio build ya puede servir.
Perder esta regla es perder esa cuenta: usar Google Fonts porque es más fácil de enchufar, sin
notar que también es agregar un cuarto origen a un sitio que no le pide nada a nadie que no sea
imprescindible.

### APAR-R4 — Una entrada orquestada, y `prefers-reduced-motion` la apaga entera

El movimiento de la consola —la entrada del hero, los contadores del home, el hover de tile, fila
y pestaña— es una sola secuencia orquestada, no micro-interacciones sueltas: los ocho contadores,
por ejemplo, corren con un solo reloj compartido, no con ocho relojes independientes. Toda
animación y transición de la hoja se apaga bajo `@media (prefers-reduced-motion: reduce)`, sin
excepciones: los contadores saltan directo a su valor final y los estados quedan sin transición.

Antes de este rediseño el sitio tenía cero transiciones y cero animaciones. El movimiento es
enteramente nuevo, así que el interruptor que lo apaga nace con él en la misma tanda de trabajo,
no como una tarea de accesibilidad para después.

**Por qué:** para alguien con sensibilidad vestibular, ocho números corriendo o una entrada con
escalones no es un adorno: es un síntoma. Un sitio que antes no tenía nada de movimiento no le
debía nada a `prefers-reduced-motion`; uno que agrega movimiento y no lo apaga le impone una
molestia física a quien ya le dijo al sistema operativo que no la quiere.

### APAR-R5 — El basemap claro es una superficie encendida, no se disimula

Los tiles del IGN son claros y no se pueden oscurecer sin falsear el dato que muestran. En la
paleta oscura eso se trata como una pantalla encendida dentro de la consola: pozo hundido, borde
teñido de acento y sombra interior más una proyectada, para que la superficie clara se lea como
algo que está prendido y no como un parche pegado encima de la interfaz. En la paleta clara el
tratamiento no existe, porque el mapa ya se apoya en un fondo de su misma familia y el problema no
se presenta.

La geometría dibujada sobre el mapa —el objeto de la ficha— usa el token `--accent` del sitio, en
las dos paletas, y no un azul literal: es lo que se lee sobre el papel claro del IGN sin importar
qué paleta esté activa (SITIO-R8).

**Por qué:** disimular el rectángulo claro —oscureciéndolo, o encima con un filtro— falsearía el
dato que el basemap muestra, que es justo lo que esta regla evita. Y un azul que no cambia con la
paleta es un color que dejó de significar nada en la consola: la elección de qué resalta pasa a
ser "lo que quedó de antes", no "lo que el sitio usa para señalar una acción o un dato dibujado".

### APAR-R6 — El contraste de texto se verifica en la suite, en las dos paletas

`src/style.test.js` audita el contraste real de los pares de color que importan —texto sobre
fondo, texto secundario, el acento y el texto del botón primario— calculando la luminancia desde
los valores oklch de las dos paletas, no estimándolo a ojo ni copiándolo de una medición hecha una
sola vez.

**Por qué:** una tabla de contraste escrita a mano vale lo que valía la última vez que alguien la
revisó. Un token que se toca después —por ejemplo para resolver un problema de gamut— puede bajar
un par por debajo del piso legible sin que nadie lo note hasta que alguien no pueda leer el sitio.
Con el gate, ese error rompe la suite en el mismo commit que lo introduce, no en un reporte de
accesibilidad meses después.

### APAR-R7 — La consola oscura es la de por defecto; la clara la elige la persona

El sitio no le pregunta al sistema qué paleta quiere. La oscura es el `:root` pelado —lo que ve
quien entra sin haber elegido nada— y la clara vive detrás de `:root[data-tema="claro"]`, que
sólo aparece cuando alguien toca el botón del header. La elección se guarda y sobrevive a la
recarga. No queda ningún `@media (prefers-color-scheme)` en la hoja, y la suite falla si vuelve.

El botón está en el nav de las cuatro páginas, y el script que aplica el tema guardado se inyecta
en el `<head>` **antes** de la hoja de estilo.

**Por qué:** la consola oscura es la identidad que se eligió para el sitio, y atada a
`prefers-color-scheme` no la veía nadie que tuviera el escritorio en claro —la mayoría—: el
rediseño existía y no se veía. Dos autoridades decidiendo el tema es una que no manda, así que el
sistema deja de opinar y decide la persona. La paleta clara no se borra: sigue auditada por
APAR-R6 y a un click. Y el script va antes de la hoja porque, después, el browser ya tiene con
qué pintar y quien eligió el tema claro se come un destello oscuro en cada carga.

**Decidida y construida el 2026-09-09** · ✅ implementada · `src/tema.test.js`, `src/style.test.js`

### APAR-R8 — La marca es «Marco», y sus archivos declaran de qué token salieron

Cuatro esquinas encuadrando un polígono irregular. El encuadre va en `--fg` porque es la
estructura; el polígono en `--accent` porque es el dato. Dos variantes de trazo, y no es
decoración: **1,6 adentro de la página** y **2,4 con el polígono a 1,9 para 16 px**, porque a
trazo fino el encuadre desaparece en una pestaña.

En el header la marca va **en línea en el HTML**, no como `<img>`: así hereda los tokens y cambia
sola con el botón del tema (APAR-R7). En `favicon.svg` los colores van literales, porque un
favicon se abre fuera de la página y ahí la hoja no llega — y el archivo declara en un comentario
de qué `oklch` salió cada hex, que es lo que `src/marca.test.js` compara contra `src/style.css`.

Adentro del favicon `prefers-color-scheme` **sí** decide, y no contradice a APAR-R7: esa regla
habla de la página, donde la persona elige con un botón. En el cromo del browser no hay botón ni
página.

**Por qué:** un favicon es el único pedazo de la identidad que se dibuja fuera del alcance de la
hoja de estilo, así que es el único que puede quedar desincronizado de la paleta sin que nada se
rompa —hasta que alguien mira la pestaña y ve un color que el sitio ya no usa—. El comentario con
el `oklch` de origen convierte esa deriva silenciosa en un test rojo.

**Decidida y construida el 2026-09-09** · ✅ implementada · `src/marca.test.js`
