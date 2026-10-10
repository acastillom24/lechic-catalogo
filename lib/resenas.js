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
const { supabaseServer } = require("./supabaseServer");

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

  const supabase = supabaseServer();
  const { data: prod } = await supabase
    .from("productos").select("id").eq("id", String(productoId)).maybeSingle();
  if (!prod) return { status: 404, error: "Producto no encontrado." };

  const ipHash = hashIp(ip || "desconocida");
  const desde = new Date(Date.now() - 3600 * 1000).toISOString();

  const [porCuenta, porIp] = await Promise.all([
    supabase.from("resenas").select("id", { count: "exact", head: true })
      .eq("google_sub", usuario.sub).gte("created_at", desde),
    supabase.from("resenas").select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash).gte("created_at", desde),
  ]);
  if ((porCuenta.count || 0) >= LIMITE_CUENTA_HORA || (porIp.count || 0) >= LIMITE_IP_HORA) {
    return { status: 429, error: "Demasiadas reseñas en poco tiempo. Intenta más tarde." };
  }

  // Si la cuenta ya reseñó este producto, se actualiza (no se duplica).
  const { error } = await supabase.from("resenas").upsert(
    {
      producto_id: prod.id,
      google_sub: usuario.sub,
      nombre: usuario.nombre,
      estrellas: est,
      comentario: texto,
      ip_hash: ipHash,
    },
    { onConflict: "producto_id,google_sub" }
  );
  if (error) return { status: 500, error: "No se pudo guardar la reseña." };
  return { status: 200 };
}

async function getResumen(productoId) {
  const { data } = await supabaseServer().rpc("resumen_resenas", { p_producto: productoId });
  const r = (data && data[0]) || {};
  return {
    total: Number(r.total || 0),
    promedio: Number(r.promedio || 0),
    conteo: [r.c1, r.c2, r.c3, r.c4, r.c5].map((n) => Number(n || 0)),
  };
}

async function getResenas(productoId, pagina = 0) {
  const desde = pagina * POR_PAGINA;
  const { data } = await supabaseServer()
    .from("resenas")
    .select("id, nombre, estrellas, comentario, created_at")
    .eq("producto_id", productoId)
    .eq("aprobado", true)
    .order("created_at", { ascending: false })
    .range(desde, desde + POR_PAGINA - 1);
  return data || [];
}

module.exports = { crearResena, getResumen, getResenas, POR_PAGINA, MAX_COMENTARIO };
