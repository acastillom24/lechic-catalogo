import SalesCabecera from "../../../../../components/sales/SalesCabecera";
import { getMarcas } from "../../../../../lib/data";
import ProductoForm from "../../../../../components/admin/ProductoForm";
import { requerirUsuarioVentas, crearProductoVentas } from "../../actions";

export const metadata = { title: "Nuevo producto · Ventas Le Chic" };
export const dynamic = "force-dynamic";

export default async function NuevoProductoVentasPage() {
  const usuario = await requerirUsuarioVentas();
  const marcas = getMarcas();

  return (
    <>
      <SalesCabecera usuario={usuario} activa="productos" />

      <main className="admin-main">
        <div className="form-grid">
          <div className="admin-titulo-fila">
            <h1 className="admin-titulo">Nuevo producto</h1>
          </div>
          <ProductoForm modo="crear" marcas={marcas} accionGuardar={crearProductoVentas} />
        </div>
      </main>
    </>
  );
}
