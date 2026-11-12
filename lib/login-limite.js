/**
 * Límite de intentos fallidos de login, guardado en la BD (en serverless no hay memoria compartida).
 * Cada intento fallido suma a varias claves del mismo ámbito (p. ej. la IP y un contador global); con
 * `max` fallos dentro de la ventana la clave queda bloqueada hasta que la ventana vence. Un login correcto
 * borra el contador de la IP, no el global.
 *
 * Si la BD falla (o falta la tabla) NO se bloquea el login: es preferible a dejar a todos fuera, y se deja el
 * error en el log. Nunca lanza.
 */
const { query } = require("./db");

const VENTANA_MIN = 15;

/** IP del cliente a partir de los headers de la petición (Vercel agrega x-forwarded-for). */
function ipDe(headers) {
  const xff = headers.get("x-forwarded-for");
  return (xff && xff.split(",")[0].trim()) || headers.get("x-real-ip") || "desconocida";
}

/**
 * `claves` = [{ clave, max }]. Devuelve { bloqueado, minutos } (minutos aproximados hasta poder reintentar).
 */
async function comprobar(ambito, claves) {
  try {
    const filas = await query(
      `select clave, intentos, greatest(1, ceil(extract(epoch from (desde + make_interval(mins => $3) - now())) / 60))::int as minutos
         from login_intentos
        where ambito = $1 and clave = any($2::text[]) and desde > now() - make_interval(mins => $3)`,
      [ambito, claves.map((c) => c.clave), VENTANA_MIN]
    );
    const topes = new Map(claves.map((c) => [c.clave, c.max]));
    const bloqueadas = filas.filter((f) => f.intentos >= topes.get(f.clave));
    if (!bloqueadas.length) return { bloqueado: false, minutos: 0 };
    return { bloqueado: true, minutos: Math.max(...bloqueadas.map((f) => f.minutos)) };
  } catch (e) {
    console.error("[login-limite] comprobar:", e.message);
    return { bloqueado: false, minutos: 0 };
  }
}

/** Suma un fallo a cada clave (reinicia el contador si su ventana ya venció). */
async function registrarFallo(ambito, claves) {
  try {
    for (const clave of claves) {
      await query(
        `insert into login_intentos (ambito, clave, intentos, desde) values ($1, $2, 1, now())
         on conflict (ambito, clave) do update set
           intentos = case when login_intentos.desde > now() - make_interval(mins => $3) then login_intentos.intentos + 1 else 1 end,
           desde    = case when login_intentos.desde > now() - make_interval(mins => $3) then login_intentos.desde else now() end`,
        [ambito, clave, VENTANA_MIN]
      );
    }
  } catch (e) {
    console.error("[login-limite] registrarFallo:", e.message);
  }
}

/** Login correcto: borra el contador de esa clave. */
async function limpiar(ambito, clave) {
  try {
    await query("delete from login_intentos where ambito = $1 and clave = $2", [ambito, clave]);
    // Limpieza oportunista de contadores viejos.
    await query("delete from login_intentos where desde < now() - interval '1 day'");
  } catch (e) {
    console.error("[login-limite] limpiar:", e.message);
  }
}

module.exports = { comprobar, registrarFallo, limpiar, ipDe, VENTANA_MIN };
