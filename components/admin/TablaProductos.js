"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { eliminarProductos, actualizarEstadoSaga } from "../../app/(admin)/admin/actions";
import { NIVELES, nivelDe } from "../../lib/stock-niveles";
import ImportarCsvForm from "./ImportarCsvForm";
import DialogoEliminar from "./DialogoEliminar";
import MovimientoForm from "./MovimientoForm";
import FiltroColumna from "./FiltroColumna";
import {
  IconoPapelera,
  IconoExportar,
  IconoImportar,
  IconoMas,
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
  const menuImportar = useRef(null);
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
  const [dialogoEliminar, setDialogoEliminar] = useState(false);
  const [eliminando, empezarEliminar] = useTransition();
  const tituloEliminar = `Eliminar ${productosIds.length} producto${productosIds.length === 1 ? "" : "s"} con todas sus variantes (${seleccionadas.length} fila${seleccionadas.length === 1 ? "" : "s"} marcada${seleccionadas.length === 1 ? "" : "s"})`;

  // Filtros por columna (como en Ventas): icono en el encabezado, ventanita con las opciones de esa columna.
  const hrefSin = (claves) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(columnas)) if (!claves.includes(k)) u.set(`c_${k}`, v);
    const t = u.toString();
    return t ? `/admin?${t}` : "/admin";
  };
  const ocultosSin = (claves) => Object.fromEntries(Object.entries(columnas).filter(([k]) => !claves.includes(k)).map(([k, v]) => [`c_${k}`, v]));
  const lista = (arr) => arr.map(([valor, texto]) => ({ valor, texto }));
  const col = (etiqueta, claves, campos) => (
    <FiltroColumna
      etiqueta={etiqueta}
      activo={claves.some((k) => columnas[k])}
      campos={campos.map((c) => ({ ...c, name: `c_${c.name}`, valor: columnas[c.name] }))}
      ocultos={ocultosSin(claves)}
      hrefLimpiar={hrefSin(claves)}
      accion="/admin"
    />
  );
  const NOMBRE_STOCK = Object.fromEntries([["alertas", "En alerta"], ...NIVELES.map((n) => [n.id, n.nombre])]);
  const NOMBRE_SISTEMA = { sin: "Sin SAGA", publicado: "Publicado", pendiente: "Pendiente", error: "Con error", vinculado: "Vinculado" };
  const rango = (d, h, prefijo) => (columnas[d] || columnas[h] ? `${prefijo}${columnas[d] ? ` desde ${columnas[d]}` : ""}${columnas[h] ? ` hasta ${columnas[h]}` : ""}` : null);
  // Etiquetas de los filtros activos, cada una con su ✕.
  const chips = [
    columnas.producto && { texto: `Producto: ${columnas.producto}`, href: hrefSin(["producto"]) },
    columnas.variante && { texto: `Variante: ${columnas.variante}`, href: hrefSin(["variante"]) },
    columnas.sku && { texto: `SKU: ${columnas.sku}`, href: hrefSin(["sku"]) },
    columnas.marca && { texto: `Marca: ${columnas.marca}`, href: hrefSin(["marca"]) },
    columnas.sistema && { texto: NOMBRE_SISTEMA[columnas.sistema] || columnas.sistema, href: hrefSin(["sistema"]) },
    columnas.cuenta && { texto: `Cuenta: ${columnas.cuenta}`, href: hrefSin(["cuenta"]) },
    columnas.stock && { texto: `Stock: ${NOMBRE_STOCK[columnas.stock] || columnas.stock}`, href: hrefSin(["stock"]) },
    rango("min_d", "min_h", "Mínimo") && { texto: rango("min_d", "min_h", "Mínimo"), href: hrefSin(["min_d", "min_h"]) },
    rango("precio_d", "precio_h", "Precio") && { texto: rango("precio_d", "precio_h", "Precio"), href: hrefSin(["precio_d", "precio_h"]) },
  ].filter(Boolean);
  const nFiltros = chips.length;

  const cerrarMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  return (
    <div className="form-grid">
      <div className="admin-barra prod-barra">
        <div className="prod-barra-izq">
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
          {hayErrores && (
            <Link href="/admin/integraciones/saga" className="chip-saga aviso prod-estado" title="Ver y reintentar los errores de sincronización">
              Hay errores con SAGA · Ver
            </Link>
          )}
          {hayPendientes && (
            <button
              type="button"
              className="btn-chico"
              disabled={actualizando}
              onClick={() => iniciarActualizar(() => actualizarEstadoSaga())}
              title="Consulta a SAGA si los productos pendientes ya fueron publicados"
            >
              {actualizando ? "Consultando…" : "Actualizar estado SAGA"}
            </button>
          )}
        </div>

        <div className="admin-barra-der">
          <details className="admin-menu" ref={menuImportar}>
            <summary className="btn-ico-texto">
              <IconoImportar /> Importar
            </summary>
            <div className="admin-menu-lista">
              <button type="button" onClick={() => { setImportando(true); menuImportar.current?.removeAttribute("open"); }}>
                Subir un archivo CSV…
              </button>
              <form method="post" action="/admin/exportar">
                <button type="submit" name="alcance" value="plantilla">
                  Descargar la plantilla CSV
                </button>
              </form>
            </div>
          </details>

          <form method="post" action="/admin/exportar" onSubmit={cerrarMenu}>
            <input type="hidden" name="ids" value={[...seleccion].join(",")} />
            {Object.entries(columnas).map(([k, v]) => <input key={k} type="hidden" name={`c_${k}`} value={v} />)}
            <details className="admin-menu" ref={menuRef}>
              <summary className="btn-ico-texto">
                <IconoExportar /> Exportar
              </summary>
              <div className="admin-menu-lista">
                <button type="submit" name="alcance" value="filtrados">
                  {nFiltros ? `Resultados filtrados (${total})` : `Todos los productos (${total})`}
                </button>
                {nFiltros > 0 && (
                  <button type="submit" name="alcance" value="todo">
                    Todo el catálogo
                  </button>
                )}
              </div>
            </details>
          </form>

          <Link href={hrefNuevo} className="btn-ico-texto primario">
            <IconoMas /> Agregar producto
          </Link>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="chips-periodo">
          {chips.map((c) => (
            <Link key={c.texto} href={c.href} className="chip-filtro" title="Quitar filtro">
              {c.texto} <IconoCerrar size={14} />
            </Link>
          ))}
          {chips.length > 1 && (
            <Link href={hrefLimpiarColumnas} className="chip-limpiar">
              Quitar todos
            </Link>
          )}
        </div>
      )}

      {seleccion.size > 0 && (
        <div className="barra-seleccion" role="region" aria-label="Acciones sobre la selección">
          <strong>
            {seleccion.size} fila{seleccion.size === 1 ? "" : "s"} seleccionada{seleccion.size === 1 ? "" : "s"}
          </strong>
          <form method="post" action="/admin/exportar">
            <input type="hidden" name="ids" value={[...seleccion].join(",")} />
            <button type="submit" name="alcance" value="seleccion" className="btn-chico">
              <IconoExportar size={14} /> Exportar selección
            </button>
          </form>
          <button type="button" className="btn-chico peligro" onClick={() => setDialogoEliminar(true)}>
            <IconoPapelera size={14} /> Eliminar
          </button>
          <button type="button" className="btn-chico fantasma" onClick={() => setSeleccion(new Set())}>
            Quitar selección
          </button>
        </div>
      )}
      <DialogoEliminar
        abierto={dialogoEliminar}
        onCerrar={() => setDialogoEliminar(false)}
        titulo={tituloEliminar}
        pendiente={eliminando}
        onConfirmar={(alcance) => empezarEliminar(async () => { await eliminarProductos(productosIds, alcance); })}
      />

      {importando && (
        <div className="admin-panel-importar">
          <div className="admin-titulo-fila" style={{ marginBottom: 8 }}>
            <strong>Importar productos desde CSV</strong>
            <button type="button" className="btn-ico" onClick={() => setImportando(false)} aria-label="Cerrar la importación">
              <IconoCerrar />
            </button>
          </div>
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
              <th>{col("Producto", ["producto"], [{ tipo: "texto", name: "producto", placeholder: "Nombre del producto" }])}</th>
              <th>{col("Variante", ["variante"], [{ tipo: "texto", name: "variante", placeholder: "Nombre de la variante" }])}</th>
              <th>{col("SKU", ["sku"], [{ tipo: "texto", name: "sku", placeholder: "Código SKU" }])}</th>
              <th>{col("Marca", ["marca"], [{ tipo: "select", name: "marca", opciones: lista(marcas.map((m) => [m, m])) }])}</th>
              <th>
                {col("Sistemas", ["sistema", "cuenta"], [
                  { tipo: "select", name: "sistema", etiqueta: "Estado en SAGA", opciones: lista(Object.entries(NOMBRE_SISTEMA)) },
                  ...(cuentas.length > 1 ? [{ tipo: "select", name: "cuenta", etiqueta: "Cuenta", opciones: lista(cuentas.map((c) => [c, c])) }] : []),
                ])}
              </th>
              <th>{col("Stock", ["stock"], [{ tipo: "select", name: "stock", opciones: lista(Object.entries(NOMBRE_STOCK)) }])}</th>
              <th>
                {col("Mín.", ["min_d", "min_h"], [
                  { tipo: "numero", name: "min_d", etiqueta: "Desde" },
                  { tipo: "numero", name: "min_h", etiqueta: "Hasta" },
                ])}
              </th>
              <th>
                {col("Precio", ["precio_d", "precio_h"], [
                  { tipo: "numero", name: "precio_d", etiqueta: "Desde (S/)" },
                  { tipo: "numero", name: "precio_h", etiqueta: "Hasta (S/)" },
                ])}
              </th>
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
