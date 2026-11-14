/**
 * Cifrado simétrico para credenciales guardadas en la base de datos (solo servidor).
 * AES-256-GCM con la clave maestra CREDENCIALES_KEY (32 bytes en base64).
 * Formato guardado: "iv.tag.cipher" (cada parte en base64).
 */
const crypto = require("node:crypto");

function clave() {
  const b64 = process.env.CREDENCIALES_KEY;
  if (!b64) throw new Error("Falta la variable de entorno CREDENCIALES_KEY (clave maestra para cifrar las API keys).");
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32) throw new Error("CREDENCIALES_KEY debe ser de 32 bytes en base64.");
  return buf;
}

function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", clave(), iv);
  const cifrado = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), cifrado].map((b) => b.toString("base64")).join(".");
}

function descifrar(blob) {
  const partes = String(blob || "").split(".");
  if (partes.length !== 3) throw new Error("Credencial cifrada con formato inválido.");
  const [iv, tag, cifrado] = partes.map((p) => Buffer.from(p, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", clave(), iv);
  d.setAuthTag(tag);
  try {
    return Buffer.concat([d.update(cifrado), d.final()]).toString("utf8");
  } catch {
    throw new Error("No se pudo descifrar la credencial (¿cambió CREDENCIALES_KEY?). Vuelve a escribir la API key.");
  }
}

module.exports = { cifrar, descifrar };
