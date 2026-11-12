"use client";

import { useState } from "react";
import { ATRIBUTOS, GRUPOS } from "../../lib/saga-atributos";

const BASE = ["vincular", "vincular_tecnicos", "vincular_todo", "actualizar"];

const slug = (t) =>
  String(t)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

/**
 * Matriz atributos × acciones: con un click se elige qué atributos sincroniza cada acción de
 * vinculación/actualización sobre un SKU que ya existe en SAGA. Se pueden agregar acciones propias.
 * El resultado viaja en el campo oculto `accionesJson` y se guarda con el botón de la pestaña.
 */
export default function AccionesSaga({ acciones }) {
  const [lista, setLista] = useState(() => acciones.map((a) => ({ ...a, atributos: [...a.atributos] })));
  const [nuevo, setNuevo] = useState("");

  const alternar = (id, atributo) =>
    setLista((prev) =>
      prev.map((a) =>
        a.id !== id
          ? a
          : { ...a, atributos: a.atributos.includes(atributo) ? a.atributos.filter((x) => x !== atributo) : [...a.atributos, atributo] }
      )
    );
  const renombrar = (id, nombre) => setLista((prev) => prev.map((a) => (a.id === id ? { ...a, nombre } : a)));
  const quitar = (id) => setLista((prev) => prev.filter((a) => a.id !== id));

  function agregar() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    let id = slug(nombre) || "accion";
    if (BASE.includes(id) || lista.some((a) => a.id === id)) id = `${id}_${lista.length + 1}`;
    setLista((prev) => [...prev, { id, nombre, atributos: ["stock"] }]);
    setNuevo("");
  }

  return (
    <details className="admin-card saga-seccion pf-sub">
      <summary>Acciones de vinculación</summary>
      <div className="saga-cuerpo form-grid">
      <small style={{ color: "var(--gris)" }}>
        Cada acción, al elegirla en una variante, comprueba que el SKU ya exista en SAGA y en cada guardado envía
        <strong> solo los atributos marcados</strong> que tengan valor (los vacíos no borran nada). Las cuatro primeras no se
        pueden borrar; puedes cambiar sus atributos o crear acciones propias. «Crear» siempre envía todo y solo si el SKU no existe.
      </small>
      <input type="hidden" name="accionesJson" value={JSON.stringify(lista)} />

      <div style={{ overflowX: "auto" }}>
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>Atributo</th>
              {lista.map((a) => (
                <th key={a.id} style={{ minWidth: 130, verticalAlign: "bottom" }}>
                  <input
                    value={a.nombre}
                    maxLength={60}
                    onChange={(e) => renombrar(a.id, e.target.value)}
                    aria-label={`Nombre de la acción ${a.id}`}
                    style={{ width: "100%", fontWeight: 600 }}
                  />
                  {!BASE.includes(a.id) && (
                    <button type="button" className="btn-ico-texto" onClick={() => quitar(a.id)} style={{ marginTop: 4 }}>
                      Quitar
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRUPOS.map((grupo) => [
              <tr key={`g-${grupo}`}>
                <td colSpan={lista.length + 1} style={{ background: "var(--fondo-suave, #faf6f4)", fontWeight: 700 }}>
                  {grupo}
                </td>
              </tr>,
              ...ATRIBUTOS.filter((x) => x.grupo === grupo).map((x) => (
                <tr key={x.id}>
                  <td>
                    {x.etiqueta}
                    {(x.aviso || x.detalle) && (
                      <>
                        <br />
                        <small style={{ color: x.aviso ? "#8a5a00" : "var(--gris)" }}>{x.aviso || x.detalle}</small>
                      </>
                    )}
                  </td>
                  {lista.map((a) => (
                    <td key={a.id} style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={a.atributos.includes(x.id)}
                        onChange={() => alternar(a.id, x.id)}
                        aria-label={`${x.etiqueta} en ${a.nombre}`}
                      />
                    </td>
                  ))}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={nuevo}
          maxLength={60}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
          placeholder="Nombre de la nueva acción"
        />
        <button type="button" className="btn-ico-texto" onClick={agregar}>
          + Agregar acción
        </button>
      </div>
    </div>
    </details>
  );
}
