import { listarUsuariosVentas } from "../../../../../lib/ventas";
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
  // Filtro por usuario del panel /operaciones: vacío = todos, "__admin" = sin usuario (admin o automático).
  const usuario = typeof params?.usuario === "string" && params.usuario ? params.usuario.slice(0, 60) : null;
  const usuarios = await listarUsuariosVentas();

  // Al ver los pendientes se consulta a SAGA primero, para mostrar el resultado más reciente.
  if (estado === "pendiente") await refrescarPendientes(null, { usuario });

  const [{ filas, total, porPagina }, conteo] = await Promise.all([
    getSincronizacionesSaga({ estado, pagina, usuario }),
    contarSincronizacionesSaga({ usuario }),
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
    if (usuario) q.set("usuario", usuario);
    if (extra.pagina > 1) q.set("pagina", String(extra.pagina));
    const s = q.toString();
    return `/admin/integraciones/saga${s ? `?${s}` : ""}`;
  };

  return (
    <div className="form-grid">
      <form method="get" className="admin-barra" style={{ alignItems: "center", gap: 8 }}>
        {estado !== "error" && <input type="hidden" name="estado" value={estado} />}
        <label htmlFor="filtro-usuario">Usuario</label>
        <select id="filtro-usuario" name="usuario" defaultValue={usuario || ""}>
          <option value="">Todos los usuarios</option>
          <option value="__admin">Admin / automático</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.usuario}>
              {u.usuario}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-ico-texto">Filtrar</button>
      </form>
      <TabsSaga activo={estado} conteo={conteo} extra={usuario ? `usuario=${encodeURIComponent(usuario)}` : ""} />
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
