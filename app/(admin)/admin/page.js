import Link from "next/link";
import { getProductos, buscar, getMarca, rangoPrecios } from "../../../lib/data";

export const metadata = { title: "Productos · Panel Le Chic" };

export default async function AdminDashboardPage({ searchParams }) {
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q.trim() : "";
  const guardado = params?.guardado === "1";
  const eliminado = params?.eliminado === "1";

  const productos = q ? await buscar(q) : await getProductos();

  return (
    <div className="form-grid">
      {guardado && <div className="mensaje-ok">Producto guardado correctamente.</div>}
      {eliminado && <div className="mensaje-ok">Producto eliminado.</div>}

      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Productos ({productos.length})</h1>
        <Link href="/admin/productos/nuevo" className="btn-admin solido">
          + Nuevo producto
        </Link>
      </div>

      <form className="admin-buscador" method="get">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por nombre, aroma..." />
      </form>

      <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-tabla">
          <thead>
            <tr>
              <th></th>
              <th>Producto</th>
              <th>Marca</th>
              <th>Variantes</th>
              <th>Precio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => {
              const marca = getMarca(p.marca);
              const { min, max } = rangoPrecios(p);
              const hayStock = p.variantes.some((v) => v.stock);
              const primeraImagen = p.variantes.find((v) => v.imagen)?.imagen;
              return (
                <tr key={p.id}>
                  <td>
                    {primeraImagen ? (
                      <img src={primeraImagen} alt="" className="admin-miniatura" />
                    ) : (
                      <div className="admin-miniatura" />
                    )}
                  </td>
                  <td>
                    <div>{p.nombre}</div>
                    {!hayStock && <span className="pill agotado">Agotado</span>}
                  </td>
                  <td>{marca?.nombre || p.marca}</td>
                  <td>{p.variantes.length}</td>
                  <td>
                    {Number.isFinite(min)
                      ? min === max
                        ? `S/ ${min}`
                        : `S/ ${min} – S/ ${max}`
                      : "—"}
                  </td>
                  <td>
                    <Link href={`/admin/productos/${p.id}`} className="btn-admin">
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {productos.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
                  No hay productos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
