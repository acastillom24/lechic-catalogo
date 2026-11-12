/**
 * ============================================================
 *  CAPA DE ACCESO A DATOS
 * ============================================================
 *  Las páginas NUNCA leen la base de datos directamente. Solo
 *  llaman a estas funciones.
 *
 *  - Marcas, pestañas y categorías son configurables (Configuración →
 *    Marcas / Pestañas) y viven en la tabla `configuracion`; se leen con
 *    `lib/marcas-config.js` (ASÍNCRONO, solo servidor). Aquí se reexportan.
 *    Los componentes de cliente las reciben por props.
 *  - Los productos y sus variantes viven en Neon (Postgres)
 *    y se administran desde /admin. Esas funciones son ASÍNCRONAS:
 *    siempre se llaman con `await` desde Server Components.
 * ============================================================
 */

const { query } = require("./db");
const { personalizadosDeFila } = require("./atributos-efectivos");
const { prepararIndice, buscarEnIndice } = require("./busqueda");
const { getMarcas, getMarcaProducto, getPestanas, getPestana, getCategoria } = require("./marcas-config");

// ---- Productos (Neon) ----

// Las notas aromáticas (texto separado por comas) se muestran en la web como etiquetas.
const notasLista = (t) => String(t || "").split(",").map((x) => x.trim()).filter(Boolean);

// Convierte una fila de la base de datos (producto + variantes anidadas) al formato
// que usan los componentes (camelCase, variantes ordenadas).
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
      // Todas las imágenes de la variante (la primera es la portada); sin lista, la imagen única de siempre.
      imagenes: v.imagenes && v.imagenes.length ? v.imagenes : v.imagen ? [v.imagen] : [],
      codigoBarras: v.codigo_barras || "",
      volumen: v.volumen || "",
      registroSanitario: v.registro_sanitario || "",
      descripcion: v.descripcion || "",
      cantidadEmpaque: v.cantidad_empaque || "",
      fraganciaPerfume: v.fragancia_perfume || [],
      notasAromaticas: v.notas_aromaticas || "",
      sagaCombinarNombre: v.saga_combinar_nombre !== false,
      sagaExtras: v.saga_extras || {},
      // Lo que esta variante personaliza respecto al producto (camelCase; vacío = hereda). Ver lib/atributos-efectivos.js.
      attrs: personalizadosDeFila(v),
      ...(notasLista(v.notas_aromaticas).length ? { aromas: notasLista(v.notas_aromaticas) } : {}),
    }));

  return {
    id: fila.id,
    marca: fila.marca,
    // Pestaña de la web; los productos sin migrar usan su marca anterior como pestaña.
    pestana: fila.pestana || fila.marca,
    categoria: fila.categoria,
    nombre: fila.nombre,
    descripcion: fila.descripcion || "",
    ...(notasLista(fila.notas_aromaticas).length ? { aromas: notasLista(fila.notas_aromaticas) } : {}),
    ...(fila.destacado ? { destacado: true } : {}),
    saga: {
      sagaCategoria: fila.saga_categoria || "",
      skuPadre: fila.sku_padre || "",
      skuPadreWeb: fila.sku_padre_web ?? fila.sku_padre ?? "",
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
      // Medida, cantidad en el empaque, fragancia y notas a nivel de producto (las variantes heredan).
      volumen: fila.volumen || "",
      cantidadEmpaque: fila.cantidad_empaque || "",
      fraganciaPerfume: fila.fragancia_perfume || [],
      notasAromaticas: fila.notas_aromaticas || "",
      // Valores generales que las variantes heredan (registro sanitario y campos extra por variante).
      atributos: fila.atributos || {},
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

// Pestaña efectiva de un producto (los no migrados caen en su marca anterior).
const PESTANA = "coalesce(p.pestana, p.marca)";

async function getProductosPorPestana(pestanaSlug) {
  const filas = await query(
    `${SELECT_PRODUCTO} where ${PESTANA} = $1 and ${CON_ACTIVAS} order by p.orden desc`,
    [pestanaSlug]
  );
  return filas.map(mapearProducto);
}

async function getProductosPorCategoria(pestanaSlug, categoriaSlug) {
  const filas = await query(
    `${SELECT_PRODUCTO} where ${PESTANA} = $1 and p.categoria = $2 and ${CON_ACTIVAS} order by p.orden desc`,
    [pestanaSlug, categoriaSlug]
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

// ---- Cuenta cuántos productos hay por categoría (para la vista de pestaña) ----
async function contarPorCategoria(pestanaSlug) {
  const filas = await query(
    `select p.categoria, count(*)::int as n from productos p
      where ${PESTANA} = $1 and ${CON_ACTIVAS} group by p.categoria`,
    [pestanaSlug]
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

// ---- Búsqueda por texto (nombre, variantes, marca/categoría, notas aromáticas y descripción) ----
// Sin importar tildes ni mayúsculas, con palabras en cualquier orden y tolerando errores de tipeo (ver lib/busqueda.js).
async function buscar(texto) {
  const q = String(texto || "").trim();
  if (!q) return [];
  // Trae todo y filtra en memoria: el catálogo es chico (cientos de productos).
  const productos = await getProductos();
  return buscarEnIndice(prepararIndice(productos), q);
}

/**
 * Catálogo completo en formato liviano para el buscador del inicio (se sirve como JSON estático desde /api/catalogo):
 * solo lo que necesitan la tarjeta de producto y la búsqueda. Sin datos internos (SAGA, costos, stock por cantidad).
 */
async function getCatalogoPublico() {
  const [productos, pestanas] = await Promise.all([getProductos(), getPestanas()]);
  const nombrePestana = new Map(pestanas.map((p) => [p.slug, p.nombre]));
  const nombreCategoria = new Map(pestanas.flatMap((p) => p.categorias.map((c) => [`${p.slug}/${c.slug}`, c.nombre])));
  return {
    pestanas: pestanas.map((p) => ({ slug: p.slug, nombre: p.nombre, color: p.color })),
    productos: productos.map((p) => ({
      id: p.id,
      pestana: p.pestana,
      categoria: p.categoria,
      etiquetas: [nombrePestana.get(p.pestana), nombreCategoria.get(`${p.pestana}/${p.categoria}`)].filter(Boolean),
      nombre: p.nombre,
      descripcion: String(p.descripcion || "").slice(0, 400),
      ...(p.aromas ? { aromas: p.aromas } : {}),
      ...(p.destacado ? { destacado: true } : {}),
      variantes: p.variantes.map((v) => ({
        id: v.id,
        nombre: v.nombre,
        precio: v.precio,
        precioOferta: v.precioOferta,
        stock: v.stock,
        imagen: v.imagen,
        ...(v.aromas ? { aromas: v.aromas } : {}),
        ...(v.descripcion ? { descripcion: String(v.descripcion).slice(0, 400) } : {}),
      })),
    })),
  };
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
  getMarcaProducto,
  getPestanas,
  getPestana,
  getCategoria,
  getProductos,
  getProductosPorPestana,
  getProductosPorCategoria,
  getProducto,
  getVariantesParaPack,
  contarPorCategoria,
  rangoPrecios,
  buscar,
  getCatalogoPublico,
};
