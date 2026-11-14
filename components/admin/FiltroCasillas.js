"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconoFiltro } from "./Iconos";

/**
 * Desplegable de filtro con la lista de opciones como casillas (☐ / ✓). Un clic en una casilla aplica el filtro al
 * instante (es un enlace); volver a pulsar la marcada la quita. `opciones`: [{ valor, texto, href, marcada }] con los
 * enlaces ya calculados en el servidor o en el padre.
 */
export default function FiltroCasillas({ etiqueta, textoBoton, activo, opciones, hrefLimpiar }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const boton = useRef(null);
  const caja = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (caja.current?.contains(e.target) || boton.current?.contains(e.target)) return;
      setAbierto(false);
    };
    const tecla = (e) => e.key === "Escape" && setAbierto(false);
    const anchoInicial = window.innerWidth;
    const cerrar = (e) => {
      if (e?.type === "resize" && window.innerWidth === anchoInicial) return;
      setAbierto(false);
    };
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
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 200)) });
    }
    setAbierto((a) => !a);
  };

  return (
    <span className="fcol fcol-suelto">
      <button ref={boton} type="button" className={activo ? "fcol-pill activo" : "fcol-pill"} aria-label={`Filtrar por ${etiqueta}`} aria-expanded={abierto} onClick={alternar}>
        <IconoFiltro size={14} /> {textoBoton} <span aria-hidden="true">▾</span>
      </button>
      {abierto && (
        <div ref={caja} className="fcol-panel fcol-panel-casillas" style={{ top: pos.top, left: pos.left }} role="dialog" aria-label={`Filtro de ${etiqueta}`}>
          <div className="fcol-casillas" role="group" aria-label={etiqueta}>
            {opciones.map((o) => (
              <Link key={o.valor} href={o.marcada ? hrefLimpiar : o.href} className={o.marcada ? "dash-casilla marcada" : "dash-casilla"} role="checkbox" aria-checked={o.marcada} scroll={false}>
                <span className="dash-caja" aria-hidden="true">{o.marcada ? "✓" : ""}</span>
                {o.texto}
              </Link>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
