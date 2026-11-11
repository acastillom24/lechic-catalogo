import { notFound } from "next/navigation";
import { getMarcas, getPestanas, getProducto, getVariantesParaPack } from "../../../../../lib/data";
import { getCuentasActivas, getSincronizacionesProducto, getPreciosCanalProducto, getPaquetesCuentaProducto } from "../../../../../lib/saga-sync";
import { getOpcionesSaga } from "../../../../../lib/saga-opciones";
import ProductoForm from "../../../../../components/admin/ProductoForm";
import EliminarProductoBoton from "../../../../../components/admin/EliminarProductoBoton";

export const metadata = { title: "Editar producto · Panel Le Chic" };
// Las imágenes se envían a SAGA tras guardar (~2 minutos): necesita más tiempo que una página normal.
export const maxDuration = 300;

export default async function EditarProductoPage({ params }) {
  const { id } = await params;
  const producto = await getProducto(id, { incluirInactivas: true });
  if (!producto) notFound();

  const [marcas, pestanas] = await Promise.all([getMarcas(), getPestanas()]);
  const opcionesSaga = await getOpcionesSaga();
  const cuentasSaga = (await getCuentasActivas()).map((c) => ({ alias: c.alias, nombre: c.nombre }));
  const sync = await getSincronizacionesProducto(producto.id);
  const sincronizadas = [...new Set(sync.map((x) => x.cuenta_alias))];
  const variantesSincronizadas = [...new Set(sync.map((x) => String(x.variante_id)))];
  const estadoSync = {};
  for (const x of sync) (estadoSync[x.variante_id] ||= {})[x.cuenta_alias] = { origen: x.origen, accion: x.accion, estado: x.estado };

  const fecha = (d) => (d ? (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10) : "");
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

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Editar producto</h1>
        <EliminarProductoBoton id={producto.id} nombre={producto.nombre} />
      </div>
      <ProductoForm modo="editar" marcas={marcas} pestanas={pestanas} producto={producto} cuentasSaga={cuentasSaga} sincronizadas={sincronizadas} variantesSincronizadas={variantesSincronizadas} estadoSync={estadoSync} preciosCanal={preciosCanal} paquetesCuenta={paquetesCuenta} opcionesSaga={opcionesSaga} variantesPack={await getVariantesParaPack()} />
    </div>
  );
}
