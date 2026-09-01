/**
 * ============================================================
 *  MARCAS Y CATEGORÍAS
 * ============================================================
 *  Cada marca es un catálogo. Cada marca tiene sus categorías.
 *  El "slug" es el identificador en la URL (sin espacios ni tildes).
 *
 *  Para AGREGAR una categoría: añade un objeto { slug, nombre }.
 *  Para AGREGAR una marca: copia un bloque y cámbialo.
 * ============================================================
 */

const marcas = [
  {
    slug: "cyzone",
    nombre: "Cyzone",
    descripcion: "Perfumería, cuidado personal, maquillaje, accesorios y más.",
    color: "#FF00FF",
    categorias: [
      { slug: "feminine", nombre: "Perfumería Mujer" },
      { slug: "masculine", nombre: "Perfumería Caballeros" },
      { slug: "personal_care", nombre: "Cuidado Personal" },
      { slug: "make-up", nombre: "Maquillaje" },
      { slug: "accessories", nombre: "Accesorios" },
    ],
  },
  {
    slug: "lbel",
    nombre: "L'Bel",
    descripcion: "Perfumería, cuidado personal, maquillaje y más.",
    color: "#9932CC",
    categorias: [
      { slug: "feminine", nombre: "Perfumería Mujer" },
      { slug: "masculine", nombre: "Perfumería Caballeros" },
      { slug: "personal_care", nombre: "Cuidado Personal" },
      { slug: "make-up", nombre: "Maquillaje" },
    ],
  },
  {
    slug: "esika",
    nombre: "Ésika",
    descripcion: "Perfumería, cuidado personal, maquillaje, accesorios y más.",
    color: "#E31E24",
    categorias: [
      { slug: "feminine", nombre: "Perfumería Mujer" },
      { slug: "masculine", nombre: "Perfumería Caballeros" },
      { slug: "personal_care", nombre: "Cuidado Personal" },
      { slug: "make-up", nombre: "Maquillaje" },
      { slug: "accessories", nombre: "Accesorios" },
      { slug: "babys", nombre: "Bebés" },
      { slug: "childrens", nombre: "Niños y Niñas" },
    ],
  },
  {
    slug: "yanbal",
    nombre: "Yanbal",
    descripcion: "Perfumería, cuidado personal, maquillaje, accesorios y más.",
    color: "#FF7F00",
    categorias: [
      { slug: "perfumeria-mujer", nombre: "Perfumería Mujer" },
      { slug: "perfumeria-hombre", nombre: "Perfumería Caballeros" },
      { slug: "maquillaje", nombre: "Maquillaje" },
      { slug: "cuidado-personal", nombre: "Cuidado Personal" },
      { slug: "bebes", nombre: "Bebés" },
      { slug: "ninos", nombre: "Niños y Niñas" },
    ],
  },
  {
    slug: "natura",
    nombre: "Natura",
    descripcion: "Perfumería, cuidado personal, maquillaje y más.",
    color: "#F3AA32",
    categorias: [
      { slug: "feminine", nombre: "Perfumería Mujer" },
      { slug: "masculine", nombre: "Perfumería Caballeros" },
      { slug: "personal_care", nombre: "Cuidado Personal" },
      { slug: "make-up", nombre: "Maquillaje" },
      { slug: "boys", nombre: "Niños" },
      { slug: "girls", nombre: "Niñas" },
      { slug: "babies", nombre: "Bebés" },
    ],
  },
  {
    slug: "avon",
    nombre: "Avon",
    descripcion: "Perfumería, cuidado personal, maquillaje, accesorios y más.",
    color: "#ED008C",
    categorias: [
      { slug: "feminine", nombre: "Perfumería Mujer" },
      { slug: "masculine", nombre: "Perfumería Caballeros" },
      { slug: "personal_care", nombre: "Cuidado Personal" },
      { slug: "make-up", nombre: "Maquillaje" },
      { slug: "accessories", nombre: "Accesorios" },
      { slug: "boys", nombre: "Niños" },
      { slug: "girls", nombre: "Niñas" },
      { slug: "babies", nombre: "Bebés" },
    ],
  },
  {
    slug: "dupree",
    nombre: "Dupree",
    descripcion: "Perfumería, cuidado personal, maquillaje, accesorios, ropa y más.",
    color: "#A71930",
    categorias: [
      { slug: "feminine", nombre: "Perfumería Mujer" },
      { slug: "masculine", nombre: "Perfumería Caballeros" },
      { slug: "personal_care", nombre: "Cuidado Personal" },
      { slug: "make-up", nombre: "Maquillaje" },
      { slug: "accessories", nombre: "Accesorios" },
      { slug: "boys", nombre: "Niños" },
      { slug: "girls", nombre: "Niñas" },
      { slug: "babies", nombre: "Bebés" },
      { slug: "clothing", nombre: "Ropa" },
    ],
  },
  {
    slug: "victorias-secret",
    nombre: "Victoria's Secret",
    descripcion:
      "Body splashes, lociones perfumadas y más.",
    color: "#FF69B4",
    categorias: [
      { slug: "feminine", nombre: "Mujer" },
    ],
  },
  {
    slug: "importaciones",
    nombre: "Importaciones",
    descripcion:
      "Fragancias alternativas de diseñador, Victoria's Secret, cuidado personal importado y más.",
    color: "#f06595",
    categorias: [
      { slug: "feminine", nombre: "Perfumería Mujer" },
      { slug: "masculine", nombre: "Perfumería Caballeros" },
      { slug: "personal_care", nombre: "Cuidado Personal" },
      { slug: "make-up", nombre: "Maquillaje" },
      { slug: "accessories", nombre: "Accesorios" },
    ],
  },
  {
    slug: "ofertas",
    nombre: "Ofertas",
    descripcion:
      "Fragancias alternativas de diseñador, Victoria's Secret, cuidado personal importado y más.",
    color: "#f06595",
    categorias: [
      { slug: "feminine", nombre: "Perfumería Mujer" },
      { slug: "masculine", nombre: "Perfumería Caballeros" },
      { slug: "personal_care", nombre: "Cuidado Personal" },
      { slug: "make-up", nombre: "Maquillaje" },
      { slug: "accessories", nombre: "Accesorios" },
    ],
  },
];

module.exports = marcas;
