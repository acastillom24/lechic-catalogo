/**
 * Campos propios de la WEB (módulo de datos puros: servidor y cliente).
 *
 * Son los campos con los que la web describe un producto, agrupados como en el formulario («apartados»). Cada plataforma
 * los conecta con sus propios campos (`equivalencias.fijos`). Para SAGA ya se deja marcada la equivalencia (`saga`):
 *  - `clave: true`  → datos con los que se construye todo el envío (nombre, SKU, precio, stock, imágenes…): se muestran con su
 *    equivalencia de SAGA, pero no se pueden cambiar mientras la integración esté construida sobre ellos;
 *  - sin `clave`    → (ya no hay) solo la equivalencia de los atributos propios de cada categoría es editable.
 * Los atributos propios que agrega el usuario (Integraciones → Web) van en el apartado que elija; por defecto «detalles».
 */

/** Apartados del formulario, en orden. `atributos: true` = admiten atributos propios. */
const GRUPOS = [
  { id: "identificacion", nombre: "Identificación" },
  { id: "precio", nombre: "Precio y stock" },
  { id: "imagenes", nombre: "Imágenes" },
  { id: "clasificacion", nombre: "Clasificación y registro", atributos: true },
  { id: "aromas", nombre: "Perfil del producto", atributos: true },
  { id: "detalles", nombre: "Detalles", atributos: true },
];
const GRUPO_PREDETERMINADO = "detalles";
const GRUPOS_ATRIBUTOS = GRUPOS.filter((g) => g.atributos);

/**
 * { id, grupo, etiqueta, tipo: texto | lista | multi | numero | fecha, max (largo máximo en SAGA), saga: clave en SAGA, clave?, soloPerfume?, obligatorioSaga? }
 * `clave` = bloqueado; `base` = SAGA lo acepta en toda categoría; `id` coincide con las claves camelCase del formulario (ver lib/atributos-efectivos.js).
 */
const CAMPOS_BASE = [
  // --- Identificación ---
  { id: "nombre", grupo: "identificacion", etiqueta: "Nombre del producto", tipo: "texto", saga: "Name", clave: true, envio: true, obligatorioSaga: true, max: 172 },
  { id: "sku", grupo: "identificacion", etiqueta: "SKU", tipo: "texto", saga: "SellerSku", clave: true, envio: true },
  { id: "codigoBarras", grupo: "identificacion", etiqueta: "Código de barras", tipo: "texto", saga: "ProductId", clave: true, envio: true },
  { id: "descripcion", grupo: "identificacion", etiqueta: "Descripción", tipo: "texto", saga: "Description", clave: true, envio: true },
  { id: "marca", grupo: "identificacion", etiqueta: "Marca", tipo: "lista", saga: "Brand", clave: true, envio: true, obligatorioSaga: true },
  { id: "categoriaPrimaria", grupo: "identificacion", etiqueta: "Categoría", tipo: "lista", saga: "PrimaryCategory", clave: true, envio: true },
  // --- Precio y stock ---
  { id: "precio", grupo: "precio", etiqueta: "Precio", tipo: "numero", saga: "Price", clave: true, envio: true },
  { id: "precioOferta", grupo: "precio", etiqueta: "Precio de oferta", tipo: "numero", saga: "SpecialPrice", clave: true, envio: true },
  { id: "ofertaInicio", grupo: "precio", etiqueta: "Inicio de la oferta", tipo: "fecha", saga: "SpecialFromDate", clave: true, envio: true },
  { id: "ofertaFin", grupo: "precio", etiqueta: "Fin de la oferta", tipo: "fecha", saga: "SpecialToDate", clave: true, envio: true },
  { id: "stock", grupo: "precio", etiqueta: "Stock", tipo: "numero", saga: "Quantity", clave: true, envio: true },
  // --- Imágenes ---
  { id: "imagenes", grupo: "imagenes", etiqueta: "Imágenes", tipo: "multi", saga: "Image1 … Image8", clave: true, envio: true },
  // --- Clasificación y registro ---
  { id: "condicion", grupo: "clasificacion", etiqueta: "Condición", tipo: "lista", saga: "ConditionType", obligatorioSaga: true, clave: true },
  { id: "tipoPerfume", grupo: "clasificacion", etiqueta: "Tipo de perfume", tipo: "lista", saga: "TipoDePerfume", soloPerfume: true, obligatorioSaga: true, porSaga: true },
  { id: "genero", grupo: "clasificacion", etiqueta: "Género", tipo: "lista", saga: "Genero", soloPerfume: true, obligatorioSaga: true, porSaga: true },
  { id: "formatoBelleza", grupo: "clasificacion", etiqueta: "Formato", tipo: "lista", saga: "FormatoBelleza", soloPerfume: true, obligatorioSaga: true, porSaga: true },
  { id: "modelo", grupo: "clasificacion", etiqueta: "Modelo", tipo: "texto", saga: "Model", base: true, max: 172 },
  { id: "paisProduccion", grupo: "clasificacion", etiqueta: "País de origen", tipo: "lista", saga: "ProductionCountry", base: true },
  { id: "registroSanitario", grupo: "clasificacion", etiqueta: "Registro sanitario", tipo: "texto", saga: "RegistroSanitario", obligatorioSaga: true, clave: true, max: 172 },
  // --- Aromas y características ---
  { id: "caracteristicas", grupo: "aromas", etiqueta: "Características", tipo: "multi", saga: "Caracteristicas", soloPerfume: true, porSaga: true },
  { id: "fraganciaPerfume", grupo: "aromas", etiqueta: "Fragancia", tipo: "multi", saga: "FraganciaPerfume", soloPerfume: true, obligatorioSaga: true, porSaga: true },
  // Notas aromáticas: se ven en la web en cualquier categoría; SAGA las recibe solo en perfumes.
  { id: "notasAromaticas", grupo: "aromas", etiqueta: "Notas aromáticas", tipo: "texto", saga: "NotasAromaticas", equivSoloPerfume: true, porSaga: true, max: 172 },
  { id: "volumen", grupo: "aromas", etiqueta: "Medida del frasco", tipo: "lista", saga: "CantidadPerfumesVariant", soloPerfume: true, obligatorioSaga: true, porSaga: true },
  { id: "cantidadEmpaque", grupo: "aromas", etiqueta: "Cantidad contenida en el empaque", tipo: "texto", saga: "CantidadContenidaEnElEmpaque", soloPerfume: true, porSaga: true, max: 172 },
  // --- Paquete ---
  { id: "paqueteAncho", grupo: "paquete", etiqueta: "Ancho (cm)", tipo: "numero", saga: "PackageWidth", obligatorioSaga: true, clave: true, max: 6 },
  { id: "paqueteLargo", grupo: "paquete", etiqueta: "Largo (cm)", tipo: "numero", saga: "PackageLength", obligatorioSaga: true, clave: true, max: 6 },
  { id: "paqueteAlto", grupo: "paquete", etiqueta: "Alto (cm)", tipo: "numero", saga: "PackageHeight", obligatorioSaga: true, clave: true, max: 6 },
  { id: "paquetePeso", grupo: "paquete", etiqueta: "Peso (kg)", tipo: "numero", saga: "PackageWeight", obligatorioSaga: true, clave: true, max: 10 },
  { id: "contenidoPaquete", grupo: "paquete", etiqueta: "Incluye", tipo: "texto", saga: "PackageContent", base: true, max: 172 },
  // --- Garantía y envío (campos generales de SAGA, grupo «Garantía y Envío») ---
  { id: "nameCn", grupo: "paquete", etiqueta: "Nombre del producto en chino", tipo: "texto", saga: "NameCn", base: true, max: 172 },
  { id: "nameEn", grupo: "paquete", etiqueta: "Nombre del producto en inglés", tipo: "texto", saga: "NameEn", base: true, max: 172 },
  { id: "detalleCondicion", grupo: "paquete", etiqueta: "Detalle de la condición", tipo: "texto", saga: "ConditionTypeNote", base: true },
  { id: "detalleGarantia", grupo: "paquete", etiqueta: "Detalle de la garantía", tipo: "texto", saga: "ProductWarranty", base: true },
  { id: "garantia", grupo: "paquete", etiqueta: "Garantía", tipo: "lista", saga: "SellerWarranty", base: true },
];
// `clave` = bloqueado: construye el envío o SAGA lo pide en toda categoría. Los demás generales son LIBRES: cada categoría de la web
// los activa o desactiva (Integraciones → Web → «Atributos visibles»; ver campoGeneralActivo en lib/equivalencias.js).
// `base` = SAGA lo acepta en cualquier categoría; sin `base`, solo donde su catálogo de campos lo trae (o en perfumes 1735).
const CAMPOS_WEB = CAMPOS_BASE;
const esLibre = (c) => Boolean(c.saga) && !c.clave;
/** Campos generales que se pueden reasignar a otro campo general de la web (Integraciones → SAGA → Campos generales). */
const esReasignable = (c) => Boolean(c.saga) && !c.porSaga;

/**
 * Estructura de los campos generales, igual que en SAGA: paneles «Producto y garantía», «Atributos» y «Variantes». Cada bloque lista sus
 * campos en el orden de SAGA. `soloObligatorios` = el bloque admite la casilla «Mostrar solo atributos obligatorios y que aumentan la
 * calidad del contenido» (marcada muestra los `obligatorioSaga`; desmarcada, todos).
 */
const PANELES = [
  {
    id: "producto",
    nombre: "Producto y garantía",
    bloques: [
      { id: "principal", nombre: "Principal", campos: ["nombre", "marca", "modelo", "descripcion", "paisProduccion"] },
      {
        id: "garantia",
        nombre: "Garantía y envío",
        soloObligatorios: true,
        campos: ["condicion", "nameCn", "nameEn", "detalleCondicion", "detalleGarantia", "garantia", "contenidoPaquete", "paqueteAncho", "paqueteLargo", "paqueteAlto", "paquetePeso"],
      },
    ],
  },
  { id: "atributos", nombre: "Atributos", bloques: [{ id: "especificaciones", nombre: "Especificaciones generales", campos: ["registroSanitario"] }] },
  {
    id: "variantes",
    nombre: "Variantes",
    bloques: [{ id: "variacion", nombre: "Variación, precio e imágenes", campos: ["sku", "codigoBarras", "precio", "precioOferta", "ofertaInicio", "ofertaFin", "stock", "imagenes"] }],
  },
];

/**
 * Campos cuyas opciones (lista de valores válidos en SAGA) se definen en la web: campo de la web → clave de la lista en `opcionesSaga`
 * (la que leen el formulario, las validaciones y el envío). Se editan en Integraciones → Web (✎), con «Traer requisitos de SAGA».
 */
const LISTA_DE_CAMPO = {
  paisProduccion: "paises",
  condicion: "condiciones",
  garantia: "garantias",
  tipoPerfume: "tiposPerfume",
  genero: "generos",
  formatoBelleza: "formatosBelleza",
  caracteristicas: "caracteristicas",
  fraganciaPerfume: "aromas",
  volumen: "cantidades",
};

const porId = (id) => CAMPOS_WEB.find((c) => c.id === id);
const camposDelGrupo = (grupo) => CAMPOS_WEB.filter((c) => c.grupo === grupo);
const esGrupoValido = (g) => GRUPOS_ATRIBUTOS.some((x) => x.id === g);

/** Categorías web de perfumería (usan los campos propios de perfumes y, por defecto, no tienen variantes). */
const CATEGORIAS_PERFUME = ["feminine", "masculine", "couples"];

module.exports = { LISTA_DE_CAMPO, PANELES, esLibre, esReasignable, GRUPOS, GRUPOS_ATRIBUTOS, GRUPO_PREDETERMINADO, CAMPOS_WEB, CATEGORIAS_PERFUME, porId, camposDelGrupo, esGrupoValido };
