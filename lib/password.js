/** Hash de contraseñas con scrypt (solo servidor, módulo crypto de Node). */
const { scryptSync, randomBytes, timingSafeEqual } = require("node:crypto");

function hashPassword(password) {
  const sal = randomBytes(16).toString("hex");
  const hash = scryptSync(password, sal, 64).toString("hex");
  return `scrypt$${sal}$${hash}`;
}

function verificarPassword(password, almacenado) {
  const [alg, sal, hash] = String(almacenado || "").split("$");
  if (alg !== "scrypt" || !sal || !hash) return false;
  const calculado = scryptSync(String(password), sal, 64);
  const esperado = Buffer.from(hash, "hex");
  return esperado.length === calculado.length && timingSafeEqual(calculado, esperado);
}

module.exports = { hashPassword, verificarPassword };
