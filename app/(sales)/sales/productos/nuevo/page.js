import Link from "next/link";
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
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <span className="admin-topbar-marca">Ventas Le Chic</span>
          <nav className="admin-nav">
            <Link href="/sales">Volver a ventas</Link>
            <span style={{ opacity: 0.7 }}>{usuario.usuario}</span>
          </nav>
        </div>
      </header>

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
