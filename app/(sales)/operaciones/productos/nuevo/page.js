import SalesCabecera from "../../../../../components/sales/SalesCabecera";
import { getMarcas, getPestanas } from "../../../../../lib/data";
import ProductoForm from "../../../../../components/admin/ProductoForm";
import { getPropsSagaProducto } from "../../../../../lib/saga-props-producto";
import { requerirUsuarioVentas, crearProductoVentas } from "../../actions";

export const metadata = { title: "Nuevo producto · Le Chic · Operaciones" };
export const dynamic = "force-dynamic";

export default async function NuevoProductoVentasPage() {
  const usuario = await requerirUsuarioVentas();
  const [marcas, pestanas] = await Promise.all([getMarcas(), getPestanas()]);
  const saga = await getPropsSagaProducto(null);

  return (
    <>
      <SalesCabecera usuario={usuario} activa="productos" />

      <main className="admin-main">
        <div className="form-grid">
          <div className="admin-titulo-fila">
            <h1 className="admin-titulo">Nuevo producto</h1>
          </div>
          <ProductoForm modo="crear" marcas={marcas} pestanas={pestanas} accionGuardar={crearProductoVentas} permitirSaga {...saga} />
        </div>
      </main>
    </>
  );
}
