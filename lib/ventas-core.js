/**
 * Reglas puras de ventas (sin base de datos): compartidas entre el panel
 * /operaciones, las server actions y el script de limpieza del CSV.
 */

const TELEFONO_SIN_DATO = "999999999";
const CATEGORIAS = ["CATALOGOS", "IMPORTADOS"];
const DESTINOS = ["LIMA", "PROVINCIA", "RECOJO"];
const TIPOS_CLIENTE = ["NUEVO", "RECOMPRA"];
const ESTADOS = ["pendiente", "cerrada"];
const METODOS_PAGO = ["YAPE", "PLIN", "TRANSFERENCIA", "EFECTIVO", "TARJETA"];
const COURIERS = ["SHALOM", "OLVA", "MOTORIZADO"];

/**
 * Normaliza el campo "ID" (teléfono).
 * Devuelve { telefono, ref, rechazado, motivo }:
 *  - vacío o no recuperable  -> telefono = 999999999 (ref guarda el original)
 *  - 9 dígitos iguales != 9s -> rechazado
 */
function normalizarTelefono(valor) {
  const original = String(valor ?? "").trim();
  if (!original) return { telefono: TELEFONO_SIN_DATO, ref: null, rechazado: false };

  const digitos = original.replace(/\D/g, "");
  const esSoloNumerico = /^[\s:/\-().+\d]+$/.test(original);

  if (esSoloNumerico && digitos.length === 9) {
    if (/^(\d)\1{8}$/.test(digitos) && digitos !== TELEFONO_SIN_DATO) {
      return {
        telefono: null,
        ref: original,
        rechazado: true,
        motivo: `teléfono con 9 dígitos iguales (${digitos})`,
      };
    }
    return { telefono: digitos, ref: null, rechazado: false };
  }
  // +51 999 999 999 -> 51 + 9 dígitos
  if (esSoloNumerico && digitos.length === 11 && digitos.startsWith("51")) {
    return normalizarTelefono(digitos.slice(2));
  }
  // Instagram, nombre, longitud distinta de 9: sin teléfono, se conserva el original
  return { telefono: TELEFONO_SIN_DATO, ref: original, rechazado: false };
}

const MESES = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, set: 9, sep: 9, oct: 10, nov: 11, dic: 12,
};

/** "5 oct 2025" | "2025-10-05" | "05/10/2025" -> "2025-10-05" o null */
function parsearFecha(valor) {
  const s = String(valor ?? "").trim().toLowerCase();
  let m = s.match(/^(\d{1,2})\s+([a-záéíóú]{3})[a-z]*\.?\s+(\d{4})$/);
  if (m && MESES[m[2]]) return iso(+m[3], MESES[m[2]], +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

function iso(a, m, d) {
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** " 1,234.50 " | "108.38." | "87..8" -> número o null */
function parsearMonto(valor) {
  let s = String(valor ?? "").trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;
  s = s.replace(/,/g, "");
  s = s.replace(/\.{2,}/g, ".").replace(/\.$/, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// Distancia de edición simple para corregir typos (PROVINICA -> PROVINCIA)
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return d[a.length][b.length];
}

function masCercano(valor, opciones, maxDist) {
  let mejor = null;
  let mejorD = Infinity;
  for (const o of opciones) {
    const dist = distancia(valor, o);
    if (dist < mejorD) {
      mejorD = dist;
      mejor = o;
    }
  }
  return mejorD <= maxDist ? mejor : null;
}

/** Valor de "LIMA/PROVINCIA/RECOJO" -> { destino, courier } */
function normalizarDestino(valor) {
  const s = String(valor ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return { destino: null, courier: null };
  if (s === "SHALOM") return { destino: "PROVINCIA", courier: "SHALOM" };
  if (s === "PR") return { destino: "PROVINCIA", courier: null };
  if (s === "RECOJO") return { destino: "RECOJO", courier: null };
  const cercano = masCercano(s, ["LIMA", "PROVINCIA"], s.startsWith("LI") ? 1 : 3);
  if (cercano) return { destino: cercano, courier: null };
  return { destino: null, courier: null, desconocido: String(valor).trim() };
}

function normalizarTipoCliente(valor) {
  const s = String(valor ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return null;
  if (s === "RECOJO" || s === "IMPORTADOS" || s === "SMP") return null;
  const n = masCercano(s, ["NUEVO"], 2);
  const r = masCercano(s, ["RECOMPRA"], 3);
  if (n && (!r || distancia(s, n) <= distancia(s, r))) return "NUEVO";
  if (r) return "RECOMPRA";
  if (s === "NUEVA") return "NUEVO";
  return null;
}

/** Columna date de Postgres (Date o string) -> "YYYY-MM-DD". */
function fechaISO(f) {
  if (f instanceof Date) return f.toISOString().slice(0, 10);
  return String(f ?? "").slice(0, 10);
}

/**
 * Mensaje de error o null. `v` ya con tipos (monto/adelanto numéricos). `op` = listas vigentes
 * (lib/ventas-opciones.js); sin él se usan las de por defecto.
 */
function validarVenta(v, op = {}) {
  const categorias = op.categorias || CATEGORIAS;
  const destinos = op.destinos || DESTINOS;
  const tipos = op.tiposCliente || TIPOS_CLIENTE;
  if (!v.fecha) return "Fecha inválida.";
  if (!categorias.includes(v.categoria)) return "Categoría inválida.";
  if (!/^\d{9}$/.test(v.telefono || "")) return "El teléfono debe tener 9 dígitos (usa 999999999 si no se tiene).";
  if (/^(\d)\1{8}$/.test(v.telefono) && v.telefono !== TELEFONO_SIN_DATO)
    return "Teléfono inválido: no puede tener los 9 dígitos iguales (excepto 999999999 si no se tiene).";
  if (!Number.isFinite(v.monto) || v.monto < 0) return "Monto inválido.";
  if (v.monto > 50000) return "Monto demasiado alto; revisa el valor.";
  if (!Number.isFinite(v.adelanto) || v.adelanto < 0) return "Adelanto inválido.";
  if (v.adelanto > v.monto) return "El adelanto no puede superar el monto.";
  if (v.destino && !destinos.includes(v.destino)) return "Destino inválido.";
  if (v.tipo_cliente && !tipos.includes(v.tipo_cliente)) return "Tipo de cliente inválido.";
  if (!ESTADOS.includes(v.estado)) return "Estado inválido.";
  return null;
}

module.exports = {
  TELEFONO_SIN_DATO,
  CATEGORIAS,
  DESTINOS,
  TIPOS_CLIENTE,
  ESTADOS,
  METODOS_PAGO,
  COURIERS,
  fechaISO,
  normalizarTelefono,
  parsearFecha,
  parsearMonto,
  normalizarDestino,
  normalizarTipoCliente,
  validarVenta,
};
