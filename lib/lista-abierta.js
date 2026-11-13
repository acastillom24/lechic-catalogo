/**
 * «Lista abierta»: SAGA corta las listas largas de valores con una opción «…», lo que significa que la lista es parcial y
 * también acepta otros valores. En las opciones de un atributo de la web ese «…» se conserva como MARCA (no es un valor):
 * el producto puede elegir de la lista o escribir un valor libre. En los campos del catálogo de SAGA se guarda como `abierta: true`.
 * Módulo de datos puros (servidor y cliente).
 */
const MARCA = "…";
const esMarca = (o) => /^(…|\.{2,})$/.test(String(o ?? "").trim());

/** ¿El atributo/campo admite valores fuera de su lista? */
const esAbierta = (a) => a?.abierta === true || (Array.isArray(a?.opciones) && a.opciones.some(esMarca));

/** Opciones sin la marca. */
const opcionesReales = (a) => (Array.isArray(a?.opciones) ? a.opciones : []).filter((o) => !esMarca(o));

/** Opciones para guardar: las reales (sin repetir) y, si la lista es abierta, la marca al final. */
const conMarca = (reales, abierta) => [...new Set(reales)].concat(abierta ? [MARCA] : []);

module.exports = { MARCA, esMarca, esAbierta, opcionesReales, conMarca };
