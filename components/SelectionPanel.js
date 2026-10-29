"use client";

import { useState } from "react";
import { useSeleccion } from "../lib/SelectionContext";
import { useConfig } from "../lib/ConfigContext";
import CantidadControl from "./CantidadControl";

export default function SelectionPanel() {
  const {
    items,
    abierto,
    totalItems,
    totalPrecio,
    quitar,
    cambiarCantidad,
    vaciar,
    cerrar,
  } = useSeleccion();

  const config = useConfig();

  const [entregaId, setEntregaId] = useState("recojo");
  const entrega =
    config.entregas.find((e) => e.id === entregaId) || config.entregas[0];
  const embalaje = entrega.embalaje;
  const totalAprox = totalPrecio + embalaje;

  // Arma el mensaje de WhatsApp con todo el detalle.
  function construirMensaje() {
    const lineas = items.map(
      (i) =>
        `• ${i.marca ? `[${i.marca}] ` : ""}${i.nombre}${i.variante ? ` (${i.variante})` : ""} x${i.cantidad} — ${
          config.moneda
        } ${i.precio * i.cantidad}`
    );
    const resumen =
      embalaje > 0
        ? `Entrega: ${entrega.nombre}\n` +
          `Subtotal: ${config.moneda} ${totalPrecio}\n` +
          `Embalaje (${entrega.nombre}): ${config.moneda} ${embalaje}\n` +
          `Total aprox.: ${config.moneda} ${totalAprox}\n\n` +
          `Nota: el costo por embalaje para envíos por agencia es ${config.moneda} ${embalaje}.`
        : `Entrega: ${entrega.nombre}\nTotal aprox.: ${config.moneda} ${totalAprox}`;
    const cuerpo =
      `Hola ${config.marca}, quiero consultar por:\n\n` +
      lineas.join("\n") +
      `\n\n${resumen}`;
    return encodeURIComponent(cuerpo);
  }

  const waUrl = `https://wa.me/${config.whatsapp}?text=${construirMensaje()}`;

  return (
    <>
      {/* Fondo oscuro que cierra al hacer click */}
      <div
        className={`sel-overlay ${abierto ? "visible" : ""}`}
        onClick={cerrar}
        aria-hidden="true"
      />

      <aside
        className={`sel-panel ${abierto ? "abierto" : ""}`}
        role="dialog"
        aria-label="Mi selección"
        aria-modal="true"
      >
        <header className="sel-head">
          <div>
            <h2 className="sel-titulo serif">Mi selección</h2>
            <p className="sel-sub">
              {totalItems === 0
                ? "Aún no has agregado productos"
                : `${totalItems} ${totalItems === 1 ? "producto" : "productos"}`}
            </p>
          </div>
          <button className="sel-cerrar" onClick={cerrar} aria-label="Cerrar">
            ×
          </button>
        </header>

        {/* Lista */}
        <div className="sel-lista">
          {items.length === 0 ? (
            <div className="sel-vacio">
              <p>Tu selección está vacía.</p>
              <p className="sel-vacio-nota">
                Entra a un producto y toca “Agregar a mi selección” para
                armar tu consulta.
              </p>
            </div>
          ) : (
            items.map((i) => (
              <div key={i.key} className="sel-item">
                <div className="sel-item-img">
                  <img
                    src={i.imagen}
                    alt={i.nombre}
                    onError={(e) => {
                      e.currentTarget.style.visibility = "hidden";
                    }}
                  />
                </div>
                <div className="sel-item-info">
                  <p className="sel-item-nombre">{i.nombre}</p>
                  {i.variante && (
                    <p className="sel-item-variante">{i.variante}</p>
                  )}
                  <p className="sel-item-precio">
                    {config.moneda} {i.precio}
                  </p>
                </div>
                <div className="sel-item-acciones">
                  <CantidadControl
                    compacto
                    eliminarEn1
                    cantidad={i.cantidad}
                    onMenos={() => cambiarCantidad(i.key, i.cantidad - 1)}
                    onMas={() => cambiarCantidad(i.key, i.cantidad + 1)}
                  />
                  <button
                    className="sel-quitar"
                    onClick={() => quitar(i.key)}
                    aria-label="Eliminar"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pie con total y consulta */}
        {items.length > 0 && (
          <footer className="sel-pie">
            <div className="sel-destino" role="radiogroup" aria-label="Entrega">
              <span className="sel-destino-label">
                ¿Cómo recibirás tu pedido?
              </span>
              <div className="sel-destino-opciones">
                {config.entregas.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={entregaId === e.id}
                    className={`sel-destino-op ${
                      entregaId === e.id ? "activo" : ""
                    }`}
                    onClick={() => setEntregaId(e.id)}
                  >
                    {e.nombre}
                  </button>
                ))}
              </div>
            </div>
            {embalaje > 0 && (
              <>
                <div className="sel-fila">
                  <span>Subtotal</span>
                  <span>
                    {config.moneda} {totalPrecio}
                  </span>
                </div>
                <div className="sel-fila">
                  <span>Embalaje ({entrega.nombre})</span>
                  <span>
                    {config.moneda} {embalaje}
                  </span>
                </div>
              </>
            )}
            <div className="sel-total">
              <span>Total aproximado</span>
              <strong className="serif">
                {config.moneda} {totalAprox}
              </strong>
            </div>
            <p className="sel-total-nota">
              Referencial. El monto final se confirma por mensaje.
              {entrega.nota ? ` ${entrega.nota}` : ""}
            </p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-solido sel-cta"
            >
              Consultar todo por WhatsApp
            </a>
            <button className="sel-vaciar" onClick={vaciar}>
              Vaciar selección
            </button>
          </footer>
        )}
      </aside>

      <style jsx>{`
        .sel-overlay {
          position: fixed;
          inset: 0;
          background: rgba(122, 45, 87, 0.4);
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.3s;
          z-index: 60;
        }
        .sel-overlay.visible {
          opacity: 1;
          visibility: visible;
        }
        .sel-panel {
          position: fixed;
          top: 0;
          right: 0;
          height: 100%;
          width: min(420px, 92vw);
          background: var(--papel);
          box-shadow: -10px 0 40px rgba(122, 45, 87, 0.16);
          transform: translateX(100%);
          transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
          z-index: 61;
          display: flex;
          flex-direction: column;
        }
        .sel-panel.abierto {
          transform: translateX(0);
        }
        .sel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 22px 22px 16px;
          border-bottom: 1px solid var(--linea);
        }
        .sel-titulo {
          font-weight: 600;
          font-size: 1.5rem;
        }
        .sel-sub {
          font-size: 0.78rem;
          color: var(--gris);
          margin-top: 2px;
        }
        .sel-cerrar {
          background: none;
          border: none;
          font-size: 2rem;
          line-height: 1;
          color: var(--gris);
          cursor: pointer;
          padding: 0 4px;
        }
        .sel-cerrar:hover {
          color: var(--tinta);
        }
        .sel-lista {
          flex: 1;
          overflow-y: auto;
          padding: 8px 22px;
        }
        .sel-vacio {
          text-align: center;
          padding: 60px 10px;
          color: var(--gris);
        }
        .sel-vacio-nota {
          font-size: 0.82rem;
          margin-top: 8px;
        }
        .sel-item {
          display: grid;
          grid-template-columns: 56px 1fr auto;
          gap: 12px;
          padding: 16px 0;
          border-bottom: 1px solid var(--linea);
        }
        .sel-item-img {
          width: 56px;
          height: 72px;
          border-radius: 4px;
          background: linear-gradient(
            170deg,
            var(--rosa-tenue),
            var(--papel-hondo)
          );
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sel-item-img :global(img) {
          height: 100%;
          object-fit: contain;
        }
        .sel-item-nombre {
          font-family: var(--serif);
          font-weight: 600;
          font-size: 1.05rem;
          line-height: 1.1;
        }
        .sel-item-variante {
          font-size: 0.72rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--rosa);
          margin-top: 2px;
        }
        .sel-item-precio {
          font-size: 0.85rem;
          color: var(--gris);
          margin-top: 6px;
        }
        .sel-item-acciones {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: space-between;
        }
        .sel-quitar {
          background: none;
          border: none;
          font-size: 0.72rem;
          color: var(--gris);
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
          padding: 0;
        }
        .sel-quitar:hover {
          color: var(--rosa);
        }
        .sel-pie {
          border-top: 1px solid var(--linea);
          padding: 18px 22px 22px;
          background: var(--papel-hondo);
        }
        .sel-destino {
          margin-bottom: 14px;
        }
        .sel-destino-label {
          font-size: 0.78rem;
          color: var(--gris);
        }
        .sel-destino-opciones {
          display: flex;
          gap: 8px;
          margin-top: 6px;
        }
        .sel-destino-op {
          flex: 1;
          padding: 8px 6px;
          border-radius: 999px;
          border: 1px solid var(--linea);
          background: var(--papel);
          font-size: 0.82rem;
          color: var(--tinta);
          cursor: pointer;
        }
        .sel-destino-op.activo {
          border-color: var(--rosa);
          background: var(--rosa);
          color: #fff;
        }
        .sel-fila {
          display: flex;
          justify-content: space-between;
          font-size: 0.82rem;
          color: var(--gris);
          margin-bottom: 4px;
        }
        .sel-total {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
        }
        .sel-total span {
          font-size: 0.82rem;
          color: var(--gris);
        }
        .sel-total strong {
          font-weight: 600;
          font-size: 1.8rem;
        }
        .sel-total-nota {
          font-size: 0.7rem;
          color: var(--gris);
          margin: 4px 0 14px;
        }
        .sel-cta {
          width: 100%;
          justify-content: center;
        }
        .sel-vaciar {
          width: 100%;
          margin-top: 10px;
          background: none;
          border: none;
          font-size: 0.76rem;
          color: var(--gris);
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .sel-vaciar:hover {
          color: var(--rosa);
        }
      `}</style>
    </>
  );
}
