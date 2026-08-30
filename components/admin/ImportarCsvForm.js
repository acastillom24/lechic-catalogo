"use client";

import { useActionState } from "react";
import { importarCsv } from "../../app/(admin)/admin/actions";

const ENCABEZADOS =
  "id_producto,marca,categoria,nombre_producto,descripcion,aromas_producto,destacado,nombre_variante,precio,precio_oferta,stock,imagen,aromas_variante";

export default function ImportarCsvForm() {
  const [estado, accion, enviando] = useActionState(importarCsv, {});

  return (
    <div className="form-grid">
      <div className="admin-card csv-ayuda">
        <p>
          <strong>Formato del CSV</strong> — una fila por variante. Repite los datos del
          producto en cada variante suya (mismo <code>id_producto</code>). Si dejas{" "}
          <code>id_producto</code> vacío, se genera a partir del nombre.
        </p>
        <p style={{ marginTop: 10 }}>
          Encabezados exactos (en ese orden o el que prefieras, mientras los nombres
          coincidan):
        </p>
        <pre
          style={{
            marginTop: 8,
            padding: 12,
            background: "var(--papel-hondo)",
            borderRadius: 6,
            overflowX: "auto",
            fontSize: "0.78rem",
          }}
        >
          {ENCABEZADOS}
        </pre>
        <ul style={{ marginTop: 10, paddingLeft: 18, display: "grid", gap: 4 }}>
          <li>
            <code>aromas_producto</code> y <code>aromas_variante</code>: varios valores
            separados por <code>|</code> (ej: <code>Rosa|Vainilla|Musk</code>).
          </li>
          <li>
            <code>destacado</code> y <code>stock</code>: <code>true</code>/<code>false</code>{" "}
            (o <code>si</code>/<code>no</code>). Si dejas <code>stock</code> vacío se asume{" "}
            <code>true</code>.
          </li>
          <li>
            <code>imagen</code> es opcional: pega una URL si ya tienes la foto en otro
            lugar. Si la dejas vacía, súbela después editando el producto manualmente.
          </li>
          <li>
            Al reimportar un <code>id_producto</code> que ya existe, sus variantes se
            reemplazan por completo con lo que traiga el CSV.
          </li>
        </ul>
      </div>

      {estado?.error && (
        <div className="mensaje-error">
          {estado.error}
          {estado.detalle?.length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 18 }}>
              {estado.detalle.map((linea, i) => (
                <li key={i}>{linea}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {estado?.resumen && (
        <div className={estado.resumen.errores.length ? "mensaje-error" : "mensaje-ok"}>
          <p>
            {estado.resumen.procesados} de {estado.resumen.totalProductos} productos
            importados correctamente.
          </p>
          {estado.resumen.filasOmitidas.length > 0 && (
            <>
              <p style={{ marginTop: 8 }}>Filas omitidas:</p>
              <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                {estado.resumen.filasOmitidas.map((linea, i) => (
                  <li key={i}>{linea}</li>
                ))}
              </ul>
            </>
          )}
          {estado.resumen.errores.length > 0 && (
            <>
              <p style={{ marginTop: 8 }}>Errores:</p>
              <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                {estado.resumen.errores.map((linea, i) => (
                  <li key={i}>{linea}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <form action={accion} className="admin-card form-grid" encType="multipart/form-data">
        <div className="campo">
          <label htmlFor="archivo">Archivo CSV</label>
          <input id="archivo" name="archivo" type="file" accept=".csv,text/csv" required />
        </div>
        <button type="submit" className="btn-admin solido" disabled={enviando}>
          {enviando ? "Importando..." : "Importar"}
        </button>
      </form>
    </div>
  );
}
