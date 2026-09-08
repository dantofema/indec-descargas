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

  if (t === null && c === null) return { status: 'empty' }
  if (t === null || c === null) {
    return { status: 'invalid', reason: 'faltan el tipo o el código del objeto en el enlace' }
  }
  if (!Object.hasOwn(TYPES, t)) {
    return { status: 'invalid', reason: `tipo de objeto desconocido en el enlace: ${t}` }
  }
  // El código es lo único que se interpola dentro del CQL_FILTER: entra por
  // la misma puerta que `assertCode`, pero sin explotar, porque un enlace
  // mal copiado no es un error de programa.
  if (!isCode(c)) {
    return { status: 'invalid', reason: `el código del enlace no son dígitos: ${c}` }
  }
  // El largo es lo único que separa una fracción de un radio: los dos son
  // `cod_indec` de la misma forma. Sin esta guarda, `?t=rad&c=0684042` sale
  // a pedirle al GeoServer un radio de siete dígitos, que no puede existir,
  // y el usuario ve un error de red donde hay un enlace mal escrito.
  if (c.length !== TYPES[t].len) {
    return {
      status: 'invalid',
      reason: `el código ${c} no tiene el largo de ${TYPES[t].label.toLowerCase()}: son ${TYPES[t].len} dígitos`,
    }
  }

  // Una capa que no existe se ignora en vez de invalidar el enlace: el
  // objeto sigue siendo mostrable y abrir su primera pestaña es una
  // respuesta mejor que un error.
  //
  // `layerRequested` va aparte porque `layer: null` mezcla dos cosas que la
  // página necesita distinguir: "el enlace no nombró capa" —y entonces la
  // pestaña que se abre sola no se escribe en la barra— y "nombró una que
  // no existe" —y entonces la barra ya afirmó algo falso, así que hay que
  // reescribirla con la que se abrió en su lugar—. Las claves de la URL no
  // cambian: esto es del objeto que devuelve `parse`, no del cable.
  const layer = p.get('capa')
  return {
    status: 'ok',
    type: t,
    code: c,
    layer: layer && Object.hasOwn(CHILD_LAYERS, layer) ? layer : null,
    layerRequested: p.has('capa'),
  }
}

/**
 * El enlace permanente de un objeto, opcionalmente con su capa abierta.
 * La clave de la URL sigue siendo `capa` —es formato de cable, parte del
 * spec y visible en el enlace que alguien comparte—; lo que cambia de
 * nombre acá es sólo el parámetro de la función.
 */
export function format(obj, layer = null) {
  const p = new URLSearchParams({ t: obj.t, c: obj.c })
  if (layer) p.set('capa', layer)
  return `${import.meta.env.BASE_URL}resultados/?${p}`
}
