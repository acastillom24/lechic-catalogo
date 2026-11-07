/**
 * Acceso a datos de colaboradores y asistencias (solo servidor).
 * Fechas como texto "YYYY-MM-DD" y horas como "HH:MM" (hora de Lima).
 */
const { query } = require("./db");
const { hoyLima, resolverFecha } = require("./periodos");
const {
  JORNADAS,
  TIPOS_PAGO,
  aMinutos,
  minutosJornada,
  calcularAsistencia,
} = require("./asistencias-core");

const COLS_COLABORADOR = `id, nombre, cargo, jornada, tipo_pago, multiplicador::float8 as multiplicador,
  tarifa::float8 as tarifa, to_char(hora_entrada, 'HH24:MI') as hora_entrada,
  to_char(hora_salida, 'HH24:MI') as hora_salida, refrigerio_min, activo,
  fecha_baja::text as fecha_baja`;

// ============================================================
//  COLABORADORES
// ============================================================

async function listarColaboradores() {
  return query(`select ${COLS_COLABORADOR} from colaboradores order by activo desc, lower(nombre)`);
}

function validarColaborador(d) {
  const nombre = String(d.nombre || "").trim();
  if (nombre.length < 2 || nombre.length > 80) throw new Error("Escribe el nombre del trabajador.");
  const cargo = String(d.cargo || "").trim().slice(0, 60);
  if (!JORNADAS[d.jornada]) throw new Error("Elige la jornada.");
  if (!TIPOS_PAGO[d.tipo_pago]) throw new Error("Elige el tipo de pago.");
  const tarifa = Number(String(d.tarifa).replace(",", "."));
  if (!Number.isFinite(tarifa) || tarifa < 0) throw new Error("La tarifa por hora no es válida.");
  const multiplicador = Number(String(d.multiplicador || "1.25").replace(",", "."));
  if (!Number.isFinite(multiplicador) || multiplicador < 1 || multiplicador > 5) {
    throw new Error("El multiplicador debe estar entre 1 y 5.");
  }
  if (minutosJornada(d.hora_entrada, d.hora_salida) === null) {
    throw new Error("La hora de salida debe ser posterior a la de entrada.");
  }
  const refrigerio = Number(d.refrigerio_min || 0);
  if (!Number.isInteger(refrigerio) || refrigerio < 0 || refrigerio > 240) {
    throw new Error("Refrigerio: entre 0 y 240 minutos.");
  }
  return {
    nombre,
    cargo,
    jornada: d.jornada,
    tipo_pago: d.tipo_pago,
    tarifa,
    multiplicador,
    hora_entrada: String(d.hora_entrada).slice(0, 5),
    hora_salida: String(d.hora_salida).slice(0, 5),
    refrigerio,
  };
}

async function crearColaborador(datos) {
  const c = validarColaborador(datos);
  await query(
    `insert into colaboradores
       (nombre, cargo, jornada, tipo_pago, multiplicador, tarifa, hora_entrada, hora_salida, refrigerio_min)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [c.nombre, c.cargo, c.jornada, c.tipo_pago, c.multiplicador, c.tarifa, c.hora_entrada, c.hora_salida, c.refrigerio]
  );
}

async function actualizarColaborador(id, datos) {
  const c = validarColaborador(datos);
  const filas = await query(
    `update colaboradores set nombre=$2, cargo=$3, jornada=$4, tipo_pago=$5, multiplicador=$6,
       tarifa=$7, hora_entrada=$8, hora_salida=$9, refrigerio_min=$10
     where id=$1 returning id`,
    [id, c.nombre, c.cargo, c.jornada, c.tipo_pago, c.multiplicador, c.tarifa, c.hora_entrada, c.hora_salida, c.refrigerio]
  );
  if (!filas.length) throw new Error("El trabajador ya no existe.");
}

async function cambiarEstadoColaborador(id, activo) {
  await query(
    `update colaboradores set activo = $2::boolean,
       fecha_baja = case when $2::boolean then null else (now() at time zone 'America/Lima')::date end
     where id = $1`,
    [id, activo]
  );
}

// ============================================================
//  ASISTENCIAS
// ============================================================

/**
 * Una fila por colaborador para la fecha: activos + quienes ya tienen
 * registro ese día (aunque luego los hayan dado de baja).
 */
async function asistenciasDelDia(fecha) {
  return query(
    `select c.id as colaborador_id, c.nombre, c.cargo, c.activo,
            to_char(c.hora_entrada, 'HH24:MI') as cfg_entrada,
            to_char(c.hora_salida, 'HH24:MI') as cfg_salida,
            c.refrigerio_min as cfg_refrigerio,
            c.tarifa::float8 as cfg_tarifa, c.multiplicador::float8 as cfg_multiplicador,
            a.id as asistencia_id, to_char(a.hora_ingreso, 'HH24:MI') as hora_ingreso,
            to_char(a.hora_salida, 'HH24:MI') as hora_salida,
            a.tarifa::float8 as tarifa, a.multiplicador::float8 as multiplicador,
            a.minutos_jornada, a.refrigerio_min, a.extras_aprobadas
       from colaboradores c
       left join asistencias a on a.colaborador_id = c.id and a.fecha = $1::date
      where c.activo or a.id is not null
      order by lower(c.nombre)`,
    [fecha]
  );
}

function validarHora(h, etiqueta) {
  if (aMinutos(h) === null) throw new Error(`${etiqueta}: hora no válida.`);
  return String(h).slice(0, 5);
}

async function marcarIngreso(colaboradorId, fecha, hora) {
  const f = resolverFecha(fecha);
  if (f > hoyLima()) throw new Error("No se puede registrar una fecha futura.");
  const h = validarHora(hora, "Hora de ingreso");
  const [c] = await query(
    `select tarifa, multiplicador, to_char(hora_entrada,'HH24:MI') as hora_entrada,
            to_char(hora_salida,'HH24:MI') as hora_salida, refrigerio_min, activo
       from colaboradores where id = $1`,
    [colaboradorId]
  );
  if (!c) throw new Error("El trabajador no existe.");
  if (!c.activo) throw new Error("El trabajador está dado de baja.");
  const jornada = minutosJornada(c.hora_entrada, c.hora_salida);
  const filas = await query(
    `insert into asistencias
       (colaborador_id, fecha, hora_ingreso, tarifa, multiplicador, minutos_jornada, refrigerio_min)
     values ($1, $2::date, $3, $4, $5, $6, $7)
     on conflict (colaborador_id, fecha) do nothing returning id`,
    [colaboradorId, f, h, c.tarifa, c.multiplicador, jornada, c.refrigerio_min]
  );
  if (!filas.length) throw new Error("Ya hay un ingreso registrado para ese día.");
}

async function marcarSalida(asistenciaId, hora) {
  const h = validarHora(hora, "Hora de salida");
  const [a] = await query("select to_char(hora_ingreso,'HH24:MI') as hora_ingreso from asistencias where id = $1", [
    asistenciaId,
  ]);
  if (!a) throw new Error("El registro ya no existe.");
  if (aMinutos(h) <= aMinutos(a.hora_ingreso)) throw new Error("La salida debe ser posterior al ingreso.");
  await query("update asistencias set hora_salida = $2 where id = $1", [asistenciaId, h]);
}

async function reabrirAsistencia(asistenciaId) {
  await query("update asistencias set hora_salida = null, extras_aprobadas = false where id = $1", [asistenciaId]);
}

async function fijarExtras(asistenciaId, aprobadas) {
  await query("update asistencias set extras_aprobadas = $2::boolean where id = $1", [
    asistenciaId,
    Boolean(aprobadas),
  ]);
}

async function eliminarAsistencia(asistenciaId) {
  await query("delete from asistencias where id = $1", [asistenciaId]);
}

// ============================================================
//  REPORTE DE PAGO
// ============================================================

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Pago por trabajador entre dos fechas (inclusive).
 * Devuelve { resumen: [por trabajador], detalle: [por día] }.
 */
async function reportePago(desde, hasta, colaboradorId = null) {
  const filas = await query(
    `select a.id, a.fecha::text as fecha, c.id as colaborador_id, c.nombre, c.cargo, c.tipo_pago,
            to_char(a.hora_ingreso,'HH24:MI') as hora_ingreso, to_char(a.hora_salida,'HH24:MI') as hora_salida,
            a.tarifa::float8 as tarifa, a.multiplicador::float8 as multiplicador,
            a.minutos_jornada, a.refrigerio_min, a.extras_aprobadas
       from asistencias a join colaboradores c on c.id = a.colaborador_id
      where a.fecha between $1::date and $2::date
        and ($3::bigint is null or c.id = $3::bigint)
      order by lower(c.nombre), a.fecha`,
    [desde, hasta, colaboradorId]
  );

  const detalle = filas.map((f) => ({ ...f, calculo: calcularAsistencia(f) }));
  const mapa = new Map();
  for (const d of detalle) {
    let r = mapa.get(d.colaborador_id);
    if (!r) {
      r = {
        colaborador_id: d.colaborador_id,
        nombre: d.nombre,
        cargo: d.cargo,
        tipo_pago: d.tipo_pago,
        dias: 0,
        abiertas: 0,
        normales: 0,
        extraAprobada: 0,
        extraPendiente: 0,
        pagoNormal: 0,
        pagoExtra: 0,
        pagoExtraPendiente: 0,
        pago: 0,
      };
      mapa.set(d.colaborador_id, r);
    }
    const c = d.calculo;
    r.dias += 1;
    if (c.abierta) r.abiertas += 1;
    r.normales += c.normales;
    if (c.aprobadas) r.extraAprobada += c.extra;
    else r.extraPendiente += c.extra;
    r.pagoNormal += c.pagoNormal;
    r.pagoExtra += c.pagoExtra;
    r.pagoExtraPendiente += c.pagoExtraPendiente;
    r.pago += c.pago;
  }
  const resumen = [...mapa.values()].map((r) => ({
    ...r,
    pagoNormal: r2(r.pagoNormal),
    pagoExtra: r2(r.pagoExtra),
    pagoExtraPendiente: r2(r.pagoExtraPendiente),
    pago: r2(r.pago),
  }));
  return { resumen, detalle };
}

module.exports = {
  listarColaboradores,
  crearColaborador,
  actualizarColaborador,
  cambiarEstadoColaborador,
  asistenciasDelDia,
  marcarIngreso,
  marcarSalida,
  reabrirAsistencia,
  fijarExtras,
  eliminarAsistencia,
  reportePago,
};
