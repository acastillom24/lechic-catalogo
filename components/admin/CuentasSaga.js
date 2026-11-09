"use client";

import { useActionState, useState } from "react";
import { guardarCuentaSaga, eliminarCuentaSaga } from "../../app/(admin)/admin/actions";

// Un solo formulario para agregar y para editar (c = null → cuenta nueva).
// La API key nunca llega al navegador: al editar, dejarla vacía conserva la guardada.
function Formulario({ c, opciones, onCerrar }) {
  const nueva = !c;
  const [estado, accion, enviando] = useActionState(async (prev, fd) => {
    const r = await guardarCuentaSaga(prev, fd);
    if (r?.ok) onCerrar();
    return r;
  }, {});

  // Si la cuenta guarda un valor que ya no está en la lista, se sigue mostrando.
  const conActual = (lista, actual) => (actual && !lista.includes(actual) ? [actual, ...lista] : lista);
  const urls = conActual(opciones.urlsBase, c?.base_url);
  const operadores = conActual(opciones.operadores, c?.operador);

  return (
    <form action={accion} className="form-grid" style={{ borderTop: "1px solid var(--borde, #eee)", paddingTop: 12 }}>
      <h3 style={{ margin: 0 }}>{nueva ? "Agregar cuenta" : `Editar cuenta "${c.alias}"`}</h3>
      {!nueva && <input type="hidden" name="alias_original" value={c.alias} />}
      <div className="campo">
        <label htmlFor="cs-alias">Alias</label>
        <input
          id="cs-alias"
          name="alias"
          defaultValue={c?.alias || ""}
          required
          placeholder="tienda1"
          pattern="[a-z0-9_]{2,30}"
          maxLength={30}
          autoComplete="off"
        />
        <small style={{ color: "var(--gris)" }}>Nombre corto para identificar la cuenta: minúsculas, números o _.</small>
      </div>
      <div className="campo">
        <label htmlFor="cs-nombre">Nombre</label>
        <input id="cs-nombre" name="nombre" defaultValue={c?.nombre || ""} required maxLength={80} placeholder="Tienda 1" />
      </div>
      <div className="campo">
        <label htmlFor="cs-user">Usuario (UserID de Seller Center)</label>
        <input id="cs-user" name="user_id" defaultValue={c?.user_id || ""} required maxLength={150} autoComplete="off" placeholder="correo del usuario API" />
      </div>
      <div className="campo">
        <label htmlFor="cs-key">API key</label>
        <input
          id="cs-key"
          name="api_key"
          type="password"
          required={nueva}
          maxLength={300}
          autoComplete="new-password"
          placeholder={nueva ? "" : c.tiene_key ? "•••••• guardada — déjala vacía para no cambiarla" : "Falta: escríbela"}
        />
      </div>
      <div className="campo">
        <label htmlFor="cs-url">URL base</label>
        <select id="cs-url" name="base_url" defaultValue={c?.base_url || opciones.urlsBase[0]} required>
          {urls.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="cs-op">Código de operador</label>
        <select id="cs-op" name="operador" defaultValue={c?.operador || opciones.operadores[0]} required>
          {operadores.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <small style={{ color: "var(--gris)" }}>Las listas de URL y operador se editan abajo, en "Conexión".</small>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" name="activo" defaultChecked={c ? c.activo : true} /> Activa (aparece al crear/editar productos)
      </label>
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn-ico-texto primario" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className="btn-ico-texto" onClick={onCerrar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Quitar({ alias }) {
  const quitar = eliminarCuentaSaga.bind(null, alias);
  const confirmar = (e) => {
    if (!confirm(`¿Eliminar la cuenta "${alias}"? Se borra su historial de sincronización en la web (no los productos en SAGA).`)) e.preventDefault();
  };
  return (
    <form action={quitar} onSubmit={confirmar} style={{ display: "inline" }}>
      <button type="submit" className="btn-ico-texto">Eliminar</button>
    </form>
  );
}

export default function CuentasSaga({ cuentas = [], opciones }) {
  // null = cerrado · "nueva" = agregar · alias = editando esa cuenta
  const [abierto, setAbierto] = useState(null);
  const cerrar = () => setAbierto(null);
  const editando = cuentas.find((c) => c.alias === abierto);

  return (
    <section className="admin-card form-grid">
      <h2>Cuentas de SAGA</h2>
      {cuentas.length === 0 && <small style={{ color: "var(--gris)" }}>Aún no hay cuentas. Agrega la primera.</small>}

      {cuentas.map((c) => (
        <div key={c.alias} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <div>
            <strong>{c.nombre}</strong> — <code>{c.alias}</code>
            {!c.activo && <small style={{ color: "var(--gris)" }}> (inactiva)</small>}
            <br />
            <small style={{ color: c.tiene_key && c.user_id ? "var(--gris)" : "#b3261e" }}>
              {c.user_id || "sin usuario"} · {c.base_url || "sin URL"} · operador {c.operador || "—"}
              {!c.tiene_key && " · falta la API key"}
            </small>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-ico-texto" onClick={() => setAbierto(c.alias)}>Editar</button>
            <Quitar alias={c.alias} />
          </div>
        </div>
      ))}

      {abierto === null && (
        <div>
          <button type="button" className="btn-ico-texto primario" onClick={() => setAbierto("nueva")}>
            + Agregar cuenta
          </button>
        </div>
      )}
      {abierto === "nueva" && <Formulario key="nueva" c={null} opciones={opciones} onCerrar={cerrar} />}
      {editando && <Formulario key={editando.alias} c={editando} opciones={opciones} onCerrar={cerrar} />}

      <small style={{ color: "var(--gris)" }}>
        La API key se guarda en la base de datos y solo la usa el servidor: nunca se muestra de nuevo.
      </small>
    </section>
  );
}
