"use client";

import { useActionState } from "react";
import {
  marcarIngresoAccion,
  marcarSalidaAccion,
  extrasAccion,
  reabrirAsistenciaAccion,
  eliminarAsistenciaAccion,
} from "../../app/(admin)/admin/actions";
import { IconoCheck, IconoPapelera, IconoCerrar } from "./Iconos";
import { calcularAsistencia, salidaPrevista, formatoDuracion } from "../../lib/asistencias-core";

const soles = (n) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const estiloHora = {
  height: 34,
  padding: "0 8px",
  border: "1px solid var(--linea)",
  borderRadius: 8,
  fontFamily: "var(--sans)",
  fontSize: "0.85rem",
};

/** Hora + botón (marcar ingreso o salida). */
function MarcaHora({ accion, hora, etiqueta }) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  return (
    <form action={enviar} key={estado?.n || "x"} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input type="time" name="hora" defaultValue={hora} required style={estiloHora} aria-label={etiqueta} />
      <button type="submit" className="btn-ico-texto primario" disabled={enviando}>
        <IconoCheck /> {enviando ? "..." : etiqueta}
      </button>
      {estado?.error && <span style={{ color: "#c0392b", fontSize: 13, flexBasis: "100%" }}>{estado.error}</span>}
    </form>
  );
}

/**
 * Fila de un colaborador en la fecha elegida: marcar ingreso, ver la
 * salida prevista, marcar salida, pago y aprobación de horas extra.
 */
export default function FilaAsistencia({ f, fecha, esHoy, ahora }) {
  const registrada = f.asistencia_id !== null;
  const horario = `${f.cfg_entrada} – ${f.cfg_salida}${f.cfg_refrigerio ? ` · ${f.cfg_refrigerio} min refr.` : ""}`;

  if (!registrada) {
    return (
      <tr>
        <td className="celda-producto">
          {f.nombre}
          {f.cargo && <div style={{ color: "var(--gris)", fontSize: 12, fontWeight: 400 }}>{f.cargo}</div>}
        </td>
        <td>{horario}</td>
        <td colSpan={5}>
          <MarcaHora
            accion={marcarIngresoAccion.bind(null, f.colaborador_id, fecha)}
            hora={esHoy ? ahora : f.cfg_entrada}
            etiqueta="Marcar ingreso"
          />
        </td>
        <td>
          <span className="pill cerrada">Sin registro</span>
        </td>
      </tr>
    );
  }

  const calc = calcularAsistencia(f);
  const prevista = salidaPrevista(f.hora_ingreso, f.minutos_jornada, f.refrigerio_min);

  return (
    <tr>
      <td className="celda-producto">
        {f.nombre}
        {f.cargo && <div style={{ color: "var(--gris)", fontSize: 12, fontWeight: 400 }}>{f.cargo}</div>}
        {!f.activo && <span className="pill agotado">Baja</span>}
      </td>
      <td>{horario}</td>
      <td>{f.hora_ingreso}</td>
      <td>{prevista}</td>
      {calc.abierta ? (
        <td colSpan={3}>
          <MarcaHora
            accion={marcarSalidaAccion.bind(null, f.asistencia_id)}
            hora={esHoy ? (ahora > f.hora_ingreso ? ahora : prevista) : prevista}
            etiqueta="Marcar salida"
          />
        </td>
      ) : (
        <>
          <td>{f.hora_salida}</td>
          <td>{formatoDuracion(calc.trabajado)}</td>
          <td>
            {calc.extra > 0 ? (
              <div style={{ display: "grid", gap: 4 }}>
                <span>+{formatoDuracion(calc.extra)}</span>
                <form action={extrasAccion.bind(null, f.asistencia_id, !calc.aprobadas)}>
                  <button
                    type="submit"
                    className={calc.aprobadas ? "btn-ico-texto primario" : "btn-ico-texto"}
                    title={calc.aprobadas ? "Quitar aprobación" : "Aprobar horas extra"}
                  >
                    {calc.aprobadas ? <IconoCheck /> : <IconoCerrar />}{" "}
                    {calc.aprobadas ? "Extras aprobadas" : "Aprobar extras"}
                  </button>
                </form>
              </div>
            ) : (
              <span style={{ color: "var(--gris)" }}>—</span>
            )}
          </td>
        </>
      )}
      <td>
        <strong>{soles(calc.pago)}</strong>
        {calc.abierta && <div style={{ color: "var(--gris)", fontSize: 12 }}>estimado (jornada)</div>}
        {!calc.aprobadas && calc.pagoExtraPendiente > 0 && (
          <div style={{ color: "var(--gris)", fontSize: 12 }}>+{soles(calc.pagoExtraPendiente)} si se aprueban</div>
        )}
      </td>
      <td>
        <div className="acciones-fila">
          {!calc.abierta && (
            <form action={reabrirAsistenciaAccion.bind(null, f.asistencia_id)}>
              <button className="btn-ico-texto" type="submit" title="Quitar la hora de salida">
                Reabrir
              </button>
            </form>
          )}
          <form
            action={eliminarAsistenciaAccion.bind(null, f.asistencia_id)}
            onSubmit={(e) => {
              if (!confirm(`¿Eliminar el registro de ${f.nombre} de este día?`)) e.preventDefault();
            }}
          >
            <button className="btn-ico" title="Eliminar registro" aria-label={`Eliminar registro de ${f.nombre}`}>
              <IconoPapelera />
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
