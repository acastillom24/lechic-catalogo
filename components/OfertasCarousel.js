"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getConfig, rangoPrecios } from "../lib/data";

const INTERVALO_MS = 3000;

export default function OfertasCarousel({ productos }) {
  const config = getConfig();
  const [indice, setIndice] = useState(0);
  const timerRef = useRef(null);
  const total = productos.length;

  const irA = (i) => setIndice((i + total) % total);
  const siguiente = () => irA(indice + 1);
  const anterior = () => irA(indice - 1);

  useEffect(() => {
    if (total <= 1) return;

    const prefiereMenosMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefiereMenosMovimiento) return;

    timerRef.current = setInterval(() => {
      setIndice((i) => (i + 1) % total);
    }, INTERVALO_MS);

    return () => clearInterval(timerRef.current);
  }, [indice, total]);

  if (total === 0) return null;

  return (
    <div className="ofertas-carrusel">
      <div className="carrusel-viewport">
        <div
          className="carrusel-pista"
          style={{ transform: `translateX(-${indice * 100}%)` }}
        >
          {productos.map((producto) => {
            const { min, max } = rangoPrecios(producto);
            const varias = producto.variantes.length > 1;
            const principal = producto.variantes[0];

            return (
              <div className="carrusel-slide" key={producto.id}>
                <Link href={`/producto/${producto.id}`} className="slide-card">
                  <div className="slide-top">
                    <div className="slide-imagen">
                      <span className="slide-badge">Oferta</span>
                      <img
                        src={principal.imagen}
                        alt={producto.nombre}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling.style.display =
                            "flex";
                        }}
                      />
                      <div
                        className="slide-fallback"
                        style={{ display: "none" }}
                      >
                        <span>{producto.nombre}</span>
                      </div>
                    </div>

                    <div className="slide-precio-box">
                      <div className="slide-precio">
                        {varias && min !== max && (
                          <span className="desde">desde</span>
                        )}
                        <span className="cur">{config.moneda}</span>
                        <span className="num">{min}</span>
                      </div>
                      <h3 className="slide-nombre serif">{producto.nombre}</h3>
                      {producto.descripcion && (
                        <p className="slide-desc">{producto.descripcion}</p>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {total > 1 && (
        <div className="carrusel-controles">
          <button
            type="button"
            className="carrusel-flecha"
            onClick={anterior}
            aria-label="Oferta anterior"
          >
            ‹
          </button>

          <div className="carrusel-puntos">
            {productos.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`punto ${i === indice ? "activo" : ""}`}
                onClick={() => irA(i)}
                aria-label={`Ir a la oferta ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            className="carrusel-flecha"
            onClick={siguiente}
            aria-label="Siguiente oferta"
          >
            ›
          </button>
        </div>
      )}

      <style jsx>{`
        .ofertas-carrusel {
          max-width: 640px;
          margin: 0 auto;
        }
        .carrusel-viewport {
          overflow: hidden;
          border-radius: var(--radio);
        }
        .carrusel-pista {
          display: flex;
          transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
        }
        .carrusel-slide {
          flex: 0 0 100%;
          min-width: 0;
        }
        .slide-card {
          position: relative;
          display: block;
          background: linear-gradient(155deg, var(--rosa-tenue), var(--blanco) 55%);
          border-radius: calc(var(--radio) + 6px);
          padding: 20px;
          box-shadow: var(--sombra);
          overflow: hidden;
          transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.2, 1),
            box-shadow 0.35s;
        }
        .slide-card::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 4px;
          background: var(--rosa);
        }
        .slide-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--sombra-hover);
        }
        .slide-top {
          display: flex;
          align-items: stretch;
          gap: 16px;
        }
        .slide-imagen {
          position: relative;
          flex: 1 1 50%;
          aspect-ratio: 1 / 1;
          background: var(--blanco);
          border-radius: var(--radio);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px;
          overflow: hidden;
          box-shadow: 0 6px 18px rgba(36, 26, 31, 0.06);
        }
        .slide-imagen :global(img) {
          height: 100%;
          width: 100%;
          object-fit: contain;
        }
        .slide-badge {
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
        .slide-fallback {
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 10px;
        }
        .slide-fallback span {
          font-family: var(--serif);
          font-size: 0.95rem;
          color: var(--gris);
        }
        .slide-precio-box {
          flex: 1 1 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 6px;
          background: var(--rosa-tenue);
          border-radius: var(--radio);
          padding: 18px 14px;
        }
        .slide-precio {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 0.25em;
        }
        .desde {
          font-size: 0.66rem;
          color: var(--gris);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .cur {
          font-size: 0.9rem;
          color: var(--gris);
        }
        .num {
          font-family: var(--serif);
          font-weight: 600;
          font-size: 2.1rem;
          color: var(--rosa-hover);
        }
        .slide-nombre {
          margin-top: 4px;
          font-weight: 600;
          font-size: 1.05rem;
          line-height: 1.2;
        }
        .slide-desc {
          font-size: 0.76rem;
          color: var(--gris);
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .carrusel-controles {
          margin-top: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
        }
        .carrusel-flecha {
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

        @media (max-width: 640px) {
          .slide-card {
            padding: 14px;
          }
          .slide-top {
            gap: 10px;
          }
          .slide-precio-box {
            padding: 12px 8px;
          }
          .slide-nombre {
            font-size: 0.88rem;
          }
          .slide-desc {
            display: none;
          }
          .num {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
