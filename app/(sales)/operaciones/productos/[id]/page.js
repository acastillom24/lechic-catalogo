import { notFound } from "next/navigation";
import { getMarcas, getPestanas, getProducto } from "../../../../../lib/data";
import ProductoForm from "../../../../../components/admin/ProductoForm";
import SalesCabecera from "../../../../../components/sales/SalesCabecera";
import { getPropsSagaProducto } from "../../../../../lib/saga-props-producto";
import { requerirUsuarioVentas, editarProductoVentas } from "../../actions";

export const metadata = { title: "Editar producto · Le Chic · Operaciones" };
export const dynamic = "force-dynamic";

export default async function EditarProductoVentasPage({ params }) {
  const usuario = await requerirUsuarioVentas();
  const { id } = await params;
  const producto = await getProducto(id, { incluirInactivas: true });
  if (!producto) notFound();
  const saga = await getPropsSagaProducto(producto);

  return (
    <>
      <SalesCabecera usuario={usuario} activa="productos" />
      <main className="admin-main">
        <div className="form-grid">
          <div className="admin-titulo-fila">
            <h1 className="admin-titulo">Editar producto</h1>
          </div>
          <ProductoForm
            modo="editar"
            marcas={await getMarcas()}
            pestanas={await getPestanas()}
            producto={producto}
            accionGuardar={editarProductoVentas}
            restringido
            permitirSaga
            {...saga}
          />
        </div>
      </main>
    </>
  );
}
