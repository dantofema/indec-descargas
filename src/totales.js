/** Los totales del home. 300 bytes: se piden antes que el catálogo. */
export async function loadTotales(url = `${import.meta.env.BASE_URL}totales.json`) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`no se pudieron cargar los totales: HTTP ${res.status}`)
  return res.json()
}
