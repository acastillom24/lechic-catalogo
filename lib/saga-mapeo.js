/**
 * Mapeo producto/variante de la web → campos de SAGA (perfumes).
 * Los nombres de ProductData y el id de PrimaryCategory se afinan con
 * GetCategoryAttributes en la prueba (scripts/saga-probar.js).
 */

// Perfumería = estas categorías de data/marcas.js. make-up llega en la fase 2.
const CATEGORIAS_PERFUME = ["feminine", "masculine", "couples"];
const GENERO_POR_CATEGORIA = { feminine: "Mujer", masculine: "Hombre", couples: "Unisex" };

// Longitudes máximas de SAGA (MaxLength de GetCategoryAttributes, categoría 1735).
const LIMITES = { texto: 172, categoria: 6, dimension: 6, peso: 10 };

function esPerfume(categoria) {
  return CATEGORIAS_PERFUME.includes(categoria);
}

const { esCategoriaGeneral, validarExtras, atributosExtra, imagenesRequeridas, camposDe, alternosDeVariante } = require("./saga-campos");
const { htmlATexto } = require("./html-texto");
const { CAMPOS_WEB, esLibre, porId } = require("./campos-web");
const { campoGeneralActivo, sagaAdmite, activoEnCategoriaSaga, destinoGeneral } = require("./equivalencias");

// `op` = listas de SAGA (aromas, medidas, tipos, condiciones, formato, marcas) que
// entrega getOpcionesSaga() (lib/saga-opciones.js).
const quitarTildes = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Aromas de la web que coinciden con la lista de SAGA, y los que no. */
function fraganciasValidas(lista, op) {
  const validos = [], invalidos = [];
  for (const a of lista) {
    const m = op.aromas.find((x) => quitarTildes(x) === quitarTildes(a));
    if (m) validos.push(m); else invalidos.push(a);
  }
  return { validos: [...new Set(validos)], invalidos };
}

/** "50ml" / "50 ml" -> "50 ML" (formato de CantidadPerfumesVariant). */
function normalizarVolumen(v, op) {
  const t = String(v || "").trim();
  // Si ya es una medida exacta de SAGA (ej. "8ML", "40ML", "50 ML") se respeta tal cual.
  if (op.cantidades.includes(t)) return t;
  return t.replace(/^(\d+(?:[.,]\d+)?)\s*ml$/i, (_, n) => `${n.replace(",", ".")} ML`);
}

/** Nombre que se envía a SAGA: producto + variante (salvo "Único"). */
// Nombre que recibe SAGA: «producto + variante», salvo variante «Único» o con el check de combinar desmarcado.
// Con una sola variante (`es_unica`) el título es solo el nombre del producto, sea cual sea el nombre interno de la variante
// y acepte o no la categoría variantes. Con varias, se combina salvo que la variante lo desactive o se llame «Único».
// Con una sola variante el producto se trata a nivel de producto: los avisos no mencionan la variante.
const qv = (v) => (v.es_unica ? "" : ` (${v.nombre})`);
// SAGA recibe solo el nombre del producto (Producto y garantía); lo que distingue a las variantes va en sus atributos.
const nombreSaga = (p) => p.nombre;

const falta = (v) => v === null || v === undefined || String(v).trim() === "";

// Reglas de calidad que SAGA pide para el contenido (afectan su calificación). Son avisos: no frenan el envío.
const CALIDAD = { tituloMin: 20, tituloMax: 100, descripcionMin: 50 };

/** Avisos de calidad de una variante: título de 20 a 100 caracteres y descripción de al menos 50. */
function advertenciasSaga(p, v) {
  const avisos = [];
  const titulo = String(nombreSaga(p, v) || "").trim();
  if (titulo.length < CALIDAD.tituloMin || titulo.length > CALIDAD.tituloMax) {
    avisos.push(
      `Título${v.es_unica ? "" : ` de "${v.nombre}"`}: SAGA pide entre ${CALIDAD.tituloMin} y ${CALIDAD.tituloMax} caracteres y tiene ${titulo.length}.`
    );
  }
  const descripcion = htmlATexto(falta(v.descripcion) ? p.descripcion : v.descripcion);
  if (descripcion.length < CALIDAD.descripcionMin) {
    avisos.push(
      `Descripción${v.es_unica ? "" : ` de "${v.nombre}"`}: SAGA pide al menos ${CALIDAD.descripcionMin} caracteres y tiene ${descripcion.length}.`
    );
  }
  return avisos;
}

// Aromas que van a FraganciaPerfume: los de SAGA elegidos en la variante o, si no hay, los del producto. Solo valen opciones
// de la lista de SAGA.
const aromasDe = (p, v, op) => fraganciasValidas(v.fragancia_perfume && v.fragancia_perfume.length ? v.fragancia_perfume : p.fragancia_perfume || [], op).validos;

// Cantidad contenida en el empaque: la escrita o, si falta, la medida sin espacios ("100 ML" -> "100ML").
const cantidadEmpaque = (v, op) => (falta(v.cantidad_empaque) ? normalizarVolumen(v.volumen, op).replace(/\s+/g, "") : String(v.cantidad_empaque).trim());
const generoDe = (p) => p.genero || GENERO_POR_CATEGORIA[p.categoria] || "";
// Notas aromáticas (texto libre) de la variante; la variante hereda las del producto (ver lib/atributos-efectivos.js).
const notasDe = (v) => String(v.notas_aromaticas || "").trim();
const caracteristicasDe = (p, op) => {
  const pedidas = String(p.caracteristicas || "").split(",").map((x) => x.trim()).filter(Boolean);
  const validas = [], invalidas = [];
  for (const c of pedidas) {
    const m = (op.caracteristicas || []).find((x) => quitarTildes(x) === quitarTildes(c));
    if (m) validas.push(m); else invalidas.push(c);
  }
  return { validas: [...new Set(validas)], invalidas };
};

/**
 * Devuelve la lista de campos que faltan (o no son válidos) para publicar. Obligatorios según
 * GetCategoryAttributes de la categoría de perfumes; el resto (modelo, país, notas, características,
 * contenido del paquete, código de barras) son opcionales en SAGA.
 */
function validarPerfume(p, v, op) {
  const faltan = [];
  const genero = generoDe(p);
  const req = [
    ["Nombre", p.nombre],
    ["Marca disponible en SAGA (" + p.marca + ")", op.marcas[p.marca]],
    ["Categoría primaria SAGA", p.saga_categoria],
    [`Descripción${qv(v)}`, falta(v.descripcion) ? p.descripcion : v.descripcion],
    [`Registro sanitario${qv(v)}`, v.registro_sanitario],
    ["Tipo de perfume", p.tipo_perfume],
    ["Género", genero],
    ["Formato belleza", p.formato_belleza],
    ["Condición", p.condicion || "Nuevo"],
    ["Ancho del paquete", p.paquete_ancho],
    ["Largo del paquete", p.paquete_largo],
    ["Alto del paquete", p.paquete_alto],
    ["Peso del paquete", p.paquete_peso],
    [`SKU${qv(v)}`, v.sku],
    [`Precio${qv(v)}`, v.precio],
    [`Medida del frasco${qv(v)}`, v.volumen],
    [`Cantidad contenida en el empaque${qv(v)}`, cantidadEmpaque(v, op)],
  ];
  for (const [n, val] of req) if (falta(val)) faltan.push(n);
  faltan.push(...validarImagenes(p, v, op));

  const enLista = (n, val, lista) => {
    if (!falta(val) && !(lista || []).includes(val)) faltan.push(`${n} válido para SAGA ("${val}" no está en la lista)`);
  };
  enLista("Tipo de perfume", p.tipo_perfume, op.tiposPerfume);
  enLista("Condición", p.condicion || "Nuevo", op.condiciones);
  enLista("Género", genero, op.generos);
  enLista("Formato belleza", p.formato_belleza, op.formatosBelleza);
  enLista("País de producción", p.pais_produccion, op.paises);
  if (!aromasDe(p, v, op).length) faltan.push(`Fragancia${qv(v)}: al menos una de la lista de SAGA`);
  const { invalidas } = caracteristicasDe(p, op);
  if (invalidas.length) faltan.push(`Características no válidas en SAGA: ${invalidas.join(", ")}`);
  faltan.push(...validarExtras(p.saga_categoria, op.categorias, p.saga_extras, "producto"));

  const largo = (n, val, max) => {
    if (!falta(val) && String(val).length > max) faltan.push(`${n} demasiado largo para SAGA (${String(val).length} de ${max} caracteres)`);
  };
  largo(`Nombre${qv(v)}`, nombreSaga(p, v), lim(op, "nombre", LIMITES.texto));
  largo("Modelo", p.modelo, lim(op, "modelo", LIMITES.texto));
  largo(`Registro sanitario${qv(v)}`, v.registro_sanitario, lim(op, "registroSanitario", LIMITES.texto));
  largo(`Notas aromáticas${qv(v)}`, notasDe(v), lim(op, "notasAromaticas", LIMITES.texto));
  largo("Contenido del paquete", p.contenido_paquete, lim(op, "contenidoPaquete", LIMITES.texto));
  largo(`Cantidad contenida en el empaque${qv(v)}`, cantidadEmpaque(v, op), lim(op, "cantidadEmpaque", LIMITES.texto));
  largo(`SKU${qv(v)}`, v.sku, LIMITES.texto);
  largo("Categoría primaria SAGA", p.saga_categoria, LIMITES.categoria);
  largo("Ancho del paquete", p.paquete_ancho, lim(op, "paqueteAncho", LIMITES.dimension));
  largo("Largo del paquete", p.paquete_largo, lim(op, "paqueteLargo", LIMITES.dimension));
  largo("Alto del paquete", p.paquete_alto, lim(op, "paqueteAlto", LIMITES.dimension));
  largo("Peso del paquete", p.paquete_peso, lim(op, "paquetePeso", LIMITES.peso));
  if (v.precio_oferta != null && (!v.oferta_inicio || !v.oferta_fin)) {
    faltan.push(`Fechas de oferta (desde y hasta) para el precio de oferta${qv(v)}: SAGA las exige`);
  }
  return faltan;
}

/**
 * Validación para categorías que no son perfumes (maquillaje, cuidado de la piel…): campos comunes más los
 * extras de la categoría (lib/saga-campos.js), por producto y por variante. Mismas reglas de límites que perfumes.
 */
function validarGeneral(p, v, op) {
  const faltan = [];
  const req = [
    ["Nombre", p.nombre],
    ["Marca disponible en SAGA (" + p.marca + ")", op.marcas[p.marca]],
    ["Categoría primaria SAGA", p.saga_categoria],
    [`Descripción${qv(v)}`, falta(v.descripcion) ? p.descripcion : v.descripcion],
    [`Registro sanitario${qv(v)}`, v.registro_sanitario],
    ["Condición", p.condicion || "Nuevo"],
    ["Ancho del paquete", p.paquete_ancho],
    ["Largo del paquete", p.paquete_largo],
    ["Alto del paquete", p.paquete_alto],
    ["Peso del paquete", p.paquete_peso],
    [`SKU${qv(v)}`, v.sku],
    [`Precio${qv(v)}`, v.precio],
  ];
  for (const [n, val] of req) if (falta(val)) faltan.push(n);
  faltan.push(...validarImagenes(p, v, op));
  if (!falta(p.condicion || "Nuevo") && !(op.condiciones || []).includes(p.condicion || "Nuevo")) faltan.push(`Condición válida para SAGA ("${p.condicion}" no está en la lista)`);
  if (!falta(p.pais_produccion) && !(op.paises || []).includes(p.pais_produccion)) faltan.push(`País de producción válido para SAGA ("${p.pais_produccion}" no está en la lista)`);

  faltan.push(...validarExtras(p.saga_categoria, op.categorias, p.saga_extras, "producto"));
  faltan.push(...validarExtras(p.saga_categoria, op.categorias, v.saga_extras, "variante", v.es_unica ? "" : v.nombre, alternosDeVariante(v)));

  const largo = (n, val, max) => {
    if (!falta(val) && String(val).length > max) faltan.push(`${n} demasiado largo para SAGA (${String(val).length} de ${max} caracteres)`);
  };
  largo(`Nombre${qv(v)}`, nombreSaga(p, v), lim(op, "nombre", LIMITES.texto));
  largo("Modelo", p.modelo, lim(op, "modelo", LIMITES.texto));
  largo(`Registro sanitario${qv(v)}`, v.registro_sanitario, lim(op, "registroSanitario", LIMITES.texto));
  largo("Contenido del paquete", p.contenido_paquete, lim(op, "contenidoPaquete", LIMITES.texto));
  largo(`SKU${qv(v)}`, v.sku, LIMITES.texto);
  largo("Categoría primaria SAGA", p.saga_categoria, LIMITES.categoria);
  largo("Ancho del paquete", p.paquete_ancho, lim(op, "paqueteAncho", LIMITES.dimension));
  largo("Largo del paquete", p.paquete_largo, lim(op, "paqueteLargo", LIMITES.dimension));
  largo("Alto del paquete", p.paquete_alto, lim(op, "paqueteAlto", LIMITES.dimension));
  largo("Peso del paquete", p.paquete_peso, lim(op, "paquetePeso", LIMITES.peso));
  if (v.precio_oferta != null && (!v.oferta_inicio || !v.oferta_fin)) {
    faltan.push(`Fechas de oferta (desde y hasta) para el precio de oferta${qv(v)}: SAGA las exige`);
  }
  return faltan;
}

/** Imágenes de una variante: la lista `imagenes` o, si está vacía, la imagen única de siempre. */
function listaImagenes(v) {
  const l = Array.isArray(v?.imagenes) ? v.imagenes.filter((u) => u && String(u).trim()) : [];
  return l.length ? l : v?.imagen ? [v.imagen] : [];
}

/** Imágenes que se envían a SAGA: las de la variante, hasta el máximo de su categoría, como JPG de Cloudinary. */
function imagenesParaSaga(p, v, op) {
  const { max } = imagenesRequeridas(p.saga_categoria, op?.categorias);
  return listaImagenes(v).filter((u) => /^https:\/\//i.test(String(u))).slice(0, max).map(urlImagenSaga);
}

/** Qué falta en las imágenes de la variante: el mínimo que pide la categoría de SAGA y que sean URL https. */
function validarImagenes(p, v, op) {
  const faltan = [];
  const lista = listaImagenes(v);
  const { min } = imagenesRequeridas(p.saga_categoria, op?.categorias);
  if (lista.length < min) {
    faltan.push(min === 1 ? `Imagen principal${qv(v)}` : `Imágenes${qv(v)}: SAGA pide ${min} para esta categoría, hay ${lista.length}`);
  }
  if (lista.some((u) => !/^https:\/\//i.test(String(u)))) faltan.push(`Imágenes${qv(v)} deben ser URL https`);
  return faltan;
}

/** Valida según la categoría primaria del producto: perfumes o general (con campos extra). */
function validarProducto(p, v, op) {
  const faltan = esCategoriaGeneral(p.saga_categoria) ? validarGeneral(p, v, op) : validarPerfume(p, v, op);
  // Garantía y envío: largos de SAGA y garantía de la lista.
  for (const [n, val, id] of [["Nombre del producto en chino", p.name_cn, "nameCn"], ["Nombre del producto en inglés", p.name_en, "nameEn"]]) {
    const max = lim(op, id, LIMITES.texto);
    if (!falta(val) && String(val).length > max) faltan.push(`${n} demasiado largo para SAGA (${String(val).length} de ${max} caracteres)`);
  }
  faltan.push(...validarRequisitosWeb(p, v, op));
  if (!falta(p.garantia) && !(op?.garantias || GARANTIAS).includes(String(p.garantia).trim())) faltan.push(`Garantía válida para SAGA ("${p.garantia}" no está en la lista)`);
  // Campos que la categoría de SAGA pide como obligatorios y se dejaron en «No usar» (Integraciones → SAGA).
  for (const def of CAMPOS_WEB.filter((d) => d.porSaga && esLibre(d))) {
    const campo = p.saga_categoria ? camposDe(p.saga_categoria).find((c) => c.id === def.saga) : null;
    if (campo && campo.obligatorio && !activoEnCategoriaSaga(op?.equivalencias, p.saga_categoria, def)) {
      faltan.push(`${def.etiqueta}: SAGA ${p.saga_categoria} lo pide y no tiene equivalente (Integraciones → SAGA)`);
    }
  }
  faltan.push(...validarReasignados(p, v, op));
  return faltan;
}

/** Largo máximo de un campo: el de SAGA o, si la web define uno más estricto (Integraciones → Web → ✎), ese. */
const lim = (op, id, defecto) => {
  const web = op && op.equivalencias && op.equivalencias.camposWeb && op.equivalencias.camposWeb[id] && op.equivalencias.camposWeb[id].max;
  return web ? Math.min(web, defecto) : defecto; // más estricto que SAGA sí; más flojo nunca
};

/**
 * Requisitos que se definen en la web para cada campo (✎ en Integraciones → Web): largo mínimo y «obligatorio». El largo máximo y las
 * opciones ya los leen las validaciones de arriba y las listas de `op`.
 */
function validarRequisitosWeb(p, v, op) {
  const cw = op && op.equivalencias && op.equivalencias.camposWeb;
  if (!cw) return [];
  const valores = {
    nombre: nombreSaga(p, v), modelo: p.modelo, descripcion: falta(v.descripcion) ? p.descripcion : v.descripcion, paisProduccion: p.pais_produccion,
    condicion: p.condicion, nameCn: p.name_cn, nameEn: p.name_en, detalleCondicion: p.detalle_condicion, detalleGarantia: p.detalle_garantia,
    garantia: p.garantia, contenidoPaquete: p.contenido_paquete, paqueteAncho: p.paquete_ancho, paqueteLargo: p.paquete_largo,
    paqueteAlto: p.paquete_alto, paquetePeso: p.paquete_peso, registroSanitario: v.registro_sanitario, notasAromaticas: notasDe(v),
    cantidadEmpaque: v.cantidad_empaque, caracteristicas: p.caracteristicas, tipoPerfume: p.tipo_perfume, genero: generoDe(p),
    formatoBelleza: p.formato_belleza, volumen: v.volumen, fraganciaPerfume: aromasDe(p, v, op).join(","),
  };
  const faltan = [];
  for (const [id, req] of Object.entries(cw)) {
    if (!(id in valores)) continue;
    const def = porId(id);
    const porVariante = ["nombre", "descripcion", "registroSanitario", "notasAromaticas", "cantidadEmpaque", "volumen", "fraganciaPerfume"].includes(id);
    const nombre = `${(req.etiqueta || (def && def.etiqueta) || id)}${porVariante ? qv(v) : ""}`;
    const valor = valores[id];
    if (req.obligatorio && falta(valor)) faltan.push(`${nombre}: es obligatorio`);
    if (req.min && !falta(valor) && String(valor).length < req.min) faltan.push(`${nombre}: debe tener al menos ${req.min} caracteres (tiene ${String(valor).length})`);
  }
  return faltan;
}

// Campos de SAGA que no pueden quedar vacíos en el alta.
const REQUERIDOS_SAGA = new Set(["Name", "Brand", "Description", "SellerSku", "Price", "ConditionType", "PackageWidth", "PackageLength", "PackageHeight", "PackageWeight", "RegistroSanitario"]);

/**
 * Con campos generales cruzados (Integraciones → SAGA → Campos generales) la validación normal revisa los datos originales, pero a SAGA
 * llega el valor del otro campo. Aquí se arma el alta ya cruzada y se revisa lo que realmente va en cada campo reasignado: que no quede
 * vacío si SAGA lo exige, que el texto no pase del largo permitido y que un número sea un número.
 */
function validarReasignados(p, v, op) {
  const o = op?.equivalencias?.equivGenerales;
  if (!o || !Object.keys(o).length) return [];
  let datos;
  try {
    datos = datosProducto(p, v, op);
  } catch {
    return [];
  }
  const faltan = [];
  for (const campoSaga of Object.keys(o)) {
    const def = CAMPOS_WEB.find((c) => c.saga === campoSaga);
    if (!def) continue;
    const origen = destinoGeneral(op.equivalencias, campoSaga);
    const valor = valorDeCampo(datos, def);
    const nombre = `${def.etiqueta} (SAGA ${campoSaga}${origen ? `, con el valor de «${origen.etiqueta}»` : ", sin equivalente"})`;
    const vacio = valor === undefined || valor === null || String(valor).trim() === "" || (Array.isArray(valor) && !valor.length);
    if (vacio) {
      if (REQUERIDOS_SAGA.has(campoSaga)) faltan.push(`${nombre}: SAGA lo exige y quedó vacío`);
      continue;
    }
    if (def.tipo === "fecha" && !/^\d{4}-\d{2}-\d{2}/.test(String(valor).trim())) faltan.push(`${nombre}: debe ser una fecha (AAAA-MM-DD) y llega "${String(valor).slice(0, 30)}"`);
    else if (def.tipo === "numero" && Number.isNaN(Number(valor))) faltan.push(`${nombre}: debe ser un número y llega "${String(valor).slice(0, 30)}"`);
    else if (def.tipo === "texto" && campoSaga !== "Description" && String(valor).length > LIMITES.texto) {
      faltan.push(`${nombre}: demasiado largo para SAGA (${String(valor).length} de ${LIMITES.texto} caracteres)`);
    }
  }
  return faltan;
}

/**
 * Stock que se publica en SAGA. Colchón: con control de cantidad, al llegar al stock mínimo
 * (o por debajo) se publica 0, para no vender las últimas unidades mientras SAGA procesa pedidos.
 */
function stockParaSaga(v) {
  if (v.activo === false) return 0;
  // Pack: el stock se calcula con sus componentes (lib/packs.js adjuntarStockPack → pack_stock).
  if (v.es_pack) return Math.max(0, Number(v.pack_stock) || 0);
  if (v.stock_actual === null || v.stock_actual === undefined) return v.stock ? 1 : 0;
  const minimo = Number(v.stock_minimo || 0);
  return Number(v.stock_actual) > minimo ? Number(v.stock_actual) : 0;
}

/**
 * URL de la imagen principal para SAGA. Las fotos de la web se guardan en WebP; si la URL es de
 * Cloudinary se pide la misma imagen como JPG (sin volver a subirla) y con fondo blanco.
 */
function urlImagenSaga(url) {
  const t = String(url || "").trim();
  const m = t.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+?)(\.[a-z0-9]+)?$/i);
  return m ? `${m[1]}f_jpg,q_90,b_white/${m[2]}.jpg` : t;
}

const fecha = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// Opciones del desplegable «Garantía del proveedor» (SellerWarranty) de SAGA.
const GARANTIAS = ["1 mes", "2 meses", "3 meses", "6 meses", "9 meses", "1 año", "15 meses", "18 meses", "2 años", "3 años", "4 años", "5 años", "6 años", "7 años", "8 años", "9 años", "10 años"];

/** Campos generales de «Garantía y envío» (NameCn, NameEn, detalle de condición y de garantía, garantía): solo los que tienen valor. */
function datosGarantia(p, op) {
  const salida = {};
  const t = (x) => String(x ?? "").trim();
  if (t(p.name_cn)) salida.NameCn = t(p.name_cn);
  if (t(p.name_en)) salida.NameEn = t(p.name_en);
  if (t(p.detalle_condicion)) salida.ConditionTypeNote = t(p.detalle_condicion);
  if (t(p.detalle_garantia)) salida.ProductWarranty = t(p.detalle_garantia);
  if ((op?.garantias || GARANTIAS).includes(t(p.garantia))) salida.SellerWarranty = t(p.garantia);
  return salida;
}

function datosPerfume(p, v, op) {
  const volumen = normalizarVolumen(v.volumen, op);
  return {
    sellerSku: v.sku,
    // Con SKU padre SAGA agrupa las variantes en una ficha. Sin él, la variante es su propio padre (como en todos los
    // productos de SAGA): hay categorías sin atributos de variación y SAGA rechaza el alta sin ParentSku.
    parentSku: p.usar_sku_padre ? p.sku_padre || p.id : v.sku,
    nombre: nombreSaga(p, v),
    descripcion: falta(v.descripcion) ? p.descripcion : v.descripcion,
    marca: op.marcas[p.marca],
    precio: v.precio,
    precioOferta: v.precio_oferta,
    ofertaInicio: fecha(v.oferta_inicio),
    ofertaFin: fecha(v.oferta_fin),
    variacion: volumen,
    categoriaPrimaria: p.saga_categoria || null,
    stock: stockParaSaga(v),
    codigoBarras: v.codigo_barras,
    imagenes: imagenesParaSaga(p, v, op),
    productData: {
      // SAGA guarda estos datos dentro de ProductData (así los devuelve GetProducts).
      Model: p.modelo,
      ProductionCountry: p.pais_produccion,
      PackageContent: p.contenido_paquete,
      PackageWidth: p.paquete_ancho,
      PackageLength: p.paquete_largo,
      PackageHeight: p.paquete_alto,
      PackageWeight: p.paquete_peso,
      FraganciaPerfume: aromasDe(p, v, op).join(","),
      RegistroSanitario: v.registro_sanitario,
      CantidadContenidaEnElEmpaque: cantidadEmpaque(v, op),
      FormatoBelleza: p.formato_belleza || "Frasco",
      Genero: generoDe(p) || "Unisex",
      TipoDePerfume: p.tipo_perfume,
      // Notas aromáticas = los aromas (texto libre) de la variante.
      NotasAromaticas: notasDe(v),
      Caracteristicas: caracteristicasDe(p, op).validas.join(","),
      ConditionType: p.condicion || "Nuevo",
      ...datosGarantia(p, op),
      // Campos extra elegidos en Configuración → SAGA para perfumes (instrucciones de uso, garantía…).
      ...atributosExtra(p.saga_categoria, op.categorias, p.saga_extras, "producto"),
    },
  };
}

/**
 * Datos de alta para categorías que no son perfumes: solo lo común (nombre, marca, precio, paquete, registro
 * sanitario, condición) más los campos extra de la categoría: por producto dentro de ProductData y por
 * variante como etiquetas de primer nivel (`atributosVariante`: color, variante…).
 */
function datosGeneral(p, v, op) {
  return {
    sellerSku: v.sku,
    // Sin SKU padre la variante es su propio padre: SAGA rechaza el alta sin ParentSku ("Variation attributes section is missing").
    parentSku: p.usar_sku_padre ? p.sku_padre || p.id : v.sku,
    nombre: nombreSaga(p, v),
    descripcion: falta(v.descripcion) ? p.descripcion : v.descripcion,
    marca: op.marcas[p.marca],
    precio: v.precio,
    precioOferta: v.precio_oferta,
    ofertaInicio: fecha(v.oferta_inicio),
    ofertaFin: fecha(v.oferta_fin),
    categoriaPrimaria: p.saga_categoria || null,
    stock: stockParaSaga(v),
    codigoBarras: v.codigo_barras,
    imagenes: imagenesParaSaga(p, v, op),
    atributosVariante: atributosExtra(p.saga_categoria, op.categorias, v.saga_extras, "variante", alternosDeVariante(v)),
    productData: {
      Model: p.modelo,
      ProductionCountry: p.pais_produccion,
      PackageContent: p.contenido_paquete,
      PackageWidth: p.paquete_ancho,
      PackageLength: p.paquete_largo,
      PackageHeight: p.paquete_alto,
      PackageWeight: p.paquete_peso,
      RegistroSanitario: v.registro_sanitario,
      ConditionType: p.condicion || "Nuevo",
      ...datosGarantia(p, op),
      ...atributosExtra(p.saga_categoria, op.categorias, p.saga_extras, "producto"),
    },
  };
}

// Valor de cada campo general libre que no viaja de base en las categorías generales (ProductData de SAGA).
const VALOR_GENERAL = {
  tipoPerfume: (p) => p.tipo_perfume,
  genero: (p) => generoDe(p),
  formatoBelleza: (p) => p.formato_belleza || "Frasco",
  caracteristicas: (p, v, op) => caracteristicasDe(p, op).validas.join(","),
  fraganciaPerfume: (p, v, op) => aromasDe(p, v, op).join(","),
  notasAromaticas: (p, v) => notasDe(v),
  cantidadEmpaque: (p, v, op) => cantidadEmpaque(v, op),
};

/** ¿El campo general (libre) está activo para este producto y SAGA lo admite en su categoría? */
const generalAdmitido = (p, op, def) =>
  campoGeneralActivo(op?.equivalencias, p.categoria, def, [p.saga_categoria]) && sagaAdmite(def, p.saga_categoria) &&
  (!def.porSaga || activoEnCategoriaSaga(op?.equivalencias, p.saga_categoria, def));

// Campos de SAGA que son parte de la estructura del alta (no van en ProductData): clave de SAGA → propiedad del envío armado.
const SLOT_ALTA = {
  Name: "nombre", Brand: "marca", Description: "descripcion", SellerSku: "sellerSku", ProductId: "codigoBarras",
  PrimaryCategory: "categoriaPrimaria", Price: "precio", SpecialPrice: "precioOferta", SpecialFromDate: "ofertaInicio", SpecialToDate: "ofertaFin", Quantity: "stock", "Image1 … Image8": "imagenes",
};
const valorDeCampo = (datos, def) => (SLOT_ALTA[def.saga] ? datos[SLOT_ALTA[def.saga]] : datos.productData[def.saga]);
function ponerCampo(datos, def, v) {
  const vacio = v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);
  if (SLOT_ALTA[def.saga]) datos[SLOT_ALTA[def.saga]] = vacio ? null : v;
  else if (vacio) delete datos.productData[def.saga];
  else datos.productData[def.saga] = v;
}

/**
 * Campos generales reasignados (Integraciones → SAGA → Campos generales): el campo de SAGA lleva el valor del campo de la web elegido
 * (cualquier general, incluidos nombre, precio o stock). Se calcula sobre una copia, así un intercambio no se pisa.
 */
function reasignarGenerales(datos, op) {
  const o = op?.equivalencias?.equivGenerales;
  if (!o || !Object.keys(o).length) return;
  const generales = CAMPOS_WEB.filter((c) => c.saga && !c.porSaga);
  const copia = Object.fromEntries(generales.map((d) => [d.saga, valorDeCampo(datos, d)]));
  for (const campoSaga of Object.keys(o)) {
    const defSaga = generales.find((d) => d.saga === campoSaga);
    const origen = destinoGeneral(op.equivalencias, campoSaga);
    if (defSaga) ponerCampo(datos, defSaga, origen ? copia[origen.saga] : undefined);
  }
}

/**
 * Campos generales libres (ver lib/campos-web.js): se quitan del envío los desactivados en la categoría web y, en categorías
 * generales, se agregan los activados que el catálogo de la categoría de SAGA trae (p. ej. Características en Cosméticos|ojos).
 * Lo enlazado a un atributo propio (Integraciones → SAGA) manda sobre estos valores.
 */
function aplicarGenerales(datos, p, v, op) {
  const pd = datos.productData;
  const general = esCategoriaGeneral(p.saga_categoria);
  for (const def of CAMPOS_WEB.filter(esLibre)) {
    if (!generalAdmitido(p, op, def)) {
      delete pd[def.saga];
      if (def.id === "volumen") datos.variacion = null; // la medida va como variación: sin ella no se envía
      continue;
    }
    const valor = general && VALOR_GENERAL[def.id] ? VALOR_GENERAL[def.id](p, v, op) : null;
    if (valor === null || valor === undefined || valor === "" || def.saga in pd) continue;
    const campo = camposDe(p.saga_categoria).find((c) => c.id === def.saga);
    let envio = valor;
    if (campo && campo.tipo === "multi") envio = String(valor).split(",").filter((x) => (campo.opciones || []).includes(x)).join(",");
    else if (campo && campo.tipo === "lista" && !(campo.opciones || []).includes(valor)) envio = "";
    if (envio) pd[def.saga] = envio;
  }
  reasignarGenerales(datos, op);
  return datos;
}

/** Arma el alta según la categoría primaria del producto: perfumes o general (con campos extra). */
function datosProducto(p, v, op) {
  const datos = esCategoriaGeneral(p.saga_categoria) ? datosGeneral(p, v, op) : datosPerfume(p, v, op);
  return aplicarGenerales(datos, p, v, op);
}

// Atributos que solo existen en el formulario de perfumes: no se envían en otras categorías.
const SOLO_PERFUME = new Set(["tipo_perfume", "genero", "formato_belleza", "aroma", "notas", "caracteristicas", "cantidad_empaque", "medida"]);
// Atributo de una acción de actualización → campo general libre de la web (los desactivados en la categoría no se envían).
const LIBRE_DE_ATRIBUTO = {
  tipo_perfume: "tipoPerfume", genero: "genero", formato_belleza: "formatoBelleza", aroma: "fraganciaPerfume", notas: "notasAromaticas",
  caracteristicas: "caracteristicas", cantidad_empaque: "cantidadEmpaque", pais: "paisProduccion", modelo: "modelo", paquete_contenido: "contenidoPaquete",
};

/**
 * Envío parcial para una acción sobre un SKU que ya existe: solo los `atributos` marcados, y de
 * ellos solo los que tengan valor válido (los vacíos no borran nada en SAGA; los inválidos se
 * omiten y se avisan). Mismo formato que datosPerfume, más `unidad` (¿hay stock/precio/oferta?).
 * `v` debe traer ya el precio efectivo de la cuenta (ver efectivo() en saga-sync).
 */
function datosAccion(p, v, op, atributos) {
  const general = esCategoriaGeneral(p.saga_categoria);
  const permitido = (a) => {
    const def = LIBRE_DE_ATRIBUTO[a] ? porId(LIBRE_DE_ATRIBUTO[a]) : null;
    if (def) return generalAdmitido(p, op, def);
    return !general || !SOLO_PERFUME.has(a);
  };
  const sel = new Set(atributos.filter(permitido));
  const avisos = [];
  const out = { sellerSku: v.sku, productData: {}, imagenes: [] };
  const lista = (valor, opciones, etiqueta) => {
    if (falta(valor)) return null;
    if ((opciones || []).includes(valor)) return valor;
    avisos.push(`${etiqueta} "${valor}" no está en la lista de SAGA: se omite.`);
    return null;
  };
  const dato = (id, clave, valor) => {
    if (sel.has(id) && !falta(valor)) out.productData[clave] = valor;
  };

  if (sel.has("nombre")) {
    const n = nombreSaga(p, v);
    if (String(n).length <= LIMITES.texto) out.nombre = n;
    else avisos.push(`El nombre supera ${LIMITES.texto} caracteres: se omite.`);
  }
  if (sel.has("descripcion")) out.descripcion = falta(v.descripcion) ? p.descripcion : v.descripcion;
  if (sel.has("marca")) out.marca = op.marcas[p.marca];
  if (sel.has("categoria")) out.categoriaPrimaria = p.saga_categoria || null;
  if (sel.has("medida")) out.variacion = normalizarVolumen(v.volumen, op);
  if (sel.has("sku_padre") && p.usar_sku_padre) out.parentSku = p.sku_padre || p.id;
  if (sel.has("codigo_barras")) out.codigoBarras = v.codigo_barras;
  if (sel.has("imagen")) out.imagenes = imagenesParaSaga(p, v, op);

  dato("registro_sanitario", "RegistroSanitario", v.registro_sanitario);
  dato("pais", "ProductionCountry", lista(p.pais_produccion, op.paises, "País"));
  dato("modelo", "Model", p.modelo);
  dato("tipo_perfume", "TipoDePerfume", lista(p.tipo_perfume, op.tiposPerfume, "Tipo de perfume"));
  dato("genero", "Genero", lista(generoDe(p), op.generos, "Género"));
  dato("formato_belleza", "FormatoBelleza", lista(p.formato_belleza, op.formatosBelleza, "Formato belleza"));
  dato("condicion", "ConditionType", lista(p.condicion, op.condiciones, "Condición"));
  dato("aroma", "FraganciaPerfume", aromasDe(p, v, op).join(","));
  dato("notas", "NotasAromaticas", notasDe(v));
  dato("caracteristicas", "Caracteristicas", caracteristicasDe(p, op).validas.join(","));
  dato("cantidad_empaque", "CantidadContenidaEnElEmpaque", cantidadEmpaque(v, op));
  dato("paquete_ancho", "PackageWidth", p.paquete_ancho);
  dato("paquete_largo", "PackageLength", p.paquete_largo);
  dato("paquete_alto", "PackageHeight", p.paquete_alto);
  dato("paquete_peso", "PackageWeight", p.paquete_peso);
  dato("paquete_contenido", "PackageContent", p.contenido_paquete);
  // Campos extra de la categoría: por producto en ProductData, por variante en primer nivel.
  if (sel.has("extras")) {
    Object.assign(out.productData, atributosExtra(p.saga_categoria, op.categorias, p.saga_extras, "producto"));
    out.atributosVariante = atributosExtra(p.saga_categoria, op.categorias, v.saga_extras, "variante", alternosDeVariante(v));
  }

  out.unidad = sel.has("stock") || sel.has("precio") || sel.has("oferta");
  if (sel.has("stock")) out.stock = stockParaSaga(v);
  if (sel.has("precio")) out.precio = v.precio;
  if (sel.has("oferta")) {
    out.precioOferta = v.precio_oferta;
    out.ofertaInicio = fecha(v.oferta_inicio);
    out.ofertaFin = fecha(v.oferta_fin);
  }
  return { datos: out, avisos };
}

/**
 * Convierte un producto de SAGA (GetProducts) en valores para el formulario. Solo datos propios
 * de SAGA: nunca nombre, marca, precio web, imagen, SKU ni stock (la descripción va a la
 * descripción de la variante, no a la del producto en la web).
 * Devuelve { variante, producto, precios, avisos }; los vacíos llegan como "".
 */
function desdeSaga(raw, op, cuenta) {
  const d = { ...raw, ...(raw.ProductData || {}) };
  const avisos = [];
  const txt = (x) => (x === null || x === undefined ? "" : String(x).trim());
  const num = (x) => (txt(x) === "" || Number.isNaN(Number(x)) ? "" : Number(x));
  const dia = (x) => txt(x).slice(0, 10);
  const compacto = (t) => txt(t).replace(/\s+/g, "").toLowerCase();
  // Empareja con una lista configurada; si no está, conserva el valor de SAGA y avisa.
  const deLista = (valor, lista, etiqueta) => {
    const t = txt(valor);
    if (!t) return "";
    const m = (lista || []).find((x) => compacto(x) === compacto(t));
    if (!m) avisos.push(`${etiqueta} "${t}" de SAGA no está en la lista configurada (Configuración → SAGA).`);
    return m || t;
  };

  const unidades = [].concat(raw.BusinessUnits?.BusinessUnit || []).map((u) => (u.BusinessUnit && typeof u.BusinessUnit === "object" ? u.BusinessUnit : u));
  const u = unidades.find((x) => cuenta?.operador && x.OperatorCode === cuenta.operador) || unidades[0] || {};

  const { validos, invalidos } = fraganciasValidas(txt(d.FraganciaPerfume).split(",").map((x) => x.trim()).filter(Boolean), op);
  if (invalidos.length) avisos.push(`Aroma(s) de SAGA fuera de la lista: ${invalidos.join(", ")}.`);
  const caracts = txt(d.Caracteristicas).split(",").map((x) => x.trim()).filter(Boolean).map((c) => deLista(c, op.caracteristicas, "Característica"));

  const categoria = txt(d.PrimaryCategoryId);
  if (categoria && !(op.categorias || []).some((c) => c.id === categoria)) {
    avisos.push(`La categoría ${categoria} no está en la lista configurada (Configuración → SAGA).`);
  }
  // Valores de los campos propios de la categoría (para los atributos equivalentes): { FeedName: texto }.
  const extras = {};
  for (const c of camposDe(categoria)) if (txt(d[c.id]) !== "") extras[c.id] = txt(d[c.id]);
  // Cualquier otro dato simple del SKU (categorías que no están en el catálogo fijo): sirve para los atributos enlazados por equivalencia.
  for (const [k, val] of Object.entries(d)) {
    if ((typeof val === "string" || typeof val === "number") && txt(val) !== "" && extras[k] === undefined) extras[k] = txt(val);
  }
  const padre = txt(d.ParentSku);
  const usaPadre = padre !== "" && padre !== txt(d.SellerSku);

  return {
    variante: {
      // SAGA devuelve la descripción en HTML: se convierte a texto plano conservando saltos de línea y viñetas.
      descripcion: htmlATexto(d.Description),
      codigoBarras: txt(d.ProductId),
      // URLs de las imágenes que SAGA tiene del SKU (la principal primero).
      imagenes: [...new Set([].concat(d.Images?.Image || []).concat(d.MainImage || []).map(txt).filter((u) => /^https:\/\//i.test(u)))],
      volumen: deLista(d.CantidadPerfumesVariant, op.cantidades, "Medida"),
      cantidadEmpaque: txt(d.CantidadContenidaEnElEmpaque),
      registroSanitario: txt(d.RegistroSanitario),
      fraganciaPerfume: validos,
      notasAromaticas: txt(d.NotasAromaticas), // texto libre de SAGA; no pisa los atributos web de la variante
    },
    producto: {
      sagaCategoria: categoria,
      nombreProducto: txt(d.Name),
      marcaSaga: txt(d.Brand),
      modelo: txt(d.Model),
      paisProduccion: deLista(d.ProductionCountry, op.paises, "País"),
      tipoPerfume: deLista(d.TipoDePerfume, op.tiposPerfume, "Tipo de perfume"),
      genero: deLista(d.Genero, op.generos, "Género"),
      formatoBelleza: deLista(d.FormatoBelleza, op.formatosBelleza, "Formato belleza"),
      caracteristicas: caracts.join(", "),
      condicion: deLista(d.ConditionType, op.condiciones, "Condición"),
      // «Garantía y envío»
      nameCn: txt(d.NameCn),
      nameEn: txt(d.NameEn),
      detalleCondicion: txt(d.ConditionTypeNote),
      detalleGarantia: txt(d.ProductWarranty),
      garantia: deLista(d.SellerWarranty, op.garantias || GARANTIAS, "Garantía"),
      contenidoPaquete: txt(d.PackageContent),
      paqueteAncho: num(d.PackageWidth),
      paqueteLargo: num(d.PackageLength),
      paqueteAlto: num(d.PackageHeight),
      paquetePeso: num(d.PackageWeight),
      ...(usaPadre ? { usarSkuPadre: true, skuPadre: padre } : {}),
    },
    precios: {
      precio: num(u.Price),
      precioOferta: num(u.SpecialPrice),
      ofertaInicio: dia(u.SpecialFromDate),
      ofertaFin: dia(u.SpecialToDate),
    },
    extras,
    avisos,
  };
}

module.exports = { GARANTIAS, fraganciasValidas, normalizarVolumen, esPerfume, validarPerfume, validarGeneral, validarProducto, advertenciasSaga, CALIDAD, datosPerfume, datosGeneral, datosProducto, datosAccion, desdeSaga, stockParaSaga, urlImagenSaga, listaImagenes, imagenesParaSaga, GENERO_POR_CATEGORIA, CATEGORIAS_PERFUME, LIMITES };
