# Buscador

Decisiones de producto sobre cómo se encuentra un objeto antes de descargarlo.

## ✅ Reglas

### BUS-R1 — El filtro de tipo acota la búsqueda y arranca en todos

Un `<select>` al lado del campo elige sobre qué tipo de objeto se busca. Su valor inicial es
"Todos los tipos", y cambiarlo vuelve a buscar lo que ya está escrito, sin obligar a retipear.

Las opciones salen de `TYPE_ORDER` y del `plural` de `TYPES`, no del HTML: el orden y las
etiquetas viven en un solo lugar.

**Por qué:** cinco tipos comparten nombre en el mismo lugar —Tres de Febrero es departamento,
localidad y gobierno local a la vez— y quien ya sabe cuál quiere se come tres resultados para
llegar. Pero pedir el tipo *antes* de escribir sería un paso de más para quien no lo sabe: por
eso el default es todos y el filtro es opcional.

### BUS-R2 — Los términos se buscan sueltos, y tienen que estar todos

La consulta se parte en palabras. Cada una se busca por separado como substring, en cualquier
orden, y **todas** tienen que aparecer: `tres febrero` y `febrero tres` encuentran Tres de
Febrero; `tres rosario` no encuentra nada.

No hay tolerancia a errores de tipeo: es substring, no distancia de edición.

**Por qué:** los nombres oficiales llevan palabras de relleno que nadie recuerda en el orden
exacto —"de", "del", "de la"—. Exigir la cadena literal completa convertía un nombre bien
escrito en cero resultados. Lo que sí se exige es que estén todas las palabras: con "alguna
alcanza", cualquier consulta de dos palabras devolvería medio catálogo.

### BUS-R3 — La provincia refina la búsqueda; no busca sola

Un término puede caer en el nombre del objeto o en el de su provincia, pero **al menos uno
tiene que caer en el nombre**. Así `caseros entre rios` distingue los dos Caseros del país,
mientras que `buenos aires` sigue devolviendo los seis objetos que se llaman así y no los
miles que hay adentro de la provincia.

La clave normalizada de la provincia (`sp`) la deriva `loadCatalog` al cargar, no el build.

**Por qué:** sin la condición del nombre, el tope de 20 resultados se llenaba de objetos que
no tienen nada que ver con lo que se escribió. Y `sp` no va al build porque `p` ya viaja en el
JSON: precalcularla le sumaría más de 100 KB al catálogo commiteado (DES-R6) por algo que se
deriva en una pasada al arrancar.

Como beneficio lateral, normalizar la provincia tapa una inconsistencia del INDEC: la misma
provincia viene "Entre Rios" en localidades y "Entre Ríos" en gobiernos locales (DES-R8).

### BUS-R4 — Los resultados salen en cuatro niveles, del match más literal al más laxo

1. la consulta entera **empieza** el nombre
2. la consulta entera está **adentro** del nombre
3. todos los términos caen en el nombre
4. algún término necesitó la provincia

Dentro de un mismo nivel desempata el orden de tipos (`TYPE_ORDER`) y después el alfabético.

**Por qué:** aflojar el matching sin ordenar por qué tan literal fue el match hunde el
resultado obvio entre los laxos: `rosario` tiene que dar Rosario antes que Villa Rosario, y
`santa rosario` tiene que dar Rosario Santa Ana antes que el Rosario que sólo coincide porque
está en Santa Fe.
