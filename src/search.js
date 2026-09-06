/** Orden de presentación de los tipos de objeto en los resultados. */
export const TYPE_ORDER = ['jur', 'dep', 'loc', 'gl', 'aglo']

/**
 * Pasa un texto a la forma con la que se comparan nombres:
 * minúsculas, sin acentos, con los espacios colapsados.
 */
export function normalize(text) {
  if (!text) return ''
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Nivel de coincidencia de un objeto, del match más literal al más laxo,
 * o `null` si no coincide. Los términos se buscan sueltos y todos tienen
 * que estar, pero al menos uno tiene que caer en el nombre: si la
 * provincia pudiera matchear sola, "buenos aires" devolvería los miles de
 * objetos que hay adentro en vez de los que se llaman así.
 */
function rankOf(obj, query, terms) {
  const name = obj.s
  const prov = obj.sp || ''

  const at = name.indexOf(query)
  if (at === 0) return 0
  if (at > 0) return 1

  let inName = 0
  let inProv = 0
  for (const term of terms) {
    if (name.includes(term)) inName += 1
    else if (prov.includes(term)) inProv += 1
    else return null
  }
  if (inName === 0) return null
  return inProv > 0 ? 3 : 2
}

/**
 * Busca sobre las claves normalizadas `s` (nombre) y `sp` (provincia),
 * opcionalmente acotada a un tipo de objeto. Devuelve los mejores
 * matches primero: consulta entera al principio del nombre, consulta
 * entera adentro, términos sueltos en el nombre, y por último los que
 * necesitaron la provincia.
 */
export function search(objects, query, { type = '', limit = 20 } = {}) {
  const q = normalize(query)
  if (q.length < 2) return []
  const terms = q.split(' ')

  const matches = []
  for (const obj of objects) {
    if (type && obj.t !== type) continue
    const rank = rankOf(obj, q, terms)
    if (rank === null) continue
    matches.push({ obj, rank })
  }

  matches.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    const ta = TYPE_ORDER.indexOf(a.obj.t)
    const tb = TYPE_ORDER.indexOf(b.obj.t)
    if (ta !== tb) return ta - tb
    return a.obj.s.localeCompare(b.obj.s)
  })

  return matches.slice(0, limit).map((m) => m.obj)
}
