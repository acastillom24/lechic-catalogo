/** Datos del dashboard que no son de ventas (catálogo y stock). */
const { query } = require("./db");
const { getAlertasStock } = require("./inventario");

async function getResumenCatalogo() {
  const [r] = await query(
    `select
       (select count(*) from productos)::int                                   as productos,
       count(*) filter (where v.activo)::int                                   as variantes,
       count(*) filter (where v.activo and v.stock_actual is null)::int        as sin_control,
       count(*) filter (where v.activo and v.stock_actual = 0)::int            as agotadas,
       count(*) filter (where v.activo and v.stock_actual > 0
                          and v.stock_actual <= v.stock_minimo)::int           as bajo_minimo,
       coalesce(sum(v.stock_actual * v.costo) filter (where v.activo and v.stock_actual > 0),0)::float as valor_costo,
       coalesce(sum(v.stock_actual * coalesce(v.precio_oferta, v.precio))
                filter (where v.activo and v.stock_actual > 0),0)::float       as valor_venta
     from variantes v`
  );
  const porMarca = await query(
    `select p.marca as nombre, count(*)::int as n,
            count(*) filter (where v.stock_actual = 0)::int as agotadas
     from variantes v join productos p on p.id = v.producto_id
     where v.activo group by p.marca order by n desc limit 8`
  );
  const alertas = (await getAlertasStock()).slice(0, 8);

  // Entradas de stock de los últimos 30 días (lo más cercano a "compras").
  const [ent] = await query(
    `select coalesce(sum(m.cantidad),0)::int as unidades,
            coalesce(sum(m.cantidad * v.costo),0)::float as valor_costo,
            count(*)::int as movimientos
     from movimientos_inventario m join variantes v on v.id = m.variante_id
     where m.tipo = 'entrada' and m.created_at >= now() - interval '30 days'`
  );
  const entradas = await query(
    `select m.id, m.cantidad, m.created_at, m.referencia, m.motivo,
            v.nombre as variante, p.nombre as producto
     from movimientos_inventario m
     join variantes v on v.id = m.variante_id
     join productos p on p.id = v.producto_id
     where m.tipo = 'entrada'
     order by m.created_at desc limit 8`
  );
  return { ...r, porMarca, alertas, entradasResumen: ent, entradas };
}

module.exports = { getResumenCatalogo };
