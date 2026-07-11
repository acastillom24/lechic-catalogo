/**
 * ============================================================
 *  PRODUCTOS  —  la "base de datos" del catálogo
 * ============================================================
 *  Cada producto es un objeto. Para agregar uno nuevo, copia
 *  un bloque existente y cambia los valores.
 *
 *  ESQUEMA DE UN PRODUCTO:
 *  {
 *    id:          identificador único (texto, sin espacios). NO repetir.
 *    marca:       slug de la marca (debe existir en marcas.js)
 *    categoria:   slug de la categoría (debe existir en esa marca)
 *    nombre:      nombre visible del producto
 *    descripcion: texto descriptivo
 *    aromas:      lista de notas olfativas (opcional)
 *    destacado:   true = aparece resaltado (opcional)
 *
 *    // --- VARIANTES ---
 *    // Un producto puede tener 1 o varias variantes (ej: Expression
 *    // Original, Magic, Sens, Celebrate). Cada variante tiene su
 *    // propia imagen, precio y, si quieres, precio de oferta.
 *    variantes: [
 *      {
 *        nombre:      nombre de la variante (ej: "Magic")
 *        precio:      número (sin "S/")
 *        precioOferta: número (opcional; si existe, se muestra como oferta)
 *        imagen:      ruta dentro de /public/images/productos/...
 *        aromas:      lista (opcional; sobreescribe la del producto)
 *      }
 *    ]
 *  }
 *
 *  CÓMO GUARDAR LAS IMÁGENES:
 *  - Colócalas en:  public/images/productos/<marca>/<archivo>
 *  - En "imagen" pon la ruta SIN "public", empezando con "/":
 *      "/images/productos/importaciones/expression-magic.png"
 *  - Recomendado: fondo transparente (PNG) o blanco, formato vertical.
 *  - Nombra los archivos en minúsculas y con guiones, sin tildes.
 * ============================================================
 */

const productos = [
  {
    id: "expression",
    marca: "importaciones",
    categoria: "perfumeria-mujer",
    nombre: "Expression",
    descripcion:
      "Cuatro fragancias, una misma forma de decir quién eres. Frascos escultóricos con estela luminosa.",
    destacado: true,
    variantes: [
      {
        nombre: "Original",
        precio: 27,
        precioOferta: null,
        imagen: "/images/productos/importaciones/expression-original.png",
        aromas: ["Floral", "Ámbar", "Frutal"],
      },
      {
        nombre: "Magic",
        precio: 35,
        imagen: "/images/productos/importaciones/expression-magic.png",
        aromas: ["Oriental", "Vainilla", "Flores"],
      },
      {
        nombre: "Sens",
        precio: 35,
        imagen: "/images/productos/importaciones/expression-sens.png",
        aromas: ["Floral", "Frutal", "Fresco"],
      },
      {
        nombre: "Celebrate",
        precio: 35,
        imagen: "/images/productos/importaciones/expression-celebrate.png",
        aromas: ["Frutal", "Dulce", "Floral"],
      },
    ],
  },

  // -------- EJEMPLO de producto con UNA sola variante --------
  {
    id: "ejemplo-unico",
    marca: "esika-lbel-cyzone",
    categoria: "perfumeria-mujer",
    nombre: "Nombre del perfume",
    descripcion: "Descripción breve del producto.",
    variantes: [
      {
        nombre: "Único",
        precio: 40,
        imagen: "/images/productos/esika/ejemplo.png",
        aromas: ["Floral", "Frutal"],
      },
    ],
  },
];

module.exports = productos;
