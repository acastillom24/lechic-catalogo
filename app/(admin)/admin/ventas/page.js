import Link from "next/link";
import { getVentas, contarPendientes, getVentaPorId } from "../../../../lib/ventas";
import { editarVentaAccion } from "../actions";
import VentaForm from "../../../../components/sales/VentaForm";
import { IconoEditar } from "../../../../components/admin/Iconos";
import { leerFiltrosVentas } from "../../../../lib/filtros-ventas";
import { getOpcionesVentas } from "../../../../lib/ventas-opciones";
import { ATAJOS, PERIODOS, hoyLima } from "../../../../lib/periodos";
import { fechaISO } from "../../../../lib/ventas-core";
import VentasBarra from "../../../../components/admin/VentasBarra";
import FiltroColumna from "../../../../components/admin/FiltroColumna";
import Paginacion from "../../../../components/admin/Paginacion";
import TabsVentas from "../../../../components/admin/TabsVentas";
import EliminarVentaBoton from "../../../../components/admin/EliminarVentaBoton";

export const metadata = { title: "Ventas · Panel Le Chic" };
export const dynamic = "force-dynamic";

const soles = (n) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaCorta = (f) => fechaISO(f).split("-").reverse().join("/");

export default async function VentasPage({ searchParams }) {
  const params = await searchParams;
  const opciones = await getOpcionesVentas();
  const filtros = leerFiltrosVentas(params, opciones);
  const paginaPedida = Math.max(1, parseInt(params?.pagina, 10) || 1);
  const [{ filas, total, monto, porPagina }, pendientes] = await Promise.all([
    getVentas(filtros, paginaPedida),
    contarPendientes(),
  ]);
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(paginaPedida, paginas);

  const editarId = Number(params?.editar) || null;
  const aEditar = editarId ? await getVentaPorId(editarId) : null;
  const ventaEdicion = aEditar && {
    ...aEditar,
    fecha: fechaISO(aEditar.fecha),
    monto: String(aEditar.monto),
    adelanto: String(aEditar.adelanto),
  };

  // Enlaces que conservan los filtros activos. El rango de fechas se pide por periodo, por día o por
  // desde/hasta (en ese orden de prioridad); aquí se deja solo el que corresponde.
  const qs = (extra = {}) => {
    const base = { ...filtros, ...extra };
    if (base.periodo) {
      delete base.desde; delete base.hasta; delete base.fecha;
    } else if (base.fecha) {
      delete base.desde; delete base.hasta;
    }
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, String(v));
    return u.toString();
  };
  const href = (extra = {}) => {
    const s = qs(extra);
    return s ? `/admin/ventas?${s}` : "/admin/ventas";
  };
  // Edición en línea: ?editar=<id> sobre la misma lista, conservando filtros y página.
  const volverHref = href(pagina > 1 ? { pagina } : {});
  const hrefEditar = (id) => {
    const u = new URLSearchParams(qs());
    if (pagina > 1) u.set("pagina", String(pagina));
    u.set("editar", String(id));
    return `/admin/ventas?${u.toString()}`;
  };
  const sinFechas = { periodo: "", fecha: "", desde: "", hasta: "" };
  const hrefExportar = (formato) => {
    const u = new URLSearchParams(qs());
    if (formato) u.set("formato", formato);
    return `/admin/ventas/exportar?${u.toString()}`;
  };
  const etiquetaDia = (f) => f.split("-").reverse().join("/");

  const presets = ATAJOS.map((clave) => ({
    clave,
    texto: PERIODOS[clave],
    href: href({ ...sinFechas, periodo: clave }),
    activo: filtros.periodo === clave,
  }));

  // Filtros activos como parámetros (respetando que periodo > día > desde/hasta), para los formularios de cada columna.
  const parametros = (excluir = []) => {
    const base = { ...filtros };
    if (base.periodo) { delete base.desde; delete base.hasta; delete base.fecha; }
    else if (base.fecha) { delete base.desde; delete base.hasta; }
    const o = {};
    for (const [k, v] of Object.entries(base)) if (v !== undefined && v !== "" && !excluir.includes(k)) o[k] = String(v);
    return o;
  };
  const limpiar = (claves) => href(Object.fromEntries(claves.map((k) => [k, ""])));
  const lista = (arr, texto = (x) => x) => arr.map((x) => ({ valor: x, texto: texto(x) }));
  // Encabezado de columna con su filtro tipo Excel.
  const col = (etiqueta, claves, campos, activo, atajos) => (
    <FiltroColumna etiqueta={etiqueta} activo={activo} campos={campos} atajos={atajos} ocultos={parametros(claves)} hrefLimpiar={limpiar(claves)} />
  );

  const chips = [
    filtros.periodo && { texto: PERIODOS[filtros.periodo], href: href(sinFechas) },
    filtros.fecha && { texto: `Día ${etiquetaDia(filtros.fecha)}`, href: href(sinFechas) },
    !filtros.periodo && !filtros.fecha && filtros.desde && { texto: `Desde ${etiquetaDia(filtros.desde)}`, href: href({ desde: "" }) },
    !filtros.periodo && !filtros.fecha && filtros.hasta && { texto: `Hasta ${etiquetaDia(filtros.hasta)}`, href: href({ hasta: "" }) },
    filtros.categoria && { texto: filtros.categoria, href: href({ categoria: "" }) },
    filtros.destino && { texto: `Entrega: ${filtros.destino}`, href: href({ destino: "" }) },
    filtros.tipo && { texto: filtros.tipo, href: href({ tipo: "" }) },
    (filtros.montoMin !== undefined || filtros.montoMax !== undefined) && {
      texto: `Monto ${filtros.montoMin !== undefined ? `desde S/ ${filtros.montoMin}` : ""}${filtros.montoMin !== undefined && filtros.montoMax !== undefined ? " " : ""}${filtros.montoMax !== undefined ? `hasta S/ ${filtros.montoMax}` : ""}`,
      href: href({ montoMin: "", montoMax: "" }),
    },
    filtros.adelanto && { texto: filtros.adelanto === "con" ? "Con adelanto" : "Sin adelanto", href: href({ adelanto: "" }) },
    filtros.distrito && { texto: `Distrito: ${filtros.distrito}`, href: href({ distrito: "" }) },
    filtros.q && { texto: `"${filtros.q}"`, href: href({ q: "" }) },
  ].filter(Boolean);

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
        <h1 className="admin-titulo">Ventas ({total.toLocaleString("es-PE")})</h1>
      </div>
      <TabsVentas activo="ventas" pendientes={pendientes} />

      <div className="kpi-grid kpi-ventas">
        <div className="admin-card kpi">
          <div className="kpi-etiqueta">Ventas</div>
          <div className="kpi-valor">{total.toLocaleString("es-PE")}</div>
        </div>
        <div className="admin-card kpi">
          <div className="kpi-etiqueta">Monto total</div>
          <div className="kpi-valor">{soles(monto)}</div>
          <div className="kpi-sub">Ticket promedio {soles(total ? monto / total : 0)}</div>
        </div>
      </div>

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

      <VentasBarra
        ocultos={parametros(["q"])}
        q={filtros.q}
        chips={chips}
        hrefCsv={hrefExportar()}
        hrefExcel={hrefExportar("xlsx")}
      />

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
              <th>{col("Categoría", ["categoria"], [{ tipo: "select", name: "categoria", valor: filtros.categoria, opciones: lista(opciones.categorias) }], Boolean(filtros.categoria))}</th>
              <th>{col("Entrega", ["destino"], [{ tipo: "select", name: "destino", valor: filtros.destino, opciones: lista(opciones.destinos) }], Boolean(filtros.destino))}</th>
              <th>
                {col("Monto", ["montoMin", "montoMax"], [
                  { tipo: "numero", name: "montoMin", etiqueta: "Desde (S/)", valor: filtros.montoMin },
                  { tipo: "numero", name: "montoMax", etiqueta: "Hasta (S/)", valor: filtros.montoMax },
                ], filtros.montoMin !== undefined || filtros.montoMax !== undefined)}
              </th>
              <th>{col("Adelanto", ["adelanto"], [{ tipo: "select", name: "adelanto", valor: filtros.adelanto, opciones: [{ valor: "con", texto: "Con adelanto" }, { valor: "sin", texto: "Sin adelanto" }] }], Boolean(filtros.adelanto))}</th>
              <th>{col("Estado", ["estado"], [{ tipo: "select", name: "estado", valor: filtros.estado, opciones: [{ valor: "pendiente", texto: "Pendiente" }, { valor: "cerrada", texto: "Cerrada" }] }], Boolean(filtros.estado))}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((v) => (
              <tr key={v.id}>
                <td title={v.registrado_por_nombre ? `Registró: ${v.registrado_por_nombre}` : v.origen === "csv" ? "Importada desde Excel" : undefined}>
                  {fechaCorta(v.fecha)}
                </td>
                <td title={v.cliente_ref || undefined}>
                  <strong>{v.cliente_nombre || v.telefono}</strong>
                  <small className="celda-sub">
                    {[v.cliente_nombre ? v.telefono : null, v.tipo_cliente].filter(Boolean).join(" · ")}
                  </small>
                </td>
                <td>{v.distrito || "—"}</td>
                <td>{v.categoria}</td>
                <td>{[v.destino, v.courier].filter(Boolean).join(" · ") || "—"}</td>
                <td>
                  <strong>{soles(v.monto)}</strong>
                </td>
                <td>{Number(v.adelanto) > 0 ? soles(v.adelanto) : "—"}</td>
                <td>
                  <span className={v.estado === "pendiente" ? "pill" : "pill cerrada"}>
                    {v.estado === "pendiente" ? "Pendiente" : "Cerrada"}
                  </span>
                </td>
                <td>
                  <div className="acciones-fila">
                    <Link href={hrefEditar(v.id)} className="btn-ico" title="Editar venta" aria-label="Editar venta">
                      <IconoEditar />
                    </Link>
                    {v.estado === "cerrada" && (
                      <EliminarVentaBoton id={v.id} resumen={`${fechaCorta(v.fecha)} · ${v.telefono} · ${soles(v.monto)}`} />
                    )}
                  </div>
                </td>
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
