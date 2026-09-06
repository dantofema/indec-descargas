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

### NAV-R6 — La fila de notas aparece sólo si el objeto tiene alguna nota

Sin notas para ninguna de sus capas hijas, la fila no se renderiza.

**Por qué:** una sección vacía enseña a ignorarla.

### NAV-R7 — Vías no auto-carga: muestra el costo medido y un botón para cargar igual

Al abrir la pestaña de vías no se dispara ningún pedido. En su lugar se muestra el costo medido
y un botón para cargar de todos modos. El "Ver" de una fila de vías también avisa la espera
mientras trae el feature completo.

**Por qué:** vías es lenta para todo, no sólo para descargar, y esto no lo sabía el diseño
original. Medido el 2026-09-06 contra el GeoServer del INDEC: una página de 20 filas sin
geometría tarda 14–20 s filtrando por departamento y 88–99 s filtrando por provincia; traer un
solo feature con geometría —lo que hace "Ver"— tarda 12,4 s. Los mismos pedidos sobre radios
tardan 0,65 s y 0,89 s. No es el payload (10 KB) ni el orden: es una tabla de 477.588 filas sin
índice útil para los campos por los que se filtra. Auto-cargar esa pestaña, o dejar que "Ver"
trabaje en silencio, cuelga la interfaz sin avisar; borrar la pestaña porque es lenta sería
peor, porque el usuario la pidió por nombre. Avisar y dejar elegir es lo único que no le miente
a nadie.
