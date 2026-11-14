import { after } from "next/server";
import { getInventario, getMovimientos, getAlertasStock, leerFiltrosColumnas } from "../../../lib/inventario";
import { query } from "../../../lib/db";
import { getConfigStock } from "../../../lib/stock-config";
import { reintentarStockPendiente } from "../../../lib/saga-sync";
import { drenarCola } from "../../../lib/saga-cola";
import Link from "next/link";
import TablaProductos from "../../../components/admin/TablaProductos";
import Paginacion from "../../../components/admin/Paginacion";

export const metadata = { title: "Productos · Panel Le Chic" };
export const dynamic = "force-dynamic";

export default async function AdminProductosPage({ searchParams }) {
  const params = await searchParams;
  // Al abrir el panel se reintentan, sin demorar la página, los avisos de stock a SAGA que fallaron.
  after(async () => {
    await reintentarStockPendiente();
    await drenarCola(); // envíos que SAGA dejó en espera por su límite de 1 feed cada 2 minutos
  });
  const guardado = params?.guardado === "1";
  const eliminado = params?.eliminado === "1";
  const eliminados = Number(params?.eliminados) || 0;
  const historialId = Number(params?.historial) || null;

  const columnas = leerFiltrosColumnas(params);

  const porPagina = 30;
  const paginaPedida = Math.max(1, parseInt(params?.pagina, 10) || 1);
  let { variantes, total } = await getInventario({ columnas, pagina: paginaPedida, porPagina });
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(paginaPedida, totalPaginas);
  if (pagina !== paginaPedida) {
    ({ variantes } = await getInventario({ columnas, pagina, porPagina }));
  }
  const [alertas, movimientos, marcas, cuentas, configStock] = await Promise.all([
    getAlertasStock(),
    historialId ? getMovimientos(historialId, 30) : Promise.resolve([]),
    query("select distinct marca from productos where marca is not null and marca <> '' order by marca"),
    query("select alias from cuentas_saga order by alias"),
    getConfigStock(),
  ]);

  const href = (extra = {}) => {
    const sp = new URLSearchParams();
    const delasColumnas = Object.fromEntries(Object.entries(columnas).map(([k, v]) => [`c_${k}`, v]));
    const val = { ...delasColumnas, pagina: "", historial: "", ...extra };
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
      {typeof params?.saga === "string" && params.saga && (
        <div className={params.saga.startsWith("Guardado y enviado") ? "mensaje-ok" : "mensaje-error"}>
          {params.saga}
        </div>
      )}
      {eliminado && <div className="mensaje-ok">Producto eliminado.</div>}
      {params?.errorEliminar && <div className="mensaje-error">{params.errorEliminar}</div>}
      {eliminados > 0 && (
        <div className="mensaje-ok">
          {eliminados} producto{eliminados === 1 ? "" : "s"} eliminado{eliminados === 1 ? "" : "s"}.
        </div>
      )}

      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Productos ({total})</h1>
      </div>

      {historialId && (
        <div className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ fontSize: "1rem" }}>Historial (últimos 30 movimientos)</h3>
            <Link href={href({ pagina: pagina > 1 ? pagina : "" })} className="btn-ico" aria-label="Cerrar historial">✕</Link>
          </div>
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

      <TablaProductos
        filas={filas}
        total={total}
        hrefNuevo="/admin/productos/nuevo"
        alertas={alertas.length}
        hrefAlertas={href({ c_stock: "alertas" })}
        configStock={configStock}
        columnas={columnas}
        marcas={marcas.map((m) => m.marca)}
        cuentas={cuentas.map((c) => c.alias)}
        hrefLimpiarColumnas={href(Object.fromEntries(Object.keys(columnas).map((k) => [`c_${k}`, ""])))}
      />

      <Paginacion
        pagina={pagina}
        totalPaginas={totalPaginas}
        hrefAnterior={href({ pagina: pagina - 1 })}
        hrefSiguiente={href({ pagina: pagina + 1 })}
      />

    </div>
  );
}
