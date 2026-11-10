/**
 * Sesión del panel /operaciones: cookie firmada (HMAC, Web Crypto) con el id del
 * usuario. La firma se valida en proxy.js; en las páginas/acciones además se
 * revalida contra la BD que el usuario siga activo (ver lib/ventas.js).
 * Valor de la cookie: "<uid>.<expiraEnMs>.<firmaHex>"
 */
const NOMBRE_COOKIE_VENTAS = "lechic_sales_sesion";
const DURACION_VENTAS_MS = 1000 * 60 * 60 * 12; // 12 horas

function secreto() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("Falta la variable de entorno ADMIN_SESSION_SECRET.");
  return s;
}

async function firmar(mensaje) {
  const enc = new TextEncoder();
  const clave = await crypto.subtle.importKey(
    "raw",
    enc.encode(secreto()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const f = await crypto.subtle.sign("HMAC", clave, enc.encode(mensaje));
  return Array.from(new Uint8Array(f))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function iguales(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function crearValorSesionVentas(uid) {
  const expira = Date.now() + DURACION_VENTAS_MS;
  return `${uid}.${expira}.${await firmar(`ventas:${uid}:${expira}`)}`;
}

/** Devuelve el id de usuario (número) si la cookie es válida, o null. */
async function leerSesionVentas(valor) {
  if (!valor) return null;
  const [uidStr, expStr, firma] = valor.split(".");
  const uid = Number(uidStr);
  const exp = Number(expStr);
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isFinite(exp) || Date.now() > exp || !firma) {
    return null;
  }
  try {
    return iguales(firma, await firmar(`ventas:${uid}:${exp}`)) ? uid : null;
  } catch {
    return null;
  }
}

module.exports = {
  NOMBRE_COOKIE_VENTAS,
  DURACION_VENTAS_MS,
  crearValorSesionVentas,
  leerSesionVentas,
};
