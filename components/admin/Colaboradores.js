"use client";

import { useActionState, useState } from "react";
import { guardarColaboradorAccion, estadoColaboradorAccion } from "../../app/(admin)/admin/actions";
import { IconoMas, IconoEditar, IconoCerrar, IconoCheck } from "./Iconos";
import { JORNADAS, TIPOS_PAGO } from "../../lib/asistencias-core";

const soles = (n) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const VACIO = {
  nombre: "",
  cargo: "",
  jornada: "COMPLETO",
  tipo_pago: "QUINCENAL",
  multiplicador: 1.25,
  tarifa: "",
  hora_entrada: "09:00",
  hora_salida: "17:00",
  refrigerio_min: 60,
};

/** Formulario de alta / edición de un trabajador (id = 0 → alta). */
function ColaboradorForm({ id = 0, inicial = VACIO, onListo }) {
  const [estado, accion, enviando] = useActionState(async (prev, fd) => {
    const r = await guardarColaboradorAccion(id, prev, fd);
    if (r?.ok && onListo) onListo();
    return r;
  }, {});
  const k = `${id}-${estado?.n || "nuevo"}`;

  return (
    <form action={accion} key={k} className="form-grid">
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      <div className="cg-listas">
        <div className="campo">
          <label htmlFor={`c-nombre-${id}`}>Trabajador</label>
          <input id={`c-nombre-${id}`} type="text" name="nombre" required defaultValue={inicial.nombre} autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor={`c-cargo-${id}`}>Cargo</label>
          <input id={`c-cargo-${id}`} type="text" name="cargo" defaultValue={inicial.cargo} autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor={`c-jornada-${id}`}>Jornada</label>
          <select id={`c-jornada-${id}`} name="jornada" defaultValue={inicial.jornada}>
            {Object.entries(JORNADAS).map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`c-pago-${id}`}>Pago</label>
          <select id={`c-pago-${id}`} name="tipo_pago" defaultValue={inicial.tipo_pago}>
            {Object.entries(TIPOS_PAGO).map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`c-tarifa-${id}`}>Tarifa por hora (S/)</label>
          <input id={`c-tarifa-${id}`} type="number" name="tarifa" required min="0" step="0.01" defaultValue={inicial.tarifa} />
        </div>
        <div className="campo">
          <label htmlFor={`c-mult-${id}`}>Multiplicador (horas extra)</label>
          <input id={`c-mult-${id}`} type="number" name="multiplicador" required min="1" max="5" step="0.01" defaultValue={inicial.multiplicador} />
        </div>
        <div className="campo">
          <label htmlFor={`c-ent-${id}`}>Hora entrada</label>
          <input id={`c-ent-${id}`} type="time" name="hora_entrada" required defaultValue={inicial.hora_entrada} />
        </div>
        <div className="campo">
          <label htmlFor={`c-sal-${id}`}>Hora salida</label>
          <input id={`c-sal-${id}`} type="time" name="hora_salida" required defaultValue={inicial.hora_salida} />
        </div>
        <div className="campo">
          <label htmlFor={`c-ref-${id}`}>Refrigerio (min)</label>
          <input id={`c-ref-${id}`} type="number" name="refrigerio_min" required min="0" max="240" step="5" defaultValue={inicial.refrigerio_min} />
        </div>
      </div>
      <div className="acciones-fila">
        <button type="submit" className="btn-ico-texto primario" disabled={enviando}>
          {id ? <IconoCheck /> : <IconoMas />} {enviando ? "Guardando..." : id ? "Guardar cambios" : "Agregar trabajador"}
        </button>
        {onListo && (
          <button type="button" className="btn-ico-texto" onClick={onListo}>
            <IconoCerrar /> Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

/** Fila de la tabla con modo edición en línea y baja / reactivación. */
function FilaColaborador({ c }) {
  const [editando, setEditando] = useState(false);
  const inicial = {
    ...c,
    tarifa: c.tarifa,
    multiplicador: c.multiplicador,
  };

  return (
    <>
      <tr style={c.activo ? undefined : { opacity: 0.6 }}>
        <td className="celda-producto">{c.nombre}</td>
        <td>{c.cargo || "—"}</td>
        <td>{JORNADAS[c.jornada]}</td>
        <td>{TIPOS_PAGO[c.tipo_pago]}</td>
        <td>×{c.multiplicador}</td>
        <td>{soles(c.tarifa)}</td>
        <td>{c.hora_entrada}</td>
        <td>{c.hora_salida}</td>
        <td>{c.refrigerio_min} min</td>
        <td>
          <span className={c.activo ? "pill" : "pill agotado"}>
            {c.activo ? "Activo" : `Baja${c.fecha_baja ? ` ${c.fecha_baja.split("-").reverse().join("/")}` : ""}`}
          </span>
        </td>
        <td>
          <div className="acciones-fila">
            <button className="btn-ico" title="Editar" aria-label={`Editar a ${c.nombre}`} onClick={() => setEditando((v) => !v)}>
              <IconoEditar />
            </button>
            <form
              action={estadoColaboradorAccion.bind(null, c.id, !c.activo)}
              onSubmit={(e) => {
                if (c.activo && !confirm(`¿Dar de baja a "${c.nombre}"? Su historial de asistencias se conserva.`)) {
                  e.preventDefault();
                }
              }}
            >
              <button className="btn-ico-texto" type="submit">
                {c.activo ? "Dar de baja" : "Reactivar"}
              </button>
            </form>
          </div>
        </td>
      </tr>
      {editando && (
        <tr>
          <td colSpan={11}>
            <ColaboradorForm id={c.id} inicial={inicial} onListo={() => setEditando(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Alta, edición y baja de colaboradores (Configuración). */
export default function Colaboradores({ colaboradores }) {
  const [agregando, setAgregando] = useState(false);
  return (
    <div className="pf-panel-bloque">
      <strong>Colaboradores (asistencias y pagos)</strong>
      <div className="admin-tabla-wrap">
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Cargo</th>
              <th>Jornada</th>
              <th>Pago</th>
              <th>Multiplicador</th>
              <th>Tarifa</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Refrigerio</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((c) => (
              <FilaColaborador key={c.id} c={c} />
            ))}
            {colaboradores.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", color: "var(--gris)" }}>
                  Aún no hay colaboradores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {agregando ? (
        <ColaboradorForm onListo={() => setAgregando(false)} />
      ) : (
        <div>
          <button type="button" className="btn-admin cg-mas" onClick={() => setAgregando(true)}>+ Agregar trabajador</button>
        </div>
      )}
    </div>
  );
}
