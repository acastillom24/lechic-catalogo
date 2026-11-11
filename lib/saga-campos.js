/**
 * Campos extra por categoría primaria de SAGA. Módulo de datos puros (lo usan el servidor y el cliente).
 *
 * El catálogo (data/saga-campos.json) se genera desde SAGA con `npm run saga:campos -- <idCategoria>`.
 * Cada campo es { id (FeedName), etiqueta, tipo: lista|multi|texto|numero, nivel: producto|variante,
 * obligatorio, opciones?, max? }. En Configuración → SAGA se marca qué campos opcionales se muestran
 * por categoría (`categorias[].extras`); los obligatorios de SAGA se muestran siempre.
 *
 * Valores: cada producto/variante guarda { [id]: valor } (multi = lista de textos). Por producto van
 * dentro de ProductData; por variante, como etiqueta de primer nivel (igual que CantidadPerfumesVariant).
 */
const CATALOGO = require("../data/saga-campos.json");

// Perfumes tiene su propio formulario y mapeo para los campos base; el resto de categorías usa solo los campos extra.
const PERFUME = "1735";

// Campos de la categoría de perfumes que ya cubre su formulario propio (obligatorios, notas aromáticas y
// características): no se ofrecen como extra. Los demás de 1735 (instrucciones de uso, garantía…) sí.
const PROPIOS_PERFUME = new Set([
  "FraganciaPerfume", "CantidadContenidaEnElEmpaque", "FormatoBelleza", "Genero", "TipoDePerfume",
  "CantidadPerfumesVariant", "NotasAromaticas", "Caracteristicas",
]);

// Campos que se muestran por defecto en cada categoría mientras no se guarde otra elección en Configuración.
const PREDETERMINADOS = {
  1735: ["InstruccionesDeUso"], // Fragancias|perfumes
  2945: ["TipoMaquillajeOjos", "TipoDePiel"], // Cosméticos|ojos
  1332: ["TipoCosmeticoLabial", "TipoDePiel"], // Cosméticos|labios
  320: ["TipoMaquillajeRostro", "TipoDePiel"], // Cosméticos|rostro
  3064: ["FrecuenciaDeUso", "FormaFarmaceutica", "UsoTratamientosDePiel"], // Hidratantes after-sun
  948: ["UsoTratamientosDePiel"], // Otros productos para el cuidado de la piel
  2257: ["FrecuenciaDeUso", "Organico", "FormaFarmaceutica", "UsoTratamientosDePiel"], // Hidratación de la piel
  1937: ["UsoTratamientosDePiel"], // Otros productos cosméticos
};

/** ¿La categoría primaria elegida usa los campos extra (cualquiera salvo perfumes)? */
const esCategoriaGeneral = (categoriaId) => Boolean(categoriaId) && String(categoriaId) !== PERFUME;

/** Todos los campos extra que SAGA define para la categoría ([] si no está en el catálogo). */
const camposDe = (categoriaId) => CATALOGO[String(categoriaId)] || [];

/** ¿Es un campo que el formulario propio de perfumes ya cubre (y por tanto no va como campo extra)? */
const esPropioPerfume = (categoriaId, campoId) => String(categoriaId) === PERFUME && PROPIOS_PERFUME.has(campoId);

/**
 * Campos extra que se muestran para la categoría: los obligatorios de SAGA más los marcados en Configuración
 * (`categorias` = opciones.categorias, con `extras` opcional) o, si nunca se eligió, los predeterminados.
 */
function camposActivos(categoriaId, categorias = []) {
  const todos = camposDe(categoriaId);
  if (!todos.length) return [];
  const conf = (categorias || []).find((c) => String(c.id) === String(categoriaId));
  const marcados = new Set(Array.isArray(conf?.extras) ? conf.extras : PREDETERMINADOS[categoriaId] || []);
  return todos.filter((c) => !esPropioPerfume(categoriaId, c.id) && (c.obligatorio || marcados.has(c.id)));
}

const vacio = (v) => v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/** Qué le falta o está mal en los valores de los campos activos de un nivel (textos para mostrar al usuario). */
function validarExtras(categoriaId, categorias, valores, nivel, contexto = "") {
  const faltan = [];
  const sufijo = contexto ? ` (${contexto})` : "";
  for (const c of camposActivos(categoriaId, categorias).filter((x) => x.nivel === nivel)) {
    const v = valores?.[c.id];
    if (vacio(v)) {
      if (c.obligatorio) faltan.push(`${c.etiqueta}${sufijo}`);
      continue;
    }
    if (c.tipo === "lista" && !(c.opciones || []).includes(v)) faltan.push(`${c.etiqueta}${sufijo} válido para SAGA ("${v}" no está en la lista)`);
    if (c.tipo === "multi" && [].concat(v).some((x) => !(c.opciones || []).includes(x))) faltan.push(`${c.etiqueta}${sufijo}: hay opciones que no están en la lista de SAGA`);
    if (c.tipo === "numero" && Number.isNaN(Number(v))) faltan.push(`${c.etiqueta}${sufijo} debe ser un número`);
    if (c.tipo === "texto" && c.max && String(v).length > c.max) faltan.push(`${c.etiqueta}${sufijo} demasiado largo para SAGA (${String(v).length} de ${c.max} caracteres)`);
  }
  return faltan;
}

/**
 * Valores listos para enviar a SAGA ({ FeedName: texto }) de los campos activos de un nivel. Omite los
 * vacíos y los que no son válidos (no se envía nada que SAGA vaya a rechazar); multi se une con comas.
 */
function atributosExtra(categoriaId, categorias, valores, nivel) {
  const salida = {};
  for (const c of camposActivos(categoriaId, categorias).filter((x) => x.nivel === nivel)) {
    const v = valores?.[c.id];
    if (vacio(v)) continue;
    if (c.tipo === "lista" && !(c.opciones || []).includes(v)) continue;
    if (c.tipo === "multi") {
      const validos = [].concat(v).filter((x) => (c.opciones || []).includes(x));
      if (validos.length) salida[c.id] = validos.join(",");
      continue;
    }
    if (c.tipo === "numero" && Number.isNaN(Number(v))) continue;
    salida[c.id] = String(v).trim();
  }
  return salida;
}

/**
 * Datos de una variante con lo que hereda del producto: el registro sanitario y los campos extra por variante
 * se toman del valor general (`productos.atributos`) mientras la variante no tenga uno propio.
 * `v` usa los nombres de la BD (registro_sanitario, saga_extras).
 */
function heredarVariante(atributos, v) {
  const a = atributos && typeof atributos === "object" ? atributos : {};
  const extras = { ...(a.variante_extras || {}) };
  for (const [k, val] of Object.entries(v.saga_extras || {})) if (!vacio(val)) extras[k] = val;
  return {
    ...v,
    registro_sanitario: vacio(v.registro_sanitario) ? a.registro_sanitario || v.registro_sanitario : v.registro_sanitario,
    saga_extras: extras,
  };
}

/** Limpia lo que llega de un formulario: solo claves alfanuméricas; valores de texto o listas de texto cortos. */
function limpiarValores(entrada) {
  const salida = {};
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return salida;
  for (const [k, v] of Object.entries(entrada)) {
    if (!/^[A-Za-z0-9]{1,60}$/.test(k)) continue;
    if (Array.isArray(v)) {
      const items = v.map((x) => String(x).trim().slice(0, 200)).filter(Boolean);
      if (items.length) salida[k] = items.slice(0, 100);
    } else if (v !== null && v !== undefined && String(v).trim() !== "") {
      salida[k] = String(v).trim().slice(0, 300);
    }
  }
  return salida;
}

module.exports = {
  PERFUME,
  PREDETERMINADOS,
  esCategoriaGeneral,
  camposDe,
  esPropioPerfume,
  camposActivos,
  validarExtras,
  atributosExtra,
  heredarVariante,
  limpiarValores,
};
