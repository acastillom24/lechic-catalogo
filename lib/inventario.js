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
const { propagarAPacks } = require("./packs");
const { getConfigStock } = require("./stock-config");
const { IDS: IDS_NIVELES, condicionNivel, condicionAlertas } = require("./stock-niveles");

const TIPOS = ["entrada", "salida", "ajuste", "devolucion"];
const ORIGENES = ["manual", "facturacion", "csv"];

async function sincronizarStockSaga(varianteId, usuario = null) {
  try {
    // Los movimientos del panel /operaciones llegan como "ventas:<usuario>".
    const usuarioPanel = String(usuario || "").startsWith("ventas:") ? String(usuario).slice(7) : null;
    await require("./saga-sync").sincronizarStockVariante(varianteId, { usuario: usuarioPanel });
  } catch (e) {
    console.error("[saga] sincronizar stock:", e.message);
  }
}

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
         select id, stock_actual from variantes where id = $1 and not es_pack for update
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
    const stock = Number(filas[0].stock_resultante);
    const previo = stock - delta;
    // Si cambió el stock que se publica en SAGA, avisar: cada venta o reposición actualiza la cantidad,
    // y al llegar al stock mínimo (colchón) se publica 0. Mejor esfuerzo, nunca lanza.
    const [{ stock_minimo: minimo }] = await query("select stock_minimo from variantes where id = $1", [varianteId]);
    const umbral = Number(minimo || 0);
    const publicado = (n) => (n > umbral ? n : 0);
    if (publicado(previo) !== publicado(stock)) {
      await sincronizarStockSaga(varianteId, m.usuario);
    }
    // Si es componente de packs, avisar de los packs cuyo stock calculado cambió (p. ej. al agotarse).
    await propagarAPacks(varianteId, previo, stock);
    return {
      estado: "ok",
      movimientoId: Number(filas[0].id),
      stock,
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
  const v = await query("select stock_actual, es_pack from variantes where id = $1", [varianteId]);
  if (!v.length) return { estado: "no_encontrada" };
  if (v[0].es_pack) return { estado: "es_pack" }; // el stock de un pack se calcula, no admite movimientos
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
  const filas = await query("select stock_actual, es_pack from variantes where id = $1", [varianteId]);
  if (!filas.length) return { estado: "no_encontrada" };
  if (filas[0].es_pack) return { estado: "es_pack" };
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
const SISTEMAS = ["sin", "publicado", "pendiente", "error", "vinculado"];
const STOCKS = [...IDS_NIVELES, "alertas"];
const CLAVES_COLUMNAS = ["producto", "variante", "sku", "marca", "sistema", "cuenta", "stock", "min_d", "min_h", "precio_d", "precio_h"];

/** Filtros por columna a partir de cualquier objeto (searchParams o formData, claves `c_<columna>`); solo valores válidos. */
function leerFiltrosColumnas(datos = {}) {
  const t = (k) => String(datos?.[`c_${k}`] ?? "").trim().slice(0, 100);
  const n = (k) => {
    const v = t(k).replace(",", ".");
    return v !== "" && Number.isFinite(Number(v)) ? v : "";
  };
  const salida = {
    producto: t("producto"), variante: t("variante"), sku: t("sku"), marca: t("marca"), cuenta: t("cuenta"),
    sistema: SISTEMAS.includes(t("sistema")) ? t("sistema") : "",
    stock: STOCKS.includes(t("stock")) ? t("stock") : "",
    min_d: n("min_d"), min_h: n("min_h"), precio_d: n("precio_d"), precio_h: n("precio_h"),
  };
  return Object.fromEntries(Object.entries(salida).filter(([, v]) => v !== ""));
}

function condicionesColumnas(c, params, cond, cfgStock) {
  const p = (v) => (params.push(v), `$${params.length}`);
  const like = (v) => p(`%${v.replace(/[\%_]/g, "\$&")}%`);
  if (c.producto) cond.push(`p.nombre ilike ${like(c.producto)}`);
  if (c.variante) cond.push(`v.nombre ilike ${like(c.variante)}`);
  if (c.sku) cond.push(`v.sku ilike ${like(c.sku)}`);
  if (c.marca) cond.push(`p.marca = ${p(c.marca)}`);
  if (c.sistema || c.cuenta) {
    const porCuenta = c.cuenta ? ` and s.cuenta_alias = ${p(c.cuenta)}` : "";
    const estado = { publicado: " and s.estado = 'publicado'", pendiente: " and s.estado = 'pendiente'", error: " and s.estado = 'error'", vinculado: " and s.origen = 'vinculado'" }[c.sistema] || "";
    cond.push(`${c.sistema === "sin" ? "not exists" : "exists"} (select 1 from sincronizaciones s where s.variante_id = v.id${porCuenta}${estado})`);
  }
  if (c.stock) cond.push(c.stock === "alertas" ? condicionAlertas(cfgStock) : condicionNivel(c.stock, cfgStock));
  if (c.min_d) cond.push(`v.stock_actual is not null and v.stock_minimo >= ${p(Number(c.min_d))}`);
  if (c.min_h) cond.push(`v.stock_actual is not null and v.stock_minimo <= ${p(Number(c.min_h))}`);
  if (c.precio_d) cond.push(`coalesce(v.precio_oferta, v.precio) >= ${p(Number(c.precio_d))}`);
  if (c.precio_h) cond.push(`coalesce(v.precio_oferta, v.precio) <= ${p(Number(c.precio_h))}`);
}

function armarFiltroInventario({ q = "", filtro = "todas", ids = null, columnas = null, cfgStock = undefined } = {}) {
  const params = [];
  const cond = ["true"];
  if (columnas) condicionesColumnas(columnas, params, cond, cfgStock);
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

async function getInventario({ q = "", filtro = "todas", columnas = null, pagina = 1, porPagina = 30 } = {}) {
  const { params, where } = armarFiltroInventario({ q, filtro, columnas, cfgStock: columnas?.stock ? await getConfigStock() : undefined });
  const desde = (Math.max(1, Number(pagina)) - 1) * Number(porPagina);

  const [{ n }] = await query(
    `select count(*)::int as n from variantes v join productos p on p.id = v.producto_id ${where}`,
    params
  );
  const filas = await query(
    `select v.id, v.sku, v.nombre as variante, v.stock, v.stock_actual, v.stock_minimo,
            v.costo, v.activo, v.precio, v.precio_oferta, v.imagen,
            p.id as producto_id, p.nombre as producto, p.marca, coalesce(p.pestana, p.marca) as pestana, p.categoria,
            coalesce((select json_agg(json_build_object('cuenta', s.cuenta_alias, 'estado', s.estado, 'error', s.error, 'origen', s.origen, 'accion', s.accion)
                                      order by s.cuenta_alias)
                        from sincronizaciones s where s.variante_id = v.id), '[]'::json) as sync
       from variantes v
       join productos p on p.id = v.producto_id
       ${where}
      order by p.orden desc, p.created_at desc, p.id, v.orden, v.id
      limit ${Number(porPagina)} offset ${Number(desde)}`,
    params
  );
  return { variantes: filas, total: n };
}

/**
 * Todas las variantes que coinciden (sin paginar), con los datos completos del
 * producto, para exportar a CSV. `ids` limita a las variantes seleccionadas.
 */
async function getVariantesParaExportar({ q = "", filtro = "todas", ids = null, columnas = null } = {}) {
  const { params, where } = armarFiltroInventario({ q, filtro, ids, columnas, cfgStock: columnas?.stock ? await getConfigStock() : undefined });
  return query(
    `select p.id as producto_id, p.marca, coalesce(p.pestana, p.marca) as pestana, p.categoria, p.nombre as producto, p.descripcion,
            p.notas_aromaticas as notas_producto, p.destacado,
            v.nombre as variante, v.precio, v.precio_oferta, v.stock, v.imagen,
            v.notas_aromaticas as notas_variante, v.sku, v.stock_actual, v.stock_minimo, v.costo
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

/** Variantes activas en alguno de los niveles de stock marcados para la campana (Configuración → Inventario). */
async function getAlertasStock() {
  const cond = condicionAlertas(await getConfigStock());
  return query(
    `select v.id, v.sku, v.nombre as variante, v.stock_actual, v.stock_minimo,
            p.id as producto_id, p.nombre as producto
       from variantes v
       join productos p on p.id = v.producto_id
      where v.activo and ${cond}
      order by v.stock_actual asc nulls last, p.nombre`
  );
}

module.exports = {
  aplicarMovimiento,
  fijarStock,
  getInventario,
  leerFiltrosColumnas,
  CLAVES_COLUMNAS,
  getVariantesParaExportar,
  buscarVariantePorSku,
  getMovimientos,
  getAlertasStock,
};
