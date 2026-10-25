"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { getConfig } from "../lib/data";
import { useSeleccion, construirKey } from "../lib/SelectionContext";
import CantidadControl from "./CantidadControl";

/**
 * Tarjeta de producto.
 *  - 1 variante  -> imagen y precio directo.
 *  - 2+ variantes -> carrusel: swipe en móvil, flechas en escritorio.
 *  Se puede agregar a "Mi selección" sin entrar al detalle; al agregar,
 *  el botón pasa a [− n +] (con tacho cuando hay 1).
 */
export default function ProductCard({ producto, marca }) {
  const config = getConfig();
  const { items, agregar, cambiarCantidad } = useSeleccion();
  const [idx, setIdx] = useState(0);
  const toque = useRef(null);
  const huboSwipe = useRef(false);

  const varias = producto.variantes.length > 1;
  const variante = producto.variantes[idx];
  const precioFinal = variante.precioOferta ?? variante.precio;
  const enOferta = variante.precioOferta != null;
  const agotado = variante.stock === false;

  const key = construirKey(producto.id, variante.nombre);
  const linea = items.find((i) => i.key === key);

  function ir(delta) {
    const n = producto.variantes.length;
    setIdx((i) => (i + delta + n) % n);
  }

  function onTouchStart(e) {
    const t = e.touches[0];
    toque.current = { x: t.clientX, y: t.clientY };
    huboSwipe.current = false;
  }

  function onTouchEnd(e) {
    if (!toque.current || !varias) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - toque.current.x;
    const dy = t.clientY - toque.current.y;
    toque.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      huboSwipe.current = true;
      ir(dx < 0 ? 1 : -1);
    }
  }

  // Si fue un swipe, no navegar al detalle.
  function onLinkClick(e) {
    if (huboSwipe.current) {
      e.preventDefault();
      huboSwipe.current = false;
    }
  }

  function agregarAqui() {
    agregar(
      {
        key,
        productoId: producto.id,
        nombre: producto.nombre,
        marca: marca?.nombre || "",
        variante: varias ? variante.nombre : "",
        precio: precioFinal,
        imagen: variante.imagen,
      },
      1,
      { abrir: false }
    );
  }

  return (
    <div className="tarjeta">
      {enOferta && <span className="tarjeta-oferta">Oferta</span>}

      <div
        className={`tarjeta-img ${agotado ? "esta-agotado" : ""}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {agotado && (
          <div className="cinta-agotado">
            <span>Agotado</span>
          </div>
        )}
        <Link
          href={`/producto/${producto.id}`}
          className="tarjeta-enlace-img"
          onClick={onLinkClick}
          draggable={false}
        >
          {/* Si no existe el archivo, se ve el marco con el nombre. */}
          <img
            key={variante.imagen}
            src={variante.imagen}
            alt={`${producto.nombre} ${varias ? variante.nombre : ""}`}
            loading="lazy"
            draggable={false}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling.style.display = "flex";
            }}
          />
          <div className="tarjeta-img-fallback" style={{ display: "none" }}>
            <span>{producto.nombre}</span>
          </div>
        </Link>

        {varias && (
          <>
            <button
              type="button"
              className="flecha izq"
              onClick={() => ir(-1)}
              aria-label="Presentación anterior"
            >
              ‹
            </button>
            <button
              type="button"
              className="flecha der"
              onClick={() => ir(1)}
              aria-label="Presentación siguiente"
            >
              ›
            </button>
            <div className="puntos">
              {producto.variantes.map((_, i) => (
                <span key={i} className={i === idx ? "activo" : ""} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="tarjeta-cuerpo">
        <Link
          href={`/producto/${producto.id}`}
          className="tarjeta-enlace"
          onClick={onLinkClick}
        >
          <h3 className="tarjeta-nombre serif">{producto.nombre}</h3>

          {varias ? (
            <p className="tarjeta-variantes">{variante.nombre}</p>
          ) : (
            variante.aromas && (
              <p className="tarjeta-aromas">{variante.aromas.join(" · ")}</p>
            )
          )}

          <div className="tarjeta-precio">
            <span className="cur">{config.moneda}</span>
            <span className="num">{precioFinal}</span>
          </div>
        </Link>

        <div className="tarjeta-accion">
          {agotado ? (
            <span className="btn-agotado">Agotado</span>
          ) : linea ? (
            <CantidadControl
              compacto
              eliminarEn1
              cantidad={linea.cantidad}
              onMenos={() => cambiarCantidad(key, linea.cantidad - 1)}
              onMas={() => cambiarCantidad(key, linea.cantidad + 1)}
            />
          ) : (
            <button type="button" className="btn-agregar" onClick={agregarAqui}>
              Agregar
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .tarjeta {
          position: relative;
          display: flex;
          flex-direction: column;
          background: var(--blanco);
          border: 1px solid var(--linea);
          border-radius: var(--radio);
          overflow: hidden;
          transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.2, 1),
            box-shadow 0.35s;
        }
        .tarjeta:hover {
          transform: translateY(-5px);
          box-shadow: var(--sombra-hover);
        }
        .tarjeta-oferta {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 2;
          background: var(--oferta);
          color: #fff;
          font-size: 0.6rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 500;
          padding: 4px 12px;
          border-radius: 999px;
        }
        .tarjeta-img {
          position: relative;
          aspect-ratio: 1 / 1;
          background: linear-gradient(
            170deg,
            var(--rosa-tenue),
            var(--papel-hondo)
          );
          touch-action: pan-y;
        }
        .tarjeta-img :global(.tarjeta-enlace-img) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 18px;
        }
        .tarjeta-img :global(img) {
          height: 100%;
          width: 100%;
          object-fit: contain;
          user-select: none;
        }
        .tarjeta-img.esta-agotado :global(img) {
          opacity: 0.55;
          filter: grayscale(0.55);
        }
        .cinta-agotado {
          position: absolute;
          top: 0;
          right: 0;
          width: 96px;
          height: 96px;
          overflow: hidden;
          z-index: 3;
          pointer-events: none;
        }
        .cinta-agotado span {
          position: absolute;
          top: 18px;
          right: -34px;
          transform: rotate(45deg);
          background: var(--tinta);
          color: #fff;
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 500;
          text-align: center;
          padding: 5px 40px;
        }
        .tarjeta-img-fallback {
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 16px;
        }
        .tarjeta-img-fallback span {
          font-family: var(--serif);
          font-size: 1.1rem;
          color: var(--gris);
        }
        .flecha {
          display: none;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 4;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 1px solid var(--linea);
          background: var(--blanco);
          color: var(--tinta);
          font-size: 1.2rem;
          line-height: 1;
          cursor: pointer;
          align-items: center;
          justify-content: center;
        }
        .flecha:hover {
          background: var(--rosa-tenue);
        }
        .flecha.izq {
          left: 8px;
        }
        .flecha.der {
          right: 8px;
        }
        @media (hover: hover) and (pointer: fine) {
          .flecha {
            display: inline-flex;
          }
        }
        .puntos {
          position: absolute;
          bottom: 8px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          gap: 5px;
          pointer-events: none;
        }
        .puntos span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--linea);
        }
        .puntos span.activo {
          background: var(--rosa);
        }
        .tarjeta-cuerpo {
          padding: 16px 16px 18px;
          text-align: center;
        }
        .tarjeta-nombre {
          font-weight: 600;
          font-size: 1.2rem;
          line-height: 1.1;
        }
        .tarjeta-variantes {
          font-size: 0.7rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--rosa);
          margin-top: 5px;
        }
        .tarjeta-aromas {
          font-size: 0.74rem;
          color: var(--gris);
          margin-top: 5px;
        }
        .tarjeta-precio {
          margin-top: 12px;
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 0.25em;
        }
        .cur {
          font-size: 0.8rem;
          color: var(--gris);
        }
        .num {
          font-family: var(--serif);
          font-weight: 600;
          font-size: 1.7rem;
        }
        .tarjeta-accion {
          margin-top: 12px;
          display: flex;
          justify-content: center;
          min-height: 28px;
        }
        .btn-agregar {
          font-family: var(--sans);
          font-size: 0.8rem;
          padding: 7px 22px;
          border-radius: 999px;
          border: 1px solid var(--acento, var(--rosa));
          background: var(--blanco);
          color: var(--acento, var(--rosa));
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-agregar:hover {
          background: var(--acento, var(--rosa));
          color: #fff;
        }
        .btn-agotado {
          font-size: 0.78rem;
          color: var(--gris);
          padding: 7px 0;
        }
      `}</style>
    </div>
  );
}
