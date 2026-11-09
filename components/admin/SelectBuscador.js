"use client";

import { useEffect, useRef, useState } from "react";

const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Lista desplegable con buscador. `opciones` = [{ valor, etiqueta }].
 * Envía el `valor` elegido en un input oculto llamado `name`.
 */
export default function SelectBuscador({ id, name, valor, onChange, opciones, placeholder = "Buscar…" }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const actual = opciones.find((o) => o.valor === valor);
  const etiquetaActual = actual ? actual.etiqueta : valor ? `${valor} (no está en la lista)` : "";
  const q = norm(texto);
  const filtradas = opciones.filter((o) => norm(`${o.valor} ${o.etiqueta}`).includes(q));

  function elegir(v) {
    onChange(v);
    setAbierto(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input type="hidden" name={name} value={valor || ""} />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={abierto}
        autoComplete="off"
        placeholder={placeholder}
        value={abierto ? texto : etiquetaActual}
        onFocus={() => {
          setTexto("");
          setAbierto(true);
        }}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAbierto(false);
          if (e.key === "Enter" && abierto) {
            e.preventDefault();
            if (filtradas[0]) elegir(filtradas[0].valor);
          }
        }}
      />
      {abierto && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            margin: "2px 0 0",
            padding: 0,
            listStyle: "none",
            maxHeight: 240,
            overflowY: "auto",
            background: "var(--blanco, #fff)",
            border: "1px solid var(--borde, #ddd)",
            borderRadius: 8,
            boxShadow: "0 6px 18px rgba(0,0,0,.12)",
          }}
        >
          {valor && (
            <li
              role="option"
              onMouseDown={(e) => {
                e.preventDefault();
                elegir("");
              }}
              style={{ padding: "8px 12px", cursor: "pointer", color: "var(--gris, #777)" }}
            >
              — Ninguna —
            </li>
          )}
          {filtradas.length === 0 && <li style={{ padding: "8px 12px", color: "var(--gris, #777)" }}>Sin resultados</li>}
          {filtradas.map((o) => (
            <li
              key={o.valor}
              role="option"
              aria-selected={o.valor === valor}
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(o.valor);
              }}
              style={{ padding: "8px 12px", cursor: "pointer", fontWeight: o.valor === valor ? 600 : 400 }}
            >
              {o.etiqueta}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
