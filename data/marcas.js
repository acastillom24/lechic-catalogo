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
    slug: "esika-lbel-cyzone",
    nombre: "Ésika, L'Bel y Cyzone",
    descripcion: "Perfumería, cuidado personal, maquillaje y más.",
    color: "#e8267f",
    categorias: [
      { slug: "perfumeria-mujer", nombre: "Perfumería Mujer" },
      { slug: "perfumeria-caballeros", nombre: "Perfumería Caballeros" },
      { slug: "cuidado-personal", nombre: "Cuidado Personal" },
      { slug: "maquillaje", nombre: "Maquillaje" },
      { slug: "accesorios", nombre: "Accesorios" },
      { slug: "ninos-ninas-bebes", nombre: "Niños, Niñas y Bebés" },
    ],
  },
  {
    slug: "yanbal",
    nombre: "Yanbal",
    descripcion: "Perfumería, cuidado personal, joyería y accesorios de casa.",
    color: "#d6336c",
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
    slug: "natura-avon",
    nombre: "Natura y Avon",
    descripcion: "Perfumería, cuidado personal, cabello, bebés y promociones.",
    color: "#c2255c",
    categorias: [
      { slug: "perfumeria-damas", nombre: "Perfumería Damas" },
      { slug: "perfumeria-caballeros", nombre: "Perfumería Caballeros" },
      { slug: "cuidado-personal", nombre: "Cuidado Personal" },
      { slug: "maquillaje", nombre: "Maquillaje" },
      { slug: "cabello", nombre: "Cabello" },
      { slug: "ninos-ninas-bebes", nombre: "Niños, Niñas y Bebés" },
      { slug: "accesorios", nombre: "Accesorios" },
      { slug: "promociones-damas", nombre: "Promociones Damas" },
      { slug: "promociones-caballeros", nombre: "Promociones Caballeros" },
    ],
  },
  {
    slug: "dupree-oriflame",
    nombre: "Dupree y Oriflame",
    descripcion: "Perfumería, cuidado personal, maquillaje y accesorios.",
    color: "#e64980",
    categorias: [
      { slug: "perfumeria-mujer", nombre: "Perfumería Mujer" },
      { slug: "perfumeria-caballeros", nombre: "Perfumería Caballeros" },
      { slug: "cuidado-personal", nombre: "Cuidado Personal" },
      { slug: "maquillaje", nombre: "Maquillaje" },
      { slug: "accesorios", nombre: "Accesorios" },
    ],
  },
  {
    slug: "importaciones",
    nombre: "Importaciones",
    descripcion:
      "Fragancias alternativas de diseñador, Victoria's Secret, cuidado personal importado y más.",
    color: "#f06595",
    categorias: [
      { slug: "perfumeria-mujer", nombre: "Perfumería Mujer" },
      { slug: "perfumeria-caballeros", nombre: "Perfumería Caballeros" },
      { slug: "cuidado-personal", nombre: "Cuidado Personal" },
      { slug: "maquillaje", nombre: "Maquillaje" },
      { slug: "accesorios", nombre: "Accesorios" },
    ],
  },
  {
    slug: "ofertas",
    nombre: "Ofertas",
    descripcion:
      "Fragancias alternativas de diseñador, Victoria's Secret, cuidado personal importado y más.",
    color: "#f06595",
    categorias: [
      { slug: "perfumeria-mujer", nombre: "Perfumería Mujer" },
      { slug: "perfumeria-caballeros", nombre: "Perfumería Caballeros" },
      { slug: "cuidado-personal", nombre: "Cuidado Personal" },
      { slug: "maquillaje", nombre: "Maquillaje" },
      { slug: "accesorios", nombre: "Accesorios" },
    ],
  },
];

module.exports = marcas;
