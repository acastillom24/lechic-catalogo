"use client";

import { useEffect, useRef, useState } from "react";

const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Selección múltiple compacta: un botón abre una lista con buscador y casillas; lo marcado se ve como chips
 * (con ✕ para quitar). `opciones` = lista de textos, `valor` = textos marcados. Con `libre`, además de las
 * opciones se puede escribir cualquier texto propio y agregarlo (Enter o «Agregar …»).
 */
export default function SelectMulti({ id, valor = [], onChange, opciones = [], placeholder = "Elegir…", buscar = "Buscar…", libre = false, formato }) {
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

  // `formato`: cómo se muestra cada valor (p. ej. «1735 — Fragancias» para el código 1735).
  const rotulo = formato || ((x) => x);
  const marcados = Array.isArray(valor) ? valor : valor ? [valor] : [];
  const q = norm(texto);
  const filtradas = opciones.filter((o) => norm(rotulo(o)).includes(q) || norm(o).includes(q));
  const alternar = (o) => onChange(marcados.includes(o) ? marcados.filter((x) => x !== o) : [...marcados, o]);
  // Marcados que ya no están en la lista (p. ej. se quitó de Configuración): se muestran para poder quitarlos.
  const fuera = libre ? [] : marcados.filter((m) => !opciones.includes(m));
  const propio = texto.trim();
  const puedeAgregar = libre && propio !== "" && !marcados.some((m) => norm(m) === norm(propio));
  const agregarPropio = () => {
    // Si coincide con una opción de la lista se usa esa (misma escritura); si no, el texto tal cual.
    const igual = opciones.find((o) => norm(o) === norm(propio));
    onChange([...marcados, igual || propio]);
    setTexto("");
  };

  return (
    <div className="sel-multi" ref={ref}>
      <button
        type="button"
        id={id}
        className="sel-multi-boton"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => { setTexto(""); setAbierto((a) => !a); }}
        onKeyDown={(e) => e.key === "Escape" && setAbierto(false)}
      >
        <span>{marcados.length ? `${marcados.length} seleccionado${marcados.length === 1 ? "" : "s"}` : placeholder}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {abierto && (
        <div className="sel-multi-panel">
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
                if (puedeAgregar) agregarPropio();
              }
            }}
          />
          <ul role="listbox" aria-multiselectable="true">
            {puedeAgregar && (
              <li className="sel-multi-agregar">
                <button type="button" onClick={agregarPropio}>+ Agregar «{propio}»</button>
              </li>
            )}
            {filtradas.length === 0 && !puedeAgregar && <li className="sel-multi-vacio">Sin resultados</li>}
            {filtradas.map((o) => (
              <li key={o} role="option" aria-selected={marcados.includes(o)}>
                <label className="campo-check">
                  <input type="checkbox" checked={marcados.includes(o)} onChange={() => alternar(o)} />
                  {rotulo(o)}
                </label>
              </li>
            ))}
          </ul>
          {marcados.length > 0 && (
            <button type="button" className="sel-multi-limpiar" onClick={() => onChange([])}>Quitar todo</button>
          )}
        </div>
      )}
      {marcados.length > 0 && (
        <div className="sel-multi-chips">
          {marcados.map((m) => (
            <span key={m} className={fuera.includes(m) ? "pf-chip activo fuera" : "pf-chip activo"} title={fuera.includes(m) ? "Ya no está en la lista" : undefined}>
              {rotulo(m)}
              <button type="button" aria-label={`Quitar ${rotulo(m)}`} onClick={() => alternar(m)}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
