import Link from "next/link";
import { getDashboardVentas, getVentasAnuales, getVentasPorDia } from "../../../../lib/ventas";
import { getResumenCatalogo } from "../../../../lib/dashboard";
import { resolverPeriodo, hoyLima, sumarDias, primerDiaMes, ATAJOS, PERIODOS } from "../../../../lib/periodos";
import { leerFiltrosVentas } from "../../../../lib/filtros-ventas";
import { getOpcionesVentas } from "../../../../lib/ventas-opciones";
import { TELEFONO_SIN_DATO } from "../../../../lib/ventas-core";
import ComparativoAnual from "../../../../components/admin/dashboard/ComparativoAnual";
import Tendencia from "../../../../components/admin/dashboard/Tendencia";
import DashboardFiltros from "../../../../components/admin/DashboardFiltros";
import BarrasH from "../../../../components/admin/dashboard/BarrasH";
import Dona from "../../../../components/admin/dashboard/Dona";
import Columnas from "../../../../components/admin/dashboard/Columnas";
import BarrasApiladas from "../../../../components/admin/dashboard/BarrasApiladas";
import { ESTADO } from "../../../../components/admin/dashboard/tema";
import {
  Kpi,
  Seccion,
  formatoClave,
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

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * Ventas por día de la semana: periodo actual y, para comparar en las mismas condiciones, el periodo anterior
 * recortado al mismo tramo de días (con «Este mes», los días transcurridos del mes anterior).
 */
function porDiaSemana(tendencia, filasPrevias, previo) {
  const acc = DIAS_SEMANA.map((nombre) => ({ nombre, monto: 0, n: 0, previo: 0, nPrevio: 0 }));
  const indice = (clave) => (new Date(`${clave}T00:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
  for (const d of tendencia) {
    const i = indice(d.clave);
    acc[i].monto += d.monto;
    acc[i].n += d.n;
  }
  for (const r of filasPrevias) {
    if (r.clave < previo.desde || r.clave > previo.hasta) continue;
    const i = indice(r.clave);
    acc[i].previo += r.monto;
    acc[i].nPrevio += r.n;
  }
  return acc;
}

/** Colores fijos del método de pago (el color sigue al método, no a su posición en el ranking). */
const COLORES_METODO = { "SIN DATO": "#9e9a9c", YAPE: "#742284", PLIN: "#1baf7a", EFECTIVO: "#eda100" };

const LETRAS = ["D", "L", "M", "X", "J", "V", "S"]; // getUTCDay(): 0 = domingo
const letraDe = (iso) => LETRAS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const diasDelMes = (iso) => {
  const [a, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
};

/** Rango contra el que se dibuja la comparación: con «Este mes» / «Mes anterior», el mes anterior COMPLETO. */
function rangoComparacion(periodo) {
  if (periodo.clave === "mes" || periodo.clave === "mes_ant") {
    const desde = primerDiaMes(periodo.desde, -1);
    return { desde, hasta: sumarDias(periodo.desde, -1) };
  }
  return periodo.previo;
}

/**
 * Serie diaria para comparar dos periodos alineados por día (día 1 con día 1, etc.). Con meses se muestran todos los
 * días de ambos; los días futuros del mes en curso quedan vacíos. Cada punto trae su etiqueta y la letra del día de la
 * semana (de la fecha del periodo actual).
 */
function serieComparada(periodo, v, filasPrevias) {
  const mes = periodo.clave === "mes" || periodo.clave === "mes_ant";
  const hoy = hoyLima();
  const actual = new Map(v.tendencia.map((d) => [d.clave, d]));
  const previo = new Map(filasPrevias.map((r) => [r.clave, r]));
  const iniAct = periodo.desde;
  const iniPrev = rangoComparacion(periodo).desde;
  const diasAct = mes ? diasDelMes(iniAct) : periodo.dias;
  const diasPrev = mes ? diasDelMes(iniPrev) : periodo.dias;
  const datos = [];
  for (let i = 0; i < Math.max(diasAct, diasPrev); i++) {
    const fa = i < diasAct ? sumarDias(iniAct, i) : null;
    const fp = i < diasPrev ? sumarDias(iniPrev, i) : null;
    const vacio = { monto: 0, n: 0, nuevos: 0, recompras: 0, clientes: 0 };
    const a = fa && fa <= hoy ? actual.get(fa) || vacio : null;
    const p = fp ? previo.get(fp) || vacio : null;
    datos.push({
      clave: fa,
      claveAnterior: fp,
      etiqueta: mes ? String(i + 1) : formatoClave(fa),
      letra: fa ? letraDe(fa) : "",
      monto: a ? a.monto : null,
      n: a ? a.n : 0,
      previo: p ? p.monto : null,
      nPrevio: p ? p.n : 0,
      clientes: a ? a.clientes || 0 : 0,
      nuevos: a ? a.nuevos || 0 : 0,
      recompras: a ? a.recompras || 0 : 0,
      clientesPrev: p ? p.clientes || 0 : null,
      nuevosPrev: p ? p.nuevos || 0 : null,
      recomprasPrev: p ? p.recompras || 0 : null,
    });
  }
  const nombreMes = (iso) => formatoClave(iso.slice(0, 7));
  return {
    datos,
    etiquetaActual: mes ? nombreMes(iniAct) : "Periodo actual",
    etiquetaPrevia: mes ? nombreMes(iniPrev) : "Periodo anterior",
  };
}

/** Variación porcentual de a respecto a b (null si no hay base de comparación). */
const variacion = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default async function DashboardPage({ searchParams }) {
  const params = await searchParams;
  const tab = TABS.some(([k]) => k === params?.tab) ? params.tab : "ventas";
  const periodo = resolverPeriodo(params);
  const opciones = await getOpcionesVentas();
  const { categoria } = leerFiltrosVentas(params, opciones);

  // Enlaces que conservan pestaña, periodo y filtros.
  const href = (extra = {}) => {
    const base = {
      tab: tab === "ventas" ? "" : tab,
      periodo: periodo.clave === "mes" ? "" : periodo.clave,
      desde: periodo.clave === "custom" ? periodo.desde : "",
      hasta: periodo.clave === "custom" ? periodo.hasta : "",
      categoria,
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

  const esStock = tab === "stock";
  const [v, c, anual, filasPrevias] = await Promise.all([
    esStock ? null : getDashboardVentas({ ...periodo, categoria }),
    esStock ? getResumenCatalogo() : null,
    tab === "ventas" ? getVentasAnuales({ categoria }) : null,
    (tab === "ventas" || tab === "clientes") && periodo.dias > 1 && periodo.dias <= 62 ? getVentasPorDia({ ...rangoComparacion(periodo), categoria }) : null,
  ]);

  return (
    <div className="form-grid">
      <h1 className="solo-lector">Dashboard</h1>

      <div className="dash-cabecera">
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
            opciones={opciones}
            atajos={atajos}
            hrefs={{
              periodo: href({ periodo: "", desde: "", hasta: "" }),
              categoria: href({ categoria: "" }),
            }}
          />
        )}
      </div>

      {tab === "ventas" && v && <VentasTab v={v} periodo={periodo} anual={anual} filasPrevias={filasPrevias} />}
      {tab === "clientes" && v && <ClientesTab v={v} periodo={periodo} filasPrevias={filasPrevias} />}
      {esStock && c && <StockTab c={c} />}
    </div>
  );
}

function VentasTab({ v, periodo, anual, filasPrevias }) {
  const serie = filasPrevias ? serieComparada(periodo, v, filasPrevias) : null;
  // Para los minigráficos: el periodo anterior solo hasta los mismos días transcurridos del actual.
  const previos = serie ? serie.datos.slice(0, v.tendencia.length) : null;
  // Mismo tramo de días que el periodo actual (con «Este mes», los días transcurridos del mes anterior).
  // Saldo por cobrar según los días que lleva pendiente (no depende del periodo elegido).
  const antiguedad = [
    { nombre: "0 a 7 días", valor: v.pendientes.d0_7, color: "#f4a3c9" },
    { nombre: "8 a 30 días", valor: v.pendientes.d8_30, color: "#e8267f" },
    { nombre: "Más de 30 días", valor: v.pendientes.d31_mas, color: "#9d1559" },
  ];
  const ticketPrevio = v.previo.n ? v.previo.monto / v.previo.n : 0;
  const etiquetaPrev = `vs ${periodo.previo.desde === periodo.previo.hasta ? periodo.previo.desde : "periodo anterior"}`;
  return (
    <>
      <div className="kpi-grid">
        <Kpi etiqueta="Ventas (monto)" valor={soles(v.monto)} delta={v.variacion} deltaTexto={etiquetaPrev} chispa={v.tendencia.map((d) => d.monto)} chispaPrevia={previos?.map((d) => d.previo)} id="monto" />
        <Kpi etiqueta="Nº de ventas" valor={entero(v.n)} sub={`${entero(v.previo.n)} en el periodo anterior`} chispa={v.tendencia.map((d) => d.n)} chispaPrevia={previos?.map((d) => d.nPrevio)} id="nventas" />
        <Kpi
          etiqueta="Ticket promedio"
          valor={solesDec(v.ticket)}
          delta={ticketPrevio > 0 ? ((v.ticket - ticketPrevio) / ticketPrevio) * 100 : null}
          deltaTexto={etiquetaPrev}
          sub={ticketPrevio > 0 ? `${solesDec(ticketPrevio)} en el periodo anterior` : undefined}
          desglose={
            v.porCategoria.filter((d) => d.n > 0).length > 1
              ? v.porCategoria.filter((d) => d.n > 0).map((d) => ({ nombre: d.nombre, valor: solesDec(d.monto / d.n) }))
              : undefined
          }
        />
        <Link href="/admin/ventas/pendientes" className="kpi-enlace">
          <Kpi
            etiqueta="Por cobrar (acumulado)"
            valor={soles(v.pendientes.saldo)}
            sub={`${v.pendientes.n} ventas pendientes →`}
            barra={antiguedad}
            desglose={antiguedad.filter((d) => d.valor > 0).map((d) => ({ nombre: d.nombre, valor: soles(d.valor), color: d.color }))}
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
          nota={
            filasPrevias
              ? "Comparado con el periodo anterior, día a día. Pasa el cursor para ver el detalle."
              : "Pasa el cursor sobre el gráfico para ver el monto y el número de ventas."
          }
        >
          {serie ? (
            <Tendencia {...serie} />
          ) : (
            <Tendencia datos={v.tendencia.map((d) => ({ clave: d.clave, etiqueta: formatoClave(d.clave), monto: d.monto, n: d.n }))} />
          )}
        </Seccion>
      )}

      {(anual || (serie && !v.tendenciaPorMes && periodo.dias > 6)) && (
        <div className="dash-grid dos">
          {serie && !v.tendenciaPorMes && periodo.dias > 6 && (
            <Seccion
              titulo="Ventas por día de la semana"
              nota="Suma de cada día de la semana en el periodo, junto al periodo anterior con los mismos días transcurridos."
            >
              <Columnas datos={porDiaSemana(v.tendencia, filasPrevias, periodo.previo)} etiquetaActual={serie.etiquetaActual} etiquetaPrevia={serie.etiquetaPrevia} />
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
        </div>
      )}

      <div className="dash-grid">
        <Seccion titulo="Por categoría">
          <Dona datos={v.porCategoria} centro="Ventas" />
        </Seccion>
        <Seccion titulo="Método de pago">
          <Dona datos={v.porMetodo} centro="Ventas" colores={COLORES_METODO} />
        </Seccion>
        <Seccion titulo="Entrega: courier o destino">
          <BarrasH datos={v.porEntrega} />
        </Seccion>
      </div>

    </>
  );
}

function ClientesTab({ v, periodo, filasPrevias }) {
  const serie = filasPrevias ? serieComparada(periodo, v, filasPrevias) : null;
  // Minigráficos: el periodo anterior solo hasta los mismos días transcurridos del actual.
  const previos = serie ? serie.datos.slice(0, v.tendencia.length) : null;
  const etiquetaPrev = `vs ${periodo.previo.desde === periodo.previo.hasta ? periodo.previo.desde : "periodo anterior"}`;
  const p = v.previo;
  const conTipo = v.nuevos + v.recompras;

  // Frecuencia de compra: actual y periodo anterior sobre las mismas categorías.
  const FRECUENCIA = ["1 compra", "2 compras", "3-4 compras", "5 o más"];
  const actual = new Map(v.frecuencia.map((f) => [f.nombre, f.n]));
  const anterior = new Map(v.frecuenciaPrevia.map((f) => [f.nombre, f.n]));
  const datosFrecuencia = FRECUENCIA.map((nombre) => ({ nombre, monto: actual.get(nombre) || 0, previo: anterior.get(nombre) || 0 }));

  return (
    <>
      <div className="kpi-grid">
        <Kpi
          etiqueta="Clientes únicos"
          valor={entero(v.clientes)}
          delta={variacion(v.clientes, p.clientes)}
          deltaTexto={etiquetaPrev}
          sub={p.clientes > 0 ? `${entero(p.clientes)} en el periodo anterior` : "con teléfono registrado"}
          chispa={v.tendencia.map((d) => d.clientes)}
          chispaPrevia={previos?.map((d) => d.clientesPrev)}
          id="clientes"
        />
        <Kpi
          etiqueta="Compras de clientes nuevos"
          valor={entero(v.nuevos)}
          delta={variacion(v.nuevos, p.nuevos)}
          deltaTexto={etiquetaPrev}
          sub={`${pct(v.nuevos, conTipo)} de las ventas con tipo`}
          chispa={v.tendencia.map((d) => d.nuevos)}
          chispaPrevia={previos?.map((d) => d.nuevosPrev)}
          id="nuevos"
        />
        <Kpi
          etiqueta="Compras de recompra"
          valor={entero(v.recompras)}
          delta={variacion(v.recompras, p.recompras)}
          deltaTexto={etiquetaPrev}
          sub={`${pct(v.recompras, conTipo)} de las ventas con tipo`}
          chispa={v.tendencia.map((d) => d.recompras)}
          chispaPrevia={previos?.map((d) => d.recomprasPrev)}
          id="recompras"
        />
        <Kpi
          etiqueta={`Sin teléfono (${TELEFONO_SIN_DATO})`}
          valor={pct(v.sin_telefono, v.n)}
          sub={`${entero(v.sin_telefono)} de ${entero(v.n)} ventas`}
          tono={v.n > 0 && v.sin_telefono / v.n > 0.1 ? "aviso" : undefined}
        />
      </div>

      <div className="dash-grid dos">
        <Seccion titulo="Nuevos vs recompra (monto)" nota="Con la variación frente al periodo anterior (mismos días transcurridos).">
          <Dona
            centro="Ventas"
            datos={[
              { nombre: "Nuevos", monto: v.monto_nuevos, n: v.nuevos, previo: p.monto_nuevos, color: "#e8267f" },
              { nombre: "Recompra", monto: v.monto_recompras, n: v.recompras, previo: p.monto_recompras, color: "#2a78d6" },
            ]}
          />
        </Seccion>
        <Seccion titulo="Frecuencia de compra" nota="Clientes con teléfono según cuántas veces compraron, junto al periodo anterior.">
          <Columnas
            datos={datosFrecuencia}
            formato="clientes"
            etiquetaActual={serie?.etiquetaActual || "Periodo actual"}
            etiquetaPrevia={serie?.etiquetaPrevia || "Periodo anterior"}
          />
        </Seccion>
      </div>

      <Seccion titulo="Mejores clientes del periodo" nota={`Top ${v.topClientes.length} por monto. «% del periodo» es su parte de las ventas totales (${soles(v.monto)}).`}>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-tabla tabla-clientes">
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th className="num">Compras</th>
                <th className="num">Ticket</th>
                <th>Monto</th>
                <th className="num">% del periodo</th>
                <th>Última compra</th>
              </tr>
            </thead>
            <tbody>
              {v.topClientes.map((t, i) => (
                <tr key={t.telefono}>
                  <td>
                    <span className={i < 3 ? `cli-puesto top${i + 1}` : "cli-puesto"}>{i + 1}</span>
                  </td>
                  <td>
                    <Link href={`/admin/ventas?q=${encodeURIComponent(t.telefono)}`} className="cli-nombre" title="Ver sus ventas">
                      {t.nombre || t.telefono}
                    </Link>
                    {t.nombre && <small className="cli-tel">{t.telefono}</small>}
                  </td>
                  <td>
                    <span className={t.nuevo ? "pill cli-tipo nuevo" : "pill cli-tipo"}>{t.nuevo ? "Nuevo" : "Recompra"}</span>
                  </td>
                  <td className="num">{t.n}</td>
                  <td className="num">{solesDec(t.monto / t.n)}</td>
                  <td>
                    <div className="cli-monto">
                      <strong>{solesDec(t.monto)}</strong>
                      <span className="cli-barra">
                        <i style={{ width: `${Math.max(3, (t.monto / v.topClientes[0].monto) * 100)}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="num">{v.monto > 0 ? `${((t.monto / v.monto) * 100).toFixed(1)}%` : "—"}</td>
                  <td>{formatoClave(t.ultima)}</td>
                </tr>
              ))}
              {v.topClientes.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--gris)" }}>
                    Sin datos en este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Seccion>
    </>
  );
}

function StockTab({ c }) {
  const total = c.variantes || 1;
  const parte = (n) => `${Math.round((n / total) * 100)}% de las variantes`;
  const margen = c.valor_venta - c.valor_costo;
  const margenPct = c.valor_venta > 0 ? (margen / c.valor_venta) * 100 : 0;
  const enAlerta = c.agotadas + c.bajo_minimo;
  const fecha = (d) => new Date(d).toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit" });

  return (
    <>
      <div className="kpi-grid">
        <Kpi etiqueta="Productos" valor={entero(c.productos)} sub={`${entero(c.variantes)} variantes activas`} />
        <Kpi etiqueta="Agotadas" valor={entero(c.agotadas)} sub={parte(c.agotadas)} tono={c.agotadas > 0 ? "grave" : undefined} />
        <Kpi etiqueta="Bajo mínimo" valor={entero(c.bajo_minimo)} sub={parte(c.bajo_minimo)} tono={c.bajo_minimo > 0 ? "aviso" : undefined} />
        <Kpi etiqueta="Sin control de stock" valor={entero(c.sin_control)} sub={`${parte(c.sin_control)} · sin cantidad cargada`} />
        <Kpi
          etiqueta="Inventario a precio de venta"
          valor={soles(c.valor_venta)}
          desglose={[
            { nombre: "A costo", valor: soles(c.valor_costo) },
            { nombre: "Margen potencial", valor: `${soles(margen)} (${margenPct.toFixed(0)}%)` },
          ]}
        />
      </div>

      <div className="dash-grid dos">
        <Seccion titulo="Estado del inventario" nota="Variantes activas según su stock.">
          <Dona
            centro="Variantes"
            formato="entero"
            datos={[
              { nombre: "Con stock normal", monto: Math.max(0, c.variantes - c.agotadas - c.bajo_minimo - c.sin_control), color: ESTADO.bien },
              { nombre: "Bajo mínimo", monto: c.bajo_minimo, color: ESTADO.aviso },
              { nombre: "Agotadas", monto: c.agotadas, color: ESTADO.grave },
              { nombre: "Sin control", monto: c.sin_control, color: ESTADO.neutro },
            ]}
          />
        </Seccion>
        <Seccion titulo="Variantes por marca" nota="Las marcas con más variantes; en rojo, las agotadas.">
          <BarrasApiladas datos={c.porMarca.map((m) => ({ nombre: m.nombre, a: m.n - m.agotadas, b: m.agotadas }))} />
        </Seccion>
      </div>

      <div className="dash-grid dos">
        <Seccion titulo="Alertas de stock" nota={`${c.alertas.length} de ${entero(enAlerta)} variantes en alerta, las más críticas primero.`}>
          {c.alertas.length ? (
            <table className="admin-tabla tabla-compacta">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock / mínimo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {c.alertas.map((a) => {
                  const agotada = a.stock_actual === 0;
                  const ratio = a.stock_minimo > 0 ? Math.min(1, a.stock_actual / a.stock_minimo) : 0;
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/productos/${a.producto_id}`} className="cli-nombre" title="Editar producto">
                          {a.producto}
                        </Link>
                        <small className="cli-tel">{a.variante}</small>
                      </td>
                      <td>
                        <div className="stk-nivel">
                          <span>
                            <strong>{a.stock_actual}</strong> / {a.stock_minimo}
                          </span>
                          <span className="stk-barra">
                            <i style={{ width: `${Math.max(agotada ? 0 : 6, ratio * 100)}%`, background: agotada ? ESTADO.grave : ESTADO.aviso }} />
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={agotada ? "pill agotado" : "pill bajo"}>{agotada ? "Agotada" : "Bajo mínimo"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "var(--gris)" }}>Sin alertas de stock.</p>
          )}
          <p style={{ marginTop: 10 }}>
            <Link href="/admin?c_stock=alertas">Ver todas en Productos →</Link>
          </p>
        </Seccion>

        <Seccion titulo="Entradas de stock (30 días)" nota="Lo más cercano a compras: movimientos de tipo entrada.">
          <div className="stk-resumen">
            <span><strong>{entero(c.entradasResumen.unidades)}</strong> unidades</span>
            <span><strong>{soles(c.entradasResumen.valor_costo)}</strong> a costo</span>
            <span><strong>{entero(c.entradasResumen.movimientos)}</strong> movimientos</span>
          </div>
          {c.entradas.length ? (
            <table className="admin-tabla tabla-compacta">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th className="num">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {c.entradas.map((e) => (
                  <tr key={e.id}>
                    <td>{fecha(e.created_at)}</td>
                    <td>
                      <span className="cli-nombre">{e.producto}</span>
                      <small className="cli-tel">{[e.variante, e.referencia || e.motivo].filter(Boolean).join(" · ")}</small>
                    </td>
                    <td className="num">
                      <span className="pill cerrada">+{e.cantidad}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "var(--gris)" }}>Aún no hay entradas registradas.</p>
          )}
        </Seccion>
      </div>
    </>
  );
}
