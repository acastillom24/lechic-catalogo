"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Columna «Sistemas»: cuadrícula fija (una columna por integración, una fila por cuenta) con un punto de estado en cada
 * posición, así se lee como un mapa de calor aunque haya muchas integraciones. Al hacer clic se abre el detalle.
 * Estados: publicado ✓ · pendiente … · error ! · sin vincular –.
 */
const ESTADOS = {
  publicado: { glifo: "✓", nombre: "Publicado" },
  pendiente: { glifo: "…", nombre: "Pendiente" },
  error: { glifo: "!", nombre: "Con error" },
  ninguno: { glifo: "–", nombre: "Sin vincular" },
};

const estadoDe = (x) => (x ? (ESTADOS[x.estado] ? x.estado : "pendiente") : "ninguno");

/** Iniciales de las integraciones, alineadas sobre las columnas de puntos (van bajo el título de la columna). */
export function SistemasEncabezado({ integraciones }) {
  if (!integraciones.length) return null;
  return (
    <div className="sis-grid sis-cabecera" style={{ gridTemplateColumns: `repeat(${integraciones.length}, 20px)` }} aria-hidden="true">
      {integraciones.map((i) => (
        <span key={i.id} title={i.nombre}>
          {i.sigla}
        </span>
      ))}
    </div>
  );
}

export default function SistemasCelda({ sync = [], integraciones }) {
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
    // En móvil la barra del navegador se oculta al hacer scroll y dispara un resize (solo de alto): no debe cerrar el panel.
    const anchoInicial = window.innerWidth;
    const cerrar = (e) => {
      if (e?.type === "scroll" && caja.current?.contains(e.target)) return;
      if (e?.type === "resize" && window.innerWidth === anchoInicial) return;
      setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    window.addEventListener("resize", cerrar);
    window.addEventListener("scroll", cerrar, true);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", cerrar);
      window.removeEventListener("scroll", cerrar, true);
    };
  }, [abierto]);

  if (!integraciones.length) return <span style={{ color: "var(--gris)" }}>—</span>;

  const buscar = (integ, alias) => sync.find((x) => (x.sistema || "saga") === integ.id && x.cuenta === alias);
  const filas = Math.max(1, ...integraciones.map((i) => i.cuentas.length));
  const errores = sync.filter((x) => x.estado === "error").length;
  // Enlace a la integración solo cuando esta variante tiene algo pendiente o con error en ella.
  const conAviso = integraciones.filter((i) => sync.some((x) => (x.sistema || "saga") === i.id && (x.estado === "pendiente" || x.estado === "error")));

  const alternar = () => {
    if (!abierto && boton.current) {
      const r = boton.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - Math.min(330, window.innerWidth - 16) - 8)) });
    }
    setAbierto((a) => !a);
  };

  return (
    <>
      <button
        ref={boton}
        type="button"
        className={errores ? "sis-celda con-error" : "sis-celda"}
        onClick={alternar}
        aria-expanded={abierto}
        aria-label={`Estado en plataformas${errores ? `: ${errores} con error` : ""}. Ver detalle`}
        title="Ver detalle por plataforma y cuenta"
      >
        <span className="sis-grid" style={{ gridTemplateColumns: `repeat(${integraciones.length}, 20px)` }}>
          {Array.from({ length: filas }).flatMap((_, f) =>
            integraciones.map((integ) => {
              const alias = integ.cuentas[f];
              if (alias === undefined) return <span key={`${integ.id}-${f}`} className="sis-punto vacio" />;
              const x = buscar(integ, alias);
              const e = estadoDe(x);
              return (
                <span
                  key={`${integ.id}-${f}`}
                  className={`sis-punto ${e}${x?.origen === "vinculado" ? " vinculado" : ""}`}
                  title={`${integ.nombre} · ${alias}: ${ESTADOS[e].nombre}`}
                >
                  {ESTADOS[e].glifo}
                </span>
              );
            })
          )}
        </span>
        {errores > 0 && <span className="sis-contador">{errores}</span>}
      </button>

      {abierto && (
        <div ref={caja} className="sis-detalle" style={{ top: pos.top, left: pos.left }} role="dialog" aria-label="Detalle por plataforma">
          <table>
            <thead>
              <tr>
                <th>Plataforma</th>
                <th>Cuenta</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {integraciones.flatMap((integ) =>
                integ.cuentas.map((alias, i) => {
                  const x = buscar(integ, alias);
                  const e = estadoDe(x);
                  return (
                    <tr key={`${integ.id}-${alias}`}>
                      <td>{i === 0 ? integ.nombre : ""}</td>
                      <td>{alias}</td>
                      <td>
                        <span className={`sis-punto ${e}`} aria-hidden="true">
                          {ESTADOS[e].glifo}
                        </span>{" "}
                        {ESTADOS[e].nombre}
                        {x?.origen === "vinculado" && <small>vinculado{x.accion ? ` (${x.accion})` : ""}</small>}
                        {x?.error && <small className="sis-error">{x.error}</small>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {conAviso.length > 0 && (
            <div className="sis-enlaces">
              {conAviso.map((integ) => (
                <Link key={integ.id} href={integ.href} className="btn-chico">
                  Abrir {integ.nombre} ↗
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
