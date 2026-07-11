"use client";

import Link from "next/link";
import { useState } from "react";
import { getMarcas, getConfig } from "../lib/data";

export default function Navbar() {
  const marcas = getMarcas();
  const config = getConfig();
  const [abierto, setAbierto] = useState(false);

  return (
    <header className="nav">
      <div className="contenedor nav-fila">
        <Link href="/" className="nav-marca" onClick={() => setAbierto(false)}>
          <span className="nav-marca-txt">{config.marca}</span>
        </Link>

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
          <Link href="/info" onClick={() => setAbierto(false)}>
            Cómo comprar
          </Link>
        </nav>
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
          height: 62px;
        }
        .nav-marca-txt {
          font-family: var(--serif);
          font-weight: 600;
          font-size: 1.5rem;
          letter-spacing: 0.02em;
          color: var(--rosa);
        }
        .nav-links {
          display: flex;
          gap: 22px;
          align-items: center;
        }
        .nav-links :global(a) {
          font-size: 0.82rem;
          letter-spacing: 0.04em;
          color: var(--tinta);
          transition: color 0.2s;
        }
        .nav-links :global(a:hover) {
          color: var(--rosa);
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
            top: 62px;
            left: 0;
            right: 0;
            flex-direction: column;
            align-items: flex-start;
            gap: 0;
            background: var(--papel);
            border-bottom: 1px solid var(--linea);
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
          }
          .nav-links.abierto {
            max-height: 400px;
          }
          .nav-links :global(a) {
            width: 100%;
            padding: 14px 20px;
            border-top: 1px solid var(--linea);
          }
        }
      `}</style>
    </header>
  );
}
