/** Orden en que se muestran las capas hijas, independientemente del JSON. */
const CHILD_ORDER = ['departamentos', 'fracciones', 'radios', 'localidades', 'vias']

/** Carga el catálogo generado en build. Una sola vez por sesión. */
export async function loadCatalog(url = `${import.meta.env.BASE_URL}catalog.json`) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`no se pudo cargar el catálogo: HTTP ${res.status}`)
  return res.json()
}

/** Busca un objeto por tipo y código. */
export function findByCode(catalog, t, c) {
  return catalog.objects.find((o) => o.t === t && o.c === c)
}

/** Hijos de un objeto, en orden estable y con su conteo. */
export function childrenOf(obj) {
  if (!obj?.ch) return []
  return CHILD_ORDER
    .filter((key) => key in obj.ch)
    .map((key) => ({ key, count: obj.ch[key] }))
}
