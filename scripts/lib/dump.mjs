/**
 * Integridad de los volcados del GeoServer: que lo que se lee en disco
 * sea el volcado entero y no un pedazo.
 */

/**
 * Piso de filas por volcado. El guard de objetos totales no ve un volcado
 * hijo truncado —los conteos de hijos salen de capas distintas que los
 * objetos—, así que un corte por `maxFeatures` del lado del servidor
 * pasaría derecho y commitearía conteos mal.
 *
 * Es un piso, no el número exacto: atrapa un truncamiento grosero, no uno
 * del 2%. Contra el write de caché interrumpido no hace falta que llegue:
 * `fetchCsv` escribe con temp + rename y no deja archivos a medio escribir.
 */
export function assertMinRows(rows, minRows) {
  for (const [key, min] of Object.entries(minRows)) {
    const dump = rows[key]
    if (!dump) throw new Error(`falta el volcado \`${key}\`, que tiene piso declarado. Abortando.`)
    if (dump.length < min) {
      throw new Error(`volcado \`${key}\` truncado: ${dump.length} filas, mínimo esperado ${min}. Abortando.`)
    }
  }
}
