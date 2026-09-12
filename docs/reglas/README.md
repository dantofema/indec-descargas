# Reglas por superficie

Decisiones de producto de `indec-descargas`, numeradas y con estado. **Antes de tocar una de
estas superficies, leé su archivo.** Cambiar el comportamiento sin cambiar la regla es hacer que
el documento mienta.

| Superficie | Reglas |
|---|---|
| [apariencia](apariencia.md) | APAR-R1 … APAR-R8 |
| [buscador](buscador.md) | BUS-R1 … BUS-R5 |
| [descargas](descargas.md) | DES-R1 … DES-R11 |
| [navegacion](navegacion.md) | NAV-R1 … NAV-R11 |
| [notas](notas.md) | NOTA-R1 … NOTA-R3 |
| [sitio](sitio.md) | SITIO-R1 … SITIO-R9 |

**Las cuatro tablas de abajo se generan.** No las edites a mano: cambiá la regla y corré
`node scripts/reglas-index.mjs`. El gate falla si quedaron viejas.

## ⏳ Esperan tu respuesta

Decisiones que el trabajo destapó y que no son del que las encontró.

**Dónde se contesta:** inline en el archivo, en la línea `> **Tu respuesta:**` de cada pregunta,
que va debajo de su tabla de opciones. No en un chat: una conclusión dicha al pasar se evapora y
al rato reaparece disfrazada de hecho adentro de un test.

Toda pregunta ofrece **sacar la cosa** como una de sus salidas, y toda pregunta entra en el
presupuesto de más abajo — la que no entra no se contesta, se parte.

<!-- bloque:abiertas -->
| Pregunta | Superficie | De qué se trata |
|---|---|---|
| **DES-Q2** | [descargas](descargas.md) | Quién decide qué tipos entran al catálogo, que hoy tres reglas describen y ninguna decide |
<!-- /bloque:abiertas -->

## 🔨 Decididas, sin construir

Lo que ya se decidió y espera turno.

<!-- bloque:sin-construir -->
| Regla | Superficie | Qué decide | Estado |
|---|---|---|---|
| **DES-R11** | [descargas](descargas.md) | El objeto direccionable que no está en el catálogo se ofrece igual, y la ficha dice la verdad cuando el pedido vuelve sin nada. | decidida, sin construir · #5 |
<!-- /bloque:sin-construir -->

## 🔗 Cruces entre superficies

Reglas que citan una regla de otra superficie. Una regla que cita a otra **hereda su destino**, y
el documento no lo dice en ninguna parte: sin esta tabla hay que leer las superficies enteras
para descubrirlo.

<!-- bloque:cruces -->
| Regla | Superficie | Cita a | Estado del destino |
|---|---|---|---|
| **APAR-R5** | [apariencia](apariencia.md) | **SITIO-R8** | ✅ **implementada 2026-09-08** |
| **BUS-R3** | [buscador](buscador.md) | **DES-R6** | ✅ **implementada 2026-09-04** |
| **BUS-R3** | [buscador](buscador.md) | **DES-R8** | ✅ **implementada 2026-09-04** |
| **BUS-R5** | [buscador](buscador.md) | **SITIO-R3** | ✅ **implementada 2026-09-08** |
| **BUS-R5** | [buscador](buscador.md) | **NAV-R4** | ✅ **implementada 2026-09-06** |
| **DES-R10** | [descargas](descargas.md) | **NAV-R4** | ✅ **implementada 2026-09-06** |
| **DES-R11** | [descargas](descargas.md) | **SITIO-R3** | ✅ **implementada 2026-09-08** |
| **NAV-R3** | [navegacion](navegacion.md) | **DES-R9** | ✅ **implementada 2026-09-06** |
| **NAV-R6** | [navegacion](navegacion.md) | **NOTA-R3** | ✅ **implementada 2026-09-08** |
| **NAV-R6** | [navegacion](navegacion.md) | **DES-R7** | ✅ **implementada 2026-09-04** |
| **NAV-R7** | [navegacion](navegacion.md) | **SITIO-R3** | ✅ **implementada 2026-09-08** |
| **NAV-R9** | [navegacion](navegacion.md) | **DES-R3** | ✅ **implementada 2026-09-04** |
| **NAV-R11** | [navegacion](navegacion.md) | **SITIO-R2** | ✅ **implementada 2026-09-08** |
| **NOTA-R2** | [notas](notas.md) | **DES-R6** | ✅ **implementada 2026-09-04** |
| **NOTA-R3** | [notas](notas.md) | **NAV-R6** | ☠️ **muerta 2026-09-06** |
| **SITIO-R2** | [sitio](sitio.md) | **NAV-R11** | ✅ **implementada 2026-09-08** |
| **SITIO-R3** | [sitio](sitio.md) | **NAV-R7** | ✅ **implementada 2026-09-06** |
| **SITIO-R3** | [sitio](sitio.md) | **NAV-R8** | ✅ **implementada 2026-09-06** |
| **SITIO-R6** | [sitio](sitio.md) | **DES-R6** | ✅ **implementada 2026-09-04** |
| **SITIO-R7** | [sitio](sitio.md) | **DES-R6** | ✅ **implementada 2026-09-04** |
| **SITIO-R8** | [sitio](sitio.md) | **APAR-R5** | ✅ **implementada 2026-09-09** |
<!-- /bloque:cruces -->

## 📏 Peso de las preguntas abiertas

Una pregunta que no entra en el presupuesto no se contesta: se parte.

<!-- bloque:complejidad -->
Presupuesto por pregunta: **≤ 250 palabras**, **≤ 3 opciones**, **0 fichas**, **≤ 3 IDs de reglas**.

| Dónde | # | Palabras | Opciones | Fichas | Cruces | |
| --- | --- | --- | --- | --- | --- | --- |
| [descargas](descargas.md) | DES-Q2 | 250 | 3 | 0 | 3 | ✅ |

**Ninguna se pasa.**
<!-- /bloque:complejidad -->
