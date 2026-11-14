/**
 * Exportación de productos/variantes a CSV y Excel (solo servidor).
 */
const Papa = require("papaparse");
const { htmlATexto } = require("./html-texto");

const ENCABEZADOS = [
  "id_producto",
  "marca",
  "pestana",
  "categoria",
  "nombre_producto",
  "descripcion",
  "notas_producto",
  "destacado",
  "nombre_variante",
  "precio",
  "precio_oferta",
  "stock",
  "imagen",
  "notas_variante",
  "sku",
  "stock_cantidad",
  "stock_minimo",
  "costo",
];

// Las notas aromáticas se guardan como texto separado por comas; en el CSV van separadas por «|».
const notasACelda = (t) => String(t || "").split(",").map((x) => x.trim()).filter(Boolean).join("|");

function aFila(v) {
  return [
    v.producto_id,
    v.marca,
    v.pestana || v.marca,
    v.categoria,
    v.producto,
    htmlATexto(v.descripcion || ""),
    notasACelda(v.notas_producto),
    v.destacado ? "true" : "false",
    v.variante,
    v.precio ?? "",
    v.precio_oferta ?? "",
    v.stock ? "true" : "false",
    v.imagen || "",
    notasACelda(v.notas_variante),
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

/** Filas (arreglos de valores) en el orden de ENCABEZADOS, para armar el Excel. */
function variantesAFilas(variantes) {
  return variantes.map(aFila);
}

module.exports = { ENCABEZADOS, variantesACsv, variantesAFilas };
