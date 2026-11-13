"use client";

import SelectMulti from "./SelectMulti";

/**
 * Campos extra de la categoría SAGA elegida (ver lib/saga-campos.js). `campos` ya viene filtrado por nivel;
 * `valores` = { FeedName: valor } (multi = lista). Cada cambio llama a onChange con los valores nuevos.
 */
export default function CamposExtra({ campos, valores, onChange, prefijo = "extra", heredados }) {
  // `heredados` (valores generales del producto): al editar una variante, un campo vacío usa el general.
  const hereda = heredados !== undefined;
  const textoH = (id) => { const h = heredados?.[id]; return Array.isArray(h) ? h.join(", ") : h ? String(h) : ""; };
  const vacioV = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
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
            {hereda && !vacioV(valor) && <em> personalizado</em>}
          </>
        );

        if (c.tipo === "multi") {
          const marcados = Array.isArray(valor) ? valor : valor ? [valor] : [];
          return (
            <div className="campo" key={c.id}>
              <label>{etiqueta}</label>
              <SelectMulti valor={marcados} opciones={opciones} onChange={(v) => poner(c.id, v)} placeholder="Elegir…" />
              {hereda && marcados.length === 0 && textoH(c.id) && <small>General: {textoH(c.id)}</small>}
            </div>
          );
        }

        if (c.tipo === "lista") {
          const fuera = valor && !opciones.includes(valor);
          return (
            <div className="campo" key={c.id}>
              <label htmlFor={idCampo}>{etiqueta}</label>
              <select id={idCampo} value={valor || ""} onChange={(e) => poner(c.id, e.target.value)}>
                <option value="">{hereda && textoH(c.id) ? `— Igual que el general (${textoH(c.id)}) —` : "— Elegir —"}</option>
                {fuera && <option value={valor}>{valor} (ya no está en la lista)</option>}
                {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
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
              placeholder={hereda && textoH(c.id) ? `General: ${textoH(c.id)}` : undefined}
              value={valor ?? ""}
              onChange={(e) => poner(c.id, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
