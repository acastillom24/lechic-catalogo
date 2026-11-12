/**
 * Carga data/ventas_limpio.csv en la tabla `ventas` (una sola vez).
 *
 * Uso:
 *   npm run ventas:importar:dev            dry-run contra .env.development
 *   npm run ventas:importar:dev -- --aplicar
 *   npm run ventas:importar                dry-run contra .env.production
 *   npm run ventas:importar -- --aplicar [--forzar]
 *
 * Sin --aplicar solo valida y muestra el resumen. Aborta si ya hay filas
 * origen='csv' (salvo --forzar). Teléfonos vacíos se reemplazan por 999999999.
 */
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const { Client } = require("pg");
const { TELEFONO_SIN_DATO, validarVenta } = require("../lib/ventas-core");

const aplicar = process.argv.includes("--aplicar");
const forzar = process.argv.includes("--forzar");
const archivo = path.resolve(__dirname, "..", "data", "ventas_limpio.csv");

async function main() {
  if (!fs.existsSync(archivo)) throw new Error("Falta data/ventas_limpio.csv. Ejecuta npm run ventas:limpiar.");
  const texto = fs.readFileSync(archivo, "utf8").replace(/^﻿/, "");
  const { data } = Papa.parse(texto, { header: true, skipEmptyLines: true });

  const filas = data.map((r, i) => {
    const fila = {
      fecha: r.fecha,
      telefono: String(r.telefono || "").trim() || TELEFONO_SIN_DATO,
      cliente_ref: r.cliente_ref || null,
      categoria: r.categoria,
      monto: Number(r.monto),
      adelanto: Number(r.adelanto || 0),
      estado: r.estado || "cerrada",
      destino: r.destino || null,
      courier: r.courier || null,
      tipo_cliente: r.tipo_cliente || null,
      notas: r.notas || null,
    };
    const error = validarVenta(fila);
    if (error) throw new Error(`Fila ${i + 2}: ${error}`);
    return fila;
  });
  console.log(`Filas válidas: ${filas.length}`);
  console.log(`Suma montos:   S/ ${filas.reduce((s, f) => s + f.monto, 0).toFixed(2)}`);
  if (!aplicar) return console.log("Dry-run: no se insertó nada. Usa --aplicar para cargar.");

  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DIRECT_DATABASE_URL / DATABASE_URL.");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query("select count(*)::int n from ventas where origen = 'csv'");
    if (rows[0].n > 0 && !forzar) throw new Error(`Ya hay ${rows[0].n} ventas importadas del CSV. Usa --forzar si es intencional.`);
    await client.query("begin");
    const COLS = ["fecha", "telefono", "cliente_ref", "categoria", "monto", "adelanto", "estado", "destino", "courier", "tipo_cliente", "notas"];
    const LOTE = 500;
    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE);
      const params = [];
      const values = lote.map((f, j) => {
        COLS.forEach((c) => params.push(f[c]));
        return `(${COLS.map((_, k) => `$${j * COLS.length + k + 1}`).join(",")},'csv')`;
      });
      await client.query(`insert into ventas (${COLS.join(",")}, origen) values ${values.join(",")}`, params);
    }
    await client.query("commit");
    console.log(`Insertadas ${filas.length} ventas.`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
