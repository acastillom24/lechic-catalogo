import Link from "next/link";
import VentaForm from "../../../components/sales/VentaForm";
import SalesBarra from "../../../components/sales/SalesBarra";
import { IconoEditar, IconoPapelera } from "../../../components/admin/Iconos";
import SalesCabecera from "../../../components/sales/SalesCabecera";
import { requerirUsuarioVentas, eliminarVentaDelDia } from "./actions";
import {
  getDefaultsVenta,
  getVentasSales,
  contarPendientes,
  getVentaEditable,
} from "../../../lib/ventas";
import { fechaISO } from "../../../lib/ventas-core";

export const metadata = { title: "Ventas · Le Chic" };
export const dynamic = "force-dynamic";

const VISTAS = ["hoy", "pendientes", "todas"];
const soles = (n) =>
  `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaCorta = (f) => fechaISO(f).split("-").reverse().join("/");

export default async function SalesPage({ searchParams }) {
  const usuario = await requerirUsuarioVentas();
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q.trim().slice(0, 40) : "";
  const vista = VISTAS.includes(params?.vista) ? params.vista : "hoy";
  const editarId = Number(params?.editar) || null;
  const nueva = params?.nueva === "1";
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }); // YYYY-MM-DD

  const [defaults, ventas, pendientes, aEditar] = await Promise.all([
    getDefaultsVenta(),
    getVentasSales({ usuarioId: usuario.id, filtro: vista, q: q || undefined }),
    contarPendientes(),
    editarId ? getVentaEditable(editarId, usuario.id) : null,
  ]);

  // Enlaces que conservan la búsqueda y el filtro actuales.
  const href = (extra = {}) => {
    const u = new URLSearchParams();
    const base = { q, vista: vista === "hoy" ? "" : vista, ...extra };
    for (const [k, val] of Object.entries(base)) if (val) u.set(k, String(val));
    const s = u.toString();
    return s ? `/sales?${s}` : "/sales";
  };
  const hrefVista = (v) => href({ vista: v === "hoy" ? "" : v });
  const volverHref = href();

  const total = ventas.reduce((s, v) => s + Number(v.monto), 0);
  const porCobrar = ventas
    .filter((v) => v.estado === "pendiente")
    .reduce((s, v) => s + (Number(v.monto) - Number(v.adelanto)), 0);

  const ventaEdicion = aEditar && {
    ...aEditar,
    fecha: fechaISO(aEditar.fecha),
    monto: String(aEditar.monto),
    adelanto: String(aEditar.adelanto),
  };

  const titulo =
    vista === "pendientes"
      ? `Ventas pendientes (${ventas.length}) · por cobrar ${soles(porCobrar)}`
      : vista === "todas"
        ? `Últimas ventas (${ventas.length})`
        : `Mis ventas de hoy (${ventas.length}) · ${soles(total)}`;

  return (
    <>
      <SalesCabecera usuario={usuario} activa="ventas" pendientes={pendientes} />

      <main className="admin-main">
        <div className="form-grid">
          <SalesBarra
            q={q}
            vista={vista}
            pendientes={pendientes}
            hrefNueva={href({ nueva: 1, editar: "" })}
            hrefHoy={hrefVista("hoy")}
            hrefPendientes={hrefVista("pendientes")}
          />

          {(nueva || ventaEdicion) && (
            <VentaForm
              hoy={hoy}
              defaults={defaults}
              venta={ventaEdicion || undefined}
              volverHref={volverHref}
            />
          )}
          {editarId && !aEditar && (
            <div className="mensaje-error">Esa venta no se puede editar (ya está cerrada o no es tuya).</div>
          )}

          <h1 className="admin-titulo" style={{ fontSize: "1.4rem" }}>
            {titulo}
          </h1>

          <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>ID</th>
                  <th>Categoría</th>
                  <th>Entrega</th>
                  <th>Monto</th>
                  <th>Adelanto</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => {
                  const pendiente = v.estado === "pendiente";
                  return (
                    <tr key={v.id}>
                      <td>{fechaCorta(v.fecha)}</td>
                      <td className="celda-producto" title={v.cliente_ref || undefined}>
                        {v.telefono}
                      </td>
                      <td>{v.categoria}</td>
                      <td>{[v.destino, v.courier].filter(Boolean).join(" · ") || "—"}</td>
                      <td>{soles(v.monto)}</td>
                      <td>{Number(v.adelanto) > 0 ? soles(v.adelanto) : "—"}</td>
                      <td>{pendiente ? <strong>{soles(Number(v.monto) - Number(v.adelanto))}</strong> : "—"}</td>
                      <td>
                        <span className={pendiente ? "pill" : "pill cerrada"}>
                          {pendiente ? "Pendiente" : "Cerrada"}
                        </span>
                      </td>
                      <td>
                        <div className="acciones-fila">
                          {v.editable && (
                            <Link
                              href={href({ editar: v.id, nueva: "" })}
                              className="btn-ico"
                              title="Editar"
                              aria-label="Editar venta"
                            >
                              <IconoEditar />
                            </Link>
                          )}
                          {v.eliminable && (
                            <form action={eliminarVentaDelDia.bind(null, v.id)}>
                              <button className="btn-ico" title="Eliminar" aria-label="Eliminar venta">
                                <IconoPapelera />
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {ventas.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
                      {vista === "pendientes" ? "No hay ventas pendientes." : "No hay ventas que mostrar."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
