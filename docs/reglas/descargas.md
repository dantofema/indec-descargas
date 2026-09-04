# Descargas

Decisiones de producto sobre qué se puede descargar y con qué límite.

## ✅ Reglas

### DES-R1 — El tope es un único número global de features

`maxFeatures` vale 5000 y se aplica igual a toda capa. No hay topes por capa.

La descarga del objeto en sí queda siempre por debajo del tope —es exactamente un feature—,
así que no se la chequea contra él: el tope decide sólo sobre las capas hijas.

**Por qué:** un solo número es explicable al usuario en una frase y calibra bien con los datos
reales: ningún departamento supera 5000 radios (máximo 2069), y las tres provincias grandes
quedan afuera, que es exactamente el comportamiento pedido.

### DES-R2 — Superar el tope deshabilita, no recorta

Si el conteo supera `maxFeatures` el botón queda deshabilitado mostrando el conteo real y el
máximo. No se ofrece una descarga parcial ni paginada.

**Por qué:** una descarga parcial silenciosa produce un archivo que el usuario cree completo.
Es peor que no descargar.

### DES-R3 — Conteo cero también deshabilita

Un hijo con 0 objetos muestra el botón deshabilitado y dice que no hay nada de esa capa.

**Por qué:** un `.gpkg` vacío parece un error del usuario, no un dato.

### DES-R4 — La descarga es siempre GPKG en EPSG:4326

No hay selector de formato ni de proyección en el MVP.

**Por qué:** el GeoServer del INDEC publica las capas en EPSG:3857 pero reproyecta a pedido.
4326 es lo que espera la mayoría de las herramientas y GPKG es un archivo único, sin el
problema de los `.shp` en varios archivos ni su límite de 10 caracteres por nombre de campo.

### DES-R5 — El tope vive en el catálogo, no en el código

`maxFeatures` se lee de `catalog.json`.

**Por qué:** cambiar la política es regenerar el índice, y el valor queda registrado junto a
los conteos con los que se decidió.

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
