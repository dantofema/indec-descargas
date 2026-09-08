# Sitio multipágina — diseño

Fecha: 2026-09-08. Estado: aprobado en brainstorming, pendiente de plan.

Hoy `indec-descargas` es una sola página: buscás, y debajo del buscador aparece la ficha con
el mapa, los padres, los hijos y las notas. Este diseño la parte en cuatro páginas con URL
propia, le da un enlace permanente a cada objeto, mueve las notas a su propia superficie y
arregla una incoherencia vieja: hoy el mapa puede estar dibujando un radio mientras la ficha
de al lado sigue describiendo el departamento.

## Qué se construye

1. **Cuatro páginas** con URL propia: home comercial, resultados, notas y servicios del INDEC.
2. **Permalink compartible** de cada objeto, que es además la única fuente de verdad del estado.
3. **La ficha sigue al mapa**: el botón "Ver" de una fila hija actualiza el panel de identidad,
   no sólo el dibujo.
4. **Notas por objeto**, ocho, en su propia página con navegador vertical.
5. **Página de servicios geoespaciales del INDEC**, con datos verificados contra el servidor.
6. **Shell compartido** (header, CTA al Geoportal, footer institucional) inyectado en build.
7. **Mapa sin la atribución de Leaflet** ni su bandera de Ucrania; la del IGN queda.

## Restricciones que no cambian

- Sitio estático, sin backend, servido por GitHub Pages bajo `base: '/indec-descargas/'`.
- Los datos salen del GeoServer público del INDEC. `public/catalog.json` se commitea (DES-R6).
- Las reglas de producto vigentes de `docs/reglas/` siguen valiendo salvo donde este documento
  dice explícitamente lo contrario (NAV-R6 y la mitad "ni se anota" de NAV-R9).

## 1. Estructura de archivos y build

### Páginas y entradas

```
index.html              → /indec-descargas/             home comercial + buscador
resultados/index.html   → /indec-descargas/resultados/  mapa + ficha + tablas
notas/index.html        → /indec-descargas/notas/       navegador vertical, 8 objetos
servicios/index.html    → /indec-descargas/servicios/   servicios geoespaciales
```

Los HTML viven en directorios de la raíz porque Vite deriva la ruta de salida de la ruta de
entrada relativa a `root`: es lo único que produce URLs sin `.html`.

`vite.config.js` gana `build.rollupOptions.input` con las cuatro entradas. `base` y
`.github/workflows/deploy.yml` no se tocan.

### Módulos

```
src/pages/home.js        src/pages/resultados.js
src/pages/notas.js       src/pages/servicios.js
src/shell/header.html    src/shell/cta.html       src/shell/footer.html
src/permalink.js         src/totales.js
scripts/shell.mjs        (plugin de Vite + función pura)
```

`src/main.js` desaparece: casi todo su contenido pasa a `src/pages/resultados.js`, más la
lectura de la URL. **Ningún módulo existente cambia de contrato** salvo los dos casos que este
documento detalla (`showFeature` devuelve propiedades; `notes.js` se reindexa por objeto).
`search.js`, `download.js`, `table.js`, `columns.js`, `parents.js`, `children.js`,
`catalog.js`, `features.js`, `tabs.js`, `combobox.js` y `ui.js` quedan como están.

`browser.js` es la tercera excepción, y es chica: el enlace "Qué es un radio censal →" depende
de la pestaña activa, y la pestaña activa sólo la conoce él. Dibuja el enlace en el panel
usando el slug que le da `notes.js`. Una importación y una línea; no cambia su interfaz
pública (`createBrowser({container, onView, onError})` → `{show}`).

### El shell

`scripts/shell.mjs` exporta dos cosas separadas a propósito:

- `injectShell(html, partials)` — función pura. Reemplaza cada `<!--#shell:nombre-->` por
  `partials[nombre]`. **Tira si encuentra un marcador sin partial**: un typo no puede terminar
  en un footer que falta en silencio. Se testea sin levantar Vite.
- `shellPlugin()` — plugin de Vite que lee `src/shell/*.html` y llama a `injectShell` desde
  `transformIndexHtml`.

El resultado llega al browser ya resuelto: el CTA y el footer existen en el HTML servido aunque
el JS no corra.

El link activo del nav lo marca `data-pagina` en el `<body>` de cada página (un atributo por
archivo, sin duplicación) más cuatro selectores en `style.css`.

### Totales del home

`scripts/build-index.mjs` emite además `public/totales.json` (~300 bytes), commiteado como el
catálogo. Verificado contra `public/catalog.json` del 2026-09-06:

```json
{
  "generated": "2026-09-06",
  "jur": 24, "dep": 529, "loc": 4023, "gl": 2282, "aglo": 119,
  "fracciones": 6571, "radios": 66515, "vias": 477588
}
```

`jur/dep/loc/gl/aglo` son conteos de objetos por tipo; `fracciones/radios/vias` son la suma de
`ch` sobre las 24 jurisdicciones. El home lo muestra al instante y baja `catalog.json` (673 KB)
recién cuando el usuario toca el buscador.

## 2. El permalink

```
/indec-descargas/resultados/?t=dep&c=06840&capa=radios
```

- `t` — clave de `TYPES`: `jur|dep|loc|gl|aglo`.
- `c` — código del objeto, sólo dígitos (pasa por `isCode` de `download.js`).
- `capa` — opcional, clave de `CHILD_LAYERS`: `departamentos|fracciones|radios|localidades|vias`.

`src/permalink.js` expone `parse(search)` y `format(obj, capa)`, y es lo único que conoce los
nombres de los parámetros.

### El permalink es el estado, no una copia del estado

**Elegir un objeto en el buscador navega**, siempre: desde el home y también estando ya en
`/resultados/`. No hay `pushState`, no hay `popstate`, no hay dos fuentes de verdad que se
puedan desincronizar. Atrás y adelante funcionan porque son navegación de verdad.

Lo único que escribe la barra sin navegar es cambiar de pestaña, con `history.replaceState`.

El costo aceptado: un reload por objeto nuevo. `catalog.json` sale de la caché del browser y
Leaflet se reinicia. A cambio, la pieza más fácil de romper de esta feature no existe.

### Validación al entrar

| Caso | Qué pasa |
|---|---|
| Sin parámetros | Buscador y "Buscá un objeto para verlo en el mapa". No inicializa Leaflet. |
| `t` desconocido, o `c` que no son dígitos | Mensaje de error y el buscador. No se dibuja ficha. |
| `t`+`c` válidos pero el objeto no está en el catálogo | Mensaje de error y el buscador. |
| `capa` desconocida, o que ese objeto no tiene, o en cero | Se ignora; abre la primera pestaña (NAV-R9). |
| `capa=vias` | Abre la pestaña **en su panel de costo, sin pedir nada** (NAV-R7). |

El último caso no es un detalle: sin él, un link compartido le cobra al que lo abre hasta 99
segundos de espera que nunca pidió.

### Copiar enlace

Un botón "Copiar enlace" al lado del nombre del objeto copia `location.href` al portapapeles.

## 3. Comportamiento

### El invariante

**La ficha describe siempre lo que el mapa está dibujando.** Hoy no vale, y es la incoherencia
que este trabajo viene a arreglar.

### Buscador

`createCombobox` no cambia: cada página le pasa otro `onSelect`. El home y `/resultados/`
navegan a `format(obj)`.

En el desplegable **no va un `<button>` por fila**: es un `role="listbox"` y una opción de
listbox no puede contener un control sin romper el teclado y los lectores de pantalla. **La fila
entera es el "Ver"**: clic o Enter navegan. No se agrega ningún botón suelto además de eso; si
más adelante se quiere uno visible, va afuera de la lista, y es una decisión aparte.

El home lleva el buscador grande del hero; `/resultados/` lleva uno compacto arriba.

### El "Ver" de una fila hija

`showFeature` pasa a devolver las propiedades del feature, igual que ya hace `showObject`.
`pages/resultados.js` reemplaza la ficha con la de esa fila:

- **Los campos salen de `specOf(key)`** (`src/columns.js`), la misma spec que arma la tabla. Una
  sola fuente para "qué campos tiene esta capa y cómo se rotulan": ficha y tabla no pueden
  divergir. En fracciones y radios eso significa número y código, sin nombre: **NAV-R4** sigue
  en pie y no se inventa rótulo.
- **El botón pasa a ser el de esa fila**: `featureUrl(key, code)`. En vías baja la calle entera,
  no el tramo (**DES-R9**).
- **"Volver a &lt;objeto&gt;"** restaura la ficha del padre y redibuja su geometría.

Por qué esto no reproduce el bug que motivó el comentario de `src/map.js:120`: aquello
concatenaba texto libre sobre `#detail-meta` en cada clic, sin límite. Acá el panel se
**reemplaza** y se construye desde la spec, así que no hay nada que se acumule.

### La carrera ya está resuelta y se reusa

`drawFromUrl` devuelve `undefined` cuando el pedido perdió (`request !== pending`). Regla: **la
ficha se actualiza sólo si volvieron propiedades.** Un "Ver" de vías de 12 s que quedó atrás no
puede pisar la ficha de lo que el usuario está mirando ahora, por el mismo mecanismo que ya
protege el mapa. Sin código nuevo de sincronización.

### La tabla

La fila vista queda marcada con `aria-selected`, como hoy. Al paginar o cambiar de pestaña la
marca se pierde, pero ficha y mapa siguen mostrando la fila pedida: los dos siguen de acuerdo
entre sí, que es lo que promete el invariante.

NAV-R1, R2, R3, R5, R7 y R8 no se tocan.

### Mapa

`map.attributionControl.setPrefix(false)` saca el enlace a Leaflet y la bandera de Ucrania, que
viajan juntos dentro de `options.prefix` (`leaflet-src.js:5762`). La atribución del IGN vive en
el `tileLayer` y queda intacta: "Instituto Geográfico Nacional, OpenStreetMap".

Es legal: Leaflet es BSD-2-Clause y no exige crédito en la interfaz, sólo el aviso de copyright
en el código, que sigue en `node_modules`.

El mock de Leaflet de los tests (hoy en `src/main.test.js:9`) necesita `attributionControl` con
`setPrefix`, o el test se cae.

## 4. Las ocho notas

`src/notes.js` deja de estar indexado por capa hija y pasa a estarlo **por objeto**, con ancla
propia. Dos mapas chicos cruzan los vocabularios que ya existen:

- `NOTA_POR_TIPO`: `jur|dep|loc|gl|aglo` (claves de `TYPES`) → slug de nota.
- `NOTA_POR_CAPA`: `departamentos|fracciones|radios|localidades|vias` (claves de `CHILD_LAYERS`)
  → slug de nota.

Un test exige que **toda** clave de los dos mapas apunte a una nota que existe.

| Slug / ancla | Objeto | Datos verificados que la nota afirma |
|---|---|---|
| `jurisdiccion` | Jurisdicción | 24: 23 provincias y CABA. Capa `geonode:jurisdicciones`, campo `cpr`. Contiene departamentos, fracciones, radios, localidades y vías. |
| `departamento` | Departamento | 529. En CABA son 15 comunas; en Buenos Aires, 135 partidos. Campo `cde`. Los códigos no cierran entre capas: 529 en departamentos, 530 en radios, 527 en vías (DES-R8). |
| `fraccion-censal` | Fracción censal | 6.571. Sin nombre publicado (NAV-R4). Se descarga por `cod_indec`. |
| `radio-censal` | Radio censal | 66.515. Sin nombre publicado. La unidad más chica del Marco. Se descarga por `cod_indec`. |
| `localidad-censal` | Localidad censal | 4.023. Su única capa hija es vías, y 4.015 de las 4.023 la tienen con algo adentro. **La nota que ya existe se muda entera.** |
| `gobierno-local` | Gobierno local | 2.282. Ninguno ofrece capas hijas (DES-R7): está fuera de la cadena censal, no tiene `cde`. Campo `cmu`. |
| `aglomerado` | Aglomerado | 119. Contiene localidades y vías. 14 cruzan más de una provincia: Gran Buenos Aires abarca Buenos Aires y CABA con 64 localidades y 112.152 vías. |
| `via-de-circulacion` | Vía de circulación | 477.588. **La nota que ya existe se muda entera.** |

Cada nota afirma sólo lo que este repo puede verificar: conteos del catálogo, qué se descarga
según `download.js`, y los costos medidos de NAV-R7. La parte editorial —"con qué se
confunde"— no se puede verificar contra ninguna fuente del repo, así que **la tarea que escribe
las seis notas nuevas termina listando en su reporte, oración por oración, qué afirmó sin
respaldo**, para que el dueño lo revise antes de publicar. Las dos notas que se mudan ya
están verificadas y no entran en esa lista.

### Esto deroga NAV-R6

La fila de notas de `/resultados/` desaparece. En su lugar:

- La ficha lleva "Qué es un departamento →" al lado del tipo del objeto.
- Cada pestaña de capa hija lleva su "Qué es un radio censal →".

Ambos apuntan a `/notas/#<slug>`. Contextual, sin texto duplicado en dos superficies.

NAV-R9 pierde su mitad "ni se anota" —que ya no significa nada— y conserva la de "no se
recorre".

### La página

Navegador vertical con los ocho objetos a la izquierda y la nota a la derecha. El ancla de la
URL selecciona: `/notas/#localidad-censal` abre directo esa nota.

## 5. Servicios geoespaciales del INDEC

Todo verificado el 2026-09-08 contra el servidor. Nada de memoria.

**WFS 2.0.0** — `https://geonode.indec.gob.ar/geoserver/ows`. CORS abierto (de eso depende este
sitio). 10 capas vectoriales:

`aglomerados`, `departamentos`, `fracciones_censales`, `gobiernos_locales4`,
`gobiernos_locales_puntos`, `jurisdicciones`, `localidades_censales`,
`localidades_censales_puntos1`, `radios_censales2`, `vias_de_circulacion` — todas bajo el
prefijo `geonode:`. Este sitio usa 8; las dos versiones "puntos" no.

Formatos de salida: `geopackage` (y sus alias `gpkg`, `geopkg`, `application/x-gpkg`),
`application/json` (GeoJSON), `SHAPE-ZIP`, `csv`, `excel`, `excel2007`, KML, GML 2 / 3.1.1 / 3.2.

**WMS 1.3.0** — mismo endpoint. Las mismas 10 capas. `image/png` entre los formatos de `GetMap`,
más salidas que no son imagen (`application/pdf`, KML/KMZ, GeoJSON, TopoJSON,
`application/vnd.mapbox-vector-tile`). CRS soportados: EPSG:4326, EPSG:3857, CRS:84 y otros.

**GeoNode** — `https://geonode.indec.gob.ar/`, el Geoportal INDEC. 47 capas publicadas (contra
las 8 que usa este sitio), más mapas, documentos y metadatos. OpenSearch en
`/catalogue/opensearch`.

**Dos recetas cortas**: conectar el WFS en QGIS, y pedir una capa desde código con `CQL_FILTER`.

Los números que no se puedan verificar contra el servidor no entran a esta página.

## 6. Footer y CTA

### Footer institucional

Verificado el 2026-09-08 contra `indec.gob.ar`:

- INDEC — Instituto Nacional de Estadística y Censos de la República Argentina
- Av. Presidente Julio A. Roca 609, P.B. — C1067ABB, Ciudad Autónoma de Buenos Aires, Argentina
- Consultas: (54-11) 5031-4632
- Sitio: `https://www.indec.gob.ar/` · Geoportal: `https://geonode.indec.gob.ar/`
- Material del INDEC bajo Creative Commons BY-SA 4.0, salvo contenidos específicamente
  indicados

Se conservan textuales las dos frases del footer actual: que las descargas van del servidor del
INDEC a la computadora del usuario y que este sitio sólo arma el enlace, y la advertencia de que
estos límites son para integración de información estadística y no son fuente oficial de
delimitación territorial.

La fecha de generación del catálogo sigue mostrándose.

### CTA al Geoportal

En las cuatro páginas, chico: **"Más info, más mapas, más capas en Geoportal INDEC"** →
`https://geonode.indec.gob.ar/`, con `target="_blank" rel="noopener"`.

El destino está verificado: `geoportal.indec.gob.ar` **no existe** (sin registro DNS). El
Geoportal INDEC es el GeoNode, cuya portada dice literalmente "Geoportal INDEC". El texto es
cierto: 47 capas allá contra las 8 de acá.

## 7. El home

- **Hero** con el objetivo del sitio: "La cartografía del INDEC más fácil de descargar y usarla
  en tus proyectos".
- **Buscador** grande, con el filtro de tipo (BUS-R1). Elegir navega a `/resultados/`.
- **Totales con iconos**, ocho tiles desde `totales.json`. Iconos SVG inline: el repo no tiene
  dependencias de front más allá de Leaflet y no se le agregan.
- **CTA** al Geoportal y footer, del shell.

Los iconos son SVG inline en el HTML, no una fuente ni un paquete.

## 8. Reglas de producto

Este repo mantiene `docs/reglas/` a mano: no tiene generador ni gate. El índice del README se
actualiza a mano en el mismo commit.

### Documentos nuevos

**`docs/reglas/sitio.md`** — prefijo `SITIO-R`:

| ID | Decisión |
|---|---|
| SITIO-R1 | El sitio son cuatro páginas con URL propia |
| SITIO-R2 | El permalink es el estado: elegir un objeto navega, y no hay estado fuera de la URL |
| SITIO-R3 | `capa=vias` en el permalink abre el panel de costo sin pedir nada (cita NAV-R7) |
| SITIO-R4 | Parámetros inválidos muestran el buscador, nunca una ficha rota |
| SITIO-R5 | Cada página lleva el CTA al Geoportal INDEC |
| SITIO-R6 | El header, el CTA y el footer se inyectan en build y existen en el HTML servido |
| SITIO-R7 | Los totales del home salen del build y no pueden envejecer sin que un test lo diga |
| SITIO-R8 | El mapa no acredita a Leaflet; sí al IGN |

**`docs/reglas/notas.md`** — prefijo `NOTA-R`:

| ID | Decisión |
|---|---|
| NOTA-R1 | Hay una nota por objeto del Marco, ocho, cada una con ancla propia |
| NOTA-R2 | Una nota afirma sólo lo verificable contra el catálogo o el GeoServer |
| NOTA-R3 | Las notas viven en `/notas/`; la ficha enlaza, no repite |

### Cambios en `docs/reglas/navegacion.md`

- **NAV-R6 muere**, tachada, nombrando a NOTA-R3 como su reemplazo.
- **NAV-R9** pierde "ni se anota"; conserva "no se recorre".
- **NAV-R10 nace**: la ficha describe lo que el mapa está dibujando. El "Ver" de una fila hija
  actualiza el panel de identidad, sus campos salen de `specOf` y su botón baja esa fila
  (DES-R9). Una respuesta que perdió la carrera no escribe la ficha.

Todas las reglas nuevas nacen sin construir y se marcan implementadas recién cuando su test
existe y se verificó que muere al romper el comportamiento a mano.

## 9. Testing

Un `.test.js` por módulo, como ya hace el repo. Vitest, jsdom donde hace falta.

| Archivo | Qué sostiene |
|---|---|
| `scripts/shell.test.mjs` | `injectShell` reemplaza, y **tira** ante un marcador sin partial. Las 4 páginas traen sus marcadores. |
| `src/permalink.test.js` | Parseo, formato, ida y vuelta. Cada fila de la tabla de validación de §2. |
| `src/totales.test.js` | `totales.json` coincide con la suma de `catalog.json`, tipo por tipo y capa por capa. |
| `src/notes.test.js` | Ocho notas con anclas únicas. Toda clave de `TYPES` y de `CHILD_LAYERS` mapea a una nota existente. Las dos notas mudadas conservan su texto. |
| `src/map.test.js` | `setPrefix(false)` se llama. La atribución del IGN sigue en el `tileLayer`. |
| `src/pages/resultados.test.js` | Cableado leyendo `resultados/index.html` real, como hoy `main.test.js`. Incluye: "Ver" actualiza la ficha; una respuesta que perdió la carrera no la actualiza; "Volver a" restaura al padre. |
| `src/pages/home.test.js` | Los totales se pintan; elegir en el buscador navega al permalink correcto. |
| `src/pages/notas.test.js` | El ancla de la URL selecciona la nota. |
| `src/pages/servicios.test.js` | Cableado; los enlaces apuntan a los endpoints declarados. |

`src/main.test.js` se disuelve en `src/pages/resultados.test.js`. Los tests que hoy cubren
comportamiento vigente se conservan, no se reescriben.

## 10. Fuera de alcance

- Selector de formato o proyección: DES-R4 sigue valiendo, GPKG en EPSG:4326.
- Guardar en el permalink la página del paginado o la fila vista: se evaluó y se descartó porque
  el orden del GeoServer no está garantizado entre pedidos.
- `pushState` dentro de `/resultados/`: el reload al cambiar de objeto es el costo aceptado.
- Consumir las dos capas "puntos" del WFS que el sitio no usa.
- Levantar generador y gate de reglas: es trabajo con ficha propia, no un paso al pasar.
