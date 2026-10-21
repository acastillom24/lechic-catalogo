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
 *  - Los productos y sus variantes viven ahora en Supabase (Postgres)
 *    y se administran desde /admin. Esas funciones son ASÍNCRONAS:
 *    siempre se llaman con `await` desde Server Components.
 * ============================================================
 */

const marcas = require("../data/marcas");
const config = require("../data/config");
const { supabaseServer } = require("./supabaseServer");

// ---- Configuración global (estática) ----
function getConfig() {
  return config;
}

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

// ---- Productos (Supabase) ----

// Convierte una fila de Supabase (producto + variantes anidadas) al mismo
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

const SELECT_PRODUCTO = "*, variantes(*)";

async function getProductos() {
  const { data, error } = await supabaseServer()
    .from("productos")
    .select(SELECT_PRODUCTO)
    .order("orden", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapearProducto);
}

async function getProductosPorMarca(marcaSlug) {
  const { data, error } = await supabaseServer()
    .from("productos")
    .select(SELECT_PRODUCTO)
    .eq("marca", marcaSlug)
    .order("orden", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapearProducto);
}

async function getProductosPorCategoria(marcaSlug, categoriaSlug) {
  const { data, error } = await supabaseServer()
    .from("productos")
    .select(SELECT_PRODUCTO)
    .eq("marca", marcaSlug)
    .eq("categoria", categoriaSlug)
    .order("orden", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapearProducto);
}

async function getProducto(id) {
  const { data, error } = await supabaseServer()
    .from("productos")
    .select(SELECT_PRODUCTO)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapearProducto(data) : null;
}

// ---- Cuenta cuántos productos hay por categoría (para la vista de marca) ----
async function contarPorCategoria(marcaSlug) {
  const { data, error } = await supabaseServer()
    .from("productos")
    .select("categoria")
    .eq("marca", marcaSlug);
  if (error) throw error;
  const conteo = {};
  for (const fila of data || []) {
    conteo[fila.categoria] = (conteo[fila.categoria] || 0) + 1;
  }
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
  const supabase = supabaseServer();
  // Quita caracteres con significado especial en los filtros de PostgREST.
  const texto = q.trim().replace(/[%,()*\\]/g, " ").trim();

  let query = supabase
    .from("productos")
    .select(SELECT_PRODUCTO, { count: "exact" })
    .order("orden", { ascending: false });

  if (texto) {
    const { data: porVariante, error: errorVar } = await supabase
      .from("variantes")
      .select("producto_id")
      .ilike("nombre", `%${texto}%`)
      .limit(500);
    if (errorVar) throw errorVar;
    const ids = [...new Set((porVariante || []).map((v) => v.producto_id))];
    const filtros = [`nombre.ilike.%${texto}%`, `descripcion.ilike.%${texto}%`];
    if (ids.length) filtros.push(`id.in.(${ids.join(",")})`);
    query = query.or(filtros.join(","));
  }

  const desde = (pagina - 1) * porPagina;
  const { data, error, count } = await query.range(desde, desde + porPagina - 1);
  if (error) throw error;
  return { productos: (data || []).map(mapearProducto), total: count || 0 };
}

module.exports = {
  getConfig,
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
