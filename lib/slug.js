/**
 * Convierte un nombre en un id de producto válido:
 * minúsculas, sin tildes, espacios y símbolos → guiones.
 * Se usa tanto en el formulario manual como en la importación CSV.
 */
function slugify(texto) {
  return (texto || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes (diacríticos)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

module.exports = { slugify };
