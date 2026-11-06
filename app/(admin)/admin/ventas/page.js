import { getVentas } from "../../../../lib/ventas";
import { leerFiltrosVentas } from "../../../../lib/filtros-ventas";
import { fechaISO } from "../../../../lib/ventas-core";
import VentasBarra from "../../../../components/admin/VentasBarra";
import Paginacion from "../../../../components/admin/Paginacion";

export const metadata = { title: "Ventas · Panel Le Chic" };
export const dynamic = "force-dynamic";

const soles = (n) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaCorta = (f) => fechaISO(f).split("-").reverse().join("/");

export default async function VentasPage({ searchParams }) {
  const params = await searchParams;
  const filtros = leerFiltrosVentas(params);
  const paginaPedida = Math.max(1, parseInt(params?.pagina, 10) || 1);
  const { filas, total, monto, adelanto, porPagina } = await getVentas(filtros, paginaPedida);
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(paginaPedida, paginas);

  // Enlaces que conservan los filtros activos.
  const qs = (extra = {}) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filtros, ...extra })) if (v) u.set(k, String(v));
    return u.toString();
  };
  const href = (extra = {}) => {
    const s = qs(extra);
    return s ? `/admin/ventas?${s}` : "/admin/ventas";
  };

  const chips = [
    filtros.desde && { texto: `Desde ${filtros.desde}`, href: href({ desde: "" }) },
    filtros.hasta && { texto: `Hasta ${filtros.hasta}`, href: href({ hasta: "" }) },
    filtros.categoria && { texto: filtros.categoria, href: href({ categoria: "" }) },
    filtros.destino && { texto: `Entrega: ${filtros.destino}`, href: href({ destino: "" }) },
    filtros.estado && { texto: filtros.estado === "pendiente" ? "Pendientes" : "Cerradas", href: href({ estado: "" }) },
    filtros.tipo && { texto: filtros.tipo, href: href({ tipo: "" }) },
    filtros.q && { texto: `"${filtros.q}"`, href: href({ q: "" }) },
  ].filter(Boolean);

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
        <h1 className="admin-titulo">Ventas ({total.toLocaleString("es-PE")})</h1>
      </div>

      <VentasBarra filtros={filtros} chips={chips} hrefExportar={`/admin/ventas/exportar?${qs()}`} />

      <div className="kpi-grid">
        <div className="admin-card kpi">
          <div className="kpi-etiqueta">Ventas</div>
          <div className="kpi-valor">{total.toLocaleString("es-PE")}</div>
        </div>
        <div className="admin-card kpi">
          <div className="kpi-etiqueta">Monto total</div>
          <div className="kpi-valor">{soles(monto)}</div>
        </div>
        <div className="admin-card kpi">
          <div className="kpi-etiqueta">Ticket promedio</div>
          <div className="kpi-valor">{soles(total ? monto / total : 0)}</div>
        </div>
        <div className="admin-card kpi">
          <div className="kpi-etiqueta">Adelantos</div>
          <div className="kpi-valor">{soles(adelanto)}</div>
        </div>
      </div>

      <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>ID</th>
              <th>Categoría</th>
              <th>Entrega</th>
              <th>Cliente</th>
              <th>Monto</th>
              <th>Adelanto</th>
              <th>Estado</th>
              <th>Registró</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((v) => (
              <tr key={v.id}>
                <td>{fechaCorta(v.fecha)}</td>
                <td className="celda-producto" title={v.cliente_ref || undefined}>
                  {v.telefono}
                </td>
                <td>{v.categoria}</td>
                <td>{[v.destino, v.courier].filter(Boolean).join(" · ") || "—"}</td>
                <td>{v.tipo_cliente || "—"}</td>
                <td>{soles(v.monto)}</td>
                <td>{Number(v.adelanto) > 0 ? soles(v.adelanto) : "—"}</td>
                <td>
                  <span className={v.estado === "pendiente" ? "pill" : "pill cerrada"}>
                    {v.estado === "pendiente" ? "Pendiente" : "Cerrada"}
                  </span>
                </td>
                <td>{v.registrado_por_nombre || (v.origen === "csv" ? "Excel" : "—")}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
                  No hay ventas con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Paginacion
        pagina={pagina}
        totalPaginas={paginas}
        hrefAnterior={href({ pagina: pagina - 1 })}
        hrefSiguiente={href({ pagina: pagina + 1 })}
      />
    </div>
  );
}
