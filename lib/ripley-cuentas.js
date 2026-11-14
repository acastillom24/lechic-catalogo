/**
 * Cuentas de Ripley (tabla cuentas_ripley). Nunca devuelven la API key: solo `tiene_key`.
 */
const { query } = require("./db");

const COLUMNAS = "alias, nombre, activo, base_url, shop_id, (api_key_cifrada is not null and api_key_cifrada <> '') as tiene_key";

/** Todas las cuentas para el panel. */
async function getCuentasRipley() {
  return query(`select ${COLUMNAS} from cuentas_ripley order by alias`);
}

/** Solo las activas con API key (las que se pueden usar para sincronizar). */
async function getCuentasRipleyActivas() {
  return query(`select ${COLUMNAS} from cuentas_ripley where activo and api_key_cifrada is not null and api_key_cifrada <> '' order by alias`);
}

module.exports = { getCuentasRipley, getCuentasRipleyActivas };
