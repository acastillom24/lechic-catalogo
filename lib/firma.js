/**
 * ============================================================
 *  FIRMA HMAC DE WEBHOOKS (servidor)
 * ============================================================
 *  Contrato con facturacion_sunat:
 *    X-Timestamp: segundos Unix
 *    X-Signature: sha256=<hex>, donde
 *      hex = HMAC-SHA256(INVENTARIO_WEBHOOK_SECRET, `${timestamp}.${cuerpoCrudo}`)
 *  La firma cubre el cuerpo EXACTO recibido (no el JSON re-serializado).
 *  Usa Web Crypto, igual que lib/auth.js.
 * ============================================================
 */

const TOLERANCIA_SEGUNDOS = 5 * 60;

function bufferAHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(mensaje, secreto) {
  const encoder = new TextEncoder();
  const clave = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return bufferAHex(await crypto.subtle.sign("HMAC", clave, encoder.encode(mensaje)));
}

// Comparación en tiempo constante.
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Valor de la cabecera X-Signature para un envío (lo usa el emisor y las pruebas). */
async function firmarCuerpo(secreto, timestamp, cuerpo) {
  return `sha256=${await hmacHex(`${timestamp}.${cuerpo}`, secreto)}`;
}

/**
 * Verifica timestamp + firma. Devuelve { ok: true } o { ok: false, motivo }.
 * @param {string} secreto
 * @param {string|null} timestamp  cabecera X-Timestamp
 * @param {string|null} firma      cabecera X-Signature
 * @param {string} cuerpo          cuerpo crudo
 * @param {number} [ahoraMs]       solo para pruebas
 */
async function verificarFirma(secreto, timestamp, firma, cuerpo, ahoraMs = Date.now()) {
  if (!timestamp || !firma) return { ok: false, motivo: "faltan_cabeceras" };
  if (!/^\d{9,12}$/.test(timestamp)) return { ok: false, motivo: "timestamp_invalido" };
  if (Math.abs(ahoraMs / 1000 - Number(timestamp)) > TOLERANCIA_SEGUNDOS) {
    return { ok: false, motivo: "timestamp_fuera_de_rango" };
  }
  const esperada = await firmarCuerpo(secreto, timestamp, cuerpo);
  if (!iguales(firma.trim().toLowerCase(), esperada)) return { ok: false, motivo: "firma_invalida" };
  return { ok: true };
}

module.exports = { firmarCuerpo, verificarFirma, TOLERANCIA_SEGUNDOS };
