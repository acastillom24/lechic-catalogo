import SalesCabecera from "../../../../components/sales/SalesCabecera";
import TabsSaga from "../../../../components/admin/TabsSaga";
import TablaSincronizacionesSaga from "../../../../components/admin/TablaSincronizacionesSaga";
import Paginacion from "../../../../components/admin/Paginacion";
import { requerirUsuarioVentas, reintentarStockSagaVentas, reintentarTodoStockSagaVentas, actualizarEstadoSagaVentas } from "../actions";
import { getSincronizacionesSaga, contarSincronizacionesSaga, refrescarPendientes } from "../../../../lib/saga-sync";
import { stockParaSaga } from "../../../../lib/saga-mapeo";

export const metadata = { title: "SAGA · Le Chic · Operaciones" };
export const dynamic = "force-dynamic";

const BASE = "/operaciones/saga";

/** Misma vista que /admin/integraciones/saga, limitada a las sincronizaciones que originó el usuario. */
export default async function SagaOperacionesPage({ searchParams }) {
  const usuario = await requerirUsuarioVentas();
  const params = await searchParams;
  const estado = params?.estado === "pendiente" ? "pendiente" : "error";
  const pagina = Math.max(1, parseInt(params?.pagina, 10) || 1);

  // Al ver los pendientes se consulta a SAGA primero (solo los envíos de este usuario).
  if (estado === "pendiente") await refrescarPendientes(null, { usuario: usuario.usuario });

  const [{ filas, total, porPagina }, conteo] = await Promise.all([
    getSincronizacionesSaga({ estado, pagina, usuario: usuario.usuario }),
    contarSincronizacionesSaga({ usuario: usuario.usuario }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  const datos = filas.map((f) => ({
    ...f,
    variante_id: String(f.variante_id),
    proximo_intento: f.proximo_intento ? new Date(f.proximo_intento).toISOString() : null,
    ultimo_sync: f.ultimo_sync ? new Date(f.ultimo_sync).toISOString() : null,
    stock_saga: stockParaSaga(f),
  }));

  const href = (p) => {
    const q = new URLSearchParams();
    if (estado !== "error") q.set("estado", estado);
    if (p > 1) q.set("pagina", String(p));
    const s = q.toString();
    return `${BASE}${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <SalesCabecera usuario={usuario} activa="saga" />
      <main className="admin-main">
        <div className="form-grid">
          <div className="admin-titulo-fila">
            <h1 className="admin-titulo">Mis sincronizaciones con SAGA</h1>
          </div>
          <TabsSaga activo={estado} conteo={conteo} base={BASE} />
          <TablaSincronizacionesSaga filas={datos} estado={estado}
            rutaProducto="/operaciones/productos"
            acciones={{ reintentar: reintentarStockSagaVentas, reintentarTodo: reintentarTodoStockSagaVentas, actualizar: actualizarEstadoSagaVentas }}
          />
          <Paginacion pagina={pagina} totalPaginas={totalPaginas} hrefAnterior={href(pagina - 1)} hrefSiguiente={href(pagina + 1)} />
        </div>
      </main>
    </>
  );
}
