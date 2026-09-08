# Direccionabilidad universal — diseño

Fecha: 2026-09-08. Estado: aprobado en brainstorming, pendiente de plan.

Hoy `/resultados/?t=<tipo>&c=<código>` acepta cinco tipos: los que están en
`public/catalog.json`. Fracciones, radios y vías no tienen enlace propio. Se llega a ellos
bajando por la ficha del padre, y el botón «Ver» de una fila los dibuja en el mapa sin cambiar
de página.

De ahí salen tres problemas que resultaron ser el mismo:

1. **«Ver» cambia sólo la fila 1** —mapa y panel de identidad— y deja las filas 2 y 3 hablando
   del padre. Como la página no se mueve, el cambio ocurre arriba de donde estás mirando: se
   siente que no pasó nada.
2. **No hay forma de compartir un radio ni un tramo.**
3. **No hay forma de llegar a un radio** si no venís bajando por su padre. No tienen nombre
   (NAV-R4), así que el buscador no los alcanza nunca.

La causa común es una sola: **el catálogo se usa para direccionar cuando sólo hace falta para
buscar por nombre.** Un radio se resuelve pidiéndoselo al GeoServer por su código, en 0,65–0,89
segundos medidos. Este diseño separa las dos cosas.

## Qué se construye

1. **Ocho tipos direccionables** en vez de cinco.
2. **La ficha de un objeto sin catálogo**, resuelta contra el GeoServer.
3. **Vías, que no pide nada al abrirse**, para no romper la promesa de SITIO-R3.
4. **«Ver» navega** en vez de reemplazar media ficha.
5. **La página de la tabla, en el permalink.**
6. **Buscar por código**, los ocho tipos.

## Restricciones que no cambian

- **SITIO-R2**: la URL es el estado y elegir un objeto navega. Este diseño la extiende, no la
  contradice: más cosas pasan a ser direccionables, y ninguna pasa a vivir fuera de la URL.
- **NAV-R1 a R5, R7 a R9**: cómo se recorren las tablas, los plazos, los abortos y el panel de
  costo de vías. Nada de eso cambia.
- **DES-R1 a R10**: las descargas no se tocan. En particular DES-R9: descargar cualquier fila de
  una calle baja la calle entera.
- **Sin dependencias nuevas.** Castellano en la interfaz, inglés en el código.

## 1. Ocho tipos direccionables

`TYPES` en `download.js` gana tres entradas. Los ocho largos de código son distintos y no
colisionan — verificado el 2026-09-08 contra el GeoServer y contra el catálogo:

| `t` | Objeto | Capa WFS | Campo | Largo | ¿En catálogo? |
|---|---|---|---|---|---|
| `jur` | Jurisdicción | `jurisdicciones` | `cpr` | 2 | sí |
| `aglo` | Aglomerado | `aglomerados` | `codaglo` | 4 | sí |
| `dep` | Departamento | `departamentos` | `cde` | 5 | sí |
| `gl` | Gobierno local | `gobiernos_locales4` | `cmu` | 6 | sí |
| **`frac`** | Fracción censal | `fracciones_censales` | `cod_indec` | **7** | **no** |
| `loc` | Localidad censal | `localidades_censales` | `clc` | 8 | sí |
| **`rad`** | Radio censal | `radios_censales2` | `cod_indec` | **9** | **no** |
| **`via`** | Vía de circulación | `vias_de_circulacion` | `cod_indec` | **13** | **no** |

`permalink.parse` valida `t` contra los ocho y `c` contra dígitos **más el largo que ese tipo
exige**. Un código de largo equivocado es un enlace inválido, y SITIO-R4 ya dice qué pasa
entonces: mensaje de error y buscador, nunca una ficha a medias.

El largo entra a la validación a propósito: es lo único que separa `?t=rad&c=0684042` (siete
dígitos, no es un radio) de un enlace bueno, y sin él la página saldría a pedirle al GeoServer
un objeto que no puede existir.

## 2. La ficha de un objeto sin catálogo

**Resolución.** Para los cinco del catálogo, como hoy: `c.objects.find(...)`. Para los tres
nuevos, un `GetFeature` por código contra su capa. El catálogo se sigue bajando igual —lo
necesita el buscador— pero deja de ser el que decide si un objeto existe.

**Qué muestra.** Los campos salen de `specOf(capa)` en `columns.js`, la misma definición que ya
arma la tabla. Eso conserva lo que NAV-R10 protegía: ficha y tabla no pueden decir cosas
distintas de la misma fila, porque leen lo mismo.

- **Identidad**: `titleField` cuando la capa lo declara (en vías, `fna`), y `"<Capa> <código>"`
  cuando no (fracciones y radios no tienen nombre publicado, NAV-R4).
- **Mapa**: `showFeature`, que ya existe.
- **Su descarga**: `featureUrl(capa, código)`. **Sólo necesita el código**, así que el botón
  funciona antes de que vuelva ningún pedido.
- **De qué forma parte** (fila 2, mitad de padres): **del prefijo del código, sin pedir nada**.
  Un radio `068402311` tiene fracción `0684023`, departamento `06840` y jurisdicción `06`; la
  fracción no está en el catálogo, así que ese padre se enlaza como `?t=frac&c=0684023`.

  Para vías el prefijo es la localidad censal: verificado el 2026-09-08 sobre las 400 filas del
  departamento `06469`, repartidas en 11 localidades censales distintas, **el `cod_indec` de un
  tramo empieza siempre con su `clc`** (400 de 400, cero contraejemplos). Así que
  `0646908000600` da localidad `06469080`, departamento `06469` y jurisdicción `06` sin una
  línea de red — que es lo que permite que la ficha de una vía muestre sus padres antes de
  apretar «Cargar igual» (§3).
- **Qué contiene** (fila 2, mitad de hijas) y **fila 3**: no se muestran. Un radio no contiene
  nada. Hoy `el.rowBrowse` ya sabe ocultarse; el bloque de capas hijas de la fila 2 no, y hay que
  darle el mismo trato — una sección vacía enseña a ignorarla (el motivo que ya usó NAV-R6).

## 3. Vías: la ficha no pide nada al abrirse

SITIO-R3 decidió que un enlace con `capa=vias` no dispare ningún pedido de vías, para que quien
recibe el enlace no pague hasta 99 segundos que nunca pidió. Un permalink `?t=via&c=…` le
cobraría 12–20 segundos por exactamente la misma razón.

**La ficha de una vía abre sin pedir nada:**

- título `Vía de circulación <código>`,
- el botón de descarga, que funciona sin red,
- el panel de costo medido con un botón **«Cargar igual»** — el mismo patrón que NAV-R7 ya usa
  al abrir la pestaña.

Recién ese botón dispara el `GetFeature` que trae la geometría. Fracciones y radios no llevan
panel: cargan solas, 0,65–0,89 segundos medidos.

**Y lo que ese permalink direcciona es una calle, no un tramo.** Verificado el 2026-09-08: un
`cod_indec` devuelve exactamente un feature en fracciones y en radios, pero en vías lo comparten
todos los tramos de la calle —de las 1.487 filas del departamento `06840` salen 727 códigos, y el
más partido, `0684001002660` (AUTOPISTA DEL OESTE), tiene **80 tramos**—. El mapa los dibuja a
todos, que es lo correcto y lo que ya hace `DES-R9` al descargar.

La consecuencia para la ficha no es menor: describir el primer tramo —con su rango de alturas,
que es de ese tramo y de ningún otro— mientras el mapa dibuja los 80 sería la misma contradicción
entre ficha y mapa que NAV-R11 dice haber eliminado, entrando por otra puerta. Así que **la ficha
de una vía describe la calle**: nombre, código y en cuántos tramos está partida. Los campos de
tramo no se muestran.

Eso además entrega gratis la advertencia de duplicados que motiva la nota de vías: el pedido ya
volvió con todos los tramos, así que contarlos no cuesta nada.

**SITIO-R3 se reescribe** para cubrir los dos casos bajo un solo enunciado: nada de vías se pide
sin un acto explícito del usuario, venga de la pestaña o del permalink. La regla vieja hablaba
sólo de `capa=vias` porque era lo único que existía.

## 4. «Ver» navega

`onView` pasa a ser `navigate(format(fila))`. Eso borra, en vez de arreglar, todo el andamiaje
que existía para que media ficha describiera otra cosa que la otra media:

**Muere:** `showRow`, `backButton` y el botón «Volver a \<objeto\>», el chequeo de carrera
(`if (props)`, el «Ver» de 12 s que llega tarde), `clearSelection`, y la acumulación de
`describeFeature` sobre `#detail-meta`.

**Muere también `showFeature`**, que no se había previsto: con `TYPES` extendido, la ficha de una
fracción, un radio o una vía se dibuja con `showObject` —`selfUrl` ya sabe armar su URL—, y el
«Ver» era su único otro llamador. Es menos código del que este diseño preveía, no más.

**Queda:** `showFeatureIdentity`, que ahora la usa la ficha del objeto y no una previsualización
dentro de la ficha de otro; y `NAV-R5` y `NAV-R8`, que siguen valiendo porque son sobre las
páginas de la tabla, no sobre «Ver».

**Lo que reemplaza a «Volver»** es el botón Atrás del navegador, que ahora es navegación de
verdad. Eso es SITIO-R2 aplicado a un caso más.

**El scroll deja de hacer falta.** La queja original —«actualiza el mapa pero no me lleva ahí, no
veo el cambio»— desaparece porque la página cambia de verdad, y una página nueva arranca arriba.

**NAV-R10 se muere.** Su contenido deja de ser una regla que hay que hacer cumplir y pasa a ser
una propiedad estructural: hay un solo objeto por página, así que la ficha no puede describir
otra cosa que el mapa. La reemplaza **NAV-R11**, que dice eso y nombra a la muerta.

## 5. La página de la tabla, en el permalink

Hoy «Volver a \<objeto\>» te devuelve a la ficha del padre **dejando la fila 3 donde estaba** —en
la página 3, si ahí estabas—. Con navegación, Atrás te devolvería a la página 1: sería una
regresión respecto de lo que ya funciona.

Por eso el permalink gana `pag=`:

- **1-based**, como lo que muestra el paginador. `pag=4` es la cuarta página.
- **Sólo tiene sentido con `capa=`.** Sin capa se ignora.
- **`pag=1` no se escribe**, igual que hoy no se escribe la pestaña que el browser abre solo:
  la barra dice lo que hace falta y nada más.
- **No hace que vías pida nada.** Un enlace `capa=vias&pag=3` recuerda la página y sigue
  mostrando el panel de costo. La página se guarda; el pedido no se hace.

## 6. Buscar por código

Una consulta de **puros dígitos** se resuelve así:

1. **Coincidencia exacta contra `obj.c`** del catálogo. Sirve para los cinco tipos y no necesita
   ninguna tabla de largos: `06840` matchea el departamento y nada más.
2. **Si además el largo es 7, 9 o 13**, se ofrece una fila sintética —`Fracción censal 0684042`,
   `Radio censal 068402311`, `Vía de circulación 0684001001810`— **sin pedirle nada al
   GeoServer**. El pedido ocurre recién si la elegís, ya en la ficha.

No hay colisión posible: ningún código del catálogo mide 7, 9 ni 13 caracteres.

Que tipear un código no cueste red es la mitad del diseño. La otra mitad es que los 12–20
segundos de una vía se paguen sólo si la pediste a propósito, dos veces: al elegirla en la lista
y al apretar «Cargar igual».

**Los ceros a la izquierda importan.** Los códigos son cadenas: `06840`, no `6840`. La
coincidencia es de cadena, exacta, sin rellenar ni recortar. Escribir `6840` no encuentra el
departamento —es lo correcto: `6840` no es su código— y tampoco inventa un aglomerado.

**El filtro de tipo (BUS-R1) sigue valiendo**: con un tipo elegido, una búsqueda por código sólo
devuelve objetos de ese tipo.

**BUS-R4 gana un nivel 0**, arriba de «la consulta entera empieza el nombre»: coincidencia
exacta de código. Un código es la afirmación más literal que alguien puede escribir en ese
campo.

## 7. Tests

- **`permalink.test.js`**: los ocho tipos parsean; un código de largo equivocado es inválido para
  su tipo; `pag=` 1-based, ignorado sin `capa=`, no escrito cuando vale 1.
- **`search.test.js`**: `06840` devuelve el departamento y sólo ese; `6840` no devuelve nada;
  un largo 7/9/13 devuelve la fila sintética sin tocar la red (con `fetch` espiado, que **no**
  tiene que llamarse); el filtro de tipo acota también la búsqueda por código; el nivel 0 ordena
  arriba de todo.
- **`resultados.test.js`**: la ficha de un radio se resuelve contra el GeoServer y muestra
  identidad, mapa, descarga y padres, sin fila 3 ni bloque de capas hijas; la ficha de una vía
  **no dispara ningún pedido de vías al montarse** —el test más importante del lote, porque es
  la promesa de SITIO-R3— y sí lo dispara al apretar «Cargar igual»; «Ver» en una fila hija
  llama a `navigate` con el permalink de esa fila y no toca `#detail`.
- **Control negativo obligatorio antes de marcar nada ✅**: romper a mano la guarda de vías y ver
  el test rojo. Un test que no mata esa mutación no sostiene SITIO-R3.

## 8. Reglas

| Regla | Qué le pasa |
|---|---|
| **BUS-R5** | nueva — se busca por código, los ocho tipos, sin red hasta que elegís |
| **NAV-R11** | nueva — un objeto por página; reemplaza a NAV-R10 |
| ~~**NAV-R10**~~ | muerta — la reemplaza NAV-R11 |
| **SITIO-R3** | reescrita — cubre el permalink de vía además de `capa=vias` |
| **SITIO-R2** | ampliada — el permalink lleva también la página de la tabla |
| **BUS-R4** | ampliada — nivel 0, coincidencia exacta de código |
| BUS-R1, R2, R3 · NAV-R1…R5, R7…R9 · DES-* | sin cambios |

Al cerrar NAV-R10 hay que `grep` su ID por todo el repo: hoy la citan comentarios en
`resultados.js`, `browser.js` y varios tests, y un comentario que apunta a una regla muerta es
exactamente el error que ya pasó cuando murió NAV-R6.

`docs/reglas/README.md` se actualiza a mano: este repo no tiene generador de índice ni gate de
citas.
