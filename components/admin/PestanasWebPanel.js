"use client";

import { useCallback, useState } from "react";
import PestanasConfig from "./PestanasConfig";
import MarcasConfig from "./MarcasConfig";

/**
 * Configuración → Pestañas de la web: un solo panel con pestañas (Categorías, Pestañas, Marcas). Pestañas/categorías y marcas son
 * formularios distintos (cada uno con su botón de guardar), así que la pestaña activa se comparte desde aquí y los dos quedan montados.
 */
export default function PestanasWebPanel({ pestanasCrudas, categorias, marcas, pestanasMarcas }) {
  const [vista, setVista] = useState("pestanas");
  const [conteo, setConteo] = useState({ categorias: categorias.length, pestanas: pestanasCrudas.length, marcas: marcas.length });
  const alContar = useCallback((c) => setConteo((p) => ({ ...p, ...c })), []);
  const TABS = [
    { id: "pestanas", nombre: "Pestañas", n: conteo.pestanas, icono: "pestanas" },
    { id: "categorias", nombre: "Categorías", n: conteo.categorias, icono: "categorias" },
    { id: "marcas", nombre: "Marcas", n: conteo.marcas, icono: "marcas" },
  ];

  return (
    <div className="form-grid cg admin-card">
      <div className="pf-pestanas" role="tablist" aria-label="Pestañas de la web">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === vista} className="pf-pestana" onClick={() => setVista(t.id)}>
            <Icono id={t.icono} />
            {t.nombre}
            <span className="pf-pestana-n">{t.n}</span>
          </button>
        ))}
      </div>
      <PestanasConfig pestanas={pestanasCrudas} categorias={categorias} vista={vista} onConteo={alContar} />
      <MarcasConfig marcas={marcas} pestanas={pestanasMarcas} oculto={vista !== "marcas"} onConteo={alContar} />
    </div>
  );
}

function Icono({ id }) {
  const trazos = {
    pestanas: <path d="M3 8h6l2-3h10v14H3V8Z" />,
    categorias: <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 3.5h7M16.5 13v7" />,
    marcas: <path d="M20 12l-8 8-9-9V4h7l10 8ZM7.5 8.5h.01" />,
  };
  return (
    <svg className="pf-pestana-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {trazos[id]}
    </svg>
  );
}
