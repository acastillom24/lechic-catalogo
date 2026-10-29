/**
 * ============================================================
 *  CONFIGURACIÓN DEL SITIO (solo servidor)
 * ============================================================
 *  Los valores por defecto viven en data/config.js. Lo que se edita
 *  desde /admin/configuracion se guarda en la tabla `configuracion`
 *  (clave "sitio") y se fusiona encima. Si la tabla está vacía o la
 *  consulta falla, el sitio usa los valores por defecto.
 * ============================================================
 */
const { cache } = require("react");
const defaults = require("../data/config");
const { query } = require("./db");

const CLAVE = "sitio";

function esObjeto(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

// Los objetos se fusionan campo a campo; los arreglos y valores simples reemplazan.
function fusionar(base, extra) {
  if (!esObjeto(base) || !esObjeto(extra)) return extra === undefined ? base : extra;
  const salida = { ...base };
  for (const k of Object.keys(extra)) salida[k] = fusionar(base[k], extra[k]);
  return salida;
}

async function leerOverrides() {
  try {
    const [fila] = await query("select valor from configuracion where clave = $1", [CLAVE]);
    return fila?.valor || {};
  } catch {
    return {};
  }
}

const getConfigSitio = cache(async () => fusionar(defaults, await leerOverrides()));

module.exports = { getConfigSitio, fusionar, defaults, CLAVE };
