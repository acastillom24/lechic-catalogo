"use client";

import { useState } from "react";
import { consultarAtributosSaga } from "../../app/(admin)/admin/actions";
import { CAMPOS_WEB, esReasignable } from "../../lib/campos-web";
import { etiquetaCampo } from "../../lib/equivalencias";

const ETIQUETA_TIPO = { multi: "varias opciones", lista: "una opción", texto: "texto", numero: "número", fecha: "fecha" };

/**
 * Configuración → Integraciones → SAGA → Campos generales: «Atributo de SAGA ↔ Atributo de la web». Cada campo trae su equivalente
 * por defecto con 🔒; el ✎ permite elegir otro campo general de la web del mismo tipo (el envío usa su valor). Los que arman el
 * alta (nombre, SKU, precio, stock, imágenes, marca, categoría…) solo muestran su equivalente. Se envía `eqGen__<campoSaga>` por
 * cada campo reasignable (aunque no se edite).
 */
export default function CamposGeneralesSaga({ equivalencias, categoriaConsulta = "" }) {
  const generales = CAMPOS_WEB.filter((c) => c.saga && !c.porSaga);
  const [elegido, setElegido] = useState(() => Object.fromEntries(generales.filter(esReasignable).map((c) => [c.saga, Object.prototype.hasOwnProperty.call(equivalencias?.equivGenerales || {}, c.saga) ? equivalencias.equivGenerales[c.saga] : c.id])));
  const [editando, setEditando] = useState(() => new Set());
  const abrir = (k, v) =>
    setEditando((p) => {
      const sig = new Set(p);
      if (v) sig.add(k); else sig.delete(k);
      return sig;
    });

  return (
    <div className="admin-tabla-wrap">
      <input type="hidden" name="eqGenMarca" value="1" />
      <table className="admin-tabla pf-eq-tabla-campos cg-tabla-eq">
        <thead>
          <tr>
            <th>Atributo de SAGA</th>
            <th>Atributo de la web</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {generales.map((def) => {
            const reasignable = esReasignable(def);
            const actual = reasignable ? (elegido[def.saga] === "" ? null : CAMPOS_WEB.find((c) => c.id === elegido[def.saga]) || def) : def;
            const nombre = (c) => etiquetaCampo(equivalencias, c);
            const abierto = reasignable && editando.has(def.saga);
            const opciones = CAMPOS_WEB.filter((c) => esReasignable(c) && c.tipo === def.tipo);
            return (
              <tr key={def.id}>
                <td>
                  <code>{def.saga}</code>
                  <small style={{ marginLeft: 8, color: "var(--gris)" }}>{ETIQUETA_TIPO[def.tipo] || def.tipo}</small>
                </td>
                <td>
                  {reasignable && <input type="hidden" name={`eqGen__${def.saga}`} value={actual ? actual.id : ""} />}
                  {abierto ? (
                    <>
                      <select
                        value={actual ? actual.id : ""}
                        onChange={(e) => setElegido((p) => ({ ...p, [def.saga]: e.target.value }))}
                        aria-label={`Atributo de la web para ${def.saga}`}
                      >
                        <option value="">— sin equivalente (no se envía) —</option>
                        {opciones.map((c) => (
                          <option key={c.id} value={c.id}>{nombre(c)}{c.id === def.id ? " (predeterminado)" : ""}</option>
                        ))}
                      </select>
                      <TipoEnSaga campoSaga={def.saga} tipoWeb={def.tipo} categoria={categoriaConsulta} />
                    </>
                  ) : (
                    <span className="pf-eq-fija">
                      🔒 {actual ? nombre(actual) : <small style={{ color: "#b26a00" }}>— sin equivalente —</small>}{" "}
                      {(!actual || actual.id !== def.id) && <small style={{ color: "#b26a00" }}>· cambiado (predeterminado: {nombre(def)})</small>}
                    </span>
                  )}
                </td>
                <td className="cg-acc">
                  {abierto ? (
                    <button type="button" className="btn-admin" onClick={() => abrir(def.saga, false)} title="Volver a bloquear (el cambio se guarda con el botón Guardar)">✓ Listo</button>
                  ) : (
                    <button type="button" className="btn-admin cg-ico" disabled={!reasignable} onClick={() => abrir(def.saga, true)} aria-label={`Editar el equivalente de ${def.saga}`} title="Elegir otro campo de la web">✎</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Resultados ya consultados por categoría de SAGA.
const cache = new Map();

/** Consulta en SAGA el tipo real del campo (GetCategoryAttributes; los generales vienen en cualquier categoría). */
function TipoEnSaga({ campoSaga, tipoWeb, categoria }) {
  const [info, setInfo] = useState(null);
  const [cargando, setCargando] = useState(false);
  async function ver() {
    if (!categoria) return setInfo({ error: "No hay categorías de SAGA configuradas." });
    setCargando(true);
    let lista = cache.get(categoria);
    if (!lista) {
      const r = await consultarAtributosSaga(categoria);
      if (r?.error) {
        setCargando(false);
        return setInfo({ error: r.error });
      }
      lista = r.atributos;
      cache.set(categoria, lista);
    }
    setCargando(false);
    const a = lista.find((x) => x.id === campoSaga);
    setInfo(a ? { a } : { error: `«${campoSaga}» no figura con ese código en el catálogo de SAGA: viaja en la estructura del alta.` });
  }
  return (
    <span style={{ marginLeft: 8 }}>
      <button type="button" className="btn-admin" disabled={cargando} onClick={ver} title="Consulta el tipo de dato real de este campo en SAGA">{cargando ? "Consultando…" : "Ver tipo en SAGA"}</button>
      {info?.error && <small style={{ display: "block", color: "#b26a00" }}>{info.error}</small>}
      {info?.a && (
        <small style={{ display: "block", color: "var(--gris)" }}>
          SAGA: {ETIQUETA_TIPO[info.a.tipo] || info.a.tipo} · {info.a.obligatorio ? "obligatorio" : "opcional"}
          {info.a.max ? ` · máx. ${info.a.max}` : ""}{info.a.opciones.length ? ` · ${info.a.opciones.length} opciones` : ""}
          {info.a.tipo !== tipoWeb ? ` · ⚠ el campo de la web es ${ETIQUETA_TIPO[tipoWeb]}` : " · el tipo coincide"}
        </small>
      )}
    </span>
  );
}
