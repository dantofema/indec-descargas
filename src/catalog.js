import { normalize } from './search.js'

/** Orden en que se muestran las capas hijas, independientemente del JSON. */
const CHILD_ORDER = ['departamentos', 'fracciones', 'radios', 'localidades', 'vias']

/** Carga el catálogo generado en build. Una sola vez por sesión. */
export async function loadCatalog(url = `${import.meta.env.BASE_URL}catalog.json`) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`no se pudo cargar el catálogo: HTTP ${res.status}`)
  const catalog = await res.json()
  // `sp` es la clave con la que la búsqueda compara la provincia (BUS-R3).
  // Se deriva acá y no en el build: `p` ya viaja en el JSON, y precalcularla
  // le sumaría más de 100 KB al catálogo commiteado.
  for (const obj of catalog.objects) obj.sp = normalize(obj.p)
  return catalog
}

/** Hijos de un objeto, en orden estable y con su conteo. */
export function childrenOf(obj) {
  if (!obj?.ch) return []
  return CHILD_ORDER
    .filter((key) => key in obj.ch)
    .map((key) => ({ key, count: obj.ch[key] }))
}

/**
 * Los hijos que tienen algo adentro. El cero tiene dos lectores con
 * necesidades opuestas y por eso son dos preguntas y no una: la fila 2 lo
 * necesita para dibujar el botón muerto con su motivo (DES-R3), y las
 * filas 3 y 4 no tienen nada que ofrecer sobre una capa vacía —recorrerla
 * cuesta un pedido de 17 s que vuelve con `totalFeatures: 0`, y anotarla es
 * explicar la trampa de una capa que este objeto no tiene—.
 *
 * Vive acá y no repetido en cada consumidor para que los dos filtren por lo
 * mismo: si divergen, la ficha vuelve a contradecirse consigo misma.
 * Son 11 pares (objeto, capa) del catálogo, y los 11 caen en capas con nota.
 */
export function nonEmptyChildrenOf(obj) {
  return childrenOf(obj).filter(({ count }) => count > 0)
}
