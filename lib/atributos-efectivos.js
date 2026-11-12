/**
 * Atributos efectivos de una variante (módulo de datos puros: lo usan el servidor y el cliente).
 *
 * Todos los atributos se llenan a nivel de PRODUCTO. Cada variante hereda los del producto y solo guarda lo que
 * personaliza (un valor vacío = usa el del producto):  efectivo(variante) = producto ⊕ personalizados de la variante.
 *
 * Dónde viven los personalizados de una variante (nombres de BD):
 *  - columnas: volumen, cantidad_empaque, notas_aromaticas, registro_sanitario, descripcion, fragancia_perfume,
 *    saga_extras (campos SAGA de nivel variante);
 *  - jsonb `variantes.atributos`: modelo, pais_produccion, condicion, tipo_perfume, genero, formato_belleza,
 *    caracteristicas, contenido_paquete, paquete_ancho/largo/alto/peso, extras_producto (campos SAGA de nivel
 *    producto) y propios (atributos propios de la categoría).
 * En el formulario los mismos datos viajan en camelCase como `attrs` (ver personalizadosDeFila / personalizadosAFila).
 */
const { heredarVariante } = require("./saga-campos");

const esObjeto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const vacio = (x) =>
  x === null || x === undefined || (typeof x === "string" && x.trim() === "") || (Array.isArray(x) && x.length === 0) || (esObjeto(x) && Object.keys(x).length === 0);
const sinVacios = (o) => Object.fromEntries(Object.entries(esObjeto(o) ? o : {}).filter(([, x]) => !vacio(x)));

// Claves del jsonb variantes.atributos que reemplazan un campo del producto: camelCase (formulario) → clave en BD.
const CLAVES_PRODUCTO = {
  modelo: "modelo",
  paisProduccion: "pais_produccion",
  condicion: "condicion",
  tipoPerfume: "tipo_perfume",
  genero: "genero",
  formatoBelleza: "formato_belleza",
  caracteristicas: "caracteristicas",
  contenidoPaquete: "contenido_paquete",
  paqueteAncho: "paquete_ancho",
  paqueteLargo: "paquete_largo",
  paqueteAlto: "paquete_alto",
  paquetePeso: "paquete_peso",
};
const NUMERICAS = new Set(["paqueteAncho", "paqueteLargo", "paqueteAlto", "paquetePeso"]);
// Columnas de texto de la variante: camelCase → columna.
const COLUMNAS_TEXTO = {
  volumen: "volumen",
  cantidadEmpaque: "cantidad_empaque",
  notasAromaticas: "notas_aromaticas",
  registroSanitario: "registro_sanitario",
  descripcion: "descripcion",
};

/** Todas las claves camelCase que una variante puede personalizar (producto = mismo conjunto). */
const CAMPOS_PERSONALIZABLES = [
  ...Object.keys(CLAVES_PRODUCTO),
  ...Object.keys(COLUMNAS_TEXTO),
  "fraganciaPerfume",
  "varianteExtras",
  "extras",
  "propios",
];

/**
 * Primer paso de la herencia: el producto combinado con lo que la variante personalizó (modelo, país, paquete, extras
 * de producto, atributos propios…) y la variante con la medida, cantidad en el empaque, notas y fragancia del producto.
 * NO aplica todavía los valores generales de SAGA de nivel variante (registro sanitario y campos extra): esos se
 * heredan después con heredarVariante, porque una cuenta puede tener otra categoría (ver saga-sync).
 */
function efectivoBase(p, v) {
  const a = esObjeto(v?.atributos) ? v.atributos : {};
  const pa = esObjeto(p?.atributos) ? p.atributos : {};

  const pOut = { ...p };
  for (const clave of Object.values(CLAVES_PRODUCTO)) if (!vacio(a[clave])) pOut[clave] = a[clave];
  pOut.saga_extras = { ...sinVacios(p?.saga_extras), ...sinVacios(a.extras_producto) };
  pOut.atributos = { ...pa, propios: { ...sinVacios(pa.propios), ...sinVacios(a.propios) } };

  const vBase = { ...v };
  for (const col of ["volumen", "cantidad_empaque", "notas_aromaticas"]) if (vacio(v?.[col]) && !vacio(p?.[col])) vBase[col] = p[col];
  if (vacio(v?.fragancia_perfume) && !vacio(p?.fragancia_perfume)) vBase.fragancia_perfume = p.fragancia_perfume;
  return { p: pOut, v: vBase };
}

/**
 * Valores efectivos completos de una variante: { p, v } en nombres de BD, con el producto combinado con lo que la
 * variante personalizó y la variante con todo lo que hereda del producto (incluidos registro sanitario y campos SAGA).
 */
function efectivoVariante(p, v) {
  const base = efectivoBase(p, v);
  return { p: base.p, v: heredarVariante(base.p.atributos, base.v) };
}

/** Personalizados de una fila de variante (BD) como `attrs` del formulario: solo las claves con valor. */
function personalizadosDeFila(v) {
  const a = esObjeto(v?.atributos) ? v.atributos : {};
  const attrs = {};
  for (const [camel, clave] of Object.entries(CLAVES_PRODUCTO)) if (!vacio(a[clave])) attrs[camel] = a[clave];
  for (const [camel, col] of Object.entries(COLUMNAS_TEXTO)) if (!vacio(v?.[col])) attrs[camel] = v[col];
  if (!vacio(v?.fragancia_perfume)) attrs.fraganciaPerfume = v.fragancia_perfume;
  if (!vacio(v?.saga_extras)) attrs.varianteExtras = v.saga_extras;
  if (!vacio(a.extras_producto)) attrs.extras = a.extras_producto;
  if (!vacio(a.propios)) attrs.propios = a.propios;
  return attrs;
}

const texto = (x, max = 500) => (x === null || x === undefined ? "" : String(x).trim().slice(0, max));
const listaTextos = (x) => (Array.isArray(x) ? [...new Set(x.map((t) => texto(t, 200)).filter(Boolean))] : []);
const numero = (x) => {
  if (x === null || x === undefined || String(x).trim() === "") return null;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
/** Valores de atributos propios del formulario: claves [a-z0-9_] y textos o listas de textos cortos. */
function limpiarMapa(entrada) {
  const salida = {};
  if (!esObjeto(entrada)) return salida;
  for (const [k, val] of Object.entries(entrada)) {
    if (!/^[A-Za-z0-9_]{1,60}$/.test(k)) continue;
    const limpio = Array.isArray(val) ? listaTextos(val) : texto(val, 200);
    if (!vacio(limpio)) salida[k] = limpio;
  }
  return salida;
}

/**
 * `attrs` del formulario (solo lo personalizado) → lo que se guarda: `columnas` (null/[]/{} = hereda) y el jsonb
 * `atributos`. Los campos vacíos se limpian para que la variante vuelva a heredar del producto.
 */
function personalizadosAFila(attrs) {
  const at = esObjeto(attrs) ? attrs : {};
  const columnas = {};
  for (const [camel, col] of Object.entries(COLUMNAS_TEXTO)) columnas[col] = texto(at[camel], camel === "notasAromaticas" ? 300 : 500) || null;
  columnas.fragancia_perfume = listaTextos(at.fraganciaPerfume);
  columnas.saga_extras = limpiarMapa(at.varianteExtras);

  const atributos = {};
  for (const [camel, clave] of Object.entries(CLAVES_PRODUCTO)) {
    const val = NUMERICAS.has(camel) ? numero(at[camel]) : texto(at[camel]);
    if (!vacio(val)) atributos[clave] = val;
  }
  const extras = limpiarMapa(at.extras);
  if (!vacio(extras)) atributos.extras_producto = extras;
  const propios = limpiarMapa(at.propios);
  if (!vacio(propios)) atributos.propios = propios;
  return { columnas, atributos };
}

module.exports = {
  CAMPOS_PERSONALIZABLES,
  CLAVES_PRODUCTO,
  COLUMNAS_TEXTO,
  efectivoBase,
  efectivoVariante,
  personalizadosDeFila,
  personalizadosAFila,
  limpiarMapa,
  vacio,
  sinVacios,
};
