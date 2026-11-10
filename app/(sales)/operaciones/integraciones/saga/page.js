import TabsSaga from "../../../../../components/admin/TabsSaga";
import FiltrosSincronizaciones from "../../../../../components/admin/FiltrosSincronizaciones";
import TablaSincronizacionesSaga from "../../../../../components/admin/TablaSincronizacionesSaga";
import Paginacion from "../../../../../components/admin/Paginacion";
import { requerirUsuarioVentas, reintentarStockSagaVentas, reintentarTodoStockSagaVentas, actualizarEstadoSagaVentas } from "../../actions";
import { getCuentas, getSincronizacionesSaga, contarSincronizacionesSaga, refrescarPendientes } from "../../../../../lib/saga-sync";
import { stockParaSaga } from "../../../../../lib/saga-mapeo";

export const metadata = { title: "SAGA · Le Chic · Operaciones" };
export const dynamic = "force-dynamic";

const BASE = "/operaciones/integraciones/saga";
const texto = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : "");

/** Misma vista que /admin/integraciones/saga, limitada a las sincronizaciones que originó el usuario. */
export default async function SagaOperacionesPage({ searchParams }) {
  const usuario = await requerirUsuarioVentas();
  const params = await searchParams;
  const estado = params?.estado === "pendiente" ? "pendiente" : "error";
  const pagina = Math.max(1, parseInt(params?.pagina, 10) || 1);
  const filtros = { cuenta: texto(params?.cuenta), q: texto(params?.q) };
  // El usuario sale siempre de la sesión, nunca de la URL.
  const alcance = { ...filtros, usuario: usuario.usuario };
  const cuentas = await getCuentas();

  // Al ver los pendientes se consulta a SAGA primero (solo los envíos de este usuario).
  if (estado === "pendiente") await refrescarPendientes(null, { usuario: usuario.usuario });

  const [{ filas, total, porPagina }, conteo] = await Promise.all([
    getSincronizacionesSaga({ estado, pagina, ...alcance }),
    contarSincronizacionesSaga(alcance),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  const datos = filas.map((f) => ({
    ...f,
    variante_id: String(f.variante_id),
    proximo_intento: f.proximo_intento ? new Date(f.proximo_intento).toISOString() : null,
    ultimo_sync: f.ultimo_sync ? new Date(f.ultimo_sync).toISOString() : null,
    stock_saga: stockParaSaga(f),
  }));

  const href = (cambios = {}) => {
    const v = { ...filtros, ...cambios };
    const q = new URLSearchParams();
    if (estado !== "error") q.set("estado", estado);
    for (const k of ["q", "cuenta"]) if (v[k]) q.set(k, v[k]);
    if (cambios.pagina > 1) q.set("pagina", String(cambios.pagina));
    const s = q.toString();
    return `${BASE}${s ? `?${s}` : ""}`;
  };
  const extraTabs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();

  const nombreCuenta = cuentas.find((c) => c.alias === filtros.cuenta)?.nombre || filtros.cuenta;
  const chips = [
    filtros.cuenta && { texto: `Cuenta: ${nombreCuenta}`, href: href({ cuenta: "" }) },
    filtros.q && { texto: `"${filtros.q}"`, href: href({ q: "" }) },
  ].filter(Boolean);

  return (
    <div className="form-grid">
      <FiltrosSincronizaciones action={BASE} estado={estado} filtros={filtros} cuentas={cuentas} chips={chips} />
      <TabsSaga activo={estado} conteo={conteo} base={BASE} extra={extraTabs} />
      <TablaSincronizacionesSaga
        filas={datos}
        estado={estado}
        rutaProducto="/operaciones/productos"
        acciones={{ reintentar: reintentarStockSagaVentas, reintentarTodo: reintentarTodoStockSagaVentas, actualizar: actualizarEstadoSagaVentas }}
      />
      <Paginacion pagina={pagina} totalPaginas={totalPaginas} hrefAnterior={href({ pagina: pagina - 1 })} hrefSiguiente={href({ pagina: pagina + 1 })} />
    </div>
  );
}
