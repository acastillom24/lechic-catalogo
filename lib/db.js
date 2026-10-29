/**
 * ============================================================
 *  CLIENTE DE BASE DE DATOS (Neon Postgres, solo servidor)
 * ============================================================
 *  Variable de entorno requerida: DATABASE_URL (ver .env.local.example)
 *
 *  - query(texto, params)  → devuelve el arreglo de filas.
 *  - transaction(fn)       → fn recibe `t` con t.query(texto, params);
 *                            devuelve un arreglo de consultas que se
 *                            ejecutan juntas en una sola transacción.
 * ============================================================
 */
const { neon } = require("@neondatabase/serverless");

let sql = null;

function cliente() {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta la variable de entorno DATABASE_URL. " +
        "Revisa .env.local (local) o las variables del proyecto en Vercel."
    );
  }
  sql = neon(url);
  return sql;
}

async function query(texto, params = []) {
  return cliente().query(texto, params);
}

async function transaction(fn) {
  return cliente().transaction((t) => fn(t));
}

module.exports = { query, transaction };
