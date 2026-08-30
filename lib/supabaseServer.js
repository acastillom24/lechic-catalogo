/**
 * ============================================================
 *  CLIENTE DE SUPABASE (solo servidor)
 * ============================================================
 *  Usa la "service role key", que tiene permiso para leer y
 *  escribir sin restricciones (RLS). Por eso este archivo NUNCA
 *  debe importarse desde un componente "use client" ni exponerse
 *  al navegador — solo se usa dentro de Server Components,
 *  Route Handlers, Server Actions y scripts de Node.
 *
 *  Variables de entorno requeridas (ver .env.local.example):
 *    SUPABASE_URL
 *    SUPABASE_SERVICE_ROLE_KEY
 * ============================================================
 */
const { createClient } = require("@supabase/supabase-js");
// @supabase/supabase-js siempre instancia un cliente de Realtime (aunque no
// lo usemos) y ese cliente exige un WebSocket nativo de Node 22+. Como
// Vercel puede correr en Node 20, le damos el polyfill "ws" explícitamente
// para que no falle al crear el cliente.
const WebSocket = require("ws");

let cliente = null;

function supabaseServer() {
  if (cliente) return cliente;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan las variables de entorno SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY. " +
        "Revisa .env.local (local) o las variables del proyecto en Vercel."
    );
  }

  cliente = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket },
  });
  return cliente;
}

module.exports = { supabaseServer };
