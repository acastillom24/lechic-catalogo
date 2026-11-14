"use client";

import { useState } from "react";
import UsuariosVentas from "./UsuariosVentas";
import Colaboradores from "./Colaboradores";

/** Configuración → Equipo: un solo panel con pestañas (Usuarios de operaciones, Colaboradores). Cada uno conserva sus propios formularios. */
export default function EquipoPanel({ usuarios, permisos, colaboradores }) {
  const [vista, setVista] = useState("usuarios");
  const TABS = [
    { id: "usuarios", nombre: "Usuarios de operaciones", n: usuarios.length, icono: "usuarios" },
    { id: "colaboradores", nombre: "Colaboradores", n: colaboradores.length, icono: "colaboradores" },
  ];
  return (
    <div className="form-grid cg admin-card">
      <div className="pf-pestanas" role="tablist" aria-label="Equipo">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === vista} className="pf-pestana" onClick={() => setVista(t.id)}>
            <Icono id={t.icono} />
            {t.nombre}
            <span className="pf-pestana-n">{t.n}</span>
          </button>
        ))}
      </div>
      <div hidden={vista !== "usuarios"} className="form-grid">
        <UsuariosVentas usuarios={usuarios} permisos={permisos} />
      </div>
      <div hidden={vista !== "colaboradores"} className="form-grid">
        <Colaboradores colaboradores={colaboradores} />
      </div>
    </div>
  );
}

function Icono({ id }) {
  const trazos = {
    usuarios: <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM4 20a8 8 0 0 1 16 0" />,
    colaboradores: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1a2.5 2.5 0 1 0 0-5M3 19a6 6 0 0 1 12 0M16 14a5 5 0 0 1 5 5" />,
  };
  return (
    <svg className="pf-pestana-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {trazos[id]}
    </svg>
  );
}
