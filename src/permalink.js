import { TYPES, CHILD_LAYERS, isCode } from './download.js'

/**
 * La URL de /resultados/ es el estado entero: no hay nada que recordar
 * fuera de ella. Este módulo es el único que conoce los nombres de los
 * parámetros; el resto del sitio pide `parse` y `format`.
 *
 * Valida sintaxis, no existencia: acá no está el catálogo, así que "este
 * código no es de ningún objeto" y "esta capa no la tiene este objeto" los
 * decide quien sí lo tiene (pages/resultados.js).
 */
export function parse(search) {
  const p = new URLSearchParams(search)
  const t = p.get('t')
  const c = p.get('c')

  if (t === null && c === null) return { estado: 'vacio' }
  if (t === null || c === null) {
    return { estado: 'invalido', motivo: 'faltan el tipo o el código del objeto en el enlace' }
  }
  if (!Object.hasOwn(TYPES, t)) {
    return { estado: 'invalido', motivo: `tipo de objeto desconocido en el enlace: ${t}` }
  }
  // El código es lo único que se interpola dentro del CQL_FILTER: entra por
  // la misma puerta que `assertCode`, pero sin explotar, porque un enlace
  // mal copiado no es un error de programa.
  if (!isCode(c)) {
    return { estado: 'invalido', motivo: `el código del enlace no son dígitos: ${c}` }
  }

  // Una capa que no existe se ignora en vez de invalidar el enlace: el
  // objeto sigue siendo mostrable y abrir su primera pestaña es una
  // respuesta mejor que un error.
  const capa = p.get('capa')
  return { estado: 'ok', t, c, capa: capa && Object.hasOwn(CHILD_LAYERS, capa) ? capa : null }
}

/** El enlace permanente de un objeto, opcionalmente con su capa abierta. */
export function format(obj, capa = null) {
  const p = new URLSearchParams({ t: obj.t, c: obj.c })
  if (capa) p.set('capa', capa)
  return `${import.meta.env.BASE_URL}resultados/?${p}`
}
