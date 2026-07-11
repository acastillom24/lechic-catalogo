"use client";

import Link from "next/link";
import { getConfig, rangoPrecios } from "../lib/data";

/**
 * Tarjeta de producto.
 * Renderiza inteligentemente según el número de variantes:
 *  - 1 variante  -> muestra la imagen y el precio directo.
 *  - 2+ variantes -> muestra una imagen principal, un contador
 *    de variantes y el rango de precios ("desde S/ X").
 *  El detalle completo de todas las variantes se ve al entrar
 *  al producto.
 */
export default function ProductCard({ producto }) {
  const config = getConfig();
  const { min, max } = rangoPrecios(producto);
  const varias = producto.variantes.length > 1;
  const principal = producto.variantes[0];

  // ¿Hay alguna oferta entre las variantes?
  const enOferta = producto.variantes.some((v) => v.precioOferta != null);

  return (
    <Link href={`/producto/${producto.id}`} className="tarjeta">
      {enOferta && <span className="tarjeta-oferta">Oferta</span>}

      <div className="tarjeta-img">
        {/* Imagen del producto. Si no existe el archivo, se ve el
            marco vacío con el nombre — nunca se rompe el layout. */}
        <img
          src={principal.imagen}
          alt={producto.nombre}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.nextElementSibling.style.display = "flex";
          }}
        />
        <div className="tarjeta-img-fallback" style={{ display: "none" }}>
          <span>{producto.nombre}</span>
        </div>
      </div>

      <div className="tarjeta-cuerpo">
        <h3 className="tarjeta-nombre serif">{producto.nombre}</h3>

        {varias ? (
          <p className="tarjeta-variantes">
            {producto.variantes.length} presentaciones
          </p>
        ) : (
          producto.variantes[0].aromas && (
            <p className="tarjeta-aromas">
              {producto.variantes[0].aromas.join(" · ")}
            </p>
          )
        )}

        <div className="tarjeta-precio">
          {varias && min !== max ? (
            <>
              <span className="desde">desde</span>
              <span className="cur">{config.moneda}</span>
              <span className="num">{min}</span>
            </>
          ) : (
            <>
              <span className="cur">{config.moneda}</span>
              <span className="num">{min}</span>
            </>
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
          aspect-ratio: 3 / 4;
          background: linear-gradient(
            170deg,
            var(--rosa-tenue),
            var(--papel-hondo)
          );
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }
        .tarjeta-img :global(img) {
          height: 100%;
          width: 100%;
          object-fit: contain;
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
        .desde {
          font-size: 0.66rem;
          color: var(--gris);
          text-transform: uppercase;
          letter-spacing: 0.08em;
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
      `}</style>
    </Link>
  );
}
