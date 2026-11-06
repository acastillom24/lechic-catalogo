/**
 * ============================================================
 *  INVENTARIO (solo servidor)
 * ============================================================
 *  Única vía para modificar variantes.stock_actual. Cada cambio queda
 *  registrado en movimientos_inventario, en la MISMA sentencia SQL
 *  (atómica), así que stock y movimiento nunca se desincronizan.
 *
 *  - stock_actual NULL = variante sin control de cantidad (usa el
 *    boolean `stock`). Un movimiento manual/csv la pasa a controlada
 *    partiendo de 0. Los movimientos de facturación NO la inicializan:
 *    se devuelven como { estado: "sin_control" }.
 *  - idempotencyKey: si ya existe, no se aplica de nuevo
 *    ({ estado: "duplicado" }). La restricción única de la base cubre
 *    también las llamadas concurrentes.
 *
 *  Estados devueltos: ok | duplicado | sin_control | insuficiente |
 *                     no_encontrada
 * ============================================================
 */
const { query } = require("./db");

const TIPOS = ["entrada", "salida", "ajuste", "devolucion"];
const ORIGENES = ["manual", "facturacion", "csv"];

function normalizarCantidad(tipo, cantidad) {
  const n = Number(cantidad);
  if (!Number.isInteger(n) || n === 0) {
    throw new Error("La cantidad debe ser un entero distinto de 0.");
  }
  if (tipo === "entrada" || tipo === "devolucion") return Math.abs(n);
  if (tipo === "salida") return -Math.abs(n);
  return n; // ajuste: lleva su propio signo
}

async function buscarVariantePorSku(sku) {
  const filas = await query("select id from variantes where sku = $1", [String(sku).trim()]);
  return filas[0] ? Number(filas[0].id) : null;
}

/**
 * Aplica un movimiento de inventario.
 * @param {object} m
 * @param {number} [m.varianteId]
 * @param {string} [m.sku]               alternativa a varianteId
 * @param {"entrada"|"salida"|"ajuste"|"devolucion"} m.tipo
 * @param {number} m.cantidad            entrada/devolucion/salida: magnitud; ajuste: con signo
 * @param {string} [m.motivo]
 * @param {"manual"|"facturacion"|"csv"} [m.origen="manual"]
 * @param {string} [m.referencia]        ej. B001-123
 * @param {string} [m.idempotencyKey]    ej. facturacion:<id>:emitido
 * @param {string} [m.usuario]
 * @param {boolean} [m.permitirNegativo=false]
 */
async function aplicarMovimiento(m) {
  const tipo = m.tipo;
  const origen = m.origen || "manual";
  if (!TIPOS.includes(tipo)) throw new Error(`Tipo de movimiento inválido: ${tipo}`);
  if (!ORIGENES.includes(origen)) throw new Error(`Origen inválido: ${origen}`);
  const delta = normalizarCantidad(tipo, m.cantidad);

  let varianteId = m.varianteId ? Number(m.varianteId) : null;
  if (!varianteId && m.sku) varianteId = await buscarVariantePorSku(m.sku);
  if (!varianteId) return { estado: "no_encontrada" };

  const iniciar = origen !== "facturacion";
  const permitirNegativo = Boolean(m.permitirNegativo);
  const clave = m.idempotencyKey || null;

  // Una sola sentencia: bloquea la fila, valida, actualiza y registra.
  // Si el INSERT del movimiento viola la unicidad de idempotency_key
  // (llamada concurrente), toda la sentencia se revierte.
  let filas;
  try {
    filas = await query(
      `with v as (
         select id, stock_actual from variantes where id = $1 for update
       ),
       upd as (
         update variantes x
            set stock_actual = coalesce(v.stock_actual, 0) + $2,
                stock = (coalesce(v.stock_actual, 0) + $2) > 0
           from v
          where x.id = v.id
            and (v.stock_actual is not null or $3)
            and ($4 or coalesce(v.stock_actual, 0) + $2 >= 0)
            and ($5::text is null or not exists (
                  select 1 from movimientos_inventario where idempotency_key = $5))
        returning x.id, x.stock_actual
       )
       insert into movimientos_inventario
         (variante_id, tipo, cantidad, stock_resultante, motivo, origen,
          referencia, idempotency_key, usuario)
       select id, $6, $2, stock_actual, $7, $8, $9, $5, $10 from upd
       returning id, stock_resultante`,
      [
        varianteId,
        delta,
        iniciar,
        permitirNegativo,
        clave,
        tipo,
        m.motivo || "",
        origen,
        m.referencia || null,
        m.usuario || null,
      ]
    );
  } catch (e) {
    if (e && e.code === "23505") return { estado: "duplicado" };
    throw e;
  }

  if (filas.length) {
    return {
      estado: "ok",
      movimientoId: Number(filas[0].id),
      stock: Number(filas[0].stock_resultante),
    };
  }

  // No se aplicó: averiguar por qué.
  if (clave) {
    const dup = await query(
      "select 1 from movimientos_inventario where idempotency_key = $1",
      [clave]
    );
    if (dup.length) return { estado: "duplicado" };
  }
  const v = await query("select stock_actual from variantes where id = $1", [varianteId]);
  if (!v.length) return { estado: "no_encontrada" };
  if (v[0].stock_actual === null && !iniciar) return { estado: "sin_control" };
  return { estado: "insuficiente", stock: v[0].stock_actual };
}

/**
 * Fija el stock a una cantidad exacta (conteo físico / activar control).
 * Registra un 'ajuste' por la diferencia. Si no hay diferencia y la variante
 * ya tenía control, no hace nada; si no tenía control y se fija 0, solo
 * activa el control (sin movimiento, la cantidad no puede ser 0).
 */
async function fijarStock({ varianteId, cantidad, motivo, usuario, origen = "manual" }) {
  const nuevo = Number(cantidad);
  if (!Number.isInteger(nuevo) || nuevo < 0) {
    throw new Error("El stock debe ser un entero mayor o igual a 0.");
  }
  const filas = await query("select stock_actual from variantes where id = $1", [varianteId]);
  if (!filas.length) return { estado: "no_encontrada" };
  const actual = filas[0].stock_actual;
  const delta = nuevo - (actual ?? 0);

  if (delta === 0) {
    if (actual === null) {
      await query("update variantes set stock_actual = 0, stock = false where id = $1", [varianteId]);
    }
    return { estado: "ok", stock: nuevo };
  }
  return aplicarMovimiento({
    varianteId,
    tipo: "ajuste",
    cantidad: delta,
    motivo: motivo || "Conteo / ajuste manual",
    origen,
    usuario,
  });
}

/**
 * Listado de variantes para la pantalla de inventario.
 * filtro: "todas" | "alertas" (stock <= mínimo) | "sin_control"
 */
function armarFiltroInventario({ q = "", filtro = "todas", ids = null } = {}) {
  const params = [];
  const cond = ["true"];
  const texto = q.trim();
  if (texto) {
    params.push(`%${texto.replace(/[\\%_]/g, "\\$&")}%`);
    cond.push(`(p.nombre ilike $${params.length} or v.nombre ilike $${params.length} or v.sku ilike $${params.length})`);
  }
  if (filtro === "alertas") cond.push("v.stock_actual is not null and v.stock_actual <= v.stock_minimo");
  if (filtro === "sin_control") cond.push("v.stock_actual is null");
  if (Array.isArray(ids)) {
    params.push(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    cond.push(`v.id = any($${params.length}::bigint[])`);
  }
  return { params, where: `where ${cond.join(" and ")}` };
}

async function getInventario({ q = "", filtro = "todas", pagina = 1, porPagina = 30 } = {}) {
  const { params, where } = armarFiltroInventario({ q, filtro });
  const desde = (Math.max(1, Number(pagina)) - 1) * Number(porPagina);

  const [{ n }] = await query(
    `select count(*)::int as n from variantes v join productos p on p.id = v.producto_id ${where}`,
    params
  );
  const filas = await query(
    `select v.id, v.sku, v.nombre as variante, v.stock, v.stock_actual, v.stock_minimo,
            v.costo, v.activo, v.precio, v.precio_oferta, v.imagen,
            p.id as producto_id, p.nombre as producto, p.marca, p.categoria
       from variantes v
       join productos p on p.id = v.producto_id
       ${where}
      order by p.nombre, v.orden, v.id
      limit ${Number(porPagina)} offset ${Number(desde)}`,
    params
  );
  return { variantes: filas, total: n };
}

/**
 * Todas las variantes que coinciden (sin paginar), con los datos completos del
 * producto, para exportar a CSV. `ids` limita a las variantes seleccionadas.
 */
async function getVariantesParaExportar({ q = "", filtro = "todas", ids = null } = {}) {
  const { params, where } = armarFiltroInventario({ q, filtro, ids });
  return query(
    `select p.id as producto_id, p.marca, p.categoria, p.nombre as producto, p.descripcion,
            p.aromas as aromas_producto, p.destacado,
            v.nombre as variante, v.precio, v.precio_oferta, v.stock, v.imagen,
            v.aromas as aromas_variante, v.sku, v.stock_actual, v.stock_minimo, v.costo
       from variantes v
       join productos p on p.id = v.producto_id
       ${where}
      order by p.nombre, v.orden, v.id`,
    params
  );
}

/** Historial de movimientos de una variante (más recientes primero). */
async function getMovimientos(varianteId, limite = 50) {
  return query(
    `select id, tipo, cantidad, stock_resultante, motivo, origen, referencia, usuario, created_at
       from movimientos_inventario
      where variante_id = $1
      order by created_at desc, id desc
      limit ${Number(limite)}`,
    [varianteId]
  );
}

/** Variantes con control de cantidad cuyo stock está en o bajo el mínimo. */
async function getAlertasStock() {
  return query(
    `select v.id, v.sku, v.nombre as variante, v.stock_actual, v.stock_minimo,
            p.id as producto_id, p.nombre as producto
       from variantes v
       join productos p on p.id = v.producto_id
      where v.activo and v.stock_actual is not null and v.stock_actual <= v.stock_minimo
      order by v.stock_actual asc, p.nombre`
  );
}

module.exports = {
  aplicarMovimiento,
  fijarStock,
  getInventario,
  getVariantesParaExportar,
  buscarVariantePorSku,
  getMovimientos,
  getAlertasStock,
};
