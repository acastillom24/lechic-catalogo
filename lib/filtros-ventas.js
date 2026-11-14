/** Lee y sanea los filtros del reporte de ventas desde searchParams / FormData. */
const { CATEGORIAS, DESTINOS, TIPOS_CLIENTE, ESTADOS } = require("./ventas-core");
const { ATAJOS, resolverPeriodo, fechaValida } = require("./periodos");

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `op` = listas vigentes (lib/ventas-opciones.js). Rango de fechas, por prioridad:
 *   periodo (hoy | ayer | 7d | mes | mes_ant) > fecha (un día) > desde / hasta.
 * Devuelve siempre `desde` y `hasta` ya resueltos, más `periodo` / `fecha` para pintar la barra.
 */
function leerFiltrosVentas(p = {}, op = {}) {
  const get = (k) => {
    const v = typeof p.get === "function" ? p.get(k) : p[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const enLista = (v, lista) => (lista.includes(v) ? v : undefined);
  let desde = FECHA.test(get("desde")) ? get("desde") : undefined;
  let hasta = FECHA.test(get("hasta")) ? get("hasta") : undefined;
  const periodo = ATAJOS.includes(get("periodo")) ? get("periodo") : undefined;
  const fecha = !periodo && fechaValida(get("fecha")) ? get("fecha") : undefined;
  if (periodo) {
    ({ desde, hasta } = resolverPeriodo({ periodo }));
  } else if (fecha) {
    desde = hasta = fecha;
  }
  const monto = (k) => {
    const t = get(k).replace(",", ".");
    return t !== "" && Number.isFinite(Number(t)) && Number(t) >= 0 ? Number(t) : undefined;
  };
  return {
    desde,
    hasta,
    periodo,
    fecha,
    categoria: enLista(get("categoria"), op.categorias || CATEGORIAS),
    destino: enLista(get("destino"), op.destinos || DESTINOS),
    estado: enLista(get("estado"), ESTADOS),
    tipo: enLista(get("tipo"), op.tiposCliente || TIPOS_CLIENTE),
    adelanto: enLista(get("adelanto"), ["con", "sin"]),
    montoMin: monto("montoMin"),
    montoMax: monto("montoMax"),
    distrito: get("distrito").slice(0, 60) || undefined,
    q: get("q").slice(0, 40) || undefined,
  };
}

module.exports = { leerFiltrosVentas };
