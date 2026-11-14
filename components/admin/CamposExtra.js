"use client";

import SelectMulti from "./SelectMulti";
import SelectUnico from "./SelectUnico";

/**
 * Campos extra de la categoría SAGA elegida (ver lib/saga-campos.js). `campos` ya viene filtrado por nivel;
 * `valores` = { FeedName: valor } (multi = lista). Cada cambio llama a onChange con los valores nuevos.
 */
export default function CamposExtra({ campos, valores, onChange, prefijo = "extra" }) {
  const poner = (id, valor) => onChange({ ...valores, [id]: valor });

  return (
    <div className="form-grid">
      {campos.map((c) => {
        const valor = valores?.[c.id];
        const idCampo = `${prefijo}-${c.id}`;
        const opciones = [...new Set(c.opciones || [])];
        const etiqueta = (
          <>
            {c.etiqueta} {c.obligatorio && <em>obligatorio</em>}
          </>
        );

        if (c.tipo === "multi") {
          const marcados = Array.isArray(valor) ? valor : valor ? [valor] : [];
          return (
            <div className="campo" key={c.id}>
              <label>{etiqueta}</label>
              <SelectMulti valor={marcados} opciones={opciones} onChange={(v) => poner(c.id, v)} placeholder="Elegir…" />
            </div>
          );
        }

        if (c.tipo === "lista") {
          const fuera = valor && !opciones.includes(valor);
          return (
            <div className="campo" key={c.id}>
              <label htmlFor={idCampo}>{etiqueta}</label>
              <SelectUnico
                id={idCampo}
                valor={valor || ""}
                opciones={fuera ? [valor, ...opciones] : opciones}
                onChange={(v) => poner(c.id, v)}
                vacio="Sin selección"
                placeholder="Elegir…"
              />
            </div>
          );
        }

        return (
          <div className="campo" key={c.id}>
            <label htmlFor={idCampo}>{etiqueta}</label>
            <input
              id={idCampo}
              type={c.tipo === "numero" ? "number" : "text"}
              step={c.tipo === "numero" ? "any" : undefined}
              maxLength={c.max || undefined}
              minLength={c.min || undefined}
              value={valor ?? ""}
              onChange={(e) => poner(c.id, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
