"use client";

import { useDeferredValue, useMemo, useState } from "react";
import ProductCard from "./ProductCard";
import { prepararIndice, buscarEnIndice } from "../lib/busqueda";

const POR_PAGINA = 12;

/**
 * Buscador del inicio: busca en TODO el catálogo (todas las pestañas) sin recargar la página.
 * Descarga una sola vez el catálogo liviano (/api/catalogo, respuesta estática de la CDN) al enfocar el campo y busca en el
 * navegador: no cuesta una consulta a la base de datos por cada letra. La búsqueda ignora tildes y mayúsculas, acepta las
 * palabras en cualquier orden y tolera errores de tipeo (ver lib/busqueda.js).
 */
export default function BuscadorInicio() {
  const [texto, setTexto] = useState("");
  const [catalogo, setCatalogo] = useState(null);
  const [estado, setEstado] = useState("inactivo"); // inactivo | cargando | listo | error
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const consulta = useDeferredValue(texto);

  async function cargar() {
    if (catalogo || estado === "cargando") return;
    setEstado("cargando");
    try {
      const r = await fetch("/api/catalogo");
      if (!r.ok) throw new Error("No se pudo cargar el catálogo");
      setCatalogo(await r.json());
      setEstado("listo");
    } catch {
      setEstado("error");
    }
  }

  const indice = useMemo(() => (catalogo ? prepararIndice(catalogo.productos, (p) => p.etiquetas) : null), [catalogo]);
  const q = consulta.trim();
  const resultados = useMemo(() => (indice && q ? buscarEnIndice(indice, q) : []), [indice, q]);
  const pestanaDe = (p) => catalogo?.pestanas.find((x) => x.slug === p.pestana);
  const visibles = resultados.slice(0, mostrar);
  const hayTexto = texto.trim() !== "";

  function cambiar(valor) {
    setTexto(valor);
    setMostrar(POR_PAGINA);
    if (valor.trim()) cargar();
  }

  return (
    <div className="buscador-inicio" role="search">
      <label htmlFor="buscador-inicio-campo" className="solo-lectores">
        Buscar en todo el catálogo
      </label>
      <div className="caja">
        <svg className="lupa" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="buscador-inicio-campo"
          type="search"
          value={texto}
          placeholder="Busca en todo el catálogo: perfume, labial, crema…"
          autoComplete="off"
          onFocus={cargar}
          onChange={(e) => cambiar(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && cambiar("")}
        />
        {hayTexto && (
          <button type="button" className="limpiar" aria-label="Borrar búsqueda" onClick={() => cambiar("")}>
            ✕
          </button>
        )}
      </div>

      {hayTexto && (
        <div className="resultados" aria-live="polite">
          {estado === "error" ? (
            <p className="mensaje">No pudimos cargar el catálogo para buscar. Revisa tu conexión e inténtalo de nuevo.</p>
          ) : !indice ? (
            <p className="mensaje">Buscando…</p>
          ) : q && resultados.length === 0 ? (
            <div className="vacio">
              <p>No encontramos productos para «{q}».</p>
              <p className="nota">Prueba con otra palabra o con menos letras, o explora los catálogos más abajo.</p>
            </div>
          ) : q ? (
            <>
              <p className="conteo">
                {resultados.length} {resultados.length === 1 ? "resultado" : "resultados"} para «{q}»
              </p>
              <div className="grid">
                {visibles.map((p) => (
                  <ProductCard key={p.id} producto={p} marca={pestanaDe(p)} />
                ))}
              </div>
              {resultados.length > visibles.length && (
                <div className="mas">
                  <button type="button" onClick={() => setMostrar((n) => n + POR_PAGINA)}>
                    Ver más ({resultados.length - visibles.length} restantes)
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      <style jsx>{`
        .buscador-inicio {
          width: 100%;
        }
        .solo-lectores {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
        }
        .caja {
          position: relative;
          display: flex;
          align-items: center;
          max-width: 720px;
          margin: 0 auto;
        }
        .lupa {
          position: absolute;
          left: 18px;
          color: var(--gris);
          pointer-events: none;
        }
        input {
          width: 100%;
          font-family: var(--sans);
          font-size: 1rem;
          padding: 14px 46px 14px 46px;
          border: 1px solid var(--linea);
          border-radius: 999px;
          background: var(--blanco);
          color: var(--tinta);
          box-shadow: 0 4px 18px rgba(122, 45, 87, 0.08);
        }
        input:focus {
          outline: none;
          border-color: var(--rosa);
          box-shadow: 0 4px 22px rgba(122, 45, 87, 0.16);
        }
        .limpiar {
          position: absolute;
          right: 14px;
          width: 28px;
          height: 28px;
          border: 0;
          border-radius: 50%;
          background: var(--rosa-tenue);
          color: var(--gris);
          cursor: pointer;
          font-size: 0.8rem;
        }
        .resultados {
          margin-top: 22px;
        }
        .conteo {
          font-size: 0.85rem;
          color: var(--gris);
          margin-bottom: 14px;
          text-align: center;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 18px;
          max-width: 1100px;
          margin: 0 auto;
        }
        .mensaje,
        .vacio {
          text-align: center;
          color: var(--gris);
          font-size: 0.92rem;
          padding: 18px 0;
        }
        .nota {
          font-size: 0.82rem;
          margin-top: 6px;
        }
        .mas {
          text-align: center;
          margin-top: 20px;
        }
        .mas button {
          font-family: var(--sans);
          font-size: 0.88rem;
          padding: 10px 22px;
          border: 1px solid var(--rosa);
          border-radius: 999px;
          background: transparent;
          color: var(--rosa);
          cursor: pointer;
        }
        .mas button:hover {
          background: var(--rosa-tenue);
        }
      `}</style>
    </div>
  );
}
