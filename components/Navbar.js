"use client";

import Link from "next/link";
import { useState } from "react";
import { getMarcas, getConfig } from "../lib/data";
import SelectionButton from "./SelectionButton";

export default function Navbar() {
  const marcas = getMarcas();
  const config = getConfig();
  const [abierto, setAbierto] = useState(false);
  const palabrasMarca = config.marca.split(" ");

  return (
    <header className="nav">
      <div className="contenedor nav-fila">
        <Link href="/" className="nav-marca" onClick={() => setAbierto(false)}>
          <span className="nav-marca-txt">
            {palabrasMarca.map((palabra, i) => (
              <span key={i}>{palabra}</span>
            ))}
          </span>
        </Link>

        <nav className={`nav-links ${abierto ? "abierto" : ""}`}>
          {marcas.map((m) => (
            <Link
              key={m.slug}
              href={`/marca/${m.slug}`}
              onClick={() => setAbierto(false)}
            >
              {m.nombre}
            </Link>
          ))}
        </nav>

        <div className="nav-acciones">
          <SelectionButton />
          <button
            className="nav-toggle"
            aria-label="Abrir menú"
            aria-expanded={abierto}
            onClick={() => setAbierto((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <style jsx>{`
        .nav {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(251, 247, 244, 0.9);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--linea);
        }
        .nav-fila {
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          padding: 14px 0;
          gap: 20px;
        }
        .nav-marca {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          margin-right: 10px;
        }
        .nav-marca-txt {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          font-family: var(--serif);
          font-style: italic;
          font-weight: 600;
          font-size: 1.65rem;
          line-height: 1.1;
          letter-spacing: 0.03em;
          color: var(--rosa);
          white-space: nowrap;
        }
        .nav-links {
          display: flex;
          flex: 1;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px 24px;
          align-items: center;
        }
        .nav-links :global(a) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-family: var(--serif);
          font-size: 1.05rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--tinta);
          position: relative;
          padding-bottom: 4px;
          transition: color 0.2s;
        }
        .nav-links :global(a)::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: 0;
          width: 0;
          height: 2px;
          background: var(--rosa);
          transform: translateX(-50%);
          transition: width 0.2s ease;
        }
        .nav-links :global(a:hover) {
          color: var(--rosa);
        }
        .nav-links :global(a:hover)::after {
          width: 100%;
        }
        .nav-acciones {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        .nav-toggle {
          display: none;
          flex-direction: column;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
        }
        .nav-toggle span {
          width: 24px;
          height: 2px;
          background: var(--tinta);
          border-radius: 2px;
        }
        @media (max-width: 860px) {
          .nav-toggle {
            display: flex;
          }
          .nav-links {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            flex-direction: column;
            align-items: flex-start;
            gap: 0;
            background: var(--papel);
            border-bottom: 1px solid var(--linea);
            max-height: 0;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            transition: max-height 0.3s ease;
          }
          .nav-links.abierto {
            max-height: calc(100vh - 70px);
          }
          .nav-links :global(a) {
            width: 100%;
            justify-content: flex-start;
            text-align: left;
            padding: 14px 20px;
            border-top: 1px solid var(--linea);
          }
          .nav-links :global(a)::after {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
