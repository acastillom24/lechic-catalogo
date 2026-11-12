"use client";

import { useState } from "react";
import { compatible } from "../../lib/atributos-categoria";
import { CAMPOS_WEB } from "../../lib/campos-web";

const ETIQUETA_TIPO = { multi: "varias opciones", lista: "una opción", texto: "texto", numero: "número" };

/**
 * Configuración → Integraciones → SAGA, UNA vez por categoría de SAGA (el atributo es único en la web).
 *  1. Campos generales de la web con su campo de SAGA: bloqueados, no se editan ni se borran desde ninguna pestaña.
 *  2. Campos de SAGA de la categoría: se elige el atributo de la web que equivale, entre los atributos visibles en cualquiera de
 *     las categorías de la web que usan esta categoría de SAGA. Un atributo ya elegido para otro campo deja de ofrecerse. Se puede
 *     cambiar o quitar («No usar»). Los atributos nuevos se crean en Integraciones → Web.
 * `webs` = categorías de la web ligadas a esta categoría de SAGA; `enlacesPorWeb` y `atributosPorWeb` van por slug de la web.
 */
export default function EquivalenciasSagaBloque({ cat, webs, campos, enlacesPorWeb, atributosPorWeb }) {
  const esPerfume = cat === "1735";
  // Atributos de la web visibles en alguna de las categorías ligadas, con las categorías donde se ven.
  const atributos = [];
  for (const w of webs) {
    for (const a of atributosPorWeb[w.slug] || []) {
      const existente = atributos.find((x) => x.id === a.id);
      if (existente) existente.en.push(w.nombre);
      else atributos.push({ ...a, en: [w.nombre] });
    }
  }
  const [sel, setSel] = useState(() => {
    const inicial = {};
    for (const campo of campos) {
      const enlazado = webs.map((w) => enlacesPorWeb[w.slug]?.[campo.id]).find((id) => id && atributos.some((a) => a.id === id));
      inicial[campo.id] = enlazado || "";
    }
    return inicial;
  });
  const generales = CAMPOS_WEB.filter((c) => c.saga && (!c.soloPerfume || esPerfume) && (!c.equivSoloPerfume || esPerfume));
  const sinElegir = campos.filter((c) => c.obligatorio && !sel[c.id]);
  const nombres = webs.map((w) => w.nombre).join(", ");

  return (
    <div className="pf-eq-bloque">
      <input type="hidden" name={`eqMarca_${cat}`} value="1" />
      <strong>SAGA {cat} ↔ Web: {nombres}</strong>

      <details className="saga-seccion pf-sub">
        <summary>
          Campos generales <em>{generales.length} bloqueados</em>
        </summary>
        <div className="saga-cuerpo">
          <div className="admin-tabla-wrap">
            <table className="admin-tabla pf-eq-tabla-campos">
              <thead>
                <tr>
                  <th>Campo de la web</th>
                  <th>Equivale en SAGA</th>
                </tr>
              </thead>
              <tbody>
                {generales.map((def) => (
                  <tr key={def.id}>
                    <td>{def.etiqueta}</td>
                    <td>
                      <span className="pf-eq-fija" title="Campo general: no se puede editar ni borrar">
                        🔒 <code>{def.saga}</code> <small>general</small>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      {sinElegir.length > 0 && (
        <div className="pf-eq-alerta" role="alert">
          ⚠ Obligatorios de SAGA sin atributo de la web: {sinElegir.map((c) => c.etiqueta).join(", ")}. Créalos o muéstralos en Integraciones → Web y elígelos aquí.
        </div>
      )}

      <div className="admin-tabla-wrap">
        <table className="admin-tabla pf-eq-tabla-campos">
          <thead>
            <tr>
              <th>Atributo de SAGA</th>
              <th>Atributo de la web (libres)</th>
            </tr>
          </thead>
          <tbody>
            {campos.map((campo) => {
              const valor = sel[campo.id] || "";
              const usadosPorOtros = new Set(Object.entries(sel).filter(([k, v]) => k !== campo.id && v).map(([, v]) => v));
              // Se ofrecen todos los atributos libres (compatibles primero); los de otro tipo se marcan con aviso.
              const libres = atributos
                .filter((a) => !usadosPorOtros.has(a.id))
                .sort((a, b) => Number(compatible(b, campo)) - Number(compatible(a, campo)));
              const elegido = atributos.find((a) => a.id === valor);
              const incompatible = elegido && !compatible(elegido, campo);
              const faltaEn = elegido ? webs.filter((w) => !elegido.en.includes(w.nombre)).map((w) => w.nombre) : [];
              return (
                <tr key={campo.id} className={campo.obligatorio && !valor ? "pf-eq-falta" : undefined}>
                  <td>
                    {campo.etiqueta}
                    <small style={{ display: "block", color: "var(--gris)" }}>
                      {campo.id} · {ETIQUETA_TIPO[campo.tipo] || campo.tipo}
                      {campo.obligatorio ? " · obligatorio" : ""}{campo.nivel === "variante" ? " · por variante" : ""}
                    </small>
                  </td>
                  <td>
                    <select
                      name={`eq_${cat}__${campo.id}`}
                      value={valor}
                      onChange={(e) => setSel((p) => ({ ...p, [campo.id]: e.target.value }))}
                      aria-label={`Atributo de la web para ${campo.etiqueta}`}
                    >
                      <option value="">— No usar —</option>
                      {libres.map((a) => (
                        <option key={a.id} value={a.id}>
                          {compatible(a, campo) ? "" : "⚠ "}{a.etiqueta} ({ETIQUETA_TIPO[a.tipo] || a.tipo}){a.en.length < webs.length ? ` · solo en ${a.en.join(", ")}` : ""}
                        </option>
                      ))}
                    </select>
                    {incompatible && (
                      <small style={{ display: "block", color: "#b26a00" }}>
                        ⚠ «{elegido.etiqueta}» es de tipo {ETIQUETA_TIPO[elegido.tipo] || elegido.tipo} y este campo de SAGA es {ETIQUETA_TIPO[campo.tipo] || campo.tipo}: se puede guardar, pero los valores que no encajen (p. ej. opciones fuera de la lista de SAGA) no se enviarán.
                      </small>
                    )}
                    {faltaEn.length > 0 && (
                      <small style={{ display: "block", color: "var(--gris)" }}>No está visible en {faltaEn.join(", ")}: ahí no se usará.</small>
                    )}
                    {!valor && libres.length === 0 && (
                      <small style={{ display: "block", color: campo.obligatorio ? "#b3261e" : "var(--gris)" }}>
                        {campo.obligatorio ? "⚠ Obligatorio: " : ""}no hay atributos visibles y libres en las categorías de la web. Es necesario crearlo o mostrarlo en Integraciones → Web.
                      </small>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
