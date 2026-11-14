"use client";

import { useEffect, useRef, useState } from "react";

const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Selección ÚNICA con el mismo aspecto que SelectMulti (Características): un botón abre una lista con buscador y lo elegido se ve como
 * una etiqueta con ✕. Al elegir una opción se cierra; solo puede haber una. Con `name` envía el valor en un campo oculto (como un
 * <select>). `vacio` = texto de la opción «sin valor» (p. ej. «= producto» en una variante); sin él, no se puede dejar vacío.
 */
export default function SelectUnico({ id, name, valor = "", onChange, opciones = [], placeholder = "Elegir…", buscar = "Buscar…", vacio, formato, requerido = false }) {
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

  const rotulo = formato || ((x) => x);
  const actual = valor === null || valor === undefined ? "" : String(valor);
  const q = norm(texto);
  const filtradas = opciones.filter((o) => norm(rotulo(o)).includes(q) || norm(o).includes(q));
  // Valor guardado que ya no está en la lista: se muestra para no perderlo sin avisar.
  const fuera = actual && !opciones.includes(actual);
  const elegir = (o) => {
    onChange(o);
    setAbierto(false);
    setTexto("");
  };

  return (
    <div className="sel-multi sel-unico" ref={ref}>
      {name && <input type="hidden" name={name} value={actual} />}
      <button
        type="button"
        id={id}
        className="sel-multi-boton"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-required={requerido || undefined}
        onClick={() => { setTexto(""); setAbierto((a) => !a); }}
        onKeyDown={(e) => e.key === "Escape" && setAbierto(false)}
      >
        <span className={actual ? "sel-unico-valor" : "sel-unico-ph"} title={fuera ? "Ya no está en la lista" : undefined}>{actual ? rotulo(actual) : placeholder}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {abierto && (
        <div className="sel-multi-panel">
          {opciones.length > 7 && (
            <input
              type="search"
              autoFocus
              autoComplete="off"
              placeholder={buscar}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setAbierto(false);
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtradas.length === 1) elegir(filtradas[0]);
                }
              }}
            />
          )}
          <ul role="listbox" aria-multiselectable="false">
            {vacio !== undefined && vacio !== null && !texto && (
              <li role="option" aria-selected={!actual}>
                <button type="button" className={`sel-unico-op${!actual ? " activo" : ""}`} onClick={() => elegir("")}>
                  <span className="sel-unico-marca" aria-hidden="true">{!actual ? "●" : ""}</span>
                  <em>{vacio}</em>
                </button>
              </li>
            )}
            {filtradas.length === 0 && <li className="sel-multi-vacio">Sin resultados</li>}
            {filtradas.map((o) => (
              <li key={o} role="option" aria-selected={actual === o}>
                <button type="button" className={`sel-unico-op${actual === o ? " activo" : ""}`} onClick={() => elegir(o)}>
                  <span className="sel-unico-marca" aria-hidden="true">{actual === o ? "●" : ""}</span>
                  {rotulo(o)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
