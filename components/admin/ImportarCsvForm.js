"use client";

import { useActionState } from "react";
import { importarCsv } from "../../app/(admin)/admin/actions";

const ENCABEZADOS =
  "id_producto,marca,pestana,categoria,nombre_producto,descripcion,notas_producto,destacado,nombre_variante,precio,precio_oferta,stock,imagen,notas_variante";

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
            <code>notas_producto</code> y <code>notas_variante</code> (notas aromáticas; antes <code>aromas_*</code>, que también se
            aceptan): varios valores separados por <code>|</code> (ej: <code>Rosa|Vainilla|Musk</code>).
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
            Inventario (columnas opcionales): <code>sku</code>, <code>stock_cantidad</code>,{" "}
            <code>stock_minimo</code> y <code>costo</code>. Con <code>stock_cantidad</code> la
            variante pasa a tener control de cantidad y queda un ajuste en su historial.
          </li>
          <li>
            Al reimportar un <code>id_producto</code> que ya existe, sus variantes se
            actualizan: por <code>sku</code> si lo traen o, si no, por nombre de variante. Las
            que ya no aparezcan se eliminan, salvo las que tienen control de cantidad: esas
            solo se desactivan para conservar su historial.
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
