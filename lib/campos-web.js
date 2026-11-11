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
  { id: "paquete", nombre: "Paquete", atributos: true },
];
const GRUPO_PREDETERMINADO = "detalles";
const GRUPOS_ATRIBUTOS = GRUPOS.filter((g) => g.atributos);

/**
 * { id, grupo, etiqueta, tipo: texto | lista | multi | numero, saga: clave en SAGA, clave?, soloPerfume?, obligatorioSaga? }
 * `id` coincide con las claves camelCase del formulario (ver lib/atributos-efectivos.js).
 */
const CAMPOS_BASE = [
  // --- Identificación ---
  { id: "nombre", grupo: "identificacion", etiqueta: "Nombre del producto", tipo: "texto", saga: "Name", clave: true },
  { id: "sku", grupo: "identificacion", etiqueta: "SKU", tipo: "texto", saga: "SellerSku", clave: true },
  { id: "codigoBarras", grupo: "identificacion", etiqueta: "Código de barras", tipo: "texto", saga: "ProductId", clave: true },
  { id: "descripcion", grupo: "identificacion", etiqueta: "Descripción", tipo: "texto", saga: "Description", clave: true },
  { id: "marca", grupo: "identificacion", etiqueta: "Marca", tipo: "lista", saga: "Brand", clave: true },
  { id: "categoriaPrimaria", grupo: "identificacion", etiqueta: "Categoría", tipo: "lista", saga: "PrimaryCategory", clave: true },
  // --- Precio y stock ---
  { id: "precio", grupo: "precio", etiqueta: "Precio", tipo: "numero", saga: "Price", clave: true },
  { id: "precioOferta", grupo: "precio", etiqueta: "Precio de oferta (y fechas)", tipo: "numero", saga: "SpecialPrice", clave: true },
  { id: "stock", grupo: "precio", etiqueta: "Stock", tipo: "numero", saga: "Quantity", clave: true },
  // --- Imágenes ---
  { id: "imagenes", grupo: "imagenes", etiqueta: "Imágenes", tipo: "multi", saga: "Image1 … Image8", clave: true },
  // --- Clasificación y registro ---
  { id: "condicion", grupo: "clasificacion", etiqueta: "Condición", tipo: "lista", saga: "ConditionType", obligatorioSaga: true },
  { id: "tipoPerfume", grupo: "clasificacion", etiqueta: "Tipo de perfume", tipo: "lista", saga: "TipoDePerfume", soloPerfume: true, obligatorioSaga: true },
  { id: "genero", grupo: "clasificacion", etiqueta: "Género", tipo: "lista", saga: "Genero", soloPerfume: true, obligatorioSaga: true },
  { id: "formatoBelleza", grupo: "clasificacion", etiqueta: "Formato", tipo: "lista", saga: "FormatoBelleza", soloPerfume: true, obligatorioSaga: true },
  { id: "modelo", grupo: "clasificacion", etiqueta: "Modelo", tipo: "texto", saga: "Model" },
  { id: "paisProduccion", grupo: "clasificacion", etiqueta: "País de producción", tipo: "lista", saga: "ProductionCountry" },
  { id: "registroSanitario", grupo: "clasificacion", etiqueta: "Registro sanitario", tipo: "texto", saga: "RegistroSanitario", obligatorioSaga: true },
  // --- Aromas y características ---
  { id: "caracteristicas", grupo: "aromas", etiqueta: "Características", tipo: "multi", saga: "Caracteristicas", soloPerfume: true },
  { id: "fraganciaPerfume", grupo: "aromas", etiqueta: "Fragancia", tipo: "multi", saga: "FraganciaPerfume", soloPerfume: true, obligatorioSaga: true },
  // Notas aromáticas: se ven en la web en cualquier categoría; SAGA las recibe solo en perfumes.
  { id: "notasAromaticas", grupo: "aromas", etiqueta: "Notas aromáticas", tipo: "texto", saga: "NotasAromaticas", equivSoloPerfume: true },
  { id: "volumen", grupo: "aromas", etiqueta: "Medida del frasco", tipo: "lista", saga: "CantidadPerfumesVariant", soloPerfume: true, clave: true, obligatorioSaga: true },
  { id: "cantidadEmpaque", grupo: "aromas", etiqueta: "Cantidad contenida en el empaque", tipo: "texto", saga: "CantidadContenidaEnElEmpaque", soloPerfume: true },
  // --- Paquete ---
  { id: "paqueteAncho", grupo: "paquete", etiqueta: "Ancho (cm)", tipo: "numero", saga: "PackageWidth", obligatorioSaga: true },
  { id: "paqueteLargo", grupo: "paquete", etiqueta: "Largo (cm)", tipo: "numero", saga: "PackageLength", obligatorioSaga: true },
  { id: "paqueteAlto", grupo: "paquete", etiqueta: "Alto (cm)", tipo: "numero", saga: "PackageHeight", obligatorioSaga: true },
  { id: "paquetePeso", grupo: "paquete", etiqueta: "Peso (kg)", tipo: "numero", saga: "PackageWeight", obligatorioSaga: true },
  { id: "contenidoPaquete", grupo: "paquete", etiqueta: "Contenido del paquete", tipo: "texto", saga: "PackageContent" },
];
// Los campos generales (con equivalencia de SAGA) son fijos; solo los atributos propios de cada categoría de SAGA son editables.
const CAMPOS_WEB = CAMPOS_BASE.map((c) => (c.saga ? { ...c, clave: true } : c));

const porId = (id) => CAMPOS_WEB.find((c) => c.id === id);
const camposDelGrupo = (grupo) => CAMPOS_WEB.filter((c) => c.grupo === grupo);
const esGrupoValido = (g) => GRUPOS_ATRIBUTOS.some((x) => x.id === g);

/** Categorías web de perfumería (usan los campos propios de perfumes y, por defecto, no tienen variantes). */
const CATEGORIAS_PERFUME = ["feminine", "masculine", "couples"];

module.exports = { GRUPOS, GRUPOS_ATRIBUTOS, GRUPO_PREDETERMINADO, CAMPOS_WEB, CATEGORIAS_PERFUME, porId, camposDelGrupo, esGrupoValido };
