"use client";

import { useActionState, useState } from "react";
import { guardarCuentaRipley, eliminarCuentaRipley, probarCuentaRipley } from "../../app/(admin)/admin/actions";

const URL_PREDETERMINADA = "https://ripleyperu-prod.mirakl.net";

// Un solo formulario para agregar y para editar (c = null → cuenta nueva).
// La API key nunca llega al navegador: al editar, dejarla vacía conserva la guardada.
function Formulario({ c, onCerrar }) {
  const nueva = !c;
  const [estado, accion, enviando] = useActionState(async (prev, fd) => {
    const r = await guardarCuentaRipley(prev, fd);
    if (r?.ok) onCerrar();
    return r;
  }, {});

  return (
    <form action={accion} className="form-grid cg-form-cuenta">
      <h3 style={{ margin: 0, fontSize: "0.92rem" }}>{nueva ? "Agregar cuenta" : `Editar cuenta "${c.alias}"`}</h3>
      {!nueva && <input type="hidden" name="alias_original" value={c.alias} />}
      <div className="campo">
        <label htmlFor="cr-alias">Alias</label>
        <input id="cr-alias" name="alias" defaultValue={c?.alias || ""} required placeholder="tienda1" pattern="[a-z0-9_]{2,30}" maxLength={30} autoComplete="off" />
        <small style={{ color: "var(--gris)" }}>Nombre corto para identificar la cuenta: minúsculas, números o _.</small>
      </div>
      <div className="campo">
        <label htmlFor="cr-nombre">Nombre</label>
        <input id="cr-nombre" name="nombre" defaultValue={c?.nombre || ""} required maxLength={80} placeholder="Tienda 1" />
      </div>
      <div className="campo">
        <label htmlFor="cr-url">URL base (instancia Mirakl)</label>
        <input id="cr-url" name="base_url" type="url" defaultValue={c?.base_url || URL_PREDETERMINADA} required maxLength={200} autoComplete="off" />
        <small style={{ color: "var(--gris)" }}>Solo https y dominios mirakl.net.</small>
      </div>
      <div className="campo">
        <label htmlFor="cr-key">API key</label>
        <input
          id="cr-key"
          name="api_key"
          type="password"
          required={nueva}
          maxLength={300}
          autoComplete="new-password"
          placeholder={nueva ? "" : c.tiene_key ? "•••••• guardada — déjala vacía para no cambiarla" : "Falta: escríbela"}
        />
        <small style={{ color: "var(--gris)" }}>Se genera en Mirakl → Mi perfil → API key. Se guarda cifrada.</small>
      </div>
      <div className="campo">
        <label htmlFor="cr-shop">Id de tienda (opcional)</label>
        <input id="cr-shop" name="shop_id" defaultValue={c?.shop_id || ""} maxLength={40} autoComplete="off" />
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" name="activo" defaultChecked={c ? c.activo : true} /> Activa
      </label>
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn-admin solido" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className="btn-admin" onClick={onCerrar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Quitar({ alias }) {
  const quitar = eliminarCuentaRipley.bind(null, alias);
  const confirmar = (e) => {
    if (!confirm(`¿Eliminar la cuenta "${alias}"? No se borra nada en Ripley.`)) e.preventDefault();
  };
  return (
    <form action={quitar} onSubmit={confirmar} style={{ display: "inline", marginLeft: 4 }}>
      <button type="submit" className="btn-admin cg-ico peligro" aria-label={`Eliminar la cuenta ${alias}`} title="Eliminar la cuenta">✕</button>
    </form>
  );
}

function Probar({ alias, deshabilitado }) {
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const probar = async () => {
    setCargando(true);
    setEstado(await probarCuentaRipley(alias));
    setCargando(false);
  };
  return (
    <>
      <button type="button" className="btn-admin cg-ico" onClick={probar} disabled={cargando || deshabilitado} title="Probar conexión" aria-label={`Probar la conexión de ${alias}`}>
        {cargando ? "…" : "⚡"}
      </button>
      {estado?.ok && (
        <small style={{ display: "block", color: "#1b7f3b" }}>
          Conectado{estado.tienda?.nombre ? ` · ${estado.tienda.nombre}` : ""}{estado.version ? ` · Mirakl ${estado.version}` : ""}
        </small>
      )}
      {estado?.error && <small style={{ display: "block", color: "#b3261e" }}>{estado.error}</small>}
    </>
  );
}

export default function CuentasRipley({ cuentas = [] }) {
  // null = cerrado · "nueva" = agregar · alias = editando esa cuenta
  const [abierto, setAbierto] = useState(null);
  const cerrar = () => setAbierto(null);
  const editando = cuentas.find((c) => c.alias === abierto);

  return (
    <div className="pf-panel-bloque">
      <strong>Cuentas de Ripley (Mirakl)</strong>
      <small style={{ color: "var(--gris)" }}>
        Las cuentas de vendedor de Ripley Perú. La API key se guarda cifrada en la base de datos, solo la usa el servidor y nunca se muestra de nuevo.
      </small>
      {cuentas.length === 0 ? (
        <small style={{ color: "var(--gris)" }}>Aún no hay cuentas. Agrega la primera.</small>
      ) : (
        <div className="admin-tabla-wrap">
          <table className="admin-tabla cg-tabla-cuentas">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>URL base</th>
                <th>Tienda</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <tr key={c.alias}>
                  <td>
                    {c.nombre}
                    <code className="cg-slug">{c.alias}</code>
                    {!c.activo && <small style={{ marginLeft: 6, color: "var(--gris)" }}>(inactiva)</small>}
                    {!c.tiene_key && <small style={{ display: "block", color: "#b3261e" }}>falta la API key</small>}
                  </td>
                  <td>{c.base_url}</td>
                  <td>{c.shop_id || "—"}</td>
                  <td className="cg-acc">
                    <Probar alias={c.alias} deshabilitado={!c.tiene_key} />
                    <button type="button" className="btn-admin cg-ico" onClick={() => setAbierto(c.alias)} aria-label={`Editar la cuenta ${c.alias}`} title="Editar">✎</button>
                    <Quitar alias={c.alias} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {abierto === null && (
        <div>
          <button type="button" className="btn-admin cg-mas" onClick={() => setAbierto("nueva")}>+ Agregar cuenta</button>
        </div>
      )}
      {abierto === "nueva" && <Formulario key="nueva" c={null} onCerrar={cerrar} />}
      {editando && <Formulario key={editando.alias} c={editando} onCerrar={cerrar} />}
    </div>
  );
}
