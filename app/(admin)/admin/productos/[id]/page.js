import { notFound } from "next/navigation";
import { getMarcas, getProducto } from "../../../../../lib/data";
import ProductoForm from "../../../../../components/admin/ProductoForm";
import EliminarProductoBoton from "../../../../../components/admin/EliminarProductoBoton";

export const metadata = { title: "Editar producto · Panel Le Chic" };

export default async function EditarProductoPage({ params }) {
  const { id } = await params;
  const producto = await getProducto(id);
  if (!producto) notFound();

  const marcas = getMarcas();

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Editar producto</h1>
        <EliminarProductoBoton id={producto.id} nombre={producto.nombre} />
      </div>
      <ProductoForm modo="editar" marcas={marcas} producto={producto} />
    </div>
  );
}
