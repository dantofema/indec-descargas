# Sitio

Decisiones de producto sobre la estructura del sitio: qué páginas existen, qué es el estado
navegable, y qué información institucional lleva cada una.

## ✅ Reglas

### SITIO-R1 — El sitio son cuatro páginas con URL propia

Home, resultados, notas y servicios geoespaciales del INDEC: cada una con su propia URL
(`/`, `/resultados/`, `/notas/`, `/servicios/`) y su propia entrada de build.

**Por qué:** el home tiene que vender la idea del sitio y ser compartible por sí solo, y notas
y servicios son contenido que se lee, no estado de una app. Meter las cuatro cosas bajo una
sola URL mezclaba un objetivo comercial, un estado de búsqueda y dos páginas de referencia que
no tienen nada que ver entre sí.

### SITIO-R2 — El permalink es el estado

Elegir un objeto en el buscador navega, siempre —también estando ya en `/resultados/`— y no hay
estado del sitio que viva fuera de la URL.

**Por qué:** con `pushState` habría dos fuentes de verdad que pueden desincronizarse. Navegando
de verdad, atrás y adelante funcionan sin una línea de código de historia: los resuelve el
browser. El costo aceptado es un reload por objeto nuevo —`catalog.json` sale de la caché del
browser y el mapa se reinicia— a cambio de que la pieza más fácil de romper de esta clase de
funcionalidades no exista.

### SITIO-R3 — `capa=vias` en el permalink abre el panel de costo sin pedir vías

Un enlace que apunta a la pestaña de vías la abre en su panel de costo —el mismo que exige
NAV-R7 al abrirla a mano— sin disparar ningún pedido de vías contra el GeoServer. La página sí
hace los pedidos que haría cualquier otra ficha.

Medido el 2026-09-08 sobre la página montada, `?t=dep&c=06840&capa=vias` dispara **tres**
pedidos: `catalog.json`, la página de fracciones —la primera pestaña, que `createTabs`
selecciona al armarse y que el salto a vías aborta en el mismo tick (NAV-R8)— y la geometría
del departamento para el mapa, que es la fila 1 y no tiene nada que ver con la pestaña abierta.
Dos de esos tres van al GeoServer, y ninguno es de vías.

**Por qué:** si no, un enlace compartido le cobra al que lo abre hasta 99 segundos medidos
(NAV-R7) que nunca pidió: sólo lo abrió porque alguien se lo mandó. Los otros dos pedidos no le
cuestan eso —la geometría del objeto es lo que se vino a ver, y la página de fracciones abortada
es una capa rápida, 0,65-0,89 s medidos, que muere en el mismo tick—, así que no hace falta un
camino aparte para evitarlos; lo que la regla no puede permitir es el pedido de vías, y ése no se
hace.

### SITIO-R4 — Parámetros inválidos muestran el buscador, nunca una ficha rota

Un tipo desconocido, un código que no son dígitos, o un tipo y código que no resuelven a ningún
objeto del catálogo: en los tres casos aparece un mensaje de error y el buscador. No se dibuja
ninguna ficha a medias.

**Por qué:** un enlace se copia mal, se corta en un mensaje o envejece contra un catálogo que
cambió. La respuesta útil ante eso es dejar buscar de nuevo, no un error terminal sin salida.

### SITIO-R5 — Cada página lleva el CTA al Geoportal INDEC

Home, resultados, notas y servicios llevan un enlace chico a `https://geonode.indec.gob.ar/`,
con `target="_blank"`.

**Por qué:** este sitio usa 8 de las 47 capas que publica el INDEC; quien necesita más tiene que
saber a dónde ir. `geoportal.indec.gob.ar` **no existe** —verificado el 2026-09-08, sin registro
DNS—: el Geoportal INDEC es el GeoNode, cuya propia portada dice "Geoportal INDEC".

### SITIO-R6 — El header, el CTA y el footer se inyectan en build y existen en el HTML servido

Los tres partials se escriben una sola vez y un paso de build los resuelve dentro de las cuatro
páginas. Un marcador sin su partial correspondiente hace fallar el build en vez de publicarse
así.

La fecha de generación del catálogo va por el mismo camino: el pie la trae resuelta en build
desde `totales.json` —el archivo que SITIO-R7 ya compara contra el catálogo—, así que las cuatro
páginas la muestran aunque el JS no corra, y `/servicios/`, que no tiene una línea de JS, no
necesita una para eso. Home y resultados la reescriben después con lo que además saben (el home,
la misma frase; resultados, con el conteo de objetos del catálogo que ya bajó).

**Por qué:** escritos una vez, pero presentes en el HTML servido aunque el JS no llegue a
correr. Y un marcador con un error de tipeo que no rompiera nada sería un footer ausente en
producción que nadie ve faltar: tirar en build es preferible a un footer que falta en silencio.

### SITIO-R7 — Los totales del home salen del build y no pueden envejecer sin que un test lo diga

El home pinta sus ocho tiles desde un archivo de totales aparte del catálogo, generado en el
mismo paso de build y comparado contra `catalog.json` en la suite.

**Por qué:** el home muestra sus números en menos de 100 ms sin bajar los 673 KB de
`catalog.json` —el archivo de totales pesa 162 bytes medidos—. La alternativa, si el catálogo se
regenera sin regenerar los totales, era publicar números viejos sin que nadie se enterara; con
el test de por medio, es la suite la que se pone roja.

### SITIO-R8 — El mapa no acredita a Leaflet; sí al IGN

El control de atribución del mapa no muestra el prefijo de Leaflet. La atribución del basemap
del IGN, que va aparte, queda.

**Por qué:** el prefijo por defecto del control de atribución de Leaflet trae el enlace a
leafletjs.com y una bandera de Ucrania (`leaflet-src.js:5762`), y ninguna de las dos cosas es
del dato que se está viendo. La licencia BSD-2-Clause de Leaflet no exige crédito en la
interfaz, sólo el aviso de copyright en el código, que sigue donde estaba. La atribución del IGN
sí queda: esa es del basemap sobre el que se dibuja el objeto.

### SITIO-R9 — El sitio dice que no es del INDEC, en las cuatro páginas

El pie de las cuatro páginas abre con un descargo de que el sitio no es oficial ni representa al
INDEC. No hay bloque institucional —nombre, dirección, teléfono del organismo— en ninguna página,
y ningún `<title>` lleva el nombre del INDEC como firma. La atribución de licencia y el enlace a
la fuente sí quedan: son del dato, no del sitio.

El aviso de límites nombra de dónde salen: son los que usa cada dirección provincial de
estadística, no los del IGN ni los de la ley, y enlaza a quién sí publica los oficiales. Eso no
sale del Marco Geoestadístico —el PDF no trae ningún descargo de oficialidad— sino de los
metadatos de las capas del GeoNode.

**Por qué:** un pie que abre con la dirección y el teléfono del INDEC es el pie que pondría el
INDEC. Nada en el sitio afirmaba ser oficial y aun así el conjunto —vocabulario del organismo,
capas del organismo, datos de contacto del organismo— lo daba a entender. La diferencia importa
cuando alguien baja un límite y lo usa para algo: quién responde por ese archivo es el INDEC, y
quién no responde por nada es este sitio.
