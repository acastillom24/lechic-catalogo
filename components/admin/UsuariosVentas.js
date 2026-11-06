"use client";

import { useActionState } from "react";
import {
  crearUsuarioVentasAccion,
  cambiarPasswordVentasAccion,
  eliminarUsuarioVentasAccion,
} from "../../app/(admin)/admin/actions";
import { IconoMas, IconoLlave, IconoPapelera, IconoUsuario } from "./Iconos";

/** Cambio de contraseña de un usuario (campo + botón de llave). */
function CambiarPassword({ id }) {
  const [estado, accion, enviando] = useActionState(cambiarPasswordVentasAccion.bind(null, id), {});
  return (
    <form action={accion} key={estado?.n || "nuevo"} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input
        name="password"
        type="password"
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

/** Alta, cambio de contraseña y baja de usuarios que pueden ingresar a /sales. */
export default function UsuariosVentas({ usuarios }) {
  const [estado, accion, enviando] = useActionState(crearUsuarioVentasAccion, {});

  return (
    <section className="admin-card form-grid">
      <h2>Usuarios del panel de ventas (/sales)</h2>

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
            <input id="nuevo-password" name="password" type="password" required minLength={6} autoComplete="new-password" />
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
              <td colSpan={4} style={{ textAlign: "center", color: "var(--gris)" }}>
                Aún no hay usuarios.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
