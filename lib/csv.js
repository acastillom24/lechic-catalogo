/**
 * Exportación CSV de productos/variantes (solo servidor).
 * Los encabezados son exactamente los del importador (importarCsv), así el
 * archivo exportado se puede volver a importar sin cambios.
 */
const Papa = require("papaparse");

const ENCABEZADOS = [
  "id_producto",
  "marca",
  "categoria",
  "nombre_producto",
  "descripcion",
  "aromas_producto",
  "destacado",
  "nombre_variante",
  "precio",
  "precio_oferta",
  "stock",
  "imagen",
  "aromas_variante",
  "sku",
  "stock_cantidad",
  "stock_minimo",
  "costo",
];

function aFila(v) {
  return [
    v.producto_id,
    v.marca,
    v.categoria,
    v.producto,
    v.descripcion || "",
    (v.aromas_producto || []).join("|"),
    v.destacado ? "true" : "false",
    v.variante,
    v.precio ?? "",
    v.precio_oferta ?? "",
    v.stock ? "true" : "false",
    v.imagen || "",
    (v.aromas_variante || []).join("|"),
    v.sku || "",
    v.stock_actual ?? "",
    v.stock_minimo ?? 0,
    v.costo ?? "",
  ];
}

/** Devuelve el texto CSV (con BOM para que Excel respete las tildes). */
function variantesACsv(variantes) {
  const csv = Papa.unparse({ fields: ENCABEZADOS, data: variantes.map(aFila) });
  return `﻿${csv}\r\n`;
}

/** Plantilla de importación: solo los encabezados. */
function plantillaCsv() {
  return variantesACsv([]);
}

module.exports = { ENCABEZADOS, variantesACsv, plantillaCsv };
