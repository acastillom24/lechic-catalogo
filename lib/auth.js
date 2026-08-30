/**
 * ============================================================
 *  AUTENTICACIÓN DEL PANEL /admin
 * ============================================================
 *  Un solo password compartido (variable de entorno ADMIN_PASSWORD)
 *  y una cookie de sesión firmada (HMAC) con vencimiento. No hay
 *  usuarios ni base de datos de sesiones: alcanza para un panel que
 *  usa una sola persona o un equipo pequeño de confianza.
 *
 *  Usa Web Crypto (globalThis.crypto.subtle) en vez del módulo
 *  "crypto" de Node para que funcione igual en el middleware (Edge)
 *  y en las Route Handlers / Server Actions (Node).
 *
 *  Variables de entorno requeridas:
 *    ADMIN_PASSWORD          la contraseña del panel
 *    ADMIN_SESSION_SECRET    cadena aleatoria larga para firmar la cookie
 * ============================================================
 */

const NOMBRE_COOKIE = "lechic_admin_sesion";
const DURACION_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

function requerirSecreto() {
  const secreto = process.env.ADMIN_SESSION_SECRET;
  if (!secreto) {
    throw new Error("Falta la variable de entorno ADMIN_SESSION_SECRET.");
  }
  return secreto;
}

// Convierte un ArrayBuffer a hexadecimal usando solo Web APIs (sin
// Buffer de Node), para que funcione igual en Edge (middleware) y Node
// (Server Actions / Route Handlers).
function bufferAHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function firmar(mensaje, secreto) {
  const encoder = new TextEncoder();
  const clave = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const firma = await crypto.subtle.sign("HMAC", clave, encoder.encode(mensaje));
  return bufferAHex(firma);
}

// Compara dos strings en tiempo constante (evita timing attacks triviales).
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function passwordCorrecta(intento) {
  const esperada = process.env.ADMIN_PASSWORD;
  if (!esperada) {
    throw new Error("Falta la variable de entorno ADMIN_PASSWORD.");
  }
  return typeof intento === "string" && iguales(intento, esperada);
}

// Genera el valor de la cookie de sesión: "expiraEn.firmaHex"
async function crearValorSesion() {
  const secreto = requerirSecreto();
  const expiraEn = Date.now() + DURACION_MS;
  const firma = await firmar(`sesion:${expiraEn}`, secreto);
  return `${expiraEn}.${firma}`;
}

// Verifica que la cookie sea válida y no haya vencido.
async function sesionValida(valorCookie) {
  if (!valorCookie || !valorCookie.includes(".")) return false;
  const [expiraEnStr, firma] = valorCookie.split(".");
  const expiraEn = Number(expiraEnStr);
  if (!Number.isFinite(expiraEn) || Date.now() > expiraEn) return false;

  try {
    const secreto = requerirSecreto();
    const firmaEsperada = await firmar(`sesion:${expiraEn}`, secreto);
    return iguales(firma, firmaEsperada);
  } catch {
    return false;
  }
}

module.exports = {
  NOMBRE_COOKIE,
  DURACION_MS,
  passwordCorrecta,
  crearValorSesion,
  sesionValida,
};
