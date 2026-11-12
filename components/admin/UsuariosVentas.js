"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  crearUsuarioVentasAccion,
  cambiarPasswordVentasAccion,
  eliminarUsuarioVentasAccion,
  guardarPermisosVentasAccion,
} from "../../app/(admin)/admin/actions";
import { IconoMas, IconoLlave, IconoPapelera, IconoUsuario } from "./Iconos";
import PasswordInput from "../PasswordInput";

/** Cambio de contraseña de un usuario (campo + botón de llave). */
function CambiarPassword({ id }) {
  const [estado, accion, enviando] = useActionState(cambiarPasswordVentasAccion.bind(null, id), {});
  return (
    <form action={accion} key={estado?.n || "nuevo"} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <PasswordInput
        name="password"
        required
        minLength={6}
        placeholder="Nueva contraseña"
        autoComplete="new-password"
        aria-label="Nueva contraseña"
        style={{
          height: 34,
          padding: "0 10px",
          border: "1px solid var(--linea)",
          borderRadius: 8,
          fontFamily: "var(--sans)",
          fontSize: "0.85rem",
        }}
      />
      <button className="btn-ico" disabled={enviando} title="Cambiar contraseña" aria-label="Cambiar contraseña">
        <IconoLlave />
      </button>
      {estado?.ok && <span style={{ color: "#2e7d32", fontSize: 13 }}>{estado.ok}</span>}
      {estado?.error && <span style={{ color: "#c0392b", fontSize: 13 }}>{estado.error}</span>}
    </form>
  );
}

// Mismos ids que lib/ventas-permisos.js (ese módulo es solo de servidor).
const PERMISOS = [
  ["ventas", "Ventas"],
  ["productos", "Productos"],
  ["integraciones", "Integraciones"],
  ["sistemas", "Columna Sistemas"],
  ["sincronizados", "Sincronizados (SAGA)"],
];

/** Vistas de /operaciones que puede ver un usuario, en un desplegable: se marcan y luego se guardan; lo desmarcado se oculta y se bloquea. */
function PermisosUsuario({ id, permisos }) {
  const [estado, accion, enviando] = useActionState(guardarPermisosVentasAccion.bind(null, id), {});
  const menuRef = useRef(null);
  const activas = PERMISOS.filter(([k]) => permisos[k]).length;

  // Al guardar con éxito se cierra el desplegable.
  useEffect(() => {
    if (estado?.ok && menuRef.current) menuRef.current.open = false;
  }, [estado?.n, estado?.ok]);

  return (
    <details className="admin-menu" ref={menuRef}>
      <summary className="btn-ico-texto" title="Elegir qué ve este usuario en operaciones">
        Vistas ({activas} de {PERMISOS.length}) ▾
      </summary>
      <form action={accion} className="admin-menu-lista" style={{ left: 0, right: "auto", padding: 12, gap: 8 }}>
        {PERMISOS.map(([k, nombre]) => (
          <label key={k} className="campo-check" title={k === "sistemas" ? "Muestra la columna Sistemas en Productos" : k === "sincronizados" ? "Muestra la pestaña Sincronizados en Integraciones → SAGA" : `Pestaña ${nombre}`}>
            <input type="checkbox" name={k} defaultChecked={permisos[k]} /> {nombre}
          </label>
        ))}
        <button type="submit" className="btn-ico-texto primario" disabled={enviando} style={{ justifySelf: "start" }}>
          {enviando ? "Guardando..." : "Guardar"}
        </button>
        {estado?.error && <span style={{ color: "#c0392b", fontSize: 13 }}>{estado.error}</span>}
      </form>
    </details>
  );
}

/** Alta, cambio de contraseña, vistas permitidas y baja de usuarios que pueden ingresar a /operaciones. */
export default function UsuariosVentas({ usuarios, permisos = {} }) {
  const [estado, accion, enviando] = useActionState(crearUsuarioVentasAccion, {});

  return (
    <section className="admin-card form-grid">
      <h2>Usuarios del panel de operaciones (/operaciones)</h2>

      <form action={accion} key={estado?.n || "nuevo"} className="form-grid">
        {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}
        {estado?.error && <div className="mensaje-error">{estado.error}</div>}
        <div className="venta-grid">
          <div className="campo">
            <label htmlFor="nuevo-usuario">Usuario</label>
            <input id="nuevo-usuario" name="usuario" required autoComplete="off" />
          </div>
          <div className="campo">
            <label htmlFor="nuevo-password">Contraseña (mín. 6)</label>
            <PasswordInput id="nuevo-password" name="password" required minLength={6} autoComplete="new-password" />
          </div>
        </div>
        <div>
          <button type="submit" className="btn-ico-texto primario" disabled={enviando}>
            <IconoMas /> {enviando ? "Creando..." : "Agregar usuario"}
          </button>
        </div>
      </form>

      <table className="admin-tabla">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Creado</th>
            <th>Contraseña</th>
            <th>Vistas en operaciones</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td className="celda-producto">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <IconoUsuario size={16} /> {u.usuario}
                </span>
              </td>
              <td>{new Date(u.created_at).toLocaleDateString("es-PE", { timeZone: "America/Lima" })}</td>
              <td>
                <CambiarPassword id={u.id} />
              </td>
              <td>
                <PermisosUsuario id={u.id} permisos={permisos[u.id] || {}} />
              </td>
              <td>
                <div className="acciones-fila">
                  <form
                    action={eliminarUsuarioVentasAccion.bind(null, u.id)}
                    onSubmit={(e) => {
                      if (!confirm(`¿Eliminar al usuario "${u.usuario}"? Perderá el acceso de inmediato.`)) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <button className="btn-ico" title="Eliminar usuario" aria-label={`Eliminar a ${u.usuario}`}>
                      <IconoPapelera />
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
          {usuarios.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", color: "var(--gris)" }}>
                Aún no hay usuarios.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
