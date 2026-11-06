import Link from "next/link";
import { getInventario, getMovimientos, getAlertasStock } from "../../../lib/inventario";
import TablaProductos from "../../../components/admin/TablaProductos";

export const metadata = { title: "Productos · Panel Le Chic" };
export const dynamic = "force-dynamic";

const FILTROS = [
  ["todas", "Todas"],
  ["alertas", "Stock bajo"],
  ["sin_control", "Sin control de cantidad"],
];

export default async function AdminProductosPage({ searchParams }) {
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q.trim() : "";
  const filtro = FILTROS.some(([k]) => k === params?.filtro) ? params.filtro : "todas";
  const guardado = params?.guardado === "1";
  const eliminado = params?.eliminado === "1";
  const eliminados = Number(params?.eliminados) || 0;
  const historialId = Number(params?.historial) || null;

  const porPagina = 30;
  const paginaPedida = Math.max(1, parseInt(params?.pagina, 10) || 1);
  let { variantes, total } = await getInventario({ q, filtro, pagina: paginaPedida, porPagina });
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(paginaPedida, totalPaginas);
  if (pagina !== paginaPedida) {
    ({ variantes } = await getInventario({ q, filtro, pagina, porPagina }));
  }
  const [alertas, movimientos] = await Promise.all([
    getAlertasStock(),
    historialId ? getMovimientos(historialId, 30) : Promise.resolve([]),
  ]);

  const href = (extra = {}) => {
    const sp = new URLSearchParams();
    const val = { q, filtro: filtro !== "todas" ? filtro : "", pagina: "", historial: "", ...extra };
    for (const [k, v] of Object.entries(val)) if (v) sp.set(k, String(v));
    const s = sp.toString();
    return s ? `/admin?${s}` : "/admin";
  };

  // La página pasa solo datos simples al componente cliente (sin funciones).
  const filas = variantes.map((v) => ({
    ...v,
    id: String(v.id),
    precio: v.precio === null ? null : Number(v.precio),
    precio_oferta: v.precio_oferta === null ? null : Number(v.precio_oferta),
    hrefHistorial: href({ historial: v.id, pagina: pagina > 1 ? pagina : "" }),
  }));

  return (
    <div className="form-grid">
      {guardado && <div className="mensaje-ok">Producto guardado correctamente.</div>}
      {eliminado && <div className="mensaje-ok">Producto eliminado.</div>}
      {eliminados > 0 && (
        <div className="mensaje-ok">
          {eliminados} producto{eliminados === 1 ? "" : "s"} eliminado{eliminados === 1 ? "" : "s"}.
        </div>
      )}

      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Productos ({total})</h1>
      </div>

      <TablaProductos
        filas={filas}
        q={q}
        filtro={filtro}
        total={total}
        hrefNuevo="/admin/productos/nuevo"
        alertas={alertas.length}
        hrefAlertas={href({ filtro: "alertas" })}
        hrefSinFiltro={href({ filtro: "" })}
      />

      {historialId && (
        <div className="admin-card">
          <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>Historial (últimos 30 movimientos)</h3>
          {movimientos.length === 0 ? (
            <p style={{ color: "var(--gris)" }}>Sin movimientos registrados.</p>
          ) : (
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Cant.</th>
                  <th>Stock</th>
                  <th>Origen</th>
                  <th>Referencia</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.created_at).toLocaleString("es-PE", { timeZone: "America/Lima" })}</td>
                    <td>{m.tipo}</td>
                    <td>{m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}</td>
                    <td>{m.stock_resultante}</td>
                    <td>{m.origen}</td>
                    <td>{m.referencia || "—"}</td>
                    <td>{m.motivo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {totalPaginas > 1 && (
        <nav className="admin-paginacion">
          {pagina > 1 ? (
            <Link href={href({ pagina: pagina - 1 })} className="btn-admin">← Anterior</Link>
          ) : (
            <span className="btn-admin" style={{ opacity: 0.4 }}>← Anterior</span>
          )}
          <span>
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link href={href({ pagina: pagina + 1 })} className="btn-admin">Siguiente →</Link>
          ) : (
            <span className="btn-admin" style={{ opacity: 0.4 }}>Siguiente →</span>
          )}
        </nav>
      )}
    </div>
  );
}
