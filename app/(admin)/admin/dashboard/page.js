import Link from "next/link";
import { getDashboardVentas, getVentasAnuales } from "../../../../lib/ventas";
import { getResumenCatalogo } from "../../../../lib/dashboard";
import { resolverPeriodo, hoyLima, ATAJOS, PERIODOS } from "../../../../lib/periodos";
import { leerFiltrosVentas } from "../../../../lib/filtros-ventas";
import { getOpcionesVentas } from "../../../../lib/ventas-opciones";
import { TELEFONO_SIN_DATO } from "../../../../lib/ventas-core";
import ComparativoAnual from "../../../../components/admin/dashboard/ComparativoAnual";
import Tendencia from "../../../../components/admin/dashboard/Tendencia";
import DashboardFiltros from "../../../../components/admin/DashboardFiltros";
import {
  Kpi,
  Barras,
  Seccion,
  soles,
  solesDec,
  entero,
} from "../../../../components/admin/dashboard/Graficos";

export const metadata = { title: "Dashboard · Panel Le Chic" };
export const dynamic = "force-dynamic";

const TABS = [
  ["ventas", "Ventas"],
  ["clientes", "Clientes"],
  ["stock", "Productos y stock"],
];

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default async function DashboardPage({ searchParams }) {
  const params = await searchParams;
  const tab = TABS.some(([k]) => k === params?.tab) ? params.tab : "ventas";
  const periodo = resolverPeriodo(params);
  const opciones = await getOpcionesVentas();
  const { categoria, destino } = leerFiltrosVentas(params, opciones);

  // Enlaces que conservan pestaña, periodo y filtros.
  const href = (extra = {}) => {
    const base = {
      tab: tab === "ventas" ? "" : tab,
      periodo: periodo.clave === "mes" ? "" : periodo.clave,
      desde: periodo.clave === "custom" ? periodo.desde : "",
      hasta: periodo.clave === "custom" ? periodo.hasta : "",
      categoria,
      destino,
      ...extra,
    };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, String(v));
    const s = u.toString();
    return s ? `/admin/dashboard?${s}` : "/admin/dashboard";
  };

  const atajos = ATAJOS.map((clave) => ({
    clave,
    etiqueta: PERIODOS[clave],
    href: href({ periodo: clave === "mes" ? "" : clave, desde: "", hasta: "" }),
  }));
  const chips = [
    categoria && { texto: `Categoría: ${categoria}`, href: href({ categoria: "" }) },
    destino && { texto: `Entrega: ${destino}`, href: href({ destino: "" }) },
  ].filter(Boolean);

  const exportar = new URLSearchParams({ desde: periodo.desde, hasta: periodo.hasta });
  if (categoria) exportar.set("categoria", categoria);
  if (destino) exportar.set("destino", destino);

  const esStock = tab === "stock";
  const [v, c, anual] = await Promise.all([
    esStock ? null : getDashboardVentas({ ...periodo, categoria, destino }),
    esStock ? getResumenCatalogo() : null,
    tab === "ventas" ? getVentasAnuales({ categoria, destino }) : null,
  ]);

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
        <h1 className="admin-titulo">Dashboard</h1>
        {!esStock && (
          <span className="nota-periodo">
            {periodo.etiqueta}
            {periodo.clave !== "hoy" && periodo.clave !== "ayer" && ` · ${periodo.desde} a ${periodo.hasta}`}
          </span>
        )}
      </div>

      <nav className="admin-tabs" aria-label="Secciones del dashboard">
        {TABS.map(([k, etiqueta]) => (
          <Link key={k} href={href({ tab: k === "ventas" ? "" : k })} className={tab === k ? "admin-tab activo" : "admin-tab"}>
            {etiqueta}
          </Link>
        ))}
      </nav>

      {!esStock && (
        <DashboardFiltros
          tab={tab}
          periodo={periodo.clave}
          etiquetaPeriodo={periodo.etiqueta}
          desde={periodo.desde}
          hasta={periodo.hasta}
          hoy={hoyLima()}
          categoria={categoria}
          destino={destino}
          opciones={opciones}
          atajos={atajos}
          chips={chips}
          hrefs={{
            periodo: href({ periodo: "", desde: "", hasta: "" }),
            categoria: href({ categoria: "" }),
            destino: href({ destino: "" }),
          }}
          hrefExportar={tab === "ventas" ? `/admin/ventas/exportar?${exportar}` : null}
        />
      )}

      {tab === "ventas" && v && <VentasTab v={v} periodo={periodo} anual={anual} />}
      {tab === "clientes" && v && <ClientesTab v={v} />}
      {esStock && c && <StockTab c={c} />}
    </div>
  );
}

function VentasTab({ v, periodo, anual }) {
  const etiquetaPrev = `vs ${periodo.previo.desde === periodo.previo.hasta ? periodo.previo.desde : "periodo anterior"}`;
  return (
    <>
      <div className="kpi-grid">
        <Kpi etiqueta="Ventas (monto)" valor={soles(v.monto)} delta={v.variacion} deltaTexto={etiquetaPrev} />
        <Kpi etiqueta="Nº de ventas" valor={entero(v.n)} sub={`${entero(v.previo.n)} en el periodo anterior`} />
        <Kpi etiqueta="Ticket promedio" valor={solesDec(v.ticket)} />
        <Link href="/admin/ventas/pendientes" style={{ textDecoration: "none", color: "inherit" }}>
          <Kpi
            etiqueta="Por cobrar (acumulado)"
            valor={soles(v.pendientes.saldo)}
            sub={`${v.pendientes.n} ventas pendientes →`}
          />
        </Link>
      </div>

      {periodo.dias === 1 ? (
        <Seccion titulo={`Ventas del ${periodo.desde}`} nota={`${v.detalleDia.length} registros`}>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Categoría</th>
                  <th>Entrega</th>
                  <th>Monto</th>
                  <th>Adelanto</th>
                  <th>Estado</th>
                  <th>Registró</th>
                </tr>
              </thead>
              <tbody>
                {v.detalleDia.map((d) => (
                  <tr key={d.id}>
                    <td className="celda-producto">{d.telefono}</td>
                    <td>{d.categoria}</td>
                    <td>{[d.destino, d.courier].filter(Boolean).join(" · ") || "—"}</td>
                    <td>{solesDec(d.monto)}</td>
                    <td>{Number(d.adelanto) > 0 ? solesDec(d.adelanto) : "—"}</td>
                    <td>
                      <span className={d.estado === "pendiente" ? "pill" : "pill cerrada"}>
                        {d.estado === "pendiente" ? "Pendiente" : "Cerrada"}
                      </span>
                    </td>
                    <td>{d.registrado_por_nombre || (d.origen === "csv" ? "Excel" : "—")}</td>
                  </tr>
                ))}
                {v.detalleDia.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--gris)" }}>
                      No hay ventas ese día.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Seccion>
      ) : (
        <Seccion
          titulo={v.tendenciaPorMes ? "Ventas por mes" : "Ventas por día"}
          nota="Pasa el cursor sobre una columna para ver el monto y el número de ventas."
        >
          <Tendencia datos={v.tendencia} />
        </Seccion>
      )}

      {anual && (
        <Seccion
          titulo={`Ventas por mes: ${anual.anio} vs ${anual.anio - 1}`}
          nota={`Acumulado ${anual.anio}: ${soles(anual.totalActual)} · ${anual.anio - 1}: ${soles(anual.totalPrevio)}. No depende del periodo elegido.`}
        >
          <ComparativoAnual anio={anual.anio} meses={anual.meses} />
        </Seccion>
      )}

      <div className="dash-grid">
        <Seccion titulo="Por categoría">
          <Barras datos={v.porCategoria} />
        </Seccion>
        <Seccion titulo="Por entrega">
          <Barras datos={v.porEntrega} />
        </Seccion>
        <Seccion titulo="Método de pago">
          <Barras datos={v.porMetodo} />
        </Seccion>
        <Seccion titulo="Registrado por">
          <Barras datos={v.porUsuario} />
        </Seccion>
        <Seccion titulo="Pendientes por antigüedad" nota="Saldo por cobrar, sin importar el periodo.">
          <Barras
            mostrarPorcentaje={false}
            vacio="No hay saldos pendientes."
            datos={[
              { nombre: "0 a 7 días", monto: v.pendientes.d0_7 },
              { nombre: "8 a 30 días", monto: v.pendientes.d8_30 },
              { nombre: "Más de 30 días", monto: v.pendientes.d31_mas },
            ].filter((d) => d.monto > 0)}
          />
        </Seccion>
      </div>
    </>
  );
}

function ClientesTab({ v }) {
  const conTipo = v.nuevos + v.recompras;
  return (
    <>
      <div className="kpi-grid">
        <Kpi etiqueta="Clientes únicos" valor={entero(v.clientes)} sub="con teléfono registrado" />
        <Kpi etiqueta="Compras de clientes nuevos" valor={entero(v.nuevos)} sub={`${pct(v.nuevos, conTipo)} de las ventas con tipo`} />
        <Kpi etiqueta="Compras de recompra" valor={entero(v.recompras)} sub={`${pct(v.recompras, conTipo)} de las ventas con tipo`} />
        <Kpi
          etiqueta={`Sin teléfono (${TELEFONO_SIN_DATO})`}
          valor={pct(v.sin_telefono, v.n)}
          sub={`${entero(v.sin_telefono)} de ${entero(v.n)} ventas`}
        />
      </div>

      <div className="dash-grid">
        <Seccion titulo="Nuevos vs recompra (monto)">
          <Barras
            datos={[
              { nombre: "Nuevos", monto: v.monto_nuevos, n: v.nuevos },
              { nombre: "Recompra", monto: v.monto_recompras, n: v.recompras },
            ].filter((d) => d.monto > 0)}
          />
        </Seccion>
        <Seccion titulo="Frecuencia de compra" nota="Clientes con teléfono, según cuántas veces compraron en el periodo.">
          <Barras
            datos={v.frecuencia.map((f) => ({ nombre: f.nombre, monto: f.n }))}
            formato={(n) => `${entero(n)} clientes`}
            mostrarPorcentaje={false}
          />
        </Seccion>
      </div>

      <Seccion titulo="Mejores clientes del periodo">
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>#</th>
              <th>Teléfono</th>
              <th>Compras</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {v.topClientes.map((t, i) => (
              <tr key={t.telefono}>
                <td>{i + 1}</td>
                <td className="celda-producto">{t.telefono}</td>
                <td>{t.n}</td>
                <td>{solesDec(t.monto)}</td>
              </tr>
            ))}
            {v.topClientes.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--gris)" }}>
                  Sin datos en este periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Seccion>
    </>
  );
}

function StockTab({ c }) {
  return (
    <>
      <p className="nota-periodo">Muestra la situación actual del catálogo; no depende del periodo.</p>
      <div className="kpi-grid">
        <Kpi etiqueta="Productos" valor={entero(c.productos)} sub={`${entero(c.variantes)} variantes activas`} />
        <Kpi etiqueta="Agotadas" valor={entero(c.agotadas)} />
        <Kpi etiqueta="Bajo mínimo" valor={entero(c.bajo_minimo)} />
        <Kpi etiqueta="Sin control de stock" valor={entero(c.sin_control)} sub="aún sin cantidad cargada" />
        <Kpi etiqueta="Inventario a precio de venta" valor={soles(c.valor_venta)} sub={`a costo ${soles(c.valor_costo)}`} />
      </div>

      <div className="dash-grid">
        <Seccion titulo="Alertas de stock">
          {c.alertas.length ? (
            <table className="admin-tabla">
              <tbody>
                {c.alertas.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.producto} · {a.variante}
                    </td>
                    <td>
                      <span className={a.stock_actual === 0 ? "pill agotado" : "pill"}>
                        {a.stock_actual} / mín {a.stock_minimo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "var(--gris)" }}>Sin alertas.</p>
          )}
          <p style={{ marginTop: 10 }}>
            <Link href="/admin?filtro=alertas">Ver todas en Productos →</Link>
          </p>
        </Seccion>

        <Seccion titulo="Entradas de stock (30 días)" nota="Lo más cercano a compras: movimientos de tipo entrada.">
          <div className="kpi-grid" style={{ marginBottom: 12 }}>
            <Kpi etiqueta="Unidades" valor={entero(c.entradasResumen.unidades)} />
            <Kpi etiqueta="Valor a costo" valor={soles(c.entradasResumen.valor_costo)} />
          </div>
          {c.entradas.length ? (
            <table className="admin-tabla">
              <tbody>
                {c.entradas.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.producto} · {e.variante}
                    </td>
                    <td>+{e.cantidad}</td>
                    <td>{new Date(e.created_at).toLocaleDateString("es-PE", { timeZone: "America/Lima" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "var(--gris)" }}>Aún no hay entradas registradas.</p>
          )}
        </Seccion>

        <Seccion titulo="Variantes por marca">
          <Barras
            datos={c.porMarca.map((m) => ({ nombre: m.nombre, monto: m.n }))}
            formato={(n) => entero(n)}
            mostrarPorcentaje={false}
          />
        </Seccion>
      </div>
    </>
  );
}
