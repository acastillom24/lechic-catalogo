/** Configuración de niveles de stock (solo servidor). Ver lib/stock-niveles.js. */
const { query } = require("./db");
const { normalizar } = require("./stock-niveles");

const CLAVE = "stock_niveles";

async function getConfigStock() {
  try {
    const [fila] = await query("select valor from configuracion where clave = $1", [CLAVE]);
    return normalizar(fila?.valor);
  } catch {
    return normalizar(null);
  }
}

module.exports = { getConfigStock, CLAVE };
