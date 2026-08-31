"use client";

import { useState } from "react";
import { subirImagenPorNombre } from "../../app/(admin)/admin/actions";

const ETIQUETA_ESTADO = {
  pendiente: "Pendiente",
  subiendo: "Subiendo...",
  ok: "Conectada",
  error: "Error",
};

export default function SubirImagenesMasivo() {
  const [archivos, setArchivos] = useState([]);
  const [enProceso, setEnProceso] = useState(false);

  function alSeleccionar(e) {
    const lista = Array.from(e.target.files || []).map((file) => ({
      file,
      nombre: file.name,
      estado: "pendiente",
      mensaje: "",
    }));
    setArchivos(lista);
  }

  async function subirTodas() {
    setEnProceso(true);
    for (let i = 0; i < archivos.length; i++) {
      setArchivos((prev) =>
        prev.map((a, idx) => (idx === i ? { ...a, estado: "subiendo" } : a))
      );

      const fd = new FormData();
      fd.append("archivo", archivos[i].file, archivos[i].file.name);

      let resultado;
      try {
        resultado = await subirImagenPorNombre(fd);
      } catch (err) {
        resultado = { ok: false, error: err.message || "Error inesperado." };
      }

      setArchivos((prev) =>
        prev.map((a, idx) =>
          idx === i
            ? {
                ...a,
                estado: resultado.ok ? "ok" : "error",
                mensaje: resultado.ok
                  ? `${resultado.producto} → ${resultado.variante}`
                  : resultado.error,
              }
            : a
        )
      );
    }
    setEnProceso(false);
  }

  const pendientes = archivos.filter((a) => a.estado === "pendiente" || a.estado === "error").length;
  const listas = archivos.filter((a) => a.estado === "ok").length;

  return (
    <div className="form-grid">
      <div className="admin-card csv-ayuda">
        <p>
          Nombra cada foto como <code>id_producto__nombre_variante.jpg</code> (no importan
          tildes/mayúsculas en el nombre de la variante, pero el <code>id_producto</code> debe
          ser exacto — el que ves en <code>/admin</code> o en la URL del producto). Ejemplos:{" "}
          <code>ccori__cristal.jpg</code>, <code>sensuelle__unico.jpg</code>.
        </p>
        <p style={{ marginTop: 8 }}>
          El producto y la variante deben existir de antes (créalos manualmente o por CSV en{" "}
          <code>/admin/importar</code>); esta pantalla solo conecta la foto.
        </p>
      </div>

      <div className="admin-card form-grid">
        <div className="campo">
          <label htmlFor="archivos">Selecciona todas las fotos</label>
          <input
            id="archivos"
            type="file"
            accept="image/*"
            multiple
            onChange={alSeleccionar}
            disabled={enProceso}
          />
        </div>

        {archivos.length > 0 && (
          <>
            <button
              type="button"
              className="btn-admin solido"
              onClick={subirTodas}
              disabled={enProceso || pendientes === 0}
            >
              {enProceso
                ? `Subiendo... (${listas}/${archivos.length})`
                : `Subir ${pendientes} foto(s)`}
            </button>

            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {archivos.map((a, i) => (
                  <tr key={i}>
                    <td>{a.nombre}</td>
                    <td>
                      <span className={a.estado === "error" ? "pill agotado" : "pill"}>
                        {ETIQUETA_ESTADO[a.estado]}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "var(--gris)" }}>{a.mensaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
