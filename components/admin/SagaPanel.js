"use client";

import { useState } from "react";
import { CAMPOS_WEB } from "../../lib/campos-web";
import CuentasSaga from "./CuentasSaga";
import SagaConfig from "./SagaConfig";

/**
 * Integraciones → SAGA: un solo panel con pestañas (Cuentas, Categorías, Campos generales, Marcas, Acciones, Conexión). Las cuentas tienen
 * sus propios formularios, así que quedan FUERA del formulario de configuración (no se anidan); la pestaña activa se comparte con él.
 */
export default function SagaPanel({ cuentas, opciones, categoriasWeb, marcas }) {
  const [pestana, setPestana] = useState("cuentas");
  const PESTANAS = [
    { id: "cuentas", nombre: "Cuentas", n: cuentas.length, icono: "cuentas" },
    { id: "categorias", nombre: "Categorías", n: (opciones.categorias || []).length, icono: "categorias" },
    { id: "generales", nombre: "Campos generales", n: CAMPOS_WEB.filter((c) => c.saga && !c.porSaga).length, icono: "producto" },
    { id: "marcas", nombre: "Marcas", n: marcas.length, icono: "marcas" },
    { id: "acciones", nombre: "Acciones", n: (opciones.acciones || []).length, icono: "variantes" },
    { id: "conexion", nombre: "Conexión", n: null, icono: "conexion" },
  ];

  return (
    <div className="form-grid cg admin-card">
      <div className="pf-pestanas" role="tablist" aria-label="Configuración de SAGA">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.id === pestana} className="pf-pestana" onClick={() => setPestana(p.id)}>
            <IconoSaga id={p.icono} />
            {p.nombre}
            {p.n !== null && <span className="pf-pestana-n">{p.n}</span>}
          </button>
        ))}
      </div>
      <div hidden={pestana !== "cuentas"} className="form-grid">
        <CuentasSaga cuentas={cuentas} opciones={{ urlsBase: opciones.urlsBase, operadores: opciones.operadores }} />
      </div>
      <SagaConfig opciones={opciones} categoriasWeb={categoriasWeb} marcas={marcas} pestana={pestana} />
    </div>
  );
}

/** Iconos de línea de las pestañas. */
function IconoSaga({ id }) {
  const trazos = {
    cuentas: <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM4 20a8 8 0 0 1 16 0" />,
    categorias: <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 3.5h7M16.5 13v7" />,
    producto: <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm0 0L12 12m9-4.5L12 12m0 9v-9" />,
    atributos: <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />,
    variantes: <path d="M5 12l4 4 10-10" />,
    marcas: <path d="M20 12l-8 8-9-9V4h7l10 8ZM7.5 8.5h.01" />,
    conexion: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  };
  return (
    <svg className="pf-pestana-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {trazos[id] || trazos.atributos}
    </svg>
  );
}
