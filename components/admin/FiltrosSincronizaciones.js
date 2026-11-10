"use client";

import Link from "next/link";
import { useRef } from "react";
import { IconoBuscar, IconoFiltro, IconoCerrar } from "./Iconos";

/**
 * Barra de filtros de la tabla de sincronizaciones (mismo estilo que la de Ventas y Productos):
 * buscador por producto o SKU, selector de cuenta y, si llega `usuarios`, de usuario del panel;
 * debajo, chips con los filtros activos para quitarlos. Los enlaces de los chips llegan calculados.
 */
export default function FiltrosSincronizaciones({ action, estado, filtros, cuentas, usuarios = null, acciones = null, chips }) {
  const formRef = useRef(null);
  const enviar = () => formRef.current?.requestSubmit();

  const selector = (nombre, etiqueta, opciones, valor) => (
    <label className="admin-filtro" title={etiqueta}>
      <IconoFiltro size={16} />
      <select name={nombre} defaultValue={valor || ""} aria-label={etiqueta} onChange={enviar}>
        <option value="">{etiqueta}: todos</option>
        {opciones.map(([v, texto]) => (
          <option key={v} value={v}>
            {texto}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="form-grid" style={{ gap: 10 }}>
      <form ref={formRef} method="get" action={action} className="admin-barra">
        {estado !== "error" && <input type="hidden" name="estado" value={estado} />}
        <div className={acciones ? "admin-barra-buscar ancha" : "admin-barra-buscar"}>
          <IconoBuscar size={18} />
          <input type="search" name="q" defaultValue={filtros.q || ""} placeholder="Buscar por producto o SKU..." />
          <span className="admin-barra-sep" aria-hidden="true" />
          {selector("cuenta", "Cuenta", cuentas.map((c) => [c.alias, c.nombre]), filtros.cuenta)}
          {usuarios && (
            <>
              <span className="admin-barra-sep" aria-hidden="true" />
              {selector(
                "usuario",
                "Usuario",
                [["__admin", "Admin / automático"], ...usuarios.map((u) => [u.usuario, u.usuario])],
                filtros.usuario
              )}
            </>
          )}
          {acciones && (
            <>
              <span className="admin-barra-sep" aria-hidden="true" />
              {selector("accion", "Vinculación", acciones, filtros.accion)}
              <span className="admin-barra-sep" aria-hidden="true" />
              {selector("origen", "Origen", [["creado", "Creado desde la web"], ["vinculado", "Vinculado a SAGA"]], filtros.origen)}
            </>
          )}
        </div>
      </form>

      {chips.length > 0 && (
        <div className="chips-periodo">
          {chips.map((c) => (
            <Link key={c.texto} href={c.href} className="chip-filtro" title="Quitar filtro">
              {c.texto} <IconoCerrar size={14} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
