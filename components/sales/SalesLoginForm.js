"use client";

import { useActionState } from "react";
import { iniciarSesionVentas } from "../../app/(sales)/sales/actions";
import PasswordInput from "../PasswordInput";

export default function SalesLoginForm() {
  const [estado, accion, enviando] = useActionState(iniciarSesionVentas, {});

  return (
    <div className="login-envoltorio">
      <div className="login-tarjeta">
        <h1 className="serif">Ventas Le Chic</h1>
        {estado?.error && <div className="mensaje-error">{estado.error}</div>}
        <form action={accion} className="form-grid">
          <div className="campo">
            <label htmlFor="usuario">Usuario</label>
            <input id="usuario" name="usuario" required autoFocus autoComplete="username" />
          </div>
          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <PasswordInput id="password" name="password" required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn-admin solido" disabled={enviando}>
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
