"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useConfig } from "../lib/ConfigContext";
import { useSeleccion, construirKey } from "../lib/SelectionContext";
import CantidadControl from "./CantidadControl";

const INTERVALO_MS = 3000;

// Cuántas tarjetas caben según el ancho: 3 escritorio, 2 tablet, 1 celular.
function calcularPorVista() {
  if (window.matchMedia("(min-width: 900px)").matches) return 3;
  if (window.matchMedia("(min-width: 640px)").matches) return 2;
  return 1;
}

function OfertaCard({ producto, config, agregar, items, cambiarCantidad, onInteraccion }) {
  const [varIdx, setVarIdx] = useState(0);
  const varias = producto.variantes.length > 1;
  const variante = producto.variantes[varIdx];
  const precioFinal = variante.precioOferta ?? variante.precio;
  const hayOferta = variante.precioOferta != null;
  const sinStock = variante.stock === false;

  const key = construirKey(producto.id, variante.nombre);
  const linea = items.find((i) => i.key === key);

  // Igual que en la vista de marca: agrega sin abrir el panel.
  function agregarSeleccion() {
    onInteraccion();
    agregar(
      {
        key,
        productoId: producto.id,
        nombre: producto.nombre,
        marca: "Ofertas",
        variante: varias ? variante.nombre : "",
        precio: precioFinal,
        imagen: variante.imagen,
      },
      1,
      { abrir: false }
    );
  }

  return (
    <div className="slide-card">
      <Link href={`/producto/${producto.id}`} className="slide-enlace">
        <div className="slide-imagen">
          <span className="slide-badge">Oferta</span>
          <img
            src={variante.imagen}
            alt={producto.nombre}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling.style.display = "flex";
            }}
          />
          <div className="slide-fallback" style={{ display: "none" }}>
            <span>{producto.nombre}</span>
          </div>
        </div>

        <h3 className="slide-nombre serif">{producto.nombre}</h3>
        {producto.descripcion && (
          <p className="slide-desc">{producto.descripcion}</p>
        )}
        <div className="slide-precio">
          {hayOferta && (
            <span className="antes">
              {config.moneda} {variante.precio}
            </span>
          )}
          <span className="cur">{config.moneda}</span>
          <span className="num">{precioFinal}</span>
        </div>
      </Link>

      <div className="slide-acciones">
      {varias && (
        <select
          className="slide-variante"
          value={varIdx}
          onChange={(e) => setVarIdx(Number(e.target.value))}
          aria-label={`Variante de ${producto.nombre}`}
        >
          {producto.variantes.map((v, i) => (
            <option key={v.nombre} value={i}>
              {v.nombre}
            </option>
          ))}
        </select>
      )}

      <div className="slide-accion">
        {sinStock ? (
          <span className="slide-agotado">Agotado</span>
        ) : linea ? (
          <CantidadControl
            compacto
            eliminarEn1
            cantidad={linea.cantidad}
            onMenos={() => {
              onInteraccion();
              cambiarCantidad(key, linea.cantidad - 1);
            }}
            onMas={() => {
              onInteraccion();
              cambiarCantidad(key, linea.cantidad + 1);
            }}
          />
        ) : (
          <button
            type="button"
            className="slide-agregar"
            onClick={agregarSeleccion}
          >
            Agregar
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

export default function OfertasCarousel({ productos }) {
  const config = useConfig();
  const { agregar, items, cambiarCantidad } = useSeleccion();
  const [indice, setIndice] = useState(0);
  const [porVista, setPorVista] = useState(1);
  const [interacciones, setInteracciones] = useState(0);
  const timerRef = useRef(null);
  const dobleRef = useRef(false);
  const total = productos.length;
  const posiciones = Math.max(1, total - porVista + 1);

  useEffect(() => {
    const actualizar = () => setPorVista(calcularPorVista());
    actualizar();
    window.addEventListener("resize", actualizar);
    return () => window.removeEventListener("resize", actualizar);
  }, []);

  // Si al cambiar el ancho el índice queda fuera de rango, se corrige.
  useEffect(() => {
    setIndice((i) => Math.min(i, posiciones - 1));
  }, [posiciones]);

  const irA = (i) => setIndice((i + posiciones) % posiciones);

  function pausarExtra() {
    dobleRef.current = true;
    setInteracciones((n) => n + 1);
  }

  useEffect(() => {
    if (posiciones <= 1) return;

    const prefiereMenosMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefiereMenosMovimiento) return;

    // Tras agregar o cambiar la cantidad, la próxima transición tarda el doble.
    const espera = dobleRef.current ? INTERVALO_MS * 2 : INTERVALO_MS;
    timerRef.current = setTimeout(() => {
      dobleRef.current = false;
      setIndice((i) => (i + 1) % posiciones);
    }, espera);

    return () => clearTimeout(timerRef.current);
  }, [indice, posiciones, interacciones]);

  if (total === 0) return null;

  return (
    <div className="ofertas-carrusel">
      <div className="carrusel-marco">
      <div className="carrusel-viewport">
        <div
          className="carrusel-pista"
          style={{ transform: `translateX(-${(indice * 100) / porVista}%)` }}
        >
          {productos.map((producto) => (
            <div
              className="carrusel-slide"
              key={producto.id}
              style={{ flexBasis: `${100 / porVista}%` }}
            >
              <OfertaCard
                producto={producto}
                config={config}
                agregar={agregar}
                items={items}
                cambiarCantidad={cambiarCantidad}
                onInteraccion={pausarExtra}
              />
            </div>
          ))}
        </div>
      </div>

      {posiciones > 1 && (
        <>
          <button
            type="button"
            className="carrusel-flecha izq"
            onClick={() => irA(indice - 1)}
            aria-label="Oferta anterior"
          >
            ‹
          </button>
          <button
            type="button"
            className="carrusel-flecha der"
            onClick={() => irA(indice + 1)}
            aria-label="Siguiente oferta"
          >
            ›
          </button>
        </>
      )}
      </div>

      {posiciones > 1 && (
        <div className="carrusel-controles">
          <div className="carrusel-puntos">
            {Array.from({ length: posiciones }).map((_, i) => (
              <button
                key={i}
                type="button"
                className={`punto ${i === indice ? "activo" : ""}`}
                onClick={() => irA(i)}
                aria-label={`Ir a la oferta ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .carrusel-marco {
          position: relative;
        }
        .carrusel-viewport {
          overflow: hidden;
          border-radius: var(--radio);
          padding: 4px 0 10px;
          margin: -4px 0 -10px;
        }
        .carrusel-pista {
          display: flex;
          transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
        }
        .carrusel-slide {
          flex-grow: 0;
          flex-shrink: 0;
          min-width: 0;
          padding: 0 8px;
        }
        .ofertas-carrusel :global(.slide-card) {
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(155deg, var(--rosa-tenue), var(--blanco) 55%);
          border-radius: calc(var(--radio) + 6px);
          padding: 12px;
          box-shadow: var(--sombra);
          overflow: hidden;
        }
        .ofertas-carrusel :global(.slide-card)::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 4px;
          background: var(--rosa);
        }
        .ofertas-carrusel :global(.slide-enlace) {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ofertas-carrusel :global(.slide-imagen) {
          position: relative;
          height: clamp(210px, 41vh, 350px);
          background: var(--blanco);
          border-radius: var(--radio);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          overflow: hidden;
          box-shadow: 0 6px 18px rgba(122, 45, 87, 0.06);
          margin-bottom: 4px;
        }
        .ofertas-carrusel :global(.slide-imagen img) {
          height: 100%;
          width: 100%;
          object-fit: contain;
        }
        .ofertas-carrusel :global(.slide-badge) {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 2;
          background: var(--oferta);
          color: #fff;
          font-size: 0.56rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 500;
          padding: 3px 9px;
          border-radius: 999px;
        }
        .ofertas-carrusel :global(.slide-fallback) {
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 10px;
        }
        .ofertas-carrusel :global(.slide-fallback span) {
          font-family: var(--serif);
          font-size: 0.95rem;
          color: var(--gris);
        }
        .ofertas-carrusel :global(.slide-nombre) {
          font-weight: 600;
          font-size: 1rem;
          line-height: 1.2;
          text-align: center;
        }
        .ofertas-carrusel :global(.slide-desc) {
          font-size: 0.76rem;
          color: var(--gris);
          text-align: center;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .ofertas-carrusel :global(.slide-precio) {
          margin-top: 4px;
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 0.3em;
        }
        .ofertas-carrusel :global(.antes) {
          font-size: 0.8rem;
          color: var(--gris);
          text-decoration: line-through;
        }
        .ofertas-carrusel :global(.cur) {
          font-size: 0.9rem;
          color: var(--gris);
        }
        .ofertas-carrusel :global(.num) {
          font-family: var(--serif);
          font-weight: 600;
          font-size: 1.7rem;
          line-height: 1.1;
          color: var(--rosa-hover);
        }
        .ofertas-carrusel :global(.slide-acciones) {
          margin-top: auto;
          padding-top: 8px;
        }
        .ofertas-carrusel :global(.slide-variante) {
          margin-bottom: 8px;
          width: 100%;
          padding: 6px 10px;
          border: 1px solid var(--linea);
          border-radius: var(--radio);
          background: var(--blanco);
          color: var(--tinta);
          font-family: var(--sans);
          font-size: 0.82rem;
        }
        .ofertas-carrusel :global(.slide-accion) {
          display: flex;
          justify-content: center;
          min-height: 28px;
        }
        .ofertas-carrusel :global(.slide-agregar) {
          font-family: var(--sans);
          font-size: 0.8rem;
          padding: 7px 22px;
          border-radius: 999px;
          border: 1px solid var(--rosa);
          background: var(--blanco);
          color: var(--rosa);
          cursor: pointer;
          transition: all 0.2s;
        }
        .ofertas-carrusel :global(.slide-agregar:hover) {
          background: var(--rosa);
          color: #fff;
        }
        .ofertas-carrusel :global(.slide-agotado) {
          font-size: 0.78rem;
          color: var(--gris);
          padding: 7px 0;
        }

        .carrusel-controles {
          margin-top: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .carrusel-flecha {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 3;
          box-shadow: var(--sombra);
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid var(--linea);
          background: var(--blanco);
          color: var(--rosa);
          font-size: 1.3rem;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.25s, color 0.25s;
        }
        .carrusel-flecha.izq {
          left: -6px;
        }
        .carrusel-flecha.der {
          right: -6px;
        }
        .carrusel-flecha:hover {
          background: var(--rosa);
          color: var(--blanco);
        }
        .carrusel-puntos {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .punto {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          border: none;
          background: var(--linea);
          cursor: pointer;
          padding: 0;
          transition: background 0.25s, transform 0.25s;
        }
        .punto.activo {
          background: var(--rosa);
          transform: scale(1.25);
        }
      `}</style>
    </div>
  );
}
