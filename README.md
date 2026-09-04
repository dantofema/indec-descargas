# indec-descargas

Descarga de capas del Marco Geoestadístico Nacional del INDEC en GeoPackage, sin saber WFS.

Escribís el nombre de un departamento, localidad, municipio, aglomerado o provincia; lo ves en
un mapa; y bajás ese objeto o sus hijos (radios, fracciones, localidades, vías) en `.gpkg`.

Sitio estático: no hay backend. Los datos salen del GeoServer público del INDEC
(`https://geonode.indec.gob.ar/geoserver`), que expone CORS abierto y emite GPKG nativo.

- Diseño: [`docs/superpowers/specs/2026-09-04-indec-descargas-design.md`](docs/superpowers/specs/2026-09-04-indec-descargas-design.md)

## Estado

En diseño. Todavía no hay código.

## Aviso

Los límites que publica el INDEC en estas capas son para integración de información
estadística. No son fuente oficial de delimitación territorial ni sirven como prueba en
controversias de límites.
