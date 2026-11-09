"use client";

import SelectBuscador from "./SelectBuscador";
import { stockParaSaga } from "../../lib/saga-mapeo";
import { IconoPapelera } from "./Iconos";

/**
 * Editor de los productos que forman un pack.
 * `componentes` = [{ id, cantidad }]; `opciones` = variantes elegibles (ver getVariantesParaPack).
 * El stock del pack no se escribe: es el del componente más limitante (se muestra aquí como vista previa).
 */
export default function PackComponentes({ componentes, onChange, opciones, idPropio = null }) {
  const porId = new Map(opciones.map((o) => [o.id, o]));
  const usados = new Set(componentes.map((c) => Number(c.id)));
  // Stock real de la variante (solo lectura, viene del inventario): 0 también se muestra.
  const textoStock = (o) =>
    o.stockActual === null || o.stockActual === undefined ? (o.stock ? "sin control · hay stock" : "sin control · agotado") : `stock ${o.stockActual}`;
  const elegibles = opciones
    .filter((o) => !usados.has(o.id) && o.id !== idPropio)
    .map((o) => ({ valor: String(o.id), etiqueta: `${o.etiqueta} — ${textoStock(o)}` }));

  // Cuántos packs salen de cada componente (mismo cálculo que el servidor).
  const filas = componentes.map((c) => {
    const o = porId.get(Number(c.id));
    const disponible = o
      ? stockParaSaga({ activo: true, stock: o.stock, stock_actual: o.stockActual, stock_minimo: o.stockMinimo })
      : 0;
    const cantidad = Math.max(1, Number(c.cantidad) || 1);
    return { c, o, disponible, alcanza: Math.floor(disponible / cantidad) };
  });
  const stockPack = filas.length ? Math.min(...filas.map((f) => f.alcanza)) : 0;
  const limitante = filas.length ? filas.find((f) => f.alcanza === stockPack) : null;

  const cambiarCantidad = (id, cantidad) =>
    onChange(componentes.map((c) => (Number(c.id) === id ? { ...c, cantidad } : c)));
  const quitar = (id) => onChange(componentes.filter((c) => Number(c.id) !== id));
  const agregar = (valor) => {
    if (valor) onChange([...componentes, { id: Number(valor), cantidad: 1 }]);
  };

  return (
    <div className="campo">
      <label>Productos del pack</label>
      <SelectBuscador
        valor=""
        onChange={agregar}
        opciones={elegibles}
        placeholder="Buscar producto o SKU para añadir al pack…"
      />

      {filas.length === 0 && (
        <small style={{ color: "#b3261e" }}>Añade al menos un producto: el pack se arma con ellos.</small>
      )}

      {filas.map(({ c, o, disponible }) => (
        <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
          <span style={{ flex: 1 }}>
            {o ? o.etiqueta : `Variante #${c.id} (ya no está disponible)`}
            <small style={{ color: disponible === 0 ? "#b3261e" : "var(--gris)", display: "block" }}>
              {o ? `Stock actual: ${o.stockActual === null || o.stockActual === undefined ? (o.stock ? "sin control (hay)" : "sin control (agotado)") : o.stockActual}` : ""}
              {" · "}Alcanza para {Math.floor(disponible / Math.max(1, Number(c.cantidad) || 1))} pack(s)
              {o && o.stockActual > 0 && disponible === 0 ? " (no supera el stock mínimo)" : ""}
              {" · se actualiza desde Inventario"}
            </small>
          </span>
          <input
            type="number"
            min="1"
            step="1"
            value={c.cantidad}
            onChange={(e) => cambiarCantidad(Number(c.id), e.target.value)}
            aria-label="Cantidad en el pack"
            style={{ width: 70 }}
          />
          <button type="button" className="btn-admin peligro" onClick={() => quitar(Number(c.id))} aria-label="Quitar del pack">
            <IconoPapelera />
          </button>
        </div>
      ))}

      {filas.length > 0 && (
        <small style={{ color: stockPack === 0 ? "#b3261e" : "var(--gris)", display: "block", marginTop: 6 }}>
          Stock del pack (calculado): <strong>{stockPack}</strong>
          {stockPack === 0 && limitante?.o ? ` — lo limita «${limitante.o.etiqueta}»; mientras esté agotado el pack no se vende.` : ""}
        </small>
      )}
    </div>
  );
}
