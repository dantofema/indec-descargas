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

### ~~NAV-R6 — La fila de notas aparece sólo si el objeto tiene alguna nota~~

**Muerta:** la fila de notas dejó de existir. Las notas se mudaron a /notas/ y la ficha enlaza
en vez de repetir; la reemplaza NOTA-R3 de notas.md.

Sin notas para ninguna de sus capas hijas, la fila no se renderiza.

**Por qué:** una sección vacía enseña a ignorarla. Medido contra el catálogo: de los 6.977
objetos, 4.686 tienen alguna capa con nota y 2.291 no tienen ninguna. De esos 2.291, 2.282 son
gobiernos locales —coherente con DES-R7, que no les da capas hijas— y los 9 restantes son
objetos cuyas capas con nota están en cero (NAV-R9): las ocho localidades de las Islas del
Atlántico Sur y el departamento Antártida Argentina. Sin ocultarla, la fila de notas aparecería
vacía en un tercio de las fichas del sitio.

### NAV-R7 — Vías no auto-carga: muestra el costo medido y un botón para cargar igual

Al abrir la pestaña de vías no se dispara ningún pedido. En su lugar se muestra el costo medido
y un botón para cargar de todos modos. La ficha de una vía tampoco pide nada al abrirse: muestra
el mismo costo medido y su botón (SITIO-R3). Antes ese aviso vivía en el "Ver" de la fila, que
traía el feature; desde que "Ver" navega (NAV-R11), la espera es de la ficha de destino y el
aviso se mudó con ella.

**Por qué:** vías es lenta para todo, no sólo para descargar, y esto no lo sabía el diseño
original. Medido el 2026-09-06 contra el GeoServer del INDEC: una página de 20 filas sin
geometría tarda 14–20 s filtrando por departamento, 17–18 s filtrando por localidad censal
(`clc=06840010` dio 18,0 s y `clc=82084010`, 17,2 s) y 88–99 s filtrando por provincia; traer un
solo feature con geometría —lo que hace la ficha de una vía— tarda 12,4 s. Los mismos pedidos
sobre radios tardan 0,65 s y 0,89 s. No es el payload (10 KB) ni el orden: es una tabla de
477.588 filas sin índice útil para los campos por los que se filtra. Auto-cargar esa pestaña, o
dejar que la ficha de una vía trabaje en silencio, cuelga la interfaz sin avisar; borrar la
pestaña porque es lenta sería peor, porque el usuario la pidió por nombre. Avisar y dejar elegir
es lo único que no le miente a nadie.

El caso de la localidad censal no es marginal: es el 58% de las fichas donde el aviso aparece
—4.023 de los 6.977 objetos del catálogo son localidades con vías como única capa hija—, así que
el aviso lo nombra en vez de dejar al usuario deducirlo del rango del departamento.

### NAV-R8 — Un pedido que no vuelve se corta solo, y el abandonado se aborta

Una página de hijos que no llega dentro de su plazo se da por muerta: en el lugar de la tabla
aparece el error con el botón de reintentar, el mismo que ya se muestra cuando el GeoServer
contesta mal. El plazo es de 30 segundos para todas las capas salvo vías, que se parte por tipo
de objeto padre: 180 segundos si el padre es `jur` o `aglo`, 60 si es `dep` o `loc`. Y todo pedido
que se abandona —cambiar de pestaña (incluida la propia vías, sin confirmar todavía; NAV-R7),
pasar de página, elegir otro objeto— se aborta, no sólo se descarta (NAV-R5).

**Por qué:** un `fetch` sin corte no falla nunca. Si el GeoServer acepta la conexión y se queda
callado, la fila 3 queda en «Cargando…» para siempre, porque el error con Reintentar sólo aparece
cuando el pedido falla. Y no siempre hay a dónde escapar: 4.023 de los 6.977 objetos del catálogo
—el 58%— son localidades censales con una sola capa hija, así que no hay otra pestaña a la que
cambiar, y volver a clickear la que ya está activa no vuelve a pedir nada.

Los plazos dejan headroom sobre el peor caso legítimo medido el 2026-09-06 (NAV-R7). Vías es la
única capa que hace falta partir por tipo de padre, porque ahí el peor caso no es parejo: `jur`
es el padre del caso más lento medido —88–99 s filtrando por provincia—, así que sus 180 s dejan
headroom ~1,8×. `aglo` no está medido: un aglomerado puede cubrir más área que un departamento y
no hay dato que lo descarte, así que queda a propósito en el mismo tier conservador que `jur`, no
por prolijidad sino por falta de un número que lo baje. `dep` y `loc` miden 14–20 s y 17–18 s, muy
por debajo de esos 180 s: dejarlos en el tier de `jur` hacía esperar al 58% del catálogo —4.023 de
los 6.977 objetos son localidades censales con vías como única capa hija— hasta 3 minutos para
enterarse de un colgado cuyo caso legítimo termina en 18 s. Por eso bajan a 60 s, headroom ~3×
sobre sus peores casos medidos. El resto de las capas —fracciones, radios, departamentos,
localidades— sigue en un único plazo de 30 s sin distinguir padre: miden 0,65–0,89 s, treinta
veces menos que el corte, así que no hay caso lento que justifique partirlas.

Partir acá no es la tabla de dos dimensiones que esta regla decía evitar antes de medir: es un
solo eje —tipo de padre— sobre una sola capa —vías—, con los cuatro números ya medidos. La tabla
de dos dimensiones habría hecho falta para partir las cinco capas hijas por los cinco tipos de
padre a la vez; partir la única capa que lo necesita, por el único eje que explica su varianza,
es un problema mucho más chico.

Abortar, además de descartar, es por la conexión y no por la pintura: un pedido abandonado sigue
ocupando una de las ~6 que el browser permite por origen, y el mapa pide al mismo origen. Con unos
pocos pedidos de vías colgados, la fila 1 deja de dibujar por culpa de la fila 3.

### NAV-R9 — Una capa hija en cero no se recorre

Una capa con conteo cero no abre pestaña en la fila 3. Aparece sólo en la fila 2, con el botón
deshabilitado y el motivo (DES-R3). Si todas las capas de un objeto están en cero, la fila 3 no
se muestra.

La mitad de esta regla que decía "ni se anota" se fue con NAV-R6: la fila 4 de notas ya no
existe, así que no hay nada que ocultar ahí.

**Por qué:** la fila 2 y la fila 3 decían cosas distintas sobre el mismo dato. Grytviken —una de
las 11 combinaciones (objeto, capa) del catálogo con conteo cero— decía bien en la fila 2 que no
hay vías, y abría igual en la fila 3 una pestaña «Vías de circulación 0» con el panel de costo
avisando 88 a 99 segundos y un botón para cargar igual. Medido el 2026-09-06, ese pedido tarda 17
segundos y vuelve con `totalFeatures: 0`: el usuario paga la espera entera para no recibir nada
que la fila 2 no le dijera gratis.

El conteo cero sigue llegando entero a la fila 2 —DES-R3 lo necesita para dibujar el botón muerto
con su motivo, y es el único lugar del sitio donde el cero se explica—, así que el filtro es una
pregunta aparte y no un recorte en la fuente.

### ~~NAV-R10 — La ficha describe lo que el mapa está dibujando~~

**Muerta:** el "Ver" de una fila dejó de reemplazar media ficha y pasó a navegar, así que ya no
hay dos objetos en la misma página que puedan contradecirse. La reemplaza NAV-R11.

### NAV-R11 — Un objeto por página

El "Ver" de una fila hija navega a la ficha de esa fila. No hay previsualización dentro de la
ficha de otro objeto: la página describe un solo objeto, y el mapa dibuja ése. Volver es el botón
Atrás del navegador, que funciona porque es navegación de verdad (SITIO-R2).

**Por qué:** NAV-R10 pedía que la ficha siguiera al mapa, y para cumplirlo hacían falta un panel
de identidad que se reemplazaba, un botón de volver que restauraba el anterior, un chequeo de
carrera para que un "Ver" de 12 s que llegaba tarde no pisara lo que se estaba mirando, y una
marca de fila que había que limpiar al volver. Cinco piezas para sostener una promesa que se
cumple sola si hay un solo objeto por página. Además la ficha estaba arriba de la tabla: el
cambio ocurría fuera de la pantalla y se sentía que no había pasado nada.