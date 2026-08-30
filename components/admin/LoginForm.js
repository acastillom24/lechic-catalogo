"use client";

import { useActionState } from "react";
import { iniciarSesion } from "../../app/(admin)/admin/actions";

export default function LoginForm({ redirectTo }) {
  const [estado, accion, enviando] = useActionState(iniciarSesion, {});

  return (
    <div className="login-envoltorio">
      <div className="login-tarjeta">
        <h1 className="serif">Panel Le Chic</h1>
        {estado?.error && <div className="mensaje-error">{estado.error}</div>}
        <form action={accion} className="form-grid">
          <input type="hidden" name="redirect" value={redirectTo || "/admin"} />
          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn-admin solido" disabled={enviando}>
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
