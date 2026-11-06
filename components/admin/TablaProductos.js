"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { eliminarProductos } from "../../app/(admin)/admin/actions";
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
const ETIQUETAS_FILTRO = {
  todas: "Todas",
  alertas: "Stock bajo",
  sin_control: "Sin control de cantidad",
};

export default function TablaProductos({
  filas,
  q,
  filtro,
  total,
  hrefNuevo,
  alertas = 0,
  hrefAlertas,
  hrefSinFiltro,
}) {
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [importando, setImportando] = useState(false);
  const [moviendo, setMoviendo] = useState(null);
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

  const cerrarMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  return (
    <div className="form-grid">
      <div className="admin-barra">
        <form method="get" action="/admin" className="admin-barra-buscar">
          <IconoBuscar size={18} />
          <input type="search" name="q" defaultValue={q} placeholder="Buscar por producto, variante o SKU..." />
          <span className="admin-barra-sep" aria-hidden="true" />
          <label className="admin-filtro" title="Filtrar">
            <IconoFiltro size={16} />
            <select
              name="filtro"
              defaultValue={filtro}
              aria-label="Filtrar"
              onChange={(e) => e.currentTarget.form.requestSubmit()}
            >
              {Object.entries(ETIQUETAS_FILTRO).map(([k, etiqueta]) => (
                <option key={k} value={k}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>
        </form>

        {filtro !== "todas" && (
          <Link href={hrefSinFiltro} className="chip-filtro" title="Quitar filtro">
            {ETIQUETAS_FILTRO[filtro]} <IconoCerrar size={14} />
          </Link>
        )}

        {alertas > 0 && filtro !== "alertas" && (
          <Link
            href={hrefAlertas}
            className="btn-campana"
            title={`${alertas} variante(s) con stock bajo o agotado`}
            aria-label={`${alertas} variantes con stock bajo o agotado`}
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
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="filtro" value={filtro} />
            <details className="admin-menu" ref={menuRef}>
              <summary className="btn-ico-texto">
                <IconoExportar /> Exportar
              </summary>
              <div className="admin-menu-lista">
                <button type="submit" name="alcance" value="seleccion" disabled={seleccion.size === 0}>
                  Seleccionados ({seleccion.size})
                </button>
                <button type="submit" name="alcance" value="filtrados">
                  Resultados de esta búsqueda ({total})
                </button>
                <button type="submit" name="alcance" value="todo">
                  Todo el catálogo
                </button>
              </div>
            </details>
          </form>

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
              <th>Stock</th>
              <th>Mín.</th>
              <th>Precio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((v) => {
              const controlada = v.stock_actual !== null;
              const bajo = controlada && v.stock_actual <= v.stock_minimo;
              const marcada = seleccion.has(v.id);
              return (
                <FilaProducto
                  key={v.id}
                  v={v}
                  controlada={controlada}
                  bajo={bajo}
                  marcada={marcada}
                  abierta={moviendo === v.id}
                  onAlternar={() => alternar(v.id)}
                  onMover={() => setMoviendo((m) => (m === v.id ? null : v.id))}
                />
              );
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
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

function FilaProducto({ v, controlada, bajo, marcada, abierta, onAlternar, onMover }) {
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
        <td>{v.marca}</td>
        <td>
          {controlada ? (
            <strong>
              {v.stock_actual}{" "}
              {Number(v.stock_actual) <= 0 ? (
                <span className="pill agotado">Agotado</span>
              ) : (
                bajo && <span className="pill agotado">Bajo</span>
              )}
            </strong>
          ) : v.stock ? (
            <span style={{ color: "var(--gris)" }}>Disponible (sin control)</span>
          ) : (
            <span className="pill agotado">Agotado</span>
          )}
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
          <td colSpan={10}>
            <MovimientoForm varianteId={v.id} />
          </td>
        </tr>
      )}
    </>
  );
}
