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
el párrafo viejo no pasa. Las dos notas que se mudaron intactas no afirman su total en prosa
—`/notas/` ya lo muestra como dato— y están exceptuadas por nombre; si alguna vez lo afirman,
la excepción se cae sola.

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
