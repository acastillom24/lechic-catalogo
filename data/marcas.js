/**
 * ============================================================
 *  MARCAS, PESTAÑAS Y CATEGORÍAS  (valores por defecto / semilla)
 * ============================================================
 *  Son tres conceptos independientes:
 *
 *  - MARCA: la marca del producto que se envía a SAGA (`nombreSaga` = nombre EXACTO en SAGA).
 *  - PESTAÑA: dónde se ubica el producto en la web (/marca/[slug], menú, color).
 *  - CATEGORÍA: catálogo global; cada pestaña activa las que quiera mostrar.
 *
 *  Estos valores solo se usan si no hay nada guardado. Lo que se edita en
 *  /admin/configuracion (pestañas Marcas y Pestañas) vive en la tabla `configuracion`
 *  (claves "marcas", "pestanas", "categorias") y reemplaza a estos defaults.
 * ============================================================
 */

const categorias = [
  { slug: "feminine", nombre: "Perfumería Mujer" },
  { slug: "masculine", nombre: "Perfumería Caballeros" },
  { slug: "couples", nombre: "Perfumería Parejas" },
  { slug: "perfumery", nombre: "Perfumería" },
  { slug: "personal-care", nombre: "Cuidado Personal" },
  { slug: "make-up", nombre: "Maquillaje" },
  { slug: "hair", nombre: "Cabellos" },
  { slug: "accessories", nombre: "Accesorios" },
  { slug: "children", nombre: "Niños y Niñas" },
  { slug: "boys", nombre: "Niños" },
  { slug: "girls", nombre: "Niñas" },
  { slug: "babies", nombre: "Bebés" },
  { slug: "clothing", nombre: "Ropa" },
  { slug: "ekos", nombre: "Ekos" },
  { slug: "tododia", nombre: "Tododia" },
  { slug: "home", nombre: "Todo para el hogar" },
];

const TODO_BASICO = "Perfumería, cuidado personal, maquillaje, accesorios y más.";

const pestanas = [
  {
    slug: "ofertas",
    nombre: "Ofertas",
    descripcion:
      "Fragancias alternativas de diseñador, Victoria's Secret, cuidado personal importado y más.",
    color: "#f06595",
    categorias: ["ekos", "tododia", "feminine", "masculine", "couples", "personal-care", "children", "babies", "make-up", "hair"],
  },
  {
    slug: "cyzone",
    nombre: "Cyzone",
    descripcion: TODO_BASICO,
    color: "#FF00FF",
    categorias: ["feminine", "masculine", "personal-care", "make-up", "accessories"],
  },
  {
    slug: "lbel",
    nombre: "L'Bel",
    descripcion: "Perfumería, cuidado personal, maquillaje y más.",
    color: "#9932CC",
    categorias: ["feminine", "masculine", "personal-care", "make-up"],
  },
  {
    slug: "esika",
    nombre: "Ésika",
    descripcion: TODO_BASICO,
    color: "#E31E24",
    categorias: ["feminine", "masculine", "personal-care", "make-up", "accessories", "babies", "children"],
  },
  {
    slug: "yanbal",
    nombre: "Yanbal",
    descripcion: TODO_BASICO,
    color: "#FF7F00",
    categorias: ["feminine", "masculine", "make-up", "personal-care", "babies", "children", "accessories"],
  },
  {
    slug: "natura",
    nombre: "Natura",
    descripcion: "Perfumería, cuidado personal, maquillaje y más.",
    color: "#F3AA32",
    categorias: ["feminine", "masculine", "ekos", "tododia", "personal-care", "make-up", "children", "babies"],
  },
  {
    slug: "avon",
    nombre: "Avon",
    descripcion: TODO_BASICO,
    color: "#ED008C",
    categorias: ["feminine", "masculine", "personal-care", "make-up", "accessories", "children", "babies"],
  },
  {
    slug: "dupree",
    nombre: "Dupree",
    descripcion: "Perfumería, cuidado personal, maquillaje, accesorios, ropa y más.",
    color: "#A71930",
    categorias: ["feminine", "masculine", "personal-care", "make-up", "accessories", "boys", "girls", "babies", "clothing"],
  },
  {
    slug: "victorias-secret",
    nombre: "Victoria's Secret",
    descripcion: "Body splashes, lociones perfumadas y más.",
    color: "#FF69B4",
    categorias: ["feminine"],
  },
  {
    slug: "importaciones",
    nombre: "Importaciones",
    descripcion:
      "Fragancias alternativas de diseñador, Victoria's Secret, cuidado personal importado y más.",
    color: "#f06595",
    categorias: ["feminine", "masculine", "personal-care", "make-up", "accessories"],
  },
  {
    slug: "farmasi",
    nombre: "Farmasi",
    descripcion: TODO_BASICO,
    color: "#FF2C2C",
    categorias: ["personal-care", "make-up"],
  },
  {
    slug: "caravan",
    nombre: "Caravan",
    descripcion: TODO_BASICO,
    color: "#FFC5D3",
    categorias: ["feminine", "masculine"],
  },
  {
    slug: "saphir",
    nombre: "Saphir",
    descripcion: "Perfumería",
    color: "#E3AB46",
    categorias: ["feminine", "masculine"],
  },
  {
    slug: "bath-and-body-works",
    nombre: "Bath & Body Works",
    descripcion: "Perfumería",
    color: "#0000FF",
    categorias: ["perfumery"],
  },
  {
    slug: "hogar",
    nombre: "Hogar",
    descripcion: "Productos para el hogar",
    color: "#CFD4D9",
    categorias: ["home"],
  },
];

// nombreSaga: nombre EXACTO en SAGA (vacío = aún sin configurar, el producto no se puede enviar).
// pestanaDefault: pestaña que se autoselecciona al elegir la marca en el formulario de producto.
const marcas = [
  { slug: "yanbal", nombre: "Yanbal", nombreSaga: "Yanbal", pestanaDefault: "yanbal" },
  { slug: "cyzone", nombre: "Cyzone", nombreSaga: "Cyzone", pestanaDefault: "cyzone" },
  { slug: "esika", nombre: "Ésika", nombreSaga: "Esika", pestanaDefault: "esika" },
  { slug: "lbel", nombre: "L'Bel", nombreSaga: "Lbel", pestanaDefault: "lbel" },
  { slug: "natura", nombre: "Natura", nombreSaga: "Natura", pestanaDefault: "natura" },
  { slug: "avon", nombre: "Avon", nombreSaga: "AVON", pestanaDefault: "avon" },
  { slug: "dupree", nombre: "Dupree", nombreSaga: "", pestanaDefault: "dupree" },
  { slug: "victorias-secret", nombre: "Victoria's Secret", nombreSaga: "Victoria'S Secret", pestanaDefault: "victorias-secret" },
  { slug: "bath-and-body-works", nombre: "Bath & Body Works", nombreSaga: "BATH & BODY WORKS", pestanaDefault: "bath-and-body-works" },
  { slug: "farmasi", nombre: "Farmasi", nombreSaga: "", pestanaDefault: "farmasi" },
  { slug: "caravan", nombre: "Caravan", nombreSaga: "", pestanaDefault: "caravan" },
  { slug: "saphir", nombre: "Saphir", nombreSaga: "SAPHIR", pestanaDefault: "saphir" },
  // Marca comodín para ofertas, importaciones y hogar. Ajusta el nombre exacto en SAGA desde Configuración → Marcas.
  { slug: "otras", nombre: "Otras", nombreSaga: "Otras", pestanaDefault: "ofertas" },
];

module.exports = { categorias, pestanas, marcas };
