import { getSincronizacionesSaga, contarSincronizacionesSaga, refrescarPendientes } from "../../../../../lib/saga-sync";
import { stockParaSaga } from "../../../../../lib/saga-mapeo";
import TabsSaga from "../../../../../components/admin/TabsSaga";
import TablaSincronizacionesSaga from "../../../../../components/admin/TablaSincronizacionesSaga";
import Paginacion from "../../../../../components/admin/Paginacion";

export const metadata = { title: "SAGA · Panel Le Chic" };
export const dynamic = "force-dynamic";

export default async function SagaPage({ searchParams }) {
  const params = await searchParams;
  const estado = params?.estado === "pendiente" ? "pendiente" : "error";
  const pagina = Math.max(1, parseInt(params?.pagina, 10) || 1);

  // Al ver los pendientes se consulta a SAGA primero, para mostrar el resultado más reciente.
  if (estado === "pendiente") await refrescarPendientes();

  const [{ filas, total, porPagina }, conteo] = await Promise.all([
    getSincronizacionesSaga({ estado, pagina }),
    contarSincronizacionesSaga(),
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

  const href = (extra) => {
    const q = new URLSearchParams();
    if (estado !== "error") q.set("estado", estado);
    if (extra.pagina > 1) q.set("pagina", String(extra.pagina));
    const s = q.toString();
    return `/admin/integraciones/saga${s ? `?${s}` : ""}`;
  };

  return (
    <div className="form-grid">
      <TabsSaga activo={estado} conteo={conteo} />
      <TablaSincronizacionesSaga filas={datos} estado={estado} />
      <Paginacion
        pagina={pagina}
        totalPaginas={totalPaginas}
        hrefAnterior={href({ pagina: pagina - 1 })}
        hrefSiguiente={href({ pagina: pagina + 1 })}
      />
    </div>
  );
}
