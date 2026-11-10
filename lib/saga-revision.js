/**
 * Revisión de contenido de SAGA (QC): convierte lo que devuelve la API (GetProducts → ContentScore y
 * QCStatus; GetQcStatus → motivos) en una lista de motivos con categoría, como el apartado «Pendientes»
 * de Seller Center. Módulo de datos puros (sin dependencias): sirve en servidor y cliente.
 */

const CATEGORIAS_REVISION = [
  ["contenido", "Contenido"],
  ["precio", "Precio"],
  ["multimedia", "Multimedia"],
  ["compliance", "Compliance"],
  ["configuracion", "Configuración"],
  ["otros", "Otros"],
];
const PUNTAJE_MINIMO = 70;

const sinTildes = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Palabras clave → categoría (el primero que coincide gana; el orden va de lo más específico a lo general).
const REGLAS = [
  ["multimedia", /imagen|imagenes|foto|video|multimedia|resolucion|fondo blanco|marca de agua/],
  ["precio", /precio|price|oferta|descuento|costo/],
  ["compliance", /compliance|registro sanitario|sanitari|digemid|permiso|licencia|marca registrada|prohibid|restringid|cumplimiento|legal/],
  ["configuracion", /configuracion|operador|businessunit|cuenta|seller center|envio|logistic|almacen|bodega|politica/],
  ["contenido", /contenido|puntaje|atributo|titulo|nombre|descripcion|ficha|categoria|marca\b|calidad/],
];

/** Categoría de Seller Center a la que pertenece un motivo de revisión. */
function clasificarMotivo(texto) {
  const t = sinTildes(texto);
  const regla = REGLAS.find(([, re]) => re.test(t));
  return regla ? regla[0] : "otros";
}

const CLAVE_MOTIVO = /reason|message|comment|detail|failure|error|motivo|descripcion|remark|issue/i;

/** Textos de motivos dentro de una respuesta de SAGA de forma desconocida (busca por nombre de campo). */
function textosDe(valor, clave = "", salida = []) {
  if (valor === null || valor === undefined) return salida;
  if (typeof valor === "string") {
    const t = valor.trim();
    if (t && CLAVE_MOTIVO.test(clave) && !/^(true|false|\d+)$/i.test(t)) salida.push(t);
  } else if (Array.isArray(valor)) {
    for (const x of valor) textosDe(x, clave, salida);
  } else if (typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) textosDe(v, k, salida);
  }
  return salida;
}

/**
 * Resumen de la revisión de un SKU a partir de GetProducts (`producto`) y, si existe, GetQcStatus (`qc`):
 *   { puntaje, estado, motivos: [{ categoria, texto }], categoria }
 * `categoria` es la del primer motivo (la más relevante) o null si no hay motivos.
 */
function resumirRevision(producto, qc) {
  const puntajeNum = Number(producto?.ContentScore);
  const puntaje = Number.isFinite(puntajeNum) && producto?.ContentScore !== "" && producto?.ContentScore != null ? Math.round(puntajeNum) : null;
  const estado = String(producto?.QCStatus || "").toLowerCase() || null;

  const textos = [...new Set(textosDe(qc))];
  if (puntaje !== null && puntaje < PUNTAJE_MINIMO && !textos.some((t) => /puntaje/i.test(t))) {
    textos.unshift(`El puntaje de contenido es ${puntaje}, menor a ${PUNTAJE_MINIMO} puntos. Revisa atributos faltantes o que necesiten mejoras.`);
  }
  const motivos = textos.slice(0, 20).map((texto) => ({ categoria: clasificarMotivo(texto), texto: texto.slice(0, 400) }));
  return { puntaje, estado, motivos, categoria: motivos[0]?.categoria || null };
}

module.exports = { CATEGORIAS_REVISION, PUNTAJE_MINIMO, clasificarMotivo, resumirRevision, textosDe };
