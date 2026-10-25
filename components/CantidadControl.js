"use client";

/**
 * Control de cantidad: [− n +].
 * Con `eliminarEn1`, cuando la cantidad es 1 el botón izquierdo
 * es un tacho que elimina el producto.
 */
export default function CantidadControl({
  cantidad,
  onMenos,
  onMas,
  eliminarEn1 = false,
  compacto = false,
}) {
  const tacho = eliminarEn1 && cantidad <= 1;

  return (
    <div className={`cant ${compacto ? "compacto" : ""}`}>
      <button
        type="button"
        onClick={onMenos}
        aria-label={tacho ? "Eliminar" : "Quitar uno"}
      >
        {tacho ? (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        ) : (
          "−"
        )}
      </button>
      <span>{cantidad}</span>
      <button type="button" onClick={onMas} aria-label="Agregar uno">
        +
      </button>

      <style jsx>{`
        .cant {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--linea);
          border-radius: 999px;
          overflow: hidden;
          background: var(--blanco);
        }
        .cant button {
          width: 34px;
          height: 34px;
          border: none;
          background: var(--blanco);
          color: var(--tinta);
          font-size: 1.1rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .cant.compacto button {
          width: 28px;
          height: 28px;
          font-size: 1rem;
        }
        .cant button:hover {
          background: var(--rosa-tenue);
        }
        .cant span {
          min-width: 28px;
          text-align: center;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
