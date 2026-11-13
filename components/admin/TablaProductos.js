"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { eliminarProductos, actualizarEstadoSaga } from "../../app/(admin)/admin/actions";
import { NIVELES, nivelDe } from "../../lib/stock-niveles";
import ImportarCsvForm from "./ImportarCsvForm";
import MovimientoForm from "./MovimientoForm";
import {
  IconoBuscar,
  IconoFiltro,
  IconoPapelera,
  IconoExportar,
  IconoImportar,
  IconoMas,
  IconoPlantilla,
  IconoStock,
  IconoHistorial,
  IconoEditar,
  IconoCampana,
  IconoCerrar,
} from "./Iconos";

const INFO_NIVEL = Object.fromEntries(NIVELES.map((n) => [n.id, n]));
const vacio = <span style={{ color: "var(--gris)" }}>—</span>;

function precio(v) {
  const p = v.precio_oferta ?? v.precio;
  if (p === null || p === undefined) return vacio;
  return (
    <>
      S/ {Number(p)}
      {v.precio_oferta !== null && v.precio !== null && (
        <small style={{ display: "block", color: "var(--gris)", textDecoration: "line-through" }}>
          S/ {Number(v.precio)}
        </small>
      )}
    </>
  );
}

/**
 * Tabla unificada de productos (una fila por variante) con selección,
 * eliminar, exportar e importar CSV. Los datos llegan ya cargados del servidor.
 */
export default function TablaProductos({
  filas,
  total,
  hrefNuevo,
  alertas = 0,
  hrefAlertas,
  configStock,
  columnas = {},
  marcas = [],
  cuentas = [],
  hrefLimpiarColumnas,
}) {
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [importando, setImportando] = useState(false);
  const [moviendo, setMoviendo] = useState(null);
  const [actualizando, iniciarActualizar] = useTransition();
  const hayErrores = filas.some((f) => (f.sync || []).some((x) => x.estado === "error"));
  const hayPendientes =filas.some((f) => (f.sync || []).some((x) => x.estado === "pendiente" || x.estado === "error"));
  const menuRef = useRef(null);
  const cabeceraRef = useRef(null);

  // Si cambia la página/filtros (llegan otras filas), descarta la selección.
  const clave = filas.map((f) => f.id).join(",");
  useEffect(() => {
    setSeleccion(new Set());
    setMoviendo(null);
  }, [clave]);

  const idsPagina = filas.map((f) => f.id);
  const marcadas = idsPagina.filter((id) => seleccion.has(id)).length;
  const todas = idsPagina.length > 0 && marcadas === idsPagina.length;

  useEffect(() => {
    if (cabeceraRef.current) cabeceraRef.current.indeterminate = marcadas > 0 && !todas;
  }, [marcadas, todas]);

  function alternar(id) {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function alternarTodas() {
    setSeleccion(todas ? new Set() : new Set(idsPagina));
  }

  const seleccionadas = filas.filter((f) => seleccion.has(f.id));
  const productosIds = [...new Set(seleccionadas.map((f) => f.producto_id))];
  const eliminar = eliminarProductos.bind(null, productosIds);

  function confirmarEliminar(e) {
    const n = productosIds.length;
    const msg =
      `¿Eliminar ${n} producto${n === 1 ? "" : "s"} con todas sus variantes ` +
      `(${seleccionadas.length} fila${seleccionadas.length === 1 ? "" : "s"} marcada${seleccionadas.length === 1 ? "" : "s"})? ` +
      `Esta acción no se puede deshacer.`;
    if (!confirm(msg)) e.preventDefault();
  }

  const nColumnas = Object.keys(columnas).length;
  // Una fila de filtros bajo la cabecera; se envía por GET junto con la búsqueda y el filtro de stock actuales.
  const FORM_COLUMNAS = "filtros-columnas";
  const corto = { width: "100%", minWidth: 0, padding: "4px 6px", fontSize: ".8rem" };
  const rango = { width: "50%", minWidth: 0, padding: "4px 6px", fontSize: ".8rem" };
  const texto = (k, ph) => <input form={FORM_COLUMNAS} type="search" name={`c_${k}`} defaultValue={columnas[k] || ""} placeholder={ph} aria-label={`Filtrar por ${ph}`} style={corto} />;
  const lista = (k, ph, opciones) => (
    <select form={FORM_COLUMNAS} name={`c_${k}`} defaultValue={columnas[k] || ""} aria-label={`Filtrar por ${ph}`} style={corto} onChange={(e) => e.currentTarget.form.requestSubmit()}>
      <option value="">{ph}</option>
      {opciones.map(([v, e]) => <option key={v} value={v}>{e}</option>)}
    </select>
  );
  const desdeHasta = (k, paso) => (
    <div style={{ display: "flex", gap: 4 }}>
      <input form={FORM_COLUMNAS} type="number" step={paso} min="0" name={`c_${k}_d`} defaultValue={columnas[`${k}_d`] || ""} placeholder="Desde" aria-label={`${k} desde`} style={rango} />
      <input form={FORM_COLUMNAS} type="number" step={paso} min="0" name={`c_${k}_h`} defaultValue={columnas[`${k}_h`] || ""} placeholder="Hasta" aria-label={`${k} hasta`} style={rango} />
    </div>
  );

  const cerrarMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  return (
    <div className="form-grid">
      <div className="admin-barra">
        {nColumnas > 0 && (
          <Link href={hrefLimpiarColumnas} className="chip-filtro" title="Quitar los filtros de columna">
            {nColumnas} filtro{nColumnas === 1 ? "" : "s"} de columna <IconoCerrar size={14} />
          </Link>
        )}

        {alertas > 0 && columnas.stock !== "alertas" && (
          <Link
            href={hrefAlertas}
            className="btn-campana"
            title={`${alertas} variante(s) en alerta de stock (ver niveles en Configuración → Inventario)`}
            aria-label={`${alertas} variantes en alerta de stock`}
          >
            <IconoCampana size={20} />
            <span className="badge-campana">{alertas}</span>
          </Link>
        )}

        <div className="admin-barra-der">
          <form action={eliminar} onSubmit={confirmarEliminar}>
            <button type="submit" className="btn-ico-texto peligro" disabled={seleccion.size === 0}>
              <IconoPapelera /> Eliminar{seleccion.size > 0 ? ` (${seleccion.size})` : ""}
            </button>
          </form>

          <form method="post" action="/admin/exportar" onSubmit={cerrarMenu}>
            <input type="hidden" name="ids" value={[...seleccion].join(",")} />
            {Object.entries(columnas).map(([k, v]) => <input key={k} type="hidden" name={`c_${k}`} value={v} />)}
            <details className="admin-menu" ref={menuRef}>
              <summary className="btn-ico-texto">
                <IconoExportar /> Exportar
              </summary>
              <div className="admin-menu-lista">
                <button type="submit" name="alcance" value="seleccion" disabled={seleccion.size === 0}>
                  Seleccionados ({seleccion.size})
                </button>
                <button type="submit" name="alcance" value="filtrados">
                  Resultados filtrados ({total})
                </button>
                <button type="submit" name="alcance" value="todo">
                  Todo el catálogo
                </button>
              </div>
            </details>
          </form>

          {hayPendientes && (
            <button
              type="button"
              className="btn-ico-texto"
              disabled={actualizando}
              onClick={() => iniciarActualizar(() => actualizarEstadoSaga())}
              title="Consulta a SAGA si los productos pendientes ya fueron publicados"
            >
              {actualizando ? "Consultando…" : "Actualizar estado SAGA"}
            </button>
          )}
          {hayErrores && (
            <Link href="/admin/integraciones/saga" className="btn-ico-texto" title="Ver y reintentar los errores de sincronización">
              Ver errores de SAGA
            </Link>
          )}
          <button
            type="button"
            className={importando ? "btn-ico-texto activo" : "btn-ico-texto"}
            onClick={() => setImportando((v) => !v)}
            aria-expanded={importando}
          >
            <IconoImportar /> Importar CSV
          </button>
          <Link href={hrefNuevo} className="btn-ico-texto primario">
            <IconoMas /> Agregar producto
          </Link>
        </div>
      </div>

      {importando && (
        <div className="admin-panel-importar">
          <form method="post" action="/admin/exportar" style={{ marginBottom: 12 }}>
            <button type="submit" name="alcance" value="plantilla" className="btn-ico-texto">
              <IconoPlantilla /> Descargar plantilla CSV
            </button>
          </form>
          <ImportarCsvForm />
        </div>
      )}

      <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-tabla">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  ref={cabeceraRef}
                  type="checkbox"
                  checked={todas}
                  onChange={alternarTodas}
                  aria-label="Seleccionar todas las filas de la página"
                />
              </th>
              <th></th>
              <th>Producto</th>
              <th>Variante</th>
              <th>SKU</th>
              <th>Marca</th>
              <th>Sistemas</th>
              <th>Stock</th>
              <th>Mín.</th>
              <th>Precio</th>
              <th></th>
            </tr>
            <tr className="fila-filtros">
              <th colSpan={2}>
                <form id={FORM_COLUMNAS} method="get" action="/admin" style={{ display: "none" }}>
                </form>
                <button type="submit" form={FORM_COLUMNAS} className="btn-ico" title="Aplicar filtros de columna" aria-label="Aplicar filtros de columna">
                  <IconoFiltro size={16} />
                </button>
              </th>
              <th>{texto("producto", "Producto")}</th>
              <th>{texto("variante", "Variante")}</th>
              <th>{texto("sku", "SKU")}</th>
              <th>{lista("marca", "Todas", marcas.map((m) => [m, m]))}</th>
              <th>
                {lista("sistema", "Todos", [["sin", "Sin SAGA"], ["publicado", "Publicado"], ["pendiente", "Pendiente"], ["error", "Con error"], ["vinculado", "Vinculado"]])}
                {cuentas.length > 1 && lista("cuenta", "Cuenta", cuentas.map((c) => [c, c]))}
              </th>
              <th>{lista("stock", "Todos", [["alertas", "En alerta"], ...NIVELES.map((n) => [n.id, n.nombre])])}</th>
              <th>{desdeHasta("min", "1")}</th>
              <th>{desdeHasta("precio", "0.01")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((v) => {
              const controlada = v.stock_actual !== null;
              const nivel = nivelDe(v, configStock);
              const marcada = seleccion.has(v.id);
              return (
                <FilaProducto
                  key={v.id}
                  v={v}
                  controlada={controlada}
                  nivel={nivel}
                  marcada={marcada}
                  abierta={moviendo === v.id}
                  onAlternar={() => alternar(v.id)}
                  onMover={() => setMoviendo((m) => (m === v.id ? null : v.id))}
                />
              );
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
                  No hay productos que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaProducto({ v, controlada, nivel, marcada, abierta, onAlternar, onMover }) {
  return (
    <>
      <tr className={marcada ? "fila-marcada" : undefined}>
        <td>
          <input
            type="checkbox"
            checked={marcada}
            onChange={onAlternar}
            aria-label={`Seleccionar ${v.producto} ${v.variante}`}
          />
        </td>
        <td>
          {v.imagen ? <img src={v.imagen} alt="" className="admin-miniatura" /> : <div className="admin-miniatura" />}
        </td>
        <td className="celda-producto">{v.producto}</td>
        <td>
          {v.variante}
          {!v.activo && (
            <>
              {" "}
              <span className="pill">Inactiva</span>
            </>
          )}
        </td>
        <td>{v.sku || vacio}</td>
        <td>
          {v.marca}
          {v.pestana && v.pestana !== v.marca ? <small style={{ color: "var(--gris)" }}> → {v.pestana}</small> : null}
        </td>
        <td>
          {(v.sync || []).length === 0
            ? vacio
            : v.sync.map((x) => (
                <span
                  key={x.cuenta}
                  title={x.error || `SAGA (${x.cuenta}): ${x.estado}${x.origen === "vinculado" ? ` · vinculado (${x.accion || "vincular"})` : ""}`}
                  style={{
                    display: "inline-block",
                    padding: "1px 8px",
                    marginRight: 4,
                    borderRadius: 10,
                    fontSize: ".75rem",
                    color: "#fff",
                    background:
                      x.estado === "publicado" ? "#2e7d32" : x.estado === "error" ? "#c62828" : "#ef8f00",
                  }}
                >
                  SAGA{v.sync.length > 1 || x.cuenta !== "principal" ? ` · ${x.cuenta}` : ""}{x.origen === "vinculado" ? " · vinculado" : ""}
                </span>
              ))}
        </td>
        <td>
          {controlada && <strong>{v.stock_actual} </strong>}
          <span className="pill" style={{ background: INFO_NIVEL[nivel].color, color: "#fff" }}>{INFO_NIVEL[nivel].nombre}</span>
        </td>
        <td>{controlada ? v.stock_minimo : vacio}</td>
        <td>{precio(v)}</td>
        <td>
          <div className="acciones-fila">
            <button
              type="button"
              className={abierta ? "btn-ico activo" : "btn-ico"}
              onClick={onMover}
              aria-expanded={abierta}
              title="Registrar movimiento de stock"
              aria-label="Registrar movimiento de stock"
            >
              <IconoStock />
            </button>
            <Link href={v.hrefHistorial} className="btn-ico" title="Ver historial" aria-label="Ver historial">
              <IconoHistorial />
            </Link>
            <Link
              href={`/admin/productos/${v.producto_id}`}
              className="btn-ico"
              title="Editar producto"
              aria-label="Editar producto"
            >
              <IconoEditar />
            </Link>
          </div>
        </td>
      </tr>
      {abierta && (
        <tr className={marcada ? "fila-marcada" : undefined}>
          <td colSpan={11}>
            <MovimientoForm varianteId={v.id} />
          </td>
        </tr>
      )}
    </>
  );
}
