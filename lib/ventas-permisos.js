/**
 * Qué ve cada usuario de /operaciones (solo servidor). Se guarda en `configuracion`, clave "operaciones_permisos":
 *   { "<id de usuario>": { ventas: bool, productos: bool, integraciones: bool, sistemas: bool, sincronizados: bool } }
 * Se edita en Configuración → Equipo. Lo que no está guardado cae en los valores por defecto de PERMISOS_PREDETERMINADOS.
 */
const { query } = require("./db");

const CLAVE = "operaciones_permisos";

/** Vistas (pestañas) y opciones dentro de ellas. `ruta` = adónde se manda al usuario si esa vista es la primera permitida. */
const VISTAS = [
  { id: "ventas", nombre: "Ventas", ruta: "/operaciones" },
  { id: "productos", nombre: "Productos", ruta: "/operaciones/productos" },
  { id: "integraciones", nombre: "Integraciones", ruta: "/operaciones/integraciones" },
];
const OPCIONES = [
  { id: "sistemas", nombre: "Columna Sistemas (en Productos)" },
  { id: "sincronizados", nombre: "Pestaña Sincronizados (en Integraciones → SAGA)" },
];
const IDS = [...VISTAS.map((v) => v.id), ...OPCIONES.map((o) => o.id)];

const PERMISOS_PREDETERMINADOS = { ventas: true, productos: true, integraciones: false, sistemas: false, sincronizados: true };

/** Permisos de un usuario: lo guardado (solo booleanos) sobre los predeterminados. */
function permisosDe(guardado, usuarioId) {
  const g = guardado && typeof guardado === "object" ? guardado[String(usuarioId)] : null;
  const salida = { ...PERMISOS_PREDETERMINADOS };
  if (g && typeof g === "object") for (const id of IDS) if (typeof g[id] === "boolean") salida[id] = g[id];
  return salida;
}

/** Primera vista permitida (para redirigir), o null si no tiene ninguna. */
function rutaInicial(permisos) {
  return VISTAS.find((v) => permisos[v.id])?.ruta || null;
}

async function getPermisosGuardados() {
  try {
    const [fila] = await query("select valor from configuracion where clave = $1", [CLAVE]);
    return fila?.valor && typeof fila.valor === "object" && !Array.isArray(fila.valor) ? fila.valor : {};
  } catch {
    return {};
  }
}

async function getPermisosUsuario(usuarioId) {
  return permisosDe(await getPermisosGuardados(), usuarioId);
}

async function guardarPermisosUsuario(usuarioId, permisos) {
  const todos = await getPermisosGuardados();
  todos[String(usuarioId)] = Object.fromEntries(IDS.map((id) => [id, permisos[id] === true]));
  await query(
    `insert into configuracion (clave, valor) values ($1, $2::jsonb)
     on conflict (clave) do update set valor = excluded.valor, updated_at = now()`,
    [CLAVE, JSON.stringify(todos)]
  );
}

module.exports = { CLAVE, VISTAS, OPCIONES, IDS, PERMISOS_PREDETERMINADOS, permisosDe, rutaInicial, getPermisosGuardados, getPermisosUsuario, guardarPermisosUsuario };
