import Link from "next/link";
import { getPendientes, getVentaPorId } from "../../../../../lib/ventas";
import { fechaISO } from "../../../../../lib/ventas-core";
import { cerrarVentaAccion, editarVentaAccion } from "../../actions";
import VentaForm from "../../../../../components/sales/VentaForm";
import { ATAJOS, PERIODOS, hoyLima } from "../../../../../lib/periodos";
import { leerFiltrosVentas } from "../../../../../lib/filtros-ventas";
import { IconoCheck, IconoEditar } from "../../../../../components/admin/Iconos";
import TabsVentas from "../../../../../components/admin/TabsVentas";
import VentasBarra from "../../../../../components/admin/VentasBarra";
import FiltroColumna from "../../../../../components/admin/FiltroColumna";
import { getOpcionesVentas } from "../../../../../lib/ventas-opciones";

export const metadata = { title: "Ventas pendientes · Panel Le Chic" };
export const dynamic = "force-dynamic";

const RUTA = "/admin/ventas/pendientes";
const soles = (n) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaCorta = (f) => fechaISO(f).split("-").reverse().join("/");
const etiquetaDia = (f) => f.split("-").reverse().join("/");

// Entrega: las opciones de Configuración → Ventas (por defecto Lima / Provincia / Recojo).
const titulo = (t) => t.charAt(0) + t.slice(1).toLowerCase();

export default async function PendientesPage({ searchParams }) {
  const params = await searchParams;
  const opciones = await getOpcionesVentas();
  const filtros = leerFiltrosVentas(params, opciones);
  const nombreDestino = (d) => (d ? titulo(d) : "Sin definir");

  const todas = await getPendientes();
  // Los mismos filtros de Ventas (aquí en memoria: los pendientes son pocos). El estado no aplica: todas son pendientes.
  const q = (filtros.q || "").toLowerCase();
  const filas = todas.filter((v) => {
    const f = fechaISO(v.fecha);
    if (filtros.desde && f < filtros.desde) return false;
    if (filtros.hasta && f > filtros.hasta) return false;
    if (filtros.categoria && v.categoria !== filtros.categoria) return false;
    if (filtros.destino && v.destino !== filtros.destino) return false;
    if (filtros.tipo && v.tipo_cliente !== filtros.tipo) return false;
    if (filtros.distrito && !(v.distrito || "").toLowerCase().includes(filtros.distrito.toLowerCase())) return false;
    if (filtros.montoMin !== undefined && Number(v.monto) < filtros.montoMin) return false;
    if (filtros.montoMax !== undefined && Number(v.monto) > filtros.montoMax) return false;
    if (filtros.adelanto === "con" && !(Number(v.adelanto) > 0)) return false;
    if (filtros.adelanto === "sin" && Number(v.adelanto) > 0) return false;
    if (q && !(v.telefono.includes(q) || (v.cliente_ref || "").toLowerCase().includes(q) || (v.cliente_nombre || "").toLowerCase().includes(q))) return false;
    return true;
  });
  const porCobrar = filas.reduce((s, v) => s + Number(v.saldo), 0);
  const montoTotal = filas.reduce((s, v) => s + Number(v.monto), 0);
  const adelantos = filas.reduce((s, v) => s + Number(v.adelanto), 0);
  const masAntigua = filas.reduce((m, v) => Math.max(m, Number(v.dias)), 0);

  // Enlaces que conservan los filtros activos (periodo > día > desde/hasta).
  const qs = (extra = {}) => {
    const base = { ...filtros, ...extra };
    delete base.estado;
    if (base.periodo) {
      delete base.desde; delete base.hasta; delete base.fecha;
    } else if (base.fecha) {
      delete base.desde; delete base.hasta;
    }
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) if (v !== undefined && v !== "") u.set(k, String(v));
    return u.toString();
  };
  const href = (extra = {}) => {
    const s = qs(extra);
    return s ? `${RUTA}?${s}` : RUTA;
  };
  const parametros = (excluir = []) => {
    const o = {};
    for (const [k, v] of new URLSearchParams(qs()).entries()) if (!excluir.includes(k)) o[k] = v;
    return o;
  };
  const limpiar = (claves) => href(Object.fromEntries(claves.map((k) => [k, ""])));
  const lista = (arr, texto = (x) => x) => arr.map((x) => ({ valor: x, texto: texto(x) }));
  const sinFechas = { periodo: "", fecha: "", desde: "", hasta: "" };
  const presets = ATAJOS.map((clave) => ({ clave, texto: PERIODOS[clave], href: href({ ...sinFechas, periodo: clave }), activo: filtros.periodo === clave }));
  const col = (etiqueta, claves, campos, activo, atajos) => (
    <FiltroColumna etiqueta={etiqueta} activo={activo} campos={campos} atajos={atajos} ocultos={parametros(claves)} hrefLimpiar={limpiar(claves)} accion={RUTA} />
  );
  const hrefExportar = (formato) => {
    const u = new URLSearchParams(qs());
    u.set("estado", "pendiente");
    if (formato) u.set("formato", formato);
    return `/admin/ventas/exportar?${u.toString()}`;
  };
  const chips = [
    filtros.periodo && { texto: PERIODOS[filtros.periodo], href: href(sinFechas) },
    filtros.fecha && { texto: `Día ${etiquetaDia(filtros.fecha)}`, href: href(sinFechas) },
    !filtros.periodo && !filtros.fecha && filtros.desde && { texto: `Desde ${etiquetaDia(filtros.desde)}`, href: href({ desde: "" }) },
    !filtros.periodo && !filtros.fecha && filtros.hasta && { texto: `Hasta ${etiquetaDia(filtros.hasta)}`, href: href({ hasta: "" }) },
    filtros.categoria && { texto: filtros.categoria, href: href({ categoria: "" }) },
    filtros.destino && { texto: `Entrega: ${nombreDestino(filtros.destino)}`, href: href({ destino: "" }) },
    filtros.tipo && { texto: filtros.tipo, href: href({ tipo: "" }) },
    filtros.adelanto && { texto: filtros.adelanto === "con" ? "Con adelanto" : "Sin adelanto", href: href({ adelanto: "" }) },
    (filtros.montoMin !== undefined || filtros.montoMax !== undefined) && {
      texto: `Monto ${filtros.montoMin !== undefined ? `desde S/ ${filtros.montoMin}` : ""}${filtros.montoMin !== undefined && filtros.montoMax !== undefined ? " " : ""}${filtros.montoMax !== undefined ? `hasta S/ ${filtros.montoMax}` : ""}`,
      href: href({ montoMin: "", montoMax: "" }),
    },
    filtros.distrito && { texto: `Distrito: ${filtros.distrito}`, href: href({ distrito: "" }) },
    filtros.q && { texto: `"${filtros.q}"`, href: href({ q: "" }) },
  ].filter(Boolean);

  // Edición de una venta pendiente (admin): ?editar=<id> sobre esta misma lista, conservando los filtros.
  const volverHref = href();
  const hrefEditar = (id) => `${volverHref}${volverHref.includes("?") ? "&" : "?"}editar=${id}`;
  const editarId = Number(params?.editar) || null;
  const aEditar = editarId ? await getVentaPorId(editarId) : null;
  const ventaEdicion = aEditar && { ...aEditar, fecha: fechaISO(aEditar.fecha), monto: String(aEditar.monto), adelanto: String(aEditar.adelanto) };

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
        <h1 className="admin-titulo">Ventas pendientes ({filas.length})</h1>
      </div>
      <TabsVentas activo="pendientes" pendientes={todas.length} />

      {editarId && ventaEdicion && (
        <VentaForm
          hoy={hoyLima()}
          defaults={{ categoria: ventaEdicion.categoria, destino: ventaEdicion.destino }}
          opciones={opciones}
          venta={ventaEdicion}
          volverHref={volverHref}
          accion={editarVentaAccion}
        />
      )}
      {editarId && !ventaEdicion && <div className="mensaje-error">Esa venta ya no existe.</div>}

      {/* Lo más importante: cuánto falta por cobrar. */}
      <div className="kpi-grid kpi-pendientes">
        <div className="admin-card kpi kpi-principal">
          <div className="kpi-etiqueta">Por cobrar</div>
          <div className="kpi-valor">{soles(porCobrar)}</div>
          <div className="kpi-sub">{filas.length} venta{filas.length === 1 ? "" : "s"} pendiente{filas.length === 1 ? "" : "s"}</div>
        </div>
        <div className="admin-card kpi">
          <div className="kpi-etiqueta">Monto de las ventas</div>
          <div className="kpi-valor">{soles(montoTotal)}</div>
          <div className="kpi-sub">Ya cobrado en adelantos: {soles(adelantos)}</div>
        </div>
        <div className="admin-card kpi">
          <div className="kpi-etiqueta">Más antigua</div>
          <div className="kpi-valor">{masAntigua} d</div>
          <div className="kpi-sub">{masAntigua > 30 ? "Más de 30 días: conviene revisarla" : "Dentro de lo normal"}</div>
        </div>
      </div>

      <VentasBarra ocultos={parametros(["q"])} q={filtros.q} chips={chips} hrefCsv={hrefExportar()} hrefExcel={hrefExportar("xlsx")} accion={RUTA} />

      <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>
                {col("Fecha", ["periodo", "fecha", "desde", "hasta"], [
                  { tipo: "fecha", name: "desde", etiqueta: "Desde", valor: filtros.periodo || filtros.fecha ? "" : filtros.desde },
                  { tipo: "fecha", name: "hasta", etiqueta: "Hasta", valor: filtros.periodo || filtros.fecha ? "" : filtros.hasta },
                ], Boolean(filtros.periodo || filtros.fecha || filtros.desde || filtros.hasta), presets)}
              </th>
              <th>{col("Cliente", ["tipo"], [{ tipo: "select", name: "tipo", valor: filtros.tipo, opciones: lista(opciones.tiposCliente) }], Boolean(filtros.tipo))}</th>
              <th>{col("Distrito", ["distrito"], [{ tipo: "texto", name: "distrito", valor: filtros.distrito, placeholder: "Escribe un distrito" }], Boolean(filtros.distrito))}</th>
              <th>{col("Entrega", ["destino"], [{ tipo: "select", name: "destino", valor: filtros.destino, opciones: lista(opciones.destinos, titulo) }], Boolean(filtros.destino))}</th>
              <th>{col("Categoría", ["categoria"], [{ tipo: "select", name: "categoria", valor: filtros.categoria, opciones: lista(opciones.categorias) }], Boolean(filtros.categoria))}</th>
              <th>
                {col("Monto", ["montoMin", "montoMax"], [
                  { tipo: "numero", name: "montoMin", etiqueta: "Desde (S/)", valor: filtros.montoMin },
                  { tipo: "numero", name: "montoMax", etiqueta: "Hasta (S/)", valor: filtros.montoMax },
                ], filtros.montoMin !== undefined || filtros.montoMax !== undefined)}
              </th>
              <th>{col("Adelanto", ["adelanto"], [{ tipo: "select", name: "adelanto", valor: filtros.adelanto, opciones: [{ valor: "con", texto: "Con adelanto" }, { valor: "sin", texto: "Sin adelanto" }] }], Boolean(filtros.adelanto))}</th>
              <th>Saldo</th>
              <th>Notas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((v) => (
              <tr key={v.id}>
                <td>
                  {fechaCorta(v.fecha)}
                  <span className={v.dias > 30 ? "pill agotado celda-sub-pill" : "pill celda-sub-pill"}>{v.dias} d</span>
                </td>
                <td title={v.cliente_ref || undefined}>
                  <strong>{v.cliente_nombre || v.telefono}</strong>
                  <small className="celda-sub">{[v.cliente_nombre ? v.telefono : null, v.tipo_cliente].filter(Boolean).join(" · ")}</small>
                </td>
                <td>{v.distrito || "—"}</td>
                <td>
                  <span className={v.destino === "PROVINCIA" ? "pill" : "pill cerrada"}>{nombreDestino(v.destino)}</span>
                  {v.courier && <small className="celda-sub">{v.courier}</small>}
                </td>
                <td>{v.categoria}</td>
                <td>{soles(v.monto)}</td>
                <td>{Number(v.adelanto) > 0 ? soles(v.adelanto) : "—"}</td>
                <td>
                  <strong>{soles(v.saldo)}</strong>
                </td>
                <td style={{ maxWidth: 240, overflowWrap: "anywhere" }}>{v.notas || ""}</td>
                <td>
                  <div className="acciones-fila">
                    <Link href={hrefEditar(v.id)} className="btn-ico" title="Editar venta" aria-label="Editar venta">
                      <IconoEditar />
                    </Link>
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
                <td colSpan={10} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
                  {chips.length ? "No hay pendientes que coincidan." : "No hay ventas pendientes."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
