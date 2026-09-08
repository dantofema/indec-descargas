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
  const capa = p.get('capa')
  const layer = capa && Object.hasOwn(CHILD_LAYERS, capa) ? capa : null

  // 1-based en la URL, 0-based adentro: el paginador dice "1–20 de 1.487", y
  // un enlace que dijera `pag=0` para la primera página sería un enlace que
  // no se puede leer. Sin capa abierta no hay tabla que paginar, así que la
  // página se ignora. Y una página inválida no invalida el enlace: el objeto
  // sigue siendo mostrable, que es la misma decisión que ya se tomó con una
  // capa que no existe.
  const pag = Number(p.get('pag'))
  const page = layer && Number.isInteger(pag) && pag > 0 ? pag - 1 : 0

  return {
    status: 'ok',
    type: t,
    code: c,
    layer,
    layerRequested: p.has('capa'),
    page,
  }
}

/**
 * El enlace permanente de un objeto, opcionalmente con su capa abierta.
 * La clave de la URL sigue siendo `capa` —es formato de cable, parte del
 * spec y visible en el enlace que alguien comparte—; lo que cambia de
 * nombre acá es sólo el parámetro de la función.
 */
export function format(obj, layer = null, page = 0) {
  const p = new URLSearchParams({ t: obj.t, c: obj.c })
  if (layer) p.set('capa', layer)
  // La primera página no se escribe, igual que no se escribe la pestaña que
  // se abre sola: la barra dice lo que hace falta y nada más.
  if (layer && page > 0) p.set('pag', String(page + 1))
  return `${import.meta.env.BASE_URL}resultados/?${p}`
}
