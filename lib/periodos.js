/**
 * Periodos del dashboard (fechas "YYYY-MM-DD" en hora de Lima).
 * resolverPeriodo(params) -> { clave, desde, hasta, dias, etiqueta, previo }
 * `previo` es el periodo contra el que se compara.
 */
const PERIODOS = {
  hoy: "Hoy",
  ayer: "Ayer",
  "7d": "7 días",
  mes: "Este mes",
  mes_ant: "Mes anterior",
  custom: "Personalizado",
};
const ATAJOS = ["hoy", "ayer", "7d", "mes", "mes_ant"];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function hoyLima() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

function aUTC(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function aISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(iso, n) {
  const f = aUTC(iso);
  f.setUTCDate(f.getUTCDate() + n);
  return aISO(f);
}

function diasEntre(desde, hasta) {
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86400000) + 1;
}

function primerDiaMes(iso, desplazamiento = 0) {
  const f = aUTC(iso);
  return aISO(new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + desplazamiento, 1)));
}

function fechaValida(s) {
  return FECHA.test(s) && aISO(aUTC(s)) === s;
}

function resolverPeriodo(params = {}, defecto = "mes") {
  const get = (k) => {
    const v = typeof params.get === "function" ? params.get(k) : params[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const hoy = hoyLima();
  let clave = get("periodo");
  if (!PERIODOS[clave]) clave = defecto;

  let desde;
  let hasta;
  let previo;

  if (clave === "custom") {
    desde = fechaValida(get("desde")) ? get("desde") : null;
    hasta = fechaValida(get("hasta")) ? get("hasta") : null;
    if (!desde && !hasta) {
      clave = defecto;
    } else {
      desde = desde || hasta;
      hasta = hasta || desde;
      if (desde > hasta) [desde, hasta] = [hasta, desde];
      if (hasta > hoy) hasta = hoy;
      if (desde > hasta) desde = hasta;
    }
  }

  if (clave === "hoy") {
    desde = hasta = hoy;
  } else if (clave === "ayer") {
    desde = hasta = sumarDias(hoy, -1);
  } else if (clave === "7d") {
    desde = sumarDias(hoy, -6);
    hasta = hoy;
  } else if (clave === "mes") {
    desde = primerDiaMes(hoy);
    hasta = hoy;
    const dias = diasEntre(desde, hasta);
    const pd = primerDiaMes(hoy, -1);
    const ultimoPrev = sumarDias(desde, -1);
    const ph = sumarDias(pd, dias - 1);
    previo = { desde: pd, hasta: ph > ultimoPrev ? ultimoPrev : ph };
  } else if (clave === "mes_ant") {
    desde = primerDiaMes(hoy, -1);
    hasta = sumarDias(primerDiaMes(hoy), -1);
    previo = { desde: primerDiaMes(hoy, -2), hasta: sumarDias(desde, -1) };
  }

  const dias = diasEntre(desde, hasta);
  if (!previo) previo = { desde: sumarDias(desde, -dias), hasta: sumarDias(desde, -1) };

  return {
    clave,
    desde,
    hasta,
    dias,
    previo,
    etiqueta: clave === "custom" ? `${desde} a ${hasta}` : PERIODOS[clave],
  };
}

/** Fecha válida "YYYY-MM-DD" o, si no lo es, hoy (Lima). */
function resolverFecha(s) {
  return typeof s === "string" && fechaValida(s.trim()) ? s.trim() : hoyLima();
}

module.exports = {
  PERIODOS,
  ATAJOS,
  hoyLima,
  sumarDias,
  diasEntre,
  primerDiaMes,
  fechaValida,
  resolverFecha,
  resolverPeriodo,
};
