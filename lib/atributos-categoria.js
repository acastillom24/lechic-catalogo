/**
 * Atributos propios del producto por categoría web. Módulo de datos puros (servidor y cliente).
 *
 * Se definen en Configuración → Integraciones → Web → «Atributos por categoría»: hay un catálogo único de atributos de la web
 * (clave `atributos_catalogo`) y por cada categoría se activan los que se muestran; lo activo se guarda en `atributos_categoria`:
 *   { "<slug categoría web>": [ { id, etiqueta, tipo: "lista" | "multi" | "texto", opciones?: string[], grupo } ] }
 * `grupo` = apartado del formulario donde se muestra (ver lib/campos-web.js); por defecto «detalles».
 * El nombre, tipo y opciones son solo de la web. La equivalencia con cada plataforma vive aparte (lib/equivalencias.js).
 * Cada producto guarda sus valores en `productos.atributos.propios` como { [id]: texto | [textos] }.
 */
const { camposDe } = require("./saga-campos");
const { esGrupoValido, GRUPO_PREDETERMINADO } = require("./campos-web");

const TIPOS = ["lista", "multi", "texto", "numero"];
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Identificador estable a partir de la etiqueta (minúsculas, sin tildes, con guiones bajos). */
const idDeEtiqueta = (t) =>
  String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

/** Deja el catálogo con la forma válida (lo guardado a mano o antiguo no rompe el formulario). */
function normalizarCatalogo(crudo) {
  const salida = {};
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return salida;
  for (const [slug, lista] of Object.entries(crudo)) {
    if (!Array.isArray(lista)) continue;
    const ids = new Set();
    const attrs = [];
    for (const a of lista) {
      const etiqueta = String(a?.etiqueta || "").trim();
      const id = String(a?.id || idDeEtiqueta(etiqueta));
      if (!etiqueta || !id || ids.has(id) || !TIPOS.includes(a?.tipo)) continue;
      ids.add(id);
      const opciones = a.tipo === "texto" || a.tipo === "numero" ? [] : [...new Set((Array.isArray(a.opciones) ? a.opciones : []).map((o) => String(o).trim()).filter(Boolean))];
      // `virtual` solo lo pone completarPorDefecto (atributo creado en memoria por defecto, aún no guardado).
      // El apartado «medida» ya no existe: sus atributos pasan a «Perfil del producto» (id `aromas`).
      const grupoGuardado = a.grupo === "medida" ? "aromas" : a.grupo;
      const grupo = esGrupoValido(grupoGuardado) ? grupoGuardado : GRUPO_PREDETERMINADO;
      // Largo mínimo/máximo (solo texto libre).
      const largo = (v) => (a.tipo === "texto" && Number.isInteger(Number(v)) && Number(v) > 0 ? { v: Number(v) } : null);
      const min = largo(a.min)?.v;
      const max = largo(a.max)?.v;
      attrs.push({ id, etiqueta, tipo: a.tipo, opciones, grupo, ...(min ? { min } : {}), ...(max ? { max } : {}), ...(a.virtual === true ? { virtual: true } : {}) });
    }
    if (attrs.length) salida[slug] = attrs;
  }
  return salida;
}

/**
 * Catálogo único de atributos de la web: las definiciones guardadas aparte (incluso las que no están activas en ninguna
 * categoría) más las de las listas por categoría. Si un id se repite, manda la primera definición.
 */
function unirCatalogo(guardado, porSlug) {
  const salida = [];
  const vistos = new Set();
  const propias = normalizarCatalogo({ _: guardado })._ || [];
  for (const a of [...propias, ...Object.values(porSlug || {}).flat()]) {
    if (vistos.has(a.id)) continue;
    vistos.add(a.id);
    salida.push(a);
  }
  return salida;
}

/** Atributos que corresponden a la categoría web del producto. */
const atributosDe = (catalogo, slug) => (catalogo && catalogo[slug]) || [];

/** Valores válidos para la categoría: solo atributos definidos, sin vacíos, y las opciones deben existir en la lista. */
function limpiarPropios(catalogo, slug, valores) {
  const salida = {};
  for (const a of atributosDe(catalogo, slug)) {
    const v = valores?.[a.id];
    if (a.tipo === "multi") {
      const marcados = (Array.isArray(v) ? v : []).map(String).filter((x) => a.opciones.includes(x));
      if (marcados.length) salida[a.id] = [...new Set(marcados)];
    } else if (a.tipo === "lista") {
      if (typeof v === "string" && a.opciones.includes(v)) salida[a.id] = v;
    } else if (a.tipo === "numero") {
      // Número válido (como texto, para no perder decimales).
      const t = String(v ?? "").trim().replace(",", ".");
      if (t !== "" && Number.isFinite(Number(t))) salida[a.id] = t;
    } else if (typeof v === "string" && v.trim()) {
      salida[a.id] = v.trim().slice(0, a.max || 200);
    }
  }
  return salida;
}

/** ¿Un campo de SAGA admite los valores de este atributo? (varias opciones ↔ multi, una ↔ lista, texto o número ↔ texto/número) */
const compatible = (attr, campo) =>
  attr.tipo === "multi" ? campo.tipo === "multi" : attr.tipo === "lista" ? campo.tipo === "lista" : campo.tipo === "texto" || campo.tipo === "numero";

/** Campos de la categoría SAGA que se pueden enlazar a atributos propios (los de perfumes ya tienen su formulario). */
function camposEnlazables(sagaCategoria) {
  const propiosPerfume = new Set(["FraganciaPerfume", "CantidadContenidaEnElEmpaque", "FormatoBelleza", "Genero", "TipoDePerfume", "CantidadPerfumesVariant", "NotasAromaticas", "Caracteristicas"]);
  return camposDe(sagaCategoria).filter((c) => String(sagaCategoria) !== "1735" || !propiosPerfume.has(c.id));
}

/**
 * Pasa los valores de los atributos web a los campos de SAGA equivalentes (producto o variante, según el nivel del
 * campo en la categoría). `op` = opciones de SAGA (trae `atributosCategoria` y `equivalencias`). Solo viajan los campos
 * enlazados a un atributo web; el atributo manda sobre un valor del mismo campo cargado antes.
 * Devuelve { extras, varianteExtras } nuevos.
 */
// Para comparar con las opciones de SAGA: "..." (tres puntos) = "…" (SAGA lo usa como opción), sin mayúsculas ni tildes.
const claveOpcion = (t) => String(t ?? "").trim().replace(/\.{3}/g, "…").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Valor web → opción exacta de SAGA (lista o multi); si ninguna coincide se deja igual y la validación lo informa. */
function aOpcionSaga(campo, v) {
  if (campo.tipo !== "lista" && campo.tipo !== "multi") return v;
  const opciones = campo.opciones || [];
  const una = (x) => opciones.find((o) => claveOpcion(o) === claveOpcion(x)) ?? x;
  return Array.isArray(v) ? v.map(una) : una(v);
}

function extrasConPropios(op, webSlug, sagaCategoria, propios, extras = {}, varianteExtras = {}) {
  const salida = { extras: { ...extras }, varianteExtras: { ...varianteExtras } };
  const campos = camposDe(sagaCategoria);
  const mapa = mapaCampos(op?.equivalencias, webSlug, "saga", sagaCategoria);
  for (const [campoId, atributoId] of Object.entries(mapa)) {
    const v = propios?.[atributoId];
    const vacio = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    const campo = campos.find((c) => c.id === campoId);
    if (vacio || !campo) continue;
    (campo.nivel === "variante" ? salida.varianteExtras : salida.extras)[campo.id] = aOpcionSaga(campo, v);
  }
  return salida;
}

/**
 * Convierte lo traído de SAGA ({ FeedName: valor }) en valores de los atributos web enlazados; solo los que traen dato.
 * `mapa` = { campoSaga: atributoWebId } de esa categoría; `attrs` = atributos web de la categoría.
 */
function propiosDesdeSaga(attrs, mapa, extrasSaga) {
  const valores = {};
  const avisos = [];
  const buscar = (opciones, t) => opciones.find((o) => norm(o) === norm(t));
  for (const [campoId, atributoId] of Object.entries(mapa || {})) {
    const a = (attrs || []).find((x) => x.id === atributoId);
    if (!a) continue;
    const crudo = extrasSaga?.[campoId];
    const lista = (Array.isArray(crudo) ? crudo : String(crudo ?? "").split(",")).map((x) => String(x).trim()).filter(Boolean);
    if (!lista.length) continue;
    if (a.tipo === "numero") {
      const n = lista[0].replace(",", ".");
      if (Number.isFinite(Number(n))) valores[a.id] = n;
      else avisos.push(`«${a.etiqueta}»: «${lista[0]}» de SAGA no es un número.`);
    } else if (a.tipo === "texto") {
      valores[a.id] = lista.join(", ");
    } else {
      const ok = lista.map((t) => buscar(a.opciones, t));
      lista.forEach((t, i) => {
        if (!ok[i]) avisos.push(`«${a.etiqueta}»: «${t}» de SAGA no está en sus opciones (Configuración → Integraciones → Web).`);
      });
      const validos = ok.filter(Boolean);
      if (validos.length) valores[a.id] = a.tipo === "multi" ? [...new Set(validos)] : validos[0];
    }
  }
  return { valores, avisos };
}

// Mapa de equivalencias { campoPlataforma: atributoWebId } de (categoría web, plataforma, categoría de la plataforma).
function mapaCampos(eq, webSlug, plataforma, catId) {
  return (eq && eq.atributos && eq.atributos[webSlug] && eq.atributos[webSlug][plataforma] && eq.atributos[webSlug][plataforma][String(catId)]) || {};
}
module.exports = { TIPOS, idDeEtiqueta, normalizarCatalogo, unirCatalogo, atributosDe, limpiarPropios, compatible, camposEnlazables, extrasConPropios, propiosDesdeSaga, mapaCampos };
