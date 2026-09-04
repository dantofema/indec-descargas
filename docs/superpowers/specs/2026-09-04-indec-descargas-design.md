# indec-descargas — diseño

**Fecha:** 2026-09-04
**Estado:** aprobado, pendiente de plan de implementación

## Problema

Bajar geometrías del Marco Geoestadístico Nacional del INDEC hoy exige conocer WFS, CQL y
códigos de departamento. El usuario que quiere "los radios censales de Tres de Febrero" no
tiene por dónde empezar.

El MVP resuelve un solo recorrido: **escribo un nombre, veo el objeto en un mapa, descargo
ese objeto o sus hijos en GPKG.**

## Origen de datos

GeoServer público del INDEC (GeoNode 3), workspace `geonode`:

```
https://geonode.indec.gob.ar/geoserver/ows
```

Dos propiedades verificadas el 2026-09-04 que sostienen toda la arquitectura:

1. **CORS abierto.** Responde `Access-Control-Allow-Origin: *`. El browser puede consultarlo
   directamente, sin proxy.
2. **GPKG nativo.** `outputFormat=geopackage` devuelve `application/x-gpkg` (SQLite/GPKG
   válido). No hace falta convertir nada del lado nuestro.

De ahí se sigue la decisión central: **no hay backend.** El sitio es estático y la descarga es
un enlace directo al GeoServer.

### Capas

| Capa | Features | Rol |
|---|---|---|
| `geonode:jurisdicciones` | 24 | buscable, padre |
| `geonode:departamentos` | 529 | buscable, padre |
| `geonode:localidades_censales` | 4.023 | buscable, hijo |
| `geonode:gobiernos_locales4` | 2.282 | buscable, sin hijos |
| `geonode:aglomerados` | 119 | buscable, padre |
| `geonode:fracciones_censales` | 6.571 | hijo |
| `geonode:radios_censales2` | 66.515 | hijo |
| `geonode:vias_de_circulacion` | 477.588 | hijo |

Quedan fuera del MVP `gobiernos_locales_puntos` y `localidades_censales_puntos1`: duplican a
sus capas de polígono y, pese al nombre, están publicadas como `MultiSurface`, no como punto.

### Jerarquía

Cada capa hija lleva la columna del padre por el que se la filtra. Lo que cada objeto
buscable ofrece está determinado por qué columnas existen, no por lo que sería lindo ofrecer:

| Objeto buscable | Filtra por | Hijos que ofrece |
|---|---|---|
| jurisdicción | `cpr` | departamentos, fracciones, radios, localidades, vías |
| departamento | `cde` | fracciones, radios, localidades, vías |
| aglomerado | `codaglo` | localidades, vías |
| localidad | `clc` | vías |
| gobierno local | `cmu` | ninguno |

`radios_censales2` y `fracciones_censales` llevan `cpr` y `cde`, pero **no** llevan `clc`,
`cmu` ni `codaglo`. Por eso ni la localidad ni el aglomerado ni el gobierno local pueden
ofrecer radios: la relación no existe en el dato.

Dos casos merecen justificación explícita, porque los dos terminan con vías como único hijo
posible y sin embargo se resuelven distinto:

- **El gobierno local no ofrece hijos.** `gobiernos_locales4` no tiene `cde`: está fuera de la
  cadena censal por completo. Quien busca un municipio y ve una sola capa suelta no entiende
  por qué faltan los radios. Se descarga a sí mismo y nada más.
- **La localidad sí ofrece vías.** Está dentro de la cadena (tiene `cde` y `clc`), y "las
  calles de esta localidad" es una respuesta coherente y útil por sí sola, no un resto de algo
  que falta.

`cde` es el código de 5 caracteres que ya incluye la provincia (`06840` = Tres de Febrero,
Buenos Aires). Un departamento se filtra con `cde='06840'`, no con `cpr='06' AND cde='840'`.

`cde` es el código de 5 caracteres que ya incluye la provincia (`06840` = Tres de Febrero,
Buenos Aires). Un departamento se filtra con `cde='06840'`, no con `cpr='06' AND cde='840'`.

## Arquitectura: dos tiempos

### El problema que resuelve

Consultar conteos en vivo es inviable. Medido el 2026-09-04:

| Consulta | Tiempo |
|---|---|
| `hits` de fracciones de un departamento | 0,35 s |
| `hits` de radios de un departamento | 5,0 s |
| `hits` de vías de un departamento | 31,2 s |
| `hits` de vías de una provincia | timeout (>120 s) |

`vias_de_circulacion` son 477k filas sin índice usable por `cde`. Precalcular los conteos
para los 529 departamentos, uno por uno, llevaría más de cuatro horas.

Pero el filtro es lo lento, no el escaneo. Un volcado completo de la columna clave, en CSV y
sin filtro, es un solo request:

| Volcado | Filas | Tamaño | Tiempo |
|---|---|---|---|
| `fracciones_censales` (`cde`) | 6.571 | 235 KB | 4,1 s |
| `radios_censales2` (`cde,cfn`) | 66.515 | 2,5 MB | 19,9 s |
| `vias_de_circulacion` (`cde,cmu,clc,codaglo`) | 477.588 | 26 MB | 53,8 s |

El build completo queda por debajo de dos minutos.

### Build (offline, Node)

`scripts/build-index.mjs`:

1. Vuelca en CSV las columnas clave de cada capa (un request por capa, sin filtro).
2. Vuelca nombres y códigos de las cinco capas buscables.
3. Agrega los conteos de hijos en memoria.
4. Normaliza los nombres para búsqueda (minúsculas, sin acentos).
5. Escribe `public/catalog.json`.
6. Reporta inconsistencias en stderr y **falla** si superan un umbral.

Corre a mano. No hay Action programada en el MVP: el MGN cambia entre censos, no entre
semanas.

#### Inconsistencias conocidas

Los códigos de departamento no cierran entre capas: **529** en `departamentos`, **530** en
radios, **527** en vías. El build las reporta como advertencia con el detalle de qué códigos
sobran o faltan. No las corrige ni las oculta — un código huérfano es un dato del INDEC, no
un bug nuestro, y silenciarlo haría que el catálogo mienta.

### Runtime (browser)

Carga `catalog.json` una vez. Autocompletado, jerarquía y decisión del tope se resuelven en
memoria, sin red. El GeoServer se toca sólo para dos cosas: pintar el objeto seleccionado y
descargar.

## `catalog.json`

```json
{
  "generated": "2026-09-04",
  "maxFeatures": 5000,
  "objects": [
    {
      "t": "dep",
      "c": "06840",
      "n": "Tres de Febrero",
      "s": "tres de febrero",
      "p": "Buenos Aires",
      "ch": { "fracciones": 42, "radios": 432, "localidades": 1, "vias": 1487 }
    }
  ]
}
```

- `t` — tipo (`jur`, `dep`, `loc`, `gl`, `aglo`)
- `c` — código en su capa (`cpr`, `cde`, `clc`, `cmu` o `codaglo` según el tipo)
- `n` — nombre para mostrar
- `s` — clave de búsqueda normalizada, calculada en build
- `p` — provincia, para desambiguar homónimos en la lista
- `ch` — conteo por capa hija; ausente en `gl`, que no tiene hijos

Las claves de `ch` son las de la tabla de jerarquía: un `jur` trae cinco, un `dep` cuatro, un
`aglo` dos y un `loc` una sola. El runtime lista lo que venga en `ch`, sin saber de antemano
qué le corresponde a cada tipo.

Unos 6.900 objetos. Estimado: ~800 KB crudo, ~200 KB con gzip. Una sola carga.

## Componentes

Cada uno con una responsabilidad y testeable por separado.

| Archivo | Qué hace | De qué depende |
|---|---|---|
| `src/catalog.js` | carga `catalog.json`, expone búsqueda y lookup por código | nada |
| `src/search.js` | normaliza texto y hace match por substring | nada |
| `src/download.js` | arma URLs WFS (GeoJSON y GPKG) y decide si el tope habilita | nada |
| `src/map.js` | Leaflet: basemap, dibujar objeto, `fitBounds` | Leaflet |
| `src/main.js` | orquesta: input → selección → mapa + ficha + lista de hijos | los cuatro anteriores |

`search.js` y `download.js` son funciones puras: ahí vive toda la lógica que importa y ahí van
los tests.

## Búsqueda

Substring sobre el array de 6.900 objetos, sin librería de fuzzy search. La normalización
(minúsculas, sin acentos) ya viene hecha del build, así que el runtime sólo normaliza la
consulta del usuario.

`"Tres de Febr"` → `"tres de febr"` → match contra `s`.

Resultados ordenados: primero los que empiezan con la consulta, después los que la contienen;
dentro de cada grupo, por tipo (jurisdicción, departamento, localidad, gobierno local,
aglomerado). Tope de 20 resultados visibles.

## Mapa

Leaflet con el basemap del IGN:

```
https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{y}.png
```

Es TMS, que invierte el eje Y respecto de XYZ. Leaflet lo resuelve con `tms: true`; olvidarlo
da un mapa espejado verticalmente.

Al elegir un objeto se pide su GeoJSON (un solo feature, rápido), se dibuja y se hace
`fitBounds`. Los atributos que muestra la ficha salen de ese mismo GeoJSON: cero requests
extra.

## Descarga

Un `<a href>` al GeoServer, sin JS de por medio:

```
https://geonode.indec.gob.ar/geoserver/ows
  ?service=WFS&version=2.0.0&request=GetFeature
  &typenames=geonode:radios_censales2
  &outputFormat=geopackage
  &srsName=EPSG:4326
  &CQL_FILTER=cde='06840'
```

Las capas están publicadas nativas en EPSG:3857 y el GetCapabilities no declara ningún
`OtherCRS`, pero el servidor reproyecta si se le pide explícito (verificado con 4326 y con
22185). Se pide siempre `srsName=EPSG:4326`.

### Tope

Una sola constante: **`maxFeatures = 5000`**. El botón se habilita si el conteo del catálogo
no la supera; si la supera, queda deshabilitado mostrando el número y el motivo.

Calibración con datos reales:

| | departamentos bloqueados | provincias bloqueadas |
|---|---|---|
| radios | 0 / 530 | 3 / 24 (Buenos Aires 23.901, Córdoba 6.720, Santa Fe 5.386) |
| vías | 11 / 527 | 22 / 24 |
| fracciones | 0 / 529 (máx. 99) | 0 / 24 |
| localidades | 0 / 529 (máx. 66) | 0 / 24 |

Todo departamento descarga sus radios. Ninguna provincia grande descarga los suyos. Es
exactamente el comportamiento pedido.

El número vive en el catálogo, no hardcodeado en el JS: cambiar la política es reconstruir el
índice, y el valor queda registrado junto a los conteos con los que se decidió.

### Latencia de la descarga

La descarga de vías es lenta —el conteo de 1.487 vías tardó 31 s y la descarga es peor—. Como
es una navegación del browser, no se puede mostrar progreso real. Antes de disparar una
descarga de vías se muestra un aviso explícito con el conteo y una advertencia de demora. No
hay spinner: un spinner que no mide nada miente.

## Testing

Vitest, sobre lo que tiene lógica real:

- `search.js` — normalización (acentos, mayúsculas, espacios), orden de resultados, tope de 20
- `download.js` — URLs bien formadas y escapadas por tipo de objeto y capa hija; la decisión
  del tope en sus bordes (4.999 / 5.000 / 5.001)
- `catalog.js` — lookup por código, tipos sin hijos

El mapa no se testea unitariamente en un MVP: es integración con Leaflet y el costo no se
paga.

El build tiene su propio test sobre la agregación (dado un CSV fijo, produce los conteos
esperados), sin salir a la red.

## Deploy

GitHub Pages, repo público, vía Action en push a `main`. El build del índice **no** corre en
la Action: `public/catalog.json` se versiona. Así el deploy no depende de que el GeoServer del
INDEC esté arriba, y un cambio en el catálogo queda visible en el diff.

## Fuera del MVP

Van al backlog:

- Gobiernos locales con hijos (requiere resolver la relación `cmu` ↔ `cde`)
- Selección múltiple de objetos
- Descarga de provincias grandes por partes
- Formatos además de GPKG (el GeoServer también ofrece SHAPE-ZIP, GeoJSON, KML, CSV, Excel)
- Regeneración automática del índice
- Las dos capas de puntos

## Decisiones que quedan como regla de producto

`docs/reglas/descargas.md`:

- El tope es un único número global de features, no uno por capa.
- Superar el tope deshabilita el botón mostrando el conteo; no ofrece una descarga parcial.
- La descarga es siempre GPKG en EPSG:4326.
- El catálogo se regenera a mano y se versiona.
