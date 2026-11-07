import Link from "next/link";
import { reportePago, listarColaboradores } from "../../../../../lib/asistencias";
import { hoyLima, primerDiaMes, sumarDias, fechaValida } from "../../../../../lib/periodos";
import { formatoDuracion, TIPOS_PAGO } from "../../../../../lib/asistencias-core";
import TabsAsistencias from "../../../../../components/admin/TabsAsistencias";
import { IconoCalendario } from "../../../../../components/admin/Iconos";

export const metadata = { title: "Reporte de pago · Panel Le Chic" };
export const dynamic = "force-dynamic";

const soles = (n) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaCorta = (f) => f.split("-").reverse().join("/");

export default async function ReportePage({ searchParams }) {
  const params = await searchParams;
  const hoy = hoyLima();
  const val = (k) => (typeof params?.[k] === "string" ? params[k].trim() : "");

  let desde = fechaValida(val("desde")) ? val("desde") : primerDiaMes(hoy);
  let hasta = fechaValida(val("hasta")) ? val("hasta") : hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  const colId = /^\d+$/.test(val("colaborador")) ? Number(val("colaborador")) : null;

  const lunes = sumarDias(hoy, -((new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7));
  const mes = primerDiaMes(hoy);
  const tope = (f) => (f > hoy ? hoy : f);
  const atajos = [
    ["Esta semana", lunes, hoy],
    ["Últimos 7 días", sumarDias(hoy, -6), hoy],
    ["Quincena 1–15", mes, tope(sumarDias(mes, 14))],
    ["Quincena 16–fin", sumarDias(mes, 15), hoy],
    ["Este mes", mes, hoy],
    ["Mes anterior", primerDiaMes(hoy, -1), sumarDias(mes, -1)],
  ].filter(([, d]) => d <= hoy);
  const href = (d, h) =>
    `/admin/asistencias/reporte?desde=${d}&hasta=${h}${colId ? `&colaborador=${colId}` : ""}`;

  const [colaboradores, { resumen, detalle }] = await Promise.all([
    listarColaboradores(),
    reportePago(desde, hasta, colId),
  ]);
  const total = resumen.reduce((s, r) => s + r.pago, 0);
  const pendiente = resumen.reduce((s, r) => s + r.pagoExtraPendiente, 0);

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
        <h1 className="admin-titulo">Reporte de pago</h1>
        <span className="nota-periodo">
          {fechaCorta(desde)} a {fechaCorta(hasta)} · Total: <strong>{soles(total)}</strong>
        </span>
      </div>
      <TabsAsistencias activo="reporte" />

      <form method="get" action="/admin/asistencias/reporte" className="admin-barra">
        <div className="chips-periodo">
          {atajos.map(([t, d, h]) => (
            <Link key={t} href={href(d, h)} className={desde === d && hasta === h ? "chip-per activo" : "chip-per"}>
              {t}
            </Link>
          ))}
          <span className="admin-rango" title="Rango personalizado">
            <IconoCalendario size={16} />
            <input type="date" name="desde" defaultValue={desde} max={hoy} aria-label="Desde" />
            <span>a</span>
            <input type="date" name="hasta" defaultValue={hasta} max={hoy} aria-label="Hasta" />
          </span>
        </div>
        <div className="admin-barra-buscar" style={{ flex: "0 1 auto", minWidth: 0 }}>
          <label className="admin-filtro" title="Trabajador">
            <select name="colaborador" defaultValue={colId || ""} aria-label="Trabajador">
              <option value="">Trabajador: todos</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.activo ? "" : " (baja)"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-barra-der">
          <button type="submit" className="btn-ico-texto primario">Filtrar</button>
        </div>
      </form>

      <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Pago</th>
              <th>Días</th>
              <th>Horas normales</th>
              <th>Extras aprobadas</th>
              <th>Extras sin aprobar</th>
              <th>Normal</th>
              <th>Extras</th>
              <th>Total a pagar</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((r) => (
              <tr key={r.colaborador_id}>
                <td className="celda-producto">
                  {r.nombre}
                  {r.cargo && <div style={{ color: "var(--gris)", fontSize: 12, fontWeight: 400 }}>{r.cargo}</div>}
                </td>
                <td>{TIPOS_PAGO[r.tipo_pago]}</td>
                <td>
                  {r.dias}
                  {r.abiertas > 0 && <div style={{ color: "#c0392b", fontSize: 12 }}>{r.abiertas} sin salida</div>}
                </td>
                <td>{formatoDuracion(r.normales)}</td>
                <td>{formatoDuracion(r.extraAprobada)}</td>
                <td>
                  {formatoDuracion(r.extraPendiente)}
                  {r.pagoExtraPendiente > 0 && (
                    <div style={{ color: "var(--gris)", fontSize: 12 }}>({soles(r.pagoExtraPendiente)})</div>
                  )}
                </td>
                <td>{soles(r.pagoNormal)}</td>
                <td>{soles(r.pagoExtra)}</td>
                <td><strong>{soles(r.pago)}</strong></td>
              </tr>
            ))}
            {resumen.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
                  No hay asistencias en este periodo.
                </td>
              </tr>
            )}
          </tbody>
          {resumen.length > 1 && (
            <tfoot>
              <tr>
                <td colSpan={8} style={{ textAlign: "right" }}><strong>Total</strong></td>
                <td><strong>{soles(total)}</strong></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {pendiente > 0 && (
        <p style={{ color: "var(--gris)", fontSize: 13, margin: 0 }}>
          Hay {soles(pendiente)} en horas extra sin aprobar que no están incluidas en el total. Apruébalas en el
          registro diario si corresponde.
        </p>
      )}

      <details className="admin-card">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Detalle por día ({detalle.length})</summary>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="admin-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Trabajador</th>
                <th>Ingreso</th>
                <th>Salida</th>
                <th>Trabajado</th>
                <th>Extra</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {detalle.map((d) => (
                <tr key={d.id}>
                  <td>{fechaCorta(d.fecha)}</td>
                  <td>{d.nombre}</td>
                  <td>{d.hora_ingreso}</td>
                  <td>{d.hora_salida || <span style={{ color: "#c0392b" }}>sin salida</span>}</td>
                  <td>{formatoDuracion(d.calculo.trabajado)}</td>
                  <td>
                    {d.calculo.extra > 0 ? (
                      <>
                        +{formatoDuracion(d.calculo.extra)}{" "}
                        <span className={d.calculo.aprobadas ? "pill" : "pill cerrada"}>
                          {d.calculo.aprobadas ? "aprobadas" : "sin aprobar"}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{soles(d.calculo.pago)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
