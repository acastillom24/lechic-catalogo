import Link from "next/link";
import { getPendientes } from "../../../../../lib/ventas";
import { fechaISO } from "../../../../../lib/ventas-core";
import { cerrarVentaAccion } from "../../actions";
import { IconoBuscar, IconoCheck, IconoCerrar } from "../../../../../components/admin/Iconos";

export const metadata = { title: "Ventas pendientes · Panel Le Chic" };
export const dynamic = "force-dynamic";

const soles = (n) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaCorta = (f) => fechaISO(f).split("-").reverse().join("/");

export default async function PendientesPage({ searchParams }) {
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q.trim().slice(0, 40) : "";

  const todas = await getPendientes();
  const filas = q
    ? todas.filter((v) => v.telefono.includes(q) || (v.cliente_ref || "").toLowerCase().includes(q.toLowerCase()))
    : todas;
  const porCobrar = filas.reduce((s, v) => s + Number(v.saldo), 0);

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
        <h1 className="admin-titulo">Ventas pendientes ({filas.length})</h1>
        <span className="nota-periodo">Por cobrar: {soles(porCobrar)}</span>
      </div>

      <div className="admin-barra">
        <form method="get" action="/admin/ventas/pendientes" className="admin-barra-buscar">
          <IconoBuscar size={18} />
          <input type="search" name="q" defaultValue={q} placeholder="Buscar por teléfono o referencia..." />
        </form>
        {q && (
          <Link href="/admin/ventas/pendientes" className="chip-filtro" title="Quitar filtro">
            &quot;{q}&quot; <IconoCerrar size={14} />
          </Link>
        )}
      </div>

      <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Días</th>
              <th>ID</th>
              <th>Categoría</th>
              <th>Monto</th>
              <th>Adelanto</th>
              <th>Saldo</th>
              <th>Notas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((v) => (
              <tr key={v.id}>
                <td>{fechaCorta(v.fecha)}</td>
                <td>
                  <span className={v.dias > 30 ? "pill agotado" : "pill"}>{v.dias} d</span>
                </td>
                <td className="celda-producto" title={v.cliente_ref || undefined}>
                  {v.telefono}
                </td>
                <td>{v.categoria}</td>
                <td>{soles(v.monto)}</td>
                <td>{soles(v.adelanto)}</td>
                <td>
                  <strong>{soles(v.saldo)}</strong>
                </td>
                <td style={{ maxWidth: 240, overflowWrap: "anywhere" }}>{v.notas || ""}</td>
                <td>
                  <div className="acciones-fila">
                    <form action={cerrarVentaAccion.bind(null, v.id)}>
                      <button className="btn-ico" title="Cerrar venta (pago completo)" aria-label="Cerrar venta">
                        <IconoCheck />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
                  {q ? "No hay pendientes que coincidan." : "No hay ventas pendientes."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
