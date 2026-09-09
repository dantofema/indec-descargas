# indec-descargas

Descarga de capas del Marco Geoestadístico Nacional del INDEC en GeoPackage, sin saber WFS.

Escribís el nombre de un departamento, localidad, municipio, aglomerado o provincia; lo ves en
un mapa; y bajás ese objeto o sus hijos (radios, fracciones, localidades, vías) en `.gpkg`.

Sitio estático: no hay backend. Los datos salen del GeoServer público del INDEC
(`https://geonode.indec.gob.ar/geoserver`), que expone CORS abierto y emite GPKG nativo.

- Diseño: [`docs/superpowers/specs/2026-09-04-indec-descargas-design.md`](docs/superpowers/specs/2026-09-04-indec-descargas-design.md)
- Diseño del sitio multipágina: [`docs/superpowers/specs/2026-09-08-sitio-multipagina-design.md`](docs/superpowers/specs/2026-09-08-sitio-multipagina-design.md)

## Estado

Funcionando: cuatro páginas con URL propia —home, resultados, notas y servicios geoespaciales
del INDEC— servidas por un único build. El sitio no es oficial ni representa al INDEC, y lo dice
en la primera frase del pie de las cuatro páginas. Elegir un objeto navega a su enlace permanente
en `/resultados/?t=<tipo>&c=<código>`, que es la única fuente de verdad del estado: no hay nada
para restaurar que la URL no diga, y compartir ese enlace reproduce exactamente lo que se estaba
viendo. Los ocho objetos del Marco Geoestadístico tienen ficha y enlace propios —también
fracción censal, radio censal y vía de circulación, que no están en el catálogo y se llega a
ellos por código, no por nombre—. El home muestra los totales del catálogo al instante, sin
bajarlo, y las cuatro páginas llevan el CTA al Geoportal INDEC, inyectado en build. Las reglas
están en [`docs/reglas/sitio.md`](docs/reglas/sitio.md).

El sitio busca sobre un catálogo de 6.977 objetos (24 jurisdicciones, 529
departamentos, 4.023 localidades censales, 2.282 gobiernos locales y 119 aglomerados),
dibuja el objeto elegido sobre el basemap del IGN y arma los enlaces de descarga en GPKG,
tanto del objeto en sí como de sus capas hijas y de sus padres. No hay tope superior de
features: ninguna capa hija se deshabilita por tener muchos objetos, sólo por tener cero, y
superar los 10 MB estimados agrega un aviso de peso y de espera al lado del botón, que sigue
habilitado. Las reglas están en [`docs/reglas/descargas.md`](docs/reglas/descargas.md).

Cada capa hija también se puede recorrer de a una fila, paginada contra el GeoServer del INDEC.
Vías es la excepción: no carga sola al abrir su pestaña, porque es una tabla de 477.588 filas
sin índice útil y cualquier pedido contra ella tarda entre varios segundos y casi dos minutos;
muestra el costo medido y un botón para cargar igual, y lista por tramo, no por calle. Elegir
"Ver" en una fila hija navega a la ficha de esa fila, no la previsualiza dentro de la que ya se
estaba mirando: hay un solo objeto por página, así que la ficha nunca puede contradecir al mapa.
Las reglas están en [`docs/reglas/navegacion.md`](docs/reglas/navegacion.md).

La búsqueda se puede acotar a un tipo de objeto, acepta las palabras del nombre sueltas y en
cualquier orden, y toma la provincia como término extra para desambiguar homónimos: `caseros
entre rios` separa los dos Caseros del país. También se busca por código exacto, para los ocho
tipos: los cinco del catálogo por su código publicado, y fracción, radio y vía —que no tienen
nombre— por el largo del código, sin pedir nada al GeoServer hasta que se elige un resultado.
Las reglas están en [`docs/reglas/buscador.md`](docs/reglas/buscador.md).

Cada uno de los ocho objetos del Marco Geoestadístico tiene su propia nota, en `/notas/`, con
ancla propia. La ficha de un objeto enlaza a la nota de su tipo y a la de cada capa hija que
recorre, en vez de repetir el texto. Las reglas están en
[`docs/reglas/notas.md`](docs/reglas/notas.md).

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

El mismo comando emite además `public/totales.json` (162 bytes medidos), los ocho totales que
pinta el home sin bajar el catálogo entero. También se commitea, y una regla propia
(`docs/reglas/sitio.md`, SITIO-R7) hace que la suite se ponga roja si alguno de los dos archivos
se desincroniza del otro.

## Aviso

Sitio no oficial. No pertenece al INDEC ni lo representa. Publica datos que el INDEC distribuye
abiertamente.

Los límites que publica el INDEC son para uso estadístico: no son los límites oficiales del
territorio ni sirven como prueba en una controversia de límites. Los oficiales los publica el
[IGN](https://www.ign.gob.ar/ut/), y no siempre coinciden con éstos.
