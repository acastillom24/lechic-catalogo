/**
 * Limpia db_ventas.csv (Excel histórico) y genera los archivos para cargar a Neon.
 *
 * Uso:
 *   npm run ventas:limpiar                      (lee ./db_ventas.csv)
 *   npm run ventas:limpiar -- ruta.csv          (otro archivo)
 *   npm run ventas:limpiar -- --mantener-duplicados
 *
 * Salida (carpeta data/):
 *   ventas_limpio.csv      filas listas para ventas:importar (telefono nunca vacío)
 *   ventas_rechazadas.csv  filas descartadas con el motivo
 */
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const {
  normalizarTelefono,
  parsearFecha,
  parsearMonto,
  normalizarDestino,
  normalizarTipoCliente,
  validarVenta,
  CATEGORIAS,
} = require("../lib/ventas-core");

const args = process.argv.slice(2);
const mantenerDuplicados = args.includes("--mantener-duplicados");
const entrada = path.resolve(args.find((a) => !a.startsWith("--")) || "db_ventas.csv");
const carpetaSalida = path.resolve(__dirname, "..", "data");
const UMBRAL_ATIPICO = 2000;

const CAMPOS = [
  "fecha", "telefono", "cliente_ref", "categoria", "monto", "adelanto",
  "estado", "destino", "courier", "tipo_cliente", "notas", "origen",
];

function main() {
  if (!fs.existsSync(entrada)) throw new Error(`No existe ${entrada}`);
  const texto = fs.readFileSync(entrada, "utf8").replace(/^﻿/, "");
  const { data, errors } = Papa.parse(texto, { skipEmptyLines: "greedy" });
  if (errors.length) console.warn(`Avisos al leer el CSV: ${errors.length} (primero: ${errors[0].message})`);

  const filas = data.slice(1); // primera fila = encabezados (con espacios raros)
  const limpias = [];
  const rechazadas = [];
  const vistos = new Set();
  const stats = {
    leidas: filas.length, sinTelefono: 0, telefonoNoRecuperable: 0, duplicadas: 0,
    destinoCorregido: 0, destinoVacio: 0, atipicos: [],
  };

  filas.forEach((f, i) => {
    const linea = i + 2;
    const [rFecha, rId, rCat, rAdel, rDest, rEstado, rTipo, rMonto] = f;
    const rechazar = (motivo) => rechazadas.push({ linea, motivo, crudo: f.join(" | ") });

    const clave = f.map((c) => String(c ?? "").trim()).join("|");
    // Solo se consideran duplicados las filas con teléfono real: sin teléfono
    // dos ventas iguales pueden ser legítimas y no se pueden distinguir.
    const telReal = /^d{9}$/.test(String(rId ?? "").replace(/D/g, ""));
    if (!mantenerDuplicados && telReal && vistos.has(clave)) {
      stats.duplicadas++;
      return rechazar("duplicado exacto de otra fila");
    }
    vistos.add(clave);

    const fecha = parsearFecha(rFecha);
    if (!fecha) return rechazar("fecha inválida");

    const categoria = String(rCat ?? "").trim().toUpperCase();
    if (!CATEGORIAS.includes(categoria)) return rechazar("categoría inválida");

    const monto = parsearMonto(rMonto);
    if (monto === null || monto <= 0) return rechazar("monto vacío o inválido");

    const tel = normalizarTelefono(rId);
    if (tel.rechazado) return rechazar(tel.motivo);
    if (!String(rId ?? "").trim()) stats.sinTelefono++;
    else if (tel.telefono === "999999999" && tel.ref) stats.telefonoNoRecuperable++;

    const adelantoNum = parsearMonto(rAdel) ?? 0;
    const adelanto = adelantoNum > monto ? 0 : adelantoNum;

    let { destino, courier, desconocido } = normalizarDestino(rDest);
    let tipoCrudo = rTipo;
    const notas = [];
    // "RECOJO" quedó desplazado a la columna CLIENTE NUEVO
    if (!destino && /^\s*recojo\s*$/i.test(String(rTipo ?? ""))) {
      destino = "RECOJO";
      tipoCrudo = "";
    }
    if (desconocido) notas.push(`destino original: ${desconocido}`);
    if (!destino) stats.destinoVacio++;
    else if (String(rDest ?? "").trim() !== destino && !courier) stats.destinoCorregido++;

    const fila = {
      fecha,
      telefono: tel.telefono,
      cliente_ref: tel.ref || "",
      categoria,
      monto: monto.toFixed(2),
      adelanto: adelanto.toFixed(2),
      estado: adelanto > 0 ? "pendiente" : "cerrada",
      destino: destino || "",
      courier: courier || "",
      tipo_cliente: normalizarTipoCliente(tipoCrudo) || "",
      notas: notas.join("; "),
      origen: "csv",
    };

    const error = validarVenta({
      ...fila, monto, adelanto, destino: destino || null, tipo_cliente: fila.tipo_cliente || null,
    });
    if (error) return rechazar(error);

    if (monto > UMBRAL_ATIPICO) stats.atipicos.push({ linea, fecha, monto });
    limpias.push(fila);
  });

  // Garantía: ningún teléfono vacío
  const vacios = limpias.filter((f) => !/^\d{9}$/.test(f.telefono));
  if (vacios.length) throw new Error(`Hay ${vacios.length} filas con teléfono inválido; abortando.`);

  fs.mkdirSync(carpetaSalida, { recursive: true });
  const csv = (rows, fields) => "﻿" + Papa.unparse({ fields, data: rows.map((r) => fields.map((c) => r[c])) }, { newline: "\r\n" }) + "\r\n";
  fs.writeFileSync(path.join(carpetaSalida, "ventas_limpio.csv"), csv(limpias, CAMPOS));
  fs.writeFileSync(path.join(carpetaSalida, "ventas_rechazadas.csv"), csv(rechazadas, ["linea", "motivo", "crudo"]));

  const total = limpias.reduce((s, f) => s + Number(f.monto), 0);
  console.log(`\nLeídas:       ${stats.leidas}`);
  console.log(`Limpias:      ${limpias.length}  (suma S/ ${total.toFixed(2)})`);
  console.log(`Rechazadas:   ${rechazadas.length}  (duplicadas: ${stats.duplicadas})`);
  console.log(`Sin teléfono -> 999999999:        ${stats.sinTelefono}`);
  console.log(`ID no teléfono -> 999999999:      ${stats.telefonoNoRecuperable} (original en cliente_ref)`);
  console.log(`Destino corregido / vacío:        ${stats.destinoCorregido} / ${stats.destinoVacio}`);
  if (stats.atipicos.length) {
    console.log(`\nMontos > S/ ${UMBRAL_ATIPICO} para revisar:`);
    stats.atipicos.forEach((a) => console.log(`  línea ${a.linea}  ${a.fecha}  S/ ${a.monto}`));
  }
  const porMotivo = {};
  rechazadas.forEach((r) => (porMotivo[r.motivo] = (porMotivo[r.motivo] || 0) + 1));
  console.log("\nRechazos por motivo:", porMotivo);
  console.log(`\nArchivos en ${carpetaSalida}`);
}

try {
  main();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
