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
      id: v.id,
      nombre: v.nombre,
      precio: v.precio === null ? null : Number(v.precio),
      precioOferta: v.precio_oferta === null ? null : Number(v.precio_oferta),
      // Con control de cantidad, "hay stock" se deriva de stock_actual.
      stock: v.stock_actual === null || v.stock_actual === undefined ? v.stock : v.stock_actual > 0,
      sku: v.sku || null,
      stockActual: v.stock_actual ?? null,
      stockMinimo: v.stock_minimo ?? 0,
      costo: v.costo === null || v.costo === undefined ? null : Number(v.costo),
      activo: v.activo !== false,
      esPack: v.es_pack === true,
      imagen: v.imagen || null,
      codigoBarras: v.codigo_barras || "",
      volumen: v.volumen || "",
      registroSanitario: v.registro_sanitario || "",
      descripcion: v.descripcion || "",
      cantidadEmpaque: v.cantidad_empaque || "",
      aromasSaga: v.aromas_saga || [],
      sagaExtras: v.saga_extras || {},
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
    saga: {
      sagaCategoria: fila.saga_categoria || "",
      skuPadre: fila.sku_padre || "",
      paisProduccion: fila.pais_produccion || "",
      formatoBelleza: fila.formato_belleza || "Frasco",
      genero: fila.genero || "",
      usarSkuPadre: fila.usar_sku_padre === true,
      contenidoPaquete: fila.contenido_paquete || "",
      paqueteAncho: fila.paquete_ancho ?? "",
      paqueteLargo: fila.paquete_largo ?? "",
      paqueteAlto: fila.paquete_alto ?? "",
      paquetePeso: fila.paquete_peso ?? "",
      modelo: fila.modelo || "",
      tipoPerfume: fila.tipo_perfume || "",
      caracteristicas: fila.caracteristicas || "",
      condicion: fila.condicion || "Nuevo",
      extras: fila.saga_extras || {},
    },
    variantes,
  };
}

// Producto + variantes anidadas (json_agg) en una sola consulta.
// Público (por defecto): solo variantes activas.
// Admin (incluirInactivas): todas las variantes.
function selectProducto(incluirInactivas = false) {
  const filtro = incluirInactivas ? "" : "and v.activo";
  return `
  select p.*,
    coalesce(
      (select json_agg(v order by v.orden, v.id) from variantes v where v.producto_id = p.id ${filtro}),
      '[]'::json
    ) as variantes
  from productos p`;
}
const SELECT_PRODUCTO = selectProducto(false);

// Condición para listados públicos: el producto tiene alguna variante activa.
const CON_ACTIVAS =
  "exists (select 1 from variantes av where av.producto_id = p.id and av.activo)";

async function getProductos() {
  const filas = await query(`${SELECT_PRODUCTO} where ${CON_ACTIVAS} order by p.orden desc`);
  return filas.map(mapearProducto);
}

async function getProductosPorMarca(marcaSlug) {
  const filas = await query(
    `${SELECT_PRODUCTO} where p.marca = $1 and ${CON_ACTIVAS} order by p.orden desc`,
    [marcaSlug]
  );
  return filas.map(mapearProducto);
}

async function getProductosPorCategoria(marcaSlug, categoriaSlug) {
  const filas = await query(
    `${SELECT_PRODUCTO} where p.marca = $1 and p.categoria = $2 and ${CON_ACTIVAS} order by p.orden desc`,
    [marcaSlug, categoriaSlug]
  );
  return filas.map(mapearProducto);
}

async function getProducto(id, { incluirInactivas = false } = {}) {
  const filas = await query(
    `${selectProducto(incluirInactivas)} where p.id = $1${incluirInactivas ? "" : ` and ${CON_ACTIVAS}`}`,
    [id]
  );
  const producto = filas[0] ? mapearProducto(filas[0]) : null;
  // Para editar: cada pack trae sus componentes y el stock que resulta de ellos.
  if (producto && incluirInactivas && producto.variantes.some((v) => v.esPack)) {
    const { cargarComponentes, calcularStockPack } = require("./packs");
    const mapa = await cargarComponentes(producto.variantes.filter((v) => v.esPack).map((v) => v.id));
    for (const v of producto.variantes) {
      if (!v.esPack) continue;
      const comps = mapa.get(Number(v.id)) || [];
      v.componentes = comps.map((c) => ({ id: Number(c.id), cantidad: Number(c.cantidad) }));
      v.stockPack = calcularStockPack(comps);
    }
  }
  return producto;
}

/**
 * Variantes que pueden formar parte de un pack (activas y que no sean packs), para el buscador del
 * formulario. `excluirIds` deja fuera, p. ej., la propia variante que se está editando.
 */
async function getVariantesParaPack() {
  const filas = await query(
    `select v.id, v.sku, v.nombre as variante, v.stock, v.stock_actual, v.stock_minimo, p.nombre as producto
       from variantes v
       join productos p on p.id = v.producto_id
      where v.activo and not v.es_pack
      order by p.nombre, v.orden, v.id`
  );
  return filas.map((f) => ({
    id: Number(f.id),
    sku: f.sku || "",
    etiqueta: `${f.producto}${f.variante && f.variante !== "Único" ? ` – ${f.variante}` : ""}${f.sku ? ` (${f.sku})` : ""}`,
    stockActual: f.stock_actual ?? null,
    stockMinimo: f.stock_minimo ?? 0,
    stock: f.stock,
  }));
}

// ---- Cuenta cuántos productos hay por categoría (para la vista de marca) ----
async function contarPorCategoria(marcaSlug) {
  const filas = await query(
    `select p.categoria, count(*)::int as n from productos p
      where p.marca = $1 and ${CON_ACTIVAS} group by p.categoria`,
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
    `${selectProducto(true)} ${where} order by p.orden desc limit ${Number(porPagina)} offset ${Number(desde)}`,
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
  getVariantesParaPack,
  contarPorCategoria,
  rangoPrecios,
  buscar,
};
