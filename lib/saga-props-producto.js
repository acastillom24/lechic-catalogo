import { getCuentasActivas, getSincronizacionesProducto, getPreciosCanalProducto, getPaquetesCuentaProducto, getCategoriasCuentaProducto } from "./saga-sync";
import { getOpcionesSaga } from "./saga-opciones";

const fecha = (d) => (d ? (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10) : "");

/**
 * Props SAGA de ProductoForm (cuentas, opciones, sincronizaciones y precios por canal).
 * Las comparten las pantallas de producto de /admin y del panel /operaciones.
 */
export async function getPropsSagaProducto(producto) {
  const opcionesSaga = await getOpcionesSaga();
  const cuentasSaga = (await getCuentasActivas()).map((c) => ({ alias: c.alias, nombre: c.nombre }));
  if (!producto) return { opcionesSaga, cuentasSaga };

  const sync = await getSincronizacionesProducto(producto.id);
  const sincronizadas = [...new Set(sync.map((x) => x.cuenta_alias))];
  const variantesSincronizadas = [...new Set(sync.map((x) => String(x.variante_id)))];
  const estadoSync = {};
  for (const x of sync) (estadoSync[x.variante_id] ||= {})[x.cuenta_alias] = { origen: x.origen, accion: x.accion, estado: x.estado };
  const preciosCanal = {};
  for (const r of await getPreciosCanalProducto(producto.id)) {
    (preciosCanal[r.variante_id] ||= {})[r.cuenta_alias] = {
      precio: r.precio ?? "",
      precioOferta: r.precio_oferta ?? "",
      ofertaInicio: fecha(r.oferta_inicio),
      ofertaFin: fecha(r.oferta_fin),
    };
  }
  const paquetesCuenta = await getPaquetesCuentaProducto(producto.id);
  const categoriasCuenta = await getCategoriasCuentaProducto(producto.id);
  return { opcionesSaga, cuentasSaga, sincronizadas, variantesSincronizadas, estadoSync, preciosCanal, paquetesCuenta, categoriasCuenta };
}
