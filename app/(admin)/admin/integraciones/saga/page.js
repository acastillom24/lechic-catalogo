import { listarUsuariosVentas } from "../../../../../lib/ventas";
import { getCuentas, getSincronizacionesSaga, contarSincronizacionesSaga, refrescarPendientes } from "../../../../../lib/saga-sync";
import { stockParaSaga } from "../../../../../lib/saga-mapeo";
import TabsSaga from "../../../../../components/admin/TabsSaga";
import FiltrosSincronizaciones from "../../../../../components/admin/FiltrosSincronizaciones";
import TablaSincronizacionesSaga from "../../../../../components/admin/TablaSincronizacionesSaga";
import Paginacion from "../../../../../components/admin/Paginacion";

export const metadata = { title: "SAGA · Panel Le Chic" };
export const dynamic = "force-dynamic";

const BASE = "/admin/integraciones/saga";
const texto = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : "");

export default async function SagaPage({ searchParams }) {
  const params = await searchParams;
  const estado = params?.estado === "pendiente" ? "pendiente" : "error";
  const pagina = Math.max(1, parseInt(params?.pagina, 10) || 1);
  // Filtros: usuario del panel /operaciones (vacío = todos, "__admin" = admin o automático), cuenta y búsqueda.
  const filtros = { usuario: texto(params?.usuario), cuenta: texto(params?.cuenta), q: texto(params?.q) };
  const [usuarios, cuentas] = await Promise.all([listarUsuariosVentas(), getCuentas()]);

  // Al ver los pendientes se consulta a SAGA primero, para mostrar el resultado más reciente.
  if (estado === "pendiente") await refrescarPendientes(null, { usuario: filtros.usuario || null });

  const [{ filas, total, porPagina }, conteo] = await Promise.all([
    getSincronizacionesSaga({ estado, pagina, ...filtros }),
    contarSincronizacionesSaga(filtros),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  // Fechas como texto y el stock que se publicaría en SAGA (colchón por stock mínimo), calculado aquí.
  const datos = filas.map((f) => ({
    ...f,
    variante_id: String(f.variante_id),
    proximo_intento: f.proximo_intento ? new Date(f.proximo_intento).toISOString() : null,
    ultimo_sync: f.ultimo_sync ? new Date(f.ultimo_sync).toISOString() : null,
    stock_saga: stockParaSaga(f),
  }));

  // Enlaces que conservan estado y filtros; `cambios` sobrescribe (un valor vacío quita el filtro).
  const href = (cambios = {}) => {
    const v = { ...filtros, ...cambios };
    const q = new URLSearchParams();
    if (estado !== "error") q.set("estado", estado);
    for (const k of ["q", "cuenta", "usuario"]) if (v[k]) q.set(k, v[k]);
    if (cambios.pagina > 1) q.set("pagina", String(cambios.pagina));
    const s = q.toString();
    return `${BASE}${s ? `?${s}` : ""}`;
  };
  const extraTabs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();

  const nombreCuenta = cuentas.find((c) => c.alias === filtros.cuenta)?.nombre || filtros.cuenta;
  const chips = [
    filtros.usuario && { texto: `Usuario: ${filtros.usuario === "__admin" ? "Admin / automático" : filtros.usuario}`, href: href({ usuario: "" }) },
    filtros.cuenta && { texto: `Cuenta: ${nombreCuenta}`, href: href({ cuenta: "" }) },
    filtros.q && { texto: `"${filtros.q}"`, href: href({ q: "" }) },
  ].filter(Boolean);

  return (
    <div className="form-grid">
      <FiltrosSincronizaciones action={BASE} estado={estado} filtros={filtros} cuentas={cuentas} usuarios={usuarios} chips={chips} />
      <TabsSaga activo={estado} conteo={conteo} extra={extraTabs} />
      <TablaSincronizacionesSaga filas={datos} estado={estado} mostrarUsuario />
      <Paginacion
        pagina={pagina}
        totalPaginas={totalPaginas}
        hrefAnterior={href({ pagina: pagina - 1 })}
        hrefSiguiente={href({ pagina: pagina + 1 })}
      />
    </div>
  );
}
