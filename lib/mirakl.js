/**
 * ============================================================
 *  CLIENTE MIRAKL (Ripley Perú, solo servidor)
 * ============================================================
 *  Sin dependencias: solo fetch. Cada cuenta (tabla cuentas_ripley) trae su base_url
 *  (instancia *.mirakl.net) y su API key cifrada. Autenticación: header Authorization con
 *  la API key. Fase 1: SOLO lecturas (no se envía nada al catálogo ni a las ofertas).
 * ============================================================
 */
const { descifrar } = require("./cifrado");

const TIMEOUT_MS = 30000;
const REINTENTOS = 2;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const textoPlano = (t) => String(t).replace(/<(script|style)[\s\S]*?<\/(?:script|style)>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Solo https y dominios *.mirakl.net: evita que una URL guardada mande la API key a otro servidor. */
function urlBaseValida(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" && /(^|\.)mirakl\.net$/i.test(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

/**
 * Arma las credenciales desde una cuenta ({ alias, base_url, api_key_cifrada }) o, para scripts,
 * ({ alias, base_url, api_key }) con la key en claro. Lanza si falta algún dato.
 */
function credenciales(cuenta) {
  if (!cuenta.base_url) throw new Error(`Cuenta Ripley "${cuenta.alias}": falta la URL base.`);
  if (!urlBaseValida(cuenta.base_url)) throw new Error(`Cuenta Ripley "${cuenta.alias}": la URL base debe ser https y de mirakl.net.`);
  const apiKey = cuenta.api_key || (cuenta.api_key_cifrada ? descifrar(cuenta.api_key_cifrada) : "");
  if (!apiKey) throw new Error(`Cuenta Ripley "${cuenta.alias}": falta la API key.`);
  return { apiKey, base: new URL(cuenta.base_url).origin };
}

/**
 * GET (o método indicado) a /api/<ruta>. Devuelve el JSON; lanza Error con el mensaje de Mirakl si falla.
 * Reintenta ante 5xx, 429 (respetando Retry-After) y errores de red.
 */
async function request(cred, ruta, { metodo = "GET", query = {}, body = null } = {}) {
  const url = new URL(`${cred.base}/api/${String(ruta).replace(/^\/+/, "")}`);
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));

  let ultimo;
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    try {
      const res = await fetch(url, {
        method: metodo,
        headers: {
          Authorization: cred.apiKey,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const texto = await res.text();
      let data = null;
      try {
        data = texto.trim() ? JSON.parse(texto) : null;
      } catch {
        data = null;
      }
      if (res.status === 429 && intento < REINTENTOS) {
        const pedido = Number(res.headers.get("retry-after"));
        await esperar(Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, 10) * 1000 : 2000 * 2 ** intento);
        continue;
      }
      if (res.status >= 500 && intento < REINTENTOS) {
        await esperar(1000 * 2 ** intento);
        continue;
      }
      if (!res.ok) {
        const msg = (data && (data.message || data.error_description || data.error)) || textoPlano(texto).slice(0, 160) || `HTTP ${res.status}`;
        const err = new Error(`Mirakl ${ruta}: ${msg} (${res.status})`);
        err.status = res.status;
        err.limiteConsultas = res.status === 429;
        err.sinAcceso = res.status === 401 || res.status === 403;
        throw err;
      }
      return data;
    } catch (e) {
      ultimo = e;
      const esRed = e.name === "TimeoutError" || e.name === "TypeError";
      if (!esRed || intento === REINTENTOS) throw e;
      await esperar(1000 * 2 ** intento);
    }
  }
  throw ultimo;
}

// ---------- Lecturas ----------

/** Versión de la plataforma (no exige API key en algunas instancias; se envía igual). */
const version = (cred) => request(cred, "version");

/** Datos de la tienda asociada a la API key: confirma que la key es válida. */
const cuenta = (cred) => request(cred, "account");

/** Árbol de categorías del operador (jerarquías). */
async function jerarquias(cred) {
  const d = await request(cred, "hierarchies");
  return d?.hierarchies || [];
}

/** Atributos de catálogo (todos o de una jerarquía). */
async function atributos(cred, { jerarquia = "" } = {}) {
  const d = await request(cred, "products/attributes", { query: { hierarchy: jerarquia } });
  return d?.attributes || [];
}

/** Listas de valores (o los valores de una lista concreta, con `codigo`). */
async function listasValores(cred, { codigo = "" } = {}) {
  const d = await request(cred, "values_lists", { query: { code: codigo } });
  return d?.values_lists || [];
}

/** Prueba de conexión: versión + datos de la tienda. Devuelve { version, tienda }. */
async function probarConexion(cred) {
  const [v, t] = await Promise.all([version(cred).catch(() => null), cuenta(cred)]);
  return {
    version: v?.version || null,
    tienda: { id: t?.shop_id ?? null, nombre: t?.shop_name ?? null, estado: t?.shop_state ?? null, moneda: t?.currency_iso_code ?? null },
  };
}

module.exports = { urlBaseValida, credenciales, request, version, cuenta, jerarquias, atributos, listasValores, probarConexion };
