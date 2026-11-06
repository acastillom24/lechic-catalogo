/** Lee y sanea los filtros del reporte de ventas desde searchParams / FormData. */
const { CATEGORIAS, DESTINOS, TIPOS_CLIENTE, ESTADOS } = require("./ventas-core");

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function leerFiltrosVentas(p = {}) {
  const get = (k) => {
    const v = typeof p.get === "function" ? p.get(k) : p[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const enLista = (v, lista) => (lista.includes(v) ? v : undefined);
  return {
    desde: FECHA.test(get("desde")) ? get("desde") : undefined,
    hasta: FECHA.test(get("hasta")) ? get("hasta") : undefined,
    categoria: enLista(get("categoria"), CATEGORIAS),
    destino: enLista(get("destino"), DESTINOS),
    estado: enLista(get("estado"), ESTADOS),
    tipo: enLista(get("tipo"), TIPOS_CLIENTE),
    q: get("q").slice(0, 40) || undefined,
  };
}

module.exports = { leerFiltrosVentas };
