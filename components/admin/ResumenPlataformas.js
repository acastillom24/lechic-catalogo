"use client";

/**
 * Resumen por plataforma al final del formulario de producto: por cada cuenta marcada, qué se hará con
 * cada variante y lo que falta para poder enviarla. Solo presenta datos ya calculados por ProductoForm
 * (`filas[].faltantes` = { comunes, propios: [{ alias, items }], total }).
 */
export default function ResumenPlataformas({ cuentas, filas }) {
  // Abre la variante antes de saltar a ella (las tarjetas de variante son plegables).
  const ir = (i) => {
    const el = document.getElementById(`pf-var-${i}`);
    if (el) el.open = true;
  };

  return (
    <section id="pf-resumen" className="pf-seccion pf-resumen">
      <header className="pf-seccion-cab">
        <div>
          <h3>Resumen por plataforma</h3>
          <small>Qué se enviará en este guardado y lo que falta para poder hacerlo.</small>
        </div>
      </header>

      {cuentas.length === 0 ? (
        <p className="pf-vacio">No marcaste ninguna cuenta en «Plataformas»: este guardado no envía nada a SAGA.</p>
      ) : (
        cuentas.map((c) => {
          const pendientes = filas.filter((f) => f.envia[c.alias] && faltasDe(f, c.alias).length).length;
          return (
            <div className="pf-resumen-cuenta" key={c.alias}>
              <div className="pf-resumen-cab">
                <strong>SAGA — {c.nombre}</strong>
                <span className={pendientes ? "chip-saga aviso" : "chip-saga ok"}>
                  {pendientes ? `${pendientes} variante${pendientes === 1 ? "" : "s"} con datos pendientes` : "Todo listo"}
                </span>
              </div>
              <div className="admin-tabla-wrap">
                <table className="admin-tabla">
                  <thead>
                    <tr>
                      <th>Variante</th>
                      <th>SKU</th>
                      <th>Acción</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => {
                      const faltas = f.envia[c.alias] ? faltasDe(f, c.alias) : [];
                      return (
                        <tr key={f.i}>
                          <td>
                            <a href={`#pf-var-${f.i}`} onClick={() => ir(f.i)}>
                              {f.i + 1}. {f.nombre}
                            </a>
                          </td>
                          <td>{f.sku || "—"}</td>
                          <td>{f.acciones[c.alias]}</td>
                          <td>
                            {!f.envia[c.alias] ? (
                              <span className="chip-saga">Sin validación de alta</span>
                            ) : faltas.length ? (
                              <>
                                <span className="chip-saga aviso">Faltan {faltas.length}</span>
                                <ul className="pf-faltas">
                                  {faltas.map((x) => (
                                    <li key={x}>{x}</li>
                                  ))}
                                </ul>
                              </>
                            ) : (
                              <span className="chip-saga ok">Completa</span>
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
        })
      )}
    </section>
  );
}

/** Lo que falta de una variante en una cuenta: lo común a todas las cuentas más lo propio de esa. */
function faltasDe(f, alias) {
  const propios = f.faltantes.propios.find((p) => p.alias === alias)?.items || [];
  return [...f.faltantes.comunes, ...propios];
}
