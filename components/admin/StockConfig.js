"use client";

import { useActionState } from "react";
import { guardarNivelesStock, restablecerNivelesStock } from "../../app/(admin)/admin/actions";
import { NIVELES } from "../../lib/stock-niveles";

const FILAS_UMBRAL = ["muy_bajo", "bajo", "normal", "alto"];

/**
 * Niveles de stock del catálogo: hasta cuántas unidades es «Muy bajo», «Bajo», «Normal» y «Alto» (lo que supere el último es
 * «Muy alto»), y cuáles de ellos avisan en la campana de la tabla de productos. Los mismos niveles se usan en el filtro de Stock.
 */
export default function StockConfig({ config }) {
  const [estado, accion, enviando] = useActionState(guardarNivelesStock, {});
  const u = config.umbrales;

  return (
    <form action={accion} className="form-grid cg admin-card" key={estado?.n || 0}>
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}

      <div className="pf-panel-bloque">
        <strong>Niveles de stock</strong>
        <small style={{ color: "var(--gris)" }}>
          Se aplican a todo el catálogo y se miden en unidades de <strong>stock actual</strong>. Sirven para el filtro de la columna Stock, las
          etiquetas de color de la tabla de productos y la campana de alertas. «Sin control» son las variantes que no llevan cantidad
          (solo se sabe si hay o no hay), por eso no tienen límites.
        </small>

        <div className="admin-tabla-wrap">
          <table className="admin-tabla cg-tabla-stock">
            <thead>
              <tr>
                <th>Nivel</th>
                <th style={{ width: 150 }}>Hasta (unidades)</th>
                <th>Rango actual</th>
                <th style={{ width: 170, textAlign: "center" }}>Avisar en la campana</th>
              </tr>
            </thead>
            <tbody>
              {NIVELES.map((n) => {
                const fijo = { agotado: "0", muy_alto: "sin tope", sin_control: "—" }[n.id];
                const rango = {
                  agotado: "0 unidades",
                  muy_bajo: `1 a ${u.muy_bajo}`,
                  bajo: `${u.muy_bajo + 1} a ${u.bajo}`,
                  normal: `${u.bajo + 1} a ${u.normal}`,
                  alto: `${u.normal + 1} a ${u.alto}`,
                  muy_alto: `más de ${u.alto}`,
                  sin_control: "variantes sin cantidad",
                }[n.id];
                return (
                  <tr key={n.id}>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 10, background: n.color }} />
                        {n.nombre}
                      </span>
                    </td>
                    <td>
                      {fijo ? (
                        <span style={{ color: "var(--gris)" }}>{fijo}</span>
                      ) : (
                        <input type="number" min="1" step="1" name={`umbral_${n.id}`} defaultValue={u[n.id]} aria-label={`${n.nombre}: hasta cuántas unidades`} required style={{ width: 100 }} />
                      )}
                    </td>
                    <td style={{ color: "var(--gris)" }}>{rango}</td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" name={`alerta_${n.id}`} defaultChecked={config.alertas.includes(n.id)} aria-label={`Avisar en la campana: ${n.nombre}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <small style={{ color: "var(--gris)" }}>
          Cada límite debe ser mayor que el anterior ({FILAS_UMBRAL.map((k) => NIVELES.find((n) => n.id === k).nombre).join(" < ")}). La columna «Rango actual» muestra lo que
          se guardó; se actualiza al pulsar «Guardar».
        </small>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="btn-admin solido" disabled={enviando}>
          {enviando ? "Guardando..." : "Guardar niveles de stock"}
        </button>
        <button
          type="submit"
          className="btn-admin peligro"
          formAction={restablecerNivelesStock}
          formNoValidate
          onClick={(e) => {
            if (!confirm("¿Volver a los niveles originales? Se perderán los cambios guardados.")) e.preventDefault();
          }}
        >
          Restablecer valores originales
        </button>
      </div>
    </form>
  );
}
