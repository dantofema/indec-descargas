# Descargas

Decisiones de producto sobre qué se puede descargar y con qué límite.

## ✅ Reglas

### DES-R1 — No hay tope superior de features

Ninguna capa hija deshabilita su botón de descarga por **superar** una cantidad de objetos. El
piso es otra historia: el conteo cero sigue deshabilitando el botón, eso lo decide DES-R3, no
esta regla.

La descarga del objeto en sí queda siempre por debajo de cualquier tope pensable —es
exactamente un feature—, así que nunca estuvo en juego: esta regla es sobre las capas hijas.

**Por qué:** medido contra el GeoServer del INDEC el 2026-09-06, no estimado. El peor caso del
catálogo son las 179.029 vías de Buenos Aires: 74 MB en 37 s, HTTP 200. Los 23.901 radios de
Buenos Aires bajan 22 MB en 6,9 s, y el `.gpkg` resultante se abrió y tiene las 23.901 filas en
EPSG:4326: el servidor no trunca. El propio `CountDefault` del GeoServer es 1.000.000 de
features, muy por encima de cualquier pedido del catálogo. Un tope propio sólo estaba
prohibiendo descargas que el servidor entrega sin problema.

### DES-R2 — Superar el peso estimado avisa, no deshabilita

Si el peso estimado de la descarga supera los 10 MB, aparece un aviso de peso y de espera al
lado del botón. El botón sigue habilitado: la descarga se pide igual.

El peso se estima con 973 bytes por feature en capas de polígonos y 420 en vías.

**Por qué:** una descarga parcial silenciosa produce un archivo que el usuario cree completo.
Es peor que no descargar. Eso no cambió: lo que cambió es quién lo garantiza. Antes lo evitaba
deshabilitar contra un tope propio; ahora lo garantiza el servidor mismo — el `CountDefault` de
1.000.000 de features del GeoServer está muy por encima del peor caso medido (DES-R1), así que
"todo" ya significa todo sin que haga falta impedir nada. Sólo queda avisar que puede pesar y
tardar.

### DES-R3 — Conteo cero también deshabilita

Un hijo con 0 objetos muestra el botón deshabilitado y dice que no hay nada de esa capa.

**Por qué:** un `.gpkg` vacío parece un error del usuario, no un dato.

### DES-R4 — La descarga es siempre GPKG en EPSG:4326

No hay selector de formato ni de proyección en el MVP.

**Por qué:** el GeoServer del INDEC publica las capas en EPSG:3857 pero reproyecta a pedido.
4326 es lo que espera la mayoría de las herramientas y GPKG es un archivo único, sin el
problema de los `.shp` en varios archivos ni su límite de 10 caracteres por nombre de campo.

### ~~DES-R5 — El tope vive en el catálogo, no en el código~~

**Muerta:** murió junto con el tope de features. DES-R1 y DES-R2 dejaron de depender de un
número, así que no hay política que guardar en el catálogo.

El campo `maxFeatures` ya no existe en ninguna parte: el build dejó de generarlo y el catálogo
dejó de tenerlo el 2026-09-06 (commit `916c39c`), junto con la constante `MAX_FEATURES` y su
rastro en las fixtures de test. `catalog.json` tiene hoy exactamente dos claves, `generated` y
`objects`.

La única mención que queda en el repo es un comentario de `scripts/lib/dump.mjs`, y no habla de
este campo: habla del corte que puede aplicar el GeoServer del lado del servidor, que es un
riesgo del protocolo WFS y sigue vigente.

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

### DES-R9 — La descarga de un hijo suelto filtra por el campo identificador de su capa

Cada capa hija tiene un campo que identifica una fila para armar su URL de descarga: `cde` en
departamentos, `clc` en localidades, `cod_indec` en fracciones, radios y vías. En vías,
`cod_indec` identifica la calle, no el tramo, así que descargar cualquier fila de una calle baja
la calle entera.

**Por qué:** `cod_indec` es el único campo que separa una calle de otra en lo que el INDEC
publica; no hay un identificador de tramo que sirva como filtro WFS, sólo un `id` interno que no
distingue nada útil por sí solo. Tres de Febrero muestra el tamaño de la diferencia: sus 1.487
vías son 727 calles, y una se parte en 80 tramos idénticos en los 21 campos publicados,
distinguibles sólo por ese `id`. Prometer "bajar este tramo" sería prometer algo que el filtro
no puede cumplir.

### DES-R10 — Se ofrece la cadena de padres completa, sólo si existen en el catálogo

La ficha de un objeto también ofrece sus padres: departamento → jurisdicción; localidad →
departamento, jurisdicción y aglomerado; gobierno local → jurisdicción. Aglomerado y
jurisdicción no tienen padre. Cada padre derivado se busca en el catálogo antes de ofrecerlo
(DES-R8); el que no aparece ahí, no se muestra.

**Por qué:** las inconsistencias del INDEC (DES-R8) hacen que un código de padre derivado no
siempre resuelva a un objeto real. Ofrecer un enlace a un padre que no está en el catálogo sería
un link roto, y el catálogo es la única fuente contra la que se puede verificar antes de
mostrarlo.
