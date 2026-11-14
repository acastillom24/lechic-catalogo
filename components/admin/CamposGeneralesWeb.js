"use client";

import { useState } from "react";
import { CAMPOS_WEB, PANELES, LISTA_DE_CAMPO } from "../../lib/campos-web";
import RequisitosCampo from "./RequisitosCampo";

const ETIQUETA_TIPO = { multi: "varias opciones", lista: "una opción", texto: "texto", numero: "número", fecha: "fecha" };

/**
 * Integraciones → Web → Campos generales: UN solo apartado, con la estructura de SAGA (pestañas Producto y garantía, Atributos y
 * Variantes; bloques con sus campos en orden). Son los campos propios de la web que valen para TODAS las categorías. Aquí solo se
 * ven y se renombran (✎); con qué campo de cada plataforma se corresponden se define en Integraciones → SAGA.
 * El estado vive en IntegracionWeb (`etiquetas` = { campoWeb: nombre }); se guarda con «Guardar».
 */
export default function CamposGeneralesWeb({ etiquetas, setEtiquetas, requisitos = {}, setRequisitos, listas = {}, categoriasSaga = [], filasPropias = () => [], onAgregar, cuentaPropias = () => 0 }) {
  const [editando, setEditando] = useState(() => new Set());
  const [pestana, setPestana] = useState(PANELES[0].id);
  // «Mostrar solo atributos obligatorios y que aumentan la calidad del contenido», por bloque (marcada, como en SAGA).
  const [soloObl, setSoloObl] = useState(() => Object.fromEntries(PANELES.flatMap((p) => p.bloques.filter((b) => b.soloObligatorios).map((b) => [b.id, true]))));
  const abrir = (id, v) =>
    setEditando((p) => {
      const sig = new Set(p);
      if (v) sig.add(id); else sig.delete(id);
      return sig;
    });
  const etiqueta = (def) => etiquetas[def.id] || def.etiqueta;

  const fila = (def) => {
    const abierto = editando.has(def.id);
    const filas = [
      <tr key={def.id} className="pf-eq-propio">
        <td>
          {etiqueta(def)}{def.obligatorioSaga ? " *" : ""}
          {etiqueta(def) !== def.etiqueta && <small style={{ marginLeft: 6, color: "var(--gris)" }}>(antes: {def.etiqueta})</small>}
        </td>
        <td>{ETIQUETA_TIPO[def.tipo] || def.tipo}</td>
        <td className="cg-acc">
          {abierto ? (
            <button type="button" className="btn-admin" onClick={() => abrir(def.id, false)} title="Listo (los cambios se guardan con el botón Guardar)">✓ Listo</button>
          ) : (
            <button type="button" className="btn-admin cg-ico" onClick={() => abrir(def.id, true)} aria-label={`Editar «${etiqueta(def)}»`} title="Cambiar el nombre">
              ✎
            </button>
          )}
        </td>
      </tr>,
    ];
    if (abierto) {
      filas.push(
        <tr key={`${def.id}-ed`} className="pf-eq-propio-extra">
          <td colSpan={3}>
            <div className="form-grid">
            <div className="campo">
              <label>Nombre en la web <em>se muestra en el formulario y en la configuración</em></label>
              <input
                value={etiquetas[def.id] ?? def.etiqueta}
                maxLength={60}
                onChange={(e) => setEtiquetas((p) => ({ ...p, [def.id]: e.target.value }))}
                onBlur={(e) => { if (!e.target.value.trim()) setEtiquetas((p) => { const n = { ...p }; delete n[def.id]; return n; }); }}
                aria-label="Nombre del campo"
                style={{ maxWidth: 360 }}
              />
            </div>
            {setRequisitos && (
              <RequisitosCampo
                def={def}
                valor={{
                  opciones: requisitos[def.id]?.opciones ?? listas[LISTA_DE_CAMPO[def.id]] ?? [],
                  min: requisitos[def.id]?.min,
                  max: requisitos[def.id]?.max ?? def.max,
                  obligatorio: requisitos[def.id]?.obligatorio,
                }}
                onChange={(c) => setRequisitos((p) => ({ ...p, [def.id]: { ...p[def.id], ...c } }))}
                categoriasSaga={categoriasSaga}
              />
            )}
            </div>
          </td>
        </tr>
      );
    }
    return filas;
  };

  const panel = PANELES.find((p) => p.id === pestana) || PANELES[0];

  return (
    <div className="form-grid cg">
      <div className="pf-pestanas" role="tablist" aria-label="Campos generales">
        {PANELES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`cg-tab-${p.id}`}
            aria-selected={p.id === panel.id}
            aria-controls={`cg-panel-${p.id}`}
            className="pf-pestana"
            onClick={() => setPestana(p.id)}
          >
            <IconoPanel id={p.id} />
            {p.nombre}
            <span className="pf-pestana-n">{p.bloques.reduce((n, b) => n + b.campos.length + cuentaPropias(b.id), 0)}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`cg-panel-${panel.id}`} aria-labelledby={`cg-tab-${panel.id}`} className="form-grid">
        {panel.bloques.map((bloque) => {
          const defs = bloque.campos.map((id) => CAMPOS_WEB.find((c) => c.id === id)).filter(Boolean);
          const visibles = bloque.soloObligatorios && soloObl[bloque.id] ? defs.filter((d) => d.obligatorioSaga) : defs;
          return (
            <div key={bloque.id} className="pf-panel-bloque">
              <strong>{bloque.nombre}</strong>
              {bloque.soloObligatorios && (
                <label className="campo-check">
                  <input type="checkbox" checked={Boolean(soloObl[bloque.id])} onChange={(e) => setSoloObl((p) => ({ ...p, [bloque.id]: e.target.checked }))} />
                  Mostrar solo atributos obligatorios y que aumentan la calidad del contenido
                </label>
              )}
              <div className="admin-tabla-wrap">
                <table className="admin-tabla pf-eq-tabla-web cg-tabla-gen">
                  <thead>
                    <tr>
                      <th>Campo</th>
                      <th>Tipo</th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.flatMap((def) => fila(def))}
                    {!(bloque.soloObligatorios && soloObl[bloque.id]) && filasPropias(bloque.id)}
                  </tbody>
                </table>
              </div>
              {onAgregar && bloque.id !== "variacion" && (
                <div>
                  <button type="button" className="btn-admin cg-mas" title={`Crea un atributo en «${bloque.nombre}» que vale para todas las categorías`} onClick={() => { setSoloObl((p) => ({ ...p, [bloque.id]: false })); onAgregar(bloque.id); }}>+ Agregar atributo</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Iconos de línea de las pestañas (heredan el color del texto). */
function IconoPanel({ id }) {
  const trazos = {
    producto: <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm0 0L12 12m9-4.5L12 12m0 9v-9" />,
    atributos: <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />,
    variantes: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />,
  };
  return (
    <svg className="pf-pestana-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {trazos[id] || trazos.atributos}
    </svg>
  );
}
