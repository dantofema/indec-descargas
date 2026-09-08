/**
 * Una nota por objeto del Marco Geoestadístico. Viven acá y no en el HTML
 * de /notas/ porque los tests tienen que poder citarlas y porque los
 * números que afirman se comparan contra el catálogo (NOTA-R2).
 *
 * `type` es la clave de TYPES cuando el objeto se puede buscar; `layer` la
 * de CHILD_LAYERS cuando además se puede recorrer como hija. Departamento y
 * localidad censal son las dos cosas a la vez.
 *
 * `total` va aparte de `paragraphs` a propósito: así las dos notas que ya
 * existían se mudaron sin tocarles una coma.
 *
 * `sources` es la mitad nueva de NOTA-R2: una nota puede afirmar algo que
 * no sale del catálogo ni del GeoServer si nombra la fuente en el texto y
 * deja el enlace a la vista. Esa mitad no tiene gate que valga: ninguna
 * máquina compara prosa castellana con un PDF de la UBA. Lo único que la
 * suite puede acorralar es que no haya afirmación externa huérfana —cada
 * `label` tiene que aparecer literal en algún párrafo—, y eso es lo que
 * hace.
 */
export const NOTES = [
  {
    slug: 'jurisdiccion',
    label: 'Jurisdicción',
    type: 'jur',
    layer: null,
    total: 24,
    paragraphs: [
      'El INDEC llama jurisdicción a lo que en la conversación diaria es una provincia. Son 24: las 23 provincias y la Ciudad Autónoma de Buenos Aires, que no es una provincia pero sí una unidad del mismo nivel para el Marco Geoestadístico.',
      'Es el único objeto que contiene las cinco capas hijas —departamentos, fracciones, radios, localidades y vías— y también el filtro más caro que se le puede pedir al GeoServer: una página de 20 vías filtrada por provincia tarda entre 88 y 99 segundos medidos.',
      'Se descarga por el campo cpr.',
    ],
  },
  {
    slug: 'departamento',
    label: 'Departamento',
    type: 'dep',
    layer: 'departamentos',
    total: 529,
    paragraphs: [
      'Son 529 en el país, y el nombre cambia según dónde estés parado: en la Ciudad Autónoma de Buenos Aires son las 15 comunas y en la provincia de Buenos Aires, los 135 partidos. El INDEC los publica a todos en la misma capa, con el mismo campo cde.',
      'Contiene fracciones, radios, localidades y vías, así que es el nivel más cómodo para bajar la cadena censal completa de una zona sin pedir una provincia entera.',
      'Los códigos de departamento no cierran entre capas: hay 529 en departamentos, 530 en radios y 527 en vías. Este sitio reporta esas inconsistencias cuando regenera el catálogo y no las corrige, porque corregirlas sería inventar un dato que el INDEC no publicó.',
      'Que se llame partido, departamento o comuna no es costumbre local: lo fija el Marco Geoestadístico, que define al departamento como la división político-administrativa de segundo nivel y aclara que «se denomina partido en la provincia de Buenos Aires, departamento en el resto de las provincias y comuna en la Ciudad Autónoma de Buenos Aires».',
    ],
    sources: [
      { label: 'Marco Geoestadístico', href: 'https://www.indec.gob.ar/ftp/cuadros/geoestadistica/marco_geoestadistico_nacional.pdf' },
    ],
  },
  {
    slug: 'fraccion-censal',
    label: 'Fracción censal',
    type: null,
    layer: 'fracciones',
    total: 6571,
    paragraphs: [
      'Son 6.571 y no tienen nombre: el Marco Geoestadístico publica un número de fracción y un código, nada más. Este sitio no les inventa un rótulo, así que la tabla muestra número y código.',
      'Es el nivel intermedio entre el departamento y el radio: cada radio censal lleva el número de la fracción que lo contiene.',
      'No se puede buscar por nombre porque no lo tiene: se llega a las fracciones desde el objeto que las contiene. Se descarga por cod_indec.',
    ],
  },
  {
    slug: 'radio-censal',
    label: 'Radio censal',
    type: null,
    layer: 'radios',
    total: 66515,
    paragraphs: [
      'Son 66.515 y es la unidad más chica del Marco Geoestadístico. Tampoco tiene nombre: número de radio, número de la fracción que lo contiene, si es urbano o rural, y su código.',
      'Es una capa grande pero rápida: los 23.901 radios de la provincia de Buenos Aires bajan en 22 MB y 6,9 segundos medidos, y el archivo llega completo. No hay tope de descarga.',
      'Se llega a los radios desde el objeto que los contiene, y se descarga por cod_indec.',
    ],
  },
  {
    slug: 'localidad-censal',
    label: 'Localidad censal',
    type: 'loc',
    layer: 'localidades',
    total: 4023,
    paragraphs: [
      '«Localidad censal» no es lo que en la conversación diaria se llama localidad. Es una unidad del Marco Geoestadístico y a menudo no coincide con el municipio ni con el partido del mismo nombre.',
      'El Marco Geoestadístico la define por continuidad física: una concentración de edificaciones conectadas entre sí por vías de circulación. No la define una ley, ni un límite municipal, ni quién cobra los impuestos ahí.',
      'Buscando Avellaneda, el INDEC publica tres objetos distintos con el mismo nombre y límites diferentes: «Partido de Avellaneda» (departamento, 06035), «Municipio Avellaneda» (gobierno local, 060035) y «Localidad Avellaneda» (localidad censal, 06035010, dentro del aglomerado Gran Buenos Aires). Quien dice «la localidad de Avellaneda» casi siempre se refiere al partido o al municipio.',
      'El caso que más engaña es el contrario, y conviene mirarlo despacio. El partido de Tres de Febrero tiene una sola localidad censal, la 06840010, y abarca el partido entero: el INDEC la publica con el nombre «Localidad Tres de Febrero», que no usa nadie. Caseros, Ciudadela, Sáenz Peña y Villa Bosch —los pueblos donde vive esa gente— no existen en esta capa. Son entidades, y las entidades no se publican acá. Pasa en 28 partidos del Gran Buenos Aires, todos marcados como componente de aglomerado: ahí la unidad del INDEC es el partido, no el pueblo.',
      'Tampoco es la única forma oficial de contar localidades. El IGN publica 3.528 localidades —las de BAHRA, la base de asentamientos que mantiene junto al INDEC— donde esta capa publica 4.023 localidades censales, y cuenta a la Ciudad Autónoma de Buenos Aires como una sola localidad donde el INDEC la parte en quince, una por comuna.',
      'Y una localidad censal no delimita lo urbano. El Marco Geoestadístico llama zona rural al «área comprendida entre el perímetro de la localidad censal y el límite del departamento», así que todo lo que queda afuera es rural por definición, haya lo que haya ahí. Adentro tampoco es todo urbano: el propio INDEC clasifica cada radio censal en urbano, rural o mixto.',
    ],
    sources: [
      { label: 'Marco Geoestadístico', href: 'https://www.indec.gob.ar/ftp/cuadros/geoestadistica/marco_geoestadistico_nacional.pdf' },
      { label: 'IGN', href: 'https://www.ign.gob.ar/ut/' },
    ],
  },
  {
    slug: 'gobierno-local',
    label: 'Gobierno local',
    type: 'gl',
    layer: null,
    total: 2282,
    paragraphs: [
      'Son 2.282 y son la excepción del sitio: no ofrecen ninguna capa hija. No es una omisión. Ni los radios ni las fracciones llevan el campo cmu que identifica al gobierno local, así que lo único que podrían ofrecer son las vías; y el gobierno local está fuera de la cadena censal —no tiene cde—, así que una sola capa suelta ahí no se explica.',
      'Un mismo nombre puede ser gobierno local, departamento y localidad censal a la vez, con tres límites distintos, y no es una rareza: 271 nombres del catálogo existen como los tres. Avellaneda es el caso que más confunde: «Municipio Avellaneda» (060035), «Partido de Avellaneda» (06035) y «Localidad Avellaneda» (06035010) son tres objetos con límites diferentes. Por eso cada resultado del buscador muestra de qué tipo es, que es lo que decide qué límites vas a bajar.',
      'Se descarga por cmu.',
    ],
  },
  {
    slug: 'aglomerado',
    label: 'Aglomerado',
    type: 'aglo',
    layer: null,
    total: 119,
    paragraphs: [
      'Son 119 y es el único objeto del Marco que no respeta los límites administrativos: 14 de ellos cruzan más de una provincia. El Gran Buenos Aires abarca la provincia de Buenos Aires y la Ciudad Autónoma, con 64 localidades censales y 112.152 vías.',
      'Contiene localidades censales y vías, pero no radios ni fracciones: esas capas no llevan el campo codaglo, así que no hay filtro que las recorte por aglomerado.',
      'Se descarga por codaglo.',
    ],
  },
  {
    slug: 'via-de-circulacion',
    label: 'Vía de circulación',
    type: null,
    layer: 'vias',
    total: 477588,
    paragraphs: [
      'Esta capa no lista calles: lista tramos. Una misma calle aparece tantas veces como tramos tenga su geometría, y todos comparten nombre, código y altura. En Tres de Febrero, las 1.487 filas son 727 calles; la más partida llega a 80 tramos.',
      'Se muestra tal como lo publica el INDEC, sin agrupar, para que lo que ves acá sea lo mismo que baja el archivo. Descargar en cualquier fila de una calle trae la calle entera, con todos sus tramos: el filtro es por código, no por tramo.',
    ],
  },
]

export const NOTE_BY_TYPE = {
  jur: 'jurisdiccion',
  dep: 'departamento',
  loc: 'localidad-censal',
  gl: 'gobierno-local',
  aglo: 'aglomerado',
}

export const NOTE_BY_LAYER = {
  departamentos: 'departamento',
  fracciones: 'fraccion-censal',
  radios: 'radio-censal',
  localidades: 'localidad-censal',
  vias: 'via-de-circulacion',
}

export const noteFor = (slug) => NOTES.find((n) => n.slug === slug)

/** El ancla de una nota en su página. La ficha enlaza acá (NOTA-R3). */
export const noteHref = (slug) => `${import.meta.env.BASE_URL}notas/#${slug}`
