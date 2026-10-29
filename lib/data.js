/**
 * ============================================================
 *  CAPA DE ACCESO A DATOS
 * ============================================================
 *  Las páginas NUNCA leen la base de datos directamente. Solo
 *  llaman a estas funciones.
 *
 *  - Marcas, categorías y configuración del sitio (`data/marcas.js`,
 *    `data/config.js`) cambian muy poco y se usan también desde
 *    componentes de cliente (Navbar, ProductCard, etc.), así que se
 *    mantienen como archivos estáticos y estas funciones siguen
 *    siendo SÍNCRONAS.
 *  - Los productos y sus variantes viven en Neon (Postgres)
 *    y se administran desde /admin. Esas funciones son ASÍNCRONAS:
 *    siempre se llaman con `await` desde Server Components.
 * ============================================================
 */

const marcas = require("../data/marcas");
const { query } = require("./db");

// ---- Marcas (estáticas) ----
function getMarcas() {
  return marcas;
}

function getMarca(slug) {
  return marcas.find((m) => m.slug === slug) || null;
}

// ---- Categorías de una marca (estáticas) ----
function getCategorias(marcaSlug) {
  const marca = getMarca(marcaSlug);
  return marca ? marca.categorias : [];
}

function getCategoria(marcaSlug, categoriaSlug) {
  return getCategorias(marcaSlug).find((c) => c.slug === categoriaSlug) || null;
}

// ---- Productos (Neon) ----

// Convierte una fila de la base de datos (producto + variantes anidadas) al mismo
// formato que usaban los componentes cuando los datos venían de
// data/productos.js, para no tener que tocar la interfaz.
function mapearProducto(fila) {
  const variantes = (fila.variantes || [])
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((v) => ({
      nombre: v.nombre,
      precio: v.precio === null ? null : Number(v.precio),
      precioOferta: v.precio_oferta === null ? null : Number(v.precio_oferta),
      stock: v.stock,
      imagen: v.imagen || null,
      ...(v.aromas && v.aromas.length ? { aromas: v.aromas } : {}),
    }));

  return {
    id: fila.id,
    marca: fila.marca,
    categoria: fila.categoria,
    nombre: fila.nombre,
    descripcion: fila.descripcion || "",
    ...(fila.aromas && fila.aromas.length ? { aromas: fila.aromas } : {}),
    ...(fila.destacado ? { destacado: true } : {}),
    variantes,
  };
}

// Producto + variantes anidadas (json_agg) en una sola consulta.
const SELECT_PRODUCTO = `
  select p.*,
    coalesce(
      (select json_agg(v order by v.orden, v.id) from variantes v where v.producto_id = p.id),
      '[]'::json
    ) as variantes
  from productos p`;

async function getProductos() {
  const filas = await query(`${SELECT_PRODUCTO} order by p.orden desc`);
  return filas.map(mapearProducto);
}

async function getProductosPorMarca(marcaSlug) {
  const filas = await query(
    `${SELECT_PRODUCTO} where p.marca = $1 order by p.orden desc`,
    [marcaSlug]
  );
  return filas.map(mapearProducto);
}

async function getProductosPorCategoria(marcaSlug, categoriaSlug) {
  const filas = await query(
    `${SELECT_PRODUCTO} where p.marca = $1 and p.categoria = $2 order by p.orden desc`,
    [marcaSlug, categoriaSlug]
  );
  return filas.map(mapearProducto);
}

async function getProducto(id) {
  const filas = await query(`${SELECT_PRODUCTO} where p.id = $1`, [id]);
  return filas[0] ? mapearProducto(filas[0]) : null;
}

// ---- Cuenta cuántos productos hay por categoría (para la vista de marca) ----
async function contarPorCategoria(marcaSlug) {
  const filas = await query(
    "select categoria, count(*)::int as n from productos where marca = $1 group by categoria",
    [marcaSlug]
  );
  const conteo = {};
  for (const fila of filas) conteo[fila.categoria] = fila.n;
  return conteo;
}

// ---- Rango de precios de un producto (para mostrar "desde S/ X") ----
// Función pura: recibe el producto ya cargado, no toca la base de datos.
function rangoPrecios(producto) {
  const precios = producto.variantes
    .map((v) => v.precioOferta ?? v.precio)
    .filter((p) => p !== null && p !== undefined);
  return { min: Math.min(...precios), max: Math.max(...precios) };
}

// ---- Búsqueda simple por texto (nombre, descripción, aromas) ----
async function buscar(texto) {
  const q = texto.trim();
  if (!q) return [];
  // Trae todo y filtra en memoria: el catálogo es chico (cientos de
  // productos), así que no vale la pena una búsqueda full-text en SQL.
  const productos = await getProductos();
  const ql = q.toLowerCase();
  return productos.filter((p) => {
    const enNombre = p.nombre.toLowerCase().includes(ql);
    const enDesc = (p.descripcion || "").toLowerCase().includes(ql);
    const enAromas = (p.aromas || [])
      .concat(p.variantes.flatMap((v) => v.aromas || []))
      .join(" ")
      .toLowerCase()
      .includes(ql);
    const enVariante = p.variantes.some((v) =>
      v.nombre.toLowerCase().includes(ql)
    );
    return enNombre || enDesc || enAromas || enVariante;
  });
}

// ---- Listado paginado para el admin ----
// Pagina y busca en la base de datos para no traer todo el catálogo en cada visita.
async function getProductosPagina({ pagina = 1, porPagina = 25, q = "" } = {}) {
  const texto = q.trim();
  const params = [];
  let where = "";
  if (texto) {
    params.push(`%${texto.replace(/[\%_]/g, "\$&")}%`);
    where = `where p.nombre ilike $1 or p.descripcion ilike $1
      or exists (select 1 from variantes v where v.producto_id = p.id and v.nombre ilike $1)`;
  }

  const [{ n }] = await query(`select count(*)::int as n from productos p ${where}`, params);
  const desde = (pagina - 1) * porPagina;
  const filas = await query(
    `${SELECT_PRODUCTO} ${where} order by p.orden desc limit ${Number(porPagina)} offset ${Number(desde)}`,
    params
  );
  return { productos: filas.map(mapearProducto), total: n };
}

module.exports = {
  getProductosPagina,
  getMarcas,
  getMarca,
  getCategorias,
  getCategoria,
  getProductos,
  getProductosPorMarca,
  getProductosPorCategoria,
  getProducto,
  contarPorCategoria,
  rangoPrecios,
  buscar,
};
