import Link from "next/link";
import { asistenciasDelDia } from "../../../../lib/asistencias";
import { hoyLima, resolverFecha, sumarDias } from "../../../../lib/periodos";
import FilaAsistencia from "../../../../components/admin/FilaAsistencia";
import TabsAsistencias from "../../../../components/admin/TabsAsistencias";
import { IconoCalendario } from "../../../../components/admin/Iconos";

export const metadata = { title: "Asistencias · Panel Le Chic" };
export const dynamic = "force-dynamic";

export default async function AsistenciasPage({ searchParams }) {
  const params = await searchParams;
  const hoy = hoyLima();
  let fecha = resolverFecha(typeof params?.fecha === "string" ? params.fecha : "");
  if (fecha > hoy) fecha = hoy;
  const esHoy = fecha === hoy;
  const ahora = new Date().toLocaleTimeString("en-GB", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
  });

  const filas = await asistenciasDelDia(fecha);
  const fechaLarga = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-PE", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
        <h1 className="solo-lector">Asistencias</h1>
        <span className="nota-periodo" style={{ textTransform: "capitalize" }}>{fechaLarga}</span>
      </div>
      <TabsAsistencias activo="registro" />

      <form method="get" action="/admin/asistencias" className="admin-barra">
        <div className="chips-periodo">
          <Link href={`/admin/asistencias?fecha=${sumarDias(fecha, -1)}`} className="chip-per">← Anterior</Link>
          <Link href="/admin/asistencias" className={esHoy ? "chip-per activo" : "chip-per"}>Hoy</Link>
          {!esHoy && (
            <Link href={`/admin/asistencias?fecha=${sumarDias(fecha, 1)}`} className="chip-per">Siguiente →</Link>
          )}
          <span className="admin-rango" title="Elegir fecha">
            <IconoCalendario size={16} />
            <input type="date" name="fecha" defaultValue={fecha} max={hoy} aria-label="Fecha" />
            <button type="submit" className="chip-per">Ir</button>
          </span>
        </div>
      </form>

      <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Horario</th>
              <th>Ingreso</th>
              <th>Salida prevista</th>
              <th>Salida real</th>
              <th>Trabajado</th>
              <th>Horas extra</th>
              <th>Pago</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <FilaAsistencia key={f.colaborador_id} f={f} fecha={fecha} esHoy={esHoy} ahora={ahora} />
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
                  No hay colaboradores activos. Agrégalos en{" "}
                  <Link href="/admin/configuracion" style={{ textDecoration: "underline" }}>Configuración</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ color: "var(--gris)", fontSize: 13, margin: 0 }}>
        Salida prevista = ingreso + jornada (hora de salida − entrada) + refrigerio. Las horas extra solo se pagan
        si las apruebas.
      </p>
    </div>
  );
}
