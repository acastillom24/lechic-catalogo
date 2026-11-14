"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconoFiltro } from "./Iconos";

/**
 * Encabezado de columna con filtro tipo Excel: el nombre de la columna y un icono de filtro que abre una ventanita con las
 * opciones de ESA columna (lista, texto, fechas o monto). El icono se resalta cuando la columna está filtrada.
 * Envía un formulario GET con el resto de filtros activos en campos ocultos (`ocultos`), así que los filtros se combinan.
 * `campos`: [{ tipo: "select" | "texto" | "fecha" | "numero", name, etiqueta, valor, opciones: [{ valor, texto }] }].
 */
export default function FiltroColumna({ etiqueta, activo, campos, ocultos = {}, hrefLimpiar, atajos = [], accion = "/admin/ventas", textoBoton }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const boton = useRef(null);
  const caja = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (caja.current?.contains(e.target) || boton.current?.contains(e.target)) return;
      setAbierto(false);
    };
    const tecla = (e) => e.key === "Escape" && setAbierto(false);
    const cerrar = () => setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    window.addEventListener("resize", cerrar);
    window.addEventListener("scroll", cerrar, true);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", cerrar);
      window.removeEventListener("scroll", cerrar, true);
    };
  }, [abierto]);

  const alternar = () => {
    if (!abierto && boton.current) {
      const r = boton.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 270)) });
    }
    setAbierto((a) => !a);
  };

  // Con un solo campo de lista se aplica al elegir; con varios, con «Aplicar».
  const unaLista = campos.length === 1 && campos[0].tipo === "select";

  const control = (c) => {
    if (c.tipo === "select") {
      return (
        <select name={c.name} defaultValue={c.valor || ""} onChange={unaLista ? () => formRef.current?.requestSubmit() : undefined} autoFocus={unaLista}>
          <option value="">Todos</option>
          {c.opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      );
    }
    if (c.tipo === "fecha") return <input type="date" name={c.name} defaultValue={c.valor || ""} max={c.max} />;
    if (c.tipo === "numero") return <input type="number" name={c.name} min="0" step="0.01" defaultValue={c.valor ?? ""} placeholder={c.placeholder || ""} />;
    return <input type="search" name={c.name} defaultValue={c.valor || ""} placeholder={c.placeholder || ""} autoFocus />;
  };

  return (
    <span className={textoBoton ? "fcol fcol-suelto" : "fcol"}>
      {textoBoton ? (
        <button
          ref={boton}
          type="button"
          className={activo ? "fcol-pill activo" : "fcol-pill"}
          aria-label={`Filtrar por ${etiqueta}`}
          aria-expanded={abierto}
          onClick={alternar}
        >
          <IconoFiltro size={14} /> {textoBoton} <span aria-hidden="true">▾</span>
        </button>
      ) : (
        <>
          <span>{etiqueta}</span>
          <button
            ref={boton}
            type="button"
            className={activo ? "fcol-btn activo" : "fcol-btn"}
            aria-label={`Filtrar por ${etiqueta}`}
            aria-expanded={abierto}
            title={activo ? `Filtrando por ${etiqueta}` : `Filtrar por ${etiqueta}`}
            onClick={alternar}
          >
            <IconoFiltro size={14} />
          </button>
        </>
      )}
      {abierto && (
        <div ref={caja} className="fcol-panel" style={{ top: pos.top, left: pos.left }} role="dialog" aria-label={`Filtro de ${etiqueta}`}>
          <form ref={formRef} method="get" action={accion}>
            {Object.entries(ocultos).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <strong>{etiqueta}</strong>
            {atajos.length > 0 && (
              <div className="fcol-atajos">
                {atajos.map((a) => (
                  <Link key={a.clave} href={a.href} className={a.activo ? "chip-per activo" : "chip-per"}>
                    {a.texto}
                  </Link>
                ))}
              </div>
            )}
            {campos.map((c) => (
              <label key={c.name} className="fcol-campo">
                {c.etiqueta && <span>{c.etiqueta}</span>}
                {control(c)}
              </label>
            ))}
            <div className="fcol-acciones">
              {activo && (
                <Link href={hrefLimpiar} className="fcol-btn-chico">
                  Quitar filtro
                </Link>
              )}
              {!unaLista && (
                <button type="submit" className="fcol-btn-chico solido">
                  Aplicar
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </span>
  );
}
