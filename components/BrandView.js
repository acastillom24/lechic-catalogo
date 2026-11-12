"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import ProductCard from "./ProductCard";
import { prepararIndice, buscarEnIndice } from "../lib/busqueda";

export default function BrandView({ marca, productos, conteo }) {
  const [categoriaActiva, setCategoriaActiva] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  // Búsqueda sin tildes ni mayúsculas, con palabras en cualquier orden y tolerante a errores de tipeo (lib/busqueda.js).
  const indice = useMemo(
    () => prepararIndice(productos, (p) => [marca.nombre, marca.categorias.find((c) => c.slug === p.categoria)?.nombre]),
    [productos, marca]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim();
    // Con texto, los resultados vienen ordenados por relevancia; sin texto, en el orden del catálogo.
    let lista = q ? buscarEnIndice(indice, q) : productos;
    if (categoriaActiva !== "todas") {
      lista = lista.filter((p) => p.categoria === categoriaActiva);
    }
    return lista;
  }, [productos, indice, categoriaActiva, busqueda]);

  return (
    <>
      {/* Cabecera de la marca */}
      <section className="marca-hero" style={{ "--acento": marca.color }}>
        <div className="contenedor">
          <Link href="/" className="volver">
            ← Todas las marcas
          </Link>
          <h1 className="marca-hero-titulo serif">{marca.nombre}</h1>
          <p className="marca-hero-desc">{marca.descripcion}</p>
        </div>
      </section>

      <div className="contenedor cuerpo">
        {/* Buscador */}
        <div className="buscador">
          <input
            type="search"
            placeholder="Buscar producto, marca o aroma…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar en el catálogo"
          />
        </div>

        {/* Filtro de categorías */}
        <nav className="chips" aria-label="Categorías">
          <button
            className={`chip ${categoriaActiva === "todas" ? "activo" : ""}`}
            onClick={() => setCategoriaActiva("todas")}
          >
            Todas ({productos.length})
          </button>
          {marca.categorias.map((c) => {
            const n = conteo[c.slug] || 0;
            return (
              <button
                key={c.slug}
                className={`chip ${categoriaActiva === c.slug ? "activo" : ""}`}
                onClick={() => setCategoriaActiva(c.slug)}
              >
                {c.nombre} ({n})
              </button>
            );
          })}
        </nav>

        {/* Grid de productos */}
        {filtrados.length > 0 ? (
          <div className="grid-productos">
            {filtrados.map((p) => (
              <ProductCard key={p.id} producto={p} marca={marca} />
            ))}
          </div>
        ) : (
          <div className="vacio">
            <p>Aún no hay productos en esta selección.</p>
            <p className="vacio-nota">
              Escríbenos por Instagram y con gusto te mostramos lo disponible.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .marca-hero {
          background: linear-gradient(
            170deg,
            var(--rosa-tenue),
            var(--papel)
          );
          padding: 40px 0 34px;
          border-bottom: 1px solid var(--linea);
          text-align: center;
        }
        .volver {
          display: inline-block;
          font-size: 0.78rem;
          letter-spacing: 0.04em;
          color: var(--acento);
          margin-bottom: 16px;
        }
        .marca-hero-titulo {
          font-weight: 600;
          font-size: clamp(2.2rem, 7vw, 3.6rem);
          line-height: 1;
        }
        .marca-hero-desc {
          margin-top: 10px;
          color: var(--gris);
          font-size: 0.92rem;
        }
        .cuerpo {
          padding: 30px 20px 20px;
        }
        .buscador {
          max-width: 420px;
          margin: 0 auto 22px;
        }
        .buscador input {
          width: 100%;
          font-family: var(--sans);
          font-size: 0.9rem;
          padding: 12px 18px;
          border: 1px solid var(--linea);
          border-radius: 999px;
          background: var(--blanco);
          color: var(--tinta);
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          margin-bottom: 30px;
        }
        .chip {
          font-family: var(--sans);
          font-size: 0.76rem;
          letter-spacing: 0.02em;
          padding: 8px 16px;
          border-radius: 999px;
          border: 1px solid var(--linea);
          background: var(--blanco);
          color: var(--tinta);
          cursor: pointer;
          transition: all 0.2s;
        }
        .chip:hover {
          border-color: var(--acento);
          color: var(--acento);
        }
        .chip.activo {
          background: var(--acento);
          border-color: var(--acento);
          color: #fff;
        }
        .grid-productos {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 18px;
        }
        .vacio {
          text-align: center;
          padding: 60px 20px;
          color: var(--gris);
        }
        .vacio-nota {
          font-size: 0.85rem;
          margin-top: 8px;
        }
      `}</style>
    </>
  );
}
