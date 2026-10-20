/**
 * MÓDULO GLOBAL DE FILTRO DE LENGUAJE Y PALABRAS PROHIBIDAS
 *
 * Este módulo contiene las funciones centralizadas para censurar palabras ofensivas
 * o no permitidas en las publicaciones, comentarios y secciones de la aplicación.
 */

// Lista general de palabras no permitidas / insultos en español
const PALABRAS_PROHIBIDAS = [
  'violador',
  'violadora',
  'violacion',
  'violaciones',
  'asesino',
  'asesina',
  'pedofilo',
  'pedofila',
  'mierda',
  'puto',
  'puta',
  'putos',
  'putas',
  'concha',
  'conchatumadre',
  'pelotudo',
  'pelotuda',
  'boludo',
  'boluda',
  'hdp',
  'hijodeputa',
  'hijadeputa',
  'maricon',
  'pajero',
  'pajera',
  'forro',
  'forra',
  'malnacido',
  'malnacida'
];

// Reglas específicas por sección (ej: en 'huellitas' no se permite la venta ni comercialización de animales)
const REGLAS_SECCION = {
  huellitas: ['vende', 'vendo', 'venta', 'ventas', 'precio', 'compro', 'comprar']
};

/**
 * Normaliza un texto removiendo tildes y caracteres especiales para análisis.
 */
function normalizarTexto(texto) {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Transforma una palabra censurada manteniendo sus dos primeras letras y reemplazando el resto con asteriscos.
 * Ejemplo: "violador" -> "vi*****"
 */
function enmascararPalabra(palabra) {
  if (!palabra || palabra.length <= 2) return palabra;
  const prefijo = palabra.substring(0, 2);
  const asteriscos = '*'.repeat(palabra.length - 2);
  return prefijo + asteriscos;
}

/**
 * Censura palabras prohibidas dentro de un texto dado.
 * @param {string} texto Texto a filtrar
 * @param {string} seccion Nombre opcional de la sección (ej: 'huellitas') para aplicar reglas adicionales
 * @returns {string} Texto con palabras prohibidas censuradas
 */
export function censurarTexto(texto, seccion = null) {
  if (!texto || typeof texto !== 'string') return texto;

  // Combinar lista general con reglas de sección si aplica
  let listaActual = [...PALABRAS_PROHIBIDAS];
  if (seccion && REGLAS_SECCION[seccion]) {
    listaActual = [...listaActual, ...REGLAS_SECCION[seccion]];
  }

  let textoFiltrado = texto;

  listaActual.forEach((palabraProhibida) => {
    // Regex con frontera de palabra \b para evitar falsos positivos
    const pattern = new RegExp(`\\b${palabraProhibida}\\b`, 'gi');
    textoFiltrado = textoFiltrado.replace(pattern, (match) => enmascararPalabra(match));
  });

  return textoFiltrado;
}

/**
 * Verifica si un texto contiene al menos una palabra prohibida.
 * @param {string} texto
 * @param {string} seccion
 * @returns {boolean}
 */
export function contieneMalasPalabras(texto, seccion = null) {
  if (!texto || typeof texto !== 'string') return false;

  let listaActual = [...PALABRAS_PROHIBIDAS];
  if (seccion && REGLAS_SECCION[seccion]) {
    listaActual = [...listaActual, ...REGLAS_SECCION[seccion]];
  }

  const textoNorm = normalizarTexto(texto);

  return listaActual.some((palabra) => {
    const pattern = new RegExp(`\\b${palabra}\\b`, 'i');
    return pattern.test(textoNorm);
  });
}

export default {
  censurarTexto,
  contieneMalasPalabras,
};
