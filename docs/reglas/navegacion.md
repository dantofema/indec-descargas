# Navegación de capas hijas

Decisiones de producto sobre cómo se recorren y se listan los objetos de una capa hija antes
de elegir cuál ver o descargar.

## ✅ Reglas

### NAV-R1 — Las capas hijas se recorren paginadas contra el GeoServer, 20 por página, sin geometría

**Por qué:** el catálogo tiene conteos, no objetos. Una página pesa 3,1 KB y cuesta lo mismo en
un partido que en una provincia, así que paginar no perjudica a las capas grandes.

### NAV-R2 — Una pestaña carga su primera página al abrirse, salvo vías

Abrir la ficha dispara la primera página de cada capa hija apenas se abre su pestaña. Vías es
la excepción a esta regla: no auto-carga (NAV-R7).

**Por qué:** abrir una ficha no tiene por qué disparar cuatro pedidos al GeoServer, pero
tampoco tiene por qué obligar a un clic extra en las capas que responden rápido. La única razón
para no cargar sola es que cargar sola salga cara, y eso sólo es cierto en vías.

### NAV-R3 — Vías se lista por tramo, con los 21 campos publicados, sin agrupar

Cada fila es un tramo, no una calle: el campo que identifica la calle (`cod_indec`, DES-R9) se
repite en varias filas y la tabla no las agrupa. Tres de Febrero muestra la escala: sus 1.487
vías son 727 calles, y una se parte en 80 tramos idénticos en los 21 campos publicados,
distinguibles sólo por un `id` interno.

**Por qué:** agrupar exige bajar todas las filas del objeto para calcularlo del lado del
cliente —3,9 MB en una provincia— y WFS no agrupa en el servidor. Y lo que se ve tiene que ser
lo que baja: la consecuencia de listar por tramo al momento de descargar está en DES-R9.

### NAV-R4 — Fracciones y radios se listan sin nombre

Sólo número y código; no hay columna de nombre.

**Por qué:** el Marco Geoestadístico no publica un nombre para fracción ni para radio.
Inventar un rótulo sería inventar un dato que el INDEC no dio.

### NAV-R5 — La respuesta de una pestaña abandonada se descarta

Si el usuario cambia de pestaña antes de que responda el pedido en curso, esa respuesta no se
pinta.

**Por qué:** es la carrera más fácil de provocar acá —abrir vías, arrepentirse, abrir radios— y
el síntoma es la tabla equivocada bajo la pestaña correcta.

Descartar la respuesta es lo que esta regla decide; que además se aborte el pedido lo decide
NAV-R8, y por otro motivo (la conexión, no la pintura).

### NAV-R6 — La fila de notas aparece sólo si el objeto tiene alguna nota

Sin notas para ninguna de sus capas hijas, la fila no se renderiza.

**Por qué:** una sección vacía enseña a ignorarla. Medido contra el catálogo: de los 6.977
objetos, 4.695 tienen alguna capa con nota y 2.282 no tienen ninguna. Los 2.282 son todos
gobiernos locales, coherente con DES-R7 (el gobierno local no ofrece capas hijas). Sin
ocultarla, la fila de notas aparecería vacía en un tercio de las fichas del sitio.

### NAV-R7 — Vías no auto-carga: muestra el costo medido y un botón para cargar igual

Al abrir la pestaña de vías no se dispara ningún pedido. En su lugar se muestra el costo medido
y un botón para cargar de todos modos. El "Ver" de una fila de vías también avisa la espera
mientras trae el feature completo.

**Por qué:** vías es lenta para todo, no sólo para descargar, y esto no lo sabía el diseño
original. Medido el 2026-09-06 contra el GeoServer del INDEC: una página de 20 filas sin
geometría tarda 14–20 s filtrando por departamento, 17–18 s filtrando por localidad censal
(`clc=06840010` dio 18,0 s y `clc=82084010`, 17,2 s) y 88–99 s filtrando por provincia; traer un
solo feature con geometría —lo que hace "Ver"— tarda 12,4 s. Los mismos pedidos sobre radios
tardan 0,65 s y 0,89 s. No es el payload (10 KB) ni el orden: es una tabla de 477.588 filas sin
índice útil para los campos por los que se filtra. Auto-cargar esa pestaña, o dejar que "Ver"
trabaje en silencio, cuelga la interfaz sin avisar; borrar la pestaña porque es lenta sería
peor, porque el usuario la pidió por nombre. Avisar y dejar elegir es lo único que no le miente
a nadie.

El caso de la localidad censal no es marginal: es el 58% de las fichas donde el aviso aparece
—4.023 de los 6.977 objetos del catálogo son localidades con vías como única capa hija—, así que
el aviso lo nombra en vez de dejar al usuario deducirlo del rango del departamento.

### NAV-R8 — Un pedido que no vuelve se corta solo, y el abandonado se aborta

Una página de hijos que no llega dentro del plazo de su capa —180 segundos en vías, 30 en el
resto— se da por muerta: en el lugar de la tabla aparece el error con el botón de reintentar, el
mismo que ya se muestra cuando el GeoServer contesta mal. Y todo pedido que se abandona —cambiar
de pestaña, pasar de página, elegir otro objeto— se aborta, no sólo se descarta (NAV-R5).

**Por qué:** un `fetch` sin corte no falla nunca. Si el GeoServer acepta la conexión y se queda
callado, la fila 3 queda en «Cargando…» para siempre, porque el error con Reintentar sólo aparece
cuando el pedido falla. Y no siempre hay a dónde escapar: 4.023 de los 6.977 objetos del catálogo
—el 58%— son localidades censales con una sola capa hija, así que no hay otra pestaña a la que
cambiar, y volver a clickear la que ya está activa no vuelve a pedir nada.

Los plazos dejan headroom sobre el peor caso legítimo medido el 2026-09-06, para que una espera
larga no se convierta en un error: una página de vías tarda 88–99 s filtrando por provincia, 17–18
por localidad y 14–20 por departamento (NAV-R7), así que 180 s deja casi el doble del peor caso;
el resto de las capas tarda 0,65–0,89 s, así que 30 s deja treinta veces. El plazo es por capa y
no por tipo de padre: afinarlo por padre sería una tabla de dos dimensiones para elegir un corte,
y el precio de no hacerlo es que una localidad espera hasta 3 minutos antes de ver el error, no
que no lo vea.

Abortar, además de descartar, es por la conexión y no por la pintura: un pedido abandonado sigue
ocupando una de las ~6 que el browser permite por origen, y el mapa pide al mismo origen. Con unos
pocos pedidos de vías colgados, la fila 1 deja de dibujar por culpa de la fila 3.
