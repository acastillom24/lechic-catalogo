"use client";

import { useState } from "react";
import { compatible } from "../../lib/atributos-categoria";
import { CAMPOS_WEB, esLibre } from "../../lib/campos-web";
import { camposDe } from "../../lib/saga-campos";
import { activoEnCategoriaSaga, etiquetaCampo } from "../../lib/equivalencias";

const ETIQUETA_TIPO = { multi: "varias opciones", lista: "una opción", texto: "texto", numero: "número", fecha: "fecha" };

/**
 * Configuración → Integraciones → SAGA, UNA vez por categoría de SAGA (el atributo es único en la web).
 *  1. Campos que SAGA lista en esta categoría y que la web ya trae (Características, Género, Fragancia…): se activan o no aquí.
 *  2. Demás campos de SAGA de la categoría: se elige el atributo de la web que equivale, entre los atributos visibles en cualquiera de
 *     las categorías de la web que usan esta categoría de SAGA. Un atributo ya elegido para otro campo deja de ofrecerse.
 * Una fila con equivalencia se ve bloqueada (🔒) con un ✎ para volver a elegir; sin equivalencia se muestra el selector abierto. Un
 * obligatorio sin equivalente avisa y bloquea el envío. Los campos generales (nombre, precio, modelo…) van aparte, arriba.
 * `webs` = categorías de la web ligadas a esta categoría de SAGA; `enlacesPorWeb` y `atributosPorWeb` van por slug de la web.
 */
export default function EquivalenciasSagaBloque({ cat, webs, campos: camposTodos, equivalencias, enlacesPorWeb, atributosPorWeb }) {
  // Atributos de la web visibles en alguna de las categorías ligadas, con las categorías donde se ven.
  const atributos = [];
  for (const w of webs) {
    for (const a of atributosPorWeb[w.slug] || []) {
      const existente = atributos.find((x) => x.id === a.id);
      if (existente) existente.en.push(w.nombre);
      else atributos.push({ ...a, en: [w.nombre] });
    }
  }
  // Campos de la web que SAGA lista en esta categoría (Características, Género…). Un campo de SAGA con enlace guardado a un atributo
  // propio sigue como fila de atributo, para no perder ese enlace.
  const propiosWeb = CAMPOS_WEB.filter((d) => d.porSaga)
    .map((def) => ({ def, campo: camposDe(cat).find((x) => x.id === def.saga) }))
    .filter((x) => x.campo && !webs.some((w) => enlacesPorWeb[w.slug]?.[x.campo.id]));
  const idsPropios = new Set(propiosWeb.map((x) => x.campo.id));
  const campos = camposTodos.filter((c) => !idsPropios.has(c.id));
  const [gen, setGen] = useState(() => Object.fromEntries(propiosWeb.map(({ def }) => [def.id, activoEnCategoriaSaga(equivalencias, cat, def)])));
  const [sel, setSel] = useState(() => {
    const inicial = {};
    for (const campo of campos) {
      const enlazado = webs.map((w) => enlacesPorWeb[w.slug]?.[campo.id]).find((id) => id && atributos.some((a) => a.id === id));
      inicial[campo.id] = enlazado || "";
    }
    return inicial;
  });
  // Filas en edición (✎): las que ya tienen equivalencia se ven bloqueadas hasta pulsarlo.
  const [editando, setEditando] = useState(() => new Set());
  const abrir = (k, v) =>
    setEditando((p) => {
      const sig = new Set(p);
      if (v) sig.add(k); else sig.delete(k);
      return sig;
    });
  const sinElegir = campos.filter((c) => c.obligatorio && !sel[c.id]);
  const nombres = webs.map((w) => w.nombre).join(", ");

  const botonEditar = (k, texto) => (
    <button type="button" className="btn-admin" onClick={() => abrir(k, true)} aria-label={`Editar el equivalente de ${texto}`} title="Volver a elegir el equivalente">
      ✎
    </button>
  );
  const botonListo = (k) => (
    <button type="button" className="btn-admin" onClick={() => abrir(k, false)} title="Volver a bloquear (se guarda con el botón Guardar)">
      ✓ Listo
    </button>
  );

  return (
    <div className="pf-eq-bloque">
      <input type="hidden" name={`eqMarca_${cat}`} value="1" />
      <strong>SAGA {cat} ↔ Web: {nombres}</strong>

      {sinElegir.length > 0 && (
        <div className="pf-eq-alerta" role="alert">
          ⚠ Obligatorios de SAGA sin atributo de la web: {sinElegir.map((c) => c.etiqueta).join(", ")}. Créalos o muéstralos en Integraciones → Web y elígelos aquí.
        </div>
      )}

      <div className="admin-tabla-wrap">
        <table className="admin-tabla pf-eq-tabla-campos cg-tabla-eq">
          <thead>
            <tr>
              <th>Atributo de SAGA</th>
              <th>Atributo de la web</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {propiosWeb.map(({ def, campo }) => {
              const k = `gen-${def.id}`;
              const fijo = !esLibre(def); // hoy ninguno (la medida del frasco ya se activa por categoría como los demás)
              const activo = fijo || gen[def.id];
              const abierto = editando.has(k) || (!fijo && !activo);
              const nombre = etiquetaCampo(equivalencias, def);
              return (
                <tr key={k}>
                  <td>
                    {campo.etiqueta}
                    <small style={{ display: "block", color: "var(--gris)" }}>
                      {campo.id} · {ETIQUETA_TIPO[campo.tipo] || campo.tipo}
                      {campo.obligatorio ? " · obligatorio" : ""}{campo.nivel === "variante" ? " · por variante" : ""}
                    </small>
                  </td>
                  <td>
                    {!fijo && <input type="hidden" name={`gen_${cat}__${def.id}`} value={gen[def.id] ? "1" : ""} />}
                    {abierto ? (
                      <>
                        {fijo ? (
                          <small style={{ display: "block", color: "var(--gris)" }}>
                            Es la variación de los perfumes: su equivalente es «{nombre}» y no cambia. Para cambiarle el nombre usa ✎ Editar en
                            Integraciones → Web → Atributos por categoría → «Perfil del producto».
                          </small>
                        ) : (
                          <select
                            value={gen[def.id] ? "1" : ""}
                            onChange={(e) => setGen((p) => ({ ...p, [def.id]: e.target.value === "1" }))}
                            aria-label={`Usar ${nombre} en SAGA ${cat}`}
                          >
                            <option value="">— No usar —</option>
                            <option value="1">{nombre} (campo de la web)</option>
                          </select>
                        )}
                      </>
                    ) : (
                      <span className="pf-eq-fija">
                        🔒 {nombre} <small>campo de la web</small>
                      </span>
                    )}
                    {!fijo && campo.obligatorio && !gen[def.id] && (
                      <small style={{ display: "block", color: "#b3261e" }}>
                        ⚠ Obligatorio en SAGA {cat}: sin equivalente, los productos de esta categoría no se podrán enviar.
                      </small>
                    )}
                  </td>
                  <td className="cg-acc">{abierto ? activo && botonListo(k) : botonEditar(k, campo.etiqueta)}</td>
                </tr>
              );
            })}
            {campos.map((campo) => {
              const k = `eq-${campo.id}`;
              const valor = sel[campo.id] || "";
              const usadosPorOtros = new Set(Object.entries(sel).filter(([id, v]) => id !== campo.id && v).map(([, v]) => v));
              // Se ofrecen todos los atributos libres (compatibles primero); los de otro tipo se marcan con aviso.
              const libres = atributos
                .filter((a) => !usadosPorOtros.has(a.id))
                .sort((a, b) => Number(compatible(b, campo)) - Number(compatible(a, campo)));
              const elegido = atributos.find((a) => a.id === valor);
              const incompatible = elegido && !compatible(elegido, campo);
              const faltaEn = elegido ? webs.filter((w) => !elegido.en.includes(w.nombre)).map((w) => w.nombre) : [];
              const abierto = editando.has(k) || !valor;
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
                    <input type="hidden" name={`eq_${cat}__${campo.id}`} value={valor} />
                    {abierto ? (
                      <>
                        <select
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
                      </>
                    ) : (
                      <span className="pf-eq-fija">
                        🔒 {elegido ? elegido.etiqueta : valor}{" "}
                        <small>{elegido ? ETIQUETA_TIPO[elegido.tipo] || elegido.tipo : "atributo no visible"}</small>
                      </span>
                    )}
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
                  <td className="cg-acc">{abierto ? valor && botonListo(k) : botonEditar(k, campo.etiqueta)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
