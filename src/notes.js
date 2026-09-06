import { nonEmptyChildrenOf } from './catalog.js'

/**
 * Aclaraciones sobre la cartografía del INDEC, atadas a la capa donde
 * confunden. Viven acá y no en el HTML porque son contenido que va a crecer
 * y porque un test tiene que poder citarlas.
 *
 * Los datos de la nota de localidades están verificados contra el GeoServer:
 * las tres Avellaneda existen, con el mismo `nam` y `fna` distinto.
 */
export const NOTES = [
  {
    key: 'vias',
    label: 'Vías de circulación',
    paragraphs: [
      'Esta capa no lista calles: lista tramos. Una misma calle aparece tantas veces como tramos tenga su geometría, y todos comparten nombre, código y altura. En Tres de Febrero, las 1.487 filas son 727 calles; la más partida llega a 80 tramos.',
      'Se muestra tal como lo publica el INDEC, sin agrupar, para que lo que ves acá sea lo mismo que baja el archivo. Descargar en cualquier fila de una calle trae la calle entera, con todos sus tramos: el filtro es por código, no por tramo.',
    ],
  },
  {
    key: 'localidades',
    label: 'Localidad censal',
    paragraphs: [
      '«Localidad censal» no es lo que en la conversación diaria se llama localidad. Es una unidad del Marco Geoestadístico y a menudo no coincide con el municipio ni con el partido del mismo nombre.',
      'Buscando Avellaneda, el INDEC publica tres objetos distintos con el mismo nombre y límites diferentes: «Partido de Avellaneda» (departamento, 06035), «Municipio Avellaneda» (gobierno local, 060035) y «Localidad Avellaneda» (localidad censal, 06035010, dentro del aglomerado Gran Buenos Aires). Quien dice «la localidad de Avellaneda» casi siempre se refiere al partido o al municipio.',
      'Al revés también pasa: Tres de Febrero sí existe como localidad censal, además de como partido y como municipio. Por eso cada resultado del buscador muestra su tipo al lado: es lo que decide qué límites vas a bajar.',
    ],
  },
]

/**
 * Las notas que le corresponden a un objeto, por las capas que tiene con
 * objetos adentro: una capa en cero no se anota, porque la nota explica una
 * trampa de algo que este objeto no tiene (ver `nonEmptyChildrenOf`).
 */
export function notesFor(obj) {
  const keys = new Set(nonEmptyChildrenOf(obj).map((c) => c.key))
  return NOTES.filter((n) => keys.has(n.key))
}
