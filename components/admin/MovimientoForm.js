"use client";

import { useActionState } from "react";
import { registrarMovimiento } from "../../app/(admin)/admin/actions";

/** Formulario compacto por fila: entrada / salida / fijar (conteo). */
export default function MovimientoForm({ varianteId, accionMovimiento = registrarMovimiento }) {
  const [estado, accion, enviando] = useActionState(accionMovimiento, {});

  return (
    <form action={accion} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <input type="hidden" name="varianteId" value={varianteId} />
      <select name="operacion" defaultValue="entrada" aria-label="Operación">
        <option value="entrada">Entrada (+)</option>
        <option value="salida">Salida (−)</option>
        <option value="fijar">Fijar stock en…</option>
      </select>
      <input
        name="cantidad"
        type="number"
        min="0"
        step="1"
        required
        placeholder="Cant."
        aria-label="Cantidad"
        style={{ width: 80 }}
      />
      <input name="motivo" type="text" maxLength={200} placeholder="Motivo (opcional)" style={{ width: 150 }} />
      <button type="submit" className="btn-admin" disabled={enviando}>
        {enviando ? "..." : "Aplicar"}
      </button>
      {estado?.error && <span style={{ color: "#b3261e", fontSize: 12 }}>{estado.error}</span>}
      {estado?.ok && <span style={{ color: "#1b6e3c", fontSize: 12 }}>{estado.ok}</span>}
    </form>
  );
}
