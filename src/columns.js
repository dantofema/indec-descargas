/**
 * Qué mostrar de cada capa hija, cómo ordenarla y qué campo identifica una
 * fila para poder descargarla sola.
 *
 * Fracciones y radios no traen nombre en el Marco Geoestadístico: se
 * identifican por número y por su código. No se les inventa un rótulo.
 *
 * `titleField` es el campo con el nombre publicado, cuando existe: la ficha
 * de una fila (NAV-R10) lo usa como título en vez de "<capa> <código>". Sólo
 * lo declaran las capas con nombre publicado —nunca fracciones ni radios—.
 */

// El Marco Geoestadístico clasifica el radio en urbano, rural o mixto: son
// tres, no dos. Los 2.683 mixtos medidos mostraban una "M" cruda en la
// tabla. Cualquier otro valor pasa sin traducir —el INDEC no documentó un
// cuarto, y los 26 radios que no traen ninguno son un dato que falta, no un
// rótulo que inventar (DES-R8)—.
const urbanoRural = (v) => (v === 'U' ? 'Urbano' : v === 'R' ? 'Rural' : v === 'M' ? 'Mixto' : v)

/** Las vías se muestran con los 21 campos publicados, en el orden del GeoServer. */
const VIA_FIELDS = [
  'id', 'cpr', 'jur', 'cde', 'dpto', 'cmu', 'gobloc', 'clc', 'localidad',
  'codaglo', 'aglomerado', 'cvc', 'fna', 'gna', 'subtipo',
  'desdei', 'desded', 'hastai', 'hastad', 'cod_indec', 'sag',
]
const NUMERIC_VIA_FIELDS = new Set(['id', 'desdei', 'desded', 'hastai', 'hastad'])
const CODE_VIA_FIELDS = new Set(['cpr', 'cde', 'cmu', 'clc', 'codaglo', 'cvc', 'cod_indec'])

export const LAYER_SPECS = {
  departamentos: {
    sortBy: 'cde',
    idField: 'cde',
    // El Marco publica nombre para esta capa: la ficha lo usa como título
    // de la fila en vez de inventar "Departamento <código>" (NAV-R10).
    titleField: 'nam',
    columns: [
      { field: 'nam', label: 'Nombre', kind: 'text' },
      { field: 'cde', label: 'Código', kind: 'code' },
    ],
  },
  fracciones: {
    sortBy: 'cod_indec',
    idField: 'cod_indec',
    // Sin titleField: el Marco no publica nombre para fracciones (NAV-R4).
    columns: [
      { field: 'cfn', label: 'Fracción', kind: 'num' },
      { field: 'cod_indec', label: 'Código', kind: 'code' },
    ],
  },
  radios: {
    sortBy: 'cod_indec',
    idField: 'cod_indec',
    // Sin titleField: el Marco no publica nombre para radios (NAV-R4).
    columns: [
      { field: 'cro', label: 'Radio', kind: 'num' },
      { field: 'cfn', label: 'Fracción', kind: 'num' },
      { field: 'tro', label: 'Tipo', kind: 'text', map: urbanoRural },
      { field: 'cod_indec', label: 'Código', kind: 'code' },
    ],
  },
  localidades: {
    sortBy: 'clc',
    idField: 'clc',
    titleField: 'nam',
    columns: [
      { field: 'nam', label: 'Nombre', kind: 'text' },
      { field: 'gna', label: 'Tipo', kind: 'text' },
      { field: 'aglomerado', label: 'Aglomerado', kind: 'text' },
      { field: 'clc', label: 'Código', kind: 'code' },
    ],
  },
  vias: {
    // `cod_indec` se repite —una calle se parte en hasta 80 tramos—, así que
    // sin desempate el paginado podría repetir o saltear filas entre páginas.
    sortBy: 'cod_indec,id',
    idField: 'cod_indec',
    titleField: 'fna',
    // Única capa con 21 columnas: la tabla necesita scroll horizontal.
    // Lo declara la capa, no lo adivina table.js contando.
    wide: true,
    // Qué columna queda fija (`position: sticky`) al scrollear. No es la
    // primera del orden publicado —`id`, un número interno que no identifica
    // nada para quien mira— sino `fna`, el nombre de la calle: es lo único
    // que hace falta seguir viendo mientras el resto pasa por detrás. Al no
    // ser la posición 0 del array, no se ve al abrir la tabla —queda fuera
    // de pantalla a la derecha, como cualquier columna 13 de 21— y recién se
    // ancla al borde izquierdo cuando el scroll la alcanza: es el
    // comportamiento buscado, no un defecto. Ninguna otra capa lo declara,
    // así que ninguna otra congela nada (table.js y style.css lo leen como
    // opcional).
    anchorField: 'fna',
    columns: VIA_FIELDS.map((field) => ({
      field,
      label: field,
      kind: NUMERIC_VIA_FIELDS.has(field) ? 'num' : CODE_VIA_FIELDS.has(field) ? 'code' : 'text',
    })),
  },
}

/** La especificación de una capa hija. Tira si no existe. */
export function specOf(childKey) {
  const spec = LAYER_SPECS[childKey]
  if (!spec) throw new Error(`capa hija sin columnas declaradas: ${JSON.stringify(childKey)}`)
  return spec
}

/**
 * Campos que hay que pedirle al GeoServer: los que se muestran, el que
 * identifica la fila y los del orden. La geometría no entra: la tabla no la
 * usa y es lo que pesa.
 */
export function queryFields(childKey) {
  const spec = specOf(childKey)
  return [...new Set([
    ...spec.columns.map((c) => c.field),
    spec.idField,
    ...spec.sortBy.split(','),
  ])]
}
