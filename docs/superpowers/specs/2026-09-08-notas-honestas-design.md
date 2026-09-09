# Notas honestas — diseño

Fecha: 2026-09-08. Estado: aprobado en brainstorming, pendiente de plan.

El sitio habla con el vocabulario del INDEC como si fuera el del país, y eso lo lleva a decir
dos cosas falsas. El pie abre con el nombre, la dirección y el teléfono del organismo, así que
parece un sitio del INDEC; no lo es. Y la nota de localidad censal usa Tres de Febrero como el
caso tranquilizador —«al revés también pasa»— cuando es el peor caso que hay en la capa.

Este diseño hace dos cosas: saca del sitio todo lo que lo hace pasar por oficial, y reescribe
las notas con lo que se verificó contra el GeoServer y con fuentes externas citadas.

No toca el buscador, la ficha, el mapa ni las descargas. Los rótulos de la interfaz siguen
diciendo «Localidad censal»: renombrar lo que el INDEC llama así sería inventar un término que
después no aparece ni en el documento oficial ni en el archivo que se baja.

## Qué se construye

1. **Pie sin bloque institucional**, con un descargo explícito de que el sitio no es del INDEC.
2. **Cuatro `<title>` sin `— INDEC`.**
3. **NOTA-R2 ampliada:** una nota puede afirmar algo externo si nombra la fuente en el texto.
4. **Las ocho notas reescritas** donde estaban mal o donde callaban lo que importa.

## Lo que no cambia

- **NOTA-R1:** siguen siendo ocho notas, una por objeto del Marco. **Manzana no entra**: el
  sitio no distribuye esa capa, y explicar un término que no aparece en ninguna pantalla es
  contestar una pregunta que nadie hizo acá. (Además, la incompatibilidad entre la manzana
  censal y la catastral no se pudo sostener con una cita: es inferencia a partir de dos
  definiciones, no una fuente.)
- **NOTA-R3:** la ficha enlaza a la nota, no repite su texto.
- **SITIO-R5:** el CTA al Geoportal INDEC queda. Enlazar a la fuente no es hacerse pasar por
  ella.
- **SITIO-R6:** el mecanismo de inyección del shell en build no se toca. Este diseño cambia el
  contenido de un partial, no cómo llega a las páginas.

## 1. Desoficialización

### 1.1 El pie

Se va, entero, de `src/shell/footer.html`:

```html
<p class="org">
  <strong>INDEC</strong> — Instituto Nacional de Estadística y Censos de la República Argentina<br />
  Av. Presidente Julio A. Roca 609, P.B. — C1067ABB, Ciudad Autónoma de Buenos Aires, Argentina<br />
  Consultas: (54-11) 5031-4632
</p>
```

Entra, como primer párrafo del pie, con la clase `warning` que ya existe:

> **Sitio no oficial.** No pertenece al INDEC ni lo representa. Publica datos que el INDEC
> distribuye abiertamente.

Queda lo demás: los enlaces a `indec.gob.ar` y al Geoportal, la atribución CC BY-SA —que es de
los datos, no del sitio, y por eso sobrevive a la desoficialización—, la línea de que las
descargas van del servidor del INDEC, el aviso de límites y la fecha del catálogo.

### 1.2 El aviso de límites, con la fuente correcta

Hoy dice, parafraseando:

> Estos límites son para integración de información estadística. No son fuente oficial de
> delimitación territorial ni sirven como prueba en controversias de límites.

Pasa a:

> Los límites que publica el INDEC son para uso estadístico: no son los límites oficiales del
> territorio ni sirven como prueba en una controversia de límites. Los oficiales los publica el
> [IGN](https://www.ign.gob.ar/ut/), y no siempre coinciden con éstos.

**Corregido durante la implementación, el 2026-09-08.** Este documento mandaba antes un texto
más fuerte —que los límites del INDEC «son los que usa cada dirección provincial de estadística
para armar su base geográfica, no los del IGN ni los de la ley»—, atribuido a los metadatos de
las capas del GeoNode. Esa cita venía del material de research y **no se pudo verificar**: el API
v2 del GeoNode devuelve el shell HTML de su app, el CSW devuelve una página de error, y el
`<Abstract>` que sí publica el WMS para `geonode:departamentos` dice sólo «Censo Nacional de
Población, Hogares y Viviendas 2022.». Puede ser cierta y simplemente inalcanzable desde acá,
pero afirmarla en la voz del sitio viola la restricción global de este mismo plan —ningún dato
sobre el INDEC se escribe de memoria— y es el defecto que este trabajo viene a corregir. El
aviso dice ahora sólo lo verificado.

Que los dos organismos no coinciden sí está medido (§2.2): 2.114 municipios del IGN contra 2.282
gobiernos locales del INDEC, 3.528 localidades de BAHRA contra 4.023 localidades censales, y 529
departamentos los dos.

### 1.3 Los títulos

Los cuatro `<title>` pierden el sufijo `— INDEC`, que es lo que hace que la pestaña del
navegador y el resultado de Google digan que esto es del organismo:

| Página | Hoy | Queda |
|---|---|---|
| `/` | `…— INDEC` | sin sufijo |
| `/resultados/` | `Descargar un objeto del Marco Geoestadístico — INDEC` | `Descargar un objeto del Marco Geoestadístico` |
| `/notas/` | `Notas sobre los objetos del Marco Geoestadístico — INDEC` | `Notas sobre los objetos del Marco Geoestadístico` |
| `/servicios/` | `Servicios geoespaciales del INDEC — INDEC` | `Servicios geoespaciales del INDEC` |

El de `/servicios/` es el que muestra por qué el sufijo era ruido: decía «INDEC» dos veces. En
esa página el nombre del organismo es parte del tema, no una firma.

### 1.4 Regla nueva: SITIO-R9

> **SITIO-R9 — El sitio dice que no es del INDEC, en las cuatro páginas**
>
> El pie de las cuatro páginas abre con un descargo de que el sitio no es oficial ni representa
> al INDEC. Ningún `<title>` lleva el nombre del organismo como firma. No hay bloque
> institucional —nombre, dirección, teléfono— en ninguna página. La atribución de licencia y el
> enlace a la fuente sí quedan: son del dato, no del sitio.
>
> **Por qué:** un pie que abre con la dirección y el teléfono del INDEC es el pie que pondría el
> INDEC. Nada en el sitio afirmaba ser oficial, y aun así el conjunto —vocabulario del
> organismo, capas del organismo, datos de contacto del organismo— lo daba a entender. La
> diferencia importa cuando alguien baja un límite y lo usa para algo: quién responde por ese
> archivo es el INDEC, y quién no responde por nada es este sitio.

## 2. Notas

### 2.1 NOTA-R2 ampliada

El texto vigente exige que toda afirmación sea verificable contra `public/catalog.json` o
contra el GeoServer, y la suite lo hace cumplir. Eso deja afuera todo lo que hace falta para
explicar por qué el vocabulario del INDEC confunde: qué publica el IGN, qué dice BAHRA, de
dónde sale el umbral que separa urbano de rural.

La regla se amplía con una segunda mitad, y con la asimetría escrita en voz alta:

> Una nota puede además afirmar algo que no sale del catálogo ni del GeoServer, **si nombra la
> fuente en el texto y deja el enlace a la vista**. Esa mitad de la regla no tiene gate: ninguna
> máquina compara prosa castellana con un PDF de la UBA. Lo sostiene una afirmación humana, y
> por eso la nota tiene que decir de quién es el dato, no absorberlo como si fuera propio.
>
> Lo verificable contra el catálogo o el GeoServer sigue bajo el gate automático de siempre, sin
> excepción: que ahora se admita fuente externa no es permiso para dejar de chequear lo que sí
> se puede chequear.

### 2.2 Datos verificados el 2026-09-08

Van al plan como valores exactos. **Ninguno se recalcula ni se escribe de memoria.**

Contra el GeoServer del INDEC (`https://geonode.indec.gob.ar/geoserver/ows`):

| Dato | Valor |
|---|---|
| Localidades censales del partido de Tres de Febrero (`cde='06840'`) | **1** |
| Esa localidad | `clc=06840010`, `nam="Tres de Febrero"`, `fna="Localidad Tres de Febrero"`, `gna="Localidad"`, `tlc=2`, `codaglo=0001`, `aglomerado="Gran Buenos Aires"` |
| Ídem General San Martín | `clc=06371010`, `fna="Localidad General San Martín"`, `tlc=2`, Gran Buenos Aires |
| Localidades censales llamadas Caseros, Ciudadela, Sáenz Peña o Villa Bosch **en Buenos Aires** | **0** (los homónimos que existen son de Entre Ríos, `cde=30098`, y Santiago del Estero, `cde=86014`) |
| Tramos de vía llamados `CALLE SN` | **20.613** |
| Tramos con alguna altura (`desdei>0 OR desded>0 OR hastai>0 OR hastad>0`) | **97.073** de 477.588 = **20,3 %** |
| Largo de `cod_indec` | fracción **7**, radio **9**, vía **13** |

Contra `public/catalog.json`:

| Dato | Valor |
|---|---|
| Partidos bonaerenses | 135 |
| Con una localidad censal homónima del partido | 118 |
| Donde esa homónima es la **única** localidad censal del partido | **29** |
| De esas 29, marcadas `tlc=2` (componente de aglomerado), todas Gran Buenos Aires | **28** |
| La excepción `tlc=1` | General Alvear, `06287010` — un pueblo de verdad |
| Localidades censales de CABA | **15**, `CABA - Comuna 1` … `CABA - Comuna 15` |

Contra el WFS del IGN (`https://wms.ign.gob.ar/geoserver/ows`):

| Capa | IGN | INDEC |
|---|---|---|
| Departamentos | 529 | 529 |
| Municipios / gobiernos locales | **2.114** | **2.282** |
| Localidades (BAHRA) / localidades censales | **3.528** | **4.023** |

Los dos organismos coinciden en departamentos y difieren en todo lo demás.

### 2.3 Fuentes externas admitidas

Sólo estas cuatro entran a las notas bajo la NOTA-R2 ampliada. Cada una se nombra en el texto y
lleva su enlace.

| Afirmación | Fuente |
|---|---|
| Definición de localidad censal: concentración espacial de edificaciones conectadas por vías de circulación, delimitada por criterio de continuidad física | Marco Geoestadístico Nacional, INDEC — `https://www.indec.gob.ar/ftp/cuadros/geoestadistica/marco_geoestadistico_nacional.pdf` |
| Zona rural: «Área comprendida entre el perímetro de la localidad censal y el límite del departamento, donde se puede localizar población rural dispersa» | Marco Geoestadístico (mismo PDF) |
| El radio se clasifica en urbano, rural **o mixto** | Marco Geoestadístico (mismo PDF) |
| «Se denomina partido en la provincia de Buenos Aires, departamento en el resto de las provincias y comuna en la Ciudad Autónoma de Buenos Aires» | Marco Geoestadístico (mismo PDF) |
| Entidad censal: «unidad territorial que identifica una subdivisión de la localidad censal dentro de una misma área político-administrativa» | Marco Geoestadístico (mismo PDF) |

Las cinco citas del Marco Geoestadístico están **verificadas textuales contra el PDF el
2026-09-08**, leído desde este entorno. La única otra fuente admitida es el IGN
(`https://www.ign.gob.ar/ut/`, HTTP 200), y su número lo medí yo contra su WFS.

**Tres fuentes se cayeron el 2026-09-08, todas por no ser verificables:**

1. **Los metadatos del GeoNode**, que sostenían que los límites del INDEC son los de las
   direcciones provinciales de estadística. El API v2 devuelve el shell HTML de la app y el CSW
   una página de error; la frase no está en el PDF ni en el `<Abstract>` del WMS. Salió del pie
   (§1.2) y de la nota de `departamento`.
2. **Pérez Frattini & Huber (2024)**, que sostenía el umbral de 2.000 habitantes y su origen
   en 1914. `repositorio.inta.gob.ar` devuelve 000 por http y por https: no se puede leer el
   trabajo ni ofrecer el enlace que la propia NOTA-R2 ampliada exige. Un enlace muerto parece
   respaldo y no lo es, que es peor que no citar. Con él sale el criterio de los 2.000, que
   tampoco aparece en el PDF del MGN.
3. **`bahra.gob.ar`** como enlace: devuelve 000. El dato de BAHRA se cita como del IGN, que es
   de donde lo medí (`ign:localidad_bahra` = 3.528).

Lo que reemplaza a la 2 es mejor que la cita que perdió: en vez de un umbral de población que el
sitio no puede verificar, las notas dicen lo que el MGN define y lo que se puede medir —que todo
lo que queda fuera del perímetro de una localidad censal es zona rural por definición, y que el
radio tiene tres tipos, con 54.459 urbanos, 9.347 rurales y 2.683 mixtos medidos—.

**Lo que queda afuera a propósito:** la afirmación fuerte de que el criterio *subestima* la
población rural, que depende de Castro & Reboratti (2008) y no se consiguió. Tampoco entra
ninguna comparación internacional del umbral: la premisa de que 2.000 es de los más bajos del
mundo resultó falsa —los países nórdicos usan 200—. Y desde la corrección del 2026-09-08 tampoco
entra el umbral de 2.000 en sí, por la razón de arriba: su única fuente no responde.

El patrón de las tres bajas es el mismo y conviene nombrarlo, porque es la lección de este
trabajo: **el research trajo material bueno cuyas fuentes no se pueden alcanzar desde acá.** Un
sitio que existe para que nadie tome por cierto lo que no puede chequear no puede ser el primero
en hacerlo. Todo lo que sobrevivió está verificado contra el PDF que sí se leyó, contra el
GeoServer, contra el WFS del IGN o contra el catálogo commiteado.

### 2.4 Nota por nota

**`localidad-censal` — reescritura del párrafo tres, que es el que miente.**

Hoy dice: *«Al revés también pasa: Tres de Febrero sí existe como localidad censal, además de
como partido y como municipio.»* La frase es literalmente cierta y funciona al revés de como
está usada: la presenta como el caso que tranquiliza, cuando es el que más engaña. Se reemplaza
por el caso verificado, que dice tres cosas:

1. El partido de Tres de Febrero tiene **una sola** localidad censal, y abarca el partido
   entero. El INDEC la publica como `fna="Localidad Tres de Febrero"`, un nombre que nadie usa.
2. **Caseros, Ciudadela, Sáenz Peña y Villa Bosch no existen en esa capa.** Los pueblos donde
   vive esa gente no figuran: son *entidades*, y las entidades no se publican en el GeoNode.
3. No es un caso raro. Pasa en **28 partidos del Gran Buenos Aires**, todos marcados `tlc=2`,
   componente de aglomerado: ahí la unidad del INDEC es el partido, no el pueblo.

Se agrega además la divergencia con BAHRA —3.528 localidades contra 4.023 localidades censales,
y CABA como una sola localidad contra las 15 comunas del INDEC—, y la definición oficial citada.
El párrafo uno («no es lo que en la conversación diaria se llama localidad») y el dos (el caso
Avellaneda) quedan: son correctos.

**`via-de-circulacion` — la descripción pasa a ser advertencia.**

Hoy describe que la capa lista tramos. Tiene que advertirlo, que es lo que pediste: una misma
calle aparece tantas veces como tramos tenga, y nada en la tabla lo señala porque las filas son
idénticas salvo un `id` interno. Se suman los dos datos verificados que terminan de decir para
qué **no** sirve esta capa: **20.613 tramos se llaman literalmente `CALLE SN`**, y sólo **97.073
de 477.588 (20,3 %)** traen alguna altura. No es un nomenclador de direcciones.

**`radio-censal` y `localidad-censal` — urbano/rural, y un bug que salió al escribirlo.**

Entra lo que el Marco Geoestadístico define, y con ello la consecuencia que contesta el punto:
**una localidad censal no delimita lo urbano.** El MGN llama zona rural a todo lo que queda
entre el perímetro de la localidad censal y el límite del departamento, así que la línea es
administrativa, no descriptiva.

Y el radio tiene **tres** tipos, no dos: urbano, rural o mixto. Eso destapó un defecto del
sitio: `columns.js` mapea `U` y `R` y deja pasar cualquier otra cosa, así que los **2.683**
radios mixtos medidos muestran hoy una `M` cruda en la tabla. Escribir una nota que explique una
columna que muestra un código sin traducir sería hacerla mentir sobre la tabla que explica, así
que el mapeo se arregla junto con la nota. Los 26 radios que no traen tipo siguen pasando sin
traducir: es un dato que falta, no un rótulo que inventar (DES-R8).

**`gobierno-local` — la divergencia entre organismos.**

Entra: el IGN publica 2.114 municipios donde el INDEC publica 2.282 gobiernos locales, y BAHRA
3.528 localidades donde el INDEC publica 4.023 localidades censales; los dos coinciden en 529
departamentos. Dos organismos oficiales, números distintos, ninguno equivocado: cuentan cosas
distintas con la misma palabra.

**`departamento` — de dónde salen esos límites.**

Una línea: los límites que publica el INDEC son los de las direcciones provinciales de
estadística, no los del IGN ni los de la ley. Es el mismo dato que el pie ahora dice bien, y acá
tiene el contexto que en el pie no entra.

**`jurisdiccion`, `fraccion-censal`, `aglomerado` — sin cambios de fondo.** Sus afirmaciones se
verificaron y siguen en pie.

## 3. Tests

Todo lo de la sección 2.2 es verificable sin red, contra `public/catalog.json`, así que **el
hallazgo nuevo queda bajo el gate automático** igual que los totales de hoy:

- **`notes.test.js`**: que ninguna localidad censal de Buenos Aires se llame Caseros, Ciudadela,
  Sáenz Peña ni Villa Bosch; que el partido `06840` tenga exactamente una; que sean 28 los
  partidos con una sola localidad censal homónima y componente de aglomerado. Si el INDEC
  regenera el catálogo y esto cambia, la suite se pone roja antes que la nota mienta.
- **NOTA-R2, mitad nueva**: test estructural de que todo párrafo que nombra una fuente externa
  lleva su enlace. No verifica que la cita sea cierta —no puede—, sólo que no haya afirmación
  externa huérfana.
- **`shell.test.mjs`**: que el descargo esté en las cuatro páginas; que el bloque institucional
  no esté en ninguna; que ningún `<title>` termine en `— INDEC`.
- Los tests que hoy afirman el pie institucional (`shell.test.mjs`, `style.test.js`,
  `servicios.test.js`) hay que actualizarlos: buscan texto que va a dejar de existir.

## 4. Reglas

| Regla | Qué le pasa |
|---|---|
| **SITIO-R9** | nueva — el sitio dice que no es del INDEC |
| **NOTA-R2** | ampliada — se admite fuente externa citada, sin gate, con la asimetría escrita |
| NOTA-R1, NOTA-R3 | sin cambios |
| SITIO-R5, SITIO-R6 | sin cambios |

`docs/reglas/README.md` se actualiza a mano: este repo no tiene generador de índice ni gate de
citas.
