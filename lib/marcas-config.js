/**
 * Marcas, pestañas y categorías configurables (solo servidor).
 *
 *  - MARCA: la del producto, la que se envía a SAGA (`nombreSaga`).
 *  - PESTAÑA: dónde se ubica el producto en la web (/marca/[slug]).
 *  - CATEGORÍA: catálogo global; cada pestaña activa las que quiere mostrar.
 *
 * Lo guardado en /admin/configuracion vive en la tabla `configuracion` (claves "marcas",
 * "pestanas", "categorias") y reemplaza a los defaults de data/marcas.js. Si no hay nada guardado
 * o la tabla falla, se usan los defaults.
 */
const { cache } = require("react");
const defaults = require("../data/marcas");
const { query } = require("./db");

const CLAVES = { marcas: "marcas", pestanas: "pestanas", categorias: "categorias" };
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const texto = (v) => (typeof v === "string" ? v.trim() : "");

/** Categorías válidas (slug único) o, si no hay ninguna, los defaults. */
function normalizarCategorias(guardado) {
  const vistos = new Set();
  const lista = [];
  for (const c of Array.isArray(guardado) ? guardado : []) {
    const slug = texto(c?.slug);
    const nombre = texto(c?.nombre);
    if (!SLUG.test(slug) || !nombre || vistos.has(slug)) continue;
    vistos.add(slug);
    lista.push({ slug, nombre });
  }
  return lista.length ? lista : defaults.categorias.map((c) => ({ ...c }));
}

/** Pestañas crudas: `categorias` es la lista de slugs activos (solo los que existen en el catálogo). */
function normalizarPestanas(guardado, catalogo) {
  const slugsCat = new Set(catalogo.map((c) => c.slug));
  const vistos = new Set();
  const lista = [];
  for (const p of Array.isArray(guardado) ? guardado : []) {
    const slug = texto(p?.slug);
    const nombre = texto(p?.nombre);
    if (!SLUG.test(slug) || !nombre || vistos.has(slug)) continue;
    vistos.add(slug);
    const color = /^#[0-9a-fA-F]{6}$/.test(texto(p.color)) ? texto(p.color) : "#f06595";
    const activas = [...new Set((Array.isArray(p.categorias) ? p.categorias : []).map(texto))].filter((s) => slugsCat.has(s));
    lista.push({ slug, nombre, descripcion: texto(p.descripcion), color, categorias: activas });
  }
  return lista.length
    ? lista
    : defaults.pestanas.map((p) => ({ ...p, categorias: p.categorias.filter((s) => slugsCat.has(s)) }));
}

/** Nombre exacto de la marca en otras plataformas (además de SAGA): { <plataforma>: "nombre" }. */
function normalizarNombres(n) {
  const salida = {};
  if (!n || typeof n !== "object" || Array.isArray(n)) return salida;
  for (const [plat, nombre] of Object.entries(n)) if (/^[a-z0-9_]{1,30}$/.test(plat) && texto(nombre)) salida[plat] = texto(nombre);
  return salida;
}

function normalizarMarcas(guardado, pestanas) {
  const slugsPest = new Set(pestanas.map((p) => p.slug));
  const primera = pestanas[0]?.slug || "";
  const vistos = new Set();
  const lista = [];
  for (const m of Array.isArray(guardado) ? guardado : []) {
    const slug = texto(m?.slug);
    const nombre = texto(m?.nombre);
    if (!SLUG.test(slug) || !nombre || vistos.has(slug)) continue;
    vistos.add(slug);
    const pd = texto(m.pestanaDefault);
    lista.push({ slug, nombre, nombreSaga: texto(m.nombreSaga), nombres: normalizarNombres(m.nombres), pestanaDefault: slugsPest.has(pd) ? pd : primera });
  }
  return lista.length
    ? lista
    : defaults.marcas.map((m) => ({ ...m, pestanaDefault: slugsPest.has(m.pestanaDefault) ? m.pestanaDefault : primera }));
}

/** Combina lo guardado (crudo) con los defaults y lo normaliza. */
function combinar(guardado) {
  const g = guardado || {};
  const categorias = normalizarCategorias(g.categorias);
  const pestanasCrudas = normalizarPestanas(g.pestanas, categorias);
  const marcas = normalizarMarcas(g.marcas, pestanasCrudas);
  return { categorias, pestanasCrudas, marcas };
}

/** Pestañas con sus categorías activas ya resueltas a { slug, nombre }. */
function resolverPestanas(pestanasCrudas, categorias) {
  const porSlug = new Map(categorias.map((c) => [c.slug, c]));
  return pestanasCrudas.map((p) => ({ ...p, categorias: p.categorias.map((s) => porSlug.get(s)).filter(Boolean) }));
}

async function leerGuardado() {
  try {
    const filas = await query("select clave, valor from configuracion where clave = any($1)", [Object.values(CLAVES)]);
    const salida = {};
    for (const f of filas) salida[f.clave] = f.valor;
    return salida;
  } catch {
    return {};
  }
}

/**
 * { marcas, pestanas, pestanasCrudas, categorias }
 *  - marcas: [{ slug, nombre, nombreSaga, nombres: { <plataforma>: nombre exacto }, pestanaDefault }]
 *  - pestanas: [{ slug, nombre, descripcion, color, categorias: [{ slug, nombre }] }]
 *  - pestanasCrudas: igual pero `categorias` es la lista de slugs (para editar en Configuración)
 *  - categorias: catálogo global [{ slug, nombre }]
 */
const getConfigMarcas = cache(async () => {
  const { categorias, pestanasCrudas, marcas } = combinar(await leerGuardado());
  return { marcas, pestanas: resolverPestanas(pestanasCrudas, categorias), pestanasCrudas, categorias };
});

async function getMarcas() {
  return (await getConfigMarcas()).marcas;
}
async function getMarcaProducto(slug) {
  return (await getMarcas()).find((m) => m.slug === slug) || null;
}
async function getPestanas() {
  return (await getConfigMarcas()).pestanas;
}
async function getPestana(slug) {
  return (await getPestanas()).find((p) => p.slug === slug) || null;
}
/** Categoría activa en esa pestaña (o null). */
async function getCategoria(pestanaSlug, categoriaSlug) {
  const p = await getPestana(pestanaSlug);
  return p?.categorias.find((c) => c.slug === categoriaSlug) || null;
}

/** Mapa slug de marca -> nombre exacto en SAGA (solo las que ya tienen nombre). */
/** { <marca>: nombre exacto en esa plataforma } (solo las marcas que lo tienen). SAGA usa `nombreSaga`; las demás, `nombres`. */
async function getMapaMarcas(plataforma) {
  const mapa = {};
  for (const m of await getMarcas()) {
    const nombre = plataforma === "saga" ? m.nombreSaga : m.nombres && m.nombres[plataforma];
    if (nombre) mapa[m.slug] = nombre;
  }
  return mapa;
}

async function getMapaMarcasSaga() {
  const mapa = {};
  for (const m of await getMarcas()) if (m.nombreSaga) mapa[m.slug] = m.nombreSaga;
  return mapa;
}

module.exports = {
  CLAVES,
  SLUG,
  combinar,
  normalizarCategorias,
  normalizarPestanas,
  normalizarMarcas,
  getConfigMarcas,
  getMarcas,
  getMarcaProducto,
  getPestanas,
  getPestana,
  getCategoria,
  getMapaMarcas,
  getMapaMarcasSaga,
};
