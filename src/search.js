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
 * Busca por substring sobre la clave normalizada `s`, que ya viene
 * calculada del build. Devuelve primero los que empiezan con la consulta.
 */
export function search(objects, query, limit = 20) {
  const q = normalize(query)
  if (q.length < 2) return []

  const matches = []
  for (const obj of objects) {
    const at = obj.s.indexOf(q)
    if (at === -1) continue
    matches.push({ obj, prefix: at === 0 ? 0 : 1 })
  }

  matches.sort((a, b) => {
    if (a.prefix !== b.prefix) return a.prefix - b.prefix
    const ta = TYPE_ORDER.indexOf(a.obj.t)
    const tb = TYPE_ORDER.indexOf(b.obj.t)
    if (ta !== tb) return ta - tb
    return a.obj.s.localeCompare(b.obj.s)
  })

  return matches.slice(0, limit).map((m) => m.obj)
}
