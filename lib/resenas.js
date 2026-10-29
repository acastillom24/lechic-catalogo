/**
 * ============================================================
 *  RESEÑAS DE PRODUCTOS (solo servidor)
 * ============================================================
 *  - Identidad: ID token de Google (sin registro propio).
 *  - Anti-bots: Cloudflare Turnstile.
 *  - Anti-abuso: 1 reseña por cuenta y producto (UNIQUE en BD) y
 *    límites por cuenta e IP por hora.
 *
 *  Variables de entorno: GOOGLE_CLIENT_ID, TURNSTILE_KEY (secret),
 *  y opcional ADMIN_SESSION_SECRET (sal para hashear la IP).
 * ============================================================
 */
const crypto = require("crypto");
const { query } = require("./db");

const POR_PAGINA = 10;
const MAX_COMENTARIO = 500;
const LIMITE_CUENTA_HORA = 5;
const LIMITE_IP_HORA = 10;

async function verificarGoogle(idToken) {
  if (typeof idToken !== "string" || idToken.length > 4096) return null;
  const res = await fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" +
      encodeURIComponent(idToken),
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const d = await res.json();
  if (d.aud !== process.env.GOOGLE_CLIENT_ID) return null;
  if (d.email_verified !== "true" && d.email_verified !== true) return null;
  if (!d.sub) return null;
  const nombre = (d.given_name || d.name || "Cliente").trim().split(/\s+/)[0];
  return { sub: d.sub, nombre: nombre.slice(0, 40) };
}

async function verificarTurnstile(token, ip) {
  if (typeof token !== "string" || !token) return false;
  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_KEY || "",
    response: token,
  });
  if (ip) body.set("remoteip", ip);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body, cache: "no-store" }
  );
  if (!res.ok) return false;
  const d = await res.json();
  return d.success === true;
}

function hashIp(ip) {
  const sal = process.env.ADMIN_SESSION_SECRET || "lechic";
  return crypto.createHash("sha256").update(sal + ":" + ip).digest("hex");
}

async function crearResena({ productoId, idToken, turnstile, estrellas, comentario, ip }) {
  const est = Number(estrellas);
  if (!Number.isInteger(est) || est < 1 || est > 5) {
    return { status: 400, error: "Elige de 1 a 5 estrellas." };
  }
  const texto = (typeof comentario === "string" ? comentario : "").trim();
  if (texto.length > MAX_COMENTARIO) {
    return { status: 400, error: `El comentario no puede superar ${MAX_COMENTARIO} caracteres.` };
  }

  if (!(await verificarTurnstile(turnstile, ip))) {
    return { status: 400, error: "No pudimos verificar que eres una persona. Intenta de nuevo." };
  }
  const usuario = await verificarGoogle(idToken);
  if (!usuario) {
    return { status: 401, error: "Tu sesión de Google venció. Vuelve a iniciar sesión." };
  }

  const [prod] = await query("select id from productos where id = $1", [String(productoId)]);
  if (!prod) return { status: 404, error: "Producto no encontrado." };

  const ipHash = hashIp(ip || "desconocida");
  const desde = new Date(Date.now() - 3600 * 1000).toISOString();

  const [[porCuenta], [porIp]] = await Promise.all([
    query("select count(*)::int as n from resenas where google_sub = $1 and created_at >= $2", [usuario.sub, desde]),
    query("select count(*)::int as n from resenas where ip_hash = $1 and created_at >= $2", [ipHash, desde]),
  ]);
  if (porCuenta.n >= LIMITE_CUENTA_HORA || porIp.n >= LIMITE_IP_HORA) {
    return { status: 429, error: "Demasiadas reseñas en poco tiempo. Intenta más tarde." };
  }

  // Si la cuenta ya reseñó este producto, se actualiza (no se duplica).
  try {
    await query(
      `insert into resenas (producto_id, google_sub, nombre, estrellas, comentario, ip_hash)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (producto_id, google_sub) do update set
         nombre = excluded.nombre, estrellas = excluded.estrellas,
         comentario = excluded.comentario, ip_hash = excluded.ip_hash`,
      [prod.id, usuario.sub, usuario.nombre, est, texto, ipHash]
    );
  } catch {
    return { status: 500, error: "No se pudo guardar la reseña." };
  }
  return { status: 200 };
}

async function getResumen(productoId) {
  const [r = {}] = await query("select * from resumen_resenas($1)", [productoId]);
  return {
    total: Number(r.total || 0),
    promedio: Number(r.promedio || 0),
    conteo: [r.c1, r.c2, r.c3, r.c4, r.c5].map((n) => Number(n || 0)),
  };
}

const ORDENES = {
  recientes: "created_at desc",
  mejores: "estrellas desc, created_at desc",
  peores: "estrellas asc, created_at desc",
};

async function getResenas(productoId, pagina = 0, orden = "recientes") {
  const desde = pagina * POR_PAGINA;
  return query(
    `select id, nombre, estrellas, comentario, created_at from resenas
     where producto_id = $1 and aprobado
     order by ${ORDENES[orden] || ORDENES.recientes}
     limit ${POR_PAGINA} offset ${Number(desde)}`,
    [productoId]
  );
}

module.exports = { crearResena, getResumen, getResenas, POR_PAGINA, MAX_COMENTARIO };
