/**
 * Listas de las ventas (solo servidor): categoría, entrega, tipo de cliente, método de pago y
 * courier. Los valores por defecto salen de lib/ventas-core.js; lo guardado en
 * /admin/configuracion (pestaña Ventas) vive en la tabla `configuracion`, clave "ventas_opciones",
 * y reemplaza cada lista. Si la tabla falla o no hay nada guardado, se usan los defaults.
 */
const { query } = require("./db");
const core = require("./ventas-core");

const CLAVE = "ventas_opciones";

const DEFAULTS = {
  categorias: core.CATEGORIAS,
  destinos: core.DESTINOS,
  tiposCliente: core.TIPOS_CLIENTE,
  metodosPago: core.METODOS_PAGO,
  couriers: core.COURIERS,
};

function combinar(guardado) {
  const g = guardado && typeof guardado === "object" ? guardado : {};
  const salida = {};
  for (const [k, def] of Object.entries(DEFAULTS)) {
    salida[k] = Array.isArray(g[k]) && g[k].length ? g[k] : [...def];
  }
  return salida;
}

async function getOpcionesVentas() {
  try {
    const [fila] = await query("select valor from configuracion where clave = $1", [CLAVE]);
    return combinar(fila?.valor);
  } catch {
    return combinar(null);
  }
}

module.exports = { getOpcionesVentas, CLAVE };
