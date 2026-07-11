"use client";

import { useSeleccion } from "../lib/SelectionContext";

export default function SelectionButton() {
  const { totalItems, abrir } = useSeleccion();

  return (
    <button className="sel-btn" onClick={abrir} aria-label="Ver mi selección">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {totalItems > 0 && <span className="sel-btn-badge">{totalItems}</span>}

      <style jsx>{`
        .sel-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border: 1px solid var(--linea);
          border-radius: 999px;
          background: var(--blanco);
          color: var(--tinta);
          cursor: pointer;
          transition: border-color 0.2s, color 0.2s;
        }
        .sel-btn:hover {
          border-color: var(--rosa);
          color: var(--rosa);
        }
        .sel-btn-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 20px;
          height: 20px;
          padding: 0 5px;
          border-radius: 999px;
          background: var(--rosa);
          color: #fff;
          font-size: 0.68rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--sans);
        }
      `}</style>
    </button>
  );
}
