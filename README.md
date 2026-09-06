# indec-descargas

Descarga de capas del Marco Geoestadístico Nacional del INDEC en GeoPackage, sin saber WFS.

Escribís el nombre de un departamento, localidad, municipio, aglomerado o provincia; lo ves en
un mapa; y bajás ese objeto o sus hijos (radios, fracciones, localidades, vías) en `.gpkg`.

Sitio estático: no hay backend. Los datos salen del GeoServer público del INDEC
(`https://geonode.indec.gob.ar/geoserver`), que expone CORS abierto y emite GPKG nativo.

- Diseño: [`docs/superpowers/specs/2026-09-04-indec-descargas-design.md`](docs/superpowers/specs/2026-09-04-indec-descargas-design.md)

## Estado

Funcionando. El sitio busca sobre un catálogo de 6.977 objetos (24 jurisdicciones, 529
departamentos, 4.023 localidades censales, 2.282 gobiernos locales y 119 aglomerados),
dibuja el objeto elegido sobre el basemap del IGN y arma los enlaces de descarga en GPKG,
tanto del objeto en sí como de sus capas hijas y de sus padres. No hay tope de features: toda
descarga se ofrece habilitada, y superar los 10 MB estimados sólo agrega un aviso de peso y de
espera al lado del botón. Las reglas están en
[`docs/reglas/descargas.md`](docs/reglas/descargas.md).

Cada capa hija también se puede recorrer de a una fila, paginada contra el GeoServer del INDEC.
Vías es la excepción: no carga sola al abrir su pestaña, porque es una tabla de 477.588 filas
sin índice útil y cualquier pedido contra ella tarda entre varios segundos y casi dos minutos;
muestra el costo medido y un botón para cargar igual, y lista por tramo, no por calle. Las
reglas están en [`docs/reglas/navegacion.md`](docs/reglas/navegacion.md).

La búsqueda se puede acotar a un tipo de objeto, acepta las palabras del nombre sueltas y en
cualquier orden, y toma la provincia como término extra para desambiguar homónimos: `caseros
entre rios` separa los dos Caseros del país. Las reglas están en
[`docs/reglas/buscador.md`](docs/reglas/buscador.md).

## Cómo correrlo

```sh
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción en dist/
npm test         # suite completa (Vitest)
```

## Cómo regenerar el catálogo

```sh
npm run build:index             # usa la caché de scripts/.cache/
npm run build:index -- --no-cache   # vuelve a bajar todo del GeoServer
```

Con caché tarda un par de segundos. Con `--no-cache`, entre uno y tres minutos: el
volcado de vías son 477.588 filas y unos 27 MB.
El script reporta en stderr las inconsistencias de los datos del INDEC (códigos hijos sin
padre) y aborta si algún volcado llega truncado o si salen menos objetos de los esperados.

`public/catalog.json` se commitea a propósito: así el deploy no depende de que el GeoServer
del INDEC esté arriba, y cualquier cambio en los datos queda visible en el diff.

## Aviso

Los límites que publica el INDEC en estas capas son para integración de información
estadística. No son fuente oficial de delimitación territorial ni sirven como prueba en
controversias de límites.
