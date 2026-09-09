# Notas

Decisiones de producto sobre las notas que explican cada objeto del Marco Geoestadístico
Nacional.

## ✅ Reglas

### NOTA-R1 — Hay una nota por objeto del Marco, ocho, cada una con ancla propia

Jurisdicción, departamento, fracción censal, radio censal, localidad censal, gobierno local,
aglomerado y vía de circulación: una nota por cada uno, en `/notas/#<ancla>`.

**Por qué:** los ocho objetos se confunden entre sí —un mismo nombre puede ser departamento,
gobierno local y localidad censal a la vez, con tres límites distintos— y el buscador ya obliga
a elegir cuál se quiere de entrada. La página de notas es donde se explica la diferencia una
sola vez, en vez de que cada ficha la repita a su manera.

### NOTA-R2 — Una nota afirma sólo lo verificable contra el catálogo o el GeoServer

Los totales que una nota declara se comparan con `public/catalog.json` en la suite: un número
que se desvía del catálogo pone la suite roja. Vale para el dato y para la prosa: la nota que
repite su total escribiéndolo con letras también se compara, así que corregir el campo y dejar
el párrafo viejo no pasa. Las ocho notas afirman su total en prosa; no hay exceptuadas.

Una nota puede además afirmar algo que no sale del catálogo ni del GeoServer, **si nombra la
fuente en el texto y deja el enlace a la vista** (`sources` en `notes.js`, dibujado bajo la nota).
Esa mitad de la regla no tiene gate: ninguna máquina compara prosa castellana con un PDF de la
UBA. Lo sostiene una afirmación humana, y por eso la nota tiene que decir de quién es el dato en
vez de absorberlo como si fuera propio. Lo único que la suite acorrala es que no quede una
afirmación externa huérfana: cada fuente declarada tiene que estar nombrada en algún párrafo.

Lo comparable contra `public/catalog.json` se recalcula en cada corrida de la suite: si el
catálogo cambia, el número viejo de la prosa se pone rojo solo. Lo que sale de medir contra el
GeoServer del INDEC —cuántos tramos no tienen altura, cuántos radios son mixtos, cuánto tarda una
descarga— no se vuelve a medir en cada corrida: ningún test le habla al GeoServer. Ese número
queda *fijado* como literal el día que se midió, tanto en la nota como en el test que lo cita, así
que la suite verifica que los dos literales sigan coincidiendo —protege contra un tipeo o una
edición a medias—, no que el GeoServer siga contestando lo mismo hoy.

**Por qué:** una nota es la voz del sitio sobre datos ajenos, no la opinión del sitio sobre sí
mismo. Un número inventado ahí es peor que no tener nota: el sitio no tiene forma de saber si
alguien lo tomó por cierto antes de que se corrigiera.

### NOTA-R3 — Las notas viven en `/notas/`; la ficha enlaza, no repite

La ficha de `/resultados/` lleva un enlace a la nota del tipo del objeto, y cada pestaña de capa
hija lleva su propio enlace a la nota de esa capa. Ninguno de los dos repite el texto de la
nota.

**Por qué:** dos superficies con el mismo texto compiten por ser la buena y divergen con el
tiempo, hasta que una de las dos miente. La ficha enlaza en contexto —la nota del tipo del
objeto, la de la capa de cada pestaña— en vez de cargar su propia copia.

Reemplaza a `NAV-R6` de `navegacion.md`: la fila de notas que vivía en la ficha dejó de existir,
y esta regla es la que explica qué la reemplazó.
