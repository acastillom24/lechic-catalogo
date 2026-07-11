"use client";

import { useState } from "react";
import Link from "next/link";
import { getConfig } from "../lib/data";
import { useSeleccion, construirKey } from "../lib/SelectionContext";

export default function ProductDetail({ producto, marca, categoria }) {
  const config = getConfig();
  const { agregar } = useSeleccion();
  const [idx, setIdx] = useState(0);
  const [agregado, setAgregado] = useState(false);
  const variante = producto.variantes[idx];
  const sinStock = variante.stock === false;
  const varias = producto.variantes.length > 1;

  const aromas = variante.aromas || producto.aromas || [];
  const precioFinal = variante.precioOferta ?? variante.precio;
  const hayOferta = variante.precioOferta != null;

  // Agrega la variante seleccionada a "Mi selección".
  function agregarSeleccion() {
    agregar({
      key: construirKey(producto.id, variante.nombre),
      productoId: producto.id,
      nombre: producto.nombre,
      variante: varias ? variante.nombre : "",
      precio: precioFinal,
      imagen: variante.imagen,
    });
    // Feedback breve en el botón.
    setAgregado(true);
    setTimeout(() => setAgregado(false), 1600);
  }

  return (
    <div className="contenedor detalle" style={{ "--acento": marca?.color }}>
      <div className="miga">
        <Link href="/">Inicio</Link>
        <span>/</span>
        <Link href={`/marca/${marca?.slug}`}>{marca?.nombre}</Link>
        {categoria && (
          <>
            <span>/</span>
            <span>{categoria.nombre}</span>
          </>
        )}
      </div>

      <div className="detalle-grid">
        {/* Imagen */}
        <div className={`detalle-img ${sinStock ? "esta-agotado" : ""}`}>
          {hayOferta && <span className="detalle-oferta">Oferta</span>}
          {sinStock && (
            <div className="cinta-agotado">
              <span>Agotado</span>
            </div>
          )}
          <img
            src={variante.imagen}
            alt={`${producto.nombre} ${varias ? variante.nombre : ""}`}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling.style.display = "flex";
            }}
          />
          <div className="detalle-img-fallback" style={{ display: "none" }}>
            <span>{producto.nombre}</span>
          </div>
        </div>

        {/* Info */}
        <div className="detalle-info">
          {categoria && <p className="detalle-cat">{categoria.nombre}</p>}
          <h1 className="detalle-nombre serif">{producto.nombre}</h1>
          <p className="detalle-desc">{producto.descripcion}</p>

          {/* Selector de variantes */}
          {varias && (
            <div className="variantes">
              <p className="variantes-label">Presentación</p>
              <div className="variantes-opts">
                {producto.variantes.map((v, i) => (
                  <button
                    key={i}
                    className={`variante-btn ${i === idx ? "activo" : ""}`}
                    onClick={() => setIdx(i)}
                  >
                    {v.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Aromas */}
          {aromas.length > 0 && (
            <div className="aromas">
              <p className="aromas-label">Notas</p>
              <div className="aromas-tags">
                {aromas.map((a, i) => (
                  <span key={i} className="aroma-tag">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Precio */}
          <div className="precio-bloque">
            {hayOferta && (
              <span className="precio-antes">
                {config.moneda} {variante.precio}
              </span>
            )}
            <span className="precio-final serif">
              {config.moneda} {precioFinal}
            </span>
          </div>

          {/* Agregar a mi selección */}
          {sinStock ? (
            <span
              className="btn detalle-cta"
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            >
              Agotado por ahora
            </span>
          ) : (
            <button
              className="btn btn-solido detalle-cta"
              onClick={agregarSeleccion}
            >
              {agregado ? "✓ Agregado a tu selección" : "Agregar a mi selección"}
            </button>
          )}
          <p className="detalle-nota">
            Arma tu lista y consúltala completa por WhatsApp. Revisa{" "}
            <Link href="/info">cómo comprar</Link>.
          </p>
        </div>
      </div>

      <style jsx>{`
        .detalle {
          padding: 26px 20px 40px;
        }
        .miga {
          display: flex;
          gap: 8px;
          font-size: 0.76rem;
          color: var(--gris);
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .miga :global(a:hover) {
          color: var(--acento);
        }
        .detalle-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          align-items: start;
        }
        .detalle-img {
          position: relative;
          aspect-ratio: 3 / 4;
          background: linear-gradient(
            170deg,
            var(--rosa-tenue),
            var(--papel-hondo)
          );
          border-radius: var(--radio);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px;
        }
        .detalle-img :global(img) {
          height: 100%;
          object-fit: contain;
        }
        .detalle-img.esta-agotado :global(img) {
          opacity: 0.55;
          filter: grayscale(0.55);
        }
        .cinta-agotado {
          position: absolute;
          top: 0;
          right: 0;
          width: 120px;
          height: 120px;
          overflow: hidden;
          z-index: 3;
          pointer-events: none;
        }
        .cinta-agotado span {
          position: absolute;
          top: 24px;
          right: -40px;
          transform: rotate(45deg);
          background: var(--tinta);
          color: #fff;
          font-size: 0.7rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 500;
          text-align: center;
          padding: 6px 48px;
        }
        .detalle-img-fallback {
          align-items: center;
          justify-content: center;
        }
        .detalle-img-fallback span {
          font-family: var(--serif);
          font-size: 1.6rem;
          color: var(--gris);
        }
        .detalle-oferta {
          position: absolute;
          top: 16px;
          right: 16px;
          background: var(--oferta);
          color: #fff;
          font-size: 0.66rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 5px 14px;
          border-radius: 999px;
        }
        .detalle-cat {
          font-size: 0.68rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--acento);
        }
        .detalle-nombre {
          font-weight: 600;
          font-size: clamp(2rem, 6vw, 3rem);
          line-height: 1;
          margin: 8px 0 14px;
        }
        .detalle-desc {
          color: var(--tinta);
          font-size: 0.95rem;
        }
        .variantes,
        .aromas {
          margin-top: 24px;
        }
        .variantes-label,
        .aromas-label {
          font-size: 0.68rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--gris);
          margin-bottom: 10px;
        }
        .variantes-opts {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .variante-btn {
          font-family: var(--sans);
          font-size: 0.82rem;
          padding: 9px 18px;
          border-radius: 999px;
          border: 1px solid var(--linea);
          background: var(--blanco);
          color: var(--tinta);
          cursor: pointer;
          transition: all 0.2s;
        }
        .variante-btn:hover {
          border-color: var(--acento);
        }
        .variante-btn.activo {
          background: var(--acento);
          border-color: var(--acento);
          color: #fff;
        }
        .aromas-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .aroma-tag {
          font-size: 0.78rem;
          padding: 6px 14px;
          border-radius: 999px;
          background: var(--rosa-tenue);
          color: var(--rosa-hover);
        }
        .precio-bloque {
          margin-top: 26px;
          display: flex;
          align-items: baseline;
          gap: 12px;
        }
        .precio-antes {
          font-size: 1rem;
          color: var(--gris);
          text-decoration: line-through;
        }
        .precio-final {
          font-weight: 600;
          font-size: 2.6rem;
          color: var(--tinta);
        }
        .detalle-cta {
          margin-top: 22px;
        }
        .detalle-nota {
          margin-top: 12px;
          font-size: 0.78rem;
          color: var(--gris);
        }
        .detalle-nota :global(a) {
          color: var(--acento);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        @media (max-width: 760px) {
          .detalle-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }
      `}</style>
    </div>
  );
}
