# Navegar las capas hijas — diseño

**Fecha:** 2026-09-06
**Estado:** aprobado, pendiente de plan de implementación
**Antecede:** [`2026-09-04-indec-descargas-design.md`](2026-09-04-indec-descargas-design.md)

## Problema

Hoy la ficha ofrece capas hijas **enteras**: un `.gpkg` con los 432 radios de Tres de Febrero.
No hay forma de ver qué radios son, de mirar uno en el mapa, ni de bajar uno solo. Y la relación
sólo va hacia abajo: parado en un departamento no se puede bajar su jurisdicción.

Este diseño agrega tres cosas:

1. **Recorrer** los objetos hijos en una tabla paginada, verlos en el mapa y bajarlos de a uno.
2. **Bajar los padres**, no sólo los hijos.
3. **Notas** que expliquen las trampas de la cartografía del INDEC donde aparecen.

Y saca el tope de descarga, que la medición mostró innecesario.

## El catálogo ya no alcanza

`catalog.json` tiene **conteos** de hijos (`ch: {radios: 432}`), no los hijos. Los 477.588
registros de vías no entran en un JSON commiteado, y no van a entrar.

Las filas de la tabla salen del GeoServer **en vivo**, paginadas. Es una vía de datos nueva para
un sitio que hasta ahora sólo leía un JSON estático. El catálogo sigue siendo la fuente de la
búsqueda, de los conteos y de la jerarquía; el GeoServer pasa a ser también fuente de lectura,
no sólo destino de descarga.

### Lo que el GeoServer permite, medido el 2026-09-06

| Capacidad | Verificación |
|---|---|
| Paginado | `startIndex` + `count` sobre `cde='06840'`: página 0 y página 2 encadenan sin repetir |
| Orden estable | `sortBy=cod_indec,id` en vías: página 0 da 52271/51427/51428, página 3 sigue 51429/51423/51412 |
| Sin geometría | `propertyName` sin el campo geométrico: 20 filas de vías pesan **3,1 KB** |
| Conteo | `totalFeatures` viene en cada página; no hace falta un pedido aparte |
| Tope del servidor | `CountDefault = 1000000` en el GetCapabilities |

El paginado sin geometría es lo que hace viable la tabla: una página cuesta lo mismo para un
departamento que para una provincia.

## La ficha, en cuatro filas

El layout de dos columnas (mapa | panel) se reemplaza por cuatro filas apiladas. La tabla de vías
tiene 21 columnas: en media pantalla no entra.

```
┌─────────────────────┬─────────────────────┐
│  1  mapa            │  identidad + su     │   ← lo que hoy es .detail
│                     │     descarga        │
├─────────────────────┴─────────────────────┤
│  2  de qué forma parte │ qué contiene,     │   ← padres (nuevo) + capas enteras (hoy)
│     (padres)           │ capa entera       │
├───────────────────────────────────────────┤
│  3  recorrer y descargar de a uno         │   ← nuevo: tabs + tabla paginada
│     [tabs] [tabla] [paginador]            │
├───────────────────────────────────────────┤
│  4  notas                                 │   ← nuevo: tabs de prosa
│     [tabs] [texto]                        │
└───────────────────────────────────────────┘
```

El objeto en sí y su descarga van en la fila 1, con su identidad: no es hijo ni padre de nadie.

## Fila 2 — descargas enteras

### La cadena de padres

Cada tipo conoce padres distintos. Verificado contra el GeoServer:

| Tipo | Padres | Cómo se obtiene el código |
|---|---|---|
| Jurisdicción | ninguno | — |
| Departamento | jurisdicción | `cpr` = los 2 primeros dígitos de `cde` |
| Localidad censal | departamento, jurisdicción, aglomerado | `cde` = los 5 primeros de `clc`; `cpr` = los 2 primeros; el aglomerado **no es derivable** |
| Gobierno local | jurisdicción | `cpr` = los 2 primeros de `cmu` |
| Aglomerado | ninguno | Gran Buenos Aires cruza dos jurisdicciones |

Los códigos derivados **se buscan en el catálogo** y sólo se ofrecen si existen ahí. No se arma
una URL con un código derivado a ciegas: DES-R8 documenta que los códigos del INDEC no cierran
entre capas (529 departamentos en `departamentos`, 530 en radios, 527 en vías), así que un padre
derivado puede no existir. Si no está en el catálogo, no se ofrece.

El aglomerado de una localidad no sale de su código. El build lo agrega al catálogo como campo
`ag` en los objetos `loc`: `aggregate.mjs` ya arma `locByAglo`, así que el dato está ahí.
Regenerar el índice con caché tarda segundos (DES-R6).

### El tope se saca

**Medido, no estimado**, el 2026-09-06:

| Caso | Features | Tamaño | Tiempo | TTFB |
|---|---|---|---|---|
| Radios de Tres de Febrero (hoy permitido) | 432 | 348 KB | 1,2 s | 1,0 s |
| Radios de Buenos Aires (hoy bloqueado) | 23.901 | 22 MB | 6,9 s | 6,2 s |
| **Vías de Buenos Aires** (peor caso del catálogo) | 179.029 | **74 MB** | **37 s** | 35 s |

Los tres devuelven HTTP 200. El `.gpkg` de los radios de Buenos Aires se abrió y se contaron sus
filas: **23.901 de 23.901**, en EPSG:4326. No hay truncado, y el `CountDefault` del servidor está
en un millón de features contra un pedido máximo de 179.029.

La página no puede colgarse: la descarga es un `<a href>` cross-origin que toma el gestor de
descargas del browser. No hay `fetch`, no hay JS en el camino.

Sólo **50 de 6.497** combinaciones objeto/capa superan el tope actual: el 0,8%.

Entonces el tope de 5.000 desaparece y en su lugar va un **aviso de peso y espera** al lado del
botón, que queda siempre habilitado. El aviso se estima por capa a partir del conteo:

| Capa | Bytes por feature (medidos) |
|---|---|
| radios, fracciones, departamentos, localidades (polígonos) | 0,95 KB |
| vías (líneas) | 0,41 KB |

Sólo se midieron radios y vías; las demás capas de polígonos usan la constante de radios, que es
la mayor de las dos y por lo tanto sobreestima antes que engañar.

El umbral del aviso es **10 MB estimados**. Por debajo no se dice nada: con 0,95 KB por feature
eso son unos 10.500 objetos, y sólo 50 de las 6.497 combinaciones del catálogo llegan ahí. El
aviso dice el tamaño estimado y los segundos estimados, ambos derivados del conteo, y aclara que
son estimaciones.

Lo que **no** cambia es el núcleo de DES-R2: no se ofrecen descargas parciales. Antes eso
significaba "no descargar"; ahora significa "descargar todo, avisando lo que pesa". La evidencia
del `CountDefault` es lo que respalda que "todo" sea realmente todo.

## Fila 3 — recorrer y descargar de a uno

Una pestaña por capa hija del objeto, con su conteo. Cada pestaña carga su primera página al
abrirse, no antes: abrir la ficha no dispara cuatro pedidos.

### El pedido

```
GET https://geonode.indec.gob.ar/geoserver/ows
  ?service=WFS&version=2.0.0&request=GetFeature
  &typenames=<capa hija>
  &outputFormat=application/json
  &CQL_FILTER=<campo del padre>='<código>'
  &propertyName=<columnas, sin geometría>
  &sortBy=<clave estable>
  &count=20&startIndex=<página × 20>
```

`totalFeatures` de la respuesta manda el paginador. El conteo del catálogo se usa para la
pestaña; el de la respuesta, para el "1–20 de N", y si difieren gana el del servidor: es el dato
del momento.

### Claves de orden y de identidad

| Capa | `sortBy` | Campo que identifica una fila para descargarla |
|---|---|---|
| Departamentos | `cde` | `cde` |
| Fracciones | `cod_indec` | `cod_indec` |
| Radios | `cod_indec` | `cod_indec` |
| Localidades censales | `clc` | `clc` |
| Vías | `cod_indec,id` | `cod_indec` |

Los tres primeros devuelven exactamente 1 feature por código (verificado). Vías es la excepción
y tiene su nota.

### Columnas

| Capa | Columnas |
|---|---|
| Fracciones | fracción, código |
| Radios | radio, fracción, tipo (urbano/rural), código |
| Localidades censales | nombre, tipo, aglomerado, código |
| Departamentos | nombre, código |
| Vías | **los 21 campos que publica el GeoServer**, en su orden, sin recortar |

Fracciones y radios **no tienen nombre** en el Marco Geoestadístico: se identifican por número y
por un código de 7 o 9 dígitos. La tabla los muestra así y no inventa un rótulo.

La tabla de vías scrollea a lo ancho con la primera columna fija. Es la única que necesita
`overflow-x`; el resto entra.

### Vías: tramos, no calles

La capa lista **tramos geométricos**, no calles. Las 1.487 vías de Tres de Febrero son 727
calles; la más partida tiene 80 tramos. Los tres tramos de "1002 A BEHRENS" son idénticos en los
21 campos publicados: sólo cambia el `id` interno y la geometría.

Se muestra sin agrupar, tal como lo publica el INDEC, por dos razones: agrupar en el cliente
exige traer todas las filas del objeto —215 KB en un partido, **3,9 MB en una provincia**— y WFS
no agrupa en el servidor; y lo que se ve tiene que ser lo que baja.

**Descargar en cualquier fila de una calle baja la calle entera, con todos sus tramos**, porque
el filtro es `cod_indec`. Lo dice la nota de la fila 4.

### Ver en el mapa

"Ver" pide ese único feature **con** geometría y lo dibuja, reemplazando lo que el mapa tenga.
Es el mismo camino que ya usa `map.js` para el objeto seleccionado, con otro filtro. La fila
queda marcada mientras es la que se está viendo.

Volver al objeto padre es elegirlo de nuevo en el buscador. No se agrega un botón "volver": la
ficha no cambia de objeto, sólo cambia lo que el mapa dibuja.

## Fila 4 — notas

Prosa, no datos. Una pestaña por objeto que necesite una aclaración; si el objeto no necesita
ninguna, la fila no aparece. Arrancan dos:

**Vías de circulación.** Que la capa lista tramos y no calles, con el número real del objeto que
se está mirando, y que descargar una fila baja la calle entera.

**Localidad censal.** Que "localidad censal" no es lo que en la conversación diaria se llama
localidad, y que a menudo no coincide con el municipio ni con el partido del mismo nombre.
El ejemplo es Avellaneda, verificado contra el GeoServer: el INDEC publica tres objetos con el
mismo `nam` y límites distintos.

| Capa | `fna` | Código |
|---|---|---|
| `departamentos` | Partido de Avellaneda | 06035 |
| `gobiernos_locales4` | Municipio Avellaneda | 060035 |
| `localidades_censales` | Localidad Avellaneda | 06035010 |

Los tres salen juntos al buscar "avellaneda", que es exactamente cuando la nota hace falta.

Las notas viven en un módulo de datos, no incrustadas en el HTML: son contenido editorial que va
a crecer, y tienen que poder citarse desde un test.

## Componentes

Lo nuevo, y qué toca de lo que hay:

| Archivo | Qué hace |
|---|---|
| `src/features.js` **nuevo** | Arma el pedido WFS de una página de hijos y normaliza la respuesta a filas. Sin DOM. |
| `src/columns.js` **nuevo** | Columnas, `sortBy` y campo identificador por capa. Tabla de datos, sin lógica. |
| `src/parents.js` **nuevo** | Cadena de padres de un objeto, resuelta contra el catálogo. Sin DOM. |
| `src/notes.js` **nuevo** | Las notas y a qué capa aplica cada una. |
| `src/table.js` **nuevo** | Renderiza tabla + paginador. Recibe filas, no las pide. |
| `src/tabs.js` **nuevo** | Pestañas con ARIA, reutilizado por la fila 3 y la fila 4. |
| `src/browser.js` **nuevo** | El estado de la fila 3: pestaña activa, página, fila vista, pedido en vuelo. |
| `src/download.js` | `CHILD_LAYERS` gana el campo identificador; nace `featureUrl()`; muere `canDownload()`. |
| `src/children.js` | Deja de decidir el tope; pasa a decidir el aviso de peso. |
| `src/catalog.js` | Sin cambios (ya deriva `sp`). |
| `src/main.js` | Cablea las cuatro filas. |
| `index.html` | Las cuatro filas. |
| `scripts/lib/aggregate.mjs` | Agrega `ag` a los objetos `loc`. |

`main.js` hoy tiene 107 líneas y ya es el único archivo que sabe de todo. Con cuatro filas se
pasa: el cableado de la fila 3 —pestaña activa, página actual, fila vista— sale a un módulo
propio, `src/browser.js`, y `main.js` sigue siendo sólo el que conecta piezas.

## Errores

El GeoServer ahora se consulta durante la navegación, no sólo al descargar. Puede fallar.

- **Una página que no carga** muestra el error en el lugar de la tabla, con el motivo, y un botón
  para reintentar. Las otras pestañas y el resto de la ficha siguen andando.
- **Una página vacía cuando el catálogo dice que hay N** no se disfraza: se muestra el número del
  servidor. El catálogo puede haber quedado viejo (DES-R6) y eso es información, no un bug.
- **"Ver" que falla** deja el mapa como estaba y avisa; la descarga de esa fila sigue disponible,
  porque no depende del mapa.
- **Cambiar de pestaña con un pedido en vuelo** descarta la respuesta que llega tarde. Es la
  carrera más fácil de provocar acá: se resuelve marcando cada pedido y aceptando sólo el último.

## Testing

Vitest, sobre lo que tiene lógica de verdad. La red se mockea; el GeoServer no se llama en los
tests.

- `features.js` — la URL que arma para cada capa y página; que `propertyName` no pida geometría;
  el mapeo de la respuesta a filas; una respuesta sin `features`.
- `columns.js` — que toda capa de `CHILD_LAYERS` tenga columnas, `sortBy` e identificador. Es el
  test que se rompe cuando alguien agrega una capa y se olvida la mitad.
- `parents.js` — la cadena de cada uno de los cinco tipos; que un padre derivado que no está en
  el catálogo no se ofrezca; que el aglomerado salga de `ag` y no de un prefijo.
- `download.js` — `featureUrl()` bien escapada por capa; que un código no numérico explote.
- `children.js` — el umbral del aviso de peso en sus bordes.
- `table.js` — paginador en la primera página, en la última y con una sola página.
- `notes.js` — que cada nota apunte a una capa que existe.
- `main.test.js` — el recorrido entero: elegir un objeto, abrir una pestaña, ver una fila, pasar
  de página, y que la respuesta vieja de una pestaña abandonada no pise a la nueva.

## Fuera de alcance

- Agrupar vías por calle (Q1: se decidió listar tramos).
- Filtrar o buscar dentro de la tabla de hijos.
- Selección múltiple de filas para una descarga combinada.
- Hijos de gobiernos locales: sigue valiendo DES-R7.
- Dibujar en el mapa más de un hijo a la vez.

## Cómo conviene escalonarlo

Son tres trabajos separables, y en este orden cada uno deja el sitio entero y usable:

1. **Sacar el tope y la cadena de padres** (fila 2). No depende de nada nuevo: toca
   `download.js`, `children.js`, `parents.js` y el build. Cierra por sí solo.
2. **La fila 3.** El grueso: `features.js`, `columns.js`, `table.js`, `tabs.js`, `browser.js`,
   y el layout de cuatro filas.
3. **La fila 4.** Chico y sin dependencias con lo anterior salvo `tabs.js`.

El plan de implementación debería respetar ese corte: si el paso 2 se complica, los pasos 1 y 3
ya están en `main` y sirven solos.

## Decisiones que quedan como regla de producto

`docs/reglas/descargas.md` — reescribir:

- **DES-R1 y DES-R2 cambian.** El tope de 5.000 se saca. En su lugar, aviso de peso y espera con
  el botón habilitado. Sobrevive el núcleo de DES-R2: no hay descargas parciales.
- **DES-R5 muere** con el tope: ya no hay número que vivir en el catálogo.
- Nace: la descarga de un objeto hijo suelto filtra por su código identificador, y en vías eso
  baja la calle entera, no el tramo.
- Nace: se ofrece la cadena de padres completa, y sólo los padres que existen en el catálogo.

`docs/reglas/buscador.md` — sin cambios.

`docs/reglas/navegacion.md` **nuevo**, prefijo `NAV-`:

- Las capas hijas se recorren paginadas contra el GeoServer, 20 por página.
- Una pestaña carga su primera página al abrirse, no antes.
- Vías se lista por tramo, con los 21 campos publicados, sin agrupar.
- Fracciones y radios se listan sin nombre porque el INDEC no publica ninguno.
- La fila de notas aparece sólo si el objeto tiene alguna nota que mostrar.
