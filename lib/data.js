/**
 * ============================================================
 *  CAPA DE ACCESO A DATOS
 * ============================================================
 *  Las páginas NUNCA leen los archivos de datos directamente.
 *  Solo llaman a estas funciones. Si el día de mañana mueves
 *  los datos a una base de datos real (Supabase, Postgres),
 *  solo cambias este archivo y el resto del sitio sigue igual.
 * ============================================================
 */

const marcas = require("../data/marcas");
const productos = require("../data/productos");
const config = require("../data/config");

// ---- Configuración global ----
function getConfig() {
  return config;
}

// ---- Marcas ----
function getMarcas() {
  return marcas;
}

function getMarca(slug) {
  return marcas.find((m) => m.slug === slug) || null;
}

// ---- Categorías de una marca ----
function getCategorias(marcaSlug) {
  const marca = getMarca(marcaSlug);
  return marca ? marca.categorias : [];
}

function getCategoria(marcaSlug, categoriaSlug) {
  return getCategorias(marcaSlug).find((c) => c.slug === categoriaSlug) || null;
}

// ---- Productos ----
function getProductos() {
  return productos;
}

function getProductosPorMarca(marcaSlug) {
  return productos.filter((p) => p.marca === marcaSlug);
}

function getProductosPorCategoria(marcaSlug, categoriaSlug) {
  return productos.filter(
    (p) => p.marca === marcaSlug && p.categoria === categoriaSlug
  );
}

function getProducto(id) {
  return productos.find((p) => p.id === id) || null;
}

// ---- Cuenta cuántos productos hay por categoría (para la vista de marca) ----
function contarPorCategoria(marcaSlug) {
  const conteo = {};
  for (const p of getProductosPorMarca(marcaSlug)) {
    conteo[p.categoria] = (conteo[p.categoria] || 0) + 1;
  }
  return conteo;
}

// ---- Rango de precios de un producto (para mostrar "desde S/ X") ----
function rangoPrecios(producto) {
  const precios = producto.variantes.map((v) => v.precioOferta ?? v.precio);
  return { min: Math.min(...precios), max: Math.max(...precios) };
}

// ---- Búsqueda simple por texto (nombre, descripción, aromas) ----
function buscar(texto) {
  const q = texto.trim().toLowerCase();
  if (!q) return [];
  return productos.filter((p) => {
    const enNombre = p.nombre.toLowerCase().includes(q);
    const enDesc = (p.descripcion || "").toLowerCase().includes(q);
    const enAromas = (p.aromas || [])
      .concat(p.variantes.flatMap((v) => v.aromas || []))
      .join(" ")
      .toLowerCase()
      .includes(q);
    const enVariante = p.variantes.some((v) =>
      v.nombre.toLowerCase().includes(q)
    );
    return enNombre || enDesc || enAromas || enVariante;
  });
}

module.exports = {
  getConfig,
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
