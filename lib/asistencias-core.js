/**
 * Reglas de asistencia y pago (puras: sirven en servidor y en cliente).
 *
 * Modelo (todo en minutos desde las 00:00, hora de Lima):
 *  - Jornada neta   = hora_salida − hora_entrada (configuración).
 *  - Salida prevista = ingreso real + jornada neta + refrigerio.
 *  - Trabajado      = salida real − ingreso − refrigerio.
 *  - Extra          = max(0, trabajado − jornada neta).
 *  - Pago           = min(trabajado, jornada) × tarifa/h
 *                     + (extras aprobadas ? extra × tarifa/h × multiplicador : 0)
 */
const JORNADAS = { COMPLETO: "Completo", MEDIO_TIEMPO: "Medio tiempo" };
const TIPOS_PAGO = { SEMANAL: "Semanal", QUINCENAL: "Quincenal", MENSUAL: "Mensual" };

/** "HH:MM" o "HH:MM:SS" -> minutos; null si no es válida. */
function aMinutos(hora) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hora || ""));
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

/** minutos -> "HH:MM" (módulo 24 h). */
function aHora(min) {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function minutosJornada(entrada, salida) {
  const a = aMinutos(entrada);
  const b = aMinutos(salida);
  if (a === null || b === null || b <= a) return null;
  return b - a;
}

function salidaPrevista(ingreso, minutosJornadaNeta, refrigerioMin) {
  const i = aMinutos(ingreso);
  if (i === null) return null;
  return aHora(i + minutosJornadaNeta + refrigerioMin);
}

const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Calcula minutos y pago de una asistencia (fila de la tabla).
 * Sin salida real devuelve `abierta: true` y el pago de la jornada completa
 * como estimado.
 */
function calcularAsistencia(a) {
  const jornada = Number(a.minutos_jornada);
  const ref = Number(a.refrigerio_min) || 0;
  const tarifa = Number(a.tarifa);
  const mult = Number(a.multiplicador);
  const ingreso = aMinutos(a.hora_ingreso);
  const salida = aMinutos(a.hora_salida);
  const abierta = salida === null;

  let trabajado = jornada;
  if (!abierta) trabajado = Math.max(0, salida - ingreso - ref);
  const normales = Math.min(trabajado, jornada);
  const extra = Math.max(0, trabajado - jornada);
  const aprobadas = Boolean(a.extras_aprobadas);

  const pagoNormal = (normales / 60) * tarifa;
  const pagoExtra = aprobadas ? (extra / 60) * tarifa * mult : 0;
  const pagoExtraPendiente = !aprobadas ? (extra / 60) * tarifa * mult : 0;

  return {
    abierta,
    trabajado,
    normales,
    extra,
    aprobadas,
    pagoNormal: redondear(pagoNormal),
    pagoExtra: redondear(pagoExtra),
    pagoExtraPendiente: redondear(pagoExtraPendiente),
    pago: redondear(pagoNormal + pagoExtra),
  };
}

/** 495 -> "8 h 15 min" */
function formatoDuracion(min) {
  const m = Math.round(min);
  if (m <= 0) return "0 min";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h && r ? `${h} h ${r} min` : h ? `${h} h` : `${r} min`;
}

module.exports = {
  JORNADAS,
  TIPOS_PAGO,
  aMinutos,
  aHora,
  minutosJornada,
  salidaPrevista,
  calcularAsistencia,
  formatoDuracion,
};
