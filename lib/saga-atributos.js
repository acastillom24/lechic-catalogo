/**
 * Atributos de un producto de SAGA que la web puede enviar al sincronizar, agrupados.
 * Salen de GetCategoryAttributes (categoría de perfumes) y de la estructura de GetProducts; solo
 * se listan los que la web puede llenar. Módulo de datos puros: lo usan el servidor (armado del
 * envío) y el cliente (matriz de Configuración → SAGA y ayudas del formulario).
 */
const GRUPOS = ["Stock y precio", "Datos técnicos", "Contenido", "Sensibles"];

const AVISO_SENSIBLE = "SAGA puede no permitir cambiarlo o volver a revisar el producto.";

const ATRIBUTOS = [
  { id: "stock", grupo: "Stock y precio", etiqueta: "Stock", detalle: "Cantidad y estado; al llegar al stock mínimo se publica 0." },
  { id: "precio", grupo: "Stock y precio", etiqueta: "Precio", detalle: "El de la cuenta (Precios por plataforma) o, si está vacío, el de la web." },
  { id: "oferta", grupo: "Stock y precio", etiqueta: "Oferta (precio, fecha de inicio y fecha de fin)", detalle: "SAGA exige las dos fechas; una oferta vencida no se envía." },

  { id: "registro_sanitario", grupo: "Datos técnicos", etiqueta: "Registro sanitario" },
  { id: "codigo_barras", grupo: "Datos técnicos", etiqueta: "Código de barras" },
  { id: "pais", grupo: "Datos técnicos", etiqueta: "País de producción" },
  { id: "modelo", grupo: "Datos técnicos", etiqueta: "Modelo" },
  { id: "tipo_perfume", grupo: "Datos técnicos", etiqueta: "Tipo de perfume" },
  { id: "genero", grupo: "Datos técnicos", etiqueta: "Género" },
  { id: "formato_belleza", grupo: "Datos técnicos", etiqueta: "Formato belleza" },
  { id: "condicion", grupo: "Datos técnicos", etiqueta: "Condición" },
  { id: "aroma", grupo: "Datos técnicos", etiqueta: "Fragancia (aroma)" },
  { id: "notas", grupo: "Datos técnicos", etiqueta: "Notas aromáticas" },
  { id: "caracteristicas", grupo: "Datos técnicos", etiqueta: "Características" },
  { id: "cantidad_empaque", grupo: "Datos técnicos", etiqueta: "Cantidad contenida en el empaque" },
  { id: "paquete_ancho", grupo: "Datos técnicos", etiqueta: "Paquete: ancho" },
  { id: "paquete_largo", grupo: "Datos técnicos", etiqueta: "Paquete: largo" },
  { id: "paquete_alto", grupo: "Datos técnicos", etiqueta: "Paquete: alto" },
  { id: "paquete_peso", grupo: "Datos técnicos", etiqueta: "Paquete: peso" },
  { id: "paquete_contenido", grupo: "Datos técnicos", etiqueta: "Paquete: contenido" },
  { id: "extras", grupo: "Datos técnicos", etiqueta: "Campos extra de la categoría (maquillaje, cuidado de la piel…)" },

  { id: "nombre", grupo: "Contenido", etiqueta: "Nombre" },
  { id: "descripcion", grupo: "Contenido", etiqueta: "Descripción" },
  { id: "imagen", grupo: "Contenido", etiqueta: "Imagen principal" },

  { id: "marca", grupo: "Sensibles", etiqueta: "Marca", aviso: AVISO_SENSIBLE },
  { id: "categoria", grupo: "Sensibles", etiqueta: "Categoría primaria", aviso: AVISO_SENSIBLE },
  { id: "medida", grupo: "Sensibles", etiqueta: "Medida del frasco (variación)", aviso: AVISO_SENSIBLE },
  { id: "sku_padre", grupo: "Sensibles", etiqueta: "SKU padre", aviso: AVISO_SENSIBLE },
];

const IDS = new Set(ATRIBUTOS.map((a) => a.id));
const idsDe = (grupo) => ATRIBUTOS.filter((a) => a.grupo === grupo).map((a) => a.id);
const etiquetaDe = (id) => ATRIBUTOS.find((a) => a.id === id)?.etiqueta || id;

module.exports = { ATRIBUTOS, GRUPOS, IDS, idsDe, etiquetaDe };
