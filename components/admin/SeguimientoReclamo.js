"use client";

import { useActionState } from "react";
import { guardarSeguimientoReclamo } from "../../app/(admin)/admin/actions";

/** Estado, respuesta al consumidor (se puede enviar por correo) y nota interna de un reclamo. */
export default function SeguimientoReclamo({ reclamo }) {
  const [estado, accion, enviando] = useActionState(guardarSeguimientoReclamo, {});

  return (
    <form action={accion} className="form-grid admin-card" key={estado?.n || 0}>
      <h2>Seguimiento</h2>
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}
      <input type="hidden" name="id" value={reclamo.id} />

      <div className="campo">
        <label htmlFor="rec-estado">Estado</label>
        <select id="rec-estado" name="estado" defaultValue={reclamo.estado}>
          <option value="pendiente">Pendiente</option>
          <option value="en_proceso">En proceso</option>
          <option value="atendido">Atendido (exige respuesta)</option>
        </select>
      </div>

      <div className="campo">
        <label htmlFor="rec-respuesta">Respuesta al consumidor</label>
        <textarea id="rec-respuesta" name="respuesta" rows={6} maxLength={4000} defaultValue={reclamo.respuesta || ""} />
        <small style={{ color: "var(--gris)" }}>
          {reclamo.respuesta_enviada
            ? "Esta respuesta ya se envió al correo del consumidor. Si la editas, vuelve a enviarla."
            : reclamo.respuesta
              ? "Respuesta guardada, todavía NO enviada al consumidor."
              : "Se envía al correo del consumidor al usar «Guardar y enviar respuesta»."}
        </small>
      </div>

      <div className="campo">
        <label htmlFor="rec-nota">Nota interna (no se envía al consumidor)</label>
        <textarea id="rec-nota" name="notaInterna" rows={3} maxLength={2000} defaultValue={reclamo.nota_interna || ""} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" name="accion" value="guardar" className="btn-admin" disabled={enviando}>
          {enviando ? "Guardando..." : "Guardar"}
        </button>
        <button type="submit" name="accion" value="enviar" className="btn-admin solido" disabled={enviando}>
          Guardar y enviar respuesta
        </button>
      </div>
    </form>
  );
}
