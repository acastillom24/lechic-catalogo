import { getMarcas } from "../../../../../lib/data";
import ProductoForm from "../../../../../components/admin/ProductoForm";

export const metadata = { title: "Nuevo producto · Panel Le Chic" };

export default function NuevoProductoPage() {
  const marcas = getMarcas();

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Nuevo producto</h1>
      </div>
      <ProductoForm modo="crear" marcas={marcas} />
    </div>
  );
}
