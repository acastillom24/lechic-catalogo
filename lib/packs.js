/**
 * ============================================================
 *  PACKS (solo servidor)
 * ============================================================
 *  Un pack es una variante con es_pack = true armada con otras variantes
 *  (tabla pack_componentes). Su stock no se guarda, se calcula:
 *
 *    stock_pack = min( floor(disponible_componente / cantidad_en_pack) )
 *
 *  donde "disponible" es lo mismo que se publica en SAGA para esa variante
 *  (stockParaSaga: respeta activo, sin control y stock mínimo). Si un
 *  componente se agota, el pack queda en 0 y se deja de vender.
 *
 *  La venta de un pack descuenta de sus componentes (nunca del pack).
 * ============================================================
 */
const { query } = require("./db");
const { stockParaSaga } = require("./saga-mapeo");

/** Stock de un pack a partir de sus componentes: [{ ...variante, cantidad }]. Sin componentes = 0. */
function calcularStockPack(componentes) {
  if (!componentes.length) return 0;
  return Math.min(
    ...componentes.map((c) => Math.floor(stockParaSaga(c) / Math.max(1, Number(c.cantidad) || 1)))
  );
}

/** Componentes (con los datos de stock de su variante) de varios packs: Map<packId, componentes[]>. */
async function cargarComponentes(packIds) {
  const ids = [...new Set(packIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  const mapa = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return mapa;
  const filas = await query(
    `select pc.pack_variante_id, pc.cantidad, c.id, c.sku, c.nombre, c.stock, c.stock_actual, c.stock_minimo, c.activo,
            p.nombre as producto
       from pack_componentes pc
       join variantes c on c.id = pc.componente_variante_id
       join productos p on p.id = c.producto_id
      where pc.pack_variante_id = any($1::bigint[])
      order by pc.pack_variante_id, p.nombre, c.orden, c.id`,
    [ids]
  );
  for (const f of filas) mapa.get(Number(f.pack_variante_id)).push(f);
  return mapa;
}

/**
 * Agrega `pack_stock` (stock calculado) a las filas de variantes que sean pack. Las filas necesitan
 * `es_pack` y el id en `id` o `variante_id`. Modifica y devuelve las mismas filas.
 */
async function adjuntarStockPack(filas) {
  const packs = filas.filter((f) => f.es_pack);
  if (!packs.length) return filas;
  const mapa = await cargarComponentes(packs.map((f) => f.variante_id ?? f.id));
  for (const f of packs) f.pack_stock = calcularStockPack(mapa.get(Number(f.variante_id ?? f.id)) || []);
  return filas;
}

/** Componentes de un SKU si es un pack: [{ id, cantidad }]; null si no es pack (o no existe). */
async function getComponentesPorSku(sku) {
  const filas = await query(
    `select v.id, v.es_pack,
            coalesce((select json_agg(json_build_object('id', pc.componente_variante_id, 'cantidad', pc.cantidad))
                        from pack_componentes pc where pc.pack_variante_id = v.id), '[]'::json) as componentes
       from variantes v where v.sku = $1`,
    [String(sku).trim()]
  );
  if (!filas[0] || !filas[0].es_pack) return null;
  return filas[0].componentes.map((c) => ({ id: Number(c.id), cantidad: Number(c.cantidad) }));
}

/** Ids de los packs que contienen a esta variante. */
async function packsDeComponente(varianteId) {
  const filas = await query("select pack_variante_id from pack_componentes where componente_variante_id = $1", [varianteId]);
  return filas.map((f) => Number(f.pack_variante_id));
}

/**
 * Mantiene `variantes.stock` (el boolean que lee la tienda) de los packs al día con su stock calculado.
 * Devuelve Map<packId, stockCalculado>. Nunca lanza.
 */
async function refrescarDisponibilidad(packIds) {
  const calculados = new Map();
  try {
    const mapa = await cargarComponentes(packIds);
    for (const [packId, comps] of mapa) {
      const n = calcularStockPack(comps);
      calculados.set(packId, n);
      await query("update variantes set stock = $2 where id = $1 and es_pack and stock is distinct from $2", [packId, n > 0]);
    }
  } catch (e) {
    console.error("[packs] refrescar disponibilidad:", e.message);
  }
  return calculados;
}

/** Actualiza la disponibilidad de todos los packs que contienen la variante y avisa a SAGA. Nunca lanza. */
async function sincronizarPacksDe(varianteId) {
  try {
    const { sincronizarStockVariante } = require("./saga-sync");
    const ids = await packsDeComponente(varianteId);
    await refrescarDisponibilidad(ids);
    for (const id of ids) await sincronizarStockVariante(id);
  } catch (e) {
    console.error("[packs] sincronizar packs:", e.message);
  }
}

/**
 * Tras un movimiento en un componente (stock `previo` -> `actual`), avisa a SAGA solo de los packs
 * cuyo stock calculado cambió. Nunca lanza.
 */
async function propagarAPacks(varianteId, previo, actual) {
  try {
    const packs = await packsDeComponente(varianteId);
    if (!packs.length) return;
    const mapa = await cargarComponentes(packs);
    const { sincronizarStockVariante } = require("./saga-sync");
    const con = (comps, stock) => comps.map((c) => (Number(c.id) === Number(varianteId) ? { ...c, stock_actual: stock } : c));
    const ahora = await refrescarDisponibilidad(packs);
    for (const [packId, comps] of mapa) {
      if (calcularStockPack(con(comps, previo)) !== ahora.get(packId)) {
        await sincronizarStockVariante(packId);
      }
    }
  } catch (e) {
    console.error("[packs] propagar:", e.message);
  }
}

/**
 * Valida los componentes de un pack: [{ id, cantidad }]. Devuelve el mensaje de error o null.
 * Reglas: al menos uno, sin repetidos, cantidades enteras > 0, ningún componente es un pack ni el propio pack.
 */
async function validarComponentes(packId, componentes) {
  if (!componentes.length) return "Un pack necesita al menos un producto.";
  const ids = componentes.map((c) => Number(c.id));
  if (new Set(ids).size !== ids.length) return "Un producto está repetido en el pack: súmalo en la cantidad.";
  for (const c of componentes) {
    if (!Number.isInteger(Number(c.cantidad)) || Number(c.cantidad) <= 0) return "La cantidad de cada producto del pack debe ser un entero mayor a 0.";
  }
  if (packId && ids.includes(Number(packId))) return "Un pack no puede contenerse a sí mismo.";
  const filas = await query("select id, es_pack from variantes where id = any($1::bigint[])", [ids]);
  if (filas.length !== ids.length) return "Alguno de los productos del pack ya no existe.";
  if (filas.some((f) => f.es_pack)) return "Un pack no puede contener otro pack.";
  return null;
}

module.exports = {
  calcularStockPack,
  cargarComponentes,
  adjuntarStockPack,
  getComponentesPorSku,
  packsDeComponente,
  refrescarDisponibilidad,
  sincronizarPacksDe,
  propagarAPacks,
  validarComponentes,
};
