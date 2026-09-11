# Reglas por superficie

Decisiones de producto de `indec-descargas`, numeradas y con estado. **Antes de tocar una de
estas superficies, leé su archivo.** Cambiar el comportamiento sin cambiar la regla es hacer que
el documento mienta.

| Superficie | Reglas |
|---|---|
| [apariencia](apariencia.md) | APAR-R1 … APAR-R8 |
| [buscador](buscador.md) | BUS-R1 … BUS-R5 |
| [descargas](descargas.md) | DES-R1 … DES-R10 |
| [navegacion](navegacion.md) | NAV-R1 … NAV-R11 |
| [notas](notas.md) | NOTA-R1 … NOTA-R3 |
| [sitio](sitio.md) | SITIO-R1 … SITIO-R9 |

**Las cuatro tablas de abajo se generan.** No las edites a mano: cambiá la regla y corré
`node scripts/reglas-index.mjs`. El gate falla si quedaron viejas.

## ⏳ Esperan tu respuesta

Decisiones que el trabajo destapó y que no son del que las encontró. Se contestan **inline en el
documento**, no en un chat, y ahí se convierten en regla.

<!-- bloque:abiertas -->
| Pregunta | Superficie | De qué se trata |
|---|---|---|
| **DES-Q1** | [descargas](descargas.md) | Qué hace el sitio cuando alguien direcciona un objeto que no existe |
<!-- /bloque:abiertas -->

## 🔨 Decididas, sin construir

Lo que ya se decidió y espera turno.

<!-- bloque:sin-construir -->
Ninguna: todas las reglas vivas están construidas.
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
| **NAV-R3** | [navegacion](navegacion.md) | **DES-R9** | ✅ **implementada 2026-09-06** |
| **NAV-R6** | [navegacion](navegacion.md) | **NOTA-R3** | ✅ **implementada 2026-09-08** |
| **NAV-R6** | [navegacion](navegacion.md) | **DES-R7** | ✅ **implementada 2026-09-04** |
| **NAV-R7** | [navegacion](navegacion.md) | **SITIO-R3** | ✅ **implementada 2026-09-08** |
| **NAV-R9** | [navegacion](navegacion.md) | **DES-R3** | ✅ **implementada 2026-09-04** |
| **NAV-R11** | [navegacion](navegacion.md) | **SITIO-R2** | ✅ **implementada 2026-09-08** |
| **NOTA-R3** | [notas](notas.md) | **NAV-R6** | ☠️ **muerta 2026-09-06** |
| **SITIO-R2** | [sitio](sitio.md) | **NAV-R11** | ✅ **implementada 2026-09-08** |
| **SITIO-R3** | [sitio](sitio.md) | **NAV-R7** | ✅ **implementada 2026-09-06** |
| **SITIO-R3** | [sitio](sitio.md) | **NAV-R8** | ✅ **implementada 2026-09-06** |
| **SITIO-R8** | [sitio](sitio.md) | **APAR-R5** | ✅ **implementada 2026-09-09** |
<!-- /bloque:cruces -->

## 📏 Peso de las preguntas abiertas

Una pregunta que no entra en el presupuesto no se contesta: se parte.

<!-- bloque:complejidad -->
| Pregunta | Caracteres | Opciones | ¿Entra? |
|---|---|---|---|
| **DES-Q1** | 10668 / 4000 | 0 / 5 | ⚠️ **partir** |
<!-- /bloque:complejidad -->
