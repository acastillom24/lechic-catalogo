/**
 * Revisión de contenido de SAGA (QC): convierte lo que devuelve la API (GetProducts → ContentScore y
 * QCStatus; GetQcStatus → motivos) en una lista de motivos con categoría, como el apartado «Pendientes»
 * de Seller Center. Módulo de datos puros (sin dependencias): sirve en servidor y cliente.
 */

const CATEGORIAS_REVISION = [
  ["contenido", "Contenido"],
  ["precio", "Precio"],
  ["multimedia", "Multimedia"],
  ["compliance", "Compliance"],
  ["configuracion", "Configuración"],
  ["otros", "Otros"],
];
const PUNTAJE_MINIMO = 70;

const sinTildes = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Palabras clave → categoría (el primero que coincide gana; el orden va de lo más específico a lo general).
const REGLAS = [
  ["multimedia", /imagen|imagenes|foto|video|multimedia|resolucion|fondo blanco|marca de agua/],
  ["precio", /precio|price|oferta|descuento|costo/],
  ["compliance", /compliance|registro sanitario|sanitari|digemid|permiso|licencia|marca registrada|prohibid|restringid|cumplimiento|legal/],
  ["configuracion", /configuracion|operador|businessunit|cuenta|seller center|envio|logistic|almacen|bodega|politica/],
  ["contenido", /contenido|puntaje|atributo|titulo|nombre|descripcion|ficha|categoria|marca\b|calidad/],
];

/** Categoría de Seller Center a la que pertenece un motivo de revisión. */
function clasificarMotivo(texto) {
  const t = sinTildes(texto);
  const regla = REGLAS.find(([, re]) => re.test(t));
  return regla ? regla[0] : "otros";
}

const CLAVE_MOTIVO = /reason|message|comment|detail|failure|error|motivo|descripcion|remark|issue/i;

/** Textos de motivos dentro de una respuesta de SAGA de forma desconocida (busca por nombre de campo). */
function textosDe(valor, clave = "", salida = []) {
  if (valor === null || valor === undefined) return salida;
  if (typeof valor === "string") {
    const t = valor.trim();
    if (t && CLAVE_MOTIVO.test(clave) && !/^(true|false|\d+)$/i.test(t)) salida.push(t);
  } else if (Array.isArray(valor)) {
    for (const x of valor) textosDe(x, clave, salida);
  } else if (typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) textosDe(v, k, salida);
  }
  return salida;
}

/**
 * Resumen de la revisión de un SKU a partir de GetProducts (`producto`) y, si existe, GetQcStatus (`qc`):
 *   { puntaje, estado, motivos: [{ categoria, texto }], categoria }
 * `categoria` es la del primer motivo (la más relevante) o null si no hay motivos.
 */
function resumirRevision(producto, qc) {
  const puntajeNum = Number(producto?.ContentScore);
  const puntaje = Number.isFinite(puntajeNum) && producto?.ContentScore !== "" && producto?.ContentScore != null ? Math.round(puntajeNum) : null;
  const estado = String(producto?.QCStatus || "").toLowerCase() || null;

  const textos = [...new Set(textosDe(qc))];
  if (puntaje !== null && puntaje < PUNTAJE_MINIMO && !textos.some((t) => /puntaje/i.test(t))) {
    textos.unshift(`El puntaje de contenido es ${puntaje}, menor a ${PUNTAJE_MINIMO} puntos. Revisa atributos faltantes o que necesiten mejoras.`);
  }
  const motivos = textos.slice(0, 20).map((texto) => ({ categoria: clasificarMotivo(texto), texto: texto.slice(0, 400) }));
  return { puntaje, estado, motivos, categoria: motivos[0]?.categoria || null };
}

/**
 * ¿Se puede vender el producto en SAGA? A partir de GetProducts (`producto`) y GetQcStatus (`qc`) arma un
 * checklist como el de «Vendible» de Seller Center:
 *   { vendible, items: [{ clave, etiqueta, estado: "listo" | "pendiente" | "sin_dato", detalle }], motivos: [texto] }
 * La API no entrega el checklist oficial: se deduce de puntaje, precio, stock, imagen y estado de la unidad.
 * Compliance solo se marca pendiente si SAGA lo menciona en los motivos del QC. `motivos` = los textos del QC que
 * no encajan en ninguna fila del checklist. Con `producto` null devuelve null (SAGA no lo encontró).
 */
function resumirVendible(producto, qc) {
  if (!producto) return null;
  const unidades = [].concat(producto.BusinessUnits?.BusinessUnit || []).map((u) => (u.BusinessUnit && typeof u.BusinessUnit === "object" ? u.BusinessUnit : u));
  const u = unidades[0] || {};
  const estadoQc = String(producto.QCStatus || "").toLowerCase();
  const textos = [...new Set(textosDe(qc))].map((t) => ({ categoria: clasificarMotivo(t), texto: t.slice(0, 400) }));
  const de = (cat) => textos.filter((m) => m.categoria === cat).map((m) => m.texto);

  const item = (clave, etiqueta, ok, detalle) => ({ clave, etiqueta, estado: ok === null ? "sin_dato" : ok ? "listo" : "pendiente", detalle: detalle || null });
  const puntaje = producto.ContentScore === "" || producto.ContentScore == null ? NaN : Number(producto.ContentScore);
  const precio = Number(u.Price);
  const stock = Number(u.Stock);
  const motivosImagen = de("multimedia");
  const motivosCompliance = de("compliance");
  const estadoUnidad = String(u.Status || "").toLowerCase();

  const items = [
    item("contenido", "Contenido", Number.isFinite(puntaje) && puntaje >= PUNTAJE_MINIMO, Number.isFinite(puntaje) ? `Puntaje ${Math.round(puntaje)} (mínimo ${PUNTAJE_MINIMO})` : "Sin puntaje de contenido"),
    item("precio", "Precio", precio > 0, precio > 0 ? null : "Sin precio en SAGA"),
    item("stock", "Stock", stock > 0, stock > 0 ? `${stock} u.` : "Sin stock en SAGA"),
    item("imagenes", "Imágenes", Boolean(String(producto.MainImage || "").trim()) && !motivosImagen.length, motivosImagen[0] || (String(producto.MainImage || "").trim() ? null : "Sin imagen principal en SAGA")),
    // Compliance solo se muestra si SAGA lo menciona en los motivos del QC; si la API no lo informa, se omite.
    ...(motivosCompliance.length ? [item("compliance", "Compliance", false, motivosCompliance[0])] : []),
    item("configuracion", "Configuración Seller Center", estadoUnidad === "active", estadoUnidad === "active" ? null : `Estado de la unidad: ${u.Status || "sin dato"}`),
  ];
  // Textos del QC que ninguna fila del checklist explica (p. ej. «Automatically rejected: …» de otro tipo).
  const usados = new Set([...motivosImagen, ...motivosCompliance]);
  const motivos = textos.map((m) => m.texto).filter((t) => !usados.has(t));
  const vendible = String(u.IsPublished) === "1" && estadoQc === "approved";
  return { vendible, items, motivos: motivos.slice(0, 10) };
}

module.exports = { CATEGORIAS_REVISION, PUNTAJE_MINIMO, clasificarMotivo, resumirRevision, resumirVendible, textosDe };
