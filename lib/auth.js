/**
 * ============================================================
 *  AUTENTICACIÓN DEL PANEL /admin
 * ============================================================
 *  Un solo password compartido (variable de entorno ADMIN_PASSWORD).
 *  La sesión es una cookie firmada (HMAC) con vencimiento Y registrada
 *  en la tabla `sesiones_admin`: cerrar sesión la borra en el servidor,
 *  así una cookie robada deja de servir (antes valía hasta vencer).
 *  Cambiar ADMIN_SESSION_SECRET sigue invalidando todas las sesiones.
 *
 *  Usa Web Crypto (globalThis.crypto.subtle) en vez del módulo
 *  "crypto" de Node para que funcione igual en proxy.js y en las
 *  Server Actions.
 *
 *  Variables de entorno requeridas:
 *    ADMIN_PASSWORD          la contraseña del panel
 *    ADMIN_SESSION_SECRET    cadena aleatoria larga para firmar la cookie
 * ============================================================
 */
const { query } = require("./db");

const NOMBRE_COOKIE = "lechic_admin_sesion";
const DURACION_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

function requerirSecreto() {
  const secreto = process.env.ADMIN_SESSION_SECRET;
  if (!secreto) {
    // El detalle va al log del servidor; al navegador solo llega un mensaje genérico.
    console.error("[auth] Falta la variable de entorno ADMIN_SESSION_SECRET.");
    throw new Error("configuración incompleta");
  }
  return secreto;
}

// Convierte un ArrayBuffer a hexadecimal usando solo Web APIs.
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

// Compara dos strings en tiempo constante, sin salir antes si el largo difiere.
function iguales(a, b) {
  const x = String(a), y = String(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

async function sha256Hex(texto) {
  return bufferAHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
}

/** ¿Es la contraseña del panel? Compara los hashes SHA-256 (largo fijo) para no filtrar el largo real. */
async function passwordCorrecta(intento) {
  const esperada = process.env.ADMIN_PASSWORD;
  if (!esperada) {
    console.error("[auth] Falta la variable de entorno ADMIN_PASSWORD.");
    throw new Error("configuración incompleta");
  }
  if (typeof intento !== "string") return false;
  const [a, b] = await Promise.all([sha256Hex(intento), sha256Hex(esperada)]);
  return iguales(a, b);
}

function idAleatorio() {
  return bufferAHex(crypto.getRandomValues(new Uint8Array(24)).buffer);
}

// Crea la sesión (la registra en la BD) y devuelve el valor de la cookie: "id.expiraEn.firmaHex"
async function crearValorSesion() {
  const secreto = requerirSecreto();
  const id = idAleatorio();
  const expiraEn = Date.now() + DURACION_MS;
  await query("insert into sesiones_admin (id, expira) values ($1, to_timestamp($2::double precision / 1000))", [id, expiraEn]);
  // Limpieza oportunista de sesiones vencidas.
  query("delete from sesiones_admin where expira < now()").catch(() => {});
  const firma = await firmar(`sesion:${id}:${expiraEn}`, secreto);
  return `${id}.${expiraEn}.${firma}`;
}

function partes(valorCookie) {
  if (!valorCookie) return null;
  const p = valorCookie.split(".");
  if (p.length !== 3 || !/^[0-9a-f]{48}$/.test(p[0])) return null;
  const expiraEn = Number(p[1]);
  return Number.isFinite(expiraEn) ? { id: p[0], expiraEn, firma: p[2] } : null;
}

// Verifica firma y vencimiento y que la sesión siga registrada (no revocada). Ante cualquier fallo, rechaza.
async function sesionValida(valorCookie) {
  const p = partes(valorCookie);
  if (!p || Date.now() > p.expiraEn) return false;
  try {
    const esperada = await firmar(`sesion:${p.id}:${p.expiraEn}`, requerirSecreto());
    if (!iguales(p.firma, esperada)) return false;
    const filas = await query("select 1 from sesiones_admin where id = $1 and expira > now()", [p.id]);
    return filas.length > 0;
  } catch {
    return false;
  }
}

// Revoca la sesión de esta cookie en el servidor (cerrar sesión).
async function cerrarSesionServidor(valorCookie) {
  const p = partes(valorCookie);
  if (!p) return;
  try {
    await query("delete from sesiones_admin where id = $1", [p.id]);
  } catch (e) {
    console.error("[auth] cerrarSesionServidor:", e.message);
  }
}

/** Ruta interna del panel a la que volver tras el login; cualquier otra cosa (URL externa, //host, \\host) cae en /admin. */
function rutaPanelSegura(destino) {
  const d = typeof destino === "string" ? destino : "";
  return /^\/admin(\/[^\s\\]*)?(\?[^\s\\]*)?$/.test(d) && !d.includes("//") ? d : "/admin";
}

module.exports = {
  NOMBRE_COOKIE,
  DURACION_MS,
  passwordCorrecta,
  crearValorSesion,
  sesionValida,
  cerrarSesionServidor,
  rutaPanelSegura,
};
