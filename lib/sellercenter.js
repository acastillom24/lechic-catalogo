/**
 * ============================================================
 *  CLIENTE SELLER CENTER (SAGA / Falabella, solo servidor)
 * ============================================================
 *  Sin dependencias: node:crypto + fetch. Cada cuenta (tabla cuentas_saga) trae
 *  sus propios datos: user_id, api_key, base_url y operador.
 *  Firma: parámetros ordenados, RFC3986, HMAC-SHA256 hex con la API key.
 *  Lecturas = GET; escrituras = POST con el XML en el body (la firma solo
 *  cubre el query string).
 * ============================================================
 */
const crypto = require("node:crypto");

const VERSION = "1.0";
const TIMEOUT_MS = 30000;
const REINTENTOS = 2;

function codificar(valor) {
  return encodeURIComponent(String(valor)).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function construirQuery(params) {
  return Object.keys(params)
    .sort()
    .map((k) => `${codificar(k)}=${codificar(params[k])}`)
    .join("&");
}

function firmar(query, apiKey) {
  return crypto.createHmac("sha256", apiKey).update(query).digest("hex");
}

function timestamp() {
  // ISO 8601 UTC sin milisegundos: 2026-11-08T12:00:00+00:00
  return new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

/**
 * Arma las credenciales desde una cuenta ({ alias, user_id, api_key, base_url, operador }).
 * Lanza si falta algún dato.
 */
function credenciales(cuenta) {
  const falta = (campo, nombre) => {
    if (!cuenta[campo]) throw new Error(`Cuenta SAGA "${cuenta.alias}": falta ${nombre}.`);
  };
  falta("user_id", "el usuario (UserID)");
  falta("api_key", "la API key");
  falta("base_url", "la URL base");
  return {
    userId: cuenta.user_id,
    apiKey: cuenta.api_key,
    base: String(cuenta.base_url).replace(/\/+$/, ""),
    operador: cuenta.operador || null,
  };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Llama a una Action. `xml` (string) => POST con body; si no, GET.
 * Devuelve el `SuccessResponse` ya parseado; lanza Error con el mensaje de
 * `ErrorResponse` si la API responde con error.
 */
async function request(cred, action, params = {}, { xml = null } = {}) {
  const todos = {
    Action: action,
    Format: "JSON",
    Timestamp: timestamp(),
    UserID: cred.userId,
    Version: VERSION,
    ...params,
  };
  const query = construirQuery(todos);
  const url = `${cred.base}/?${query}&Signature=${firmar(query, cred.apiKey)}`;

  let ultimo;
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    try {
      const res = await fetch(url, {
        method: xml ? "POST" : "GET",
        headers: xml ? { "Content-Type": "text/xml; charset=UTF-8" } : { Accept: "application/json" },
        body: xml || undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const texto = await res.text();
      let data;
      try {
        data = JSON.parse(texto);
      } catch {
        data = null;
      }
      // 5xx o respuesta vacía (SAGA a veces responde 200 sin cuerpo): reintentar.
      if ((res.status >= 500 || (res.ok && !texto.trim())) && intento < REINTENTOS) {
        await esperar(1000 * 2 ** intento);
        continue;
      }
      if (data && data.ErrorResponse) {
        const h = data.ErrorResponse.Head || {};
        const err = new Error(`SAGA ${action}: ${h.ErrorMessage || "error"} (${h.ErrorCode ?? res.status})`);
        err.detalle = data.ErrorResponse;
        throw err;
      }
      if (!res.ok || !data) {
        throw new Error(`SAGA ${action}: HTTP ${res.status} ${texto.slice(0, 200)}`);
      }
      return data.SuccessResponse || data;
    } catch (e) {
      ultimo = e;
      const esRed = e.name === "TimeoutError" || e.name === "TypeError";
      if (!esRed || intento === REINTENTOS) throw e;
      await esperar(1000 * 2 ** intento);
    }
  }
  throw ultimo;
}

// ---------- XML ----------
function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function tag(nombre, valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  return `<${nombre}>${esc(valor)}</${nombre}>`;
}
const CABECERA = '<?xml version="1.0" encoding="UTF-8" ?>';

// Fechas de oferta como las devuelve SAGA: "2026-09-24 00:00:00" (desde) y "2027-12-31 23:59:59" (hasta).
const dia = (d) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);
const hoyLima = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });

/**
 * Unidad de negocio (precio, oferta y stock por operador), como la devuelve GetProducts:
 * BusinessUnits > BusinessUnit { OperatorCode, Price, SpecialPrice, SpecialFromDate, SpecialToDate, Stock, Status }.
 * Solo se envía lo que llega definido: sin precio no se pisa el de SAGA, sin stock no se toca el stock.
 * La oferta exige precio y las dos fechas, y una oferta ya vencida no se envía.
 */
function xmlUnidad({ operador, precio, precioOferta, ofertaInicio, ofertaFin, stock }) {
  const conOferta =
    precioOferta !== null && precioOferta !== undefined && precioOferta !== "" &&
    ofertaInicio && ofertaFin && dia(ofertaFin) >= hoyLima();
  const conStock = stock !== null && stock !== undefined;
  return (
    `<BusinessUnits><BusinessUnit>` +
    tag("OperatorCode", operador) +
    tag("Price", precio) +
    (conOferta
      ? tag("SpecialPrice", precioOferta) +
        tag("SpecialFromDate", `${dia(ofertaInicio)} 00:00:00`) +
        tag("SpecialToDate", `${dia(ofertaFin)} 23:59:59`)
      : "") +
    (conStock ? tag("Stock", stock) + tag("Status", Number(stock) === 0 ? "inactive" : "active") : "") +
    `</BusinessUnit></BusinessUnits>`
  );
}

/**
 * XML de ProductCreate/ProductUpdate. `datos` lo arma saga-mapeo.js. Estructura igual a la que
 * devuelve GetProducts: la medida (CantidadPerfumesVariant) es un atributo de variación de primer
 * nivel, precio/stock van en BusinessUnits y el resto de atributos en ProductData. Los campos
 * vacíos se omiten (en una actualización parcial solo viaja lo elegido); `unidad: false` omite BusinessUnits.
 */
function xmlProducto(d) {
  const extra = Object.entries(d.productData || {})
    .map(([k, v]) => tag(k, v))
    .join("");
  return (
    `${CABECERA}<Request><Product>` +
    tag("SellerSku", d.sellerSku) +
    tag("ParentSku", d.parentSku) +
    tag("Name", d.nombre) +
    tag("Description", d.descripcion) +
    tag("Brand", d.marca) +
    tag("CantidadPerfumesVariant", d.variacion) +
    // Atributos de variación de otras categorías (Color, Variation, …): también van en primer nivel.
    Object.entries(d.atributosVariante || {}).map(([k, v]) => tag(k, v)).join("") +
    tag("PrimaryCategory", d.categoriaPrimaria) +
    tag("ProductId", d.codigoBarras) +
    (d.unidad === false ? "" : xmlUnidad(d)) +
    (extra ? `<ProductData>${extra}</ProductData>` : "") +
    `</Product></Request>`
  );
}

/** XML para actualizar solo stock/precio por unidad de negocio (SellerSku + BusinessUnits). */
function xmlPrecioStock({ sellerSku, ...unidad }) {
  return `${CABECERA}<Request><Product>` + tag("SellerSku", sellerSku) + xmlUnidad(unidad) + `</Product></Request>`;
}

function xmlImagenes(sellerSku, urls) {
  return (
    `${CABECERA}<Request><ProductImage>` +
    tag("SellerSku", sellerSku) +
    `<Images>${urls.map((u) => tag("Image", u)).join("")}</Images>` +
    `</ProductImage></Request>`
  );
}

// ---------- Acciones ----------
const feedId = (r) => r?.Head?.RequestId || r?.Body?.FeedId || null;

async function probarConexion(cred) {
  return request(cred, "GetProducts", { Limit: 1 });
}
async function arbolCategorias(cred) {
  return request(cred, "GetCategoryTree");
}
async function marcas(cred) {
  return request(cred, "GetBrands");
}
async function atributosCategoria(cred, categoriaId) {
  return request(cred, "GetCategoryAttributes", { PrimaryCategory: categoriaId });
}
/** Las escrituras necesitan el código de operador de la cuenta (BusinessUnits); las lecturas no. */
function exigirOperador(cred) {
  if (!cred.operador) throw new Error("La cuenta no tiene código de operador (ej. fape): edítala en Configuración → SAGA.");
}

async function crearProducto(cred, datos) {
  exigirOperador(cred);
  const r = await request(cred, "ProductCreate", {}, { xml: xmlProducto({ ...datos, operador: cred.operador }) });
  return { feedId: feedId(r) };
}
/** Asocia las imágenes (URLs públicas) a un SKU. El producto ya debe existir en SAGA. */
async function enviarImagenes(cred, sku, urls) {
  const r = await request(cred, "Image", {}, { xml: xmlImagenes(sku, urls) });
  return { feedId: feedId(r) };
}
/** Actualización parcial de un SKU que ya existe: solo viajan los campos que trae `datos`. */
async function actualizarParcial(cred, datos) {
  if (datos.unidad !== false) exigirOperador(cred);
  const r = await request(cred, "ProductUpdate", {}, { xml: xmlProducto({ ...datos, operador: cred.operador }) });
  return { feedId: feedId(r) };
}
async function actualizarPrecioStock(cred, d) {
  exigirOperador(cred);
  const r = await request(
    cred,
    "ProductUpdate", // UpdatePriceQuantity ya no existe: precio y stock se actualizan con ProductUpdate + BusinessUnits
    {},
    { xml: xmlPrecioStock({ ...d, operador: cred.operador }) }
  );
  return { feedId: feedId(r) };
}
async function estadoFeed(cred, id) {
  return request(cred, "FeedStatus", { FeedID: id });
}
/** Datos que SAGA tiene de un SellerSku (o null si no existe). */
async function producto(cred, sku) {
  const r = await request(cred, "GetProducts", { SkuSellerList: JSON.stringify([String(sku)]) });
  const p = r?.Body?.Products?.Product;
  return (Array.isArray(p) ? p[0] : p) || null;
}
/**
 * Motivos de la revisión de calidad (QC) de un SKU. Es de solo lectura; si la cuenta o la versión de la API
 * no la ofrece devuelve null (el reporte se arma entonces con ContentScore y QCStatus de GetProducts).
 */
async function estadoQc(cred, sku) {
  try {
    return await request(cred, "GetQcStatus", { SkuSellerList: JSON.stringify([String(sku)]) });
  } catch {
    return null;
  }
}
/** ¿Existe el SKU en la cuenta? (decide ProductCreate vs ProductUpdate) */
async function existeSku(cred, sku) {
  return Boolean(await producto(cred, sku));
}

module.exports = {
  credenciales,
  request,
  construirQuery,
  firmar,
  xmlProducto,
  xmlPrecioStock,
  probarConexion,
  arbolCategorias,
  marcas,
  atributosCategoria,
  crearProducto,
  enviarImagenes,
  actualizarParcial,
  actualizarPrecioStock,
  estadoFeed,
  producto,
  estadoQc,
  existeSku,
};
